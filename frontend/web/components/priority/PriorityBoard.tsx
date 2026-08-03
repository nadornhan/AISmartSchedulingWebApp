'use client';

import { useCallback, useEffect, useState } from 'react';

import { onProjectDataChanged, onTaskDataChanged } from '../../lib/data-events';
import { listProjects, type Project } from '../../lib/projects';
import {
  createTask,
  listTasks,
  updateTask,
  type TaskCreateInput,
  type TaskPriorityValue,
  type TaskResponse,
} from '../../lib/tasks';
import { CreateTaskModal, type TaskPriorityLabel } from '../tasks/create-task-modal';
import { PriorityColumn } from './PriorityColumn';
import { PrioritySummaryGrid } from './PrioritySummaryGrid';
import { PriorityTipBar } from './PriorityTipBar';
import type { PriorityColumnData, PriorityLevel, PriorityTask } from './priority.types';

const columnMeta: Array<Omit<PriorityColumnData, 'tasks'>> = [
  {
    id: 'high',
    title: 'High Priority',
    description: 'Need attention',
    accent: '#ff5757',
    accentRgb: '255 87 87',
    flagColor: 'text-dashboard-danger',
  },
  {
    id: 'medium',
    title: 'Medium Priority',
    description: 'Plan your time',
    accent: '#f5b900',
    accentRgb: '245 185 0',
    flagColor: 'text-dashboard-warning',
  },
  {
    id: 'low',
    title: 'Low Priority',
    description: 'Do when you can',
    accent: '#4295e8',
    accentRgb: '66 149 232',
    flagColor: 'text-dashboard-info',
  },
  {
    id: 'none',
    title: 'No Priority',
    description: 'Unprioritized',
    accent: '#9ca3af',
    accentRgb: '156 163 175',
    flagColor: 'text-gray-400',
  },
];

const priorityMap: Record<TaskPriorityValue, PriorityLevel> = {
  high: 'high',
  low: 'low',
  medium: 'medium',
  no_priority: 'none',
};

const priorityLabelByLevel: Record<PriorityLevel, TaskPriorityLabel> = {
  high: 'High',
  low: 'Low',
  medium: 'Medium',
  none: 'No priority',
};

function formatDueDate(value: string | null) {
  if (!value) return undefined;

  const date = new Date(value);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const sameDay = (first: Date, second: Date) =>
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate();

  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, tomorrow)) return 'Tomorrow';

  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function toPriorityTask(task: TaskResponse): PriorityTask {
  return {
    id: task.id,
    title: task.title,
    dueDate: task.status === 'overdue' ? 'Overdue' : formatDueDate(task.due_date),
    overdue: task.status === 'overdue',
    folder: task.project?.name ?? 'Unassigned',
    folderColor: task.project?.color ?? 'var(--dashboard-muted)',
    priority: priorityMap[task.priority],
    completed: task.status === 'done',
  };
}

function buildColumns(tasks: TaskResponse[]): PriorityColumnData[] {
  const grouped = tasks.reduce<Record<PriorityLevel, PriorityTask[]>>(
    (groups, task) => {
      const priority = priorityMap[task.priority];
      groups[priority] = [...groups[priority], toPriorityTask(task)];
      return groups;
    },
    {
      high: [],
      low: [],
      medium: [],
      none: [],
    },
  );

  return columnMeta.map((column) => ({
    ...column,
    tasks: grouped[column.id],
  }));
}

export function PriorityBoard() {
  const [columns, setColumns] = useState<PriorityColumnData[]>(() => buildColumns([]));
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createPriority, setCreatePriority] = useState<TaskPriorityLabel>('No priority');
  const [error, setError] = useState<string | null>(null);

  const refreshTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await listTasks({
        page: 1,
        pageSize: 100,
        sortBy: 'priority',
        sortOrder: 'asc',
      });
      setColumns(buildColumns(response.items));
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to load priority tasks.',
      );
      setColumns(buildColumns([]));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshProjects = useCallback(async () => {
    try {
      setProjects(await listProjects());
    } catch {
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    void refreshTasks();
    void refreshProjects();
  }, [refreshProjects, refreshTasks]);

  useEffect(
    () =>
      onTaskDataChanged(() => {
        void refreshTasks();
      }),
    [refreshTasks],
  );

  useEffect(
    () =>
      onProjectDataChanged(() => {
        void refreshProjects();
      }),
    [refreshProjects],
  );

  function openCreateTask(columnId: PriorityLevel) {
    setCreatePriority(priorityLabelByLevel[columnId]);
    setIsModalOpen(true);
  }

  async function addTask(input: TaskCreateInput) {
    setIsMutating(true);
    setError(null);

    try {
      await createTask(input);
      setIsModalOpen(false);
      await refreshTasks();
    } catch (requestError) {
      throw requestError instanceof Error
        ? requestError
        : new Error('Unable to create task.');
    } finally {
      setIsMutating(false);
    }
  }

  async function toggleTask(id: string) {
    const task = columns.flatMap((column) => column.tasks).find((item) => item.id === id);

    if (!task) return;

    try {
      await updateTask(id, {
        status: task.completed ? 'pending' : 'done',
      });
      await refreshTasks();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update task.');
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <PrioritySummaryGrid columns={columns} />

      {error ? (
        <p
          className="rounded-lg border border-dashboard-danger/30 bg-dashboard-danger/10 p-4 text-sm text-dashboard-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <div className="grid min-h-64 place-items-center rounded-lg border border-dashboard-border bg-dashboard-surface/55 text-dashboard-muted">
          Loading priority tasks...
        </div>
      ) : (
        <section
          aria-label="Priority task board"
          className="grid items-stretch gap-3 md:grid-cols-2 xl:grid-cols-4"
        >
          {columns.map((column) => (
            <PriorityColumn
              column={column}
              key={column.id}
              onAddTask={openCreateTask}
              onToggle={toggleTask}
            />
          ))}
        </section>
      )}

      <PriorityTipBar />

      {isModalOpen ? (
        <CreateTaskModal
          initialPriority={createPriority}
          isSubmitting={isMutating}
          key={createPriority}
          onClose={() => setIsModalOpen(false)}
          onCreate={addTask}
          projects={projects}
        />
      ) : null}
    </div>
  );
}
