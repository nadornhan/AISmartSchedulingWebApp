import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { URL, URLSearchParams } from 'node:url';
import ts from 'typescript';

function load(file, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(new URL(`../../lib/${file}.ts`, import.meta.url), 'utf8');
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, URLSearchParams, ...globals, require(name) {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`);
    return dependencies[name];
  } });
  return module.exports;
}

function harness(taskResponse) {
  let now = 1_000_000;
  let token = 'user-a';
  let sequence = 0;
  const calls = [];
  const cache = load('read-cache', {}, { Date: { now: () => now } });
  const events = load('data-events', { './read-cache': cache });
  const api = {
    getSessionKey: () => token,
    apiRequest: async (url) => {
      calls.push(url);
      if (url.startsWith('/projects')) return [{ id: 'folder', task_count: ++sequence }];
      if (url.startsWith('/tasks/counts')) return { total: ++sequence, pending: 1, in_progress: 0, done: 0, overdue: 0 };
      if (taskResponse) return taskResponse(url);
      return { items: [{ id: `${token}-${++sequence}` }], total: 1, total_pages: 1 };
    },
  };
  const tasks = load('tasks', {
    './api': api, './read-cache': cache, './data-events': events,
    './gamification': { emitGrowthReward() {} },
  });
  const projects = load('projects', { './api': api, './read-cache': cache, './data-events': events });
  return { cache, tasks, projects, events, calls, advance: (ms) => { now += ms; }, login: (value) => { token = value; } };
}

test('concurrent and repeated task/count/project reads share requests', async () => {
  const h = harness();
  const [first, second] = await Promise.all([h.tasks.listTasks(), h.tasks.listTasks()]);
  assert.equal(first, second);
  await Promise.all([h.tasks.getTaskCounts(), h.tasks.getTaskCounts()]);
  await Promise.all([h.projects.listProjects(), h.projects.listProjects()]);
  await h.tasks.listTasks();
  await h.projects.listProjects();
  assert.deepEqual(h.calls, ['/tasks', '/tasks/counts', '/projects']);
  assert.equal(h.tasks.getCachedTaskList({}), first);
});

test('mobile all-tasks loading combines every API page and keeps filters and sorting', async () => {
  const h = harness((url) => {
    const query = new URL(url, 'https://chrono.example').searchParams;
    assert.equal(query.get('page_size'), '100');
    assert.equal(query.get('status'), 'pending');
    assert.equal(query.get('priority'), 'high');
    assert.equal(query.get('project_id'), 'folder');
    assert.equal(query.get('search'), 'exam');
    assert.equal(query.get('sort_by'), 'title');
    assert.equal(query.get('sort_order'), 'desc');
    const page = Number(query.get('page'));
    return {
      items: Array.from({ length: page === 3 ? 35 : 100 }, (_, index) => ({ id: `${page}-${index}` })),
      page, page_size: 100, total: 235, total_pages: 3,
    };
  });
  const params = {
    all: true, page: 4, pageSize: 8, status: 'pending', priority: 'high',
    projectId: 'folder', search: 'exam', sortBy: 'title', sortOrder: 'desc',
  };
  const [first, second] = await Promise.all([h.tasks.listTasks(params), h.tasks.listTasks(params)]);
  assert.equal(first, second);
  assert.equal(first.items.length, 235);
  assert.equal(first.items.at(-1).id, '3-34');
  assert.equal(first.total_pages, 1);
  assert.equal(h.calls.length, 3);
  assert.equal(h.tasks.getCachedTaskList({ ...params, page: 1 }), first);
  assert.equal(h.tasks.getCachedTaskList({ ...params, all: false }), undefined);
  h.events.emitTaskDataChanged();
  assert.equal(h.tasks.getCachedTaskList(params), undefined);
});

test('a failed later mobile batch never caches a truncated list', async () => {
  let fail = true;
  const h = harness((url) => {
    const page = Number(new URL(url, 'https://chrono.example').searchParams.get('page'));
    if (page === 2 && fail) throw new Error('Offline');
    return { items: [{ id: `page-${page}` }], page, page_size: 100, total: 2, total_pages: 2 };
  });
  await assert.rejects(h.tasks.listTasks({ all: true }), /Offline/);
  assert.equal(h.tasks.getCachedTaskList({ all: true }), undefined);
  fail = false;
  const result = await h.tasks.listTasks({ all: true });
  assert.deepEqual(Array.from(result.items, (task) => task.id), ['page-1', 'page-2']);
});

test('task and folder changes invalidate caches even while their pages are unmounted', async () => {
  const h = harness();
  await h.tasks.listTasks();
  await h.tasks.getTaskCounts();
  await h.projects.listProjects();
  h.events.emitTaskDataChanged();
  assert.equal(h.tasks.getCachedTaskList({}), undefined);
  assert.equal(h.projects.getCachedProjects(), undefined);
  await h.tasks.listTasks();
  await h.projects.listProjects();
  h.events.emitProjectDataChanged();
  await h.tasks.listTasks();
  await h.projects.listProjects();
  assert.equal(h.calls.length, 7);
});

test('short-lived reads revalidate without losing their immediate cached snapshot', async () => {
  const h = harness();
  const before = await h.tasks.listTasks();
  h.advance(16_000);
  assert.equal(h.tasks.getCachedTaskList({}), before);
  const after = await h.tasks.listTasks();
  assert.notEqual(after, before);
  h.advance(5 * 60_000);
  assert.equal(h.tasks.getCachedTaskList({}), undefined);
});

test('different filters and authenticated users never reuse each other\'s results', async () => {
  const h = harness();
  const a = await h.tasks.listTasks({ search: 'exam', priority: 'high' });
  await h.tasks.listTasks({ search: 'exam', priority: 'low' });
  await h.tasks.getTaskCounts({ projectId: 'folder', search: 'exam' });
  assert.ok(h.calls.includes('/tasks/counts?project_id=folder&search=exam'));
  h.login('user-b');
  assert.equal(h.tasks.getCachedTaskList({ search: 'exam', priority: 'high' }), undefined);
  const b = await h.tasks.listTasks({ search: 'exam', priority: 'high' });
  assert.notEqual(a, b);
  h.login(null);
  assert.equal(h.projects.getCachedProjects(), undefined);
});

test('invalidated in-flight requests cannot refill caches or overwrite newer results', async () => {
  const h = harness();
  let finish;
  const before = h.cache.cachedRead('user-a', 'tasks', 'list', () => new Promise((resolve) => { finish = resolve; }));
  await Promise.resolve();
  h.events.emitTaskDataChanged();
  await h.cache.cachedRead('user-a', 'tasks', 'list', async () => 'new');
  finish('old');
  await before;
  assert.equal(h.cache.peekReadCache('user-a', 'tasks', 'list'), 'new');
  const late = h.cache.cachedRead('user-a', 'tasks', 'other', async () => 'private');
  h.cache.clearReadCache();
  await late;
  assert.equal(h.cache.peekReadCache('user-a', 'tasks', 'other'), undefined);
});

test('failed reads can be retried; abortable reads do not cancel shared requests', async () => {
  const h = harness();
  await assert.rejects(h.cache.cachedRead('user-a', 'tasks', 'failure', async () => { throw new Error('offline'); }));
  assert.equal(await h.cache.cachedRead('user-a', 'tasks', 'failure', async () => 'recovered'), 'recovered');
  await h.tasks.listTasks({}, { signal: new globalThis.AbortController().signal });
  await h.tasks.listTasks();
  assert.equal(h.calls.length, 2);
});
