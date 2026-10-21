import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { URL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';

function renderShell(sessionStatus, error = null) {
  const mounted = [];
  const part = (name) =>
    function Part() {
      mounted.push(name);
      return React.createElement('div', { 'data-shell': name });
    };
  const wrapper = ({ children }) => children;
  const dependencies = {
    react: React,
    'react/jsx-runtime': jsxRuntime,
    'next/navigation': { usePathname: () => '/tasks' },
    'next/link': {
      __esModule: true,
      default: ({ children, ...props }) => React.createElement('a', props, children),
    },
    '../../lib/gamification': {},
    '../auth/current-user-provider': {
      CurrentUserProvider: wrapper,
      useCurrentUser: () => ({
        sessionStatus,
        error,
        user: null,
        refreshUser: async () => null,
      }),
    },
    '../gamification/growth-reward-toast': { GrowthRewardToast: part('rewards') },
    './header': {
      Header: part('header'),
      HeaderActions: part('notifications'),
      SearchBox: part('search'),
    },
    './mobile-bottom-navigation': { MobileBottomNavigation: part('mobile-navigation') },
    './mobile-top-header': { MobileTopHeader: part('mobile-header') },
    './sidebar': { Sidebar: part('sidebar') },
    './dashboard-heading-context': { DashboardHeadingProvider: wrapper },
    './page-heading': { PageHeading: part('heading') },
    './page-entrance': { PageEntrance: wrapper },
  };
  const module = { exports: {} };
  const source = fs.readFileSync(
    new URL('../../components/layout/dashboard-shell.tsx', import.meta.url),
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
  const html = renderToStaticMarkup(
    React.createElement(
      module.exports.DashboardShell,
      null,
      React.createElement(part('protected-content')),
    ),
  );
  return { html, mounted };
}

for (const status of ['checking', 'unavailable', 'unauthenticated']) {
  test(`${status}: no protected content or shell loaders mount`, () => {
    const { html, mounted } = renderShell(status, 'Temporary session failure');
    assert.deepEqual(mounted, []);
    if (status === 'checking') assert.match(html, /Checking your session/);
    if (status === 'unavailable') {
      assert.match(html, /Temporary session failure/);
      assert.match(html, /Try again/);
      assert.doesNotMatch(html, /href="\/login"/);
    }
    if (status === 'unauthenticated') {
      assert.match(html, /Redirecting to sign in/);
      assert.match(html, /href="\/login"/);
    }
  });
}

test('authenticated: shared navigation and feature content still mount', () => {
  const { mounted } = renderShell('authenticated');
  for (const name of [
    'sidebar',
    'header',
    'mobile-header',
    'mobile-navigation',
    'rewards',
    'protected-content',
  ]) {
    assert.ok(mounted.includes(name), `Missing ${name}`);
  }
});
