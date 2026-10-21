import { apiRequest, getAccessToken } from './api';
import { cachedRead, peekReadCache } from './read-cache';
import { emitProjectDataChanged } from './data-events';

export type Project = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
  task_count: number;
  completed_task_count: number;
};

export type CreateProjectInput = {
  name: string;
  color?: string;
};

export function listProjects() {
  return cachedRead(getAccessToken(), 'projects', 'list', () => apiRequest<Project[]>('/projects'), 60_000);
}

export function getCachedProjects() {
  return peekReadCache<Project[]>(getAccessToken(), 'projects', 'list');
}

export async function createProject(input: CreateProjectInput) {
  const project = await apiRequest<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name.trim(),
      ...(input.color ? { color: input.color } : {}),
    }),
  });
  emitProjectDataChanged();
  return project;
}
