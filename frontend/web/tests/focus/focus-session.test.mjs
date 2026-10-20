import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { URL } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const root = new URL('../../', import.meta.url);
const plain = (value) => JSON.parse(JSON.stringify(value));
const storageKey = 'focus-timer-state-v1';

function runner(file, exportName, dependencies, options, globals = {}) {
  const slots = [];
  const effects = [];
  let cursor = 0;
  let dirty = false;
  let current;
  const sameDeps = (before, after) =>
    before?.length === after.length &&
    after.every((value, index) => Object.is(value, before[index]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) {
        slots[index] = {
          value: typeof initial === 'function' ? initial() : initial,
          set(value) {
            const next = typeof value === 'function' ? value(slots[index].value) : value;
            if (!Object.is(next, slots[index].value)) dirty = true;
            slots[index].value = next;
          },
        };
      }
      return [slots[index].value, slots[index].set];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { ref: { current: initial } };
      return slots[index].ref;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || !sameDeps(slots[index].deps, deps)) {
        const previous = slots[index];
        const slot = { deps };
        slots[index] = slot;
        effects.push(() => {
          previous?.cleanup?.();
          slot.cleanup = effect();
        });
      }
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(new URL(file, root), 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      module,
      exports: module.exports,
      Error,
      AbortController: globalThis.AbortController,
      ...globals,
      require(name) {
        if (name === 'react') return react;
        assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
        return dependencies[name];
      },
    },
  );
  function render() {
    cursor = 0;
    dirty = false;
    current = module.exports[exportName](options);
    effects.splice(0).forEach((effect) => effect());
    return current;
  }
  async function settle() {
    for (let pass = 0; pass < 20; pass++) {
      await setImmediate();
      if (!dirty && current) return current;
      render();
    }
    throw new Error('Hook did not settle');
  }
  return { render, settle, unmount: () => slots.forEach((slot) => slot.cleanup?.()) };
}

function timerHarness(overrides = {}, initial = {}) {
  let now = new Date('2026-10-15T01:00:00Z').getTime();
  let nextInterval = 1;
  const intervals = new Map();
  const storage = new Map();
  const calls = [];
  let settingsOpen = true;
  let soundPlays = 0;
  class ClockDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [now]));
    }
    static now() {
      return now;
    }
  }
  class AudioDouble {
    load() {}
    play() {
      soundPlays++;
      return Promise.resolve();
    }
  }
  const options = {
    selectedTaskId: null,
    selectedDuration: 0,
    setSettingsOpen: (value) => {
      settingsOpen = value;
    },
    ...initial.options,
  };
  if (initial.snapshot) storage.set(storageKey, JSON.stringify(initial.snapshot));
  if (initial.rawSnapshot) storage.set(storageKey, initial.rawSnapshot);
  const defaultSession = {
    id: 'session-a',
    started_at: new ClockDate().toISOString(),
    task_id: null,
    task_ids: [],
    planned_duration_minutes: 25,
    actual_duration_seconds: 0,
    status: 'active',
  };
  const api = {
    getActiveFocusSession: async (signal) => {
      calls.push(['restore']);
      return overrides.getActiveFocusSession ? overrides.getActiveFocusSession(signal) : null;
    },
    startFocusSession: async (input) => {
      calls.push(['start', plain(input)]);
      return overrides.startFocusSession
        ? overrides.startFocusSession(input)
        : {
            ...defaultSession,
            task_ids: input.task_ids,
            planned_duration_minutes: input.planned_duration_minutes,
          };
    },
    updateFocusSession: async (...args) => {
      calls.push(['update', ...plain(args)]);
      return overrides.updateFocusSession ? overrides.updateFocusSession(...args) : defaultSession;
    },
    finishFocusSession: async (...args) => {
      calls.push(['finish', ...plain(args)]);
      return overrides.finishFocusSession ? overrides.finishFocusSession(...args) : defaultSession;
    },
  };
  const h = runner(
    'components/focus/use-focus-timer.ts',
    'useFocusTimer',
    { '../../lib/focus': api },
    options,
    {
      Date: ClockDate,
      Audio: AudioDouble,
      window: {
        localStorage: {
          getItem: (key) => storage.get(key) ?? null,
          setItem: (key, value) => storage.set(key, value),
        },
        setInterval: (callback) => {
          const id = nextInterval++;
          intervals.set(id, callback);
          return id;
        },
        clearInterval: (id) => intervals.delete(id),
      },
    },
  );
  return {
    ...h,
    calls,
    options,
    hydrate: async () => {
      h.render();
      return h.settle();
    },
    advance: async (milliseconds) => {
      now += milliseconds;
      [...intervals.values()].forEach((callback) => callback());
      return h.settle();
    },
    snapshot: () => JSON.parse(storage.get(storageKey)),
    settingsOpen: () => settingsOpen,
    soundPlays: () => soundPlays,
    intervalCount: () => intervals.size,
  };
}

test('timer controls never render reset, including restored and running states', () => {
  for (const hasStarted of [false, true]) {
    for (const running of [false, true]) {
      const jsx = (type, props) => ({ type, props });
      const h = runner(
        'components/focus/FocusMode.tsx',
        'FocusMode',
        {
          'react/jsx-runtime': { jsx, jsxs: jsx },
          'next/navigation': { useSearchParams: () => ({ get: () => null }) },
          'lucide-react': { Clock3: 'clock', LoaderCircle: 'loading' },
          './FocusSettingsModal': { FocusSettingsModal: 'settings' },
          './use-focus-tasks': { useFocusTasks: () => ({ tasks: [] }) },
          './use-focus-timer': {
            modes: ['Pomodoro', 'Short Break', 'Long Break'],
            useFocusTimer: () => ({
              mode: 'Pomodoro',
              hasStarted,
              running,
              sessionTaskLocked: hasStarted,
              selectedFocusTaskIds: [],
              timerActionLabel: running ? 'Pause' : 'Start',
            }),
          },
        },
        {},
      );
      const buttons = [];
      function visit(node) {
        if (Array.isArray(node)) return node.forEach(visit);
        if (!node || typeof node !== 'object') return;
        if (node.type === 'button') buttons.push(node.props);
        visit(node.props?.children);
      }
      visit(h.render());
      assert.equal(
        buttons.some((props) => /reset/i.test(props['aria-label'] ?? '')),
        false,
      );
      assert.ok(buttons.some((props) => props['aria-label'] === 'Skip to short break'));
      h.unmount();
    }
  }
});

test('URL task and duration initialize a paused timer and keep the storage contract', async () => {
  const h = timerHarness({}, { options: { selectedTaskId: 'task-a', selectedDuration: 40 } });
  const state = await h.hydrate();
  assert.equal(state.seconds, 2400);
  assert.equal(state.running, false);
  assert.deepEqual(plain(state.selectedFocusTaskIds), ['task-a']);
  assert.equal(h.snapshot().version, 1);
  assert.equal(h.snapshot().durations.focus, 40);
  h.unmount();
});

test('pause and resume record active time while excluding paused time', async () => {
  const h = timerHarness({}, { options: { selectedTaskId: 'task-a' } });
  await h.hydrate();
  await h.render().toggleTimer();
  await h.settle();
  assert.deepEqual(h.calls.find(([name]) => name === 'start')[1], {
    task_ids: ['task-a'],
    planned_duration_minutes: 25,
  });
  await h.advance(10000);
  await h.render().toggleTimer();
  await h.settle();
  assert.equal(h.render().seconds, 1490);
  await h.advance(30000);
  assert.equal(h.render().seconds, 1490);
  await h.render().toggleTimer();
  await h.settle();
  await h.advance(5000);
  h.render().stopFocusSession();
  await h.settle();
  assert.deepEqual(
    h.calls.filter(([name]) => name === 'update').map((call) => call[2]),
    [
      { actual_duration_seconds: 10, status: 'paused' },
      { actual_duration_seconds: 10, status: 'active' },
    ],
  );
  assert.deepEqual(
    h.calls.find(([name]) => name === 'finish'),
    ['finish', 'session-a', 15, false],
  );
  assert.equal(h.render().sessionTaskLocked, false);
  assert.equal(h.render().hasStarted, false);
  assert.equal(h.render().seconds, 1500);
  assert.equal(h.snapshot().hasStarted, false);
  assert.equal(h.snapshot().remainingByMode.Pomodoro, 1500);
  h.unmount();
  assert.equal(h.intervalCount(), 0);
});

test('failed start exposes its error without running or locking task selection', async () => {
  const h = timerHarness({
    startFocusSession: async () => {
      throw new Error('Start failed');
    },
  });
  await h.hydrate();
  await h.render().toggleTimer();
  await h.settle();
  assert.equal(h.render().sessionError, 'Start failed');
  assert.equal(h.render().running, false);
  assert.equal(h.render().isSessionMutating, false);
  assert.equal(h.render().sessionTaskLocked, false);
  h.unmount();
});

test('completion caps recorded time at timer expiry and saves and sounds once', async () => {
  const h = timerHarness({}, { options: { selectedDuration: 1 } });
  await h.hydrate();
  await h.render().toggleTimer();
  await h.settle();
  await h.advance(65000);
  assert.equal(h.render().seconds, 60);
  assert.equal(h.render().hasStarted, false);
  assert.equal(h.snapshot().hasStarted, false);
  assert.equal(h.snapshot().sessionId, null);
  assert.equal(h.render().running, false);
  assert.deepEqual(
    h.calls.filter(([name]) => name === 'finish'),
    [['finish', 'session-a', 60, true]],
  );
  assert.equal(h.soundPlays(), 1);
  await h.advance(10000);
  assert.equal(h.calls.filter(([name]) => name === 'finish').length, 1);
  await h.render().toggleTimer();
  await h.settle();
  assert.equal(h.render().seconds, 60);
  assert.equal(h.render().running, true);
  assert.equal(h.calls.filter(([name]) => name === 'start').length, 2);
  h.unmount();
});

test('failed session save retains its identity and lock so stopping can be retried', async () => {
  let attempts = 0;
  const h = timerHarness({
    finishFocusSession: async () => {
      if (++attempts === 1) throw new Error('Save failed');
    },
  });
  await h.hydrate();
  await h.render().toggleTimer();
  await h.settle();
  await h.advance(7000);
  h.render().stopFocusSession();
  await h.settle();
  assert.equal(h.render().sessionError, 'Save failed');
  assert.equal(h.render().seconds, 1493);
  assert.equal(h.render().hasStarted, true);
  assert.equal(h.render().sessionTaskLocked, true);
  assert.equal(h.render().isSessionMutating, false);
  assert.equal(h.snapshot().sessionId, 'session-a');
  h.render().stopFocusSession();
  await h.settle();
  assert.deepEqual(
    h.calls.filter(([name]) => name === 'finish'),
    [
      ['finish', 'session-a', 7, false],
      ['finish', 'session-a', 7, false],
    ],
  );
  assert.equal(h.render().sessionTaskLocked, false);
  assert.equal(h.render().seconds, 1500);
  assert.equal(h.render().hasStarted, false);
  h.unmount();
});

test('switching modes pauses focus progress and preserves each mode countdown', async () => {
  const h = timerHarness();
  await h.hydrate();
  await h.render().toggleTimer();
  await h.settle();
  await h.advance(10000);
  await h.render().selectMode('Short Break');
  await h.settle();
  assert.equal(h.render().seconds, 300);
  assert.equal(h.render().running, false);
  await h.render().toggleTimer();
  await h.settle();
  await h.advance(20000);
  await h.render().selectMode('Pomodoro');
  await h.settle();
  assert.equal(h.render().seconds, 1490);
  await h.render().selectMode('Short Break');
  await h.settle();
  assert.equal(h.render().seconds, 280);
  assert.equal(h.calls.filter(([name]) => name === 'start').length, 1);
  h.unmount();
});

test('skipping a break opens a fresh focus timer without creating a session', async () => {
  const h = timerHarness();
  await h.hydrate();
  await h.render().selectMode('Short Break');
  await h.settle();
  await h.render().toggleTimer();
  await h.settle();
  await h.advance(10000);
  await h.render().skipSession();
  await h.settle();
  assert.equal(h.render().mode, 'Pomodoro');
  assert.equal(h.render().seconds, 1500);
  assert.equal(h.render().running, false);
  assert.equal(h.render().hasStarted, false);
  assert.equal(
    h.calls.some(([name]) => name === 'start' || name === 'finish'),
    false,
  );
  h.unmount();
});

test('skip records elapsed focus and advances without reviving an old countdown', async () => {
  const h = timerHarness();
  await h.hydrate();
  await h.render().toggleTimer();
  await h.settle();
  await h.advance(7000);
  await h.render().skipSession();
  await h.settle();
  assert.deepEqual(
    h.calls.find(([name]) => name === 'finish'),
    ['finish', 'session-a', 7, false],
  );
  assert.equal(h.render().mode, 'Short Break');
  assert.equal(h.render().seconds, 300);
  assert.equal(h.render().sessionTaskLocked, false);
  assert.equal(h.render().hasStarted, false);
  await h.render().toggleTimer();
  await h.settle();
  await h.advance(10000);
  await h.render().skipSession();
  await h.settle();
  assert.equal(h.render().mode, 'Pomodoro');
  assert.equal(h.render().seconds, 1500);
  assert.equal(h.render().running, false);
  assert.equal(h.snapshot().remainingByMode['Short Break'], 300);
  h.unmount();
});

test('skip does not advance or discard the session when recording fails', async () => {
  const h = timerHarness({
    finishFocusSession: async () => {
      throw new Error('Save failed');
    },
  });
  await h.hydrate();
  await h.render().toggleTimer();
  await h.settle();
  await h.advance(7000);
  await h.render().skipSession();
  await h.settle();
  assert.equal(h.render().mode, 'Pomodoro');
  assert.equal(h.render().seconds, 1493);
  assert.equal(h.render().sessionTaskLocked, true);
  assert.equal(h.render().sessionError, 'Save failed');
  assert.equal(h.snapshot().sessionId, 'session-a');
  h.unmount();
});

function savedSnapshot(overrides = {}) {
  return {
    version: 1,
    mode: 'Pomodoro',
    durations: { focus: 25, shortBreak: 5, longBreak: 15 },
    remainingByMode: { Pomodoro: 900, 'Short Break': 300, 'Long Break': 900 },
    running: false,
    endTime: null,
    sessionId: 'session-a',
    sessionStartedAt: '2026-10-15T00:45:00Z',
    focusedMilliseconds: 500000,
    activeSegmentStartedAt: null,
    ...overrides,
  };
}
test('matching restored sessions retain the local countdown and server elapsed-time minimum', async () => {
  const h = timerHarness(
    {
      getActiveFocusSession: async () => ({
        id: 'session-a',
        started_at: '2026-10-15T00:45:00Z',
        task_ids: ['task-a', 'task-b'],
        planned_duration_minutes: 25,
        actual_duration_seconds: 600,
        status: 'paused',
      }),
    },
    { snapshot: savedSnapshot(), options: { selectedDuration: 40 } },
  );
  await h.hydrate();
  assert.equal(h.render().seconds, 900);
  assert.equal(h.render().durations.focus, 25);
  assert.deepEqual(plain(h.render().selectedFocusTaskIds), ['task-a', 'task-b']);
  assert.equal(h.render().sessionTaskLocked, true);
  assert.equal(h.snapshot().focusedMilliseconds, 600000);
  h.unmount();
});

test('a running restored timer resumes from its wall-clock deadline', async () => {
  const now = new Date('2026-10-15T01:00:00Z').getTime();
  const h = timerHarness(
    {
      getActiveFocusSession: async () => ({
        id: 'session-a',
        started_at: '2026-10-15T00:45:00Z',
        task_ids: [],
        planned_duration_minutes: 25,
        actual_duration_seconds: 60,
        status: 'active',
      }),
    },
    {
      snapshot: savedSnapshot({
        running: true,
        endTime: now + 90000,
        activeSegmentStartedAt: now - 10000,
      }),
    },
  );
  await h.hydrate();
  assert.equal(h.render().seconds, 90);
  assert.equal(h.render().running, true);
  await h.advance(10000);
  assert.equal(h.render().seconds, 80);
  assert.equal(
    h.calls.some(([name]) => name === 'start'),
    false,
  );
  h.unmount();
});

test('server sessions without matching local state restore paused and synchronize active status', async () => {
  const h = timerHarness({
    getActiveFocusSession: async () => ({
      id: 'server-session',
      started_at: '2026-10-15T00:45:00Z',
      task_id: 'task-a',
      task_ids: [],
      planned_duration_minutes: 30,
      actual_duration_seconds: 120,
      status: 'active',
    }),
  });
  await h.hydrate();
  assert.equal(h.render().running, false);
  assert.equal(h.render().seconds, 1680);
  assert.deepEqual(plain(h.render().selectedFocusTaskIds), ['task-a']);
  assert.deepEqual(
    h.calls.find(([name]) => name === 'update'),
    ['update', 'server-session', { actual_duration_seconds: 120, status: 'paused' }],
  );
  h.unmount();
});

test('malformed storage is ignored and URL duration remains usable', async () => {
  const h = timerHarness({}, { rawSnapshot: '{broken', options: { selectedDuration: 35 } });
  await h.hydrate();
  assert.equal(h.render().seconds, 2100);
  assert.equal(h.snapshot().durations.focus, 35);
  h.unmount();
});

for (const saveFails of [false, true]) {
  test(`duration changes ${saveFails ? 'retain settings after failed session save' : 'stop the active session before resetting durations'}`, async () => {
    const h = timerHarness(
      saveFails
        ? {
            finishFocusSession: async () => {
              throw new Error('Save failed');
            },
          }
        : {},
    );
    await h.hydrate();
    await h.render().toggleTimer();
    await h.settle();
    await h.advance(5000);
    await h.render().saveDurations({ focus: 40, shortBreak: 10, longBreak: 20 });
    await h.settle();
    assert.equal(h.render().durations.focus, saveFails ? 25 : 40);
    assert.equal(h.settingsOpen(), saveFails);
    assert.deepEqual(
      h.calls.find(([name]) => name === 'finish'),
      ['finish', 'session-a', 5, false],
    );
    h.unmount();
  });
}

test('task selection keeps its limit while allowing removal and replacement', async () => {
  const h = timerHarness();
  await h.hydrate();
  for (let index = 0; index < 21; index++) h.render().toggleFocusTask(`task-${index}`);
  assert.equal(h.render().selectedFocusTaskIds.length, 20);
  h.render().toggleFocusTask('task-0');
  h.render().toggleFocusTask('task-20');
  assert.equal(h.render().selectedFocusTaskIds.length, 20);
  assert.ok(h.render().selectedFocusTaskIds.includes('task-20'));
  h.unmount();
});

test('task loading uses workflow completion and preserves the deep-link fallback', async () => {
  const h = runner(
    'components/focus/use-focus-tasks.ts',
    'useFocusTasks',
    {
      '../../lib/tasks': {
        listTasks: async () => ({
          items: [
            {
              id: 'active',
              title: 'Active',
              status: 'overdue',
              workflow_status: 'pending',
              due_date: null,
              estimated_duration_minutes: 30,
              project: { name: 'Coursework' },
            },
            { id: 'completed', title: 'Completed', status: 'overdue', workflow_status: 'done' },
          ],
        }),
      },
    },
    { selectedTaskId: 'linked', selectedTaskTitle: 'Linked task' },
  );
  h.render();
  const state = await h.settle();
  assert.deepEqual(plain(state.tasks.map((task) => task.id)), ['linked', 'active']);
  assert.equal(state.tasks[1].projectName, 'Coursework');
  assert.equal(state.tasksLoading, false);
  h.unmount();
});

test('aborted task loading does not expose an error after unmount', async () => {
  let rejectLoad;
  let requestSignal;
  const h = runner(
    'components/focus/use-focus-tasks.ts',
    'useFocusTasks',
    {
      '../../lib/tasks': {
        listTasks: (_params, { signal }) => {
          requestSignal = signal;
          return new Promise((_resolve, reject) => {
            rejectLoad = reject;
          });
        },
      },
    },
    { selectedTaskId: null, selectedTaskTitle: null },
  );
  h.render();
  h.unmount();
  rejectLoad(new Error('Aborted'));
  const state = await h.settle();
  assert.equal(requestSignal.aborted, true);
  assert.equal(state.tasksError, null);
});
