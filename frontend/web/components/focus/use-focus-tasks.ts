'use client';

import { useEffect, useState } from 'react';
import { listTasks, type TaskResponse } from '../../lib/tasks';

export type FocusTask = {
  id: string;
  title: string;
  status: TaskResponse['status'];
  dueDate: string | null;
  estimatedDurationMinutes: number | null;
  projectName: string | null;
};

type FocusTasksOptions = {
  selectedTaskId: string | null;
  selectedTaskTitle: string | null;
};

export function useFocusTasks({ selectedTaskId, selectedTaskTitle }: FocusTasksOptions) {
  const [tasks, setTasks] = useState<FocusTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setTasksLoading(true);
    setTasksError(null);
    void listTasks(
      {
        page: 1,
        pageSize: 100,
        sortBy: 'due_date',
        sortOrder: 'asc',
      },
      { signal: controller.signal },
    )
      .then((response) => {
        const availableTasks = response.items
          .filter((task) => (task.workflow_status ?? task.status) !== 'done')
          .map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status,
            dueDate: task.due_date,
            estimatedDurationMinutes: task.estimated_duration_minutes,
            projectName: task.project?.name ?? null,
          }));

        if (
          selectedTaskId &&
          selectedTaskTitle &&
          !availableTasks.some((task) => task.id === selectedTaskId)
        ) {
          availableTasks.unshift({
            id: selectedTaskId,
            title: selectedTaskTitle,
            status: 'pending',
            dueDate: null,
            estimatedDurationMinutes: null,
            projectName: null,
          });
        }

        setTasks(availableTasks);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setTasksError('Unable to load your tasks. Please try again.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setTasksLoading(false);
      });

    return () => controller.abort();
  }, [selectedTaskId, selectedTaskTitle]);

  return { tasks, tasksLoading, tasksError };
}
