import { apiRequest } from './api';

export type Project = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
};

export function listProjects() {
  return apiRequest<Project[]>('/projects');
}
