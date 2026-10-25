import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const element = (type, props) => ({ type, props });
const Icon = () => null;
const icons = new Proxy({}, { get: () => Icon });

function load(file, dependencies) {
  const module = { exports: {} };
  const source = fs.readFileSync(
    new URL(`../../components/layout/${file}`, import.meta.url),
    'utf8',
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx: element, jsxs: element };
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return module.exports;
}

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}

function pageHeading(heading, props = {}) {
  const { PageHeading } = load('page-heading.tsx', {
    'react-dom': {},
    './icons': icons,
    './dashboard-heading-context': {
      useDashboardHeading: () => ({ heading, setActionsTarget: () => {} }),
    },
    './ui-preferences-provider': { useUiPreferences: () => ({ theme: 'dark' }) },
  });
  return PageHeading({ title: 'Dashboard', subtitle: 'Plan your day.', ...props });
}

function mobileHeader(title) {
  let searchOpen = false;
  const SearchBox = () => null;
  const HeaderActions = () => null;
  const { MobileTopHeader } = load('mobile-top-header.tsx', {
    'next/link': { default: 'a' },
    'lucide-react': { ArrowLeft: Icon },
    react: {
      useEffect: () => {},
      useState: () => [
        searchOpen,
        (next) => {
          searchOpen = typeof next === 'function' ? next(searchOpen) : next;
        },
      ],
    },
    './icons': icons,
    './header': { HeaderActions, SearchBox },
  });
  return { render: () => MobileTopHeader({ title }), SearchBox, HeaderActions };
}

for (const title of ['All Tasks', 'Calendar', 'Focus Mode']) {
  test(`${title} mobile header has a left title and only a search button on the right`, () => {
    const h = mobileHeader(title);
    const tree = h.render();
    const items = nodes(tree);
    assert.match(tree.props.children[0].props.className, /justify-between/);
    assert.equal(items.find((node) => node.type === 'h1').props.children, title);
    assert.match(items.find((node) => node.type === 'h1').props.className, /\btext-2xl\b/);
    assert.match(items.find((node) => node.type === 'h1').props.className, /font-semibold/);
    assert.equal(
      items.some((node) => node.type === h.HeaderActions),
      false,
    );
    assert.equal(
      items.some((node) => node.type === h.SearchBox),
      false,
    );
    assert.deepEqual(
      items.filter((node) => node.type === 'button').map((node) => node.props['aria-label']),
      ['Search tasks'],
    );
  });
}

for (const title of ['Personal Forest', 'AI Insights']) {
  test(`${title} mobile header returns to Account without task search controls`, () => {
    const h = mobileHeader(title);
    const items = nodes(h.render());
    const heading = items.find((node) => node.type === 'h1');
    const backLink = items.find((node) => node.props?.['aria-label'] === 'Back to account');

    assert.equal(heading.props.children, title);
    assert.match(heading.props.className, /\btext-2xl\b/);
    assert.match(heading.props.className, /font-semibold/);
    assert.equal(backLink.props.href, '/account');
    assert.equal(
      items.some((node) => node.type === h.HeaderActions || node.type === h.SearchBox),
      false,
    );
    assert.equal(
      items.some((node) => node.props?.['aria-label'] === 'Search tasks'),
      false,
    );
  });
}

test('Profile mobile header centers its title and returns to Account', () => {
  const h = mobileHeader('Profile');
  const items = nodes(h.render());
  const title = items.find((node) => node.type === 'h1');
  assert.equal(title.props.children, 'Profile');
  assert.match(title.props.className, /text-center/);
  assert.equal(
    items.find((node) => node.props?.['aria-label'] === 'Back to account').props.href,
    '/account',
  );
  assert.equal(
    items.some((node) => node.props?.['aria-label'] === 'Search tasks'),
    false,
  );
});

for (const title of ['Calendar', 'All Tasks']) {
  test(`${title} search opens a focused field and Escape closes it`, () => {
    const h = mobileHeader(title);
    nodes(h.render())
      .find((node) => node.type === 'button')
      .props.onClick();
    const open = nodes(h.render());
    const search = open.find((node) => node.type === h.SearchBox);
    assert.equal(search.props.autoFocus, true);
    assert.equal(search.props.compact, true);
    assert.equal(search.props.showFilterButton, title === 'All Tasks');
    open.find((node) => node.props?.id === 'mobile-page-search').props.onKeyDown({ key: 'Escape' });
    assert.equal(
      nodes(h.render()).some((node) => node.type === h.SearchBox),
      false,
    );
  });
}

test('duplicate mobile titles are hidden without hiding page action controls', () => {
  const tree = pageHeading(null, { mobileTitleInHeader: true, title: 'AI Insights' });
  const [identity, actions] = tree.props.children;
  assert.match(identity.props.className, /hidden lg:block/);
  assert.equal(actions.props.className.split(' ').includes('hidden'), false);
  assert.equal(typeof actions.props.ref, 'function');
});

test('mobile dashboard shows the greeting before the suggested task card', () => {
  const preview = element('a', { href: '/tasks?task_id=task-a' });
  const tree = pageHeading({ greeting: 'Good morning, Minh', mobileCard: preview });
  const column = tree.props.children[0];
  const [greeting, , card] = column.props.children;
  assert.equal(card.props.children, preview);
  assert.match(card.props.className, /lg:hidden/);
  assert.doesNotMatch(card.props.className, /-ml-|translate-x/);
  assert.equal(greeting.props.children[0].type, 'h1');
  const lines = nodes(greeting.props.children[0]).filter(
    (node) =>
      node.type === 'span' && /text-xs|text-2xl|hidden lg:inline/.test(node.props.className ?? ''),
  );
  assert.equal(
    lines[0].props.children.filter((child) => typeof child === 'string').join(''),
    'Good morning,',
  );
  assert.match(lines[0].props.className, /text-xs/);
  assert.match(lines[0].props.className, /block/);
  assert.equal(lines[1].props.children, 'Minh');
  assert.match(lines[1].props.className, /block text-2xl/);
  assert.equal(lines[2].props.children, 'Good morning, Minh');
  assert.match(lines[2].props.className, /hidden lg:inline/);
  assert.match(greeting.props.children[0].props.className, /\btext-2xl\b/);
  assert.match(greeting.props.children[0].props.className, /font-normal/);
  assert.match(greeting.props.children[0].props.className, /lg:font-medium/);
  assert.match(greeting.props.children[0].props.className, /lg:text-4xl/);
});

test('mobile task preview has no added tree progress or buttons from the heading', () => {
  const preview = element('a', { href: '/tasks?task_id=task-a' });
  const tree = pageHeading({
    greeting: 'Good morning, Minh',
    date: 'Saturday 17 October',
    message: 'Two tasks left in today’s plan.',
    mobileCard: preview,
  });
  const [greeting, , card, desktopMessage] = tree.props.children[0].props.children;
  assert.equal(card.props.children, preview);
  assert.match(card.props.className, /lg:hidden/);
  assert.equal(
    nodes(card).some((node) => node.type === 'button' || node.props?.role === 'progressbar'),
    false,
  );
  assert.match(desktopMessage.props.className, /hidden lg:block/);
  assert.equal(greeting.props.children[0].type, 'h1');
  assert.equal(desktopMessage.props.children, 'Two tasks left in today’s plan.');
});

test('dashboard search bar appears below the greeting and before the suggested task', () => {
  const search = element('input', { type: 'search' });
  const preview = element('a', { href: '/tasks?task_id=task-a' });
  const tree = pageHeading(
    { greeting: 'Good morning, Minh', mobileCard: preview },
    { mobileSearch: search },
  );
  const [greeting, searchRow, card] = tree.props.children[0].props.children;
  assert.equal(greeting.props.children[0].type, 'h1');
  assert.equal(searchRow.props.children, search);
  assert.match(searchRow.props.className, /lg:hidden/);
  assert.equal(card.props.children, preview);
});

function suggestedTaskCard(task) {
  const { SuggestedTaskCard } = load('../dashboard/suggested-task-card.tsx', {
    'next/link': { default: 'a' },
    './dashboard-task-card': { DashboardTaskCard: 'task-preview' },
    '../gamification/plant-visual': { PlantVisual: 'tree-visual' },
    'lucide-react': { Sparkles: 'sparkles-icon' },
  });
  return SuggestedTaskCard({ task });
}

test('suggested task card links to the selected task and exposes a view button', () => {
  const task = { id: 'task-a', title: 'Meeting Uni' };
  const container = suggestedTaskCard(task);
  assert.equal(container.type, 'section');
  assert.equal(container.props['aria-label'], 'AI Pick for Today');
  assert.match(container.props.className, /px-5/);
  assert.match(container.props.className, /pt-6/);
  // Decorative layers may change; assert the user-facing links and task payload.
  const items = nodes(container);
  const title = items.find((node) => node.type === 'h2');
  assert.equal(title.props.children, 'AI Pick for Today');
  assert.match(title.props.className, /text-\[21px\]/);
  const [tree, viewTask] = items.filter((node) => node.type === 'a');
  assert.equal(tree.type, 'a');
  assert.equal(tree.props.href, '/tasks?task_id=task-a');
  assert.equal(tree.props['aria-label'], 'View task: Meeting Uni');
  assert.equal(tree.props.children.props.task, task);
  assert.equal(tree.props.children.props.compact, true);
  assert.equal(tree.props.children.props.action, undefined);
  assert.equal(viewTask.type, 'a');
  assert.equal(viewTask.props.href, '/tasks?task_id=task-a');
  assert.equal(viewTask.props.children, 'View task');
});

test('no suggested task renders a noninteractive empty state', () => {
  const container = suggestedTaskCard(null);
  const items = nodes(container);
  assert.equal(
    items.some((node) => node.type === 'a' || node.type === 'task-preview'),
    false,
  );
  const tree = items.find((node) => node.props?.role === 'status');
  assert.equal(tree.props.role, 'status');
  assert.equal(tree.props.href, undefined);
  assert.equal(tree.props.children, 'No open task to suggest.');
});

test('mobile dashboard has no separate logo wordmark or XP header', () => {
  assert.equal(mobileHeader('Dashboard').render(), null);
});

test('mobile notifications sit beside the greeting before the task card', () => {
  const notification = element('button', { 'aria-label': 'Notifications' });
  const tree = pageHeading({ greeting: 'Good morning, Minh' }, { mobileActions: notification });
  const row = tree.props.children[0].props.children[0];
  assert.ok(nodes(row.props.children[0]).some((node) => node.props?.children === 'Minh'));
  assert.equal(row.props.children[1].props.children, notification);
  assert.match(row.props.children[1].props.className, /lg:hidden/);
});

test('other page headings do not gain a dashboard task card or empty space', () => {
  const tree = pageHeading(null);
  assert.equal(tree.props.children[0].props.children[2], null);
  assert.equal(nodes(tree).find((node) => node.type === 'h1').props.children, 'Dashboard');
});

function header(compact, props = {}) {
  const { HeaderActions, HeaderDate } = load('header.tsx', {
    'next/navigation': { useRouter: () => ({}), usePathname: () => '/' },
    react: {
      useState: (initial) => [initial, () => {}],
      useEffect: () => {},
      useCallback: (fn) => fn,
      useRef: () => ({ current: null }),
    },
    'lucide-react': icons,
    './icons': icons,
    './header-dropdown': { HeaderDropdown: Icon },
    './notification-dropdown': { NotificationDropdown: Icon },
    '../../lib/data-events': {},
    '../../lib/notifications': {},
    '../shared/user-avatar': { UserAvatar: Icon },
    './dashboard-heading-context': {},
    './ui-preferences-provider': { useUiPreferences: () => ({ theme: 'dark' }) },
  });
  return {
    tree: HeaderActions({ compact, totalXp: 65, user: { id: 'user-a' }, ...props }),
    HeaderDate,
  };
}

test('greeting notifications do not include an XP badge', () => {
  const items = nodes(header(true, { showXp: false }).tree);
  assert.equal(
    items.some((node) => node.props?.['aria-label'] === '65 accumulated XP'),
    false,
  );
  assert.deepEqual(
    items.filter((node) => node.type === 'button').map((node) => node.props['aria-label']),
    ['Notifications'],
  );
});

test('mobile header keeps only XP and notifications in one row', () => {
  const { tree, HeaderDate } = header(true);
  const items = nodes(tree);
  assert.match(tree.props.className, /flex gap-2/);
  assert.equal(
    items.some((node) => node.type === HeaderDate),
    false,
  );
  assert.deepEqual(
    items.filter((node) => node.type === 'button').map((node) => node.props['aria-label']),
    ['Notifications'],
  );
  assert.ok(items.some((node) => node.props?.['aria-label'] === '65 accumulated XP'));
});

test('desktop header retains date theme notifications and profile', () => {
  const { tree, HeaderDate } = header(false);
  const items = nodes(tree);
  assert.ok(items.some((node) => node.type === HeaderDate));
  assert.deepEqual(
    items.filter((node) => node.type === 'button').map((node) => node.props['aria-label']),
    ['Switch to light mode', 'Notifications', 'Open profile'],
  );
});

function mobileNavigation(pathname = '/') {
  const { MobileBottomNavigation } = load('mobile-bottom-navigation.tsx', {
    'next/link': { default: 'a' },
    'next/navigation': { usePathname: () => pathname, useRouter: () => ({ push: () => {} }) },
    'lucide-react': icons,
    './icons': icons,
    '../auth/current-user-provider': { useCurrentUser: () => ({ signOut: () => {} }) },
    './ui-preferences-provider': {
      useUiPreferences: () => ({ theme: 'dark', setTheme: () => {} }),
    },
  });
  return {
    render: () => nodes(MobileBottomNavigation()),
  };
}

test('mobile navigation opens Account directly alongside Home, Tasks, and Calendar', () => {
  const h = mobileNavigation('/tasks');
  const items = h.render();
  const links = items.filter((node) => node.type === 'a');
  assert.deepEqual(
    links.map((node) => node.props.href),
    ['/dashboard', '/tasks', '/calendar', '/account'],
  );
  assert.equal(links.find((node) => node.props.href === '/tasks').props['aria-current'], 'page');
  assert.ok(links.some((node) => nodes(node).some((child) => child.props?.children === 'Account')));
  assert.equal(
    items.find((node) => node.props?.['aria-label'] === 'Create task') !== undefined,
    true,
  );

  assert.equal(
    items.some((node) => node.props?.['aria-haspopup'] === 'dialog'),
    false,
  );
  assert.equal(
    items.some((node) => /^Switch to (light|dark) mode$/.test(node.props?.['aria-label'] ?? '')),
    false,
  );
});

test('Account stays active while visiting its profile, settings, and progress destinations', () => {
  for (const pathname of [
    '/account',
    '/profile',
    '/analytics',
    '/gamification',
    '/gamification/forest',
  ]) {
    const links = mobileNavigation(pathname)
      .render()
      .filter((node) => node.type === 'a');
    assert.equal(
      links.find((node) => node.props.href === '/account').props['aria-current'],
      'page',
    );
    assert.equal(links.filter((node) => node.props['aria-current'] === 'page').length, 1);
  }
});
