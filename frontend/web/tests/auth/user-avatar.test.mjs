import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

function harness() {
  let failedUrl = null;
  const module = { exports: {} };
  const source = fs.readFileSync(
    new URL('../../components/shared/user-avatar.tsx', import.meta.url),
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
      if (name === 'react') {
        return {
          useState: () => [failedUrl, (value) => (failedUrl = value)],
        };
      }
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) };
      if (name === '../../lib/api') return { getApiUrl: (url) => `http://localhost:8000${url}` };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return (props = {}) => module.exports.UserAvatar(props);
}

test('missing avatars use name initials, email initials, or the default', () => {
  const render = harness();
  assert.equal(render({ firstName: ' Ada ', lastName: 'Lovelace' }).props.children, 'AL');
  assert.equal(render({ email: 'ada@example.com' }).props.children, 'AD');
  assert.equal(render().props.children, 'U');
});

test('failed avatar falls back without changing the URL or retrying in a loop', () => {
  const render = harness();
  const props = { avatarUrl: '/uploads/avatar.png', firstName: 'Ada', lastName: 'Lovelace' };
  const avatar = render(props);
  assert.equal(avatar.props.children.props.src, 'http://localhost:8000/uploads/avatar.png');
  avatar.props.children.props.onError();
  assert.equal(render(props).props.children, 'AL');
  assert.equal(render(props).props.children, 'AL');
});

test('a replacement avatar is tried after failure, keeping custom styling', () => {
  const render = harness();
  const props = { avatarUrl: 'https://example.com/old.png', firstName: 'Ada' };
  render(props).props.children.props.onError();
  const replacement = render({
    ...props,
    avatarUrl: 'https://example.com/new.png',
    className: 'size-14',
    imageClassName: 'custom-image',
  });
  assert.equal(replacement.props.children.props.src, 'https://example.com/new.png');
  assert.match(replacement.props.className, /size-14/);
  assert.match(replacement.props.children.props.className, /custom-image/);
  replacement.props.children.props.onLoad();
  assert.equal(render(props).props.children.type, 'img');
});
