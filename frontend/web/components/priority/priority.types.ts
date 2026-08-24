export type PriorityLevel = 'high' | 'medium' | 'low' | 'none';

export type PriorityTask = {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  deadline?: string;
  overdue?: boolean;
  folder: string;
  folderColor: string;
  comments?: number;
  priority: PriorityLevel;
  status: string;
  estimatedDurationMinutes?: number;
  completed: boolean;
};

export type PriorityColumnData = {
  id: PriorityLevel;
  title: string;
  description: string;
  accent: string;
  accentRgb: string;
  flagColor: string;
  tasks: PriorityTask[];
};
