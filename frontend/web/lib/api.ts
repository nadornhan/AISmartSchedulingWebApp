const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

const ACCESS_TOKEN_KEY = 'chrono_access_token';

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

export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY) ?? localStorage.getItem('access_token');
}

export function setAccessToken(token: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem('access_token');
}

export function getApiUrl(path: string) {
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiRequest<T>(path: string, init: ApiRequestOptions = {}): Promise<T> {
  const { auth = true, ...requestInit } = init;
  const token = getAccessToken();
  const headers = new Headers(requestInit.headers);

  const isFormData = typeof FormData !== 'undefined' && requestInit.body instanceof FormData;

  if (requestInit.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (auth && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(getApiUrl(path), {
    ...requestInit,
    headers,
  });

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

  const detailMessage =
    details &&
    typeof details === 'object' &&
    'detail' in details &&
    typeof details.detail === 'string'
      ? details.detail
      : null;

  throw new ApiError(
    detailMessage ?? `Request failed with status ${response.status}`,
    response.status,
    details,
  );
}
