import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { URL } from 'node:url';
import ts from 'typescript';

const root = new URL('../../', import.meta.url);
const plain = (value) => JSON.parse(JSON.stringify(value));
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8');

function load(file, dependencies = {}) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(read(file), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      Error,
      require(name) {
        assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
        return dependencies[name];
      },
    },
  );
  return module.exports;
}

function hookRunner(file, exportName, dependencies, options) {
  const slots = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) {
        slots[index] = {
          value: initial,
          set(value) {
            slots[index].value = typeof value === 'function' ? value(slots[index].value) : value;
          },
        };
      }
      return [slots[index].value, slots[index].set];
    },
  };
  const hook = load(file, { react, ...dependencies })[exportName];
  return () => {
    cursor = 0;
    return hook(options);
  };
}

class ApiError extends Error {}
const duration = load('lib/duration.ts');
const model = load('components/tasks/task-page-model.ts', {
  '../../lib/api': { ApiError },
  '../../lib/duration': duration,
  './create-task-modal': {
    priorityLabelFromApi: (value) =>
      ({ no_priority: 'No priority', low: 'Low', medium: 'Medium', high: 'High' })[value],
  },
});

function pageHarness(overrides = {}, initial = {}) {
  const task = {
    id: 'task-a',
    status: 'Pending',
    workflowStatus: 'Pending',
    overdue: false,
    source: { status: 'pending', workflow_status: 'pending', schedule_locked: false },
  };
  const state = {
    tasks: [task],
    selected: ['task-a'],
    page: 1,
    editingTask: { id: 'task-a' },
    error: null,
    menuTaskId: 'task-a',
    isModalOpen: true,
    ...initial,
  };
  const calls = [];
  const api = Object.fromEntries(
    [
      'bulkDeleteTasks',
      'bulkUpdateTasks',
      'createTask',
      'deleteTask',
      'duplicateTask',
      'rescheduleTask',
      'updateSubtaskCompletion',
      'updateTask',
    ].map((name) => [
      name,
      async (...args) => {
        calls.push([name, ...plain(args)]);
        return overrides[name]?.(...args);
      },
    ]),
  );
  const options = {
    ...state,
    refreshTasks: async () => {
      calls.push(['refreshTasks']);
    },
    refreshCounts: async () => {
      calls.push(['refreshCounts']);
    },
  };
  for (const key of ['tasks', 'page', 'editingTask', 'error', 'menuTaskId', 'isModalOpen']) {
    options[`set${key[0].toUpperCase()}${key.slice(1)}`] = (value) => {
      state[key] = typeof value === 'function' ? value(state[key]) : value;
    };
  }
  const render = hookRunner(
    'components/tasks/use-task-page-actions.ts',
    'useTaskPageActions',
    {
      '../../lib/tasks': api,
      './task-page-model': model,
    },
    options,
  );
  return { state, calls, render };
}

test('failed status update restores the original task and releases the busy state', async () => {
  let rejectUpdate;
  const h = pageHarness({
    updateTask: () =>
      new Promise((_resolve, reject) => {
        rejectUpdate = reject;
      }),
  });
  const previous = h.state.tasks[0];
  const pending = h.render().changeStatus('task-a', 'Done');
  assert.equal(h.state.tasks[0].source.workflow_status, 'done');
  assert.equal(h.render().isMutating, true);
  rejectUpdate(new Error('Update failed'));
  await pending;
  assert.equal(h.state.tasks[0], previous);
  assert.equal(h.state.error, 'Update failed');
  assert.equal(h.render().isMutating, false);
  assert.deepEqual(
    h.calls.map(([name]) => name),
    ['updateTask'],
  );
});

test('successful status changes refresh rows and status counts', async () => {
  const h = pageHarness();
  await h.render().changeStatus('task-a', 'Done');
  assert.deepEqual(h.calls, [
    ['updateTask', 'task-a', { status: 'done' }],
    ['refreshTasks'],
    ['refreshCounts'],
  ]);
});

for (const priority of ['no_priority', 'low', 'medium', 'high']) {
  test(`selected tasks can be assigned ${priority} priority without changing status`, async () => {
    const h = pageHarness({}, { selected: ['task-a', 'task-b'] });
    await h.render().changeSelectedPriority(priority);
    assert.deepEqual(h.calls, [
      ['bulkUpdateTasks', { task_ids: ['task-a', 'task-b'], priority }],
      ['refreshTasks'],
      ['refreshCounts'],
    ]);
    assert.equal(h.render().isMutating, false);
  });
}

test('failed priority updates keep the selection and allow retry', async () => {
  let rejectUpdate;
  const h = pageHarness({
    bulkUpdateTasks: () => new Promise((_resolve, reject) => { rejectUpdate = reject; }),
  });
  const pending = h.render().changeSelectedPriority('high');
  assert.equal(h.render().isMutating, true);
  rejectUpdate(new Error('Priority update failed'));
  await pending;
  assert.equal(h.state.error, 'Priority update failed');
  assert.deepEqual(h.state.selected, ['task-a']);
  assert.equal(h.render().isMutating, false);
  assert.equal(h.calls.length, 1);
});

for (const page of [1, 2]) {
  test(`deleting the last visible row on page ${page} keeps pagination usable`, async () => {
    const h = pageHarness({}, { page });
    await h.render().deleteSelected();
    assert.equal(h.state.page, 1);
    assert.deepEqual(
      h.calls.map(([name]) => name),
      page === 1
        ? ['bulkDeleteTasks', 'refreshTasks', 'refreshCounts']
        : ['bulkDeleteTasks', 'refreshCounts'],
    );
  });
}

test('create and edit failures reach the form while keeping it open', async () => {
  const failure = new Error('Save failed');
  const h = pageHarness({
    createTask: async () => {
      throw failure;
    },
    updateTask: async () => {
      throw failure;
    },
  });
  await assert.rejects(h.render().addTask({ title: 'New task' }), (error) => error === failure);
  await assert.rejects(h.render().editTask({ title: 'Edited task' }), (error) => error === failure);
  assert.equal(h.state.isModalOpen, true);
  assert.deepEqual(h.state.editingTask, { id: 'task-a' });
  assert.equal(h.state.error, 'Save failed');
  assert.equal(h.render().isMutating, false);
});

test('successful creation closes its form, returns to page one and refreshes counts', async () => {
  const h = pageHarness({}, { page: 3 });
  await h.render().addTask({ title: 'New task' });
  assert.equal(h.state.isModalOpen, false);
  assert.equal(h.state.page, 1);
  assert.deepEqual(h.calls, [
    ['createTask', { title: 'New task' }],
    ['refreshTasks'],
    ['refreshCounts'],
  ]);
});

test('schedule locking requires an existing scheduled interval', async () => {
  const h = pageHarness();
  await h.render().toggleScheduleLock(h.state.tasks[0]);
  assert.equal(h.state.error, 'Schedule this task before locking its time.');
  assert.equal(h.state.menuTaskId, null);
  assert.deepEqual(h.calls, []);
});

test('rescheduling preserves local end-of-day conversion and clears its dialog', async () => {
  const h = pageHarness();
  h.render().openReschedule({ id: 'task-a', dueDateIso: '2026-10-20T09:00:00Z' });
  await h.render().handleReschedule();
  assert.deepEqual(h.calls[0], [
    'rescheduleTask',
    'task-a',
    { due_date: new Date('2026-10-20T23:59:00').toISOString() },
  ]);
  assert.equal(h.render().rescheduleTaskId, null);
  assert.equal(h.render().rescheduleDueDate, '');
  assert.deepEqual(h.calls.slice(1), [['refreshTasks'], ['refreshCounts']]);
});

test('edit-dialog deletion propagates failure and releases its busy state', async () => {
  const failure = new Error('Delete failed');
  const h = pageHarness({
    deleteTask: async () => {
      throw failure;
    },
  });
  await assert.rejects(h.render().deleteEditingTask(), (error) => error === failure);
  assert.deepEqual(h.state.editingTask, { id: 'task-a' });
  assert.equal(h.render().isMutating, false);
});

function aiHarness(overrides = {}) {
  const calls = [];
  const state = { closed: false, submitError: 'Previous form error' };
  const generated = {
    proposal: {
      tasks: [{ client_id: 'generated-a', title: 'Generated', priority: 'low', due_date: null }],
    },
  };
  const decomposed = {
    proposal: {
      title: 'Main task',
      priority: 'high',
      due_date: null,
      subtasks: [
        { client_id: 'first', title: 'First step' },
        { client_id: 'second', title: 'Second step' },
      ],
    },
  };
  const api = Object.fromEntries(
    [
      'previewGeneratedTasks',
      'previewTaskDecomposition',
      'confirmGeneratedTasks',
      'confirmTaskDecomposition',
    ].map((name) => [
      name,
      async (...args) => {
        calls.push([name, ...plain(args)]);
        if (overrides[name]) return overrides[name](...args);
        return name === 'previewGeneratedTasks' ? generated : decomposed;
      },
    ]),
  );
  const render = hookRunner(
    'components/tasks/use-task-ai-entry.ts',
    'useTaskAiEntry',
    {
      '../../lib/api': { ApiError },
      '../../lib/tasks': api,
    },
    {
      onClose: () => {
        state.closed = true;
      },
      onGenerated: (preview) => {
        state.generated = preview;
      },
      setSubmitError: (value) => {
        state.submitError = value;
      },
    },
  );
  return { calls, state, render };
}

test('AI entry rejects empty input before making a request', async () => {
  const h = aiHarness();
  h.render().setNaturalLanguageInput('   ');
  await h.render().createFromNaturalLanguage();
  assert.deepEqual(h.calls, []);
  assert.equal(h.render().parseFeedback, 'Add a task description before generating details.');
});

test('generated previews populate the form through the callback without saving', async () => {
  const h = aiHarness();
  h.render().setNaturalLanguageInput('  Prepare slides  ');
  await h.render().createFromNaturalLanguage();
  assert.deepEqual(h.calls[0], ['previewGeneratedTasks', 'Prepare slides']);
  assert.equal(h.state.submitError, null);
  assert.equal(h.state.generated.proposal.tasks[0].title, 'Generated');
  assert.equal(h.calls.length, 1);
  assert.equal(h.state.closed, false);
  assert.equal(h.render().generationBusy, false);
});

test('decomposition confirms only selected nonempty subtasks with trimmed titles', async () => {
  const h = aiHarness();
  h.render().selectAiEntryMode('decompose');
  h.render().setNaturalLanguageInput('Finish report');
  await h.render().createFromNaturalLanguage();
  h.render().setDecomposedTask((task) => ({ ...task, title: '  Edited report  ' }));
  h.render().setDecomposedSubtasks((steps) =>
    steps.map((step, index) => ({ ...step, selected: index === 0, title: '  Keep step  ' })),
  );
  await h.render().createDecomposedTask();
  assert.equal(h.calls[1][2].title, 'Edited report');
  assert.deepEqual(h.calls[1][2].subtasks, [{ client_id: 'first', title: 'Keep step' }]);
  assert.equal(h.state.closed, true);
});

test('changing AI mode clears the previous preview and confirmation drafts', async () => {
  const h = aiHarness();
  h.render().setNaturalLanguageInput('Prepare slides');
  await h.render().createFromNaturalLanguage();
  h.render().selectAiEntryMode('decompose');
  assert.equal(h.render().generationPreview, null);
  assert.equal(h.render().parseFeedback, null);
  assert.equal(h.calls.length, 1);
});

test('failed task generation keeps the AI entry open for retry', async () => {
  const h = aiHarness({
    previewGeneratedTasks: async () => {
      throw new ApiError('AI generation failed');
    },
  });
  h.render().setNaturalLanguageInput('Prepare slides');
  await h.render().createFromNaturalLanguage();
  assert.equal(h.state.closed, false);
  assert.equal(h.render().parseFeedback, 'AI generation failed');
  assert.equal(h.render().generationBusy, false);
  assert.equal(h.render().generationPreview, null);
});
