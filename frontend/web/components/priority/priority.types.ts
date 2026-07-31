export type PriorityLevel = 'high' | 'medium' | 'low' | 'none';

export type PriorityTask = {
  id: string;
  title: string;
  dueDate?: string;
  overdue?: boolean;
  folder: string;
  folderColor: string;
  comments?: number;
  priority: PriorityLevel;
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
