import {
  apiRequest,
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from './api';

export type UserRole = 'student' | 'teacher' | 'other';

export type RegisterUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
};

export type UserResponse = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
};

export type User = {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: 'bearer';
};

type ApiErrorResponse = {
  detail?: string;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

const CURRENT_USER_KEY = 'chrono.auth.currentUser';

async function parseApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return body.detail ?? 'Something went wrong.';
  } catch {
    return 'Something went wrong.';
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json() as Promise<T>;
}

/**
 * Register a user with their complete profile information.
 */
export async function registerUser(
  input: RegisterUserInput,
): Promise<UserResponse> {
  return request<UserResponse>('/auth/register', {
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
export async function loginUser(
  email: string,
  password: string,
): Promise<TokenResponse> {
  const token = await request<TokenResponse>('/auth/login', {
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

  const user = await request<UserResponse>('/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      CURRENT_USER_KEY,
      JSON.stringify(user),
    );
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
export async function registerAndSignIn(
  input: RegisterUserInput,
): Promise<UserResponse> {
  await registerUser(input);
  await loginUser(input.email, input.password);

  return getCurrentUser();
}

/**
 * Compatibility function for existing components using register().
 */
export async function register(
  email: string,
  password: string,
): Promise<User> {
  return apiRequest<User>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: email.trim(),
      password,
    }),
  });
}

/**
 * Compatibility function for existing components using login().
 */
export async function login(
  email: string,
  password: string,
): Promise<TokenResponse> {
  const response = await apiRequest<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: email.trim(),
      password,
    }),
  });

  setAccessToken(response.access_token);

  return response;
}

/**
 * Sign out and clear all locally stored session information.
 */
export function logout(): void {
  clearSession();
}
