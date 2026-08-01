import { apiRequest } from './api';

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

export function listProjects() {
  return apiRequest<Project[]>('/projects');
}
