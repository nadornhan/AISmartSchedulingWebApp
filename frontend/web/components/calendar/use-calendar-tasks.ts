'use client';

import { useCallback, useEffect, useState } from 'react';
import { onProjectDataChanged, onTaskDataChanged } from '../../lib/data-events';
import { listProjects, type Project } from '../../lib/projects';
import {
  createTask,
  listTasks,
  rescheduleTask,
  updateTask,
  type TaskCreateInput,
  type TaskStatusValue,
} from '../../lib/tasks';
import { dateKey, toCalendarTask, type CalendarTask } from './calendar-model';

type CalendarTasksOptions = {
  visibleRange: { dueFrom: string; dueTo: string };
  selectDate: (date: Date) => void;
};

export function useCalendarTasks({ visibleRange, selectDate }: CalendarTasksOptions) {
  const [calendarTasks, setCalendarTasks] = useState<CalendarTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutatingTaskId, setMutatingTaskId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<CalendarTask | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  const refreshCalendarTasks = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoadError(null);
        setIsLoading(true);

        const firstPage = await listTasks(
          {
            page: 1,
            pageSize: 100,
            sortBy: 'due_date',
            sortOrder: 'asc',
          },
          { signal },
        );

        const remainingPages = await Promise.all(
          Array.from({ length: Math.max(firstPage.total_pages - 1, 0) }, (_, index) =>
            listTasks(
              {
                page: index + 2,
                pageSize: 100,
                sortBy: 'due_date',
                sortOrder: 'asc',
              },
              { signal },
            ),
          ),
        );
        const rangeStart = new Date(visibleRange.dueFrom).getTime();
        const rangeEnd = new Date(visibleRange.dueTo).getTime();
        const items = [firstPage, ...remainingPages].flatMap((page) => page.items);

        setCalendarTasks(
          items
            .map(toCalendarTask)
            .filter((task): task is CalendarTask => task !== null)
            .filter((task) => {
              const timestamp = new Date(task.calendarDate).getTime();
              return timestamp >= rangeStart && timestamp <= rangeEnd;
            }),
        );
      } catch (error) {
        if (signal?.aborted) return;

        setLoadError(error instanceof Error ? error.message : 'Unable to load calendar tasks.');
        setCalendarTasks([]);
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [visibleRange],
  );

  useEffect(() => {
    const controller = new AbortController();
    void refreshCalendarTasks(controller.signal);
    return () => controller.abort();
  }, [refreshCalendarTasks]);

  useEffect(
    () =>
      onTaskDataChanged(() => {
        void refreshCalendarTasks();
      }),
    [refreshCalendarTasks],
  );

  useEffect(
    () =>
      onProjectDataChanged(() => {
        void refreshCalendarTasks();
      }),
    [refreshCalendarTasks],
  );

  async function openCreateTaskModal() {
    setActionError(null);
    setIsCreateTaskOpen(true);
    try {
      setProjects(await listProjects());
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to load folders.');
    }
  }

  async function createCalendarTask(input: TaskCreateInput) {
    setIsCreatingTask(true);
    setActionError(null);
    try {
      await createTask(input);
      setIsCreateTaskOpen(false);
      await refreshCalendarTasks();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to create task.');
      throw error;
    } finally {
      setIsCreatingTask(false);
    }
  }

  async function toggleTaskStatus(task: CalendarTask) {
    const nextStatus: TaskStatusValue = task.status === 'done' ? 'pending' : 'done';

    setActionError(null);
    setMutatingTaskId(task.id);

    try {
      await updateTask(task.id, { status: nextStatus });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update calendar task.');
    } finally {
      setMutatingTaskId(null);
    }
  }

  async function moveTaskToDate(taskId: string, date: Date) {
    const task = calendarTasks.find((candidate) => candidate.id === taskId);
    if (!task) return;
    if (task.scheduleLocked) {
      setActionError('Unlock this task before changing its schedule.');
      return;
    }

    const currentDate = new Date(task.calendarDate);
    const nextDate = new Date(date);
    nextDate.setHours(currentDate.getHours(), currentDate.getMinutes(), 0, 0);
    const payload =
      task.scheduledStart && task.scheduledEnd
        ? {
            scheduled_start: nextDate.toISOString(),
            scheduled_end: new Date(
              nextDate.getTime() +
                new Date(task.scheduledEnd).getTime() -
                new Date(task.scheduledStart).getTime(),
            ).toISOString(),
          }
        : { due_date: nextDate.toISOString() };

    setActionError(null);
    setMutatingTaskId(task.id);
    try {
      const updated = await rescheduleTask(task.id, payload);
      const nextTask = toCalendarTask(updated);
      setCalendarTasks((current) =>
        nextTask ? current.map((item) => (item.id === task.id ? nextTask : item)) : current,
      );
      selectDate(date);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to reschedule task.');
    } finally {
      setMutatingTaskId(null);
    }
  }

  function openRescheduleDialog(task: CalendarTask) {
    if (task.scheduleLocked) {
      setActionError('Unlock this task before changing its schedule.');
      return;
    }
    const currentDate = new Date(task.calendarDate);
    setRescheduleTarget(task);
    setRescheduleDate(dateKey(currentDate));
    setRescheduleTime(
      `${String(currentDate.getHours()).padStart(2, '0')}:${String(currentDate.getMinutes()).padStart(2, '0')}`,
    );
    setActionError(null);
  }

  async function submitReschedule() {
    if (!rescheduleTarget || !rescheduleDate) return;

    const nextDate = new Date(
      `${rescheduleDate}T${rescheduleTime ? `${rescheduleTime}:00` : '23:59:00'}`,
    );
    if (Number.isNaN(nextDate.getTime())) {
      setActionError('Choose a valid date and time.');
      return;
    }

    setActionError(null);
    setMutatingTaskId(rescheduleTarget.id);
    try {
      const payload =
        rescheduleTarget.scheduledStart && rescheduleTarget.scheduledEnd
          ? {
              scheduled_start: nextDate.toISOString(),
              scheduled_end: new Date(
                nextDate.getTime() +
                  new Date(rescheduleTarget.scheduledEnd).getTime() -
                  new Date(rescheduleTarget.scheduledStart).getTime(),
              ).toISOString(),
            }
          : { due_date: nextDate.toISOString() };
      const updated = await rescheduleTask(rescheduleTarget.id, payload);
      const nextTask = toCalendarTask(updated);
      setCalendarTasks((current) =>
        nextTask
          ? current.map((item) => (item.id === rescheduleTarget.id ? nextTask : item))
          : current,
      );
      selectDate(nextDate);
      setRescheduleTarget(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to reschedule task.');
    } finally {
      setMutatingTaskId(null);
    }
  }

  return {
    calendarTasks,
    isLoading,
    loadError,
    mutatingTaskId,
    actionError,
    rescheduleTarget,
    setRescheduleTarget,
    rescheduleDate,
    setRescheduleDate,
    rescheduleTime,
    setRescheduleTime,
    projects,
    isCreateTaskOpen,
    setIsCreateTaskOpen,
    isCreatingTask,
    openCreateTaskModal,
    createCalendarTask,
    toggleTaskStatus,
    moveTaskToDate,
    openRescheduleDialog,
    submitReschedule,
  };
}
