import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';

const icon = () => null;
const icons = new Proxy({}, { get: () => icon });

function load(relativePath, dependencies, globals = {}) {
  const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const module = { exports: {} };
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
      ...globals,
    },
  );
  return module.exports;
}

const { tourSteps } = load('../../components/onboarding/feature-tour-content.ts', {
  'lucide-react': icons,
});
const { placeTourPopover } = load('../../components/onboarding/tour-position.ts', {});

function allNodes(tree) {
  const nodes = [];
  function visit(value) {
    React.Children.forEach(value, (node) => {
      if (!React.isValidElement(node)) return;
      nodes.push(node);
      visit(node.props.children);
    });
  }
  visit(tree);
  return nodes;
}

function text(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  return React.isValidElement(node) ? text(node.props.children) : '';
}

function harness({
  userId = 'account-one',
  storage = new Map(),
  pathname = '/dashboard',
  blockedStorage = false,
  anotherDialog = false,
} = {}) {
  const slots = [];
  const timers = new Map();
  const listeners = new Map();
  const routes = [];
  const events = [];
  let cursor = 0;
  let pendingEffects = [];
  let dirty = false;
  let timerId = 0;
  let tree;
  const sameDeps = (a, b) =>
    a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const dialog = {
    open: false,
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
  };
  const document = {
    body: { style: { overflow: 'auto' } },
    querySelector: () => (anotherDialog ? {} : null),
  };
  const window = {
    localStorage: {
      getItem(key) {
        if (blockedStorage) throw new Error('Storage blocked');
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        if (blockedStorage) throw new Error('Storage blocked');
        storage.set(key, value);
      },
    },
    setTimeout(callback) {
      timers.set(++timerId, callback);
      return timerId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
    removeEventListener(name, listener) {
      if (listeners.get(name) === listener) listeners.delete(name);
    },
    dispatchEvent(event) {
      events.push(event.type);
    },
  };
  const router = {
    replace(route) {
      routes.push(route);
      pathname = route.split('?')[0];
    },
  };
  const hooks = {
    useState(initial) {
      const i = cursor++;
      slots[i] ??= { value: initial };
      return [
        slots[i].value,
        (value) => {
          const next = typeof value === 'function' ? value(slots[i].value) : value;
          if (!Object.is(next, slots[i].value)) {
            slots[i].value = next;
            dirty = true;
          }
        },
      ];
    },
    useRef(initial) {
      const i = cursor++;
      return (slots[i] ??= { current: initial });
    },
    useCallback(callback, deps) {
      const i = cursor++;
      if (!sameDeps(slots[i]?.deps, deps)) slots[i] = { value: callback, deps };
      return slots[i].value;
    },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!sameDeps(slots[i]?.deps, deps)) {
        const previous = slots[i];
        slots[i] = { deps };
        pendingEffects.push(() => {
          previous?.cleanup?.();
          slots[i].cleanup = effect();
        });
      }
    },
  };
  const { FeatureTour } = load(
    '../../components/onboarding/feature-tour.tsx',
    {
      react: hooks,
      'react/jsx-runtime': jsxRuntime,
      'lucide-react': icons,
      'next/navigation': { usePathname: () => pathname, useRouter: () => router },
      './feature-tour-content': { tourSteps },
      './use-tour-spotlight': {
        useTourSpotlight: () => ({
          left: 200,
          top: 100,
          side: 'right',
          arrow: 40,
          frame: { left: 10, top: 10, width: 100, height: 60 },
        }),
      },
      './feature-tour.module.css': {
        __esModule: true,
        default: new Proxy({}, { get: (_, name) => name }),
      },
    },
    { window, document, Event },
  );

  function render() {
    for (let iteration = 0; iteration < 12; iteration++) {
      dirty = false;
      cursor = 0;
      pendingEffects = [];
      tree = FeatureTour({ userId });
      for (const node of allNodes(tree)) {
        if (node.props.ref)
          node.props.ref.current = node.type === 'dialog' ? dialog : { focus() {}, scrollTo() {} };
      }
      for (const effect of pendingEffects) effect();
      if (!dirty) return tree;
    }
    throw new Error('Tour did not settle');
  }
  render();
  return {
    dialog,
    routes,
    events,
    storage,
    document,
    runTimers() {
      const callbacks = [...timers.values()];
      timers.clear();
      callbacks.forEach((callback) => callback());
      return render();
    },
    replay() {
      listeners.get('chrono:start-feature-tour')();
      return render();
    },
    click(label) {
      const button = allNodes(tree).find(
        (node) =>
          node.type === 'button' &&
          (text(node).trim() === label || node.props['aria-label'] === label),
      );
      assert.ok(button, `Button not found: ${label}`);
      button.props.onClick();
      return render();
    },
    cancel() {
      tree.props.onCancel({ preventDefault() {} });
      return render();
    },
    heading() {
      return text(allNodes(tree).find((node) => node.type === 'h2'));
    },
  };
}

test('first dashboard visit offers an optional tour; completing all six steps persists the result', () => {
  const h = harness();
  assert.equal(h.dialog.open, false);
  h.runTimers();
  assert.equal(h.dialog.open, true);
  assert.equal(h.document.body.style.overflow, 'hidden');
  assert.equal(h.heading(), tourSteps[0].title);
  for (let index = 0; index < tourSteps.length; index++) {
    assert.equal(h.heading(), tourSteps[index].title);
    h.click(index === tourSteps.length - 1 ? 'Finish tour' : 'Next');
  }
  assert.equal(h.dialog.open, false);
  assert.equal(h.document.body.style.overflow, 'auto');
  assert.equal(h.storage.get('chrono-onboarding:v1:account-one'), 'completed');
  const revisited = harness({ storage: h.storage });
  revisited.runTimers();
  assert.equal(revisited.dialog.open, false);
});

test('skip and Escape remember dismissal, while Account can replay a dismissed tour', () => {
  for (const escape of [false, true]) {
    const h = harness();
    h.runTimers();
    if (escape) h.cancel();
    else h.click('Skip');
    assert.equal(h.storage.get('chrono-onboarding:v1:account-one'), 'skipped');
    assert.equal(h.dialog.open, false);
    h.replay();
    assert.equal(h.dialog.open, true);
    assert.equal(h.heading(), tourSteps[0].title);
  }
});

test('completion is scoped to the account, and a deep link or active dialog is left alone', () => {
  const storage = new Map([['chrono-onboarding:v1:account-one', 'completed']]);
  const otherUser = harness({ userId: 'account-two', storage });
  otherUser.runTimers();
  assert.equal(otherUser.dialog.open, true);
  for (const options of [{ pathname: '/tasks' }, { anotherDialog: true }, { userId: undefined }]) {
    const h = harness({ ...options, userId: 'userId' in options ? '' : 'account-one' });
    h.runTimers();
    assert.equal(h.dialog.open, false);
  }
});

test('blocked storage does not prevent the tour or its close controls from working', () => {
  const h = harness({ blockedStorage: true });
  h.runTimers();
  assert.equal(h.dialog.open, true);
  h.click('Skip tour');
  assert.equal(h.dialog.open, false);
});

test('next, back, and step controls move between the real feature pages', () => {
  const h = harness();
  h.runTimers();
  h.click('Next');
  assert.equal(h.routes.at(-1), '/tasks');
  h.click('Previous tour step');
  assert.equal(h.heading(), tourSteps[0].title);
  h.click('Step 4 of 6: Calendar');
  assert.equal(h.heading(), tourSteps[3].title);
  assert.equal(h.routes.at(-1), '/calendar');
  assert.equal(h.dialog.open, true);
});

test('leaving the AI step closes only the form opened by the tour', () => {
  const h = harness();
  h.runTimers();
  assert.deepEqual(h.events, []);
  h.click('Step 3 of 6: AI assistance');
  assert.equal(h.routes.at(-1), '/tasks?create=1');
  h.click('Next');
  assert.equal(h.routes.at(-1), '/calendar');
  assert.deepEqual(h.events, ['chrono:close-tour-task-form']);
  h.click('Step 3 of 6: AI assistance');
  h.cancel();
  assert.equal(h.routes.at(-1), '/tasks');
  assert.equal(h.dialog.open, false);
  assert.equal(h.events.length, 2);
});

test('desktop popup sits beside the component without covering its frame', () => {
  const popup = { width: 360, height: 310 };
  for (const target of [
    { left: 340, top: 200, width: 250, height: 180 },
    { left: 1100, top: 200, width: 260, height: 180 },
  ]) {
    const placed = placeTourPopover(target, popup, { width: 1440, height: 900 });
    assert.ok(placed.side === 'left' || placed.side === 'right');
    assert.ok(
      placed.left + popup.width <= placed.frame.left ||
        placed.left >= placed.frame.left + placed.frame.width,
    );
    assert.ok(placed.top >= 12 && placed.top + popup.height <= 888);
  }
});

test('mobile popup stays in view and does not obscure the highlighted component', () => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    const popup = { width: Math.min(360, viewport.width - 24), height: 310 };
    for (const target of [
      { left: 18, top: 20, width: viewport.width - 36, height: 180 },
      { left: 18, top: viewport.height - 90, width: 100, height: 65 },
      { left: 18, top: 80, width: viewport.width - 36, height: 600 },
    ]) {
      const placed = placeTourPopover(target, popup, viewport);
      assert.ok(placed.left >= 12 && placed.left + popup.width <= viewport.width - 12);
      assert.ok(placed.top >= 12 && placed.top + popup.height <= viewport.height - 12);
      if (placed.frame) {
        const below = placed.top >= placed.frame.top + placed.frame.height;
        const above = placed.top + popup.height <= placed.frame.top;
        assert.ok(
          below || above,
          `Popup overlaps its frame at ${viewport.width}×${viewport.height}`,
        );
      }
    }
  }
});
