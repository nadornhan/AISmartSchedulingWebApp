const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'overdue';
export type TaskPriority = 'no_priority' | 'low' | 'medium' | 'high';
export type TaskSortBy = 'created_at' | 'updated_at' | 'title' | 'due_date' | 'priority';
export type SortOrder = 'asc' | 'desc';

export type TaskProject = {
  id: string;
  name: string;
  color: string;
};

export type Task = {
  id: string;
  user_id: string;
  project_id: string | null;
  project: TaskProject | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  estimated_duration: number | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskListResponse = {
  items: Task[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type TaskQuery = {
  search?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  inbox?: boolean;
  dueFrom?: string;
  dueTo?: string;
  sortBy?: TaskSortBy;
  sortOrder?: SortOrder;
  page?: number;
  pageSize?: number;
};

export type UpdateTaskInput = {
  title?: string;
  description?: string | null;
  status?: Exclude<TaskStatus, 'overdue'>;
  priority?: TaskPriority;
  project_id?: string | null;
  due_date?: string | null;
};

type RequestOptions = {
  accessToken: string;
  signal?: AbortSignal;
};

export class TaskApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'TaskApiError';
    this.status = status;
  }
}

function authHeaders(accessToken: string, hasBody = false): HeadersInit {
  return {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${accessToken}`,
  };
}

async function requireOk(response: Response): Promise<void> {
  if (response.ok) return;

  let message = 'Task request failed';
  try {
    const body = (await response.json()) as { detail?: string };
    if (body.detail) message = body.detail;
  } catch {
    // Keep the fallback message for non-JSON errors.
  }
  throw new TaskApiError(message, response.status);
}

export async function getTasks(
  query: TaskQuery,
  { accessToken, signal }: RequestOptions,
): Promise<TaskListResponse> {
  const params = new URLSearchParams();
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.status) params.set('status', query.status);
  if (query.priority) params.set('priority', query.priority);
  if (query.projectId) params.set('project_id', query.projectId);
  if (query.dueFrom) params.set('due_from', query.dueFrom);
  if (query.dueTo) params.set('due_to', query.dueTo);
  if (query.sortBy) params.set('sort_by', query.sortBy);
  if (query.sortOrder) params.set('sort_order', query.sortOrder);
  params.set('page', String(query.page ?? 1));
  params.set('page_size', String(query.inbox ? 100 : (query.pageSize ?? 20)));

  const response = await fetch(`${API_URL}/tasks?${params.toString()}`, {
    headers: authHeaders(accessToken),
    signal,
  });
  await requireOk(response);
  const result = (await response.json()) as TaskListResponse;

  if (!query.inbox) return result;

  const inboxItems = result.items.filter((task) => task.project_id === null);
  return {
    ...result,
    items: inboxItems,
    total: inboxItems.length,
    total_pages: inboxItems.length > 0 ? 1 : 0,
  };
}

export async function updateTask(
  taskId: string,
  input: UpdateTaskInput,
  { accessToken, signal }: RequestOptions,
): Promise<Task> {
  const response = await fetch(`${API_URL}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: authHeaders(accessToken, true),
    body: JSON.stringify(input),
    signal,
  });
  await requireOk(response);
  return (await response.json()) as Task;
}

export async function deleteTask(
  taskId: string,
  { accessToken, signal }: RequestOptions,
): Promise<void> {
  const response = await fetch(`${API_URL}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
    signal,
  });
  await requireOk(response);
}
