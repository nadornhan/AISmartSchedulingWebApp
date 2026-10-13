import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { setImmediate } from 'node:timers/promises';
import { URL } from 'node:url';
import ts from 'typescript';

const code = ts.transpileModule(
  fs.readFileSync(new URL('../../components/tasks/use-task-page-data.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
const plain = (value) => JSON.parse(JSON.stringify(value));
const sameDeps = (first, second) =>
  first?.length === second.length && second.every((value, index) => Object.is(value, first[index]));

// Small deterministic hook runner: exercises async orchestration and effect cleanup
// without a DOM or additional testing-library dependencies. Not an E2E renderer.
function harness(overrides = {}, initialOptions = {}) {
  const slots = [];
  const pendingEffects = [];
  let cursor = 0;
  const calls = [];
  let error = 'old error';
  let selected = ['selected-task'];
  let menu = 'open-task';
  let projectLoads = 0;
  const subscriptions = { tasks: new Set(), projects: new Set() };
  const options = {
    activeProjectId: '',
    searchQuery: '',
    targetTaskId: '',
    activeFilter: 'All',
    priorityFilter: 'All',
    sortBy: 'due_date',
    sortAscending: true,
    page: 1,
    pageSize: 8,
    setError: (value) => {
      error = value;
    },
    setSelected: (value) => {
      selected = value;
    },
    setMenuTaskId: (value) => {
      menu = value;
    },
    ...initialOptions,
  };
  const subscribe = (kind) => (listener) => {
    subscriptions[kind].add(listener);
    return () => subscriptions[kind].delete(listener);
  };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) {
        slots[index] = {
          value: initial,
          setter: (value) => {
            slots[index].value = typeof value === 'function' ? value(slots[index].value) : value;
          },
        };
      }
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
  const dependencies = {
    react,
    '../../lib/data-events': {
      onTaskDataChanged: subscribe('tasks'),
      onProjectDataChanged: subscribe('projects'),
    },
    '../../lib/projects': {
      listProjects: async () => {
        projectLoads++;
        return overrides.listProjects ? overrides.listProjects() : [{ id: 'project-a' }];
      },
    },
    '../../lib/tasks': {
      listTasks: async (params) => {
        calls.push(plain(params));
        return overrides.listTasks
          ? overrides.listTasks(params)
          : {
              items: [{ id: 'task-a' }],
              total_pages: 3,
              total: { pending: 2, in_progress: 3, done: 4, overdue: 5 }[params.status] ?? 14,
            };
      },
      getTask: async (id) => {
        calls.push({ getTask: id });
        return overrides.getTask ? overrides.getTask(id) : { id };
      },
    },
    './task-page-model': {
      filterToApi: {
        Pending: 'pending',
        'In Progress': 'in_progress',
        Done: 'done',
        Overdue: 'overdue',
      },
      priorityFilterToApi: {
        'No priority': 'no_priority',
        Low: 'low',
        Medium: 'medium',
        High: 'high',
      },
      toTask: (source) => ({ id: source.id, source }),
      getErrorMessage: (failure) => failure.message,
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  const render = (changes = {}) => {
    Object.assign(options, changes);
    cursor = 0;
    return module.exports.useTaskPageData(options);
  };
  return {
    render,
    calls,
    subscriptions,
    async settle() {
      pendingEffects.splice(0).forEach((effect) => effect());
      await setImmediate();
      return render();
    },
    dispose() {
      slots.forEach((slot) => slot.cleanup?.());
    },
    emit(kind) {
      subscriptions[kind].forEach((listener) => listener());
    },
    state: () => ({ error, selected: plain(selected), menu, projectLoads }),
  };
}

test('initial load retains query defaults, counts, projects and selection/menu reset', async () => {
  const h = harness();
  assert.equal(h.render().isLoading, true);
  const data = await h.settle();
  assert.deepEqual(h.calls[0], { sortBy: 'due_date', sortOrder: 'asc', page: 1, pageSize: 8 });
  assert.equal(h.calls.length, 6);
  assert.equal(data.tasks[0].id, 'task-a');
  assert.equal(data.totalPages, 3);
  assert.equal(data.totalTasks, 14);
  assert.equal(data.isLoading, false);
  assert.deepEqual(plain(data.counts), {
    All: 14,
    Pending: 2,
    'In Progress': 3,
    Done: 4,
    Overdue: 5,
  });
  assert.deepEqual(plain(data.projects), [{ id: 'project-a' }]);
  assert.deepEqual(h.state(), { error: null, selected: [], menu: null, projectLoads: 1 });
  h.dispose();
});

test('filtered loading retains exact pagination, sort and API filters; counts remain project/search scoped', async () => {
  const h = harness(
    {},
    {
      activeProjectId: 'project-a',
      searchQuery: 'exam',
      activeFilter: 'Overdue',
      priorityFilter: 'High',
      sortBy: 'priority',
      sortAscending: false,
      page: 2,
      pageSize: 16,
    },
  );
  h.render();
  await h.settle();
  assert.deepEqual(h.calls[0], {
    projectId: 'project-a',
    search: 'exam',
    status: 'overdue',
    priority: 'high',
    sortBy: 'priority',
    sortOrder: 'desc',
    page: 2,
    pageSize: 16,
  });
  assert.ok(
    h.calls
      .slice(1)
      .every(
        (params) =>
          params.projectId === 'project-a' &&
          params.search === 'exam' &&
          params.page === 1 &&
          params.pageSize === 1 &&
          !('priority' in params),
      ),
  );
});

test('targeted task loading bypasses list filters and retains one-page result', async () => {
  const h = harness({}, { targetTaskId: 'target-a', activeFilter: 'Done' });
  h.render();
  const data = await h.settle();
  assert.deepEqual(h.calls[0], { getTask: 'target-a' });
  assert.equal(data.tasks[0].id, 'target-a');
  assert.equal(data.totalPages, 1);
  assert.equal(data.totalTasks, 1);
  assert.equal(h.calls.length, 6);
});

test('main request failure clears tasks/pages and exposes error without clearing selection/menu', async () => {
  const h = harness({
    listTasks: async () => {
      throw new Error('Request failed');
    },
  });
  h.render();
  const data = await h.settle();
  assert.deepEqual(plain(data.tasks), []);
  assert.equal(data.totalPages, 0);
  assert.equal(data.totalTasks, 0);
  assert.equal(data.isLoading, false);
  assert.equal(h.state().error, 'Request failed');
  assert.deepEqual(h.state().selected, ['selected-task']);
  assert.equal(h.state().menu, 'open-task');
});

test('targeted task failures use the same error/loading path', async () => {
  const h = harness(
    {
      getTask: async () => {
        throw new Error('Not found');
      },
    },
    { targetTaskId: 'missing' },
  );
  h.render();
  const data = await h.settle();
  assert.equal(h.state().error, 'Not found');
  assert.equal(data.totalPages, 0);
  assert.equal(data.isLoading, false);
});

test('count and folder failures remain non-blocking when tasks load successfully', async () => {
  const h = harness({
    listTasks: async (params) => {
      if (params.pageSize === 1) throw new Error('Count unavailable');
      return { items: [{ id: 'task-a' }], total_pages: 1 };
    },
    listProjects: async () => {
      throw new Error('Folder unavailable');
    },
  });
  h.render();
  const data = await h.settle();
  assert.equal(data.tasks.length, 1);
  assert.equal(data.counts.All, 0);
  assert.deepEqual(plain(data.projects), []);
  assert.equal(h.state().error, null);
});

test('task changes refresh tasks/counts; project changes refresh projects/counts; unmount cleans up', async () => {
  const h = harness();
  h.render();
  await h.settle();
  h.calls.length = 0;
  h.emit('tasks');
  await h.settle();
  assert.equal(h.calls.length, 6);
  assert.equal(h.state().projectLoads, 1);
  h.calls.length = 0;
  h.emit('projects');
  await h.settle();
  assert.equal(h.calls.length, 5);
  assert.equal(h.state().projectLoads, 2);
  h.dispose();
  assert.equal(h.subscriptions.tasks.size, 0);
  assert.equal(h.subscriptions.projects.size, 0);
});

test('query changes replace refresh subscriptions; stable query rerenders do not refetch', async () => {
  const h = harness();
  const first = h.render();
  const data = await h.settle();
  assert.equal(data.refreshTasks, first.refreshTasks);
  assert.equal(h.calls.length, 6);
  h.render({ searchQuery: 'new query' });
  await h.settle();
  assert.equal(h.calls.length, 12);
  assert.equal(h.subscriptions.tasks.size, 1);
  assert.equal(h.subscriptions.projects.size, 1);
  h.calls.length = 0;
  h.emit('tasks');
  await h.settle();
  assert.ok(h.calls.every((params) => params.search === 'new query'));
  h.dispose();
});

test('mutation handlers can update task state and explicitly refresh without remounting', async () => {
  const h = harness();
  h.render();
  const data = await h.settle();
  data.setTasks((tasks) => tasks.map((task) => ({ ...task, id: 'updated-a' })));
  assert.equal(h.render().tasks[0].id, 'updated-a');
  h.calls.length = 0;
  await Promise.all([data.refreshTasks(), data.refreshCounts()]);
  assert.equal(h.render().tasks[0].id, 'task-a');
  assert.equal(h.calls.length, 6);
});

test('loading stays active until the main task request resolves', async () => {
  let resolveTasks;
  const pending = new Promise((resolve) => {
    resolveTasks = resolve;
  });
  const h = harness({
    listTasks: async (params) =>
      params.pageSize === 1 ? { total: 0, items: [], total_pages: 0 } : pending,
  });
  h.render();
  assert.equal((await h.settle()).isLoading, true);
  resolveTasks({ items: [{ id: 'loaded-a' }], total_pages: 1 });
  const data = await h.settle();
  assert.equal(data.isLoading, false);
  assert.equal(data.tasks[0].id, 'loaded-a');
});

test('explicit retry clears the prior request error and restores tasks', async () => {
  let failing = true;
  const h = harness({
    listTasks: async () => {
      if (failing) throw new Error('Temporary failure');
      return { items: [{ id: 'recovered-a' }], total_pages: 1, total: 1 };
    },
  });
  h.render();
  const data = await h.settle();
  assert.equal(h.state().error, 'Temporary failure');
  failing = false;
  await data.refreshTasks();
  assert.equal(h.state().error, null);
  assert.equal(h.render().tasks[0].id, 'recovered-a');
  assert.equal(h.render().isLoading, false);
});

test('priority-filtered totals follow the paginated response rather than status badge counts', async () => {
  const h = harness({
    listTasks: async (params) => {
      if (params.pageSize === 1) return { total: 14, items: [], total_pages: 14 };
      const total = params.priority === 'high' ? 5 : 14;
      return { total, items: [{ id: 'task-a' }], total_pages: Math.ceil(total / params.pageSize) };
    },
  });
  h.render();
  const initial = await h.settle();
  assert.equal(initial.totalTasks, 14);
  h.render({ priorityFilter: 'High' });
  const filtered = await h.settle();
  assert.equal(filtered.totalTasks, 5);
  assert.equal(filtered.totalPages, 1);
  assert.equal(filtered.counts.All, 14);
  h.render({ priorityFilter: 'All' });
  assert.equal((await h.settle()).totalTasks, 14);
});

test('zero matches and failed refreshes clear the previously displayed filtered total', async () => {
  let mode = 'matches';
  const h = harness(
    {
      listTasks: async () => {
        if (mode === 'failure') throw new Error('Request failed');
        const total = mode === 'matches' ? 5 : 0;
        return { total, items: total ? [{ id: 'task-a' }] : [], total_pages: total ? 1 : 0 };
      },
    },
    { priorityFilter: 'High' },
  );
  h.render();
  const data = await h.settle();
  assert.equal(data.totalTasks, 5);
  mode = 'empty';
  await data.refreshTasks();
  assert.equal(h.render().totalTasks, 0);
  mode = 'matches';
  await data.refreshTasks();
  assert.equal(h.render().totalTasks, 5);
  mode = 'failure';
  await data.refreshTasks();
  assert.equal(h.render().totalTasks, 0);
});
