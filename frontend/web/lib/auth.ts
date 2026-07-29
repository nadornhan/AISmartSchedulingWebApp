import { apiRequest, clearAccessToken, setAccessToken } from './api';

export type User = {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type TokenResponse = {
  access_token: string;
  token_type: 'bearer';
};

export async function register(email: string, password: string) {
  return apiRequest<User>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string) {
  const response = await apiRequest<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAccessToken(response.access_token);
  return response;
}

export function getCurrentUser() {
  return apiRequest<User>('/auth/me');
}

export function logout() {
  clearAccessToken();
}
