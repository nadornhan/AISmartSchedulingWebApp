export const appName = 'Todo List';

export type TaskStatus = 'active' | 'completed';

export type Task = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
};

export type TaskInput = {
  title: string;
  description: string | null;
};

export const initialTaskFields = [
  'title',
  'description',
  'status',
  'created date',
  'updated date',
] as const;
