import { clearReadCache } from './read-cache';

const SESSION_VERSION_KEY = 'chrono_session_version';
let sessionRevision = 0;

type UnauthorizedListener = (sessionKey: string, message: string) => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onUnauthorized(listener: UnauthorizedListener) {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

export type ApiRequestOptions = RequestInit & {
  auth?: boolean;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function validationMessage(issue: unknown): string | null {
  if (!issue || typeof issue !== 'object' || !('loc' in issue) || !Array.isArray(issue.loc)) return null;
  const field = issue.loc.at(-1);
  if (typeof field !== 'string' || ['body', 'query', 'path'].includes(field)) return null;
  const labels: Record<string, string> = {
    email: 'Email', password: 'Password', first_name: 'First name', last_name: 'Last name',
    timezone: 'Time zone', role: 'Account type',
  };
  const label = Object.hasOwn(labels, field) ? labels[field]
    : field.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
  const type = 'type' in issue ? issue.type : null;
  if (type === 'missing') return `${label} is required.`;
  if (field === 'email') return 'Please enter a valid email address.';

  const context = 'ctx' in issue && issue.ctx && typeof issue.ctx === 'object' ? issue.ctx : null;
  if (type === 'string_too_short' && context && 'min_length' in context && typeof context.min_length === 'number') {
    return `${label} must be at least ${context.min_length} characters.`;
  }
  if (type === 'string_too_long' && context && 'max_length' in context && typeof context.max_length === 'number') {
    return `${label} must be at most ${context.max_length} characters.`;
  }
  if (field === 'password') return 'Please enter a valid password.';
  if (field === 'timezone') return 'Your device’s time zone could not be validated. Please check its time zone settings.';
  if ('msg' in issue && typeof issue.msg === 'string' && issue.msg.trim()) {
    return `${label}: ${issue.msg.replace(/^Value error,\s*/i, '')}`;
  }
  return `Please check ${label.toLowerCase()}.`;
}

function apiErrorMessage(details: unknown, status: number): string {
  if (details && typeof details === 'object' && 'detail' in details) {
    const detail = details.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      const messages = [...new Set(detail.map(validationMessage).filter((message) => message !== null))];
      if (messages.length) return messages.slice(0, 3).join(' ');
    }
    if (detail && typeof detail === 'object' && 'message' in detail && typeof detail.message === 'string' && detail.message.trim()) {
      return detail.message;
    }
  }
  return status === 422 ? 'Please check your details and try again.' : `Request failed with status ${status}`;
}

function removeLegacyCredentials() {
  if (typeof window === 'undefined') return;
  try {
    for (const key of ['chrono_access_token', 'access_token', 'chrono.auth.currentUser']) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Cookie authentication also works when browser storage is unavailable.
  }
}

// A non-secret cache generation, never an authentication credential. Cookies
// cannot be inspected by JS, so /auth/me always verifies the actual session.
export function getSessionKey(): string {
  removeLegacyCredentials();
  try {
    return `${window.localStorage.getItem(SESSION_VERSION_KEY) ?? 'initial'}:${sessionRevision}`;
  } catch {
    return `initial:${sessionRevision}`;
  }
}

export function clearClientSession() {
  sessionRevision += 1;
  removeLegacyCredentials();
  clearReadCache();
}

export function rotateSessionKey() {
  clearClientSession();
  try {
    // Notify other tabs without placing credentials or profile data in storage.
    window.localStorage.setItem(SESSION_VERSION_KEY, `${Date.now()}-${Math.random()}`);
  } catch {
    // A local generation still invalidates requests and cached data in this tab.
  }
}

export function getApiUrl(path: string) {
  return `/api${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiRequest<T>(path: string, init: ApiRequestOptions = {}): Promise<T> {
  const { auth = true, ...requestInit } = init;
  const sessionKey = getSessionKey();
  const headers = new Headers(requestInit.headers);

  const isFormData = typeof FormData !== 'undefined' && requestInit.body instanceof FormData;

  if (requestInit.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  headers.delete('Authorization');
  if (!['GET', 'HEAD'].includes((requestInit.method ?? 'GET').toUpperCase())) headers.set('X-Chrono-CSRF', '1');

  let response: Response;

  try {
    response = await fetch(getApiUrl(path), {
      ...requestInit,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }

    throw new ApiError(
      'Cannot reach the API. Please try again.',
      0,
    );
  }

  if (response.ok) {
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  let details: unknown;
  try {
    details = await response.json();
  } catch {
    details = null;
  }

  const message = apiErrorMessage(details, response.status);

  // An older request must not invalidate a newer login, or an aborted session check.
  if (
    response.status === 401 &&
    auth &&
    !requestInit.signal?.aborted &&
    getSessionKey() === sessionKey
  ) {
    unauthorizedListeners.forEach((listener) => listener(sessionKey, message));
  }

  throw new ApiError(message, response.status, details);
}
