// Authors (Git history): Truong Ha Anh Minh
// Server-only session boundary and upstream request forwarding. See AUTHORS.md and docs/AUTHORSHIP.json.
import { NextResponse } from 'next/server';

// Only this server module handles bearer tokens. Browser JavaScript never receives them.
const secureCookies = process.env.NODE_ENV === 'production';
export const SESSION_COOKIE = secureCookies ? '__Host-chrono_session' : 'chrono_session';
const roots = new Set([
  'auth',
  'tasks',
  'projects',
  'folders',
  'notifications',
  'settings',
  'analytics',
  'ai',
  'scheduling',
  'focus',
  'dashboard',
  'gamification',
  'media',
]);
const safeMethods = new Set(['GET', 'HEAD']);
const MAX_BODY_BYTES = 4 * 1024 * 1024;

class RequestTooLarge extends Error {}

async function readBody(request: Request): Promise<ArrayBuffer | undefined> {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) throw new RequestTooLarge();
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RequestTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { detail: message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

function sessionCookie(request: Request) {
  return request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
}

export async function proxyApiRequest(request: Request, path: string[]): Promise<Response> {
  // Never allow a path or browser-supplied URL to change the upstream destination.
  if (!roots.has(path[0]) || path.some((part) => !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(part))) {
    return jsonError('Unknown API route', 404);
  }
  const route = path.join('/');
  const publicAuth = route === 'auth/login' || route === 'auth/register';
  const logout = route === 'auth/logout';
  if ((publicAuth || logout) && request.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  // SameSite cookies plus an exact Origin check and a custom request header prevent
  // cross-site forms/fetches from logging in, logging out, or modifying user data.
  const url = new URL(request.url);
  if (
    request.headers.get('sec-fetch-site') === 'cross-site' ||
    (!safeMethods.has(request.method) &&
      (request.headers.get('origin') !== url.origin ||
        request.headers.get('x-chrono-csrf') !== '1'))
  ) {
    return jsonError('Cross-site request rejected', 403);
  }

  if (logout) {
    const response = new NextResponse(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store' },
    });
    response.cookies.set(SESSION_COOKIE, '', {
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  }

  const token = sessionCookie(request);
  const publicMedia = path[0] === 'media' && safeMethods.has(request.method);
  if (!publicAuth && !publicMedia && !token) return jsonError('Not authenticated', 401);

  try {
    const base = new URL(
      process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000',
    );
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
      return jsonError('API is not configured correctly', 503);
    }
    base.pathname = `${base.pathname.replace(/\/$/, '')}/${route}`;
    base.search = url.search;
    base.hash = '';
    const headers = new Headers({ Accept: request.headers.get('accept') ?? 'application/json' });
    const contentType = request.headers.get('content-type');
    if (contentType) headers.set('Content-Type', contentType);
    if (token && !publicAuth && !publicMedia) headers.set('Authorization', `Bearer ${token}`);

    const body = safeMethods.has(request.method) ? undefined : await readBody(request);
    const upstream = await fetch(base, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]),
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      return jsonError('Unexpected API redirect', 502);
    }

    if (route === 'auth/login' && upstream.ok) {
      const data = await upstream.json();
      if (typeof data.access_token !== 'string' || !/^[a-zA-Z0-9_.-]+$/.test(data.access_token)) {
        return jsonError('Invalid authentication response', 502);
      }
      // The token came from the configured API; the API still verifies its signature
      // on every protected request. Read exp only to match the cookie's lifetime.
      const claims = JSON.parse(
        Buffer.from(data.access_token.split('.')[1], 'base64url').toString(),
      );
      const maxAge = Math.floor(claims.exp - Date.now() / 1000);
      if (!Number.isFinite(maxAge) || maxAge <= 0)
        return jsonError('Expired authentication response', 502);
      const response = NextResponse.json(
        { authenticated: true },
        { headers: { 'Cache-Control': 'no-store' } },
      );
      response.cookies.set(SESSION_COOKIE, data.access_token, {
        httpOnly: true,
        secure: secureCookies,
        sameSite: 'lax',
        path: '/',
        maxAge,
      });
      return response;
    }

    // Do not forward upstream cookies, CORS headers, or cacheable private responses.
    const responseHeaders = new Headers({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Cookie',
    });
    if (upstream.headers.has('content-type'))
      responseHeaders.set('Content-Type', upstream.headers.get('content-type')!);
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    if (error instanceof RequestTooLarge) return jsonError('Request is too large', 413);
    return jsonError('Unable to reach the API. Please try again.', 502);
  }
}
