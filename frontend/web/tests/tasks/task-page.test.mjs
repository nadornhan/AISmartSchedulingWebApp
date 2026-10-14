import assert from 'node:assert/strict';
import fs from 'node:fs';
import process from 'node:process';
import test from 'node:test';
import { URL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';

const root = new URL('../../', import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8');
const now = new Date(2026, 9, 12, 12);
class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [now.getTime()]));
  }
  static now() {
    return now.getTime();
  }
}

function load(code, dependencies = {}) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      module,
      exports: module.exports,
      process,
      Error,
      Date: FixedDate,
      Intl,
      require: (name) => {
        assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
        return dependencies[name];
      },
    },
  );
  return module.exports;
}

// Use the existing modal's real priority mapping without loading its form/AI dependencies.
const modal = ts.createSourceFile(
  'modal.tsx',
  read('components/tasks/create-task-modal.tsx'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const priorityDeclarations = modal.statements.filter(
  (statement) =>
    (ts.isFunctionDeclaration(statement) && statement.name?.text === 'priorityLabelFromApi') ||
    (ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) => declaration.name.getText(modal) === 'priorityFromApi',
      )),
);
assert.equal(priorityDeclarations.length, 2);
const priority = load(priorityDeclarations.map((statement) => statement.getText(modal)).join('\n'));
const { ApiError } = load(read('lib/api.ts'));
const duration = load(read('lib/duration.ts'));
const model = load(read('components/tasks/task-page-model.ts'), {
  '../../lib/api': { ApiError },
  '../../lib/duration': duration,
  './create-task-modal': priority,
});
const icons = load(read('components/layout/icons.tsx'), { 'react/jsx-runtime': jsxRuntime });
const controls = load(read('components/tasks/task-page-controls.tsx'), {
  react: React,
  'react/jsx-runtime': jsxRuntime,
  '../layout/icons': icons,
  './task-page-model': model,
});
const { TaskDesktopTable, TaskMobileList } = load(read('components/tasks/task-list-views.tsx'), {
  'react/jsx-runtime': jsxRuntime,
  '../layout/icons': icons,
  './task-page-controls': controls,
  './task-page-model': model,
});

function response(overrides = {}) {
  return {
    id: 'task-a',
    title: 'Demo task',
    description: null,
    project_id: null,
    project: null,
    status: 'pending',
    priority: 'no_priority',
    due_date: null,
    estimated_duration_minutes: null,
    subtasks: [],
    subtask_progress: { completed: 0, total: 0, percent: null },
    ...overrides,
  };
}
const due = (day, hour = 9) => new Date(2026, 9, day, hour).toISOString();

test('task mapping retains defaults and the original API object', () => {
  const source = response();
  const task = model.toTask(source);
  assert.equal(task.source, source);
  assert.equal(task.description, 'No description added.');
  assert.equal(task.project, 'Unassigned');
  assert.equal(task.projectColor, 'neutral');
  assert.equal(task.dueDate, 'No due date');
  assert.equal(task.durationLabel, null);
  assert.equal(task.subtaskProgressLabel, null);
  assert.equal(task.status, 'Pending');
  assert.equal(task.overdue, false);
});

for (const [status, label] of [
  ['pending', 'Pending'],
  ['in_progress', 'In Progress'],
  ['done', 'Done'],
]) {
  test(`workflow status ${status} round-trips to the API`, () => {
    const task = model.toTask(response({ status }));
    assert.equal(task.status, label);
    assert.equal(task.workflowStatus, label);
    assert.equal(model.statusToApi[label], status);
    assert.equal(model.filterToApi[label], status);
  });
  test(`overdue display preserves underlying ${status} workflow`, () => {
    const task = model.toTask(response({ status: 'overdue', workflow_status: status }));
    assert.equal(task.status, 'Overdue');
    assert.equal(task.workflowStatus, label);
    assert.equal(task.overdue, true);
  });
}

test('legacy overdue responses without workflow status retain pending fallback', () => {
  assert.equal(model.toTask(response({ status: 'overdue' })).workflowStatus, 'Pending');
});

for (const [value, label] of [
  ['no_priority', 'No priority'],
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['high', 'High'],
]) {
  test(`priority ${value} retains label, filter value and styling`, () => {
    assert.equal(model.toTask(response({ priority: value })).priority, label);
    assert.equal(model.priorityFilterToApi[label], value);
    assert.ok(model.priorityClass(label));
  });
}

test('project, duration and subtask progress labels retain API values', () => {
  const task = model.toTask(
    response({
      description: 'Keep me',
      project_id: 'project-a',
      project: { name: 'Course', color: 'blue' },
      estimated_duration_minutes: 90,
      subtask_progress: { completed: 1, total: 2, percent: 50 },
    }),
  );
  assert.equal(task.description, 'Keep me');
  assert.equal(task.projectId, 'project-a');
  assert.equal(task.project, 'Course');
  assert.equal(task.projectColor, 'blue');
  assert.equal(task.durationLabel, '1 hr 30 min');
  assert.equal(task.subtaskProgressLabel, '1/2 subtasks (50%)');
  assert.equal(
    model.toTask(response({ subtask_progress: { completed: 0, total: 1, percent: null } }))
      .subtaskProgressLabel,
    '0/1 subtasks',
  );
});

for (const [date, prefix] of [
  [null, 'No due date'],
  [due(12), 'Today,'],
  [due(13), 'Tomorrow,'],
  [due(14), '14 Oct,'],
]) {
  test(`due date label: ${prefix}`, () => {
    assert.ok(model.formatTaskDueDate(date).startsWith(prefix));
  });
}

for (const [overrides, group] of [
  [{ status: 'overdue', due_date: due(11) }, 'Overdue'],
  [{ status: 'overdue', due_date: null }, 'Overdue'],
  [{ due_date: due(12) }, 'Today'],
  [{ due_date: due(13) }, 'Upcoming'],
  [{ status: 'done', due_date: due(11) }, 'Other'],
  [{ due_date: null }, 'Other'],
]) {
  test(`mobile grouping retains ${JSON.stringify(overrides)} -> ${group}`, () => {
    assert.equal(model.mobileGroupForTask(model.toTask(response(overrides))), group);
  });
}

test('filter order, pagination options and unfiltered API parameters are unchanged', () => {
  assert.equal(
    JSON.stringify(model.filterOrder),
    JSON.stringify(['All', 'Pending', 'In Progress', 'Done', 'Overdue']),
  );
  assert.equal(
    JSON.stringify(model.mobileFilterOrder),
    JSON.stringify(['All', 'Done', 'In Progress', 'Pending', 'Overdue']),
  );
  assert.equal(JSON.stringify(model.pageSizeOptions), '[8,16,24]');
  assert.equal(model.filterToApi.All, undefined);
  assert.equal(model.priorityFilterToApi.All, undefined);
  assert.equal(model.filterToApi.Overdue, 'overdue');
  assert.equal(
    model.sortOptions.map((option) => option.value).join(','),
    'due_date,priority,title,created_at,updated_at',
  );
});

test('existing task error messages are preserved, including 401/403 handling', () => {
  for (const status of [401, 403]) {
    assert.equal(
      model.getErrorMessage(new ApiError('Denied', status)),
      'Your session is missing or has expired. Please sign in again.',
    );
  }
  assert.equal(model.getErrorMessage(new ApiError('Retry later', 503)), 'Retry later');
  assert.equal(model.getErrorMessage(new Error('Failed')), 'Failed');
  assert.equal(model.getErrorMessage(null), 'Something went wrong. Please try again.');
});

test('checkbox keeps its accessibility state and callback', () => {
  let calls = 0;
  const element = controls.CheckBox({
    checked: true,
    label: 'Select Demo task',
    onChange: () => calls++,
  });
  assert.equal(element.props['aria-pressed'], true);
  assert.equal(element.props['aria-label'], 'Select Demo task');
  element.props.onClick();
  assert.equal(calls, 1);
  assert.match(renderToStaticMarkup(element), /border-dashboard-accent/);
});

for (const compact of [false, true]) {
  test(`status dropdown retains initial status, accessibility and disabled state (compact=${compact})`, () => {
    const html = renderToStaticMarkup(
      React.createElement(controls.StatusDropdown, {
        compact,
        disabled: true,
        taskTitle: 'Demo task',
        value: 'In Progress',
        onChange: () => {},
      }),
    );
    assert.match(html, /aria-label="Status for Demo task: In Progress"/);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, /disabled=""/);
    assert.match(html, compact ? /min-w-\[104px\]/ : /min-w-\[128px\]/);
  });
}

function buttons(element) {
  if (!element || typeof element !== 'object') return [];
  if (Array.isArray(element)) return element.flatMap(buttons);
  return [...(element.type === 'button' ? [element] : []), ...buttons(element.props?.children)];
}

test('subtask controls preserve completion toggles, disabled state and progress display', () => {
  const toggles = [];
  const task = model.toTask(
    response({
      subtasks: [
        { id: 'sub-a', title: 'First', is_completed: false },
        { id: 'sub-b', title: 'Second', is_completed: true },
      ],
      subtask_progress: { completed: 1, total: 2, percent: 50 },
    }),
  );
  const element = controls.SubtaskAccordion({
    task,
    disabled: true,
    onToggle: (...args) => toggles.push(args),
  });
  const items = buttons(element);
  assert.equal(items.length, 2);
  assert.ok(items.every((item) => item.props.disabled));
  items.forEach((item) => item.props.onClick());
  assert.deepEqual(toggles, [
    ['sub-a', true],
    ['sub-b', false],
  ]);
  const html = renderToStaticMarkup(element);
  assert.match(html, /1\/2 completed/);
  assert.match(html, /width:50%/);
  assert.equal((html.match(/\+2 GP/g) ?? []).length, 1);
  assert.match(html, /line-through/);
});

test('null subtask percentage still renders zero-width progress', () => {
  const html = renderToStaticMarkup(
    React.createElement(controls.SubtaskAccordion, {
      task: model.toTask(response()),
      disabled: false,
      onToggle: () => {},
    }),
  );
  assert.match(html, /width:0%/);
});

function desktopProps(overrides = {}) {
  return {
    visibleTasks: [],
    selected: [],
    expandedTaskIds: [],
    targetTaskId: '',
    menuTaskId: null,
    allVisibleSelected: false,
    isLoading: false,
    isMutating: false,
    toggleAllVisible: () => {},
    toggleSelected: () => {},
    toggleTaskExpanded: () => {},
    setEditingTask: () => {},
    setMenuTaskId: () => {},
    changeStatus: async () => {},
    handleDuplicate: async () => {},
    openReschedule: () => {},
    toggleScheduleLock: async () => {},
    handleDeleteOne: async () => {},
    toggleSubtask: async () => {},
    ...overrides,
  };
}

function elements(element) {
  if (!element || typeof element !== 'object') return [];
  if (Array.isArray(element)) return element.flatMap(elements);
  return [element, ...elements(element.props?.children)];
}

test('desktop table retains its responsive wrapper, column headers and loading/empty states', () => {
  const empty = renderToStaticMarkup(React.createElement(TaskDesktopTable, desktopProps()));
  assert.match(empty, /shadow-panel lg:block/);
  for (const heading of ['Task', 'Project', 'Due date', 'Priority', 'Status', 'Actions']) {
    assert.ok(empty.includes(`>${heading}</span>`));
  }
  assert.match(empty, /No tasks found/);
  const loading = renderToStaticMarkup(
    React.createElement(TaskDesktopTable, desktopProps({ isLoading: true })),
  );
  assert.match(loading, /Loading tasks\.\.\./);
  assert.ok(!loading.includes('No tasks found'));
});

test('desktop selection, target highlighting, edit and status callbacks retain the correct task', () => {
  const task = model.toTask(response());
  const calls = [];
  const tree = TaskDesktopTable(
    desktopProps({
      visibleTasks: [task],
      selected: [task.id],
      targetTaskId: task.id,
      allVisibleSelected: true,
      toggleAllVisible: () => calls.push('all'),
      toggleSelected: (id) => calls.push(['select', id]),
      setEditingTask: (source) => calls.push(['edit', source]),
      changeStatus: async (...args) => calls.push(['status', ...args]),
    }),
  );
  const nodes = elements(tree);
  const checkboxes = nodes.filter((node) => node.type === controls.CheckBox);
  assert.ok(checkboxes.every((node) => node.props.checked));
  checkboxes.forEach((node) => node.props.onChange());
  nodes.find((node) => node.props?.['aria-label'] === 'Edit Demo task').props.onClick();
  nodes.find((node) => node.type === controls.StatusDropdown).props.onChange('Done');
  assert.deepEqual(calls, [
    'all',
    ['select', task.id],
    ['edit', task.source],
    ['status', task.id, 'Done'],
  ]);
  assert.match(renderToStaticMarkup(tree), /shadow-\[inset_3px_0_0_var\(--dashboard-accent\)\]/);
});

test('desktop task title opens editing without subtasks and expansion with subtasks', () => {
  for (const withSubtasks of [false, true]) {
    const calls = [];
    const task = model.toTask(response({ subtasks: withSubtasks ? [{ id: 'sub-a' }] : [] }));
    const tree = TaskDesktopTable(
      desktopProps({
        visibleTasks: [task],
        setEditingTask: (source) => calls.push(['edit', source]),
        toggleTaskExpanded: (id) => calls.push(['expand', id]),
      }),
    );
    elements(tree)
      .find((node) => node.type === 'button' && node.props.className?.includes('min-w-0 text-left'))
      .props.onClick();
    assert.deepEqual(calls, [
      [withSubtasks ? 'expand' : 'edit', withSubtasks ? task.id : task.source],
    ]);
  }
});

test('desktop action menu forwards edit, duplicate, reschedule, lock and delete without changing ownership', () => {
  const task = model.toTask(
    response({ scheduled_start: 'start', scheduled_end: 'end', schedule_locked: false }),
  );
  const calls = [];
  const tree = TaskDesktopTable(
    desktopProps({
      visibleTasks: [task],
      menuTaskId: task.id,
      setMenuTaskId: (value) => calls.push(['menu', value]),
      setEditingTask: (source) => calls.push(['edit', source]),
      handleDuplicate: async (id) => calls.push(['duplicate', id]),
      openReschedule: (value) => calls.push(['reschedule', value]),
      toggleScheduleLock: async (value) => calls.push(['lock', value]),
      handleDeleteOne: async (id) => calls.push(['delete', id]),
    }),
  );
  const nodes = elements(tree);
  for (const label of ['Edit', 'Duplicate', 'Reschedule', 'Lock schedule', 'Delete']) {
    const button = nodes.find((node) => node.type === 'button' && node.props.children === label);
    assert.ok(button, label);
    button.props.onClick();
  }
  assert.deepEqual(calls, [
    ['menu', null],
    ['edit', task.source],
    ['duplicate', task.id],
    ['reschedule', task],
    ['lock', task],
    ['delete', task.id],
  ]);
  const more = nodes.find((node) => node.props?.['aria-label'] === 'More actions for Demo task');
  assert.equal(more.props['aria-expanded'], true);
  more.props.onClick();
  const setter = calls.at(-1)[1];
  assert.equal(setter(task.id), null);
  assert.equal(setter(null), task.id);
});

test('desktop schedule lock preserves disabled guard and unlock label', () => {
  for (const locked of [false, true]) {
    const task = model.toTask(
      response({ schedule_locked: locked, scheduled_start: null, scheduled_end: null }),
    );
    const nodes = elements(
      TaskDesktopTable(desktopProps({ visibleTasks: [task], menuTaskId: task.id })),
    );
    const button = nodes.find(
      (node) =>
        node.type === 'button' &&
        node.props.children === (locked ? 'Unlock schedule' : 'Lock schedule'),
    );
    assert.equal(button.props.disabled, !locked);
    assert.equal(button.props.title, locked ? undefined : 'Schedule this task before locking it');
  }
});

test('desktop expanded subtasks preserve mutation disabling and callback arguments', () => {
  const task = model.toTask(
    response({ subtasks: [{ id: 'sub-a', title: 'First', is_completed: false }] }),
  );
  const calls = [];
  const props = desktopProps({
    visibleTasks: [task],
    expandedTaskIds: [task.id],
    isMutating: true,
    toggleSubtask: async (...args) => calls.push(args),
  });
  const nodes = elements(TaskDesktopTable(props));
  const accordion = nodes.find((node) => node.type === controls.SubtaskAccordion);
  assert.equal(accordion.props.disabled, true);
  assert.equal(nodes.find((node) => node.type === controls.StatusDropdown).props.disabled, true);
  accordion.props.onToggle('sub-a', true);
  assert.deepEqual(calls, [[task, 'sub-a', true]]);
  assert.ok(
    !elements(TaskDesktopTable({ ...props, expandedTaskIds: [] })).some(
      (node) => node.type === controls.SubtaskAccordion,
    ),
  );
});

function mobileProps(overrides = {}) {
  return {
    mobileTaskGroups: [],
    expandedTaskIds: [],
    isLoading: false,
    isMutating: false,
    changeStatus: async () => {},
    toggleTaskExpanded: () => {},
    setEditingTask: () => {},
    toggleSubtask: async () => {},
    ...overrides,
  };
}

test('mobile list retains responsive wrapper and loading/empty states', () => {
  const empty = renderToStaticMarkup(React.createElement(TaskMobileList, mobileProps()));
  assert.match(empty, /aria-label="Tasks grouped by due date"/);
  assert.match(empty, /space-y-7 lg:hidden/);
  assert.match(empty, /No tasks found/);
  assert.match(empty, /Try another filter or create a new task\./);
  const loading = renderToStaticMarkup(
    React.createElement(TaskMobileList, mobileProps({ isLoading: true })),
  );
  assert.match(loading, /Loading tasks\.\.\./);
  assert.ok(!loading.includes('No tasks found'));
});

test('mobile groups retain order, labels, task counts and presentation details', () => {
  const mobileTaskGroups = ['Overdue', 'Today', 'Upcoming', 'Other'].map((group, index) => ({
    group,
    tasks: [
      model.toTask(
        response({
          id: `task-${index}`,
          title: `${group} task`,
          status: group === 'Overdue' ? 'overdue' : 'pending',
          priority: 'high',
          due_date: due(12),
          project_id: 'project-a',
          project: { name: 'Course', color: '#123456' },
        }),
      ),
    ],
  }));
  const tree = TaskMobileList(mobileProps({ mobileTaskGroups }));
  const headings = elements(tree).filter((node) => node.type === 'h2');
  assert.deepEqual(
    headings.map((node) => node.props.children),
    ['Overdue', 'Today', 'Upcoming', 'Other tasks'],
  );
  assert.equal(elements(tree).filter((node) => node.type === 'article').length, 4);
  const counts = elements(tree).filter(
    (node) => node.type === 'span' && node.props.className?.includes('min-w-5'),
  );
  assert.deepEqual(
    counts.map((node) => node.props.children),
    [1, 1, 1, 1],
  );
  const html = renderToStaticMarkup(tree);
  assert.match(html, /Course/);
  assert.match(html, /background-color:#123456/);
  assert.match(html, /Today,/);
  assert.match(html, /High/);
  assert.match(html, /text-\[var\(--red-light\)\]/);
});

test('mobile complete/reopen uses workflow status, including overdue display status', () => {
  for (const [workflow, label, next] of [
    ['pending', 'Complete', 'Done'],
    ['in_progress', 'Complete', 'Done'],
    ['done', 'Reopen', 'Pending'],
  ]) {
    const task = model.toTask(response({ status: 'overdue', workflow_status: workflow }));
    const calls = [];
    const tree = TaskMobileList(
      mobileProps({
        mobileTaskGroups: [{ group: 'Overdue', tasks: [task] }],
        changeStatus: async (...args) => calls.push(args),
      }),
    );
    const button = elements(tree).find(
      (node) => node.props?.['aria-label'] === `${label} Demo task`,
    );
    assert.ok(button);
    button.props.onClick();
    assert.deepEqual(calls, [[task.id, next]]);
  }
});

test('mobile title edits without subtasks and toggles expansion with subtasks', () => {
  for (const withSubtasks of [false, true]) {
    const task = model.toTask(response({ subtasks: withSubtasks ? [{ id: 'sub-a' }] : [] }));
    const calls = [];
    const tree = TaskMobileList(
      mobileProps({
        mobileTaskGroups: [{ group: 'Today', tasks: [task] }],
        expandedTaskIds: [task.id],
        setEditingTask: (source) => calls.push(['edit', source]),
        toggleTaskExpanded: (id) => calls.push(['expand', id]),
      }),
    );
    const button = elements(tree).find(
      (node) => node.type === 'button' && node.props.className === 'min-w-0 flex-1 text-left',
    );
    assert.equal(button.props['aria-expanded'], withSubtasks ? true : undefined);
    button.props.onClick();
    assert.deepEqual(calls, [
      [withSubtasks ? 'expand' : 'edit', withSubtasks ? task.id : task.source],
    ]);
  }
});

test('mobile explicit edit and compact status dropdown retain source and workflow status', () => {
  const task = model.toTask(response({ status: 'overdue', workflow_status: 'in_progress' }));
  const calls = [];
  const nodes = elements(
    TaskMobileList(
      mobileProps({
        mobileTaskGroups: [{ group: 'Overdue', tasks: [task] }],
        setEditingTask: (source) => calls.push(['edit', source]),
        changeStatus: async (...args) => calls.push(['status', ...args]),
      }),
    ),
  );
  nodes.find((node) => node.props?.['aria-label'] === 'Edit Demo task').props.onClick();
  const dropdown = nodes.find((node) => node.type === controls.StatusDropdown);
  assert.equal(dropdown.props.compact, true);
  assert.equal(dropdown.props.value, 'In Progress');
  assert.equal(dropdown.props.taskTitle, task.title);
  dropdown.props.onChange('Done');
  assert.deepEqual(calls, [
    ['edit', task.source],
    ['status', task.id, 'Done'],
  ]);
});

test('mobile expanded subtasks retain mutation disabling and completion arguments', () => {
  const task = model.toTask(
    response({ subtasks: [{ id: 'sub-a', title: 'First', is_completed: false }] }),
  );
  const calls = [];
  const props = mobileProps({
    mobileTaskGroups: [{ group: 'Today', tasks: [task] }],
    expandedTaskIds: [task.id],
    isMutating: true,
    toggleSubtask: async (...args) => calls.push(args),
  });
  const nodes = elements(TaskMobileList(props));
  assert.equal(
    nodes.find((node) => node.props?.['aria-label'] === 'Complete Demo task').props.disabled,
    true,
  );
  assert.equal(nodes.find((node) => node.type === controls.StatusDropdown).props.disabled, true);
  const accordion = nodes.find((node) => node.type === controls.SubtaskAccordion);
  assert.equal(accordion.props.disabled, true);
  accordion.props.onToggle('sub-a', true);
  assert.deepEqual(calls, [[task, 'sub-a', true]]);
  assert.ok(
    !elements(TaskMobileList({ ...props, expandedTaskIds: [] })).some(
      (node) => node.type === controls.SubtaskAccordion,
    ),
  );
});

test('mobile unassigned task retains neutral project colour and no-due-date label', () => {
  const task = model.toTask(response());
  const html = renderToStaticMarkup(
    React.createElement(
      TaskMobileList,
      mobileProps({
        mobileTaskGroups: [{ group: 'Other', tasks: [task] }],
      }),
    ),
  );
  assert.match(html, /background-color:var\(--dashboard-muted\)/);
  assert.match(html, /Unassigned/);
  assert.match(html, /No due date/);
});
