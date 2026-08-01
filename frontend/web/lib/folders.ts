import { apiRequest } from './api';
import { emitProjectDataChanged, emitTaskDataChanged } from './data-events';

export type Folder = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
  task_count: number;
  completed_task_count: number;
};

export type CreateFolderInput = {
  name: string;
  color?: string;
};

export type UpdateFolderInput = {
  name?: string;
  color?: string;
};

type RequestOptions = {
  signal?: AbortSignal;
};

type FolderRequestOptions = RequestOptions & {
  folderId: string;
};

export async function getFolders({ signal }: RequestOptions = {}): Promise<Folder[]> {
  return apiRequest<Folder[]>('/projects', {
    signal,
  });
}

export async function createFolder(
  input: CreateFolderInput,
  { signal }: RequestOptions = {},
): Promise<Folder> {
  const folder = await apiRequest<Folder>('/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name.trim(),
      ...(input.color ? { color: input.color } : {}),
    }),
    signal,
  });
  emitProjectDataChanged();
  return folder;
}

export async function updateFolder(
  input: UpdateFolderInput,
  { folderId, signal }: FolderRequestOptions,
): Promise<Folder> {
  const folder = await apiRequest<Folder>(`/projects/${folderId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    }),
    signal,
  });
  emitProjectDataChanged();
  emitTaskDataChanged();
  return folder;
}

export async function deleteFolder({ folderId, signal }: FolderRequestOptions): Promise<void> {
  await apiRequest<void>(`/projects/${folderId}`, {
    method: 'DELETE',
    signal,
  });
  emitProjectDataChanged();
  emitTaskDataChanged();
}
