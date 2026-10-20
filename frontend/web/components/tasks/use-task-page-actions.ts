'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import {
  bulkDeleteTasks,
  bulkUpdateTasks,
  createTask,
  deleteTask,
  duplicateTask,
  rescheduleTask,
  updateSubtaskCompletion,
  updateTask,
  type TaskCreateInput,
  type TaskResponse,
  type TaskUpdateInput,
} from '../../lib/tasks';
import {
  getErrorMessage,
  statusToApi,
  toTask,
  type Task,
  type TaskStatus,
} from './task-page-model';

type TaskPageActionsOptions = {
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  selected: string[];
  page: number;
  editingTask: TaskResponse | null;
  setEditingTask: Dispatch<SetStateAction<TaskResponse | null>>;
  setPage: Dispatch<SetStateAction<number>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setMenuTaskId: Dispatch<SetStateAction<string | null>>;
  setIsModalOpen: Dispatch<SetStateAction<boolean>>;
  refreshTasks: () => Promise<void>;
  refreshCounts: () => Promise<void>;
};

export function useTaskPageActions({
  tasks,
  setTasks,
  selected,
  page,
  editingTask,
  setEditingTask,
  setPage,
  setError,
  setMenuTaskId,
  setIsModalOpen,
  refreshTasks,
  refreshCounts,
}: TaskPageActionsOptions) {
  const [isMutating, setIsMutating] = useState(false);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [rescheduleTaskId, setRescheduleTaskId] = useState<string | null>(null);
  const [rescheduleDueDate, setRescheduleDueDate] = useState('');

  async function toggleSubtask(task: Task, subtaskId: string, isCompleted: boolean) {
    setIsMutating(true);
    setError(null);
    try {
      const updated = await updateSubtaskCompletion(task.id, subtaskId, isCompleted);
      setTasks((current) => current.map((item) => (item.id === task.id ? toTask(updated) : item)));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsMutating(false);
    }
  }

  async function changeStatus(id: string, status: TaskStatus) {
    const previousTask = tasks.find((task) => task.id === id);
    const apiStatus = statusToApi[status];

    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              status,
              workflowStatus: status,
              overdue: false,
              source: {
                ...task.source,
                status: apiStatus,
                workflow_status: apiStatus,
              },
            }
          : task,
      ),
    );
    setIsMutating(true);
    setError(null);
    try {
      await updateTask(id, { status: apiStatus });
      await Promise.all([refreshTasks(), refreshCounts()]);
    } catch (requestError) {
      if (previousTask) {
        setTasks((current) =>
          current.map((task) => (task.id === previousTask.id ? previousTask : task)),
        );
      }
      setError(getErrorMessage(requestError));
    } finally {
      setIsMutating(false);
    }
  }

  async function completeSelected() {
    setIsMutating(true);
    setError(null);
    try {
      await bulkUpdateTasks({ task_ids: selected, status: 'done' });
      await Promise.all([refreshTasks(), refreshCounts()]);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsMutating(false);
    }
  }

  async function deleteSelected() {
    setIsMutating(true);
    setError(null);
    try {
      await bulkDeleteTasks(selected);
      const shouldGoBack = tasks.length === selected.length && page > 1;
      if (shouldGoBack) {
        setPage((current) => current - 1);
      } else {
        await refreshTasks();
      }
      await refreshCounts();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsMutating(false);
    }
  }

  async function moveSelected(projectId: string | null) {
    setIsMutating(true);
    setError(null);
    try {
      await bulkUpdateTasks({ task_ids: selected, project_id: projectId });
      setIsMoveOpen(false);
      await Promise.all([refreshTasks(), refreshCounts()]);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDuplicate(taskId: string) {
    setIsMutating(true);
    setError(null);
    setMenuTaskId(null);
    try {
      await duplicateTask(taskId);
      await Promise.all([refreshTasks(), refreshCounts()]);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsMutating(false);
    }
  }

  async function toggleScheduleLock(task: Task) {
    if (
      !task.source.schedule_locked &&
      (!task.source.scheduled_start || !task.source.scheduled_end)
    ) {
      setError('Schedule this task before locking its time.');
      setMenuTaskId(null);
      return;
    }

    setIsMutating(true);
    setError(null);
    setMenuTaskId(null);
    try {
      await updateTask(task.id, { schedule_locked: !task.source.schedule_locked });
      await refreshTasks();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDeleteOne(taskId: string) {
    setIsMutating(true);
    setError(null);
    setMenuTaskId(null);
    try {
      await deleteTask(taskId);
      await Promise.all([refreshTasks(), refreshCounts()]);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleReschedule() {
    if (!rescheduleTaskId || !rescheduleDueDate) return;

    setIsMutating(true);
    setError(null);
    try {
      const dueDateTime = new Date(`${rescheduleDueDate}T23:59:00`);
      await rescheduleTask(rescheduleTaskId, {
        due_date: Number.isNaN(dueDateTime.getTime()) ? null : dueDateTime.toISOString(),
      });
      setRescheduleTaskId(null);
      setRescheduleDueDate('');
      await Promise.all([refreshTasks(), refreshCounts()]);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsMutating(false);
    }
  }

  function openReschedule(task: Task) {
    setMenuTaskId(null);
    setRescheduleTaskId(task.id);
    setRescheduleDueDate(task.dueDateIso ? task.dueDateIso.slice(0, 10) : '');
  }

  async function addTask(input: TaskCreateInput) {
    setIsMutating(true);
    setError(null);
    try {
      await createTask(input);
      setIsModalOpen(false);
      setPage(1);
      await Promise.all([refreshTasks(), refreshCounts()]);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      throw requestError;
    } finally {
      setIsMutating(false);
    }
  }

  async function editTask(input: TaskUpdateInput) {
    if (!editingTask) return;

    setIsMutating(true);
    setError(null);
    try {
      await updateTask(editingTask.id, input);
      setEditingTask(null);
      await Promise.all([refreshTasks(), refreshCounts()]);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      throw requestError;
    } finally {
      setIsMutating(false);
    }
  }

  async function deleteEditingTask() {
    if (!editingTask) return;
    setIsMutating(true);
    try {
      await deleteTask(editingTask.id);
      setEditingTask(null);
      await Promise.all([refreshTasks(), refreshCounts()]);
    } finally {
      setIsMutating(false);
    }
  }

  return {
    isMutating,
    isMoveOpen,
    setIsMoveOpen,
    rescheduleTaskId,
    setRescheduleTaskId,
    rescheduleDueDate,
    setRescheduleDueDate,
    toggleSubtask,
    changeStatus,
    completeSelected,
    deleteSelected,
    moveSelected,
    handleDuplicate,
    toggleScheduleLock,
    handleDeleteOne,
    handleReschedule,
    openReschedule,
    addTask,
    editTask,
    deleteEditingTask,
  };
}
