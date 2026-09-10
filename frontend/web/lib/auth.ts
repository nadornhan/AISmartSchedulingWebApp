import { apiRequest, clearAccessToken, getAccessToken, setAccessToken } from './api';

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

export type TokenResponse = {
  access_token: string;
  token_type: 'bearer';
};

const CURRENT_USER_KEY = 'chrono.auth.currentUser';

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
    }),
  });
}

/**
 * Sign in and save the access token using the shared token manager.
 */
export async function loginUser(email: string, password: string): Promise<TokenResponse> {
  const token = await apiRequest<TokenResponse>('/auth/login', {
    auth: false,
    method: 'POST',
    body: JSON.stringify({
      email: email.trim(),
      password,
    }),
  });

  setAccessToken(token.access_token);

  return token;
}

/**
 * Retrieve the signed-in user's profile.
 */
export async function getCurrentUser(): Promise<UserResponse> {
  const accessToken = getAccessToken();

  if (!accessToken) {
    throw new Error('No active session.');
  }

  const user = await apiRequest<UserResponse>('/auth/me', {
    method: 'GET',
  });

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  }

  return user;
}

/**
 * Upload a new avatar for the signed-in user.
 */
export async function uploadCurrentUserAvatar(file: File): Promise<UserResponse> {
  const formData = new FormData();
  formData.set('avatar', file);

  const user = await apiRequest<UserResponse>('/auth/me/avatar', {
    method: 'POST',
    body: formData,
  });

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  }

  return user;
}

/**
 * Remove the signed-in user's avatar so UI falls back to initials.
 */
export async function deleteCurrentUserAvatar(): Promise<UserResponse> {
  const user = await apiRequest<UserResponse>('/auth/me/avatar', {
    method: 'DELETE',
  });

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  }

  return user;
}

/**
 * Read the last cached user without making an API request.
 */
export function getCachedCurrentUser(): UserResponse | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedUser = window.localStorage.getItem(CURRENT_USER_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser) as UserResponse;
  } catch {
    window.localStorage.removeItem(CURRENT_USER_KEY);
    return null;
  }
}

/**
 * Clear the access token and cached user.
 */
export function clearSession(): void {
  clearAccessToken();

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(CURRENT_USER_KEY);
  }
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
export function logout(): void {
  clearSession();
}
