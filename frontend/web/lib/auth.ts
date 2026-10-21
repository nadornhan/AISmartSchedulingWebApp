import { apiRequest, clearClientSession, getSessionKey, rotateSessionKey } from './api';
import { getBrowserTimezone } from './settings';

export type UserRole = 'student' | 'teacher' | 'other' | 'admin';
export type RegistrationRole = Exclude<UserRole, 'admin'>;

export type RegisterUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: RegistrationRole;
};

export type UserResponse = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

let cachedUser: { user: UserResponse; sessionKey: string } | null = null;

function cacheCurrentUser(user: UserResponse, sessionKey: string, signal?: AbortSignal) {
  if (!signal?.aborted && getSessionKey() === sessionKey) {
    cachedUser = { user, sessionKey };
  }
}

/**
 * Register a user with their complete profile information.
 */
export async function registerUser(input: RegisterUserInput): Promise<UserResponse> {
  return apiRequest<UserResponse>('/auth/register', {
    auth: false,
    method: 'POST',
    body: JSON.stringify({
      email: input.email.trim(),
      password: input.password,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      role: input.role,
      timezone: getBrowserTimezone(),
    }),
  });
}

/**
 * Sign in through the server route, which sets an HttpOnly session cookie.
 */
export async function loginUser(email: string, password: string): Promise<void> {
  await apiRequest<{ authenticated: boolean }>('/auth/login', {
    auth: false,
    method: 'POST',
    body: JSON.stringify({
      email: email.trim(),
      password,
    }),
  });

  cachedUser = null;
  rotateSessionKey();
}

/**
 * Retrieve the signed-in user's profile.
 */
export async function getCurrentUser(
  options: { signal?: AbortSignal } = {},
): Promise<UserResponse> {
  const sessionKey = getSessionKey();

  const user = await apiRequest<UserResponse>('/auth/me', {
    method: 'GET',
    signal: options.signal,
  });

  cacheCurrentUser(user, sessionKey, options.signal);

  return user;
}

export async function updateCurrentUserProfile(input: {
  firstName: string;
  lastName: string;
}): Promise<UserResponse> {
  const sessionKey = getSessionKey();
  const user = await apiRequest<UserResponse>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify({
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
    }),
  });

  cacheCurrentUser(user, sessionKey);
  return user;
}

/**
 * Upload a new avatar for the signed-in user.
 */
export async function uploadCurrentUserAvatar(file: File): Promise<UserResponse> {
  const sessionKey = getSessionKey();
  const formData = new FormData();
  formData.set('avatar', file);

  const user = await apiRequest<UserResponse>('/auth/me/avatar', {
    method: 'POST',
    body: formData,
  });

  cacheCurrentUser(user, sessionKey);

  return user;
}

/**
 * Remove the signed-in user's avatar so UI falls back to initials.
 */
export async function deleteCurrentUserAvatar(): Promise<UserResponse> {
  const sessionKey = getSessionKey();
  const user = await apiRequest<UserResponse>('/auth/me/avatar', {
    method: 'DELETE',
  });

  cacheCurrentUser(user, sessionKey);

  return user;
}

/**
 * Read the last cached user without making an API request.
 */
export function getCachedCurrentUser(): UserResponse | null {
  return cachedUser?.sessionKey === getSessionKey() ? cachedUser.user : null;
}

/**
 * Clear client state; only the server can remove the HttpOnly cookie.
 */
export function clearSession(): void {
  clearClientSession();
  cachedUser = null;
}

/**
 * Register, sign in, and return the new user's profile.
 */
export async function registerAndSignIn(input: RegisterUserInput): Promise<UserResponse> {
  await registerUser(input);
  await loginUser(input.email, input.password);

  return getCurrentUser();
}

/**
 * Sign out and clear all locally stored session information.
 */
export async function logout(): Promise<void> {
  await apiRequest<void>('/auth/logout', { method: 'POST', auth: false });
  rotateSessionKey();
  clearSession();
}
