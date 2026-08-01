import { apiRequest } from './api';
import { emitTaskDataChanged } from './data-events';

export type TaskStatusValue = 'pending' | 'in_progress' | 'done';
export type TaskDisplayStatusValue = TaskStatusValue | 'overdue';
export type TaskPriorityValue = 'no_priority' | 'low' | 'medium' | 'high';
export type TaskSortValue = 'created_at' | 'updated_at' | 'title' | 'due_date' | 'priority';

// Compatibility aliases used by the folders/inbox feature.
export type TaskStatus = TaskDisplayStatusValue;
export type TaskPriority = TaskPriorityValue;
export type TaskSortBy = TaskSortValue;
export type SortOrder = 'asc' | 'desc';

export type TaskProjectSummary = {
  id: string;
  name: string;
  color: string;
};

export type TaskProject = TaskProjectSummary;

export type TaskResponse = {
  id: string;
  user_id: string;
  project_id: string | null;
  project: TaskProjectSummary | null;
  title: string;
  description: string | null;
  status: TaskDisplayStatusValue;
  priority: TaskPriorityValue;
  due_date: string | null;
  estimated_duration: number | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  created_at: string;
  updated_at: string;
};

export type Task = TaskResponse;

export type TaskListResponse = {
  items: TaskResponse[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

type TaskListApiResponse = TaskListResponse | TaskResponse[];

export type TaskListParams = {
  status?: TaskDisplayStatusValue;
  priority?: TaskPriorityValue;
  projectId?: string;
  search?: string;
  dueFrom?: string;
  dueTo?: string;
  sortBy?: TaskSortValue;
  sortOrder?: SortOrder;
  page?: number;
  pageSize?: number;
};

export type TaskQuery = TaskListParams & {
  inbox?: boolean;
};

export type TaskCreateInput = {
  title: string;
  description?: string | null;
  project_id?: string | null;
  priority?: TaskPriorityValue;
  due_date?: string | null;
};

export type TaskUpdateInput = Partial<TaskCreateInput> & {
  status?: TaskStatusValue;
};

export type UpdateTaskInput = TaskUpdateInput;

type RequestOptions = {
  signal?: AbortSignal;
};

function taskQuery(params: TaskListParams): string {
  const query = new URLSearchParams();

  if (params.status) query.set('status', params.status);
  if (params.priority) query.set('priority', params.priority);
  if (params.projectId) query.set('project_id', params.projectId);
  if (params.search?.trim()) {
    query.set('search', params.search.trim());
  }
  if (params.dueFrom) query.set('due_from', params.dueFrom);
  if (params.dueTo) query.set('due_to', params.dueTo);
  if (params.sortBy) query.set('sort_by', params.sortBy);
  if (params.sortOrder) query.set('sort_order', params.sortOrder);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) {
    query.set('page_size', String(params.pageSize));
  }

  return query.size ? `?${query.toString()}` : '';
}

function isTaskListResponse(response: TaskListApiResponse): response is TaskListResponse {
  return !Array.isArray(response) && Array.isArray(response.items);
}

export async function listTasks(
  params: TaskListParams = {},
  options: RequestOptions = {},
): Promise<TaskListResponse> {
  const response = await apiRequest<TaskListApiResponse>(`/tasks${taskQuery(params)}`, {
    signal: options.signal,
  });

  // Compatibility with the older deployed backend,
  // which returns TaskResponse[] directly.
  if (Array.isArray(response)) {
    return {
      items: response,
      page: 1,
      page_size: response.length,
      total: response.length,
      total_pages: response.length > 0 ? 1 : 0,
    };
  }

  // The current backend should return TaskListResponse.
  if (!isTaskListResponse(response)) {
    throw new Error('Invalid task list response from the server.');
  }

  return response;
}

export async function getTasks(
  params: TaskQuery = {},
  options: RequestOptions = {},
): Promise<TaskListResponse> {
  const result = await listTasks(
    {
      ...params,
      pageSize: params.inbox ? 100 : params.pageSize,
    },
    options,
  );

  if (!params.inbox) {
    return result;
  }

  const items = result.items.filter((task) => task.project_id === null);

  return {
    ...result,
    items,
    total: items.length,
    total_pages: items.length > 0 ? 1 : 0,
  };
}

export function createTask(input: TaskCreateInput, options: RequestOptions = {}) {
  return apiRequest<TaskResponse>('/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
    signal: options.signal,
  }).then((task) => {
    emitTaskDataChanged();
    return task;
  });
}

export function updateTask(taskId: string, input: TaskUpdateInput, options: RequestOptions = {}) {
  return apiRequest<TaskResponse>(`/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
    signal: options.signal,
  }).then((task) => {
    emitTaskDataChanged();
    return task;
  });
}

export function deleteTask(taskId: string): Promise<void>;

export function deleteTask(taskId: string, options: RequestOptions): Promise<void>;

export function deleteTask(taskId: string, options: RequestOptions = {}) {
  return apiRequest<void>(`/tasks/${taskId}`, {
    method: 'DELETE',
    signal: options.signal,
  }).then((result) => {
    emitTaskDataChanged();
    return result;
  });
}
