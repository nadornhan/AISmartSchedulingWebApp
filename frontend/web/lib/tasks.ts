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

export type TaskSubtask = {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

export type TaskSubtaskInput = {
  title: string;
  is_completed?: boolean;
  position?: number | null;
};

export type TaskSubtaskProgress = {
  completed: number;
  total: number;
  percent: number | null;
};

export type TaskResponse = {
  id: string;
  user_id: string;
  project_id: string | null;
  project: TaskProjectSummary | null;
  title: string;
  description: string | null;
  status: TaskDisplayStatusValue;
  workflow_status?: TaskStatusValue;
  priority: TaskPriorityValue;
  due_date: string | null;
  estimated_duration_minutes: number | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  completed_at: string | null;
  subtasks: TaskSubtask[];
  subtask_progress: TaskSubtaskProgress;
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
  inboxOnly?: boolean;
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
  estimated_duration_minutes?: number | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  subtasks?: TaskSubtaskInput[];
};

export type TaskUpdateInput = Partial<TaskCreateInput> & {
  status?: TaskStatusValue;
};

export type UpdateTaskInput = TaskUpdateInput;

export type TaskBulkUpdateInput = {
  task_ids: string[];
  status?: TaskStatusValue;
  project_id?: string | null;
  priority?: TaskPriorityValue;
  due_date?: string | null;
};

export type TaskRescheduleInput = {
  due_date?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
};

export type TaskDuplicateInput = {
  title?: string;
  include_subtasks?: boolean;
  reset_status?: boolean;
};

type RequestOptions = {
  signal?: AbortSignal;
};

function taskQuery(params: TaskListParams): string {
  const query = new URLSearchParams();

  if (params.status) query.set('status', params.status);
  if (params.priority) query.set('priority', params.priority);
  if (params.projectId) query.set('project_id', params.projectId);
  if (params.inboxOnly) query.set('inbox_only', 'true');
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
  return listTasks(
    {
      ...params,
      inboxOnly: params.inbox || params.inboxOnly,
      pageSize: params.pageSize,
    },
    options,
  );
}

export function getTask(taskId: string, options: RequestOptions = {}) {
  return apiRequest<TaskResponse>(`/tasks/${taskId}`, {
    signal: options.signal,
  });
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

export function bulkUpdateTasks(input: TaskBulkUpdateInput, options: RequestOptions = {}) {
  return apiRequest<{ updated: TaskResponse[]; deleted_count: number }>('/tasks/bulk/update', {
    method: 'POST',
    body: JSON.stringify(input),
    signal: options.signal,
  }).then((result) => {
    emitTaskDataChanged();
    return result;
  });
}

export function bulkDeleteTasks(taskIds: string[], options: RequestOptions = {}) {
  return apiRequest<{ updated: TaskResponse[]; deleted_count: number }>('/tasks/bulk/delete', {
    method: 'POST',
    body: JSON.stringify({ task_ids: taskIds }),
    signal: options.signal,
  }).then((result) => {
    emitTaskDataChanged();
    return result;
  });
}

export function duplicateTask(
  taskId: string,
  input: TaskDuplicateInput = {},
  options: RequestOptions = {},
) {
  return apiRequest<TaskResponse>(`/tasks/${taskId}/duplicate`, {
    method: 'POST',
    body: JSON.stringify(input),
    signal: options.signal,
  }).then((task) => {
    emitTaskDataChanged();
    return task;
  });
}

export function rescheduleTask(
  taskId: string,
  input: TaskRescheduleInput,
  options: RequestOptions = {},
) {
  return apiRequest<TaskResponse>(`/tasks/${taskId}/reschedule`, {
    method: 'POST',
    body: JSON.stringify(input),
    signal: options.signal,
  }).then((task) => {
    emitTaskDataChanged();
    return task;
  });
}
