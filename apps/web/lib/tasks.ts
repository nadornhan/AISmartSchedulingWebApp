import type { Task, TaskInput, TaskStatus } from '@todo-list/shared';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
};

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function apiRequest<T>(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `API request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function listTasks(token: string) {
  const rows = await apiRequest<TaskRow[]>('/tasks', token);
  return rows.map(toTask);
}

export async function createTask(token: string, input: TaskInput) {
  const row = await apiRequest<TaskRow>('/tasks', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  return toTask(row);
}

export async function updateTask(
  token: string,
  taskId: string,
  input: Partial<TaskInput> & { status?: TaskStatus },
) {
  const row = await apiRequest<TaskRow>(`/tasks/${taskId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

  return toTask(row);
}

export async function deleteTask(token: string, taskId: string) {
  await apiRequest<void>(`/tasks/${taskId}`, token, {
    method: 'DELETE',
  });
}
