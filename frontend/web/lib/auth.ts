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
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: 'bearer';
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const tokenKey = 'chrono.auth.accessToken';
const userKey = 'chrono.auth.currentUser';

async function parseApiError(response: Response) {
  try {
    const body = (await response.json()) as { detail?: string };
    return body.detail ?? 'Something went wrong.';
  } catch {
    return 'Something went wrong.';
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
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

export async function registerUser(input: RegisterUserInput): Promise<UserResponse> {
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

export async function loginUser(email: string, password: string): Promise<TokenResponse> {
  const token = await request<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: email.trim(),
      password,
    }),
  });

  window.localStorage.setItem(tokenKey, token.access_token);

  return token;
}

export async function getCurrentUser(): Promise<UserResponse> {
  const token = window.localStorage.getItem(tokenKey);

  if (!token) {
    throw new Error('No active session.');
  }

  const user = await request<UserResponse>('/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  window.localStorage.setItem(userKey, JSON.stringify(user));

  return user;
}

export function getCachedCurrentUser(): UserResponse | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedUser = window.localStorage.getItem(userKey);

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser) as UserResponse;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(tokenKey);
  window.localStorage.removeItem(userKey);
}

export async function registerAndSignIn(input: RegisterUserInput): Promise<UserResponse> {
  await registerUser(input);
  await loginUser(input.email, input.password);

  return getCurrentUser();
}
