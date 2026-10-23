import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { NextResponse } from 'next/server.js';
import ts from 'typescript';

const origin = 'https://chrono.example';
const jwt = (exp = Math.floor(Date.now() / 1000) + 1800) =>
  `header.${Buffer.from(JSON.stringify({ sub: 'user-a', exp })).toString('base64url')}.signature`;
const user = {
  id: 'user-a', email: 'user@example.com', first_name: 'Test', last_name: 'User', role: 'student',
  avatar_url: null, is_active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

function harness(fetchResponse, production = true) {
  const calls = [];
  const module = { exports: {} };
  const source = fs.readFileSync(new URL('../../lib/server/api-proxy.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module, exports: module.exports, URL, Headers, Response, Buffer, AbortSignal,
    process: { env: { NODE_ENV: production ? 'production' : 'development', API_URL: 'https://api.example' } },
    require: (name) => {
      assert.equal(name, 'next/server');
      return { NextResponse };
    },
    fetch: async (url, options) => {
      calls.push({ url: String(url), ...options });
      return fetchResponse ? fetchResponse(url, options) : Response.json({ ok: true });
    },
  });
  const { proxyApiRequest, SESSION_COOKIE } = module.exports;
  return {
    calls,
    cookie: SESSION_COOKIE,
    request: (path, { method = 'GET', headers = {}, cookie = jwt(), body } = {}) => {
      const requestHeaders = new Headers(headers);
      if (cookie) requestHeaders.set('cookie', `${SESSION_COOKIE}=${cookie}`);
      if (method !== 'GET' && method !== 'HEAD') {
        if (!requestHeaders.has('origin')) requestHeaders.set('origin', origin);
        if (!requestHeaders.has('x-chrono-csrf')) requestHeaders.set('x-chrono-csrf', '1');
      }
      return proxyApiRequest(new Request(`${origin}/api/${path.join('/')}`, {
        method, headers: requestHeaders, body,
      }), path);
    },
  };
}

for (const production of [true, false]) {
  test(`login creates an HttpOnly cookie, never returns a token (${production ? 'production' : 'development'})`, async () => {
    const token = jwt();
    const h = harness(() => Response.json({ access_token: token, token_type: 'bearer', user }), production);
    const response = await h.request(['auth', 'login'], { method: 'POST', body: '{"email":"user@example.com","password":"test"}' });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { authenticated: true, user });
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=lax/i);
    assert.match(cookie, /Path=\//i);
    assert.match(cookie, /Max-Age=1[78]\d\d/i);
    assert.equal(/; Secure/i.test(cookie), production);
    assert.equal(h.cookie.startsWith('__Host-'), production);
    assert.doesNotMatch(cookie, /Domain=/i);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(h.calls[0].headers.has('authorization'), false);
  });
}

test('protected requests use only the HttpOnly cookie as their bearer credential', async () => {
  const token = jwt();
  const h = harness();
  const response = await h.request(['tasks'], { cookie: token, headers: { Authorization: 'Bearer attacker', 'X-Forwarded-Host': 'evil.example' } });
  assert.equal(response.status, 200);
  assert.equal(h.calls[0].url, 'https://api.example/tasks');
  assert.equal(h.calls[0].headers.get('authorization'), `Bearer ${token}`);
  assert.equal(h.calls[0].headers.has('cookie'), false);
  assert.equal(h.calls[0].headers.has('x-forwarded-host'), false);
  assert.equal(h.calls[0].redirect, 'manual');
  assert.equal(h.calls[0].cache, 'no-store');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('missing cookies are rejected even when browser code supplies a bearer token', async () => {
  const h = harness();
  const response = await h.request(['tasks'], { cookie: null, headers: { Authorization: `Bearer ${jwt()}` } });
  assert.equal(response.status, 401);
  assert.equal(h.calls.length, 0);
});

for (const path of [['auth', 'login'], ['auth', 'register'], ['auth', 'logout'], ['tasks']]) {
  for (const headers of [
    { origin: 'https://evil.example' },
    { origin: 'null' },
    { origin: '' },
    { 'x-chrono-csrf': '' },
    { 'sec-fetch-site': 'cross-site' },
  ]) {
    test(`${path.join('/')}: forged/missing CSRF context ${JSON.stringify(headers)} is rejected`, async () => {
      const h = harness();
      const response = await h.request(path, { method: 'POST', headers });
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('set-cookie'), null);
      assert.equal(h.calls.length, 0);
    });
  }
}

test('logout expires the same host-only HttpOnly cookie without contacting the backend', async () => {
  const h = harness();
  const response = await h.request(['auth', 'logout'], { method: 'POST' });
  assert.equal(response.status, 204);
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie.startsWith(`${h.cookie}=`));
  assert.match(cookie, /Max-Age=0/i);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /; Secure/i);
  assert.equal(h.calls.length, 0);
});

for (const path of [['tasks', '..'], ['tasks', '%2e%2e'], ['tasks', 'x/y'], ['https:', 'evil.example'], ['unapproved']]) {
  test(`unsafe API path ${JSON.stringify(path)} is rejected before fetching`, async () => {
    const h = harness();
    assert.equal((await h.request(path)).status, 404);
    assert.equal(h.calls.length, 0);
  });
}

test('multipart avatar uploads and task JSON retain their bodies and content types', async () => {
  const h = harness();
  const body = '--test-boundary\r\navatar bytes';
  const response = await h.request(['auth', 'me', 'avatar'], {
    method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=test-boundary' }, body,
  });
  assert.equal(response.status, 200);
  assert.equal(new TextDecoder().decode(h.calls[0].body), body);
  assert.equal(h.calls[0].headers.get('content-type'), 'multipart/form-data; boundary=test-boundary');
});

test('oversized bodies are rejected without fetching the backend', async () => {
  const h = harness();
  const response = await h.request(['auth', 'login'], { method: 'POST', body: 'x'.repeat(4 * 1024 * 1024 + 1) });
  assert.equal(response.status, 413);
  assert.equal(h.calls.length, 0);
});

test('upstream redirects are not followed and upstream cookies are not forwarded', async () => {
  const redirected = harness(() => new Response(null, { status: 302, headers: { Location: 'https://evil.example' } }));
  assert.equal((await redirected.request(['tasks'])).status, 502);
  const cookies = harness(() => Response.json({}, { headers: { 'Set-Cookie': 'upstream=secret', 'Access-Control-Allow-Origin': '*' } }));
  const response = await cookies.request(['tasks']);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

for (const token of ['malformed', jwt(1)]) {
  test('malformed or expired login responses never set a cookie', async () => {
    const h = harness(() => Response.json({ access_token: token }));
    const response = await h.request(['auth', 'login'], { method: 'POST' });
    assert.equal(response.status, 502);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal((await response.text()).includes(token), false);
  });
}

test('login rejects a response without a public user profile and never sets a cookie', async () => {
  const h = harness(() => Response.json({ access_token: jwt() }));
  const response = await h.request(['auth', 'login'], { method: 'POST' });
  assert.equal(response.status, 502);
  assert.equal(response.headers.get('set-cookie'), null);
});

test('failed login preserves the current cookie; an old 401 cannot clear a newer login', async () => {
  const h = harness(() => Response.json({ detail: 'Invalid credentials' }, { status: 401 }));
  for (const path of [['auth', 'login'], ['tasks']]) {
    const response = await h.request(path, { method: path[0] === 'auth' ? 'POST' : 'GET' });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('set-cookie'), null);
  }
});

test('public avatars remain available through the same-origin media route', async () => {
  const h = harness(() => new Response('image bytes', { headers: { 'content-type': 'image/png' } }));
  const response = await h.request(['media', 'avatars', 'user.png'], { cookie: null });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.equal(h.calls[0].headers.has('authorization'), false);
});
