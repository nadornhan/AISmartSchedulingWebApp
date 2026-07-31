const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export type Folder = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
  task_count?: number;
  completed_task_count?: number;
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
  accessToken: string;
  signal?: AbortSignal;
};

type FolderRequestOptions = RequestOptions & {
  folderId: string;
};

export class FolderApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'FolderApiError';
    this.status = status;
  }
}

function getHeaders(accessToken: string, hasBody = false): HeadersInit {
  return {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${accessToken}`,
  };
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    return body.detail ?? 'Folder request failed';
  } catch {
    return 'Folder request failed';
  }
}

async function requireSuccessfulResponse(response: Response): Promise<void> {
  if (!response.ok) {
    throw new FolderApiError(await getErrorMessage(response), response.status);
  }
}

export async function getFolders({
  accessToken,
  signal,
}: RequestOptions): Promise<Folder[]> {
  const response = await fetch(`${API_URL}/projects`, {
    headers: getHeaders(accessToken),
    signal,
  });

  await requireSuccessfulResponse(response);
  return (await response.json()) as Folder[];
}

export async function createFolder(
  input: CreateFolderInput,
  { accessToken, signal }: RequestOptions,
): Promise<Folder> {
  const response = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: getHeaders(accessToken, true),
    body: JSON.stringify({
      name: input.name.trim(),
      ...(input.color ? { color: input.color } : {}),
    }),
    signal,
  });

  await requireSuccessfulResponse(response);
  return (await response.json()) as Folder;
}

export async function updateFolder(
  input: UpdateFolderInput,
  { accessToken, folderId, signal }: FolderRequestOptions,
): Promise<Folder> {
  const response = await fetch(`${API_URL}/projects/${folderId}`, {
    method: 'PATCH',
    headers: getHeaders(accessToken, true),
    body: JSON.stringify({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    }),
    signal,
  });

  await requireSuccessfulResponse(response);
  return (await response.json()) as Folder;
}

export async function deleteFolder({
  accessToken,
  folderId,
  signal,
}: FolderRequestOptions): Promise<void> {
  const response = await fetch(`${API_URL}/projects/${folderId}`, {
    method: 'DELETE',
    headers: getHeaders(accessToken),
    signal,
  });

  await requireSuccessfulResponse(response);
}
