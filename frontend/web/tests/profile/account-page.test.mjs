import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { URL } from 'node:url';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';

// Exercise the real JSX and state transitions without a DOM, API or database.
function harness() {
  const slots = [];
  let cursor = 0;
  let signOuts = 0;
  const placeholder = () => null;
  const dependencies = {
    'react/jsx-runtime': jsxRuntime,
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [
          slots[index],
          (value) => {
            slots[index] = typeof value === 'function' ? value(slots[index]) : value;
          },
        ];
      },
      useMemo: (callback) => callback(),
      useEffect: () => {},
    },
    'next/link': { __esModule: true, default: placeholder },
    'lucide-react': new Proxy({}, { get: () => placeholder }),
    '../../lib/auth': {},
    '../auth/current-user-provider': {
      useCurrentUser: () => ({
        user: { first_name: 'Demo', last_name: 'User', email: 'demo@example.test' },
        signOut: () => {
          signOuts++;
        },
      }),
    },
    '../layout/ui-preferences-provider': { useUiPreferences: () => ({ theme: 'dark' }) },
    '../shared/user-avatar': { UserAvatar: placeholder },
    '../../lib/data-events': {},
    '../../lib/settings': {},
    '../settings/appearance-settings': { AppearanceSettings: placeholder },
    '../settings/notification-settings': { NotificationSettings: placeholder },
    '../settings/scheduling-weights': { SchedulingWeights: placeholder },
    '../settings/work-preferences': { WorkPreferences: placeholder },
  };
  const module = { exports: {} };
  const source = fs.readFileSync(
    new URL('../../components/profile/account-page.tsx', import.meta.url),
    'utf8',
  );
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
    {
      module,
      exports: module.exports,
      require(name) {
        assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
        return dependencies[name];
      },
    },
  );
  return {
    render() {
      cursor = 0;
      return module.exports.AccountPage();
    },
    signOuts: () => signOuts,
  };
}

function nodes(tree, desktop = false) {
  const result = [];
  function visit(node) {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) return;
      const classes = (child.props.className ?? '').split(/\s+/);
      let hidden = classes.includes('hidden');
      if (desktop && classes.some((value) => /^md:(block|inline|flex|grid)$/.test(value)))
        hidden = false;
      if (desktop && classes.includes('md:hidden')) hidden = true;
      if (hidden) return;
      result.push(child);
      visit(child.props.children);
    });
  }
  visit(tree);
  return result;
}

function text(node) {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(text).join('');
  return React.isValidElement(node) ? text(node.props.children) : '';
}

test('mobile: account content, inline preferences and logout appear in that order', () => {
  const visible = nodes(harness().render());
  assert.equal(visible.filter((node) => node.type === 'nav').length, 0);
  const progress = visible.findIndex((node) => node.props.id === 'account-progress');
  const preferences = visible.findIndex((node) => node.props.id === 'account-mobile-preferences');
  const buttons = visible.filter((node) => node.type === 'button');
  assert.ok(progress >= 0 && preferences > progress);
  assert.equal(text(buttons.at(-1)).trim(), 'Log out');
  assert.equal(buttons.filter((node) => text(node).trim() === 'Log out').length, 1);
  for (const section of ['notifications', 'appearance', 'work', 'scheduling']) {
    const trigger = visible.find((node) => node.props.id === `account-mobile-${section}-trigger`);
    const panel = visible.find((node) => node.props.id === trigger.props['aria-controls']);
    assert.equal(trigger.props['aria-expanded'], false);
    assert.equal(panel.props.inert, true);
    assert.match(panel.props.className, /grid-rows-\[0fr\]/);
  }
});

test('mobile reference layout keeps compact spacing and desktop card styling', () => {
  const visible = nodes(harness().render());
  const profileLink = visible.find((node) => node.props['aria-label'] === 'View your profile');
  assert.match(profileLink.props.className, /flex-col/);
  assert.match(profileLink.props.className, /md:flex-row/);
  assert.match(profileLink.props.className, /gap-4/);
  const avatar = visible.find((node) => 'avatarUrl' in node.props);
  assert.match(avatar.props.className, /h-\[88px\]/);
  assert.match(avatar.props.className, /md:h-16/);
  assert.ok(visible.some((node) => text(node).trim() === 'demo@example.test'));
  for (const label of ['account-private-information', 'account-progress']) {
    const section = visible.find(
      (node) => node.type === 'section' && node.props['aria-labelledby'] === label,
    );
    const classes = section.props.className.split(/\s+/);
    assert.equal(classes.includes('border'), false);
    assert.equal(classes.includes('rounded-2xl'), false);
    assert.ok(classes.includes('md:border'));
    assert.ok(classes.includes('md:p-5'));
  }
  const trigger = visible.find((node) => node.props.id === 'account-mobile-notifications-trigger');
  for (const token of ['min-h-14', 'gap-3', 'px-4', 'py-3']) {
    assert.ok(trigger.props.className.split(/\s+/).includes(token));
  }
  assert.ok(visible.some((node) => node.props.className === 'min-w-0 space-y-6 md:-mt-7'));
});

test('name editor opens between the Name and Email rows', () => {
  const h = harness();
  let visible = nodes(h.render());
  const nameRow = visible.find(
    (node) => node.type === 'button' && text(node).trim().startsWith('Name'),
  );
  nameRow.props.onClick();

  visible = nodes(h.render());
  const nameIndex = visible.findIndex(
    (node) => node.type === 'button' && text(node).trim().startsWith('Name'),
  );
  const editorIndex = visible.findIndex((node) => node.type === 'form');
  const emailIndex = visible.findIndex(
    (node) => node.type === 'div' && node.props.className.includes('cursor-default'),
  );
  assert.ok(editorIndex > nameIndex);
  assert.ok(emailIndex > editorIndex);
});

test('mobile: accordion opens at its row, switches sections, and collapses again', () => {
  const h = harness();
  function trigger(section) {
    return nodes(h.render()).find((node) => node.props.id === `account-mobile-${section}-trigger`);
  }
  trigger('notifications').props.onClick();
  assert.equal(trigger('notifications').props['aria-expanded'], true);
  let visible = nodes(h.render());
  let panel = visible.find((node) => node.props.id === 'account-mobile-notifications-panel');
  assert.equal(panel.props.inert, false);
  assert.match(panel.props.className, /grid-rows-\[1fr\]/);
  assert.match(panel.props.className, /motion-reduce:transition-none/);
  assert.ok(
    visible.indexOf(panel) <
      visible.findIndex((node) => node.props.id === 'account-mobile-appearance-trigger'),
  );
  trigger('appearance').props.onClick();
  assert.equal(trigger('notifications').props['aria-expanded'], false);
  assert.equal(trigger('appearance').props['aria-expanded'], true);
  trigger('appearance').props.onClick();
  assert.equal(trigger('appearance').props['aria-expanded'], false);
});

test('desktop: sidebar tabs and logout stay in the left column', () => {
  const h = harness();
  let visible = nodes(h.render(), true);
  const aside = visible.find((node) => node.type === 'aside');
  const sidebar = nodes(aside, true);
  assert.equal(sidebar.filter((node) => node.type === 'nav').length, 1);
  const buttons = sidebar.filter((node) => node.type === 'button');
  assert.deepEqual(
    buttons.map((node) => text(node).trim()),
    ['Account', 'Notifications', 'Theme', 'Work preferences', 'Scheduling priorities', 'Log out'],
  );
  buttons.find((node) => text(node) === 'Notifications').props.onClick();
  visible = nodes(h.render(), true);
  assert.equal(
    visible.some((node) => node.props.id === 'account-profile'),
    false,
  );
  assert.equal(
    visible.some((node) => node.props.id === 'account-mobile-preferences'),
    false,
  );
  assert.ok(visible.some((node) => node.type === 'h2' && text(node) === 'Notifications'));
  // Resizing to mobile still shows the account content and inline list.
  visible = nodes(h.render());
  assert.ok(visible.some((node) => node.props.id === 'account-profile'));
  assert.ok(visible.some((node) => node.props.id === 'account-mobile-preferences'));
});

test('mobile logout still calls the shared sign-out handler', () => {
  const h = harness();
  const logout = nodes(h.render()).find(
    (node) => node.type === 'button' && text(node).trim() === 'Log out',
  );
  logout.props.onClick();
  assert.equal(h.signOuts(), 1);
});
