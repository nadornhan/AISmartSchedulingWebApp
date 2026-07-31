import { apiRequest } from './api';

export type TaskStatusValue = 'pending' | 'in_progress' | 'done';
export type TaskDisplayStatusValue = TaskStatusValue | 'overdue';
export type TaskPriorityValue = 'no_priority' | 'low' | 'medium' | 'high';
export type TaskSortValue = 'created_at' | 'updated_at' | 'title' | 'due_date' | 'priority';

export type TaskProjectSummary = {
  id: string;
  name: string;
  color: string;
};

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

export type TaskListResponse = {
  items: TaskResponse[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type TaskListParams = {
  status?: TaskDisplayStatusValue;
  priority?: TaskPriorityValue;
  projectId?: string;
  search?: string;
  sortBy?: TaskSortValue;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
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

export function listTasks(params: TaskListParams = {}) {
  const query = new URLSearchParams();

  if (params.status) query.set('status', params.status);
  if (params.priority) query.set('priority', params.priority);
  if (params.projectId) query.set('project_id', params.projectId);
  if (params.search) query.set('search', params.search);
  if (params.sortBy) query.set('sort_by', params.sortBy);
  if (params.sortOrder) query.set('sort_order', params.sortOrder);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('page_size', String(params.pageSize));

  const suffix = query.size ? `?${query.toString()}` : '';
  return apiRequest<TaskListResponse>(`/tasks${suffix}`);
}

export function createTask(input: TaskCreateInput) {
  return apiRequest<TaskResponse>('/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTask(taskId: string, input: TaskUpdateInput) {
  return apiRequest<TaskResponse>(`/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteTask(taskId: string) {
  return apiRequest<void>(`/tasks/${taskId}`, {
    method: 'DELETE',
  });
}
