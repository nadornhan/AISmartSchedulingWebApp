import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { URL } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const root = new URL('../../', import.meta.url);
const plain = (value) => JSON.parse(JSON.stringify(value));
function load(file, dependencies = {}) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(new URL(file, root), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      Date,
      Error,
      Intl,
      AbortController: globalThis.AbortController,
      require(name) {
        assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
        return dependencies[name];
      },
    },
  );
  return module.exports;
}
const model = load('components/calendar/calendar-model.ts');
const iso = (day, hour = 9, minute = 15) => new Date(2026, 9, day, hour, minute).toISOString();
function response(overrides = {}) {
  return {
    id: 'task-a',
    title: 'Calendar task',
    project: null,
    due_date: iso(14),
    scheduled_start: null,
    scheduled_end: null,
    schedule_locked: false,
    estimated_duration_minutes: 45,
    priority: 'medium',
    status: 'pending',
    ...overrides,
  };
}

test('month grid keeps six Sunday-first weeks, including leap day and adjacent months', () => {
  const days = model.buildMonthDays(new Date(2028, 1, 1));
  assert.equal(days.length, 42);
  assert.equal(days[0].date.getDay(), 0);
  assert.equal(days[0].key, '2028-01-30');
  assert.equal(days.at(-1).key, '2028-03-11');
  assert.equal(days.find((day) => day.key === '2028-02-29').isCurrentMonth, true);
  assert.equal(days.filter((day) => day.isCurrentMonth).length, 29);
});

test('week and day views preserve local calendar dates across year boundaries', () => {
  const selected = new Date(2027, 0, 1, 15);
  const week = model.buildWeekDays(selected);
  assert.deepEqual(plain(week.map((day) => day.key)), [
    '2026-12-27',
    '2026-12-28',
    '2026-12-29',
    '2026-12-30',
    '2026-12-31',
    '2027-01-01',
    '2027-01-02',
  ]);
  assert.equal(model.buildDay(selected)[0].date, selected);
  assert.equal(model.dateKey(selected), '2027-01-01');
});

test('scheduled start takes precedence over deadline while retaining scheduling metadata', () => {
  const task = model.toCalendarTask(
    response({ scheduled_start: iso(13), scheduled_end: iso(13, 10), schedule_locked: true }),
  );
  assert.equal(task.calendarDate, iso(13));
  assert.equal(task.dueDate, iso(14));
  assert.equal(task.scheduleLocked, true);
  assert.equal(task.project, 'Unassigned');
  assert.equal(model.toCalendarTask(response({ due_date: null })), null);
  const groups = model.groupTasks([task, model.toCalendarTask(response({ id: 'task-b' }))]);
  assert.deepEqual(Object.keys(groups), ['2026-10-13', '2026-10-14']);
});

function harness(overrides = {}) {
  const slots = [];
  const pendingEffects = [];
  const calls = [];
  const signals = [];
  const subscriptions = { tasks: new Set(), projects: new Set() };
  let cursor = 0;
  let rows = [response()];
  let selectedDate;
  const options = {
    visibleRange: { dueFrom: iso(1, 0, 0), dueTo: iso(31, 23, 59) },
    selectDate: (date) => {
      selectedDate = date;
    },
  };
  const sameDeps = (before, after) =>
    before?.length === after.length &&
    after.every((value, index) => Object.is(value, before[index]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index])
        slots[index] = {
          value: initial,
          setter(value) {
            slots[index].value = typeof value === 'function' ? value(slots[index].value) : value;
          },
        };
      return [slots[index].value, slots[index].setter];
    },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!slots[index] || !sameDeps(slots[index].deps, deps)) slots[index] = { callback, deps };
      return slots[index].callback;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || !sameDeps(slots[index].deps, deps)) {
        const previous = slots[index];
        const slot = { deps };
        slots[index] = slot;
        pendingEffects.push(() => {
          previous?.cleanup?.();
          slot.cleanup = effect();
        });
      }
    },
  };
  const subscribe = (kind) => (listener) => {
    subscriptions[kind].add(listener);
    return () => subscriptions[kind].delete(listener);
  };
  const api = {
    listTasks: async (params, { signal }) => {
      calls.push(['listTasks', plain(params)]);
      signals.push(signal);
      return overrides.listTasks
        ? overrides.listTasks(params, signal)
        : { items: rows, total_pages: 1 };
    },
    createTask: async (input) => {
      calls.push(['createTask', plain(input)]);
      return overrides.createTask?.(input);
    },
    updateTask: async (id, input) => {
      calls.push(['updateTask', id, plain(input)]);
      return overrides.updateTask?.(id, input);
    },
    rescheduleTask: async (id, input) => {
      calls.push(['rescheduleTask', id, plain(input)]);
      if (overrides.rescheduleTask) return overrides.rescheduleTask(id, input);
      rows = rows.map((task) => (task.id === id ? { ...task, ...input } : task));
      return rows.find((task) => task.id === id);
    },
  };
  const { useCalendarTasks } = load('components/calendar/use-calendar-tasks.ts', {
    react,
    '../../lib/data-events': {
      onTaskDataChanged: subscribe('tasks'),
      onProjectDataChanged: subscribe('projects'),
    },
    '../../lib/projects': {
      listProjects: async () =>
        overrides.listProjects
          ? overrides.listProjects()
          : [{ id: 'folder-a', name: 'Coursework' }],
    },
    '../../lib/tasks': api,
    './calendar-model': model,
  });
  function render() {
    cursor = 0;
    const result = useCalendarTasks(options);
    pendingEffects.splice(0).forEach((effect) => effect());
    return result;
  }
  const settle = async () => {
    await setImmediate();
    return render();
  };
  return {
    render,
    settle,
    calls,
    signals,
    options,
    subscriptions,
    setRows: (value) => {
      rows = value;
    },
    getSelectedDate: () => selectedDate,
    unmount: () => slots.forEach((slot) => slot.cleanup?.()),
  };
}

test('loading fetches every page and filters on scheduled start rather than deadline', async () => {
  const h = harness({
    listTasks: async ({ page }) => ({
      total_pages: 2,
      items:
        page === 1
          ? [
              response({
                scheduled_start: iso(14),
                scheduled_end: iso(14, 10),
                due_date: iso(14 + 31),
              }),
              response({ id: 'undated', due_date: null }),
            ]
          : [
              response({ id: 'deadline-only' }),
              response({ id: 'outside', scheduled_start: iso(14 + 31) }),
            ],
    }),
  });
  h.render();
  const state = await h.settle();
  assert.deepEqual(
    h.calls.map((call) => call[1].page),
    [1, 2],
  );
  assert.deepEqual(plain(state.calendarTasks.map((task) => task.id)), ['task-a', 'deadline-only']);
  assert.equal(state.isLoading, false);
  assert.ok(h.signals.every((signal) => signal === h.signals[0]));
  h.unmount();
});

test('task and project events refresh once; range changes replace and clean up subscriptions', async () => {
  const h = harness();
  h.render();
  await h.settle();
  for (const kind of ['tasks', 'projects']) {
    [...h.subscriptions[kind]][0]();
    await h.settle();
  }
  assert.equal(h.calls.length, 3);
  const previousSignal = h.signals[0];
  h.options.visibleRange = { dueFrom: iso(14, 0, 0), dueTo: iso(14, 23, 59) };
  h.render();
  await h.settle();
  assert.equal(previousSignal.aborted, true);
  assert.equal(h.subscriptions.tasks.size, 1);
  assert.equal(h.subscriptions.projects.size, 1);
  h.unmount();
  assert.equal(h.subscriptions.tasks.size, 0);
  assert.equal(h.subscriptions.projects.size, 0);
  assert.equal(h.signals.at(-1).aborted, true);
});

test('load failure clears rows and exposes the request error', async () => {
  const h = harness({
    listTasks: async () => {
      throw new Error('Calendar unavailable');
    },
  });
  h.render();
  const state = await h.settle();
  assert.equal(state.loadError, 'Calendar unavailable');
  assert.equal(state.isLoading, false);
  assert.deepEqual(plain(state.calendarTasks), []);
  h.unmount();
});

test('cancelled loading does not report a request error', async () => {
  let rejectLoad;
  const h = harness({
    listTasks: () =>
      new Promise((_resolve, reject) => {
        rejectLoad = reject;
      }),
  });
  h.render();
  h.unmount();
  rejectLoad(new Error('Aborted'));
  const state = await h.settle();
  assert.equal(state.loadError, null);
});

test('folder loading failure keeps task creation open and reports the error', async () => {
  const h = harness({
    listProjects: async () => {
      throw new Error('Folders unavailable');
    },
  });
  h.render();
  await h.settle();
  await h.render().openCreateTaskModal();
  assert.equal(h.render().isCreateTaskOpen, true);
  assert.equal(h.render().actionError, 'Folders unavailable');
  h.unmount();
});

test('task creation loads folders, closes on success and refreshes calendar rows', async () => {
  const h = harness();
  h.render();
  await h.settle();
  await h.render().openCreateTaskModal();
  assert.equal(h.render().projects[0].id, 'folder-a');
  await h.render().createCalendarTask({ title: 'New event' });
  assert.equal(h.render().isCreateTaskOpen, false);
  assert.equal(h.render().isCreatingTask, false);
  assert.deepEqual(
    h.calls.map(([name]) => name),
    ['listTasks', 'createTask', 'listTasks'],
  );
  h.unmount();
});

test('task creation failure propagates to the form and releases its busy state', async () => {
  const failure = new Error('Creation failed');
  const h = harness({
    createTask: async () => {
      throw failure;
    },
  });
  h.render();
  await h.settle();
  await h.render().openCreateTaskModal();
  await assert.rejects(
    h.render().createCalendarTask({ title: 'New event' }),
    (error) => error === failure,
  );
  assert.equal(h.render().isCreateTaskOpen, true);
  assert.equal(h.render().isCreatingTask, false);
  assert.equal(h.render().actionError, 'Creation failed');
  h.unmount();
});

test('complete and reopen retain their status payloads; failed updates release the busy state', async () => {
  const h = harness({
    updateTask: async () => {
      throw new Error('Status failed');
    },
  });
  h.render();
  await h.settle();
  for (const status of ['pending', 'done'])
    await h.render().toggleTaskStatus({ id: 'task-a', status });
  assert.deepEqual(
    h.calls.filter(([name]) => name === 'updateTask'),
    [
      ['updateTask', 'task-a', { status: 'done' }],
      ['updateTask', 'task-a', { status: 'pending' }],
    ],
  );
  assert.equal(h.render().actionError, 'Status failed');
  assert.equal(h.render().mutatingTaskId, null);
  h.unmount();
});

test('locked tasks reject both drag rescheduling and the reschedule dialog', async () => {
  const h = harness();
  h.setRows([response({ schedule_locked: true })]);
  h.render();
  await h.settle();
  await h.render().moveTaskToDate('task-a', new Date(2026, 9, 15));
  h.render().openRescheduleDialog(h.render().calendarTasks[0]);
  assert.equal(h.render().actionError, 'Unlock this task before changing its schedule.');
  assert.equal(h.render().rescheduleTarget, null);
  assert.equal(
    h.calls.some(([name]) => name === 'rescheduleTask'),
    false,
  );
  h.unmount();
});

for (const scheduled of [false, true]) {
  test(`drag rescheduling preserves ${scheduled ? 'scheduled duration and deadline' : 'the due time'}`, async () => {
    const h = harness();
    h.setRows([
      response(scheduled ? { scheduled_start: iso(14), scheduled_end: iso(14, 10) } : {}),
    ]);
    h.render();
    await h.settle();
    await h.render().moveTaskToDate('task-a', new Date(2026, 9, 16));
    const payload = h.calls.find(([name]) => name === 'rescheduleTask')[2];
    assert.deepEqual(
      payload,
      scheduled ? { scheduled_start: iso(16), scheduled_end: iso(16, 10) } : { due_date: iso(16) },
    );
    if (scheduled) assert.equal(h.render().calendarTasks[0].dueDate, iso(14));
    assert.equal(model.dateKey(h.getSelectedDate()), '2026-10-16');
    assert.equal(h.render().mutatingTaskId, null);
    h.unmount();
  });
}

test('manual rescheduling defaults to local end of day when time is empty', async () => {
  const h = harness();
  h.render();
  await h.settle();
  h.render().openRescheduleDialog(h.render().calendarTasks[0]);
  assert.equal(h.render().rescheduleTime, '09:15');
  h.render().setRescheduleDate('2026-10-18');
  h.render().setRescheduleTime('');
  await h.render().submitReschedule();
  assert.deepEqual(h.calls.find(([name]) => name === 'rescheduleTask')[2], {
    due_date: new Date(2026, 9, 18, 23, 59).toISOString(),
  });
  assert.equal(h.render().rescheduleTarget, null);
  h.unmount();
});

test('invalid or failed rescheduling keeps the dialog open and reports the error', async () => {
  const h = harness({
    rescheduleTask: async () => {
      throw new Error('Reschedule failed');
    },
  });
  h.render();
  await h.settle();
  h.render().openRescheduleDialog(h.render().calendarTasks[0]);
  h.render().setRescheduleDate('invalid');
  await h.render().submitReschedule();
  assert.equal(h.render().actionError, 'Choose a valid date and time.');
  assert.equal(
    h.calls.some(([name]) => name === 'rescheduleTask'),
    false,
  );
  h.render().setRescheduleDate('2026-10-18');
  await h.render().submitReschedule();
  assert.equal(h.render().actionError, 'Reschedule failed');
  assert.equal(h.render().rescheduleTarget.id, 'task-a');
  assert.equal(h.render().mutatingTaskId, null);
  h.unmount();
});
