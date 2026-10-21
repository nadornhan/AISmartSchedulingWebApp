import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const root = fileURLToPath(new URL('../..', import.meta.url));
function loadSource(file, dependencies = {}, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(
    code,
    {
      module,
      exports: module.exports,
      require: (name) => {
        if (name === './read-cache') return loadSource('lib/read-cache.ts');
        assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
        return dependencies[name];
      },
      process,
      Error: globalThis.Error,
      AbortController: globalThis.AbortController,
      ...globals,
    },
    { filename: file },
  );
  return module.exports;
}

const { ApiError } = loadSource('lib/api.ts');
const { createCurrentUserSession } = loadSource('lib/auth-session.ts', {
  './api': { ApiError },
});
const user = { id: 'user-a', first_name: 'Test', email: 'test@example.com' };

for (const { name, status = 422, detail, message } of [
  {
    name: 'invalid email', detail: [{ type: 'value_error', loc: ['body', 'email'], msg: 'value is not a valid email address', input: 'bad-email' }],
    message: 'Please enter a valid email address.',
  },
  {
    name: 'missing email', detail: [{ type: 'missing', loc: ['body', 'email'], msg: 'Field required' }],
    message: 'Email is required.',
  },
  {
    name: 'short password', detail: [{ type: 'string_too_short', loc: ['body', 'password'], msg: 'String should have at least 8 characters', input: 'private-password', ctx: { min_length: 8 } }],
    message: 'Password must be at least 8 characters.',
  },
  {
    name: 'long password', detail: [{ type: 'string_too_long', loc: ['body', 'password'], input: 'private-password', ctx: { max_length: 128 } }],
    message: 'Password must be at most 128 characters.',
  },
  {
    name: 'invalid time zone with a valid email', detail: [{ type: 'value_error', loc: ['body', 'timezone'], msg: 'Value error, Unknown timezone', input: 'unknown' }],
    message: 'Your device’s time zone could not be validated. Please check its time zone settings.',
  },
  {
    name: 'multiple fields', detail: [
      { type: 'value_error', loc: ['body', 'email'] },
      { type: 'value_error', loc: ['body', 'email'] },
      { type: 'missing', loc: ['body', 'last_name'] },
    ], message: 'Please enter a valid email address. Last name is required.',
  },
  { name: 'malformed validation response', detail: [{ input: 'private-password' }, null], message: 'Please check your details and try again.' },
  { name: 'empty validation response', detail: [], message: 'Please check your details and try again.' },
  { name: 'duplicate account', status: 409, detail: 'An account with this email already exists', message: 'An account with this email already exists' },
  { name: 'incorrect credentials', status: 401, detail: 'Invalid email or password', message: 'Invalid email or password' },
  { name: 'structured conflict', status: 409, detail: { code: 'schedule_conflict', message: 'The schedule has changed.' }, message: 'The schedule has changed.' },
]) {
  test(`API displays a specific safe message for ${name}`, async () => {
    const payload = { detail };
    const api = loadSource('lib/api.ts', {}, {
      Headers: globalThis.Headers,
      fetch: async () => new globalThis.Response(JSON.stringify(payload), { status }),
    });
    await assert.rejects(api.apiRequest('/auth/register', { auth: false, method: 'POST', body: '{}' }), (error) => {
      assert.ok(error instanceof api.ApiError);
      assert.equal(error.status, status);
      assert.equal(error.message, message);
      assert.equal(error.message.includes('private-password'), false);
      assert.equal(JSON.stringify(error.details), JSON.stringify(payload));
      return true;
    });
  });
}

function apiSessionHarness(fetchPage) {
  const values = new Map([
    ['chrono_access_token', 'token-a'],
    ['chrono.auth.currentUser', JSON.stringify(user)],
  ]);
  const localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const globals = {
    localStorage,
    window: { localStorage },
    Headers: globalThis.Headers,
    fetch: (url, init) =>
      url.endsWith('/auth/me')
        ? Promise.resolve(new globalThis.Response(JSON.stringify(user)))
        : fetchPage(url, init),
  };
  const api = loadSource('lib/api.ts', {}, globals);
  const auth = loadSource('lib/auth.ts', { './api': api, './settings': {} }, globals);
  const { createCurrentUserSession: createSession } = loadSource('lib/auth-session.ts', {
    './api': api,
  });
  let redirects = 0;
  const session = createSession({
    getSessionKey: api.getSessionKey,
    getCurrentUser: auth.getCurrentUser,
    clearSession: auth.clearSession,
    subscribeToUnauthorized: api.onUnauthorized,
    onUnauthenticated: () => {
      redirects += 1;
    },
  });
  return { api, session, values, redirects: () => redirects };
}

test('parallel protected-page 401s clear the session and redirect only once', async () => {
  const h = apiSessionHarness(
    async () =>
      new globalThis.Response(JSON.stringify({ detail: 'Could not validate credentials' }), {
        status: 401,
      }),
  );
  await h.session.start();
  assert.equal(h.session.getSnapshot().status, 'authenticated');
  const results = await Promise.allSettled([
    h.api.apiRequest('/tasks'),
    h.api.apiRequest('/notifications'),
  ]);
  assert.ok(results.every((result) => result.status === 'rejected'));
  assert.equal(h.session.getSnapshot().status, 'unauthenticated');
  assert.equal(h.session.getSnapshot().user, null);
  assert.equal(h.values.has('chrono_access_token'), false);
  assert.equal(h.values.has('chrono.auth.currentUser'), false);
  assert.equal(h.redirects(), 1);
  h.session.dispose();
});

for (const status of [403, 500, 503, 'network']) {
  test(`protected-page ${status} does not log out a verified session`, async () => {
    const h = apiSessionHarness(async () => {
      if (status === 'network') throw new TypeError('Network failure');
      return new globalThis.Response('{}', { status });
    });
    await h.session.start();
    await assert.rejects(h.api.apiRequest('/tasks'));
    assert.equal(h.session.getSnapshot().status, 'authenticated');
    assert.equal(h.values.has('chrono_access_token'), false);
    assert.equal(h.redirects(), 0);
    h.session.dispose();
  });
}

for (const scenario of ['public login', 'new token', 'aborted request', 'disposed provider']) {
  test(`${scenario}: a 401 cannot invalidate the current session`, async () => {
    const response = deferred();
    const h = apiSessionHarness(() => response.promise);
    await h.session.start();
    const controller = new globalThis.AbortController();
    const pending = h.api.apiRequest(scenario === 'public login' ? '/auth/login' : '/tasks', {
      auth: scenario !== 'public login',
      signal: controller.signal,
    });
    if (scenario === 'new token') h.api.rotateSessionKey();
    if (scenario === 'aborted request') controller.abort();
    if (scenario === 'disposed provider') h.session.dispose();
    response.resolve(new globalThis.Response('{}', { status: 401 }));
    await assert.rejects(pending);
    assert.equal(h.redirects(), 0);
    assert.equal(h.values.has('chrono_access_token'), false);
    h.session.dispose();
  });
}

test('unauthorized subscription survives Strict Mode dispose/restart', async () => {
  const h = apiSessionHarness(async () => new globalThis.Response('{}', { status: 401 }));
  await h.session.start();
  h.session.dispose();
  await h.session.start();
  await assert.rejects(h.api.apiRequest('/calendar'));
  assert.equal(h.session.getSnapshot().status, 'unauthenticated');
  assert.equal(h.redirects(), 1);
  h.session.dispose();
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function harness(getCurrentUser = async () => user, onVerified, endSession) {
  let token = 'token-a';
  let clears = 0;
  let redirects = 0;
  const session = createCurrentUserSession({
    getSessionKey: () => token,
    getCurrentUser,
    clearSession: () => {
      token = null;
      clears += 1;
    },
    onUnauthenticated: () => {
      redirects += 1;
    },
    onVerified,
    endSession,
  });
  return {
    session,
    setToken: (value) => {
      token = value;
    },
    token: () => token,
    clears: () => clears,
    redirects: () => redirects,
  };
}

test('sign-out waits for server cookie deletion before redirecting', async () => {
  const ended = deferred();
  const h = harness(async () => user, undefined, () => ended.promise);
  await h.session.start();
  const pending = h.session.signOut();
  assert.equal(h.session.getSnapshot().status, 'checking');
  assert.equal(h.redirects(), 0);
  ended.resolve();
  await pending;
  assert.equal(h.session.getSnapshot().status, 'unauthenticated');
  assert.equal(h.redirects(), 1);
});

test('failed cookie deletion reports a retryable failure instead of claiming logout succeeded', async () => {
  const h = harness(async () => user, undefined, async () => { throw new Error('Offline'); });
  await h.session.start();
  await h.session.signOut();
  assert.equal(h.session.getSnapshot().status, 'unavailable');
  assert.match(h.session.getSnapshot().error, /Unable to sign out/);
  assert.equal(h.redirects(), 0);
  assert.equal(h.clears(), 0);
});

test('browser login uses the same-origin proxy and stores no credentials or profile data', async () => {
  const values = new Map([
    ['chrono_access_token', 'legacy-secret'], ['access_token', 'older-secret'],
    ['chrono.auth.currentUser', JSON.stringify(user)],
  ]);
  const localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const calls = [];
  const globals = {
    window: { localStorage }, Headers: globalThis.Headers,
    fetch: async (url, init) => {
      calls.push({ url, ...init });
      if (url.endsWith('/auth/logout')) return new globalThis.Response(null, { status: 204 });
      return new globalThis.Response(JSON.stringify(url.endsWith('/auth/login') ? { authenticated: true } : user));
    },
  };
  const api = loadSource('lib/api.ts', {}, globals);
  const auth = loadSource('lib/auth.ts', { './api': api, './settings': {} }, globals);
  await auth.loginUser('test@example.com', 'password');
  await auth.getCurrentUser();
  await api.apiRequest('/tasks', { method: 'PATCH', headers: { Authorization: 'Bearer legacy-secret' }, body: '{}' });
  assert.deepEqual(calls.map((call) => call.url), ['/api/auth/login', '/api/auth/me', '/api/tasks']);
  for (const call of calls) {
    assert.equal(call.headers.has('authorization'), false);
    assert.equal(call.credentials, 'same-origin');
    assert.equal(call.cache, 'no-store');
    assert.equal(call.headers.has('x-chrono-csrf'), call.method !== 'GET');
  }
  assert.deepEqual([...values.keys()], ['chrono_session_version']);
  assert.equal(auth.getCachedCurrentUser().id, user.id);
  await auth.logout();
  assert.equal(calls.at(-1).url, '/api/auth/logout');
  assert.equal(auth.getCachedCurrentUser(), null);
});

test('cookie session verification works when localStorage is blocked and no visible token exists', async () => {
  const globals = {
    window: { get localStorage() { throw new Error('Storage disabled'); } },
    Headers: globalThis.Headers,
    fetch: async (url) => {
      assert.equal(url, '/api/auth/me');
      return new globalThis.Response(JSON.stringify(user));
    },
  };
  const api = loadSource('lib/api.ts', {}, globals);
  const auth = loadSource('lib/auth.ts', { './api': api, './settings': {} }, globals);
  assert.equal((await auth.getCurrentUser()).id, user.id);
});

for (const status of [0, 403, 500, 503]) {
  for (const phase of ['initial check', 'refresh']) {
    test(`${phase}: HTTP/transport ${status} keeps credentials and blocks unverified content`, async () => {
      let fail = phase === 'initial check';
      const h = harness(async () => {
        if (fail) throw new ApiError('Temporary failure', status);
        return user;
      });
      await h.session.start();
      if (!fail) {
        fail = true;
        await h.session.refresh();
      }
      assert.equal(h.session.getSnapshot().status, 'unavailable');
      assert.equal(h.token(), 'token-a');
      assert.equal(h.clears(), 0);
      assert.equal(h.redirects(), 0);
      h.session.dispose();
    });
  }
}

for (const error of [
  new TypeError('Network failure'),
  new SyntaxError('Invalid JSON'),
  new globalThis.DOMException('Cancelled', 'AbortError'),
]) {
  test(`${error.name} is recoverable, not an invalid session`, async () => {
    const h = harness(async () => {
      throw error;
    });
    await h.session.start();
    assert.equal(h.session.getSnapshot().status, 'unavailable');
    assert.equal(h.token(), 'token-a');
    assert.equal(h.redirects(), 0);
    h.session.dispose();
  });
}

for (const phase of ['initial check', 'refresh']) {
  test(`${phase}: 401 clears credentials and redirects`, async () => {
    let fail = phase === 'initial check';
    const h = harness(async () => {
      if (fail) throw new ApiError('Invalid credentials', 401);
      return user;
    });
    await h.session.start();
    if (!fail) {
      fail = true;
      await h.session.refresh();
    }
    assert.equal(h.session.getSnapshot().status, 'unauthenticated');
    assert.equal(h.session.getSnapshot().user, null);
    assert.equal(h.token(), null);
    assert.equal(h.redirects(), 1);
    h.session.dispose();
  });
}

test('missing token redirects without a profile request', async () => {
  let calls = 0;
  const h = harness(async () => {
    calls += 1;
    return user;
  });
  h.setToken(null);
  await h.session.start();
  assert.equal(calls, 0);
  assert.equal(h.session.getSnapshot().status, 'unauthenticated');
  assert.equal(h.redirects(), 1);
});

test('retry verifies the user with the retained token', async () => {
  let fail = true;
  const h = harness(async () => {
    if (fail) throw new ApiError('Unavailable', 503);
    return user;
  });
  await h.session.start();
  assert.equal(h.session.getSnapshot().status, 'unavailable');
  fail = false;
  assert.equal(await h.session.refresh(), user);
  assert.equal(h.session.getSnapshot().status, 'authenticated');
  assert.equal(h.session.getSnapshot().error, null);
  assert.equal(h.clears(), 0);
  h.session.dispose();
});

for (const outcome of ['reject', 'resolve']) {
  test(`older ${outcome} cannot replace a newer verified request`, async () => {
    const old = deferred();
    let calls = 0;
    let oldSignal;
    const h = harness((signal) => {
      calls += 1;
      if (calls === 1) {
        oldSignal = signal;
        return old.promise;
      }
      return Promise.resolve(user);
    });
    const pending = h.session.start();
    await h.session.refresh();
    assert.equal(oldSignal.aborted, true);
    if (outcome === 'reject') old.reject(new ApiError('Old 401', 401));
    else old.resolve({ ...user, first_name: 'Stale' });
    await pending;
    assert.equal(h.session.getSnapshot().user, user);
    assert.equal(h.session.getSnapshot().status, 'authenticated');
    assert.equal(h.clears(), 0);
    h.session.dispose();
  });
}

for (const action of ['signOut', 'dispose', 'token change']) {
  test(`${action} makes an in-flight success stale`, async () => {
    const pendingUser = deferred();
    const h = harness(() => pendingUser.promise);
    const pending = h.session.start();
    if (action === 'token change') h.setToken('token-b');
    else h.session[action]();
    pendingUser.resolve(user);
    assert.equal(await pending, null);
    assert.notEqual(h.session.getSnapshot().status, 'authenticated');
    if (action === 'signOut') assert.equal(h.token(), null);
  });
}

test('dispose/restart supports Strict Mode without stale failure logout', async () => {
  const old = deferred();
  let calls = 0;
  const h = harness(() => (++calls === 1 ? old.promise : Promise.resolve(user)));
  const pending = h.session.start();
  h.session.dispose();
  await h.session.start();
  old.reject(new ApiError('Old 401', 401));
  await pending;
  assert.equal(h.session.getSnapshot().status, 'authenticated');
  assert.equal(h.clears(), 0);
  h.session.dispose();
});

test('avatar update keeps identity, and late update cannot undo sign-out', async () => {
  const h = harness();
  await h.session.start();
  h.session.setUser({ ...user, avatar_url: '/photo.png' });
  assert.equal(h.session.getSnapshot().user.avatar_url, '/photo.png');
  h.session.setUser({ ...user, id: 'other-user' });
  assert.equal(h.session.getSnapshot().user.id, user.id);
  h.session.signOut();
  h.session.setUser(user);
  assert.equal(h.session.getSnapshot().status, 'unauthenticated');
  assert.equal(h.session.getSnapshot().user, null);
});

test('timezone synchronization failure does not invalidate verified auth', async () => {
  const h = harness(
    async () => user,
    async () => {
      throw new ApiError('Timezone unavailable', 500);
    },
  );
  await h.session.start();
  await Promise.resolve();
  assert.equal(h.session.getSnapshot().status, 'authenticated');
  assert.equal(h.clears(), 0);
  h.session.dispose();
});

for (const action of ['none', 'signOut', 'abort', 'token change']) {
  test(`profile cache ignores stale success after ${action}`, async () => {
    const values = new Map([['chrono_access_token', 'token-a']]);
    const localStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
    const response = deferred();
    const controller = new globalThis.AbortController();
    const api = loadSource(
      'lib/api.ts',
      {},
      {
        localStorage,
        window: { localStorage },
        Headers: globalThis.Headers,
        fetch: async (_url, init) => {
          assert.equal(init.signal, controller.signal);
          return response.promise;
        },
      },
    );
    const auth = loadSource(
      'lib/auth.ts',
      { './api': api, './settings': {} },
      {
        localStorage,
        window: { localStorage },
      },
    );
    const pending = auth.getCurrentUser({ signal: controller.signal });
    if (action === 'signOut') auth.clearSession();
    if (action === 'abort') controller.abort();
    if (action === 'token change') api.rotateSessionKey();
    response.resolve(new globalThis.Response(JSON.stringify(user)));
    await pending;
    assert.equal(auth.getCachedCurrentUser()?.id === user.id, action === 'none');
    assert.equal(values.has('chrono.auth.currentUser'), false);
  });
}

for (const operation of ['uploadCurrentUserAvatar', 'deleteCurrentUserAvatar']) {
  for (const action of ['none', 'signOut', 'token change']) {
    test(`${operation} cache cannot overwrite a ${action} session`, async () => {
      const values = new Map([['chrono_access_token', 'token-a']]);
      const localStorage = {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
      };
      const response = deferred();
      const globals = {
        localStorage,
        window: { localStorage },
        Headers: globalThis.Headers,
        FormData: globalThis.FormData,
        fetch: async () => response.promise,
      };
      const api = loadSource('lib/api.ts', {}, globals);
      const auth = loadSource('lib/auth.ts', { './api': api, './settings': {} }, globals);
      const pending = auth[operation](new globalThis.Blob(['synthetic avatar']));
      if (action === 'signOut') auth.clearSession();
      if (action === 'token change') api.rotateSessionKey();
      response.resolve(new globalThis.Response(JSON.stringify(user)));
      await pending;
      assert.equal(auth.getCachedCurrentUser()?.id === user.id, action === 'none');
      assert.equal(values.has('chrono.auth.currentUser'), false);
    });
  }
}
