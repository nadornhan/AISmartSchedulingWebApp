'use client';

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { onProjectDataChanged, onTaskDataChanged } from '../../lib/data-events';
import { listProjects, type Project } from '../../lib/projects';
import { getTask, listTasks, type TaskSortValue } from '../../lib/tasks';
import {
  filterToApi,
  getErrorMessage,
  priorityFilterToApi,
  toTask,
  type PriorityFilter,
  type Task,
  type TaskFilter,
} from './task-page-model';

type TaskPageDataOptions = {
  activeProjectId: string;
  searchQuery: string;
  targetTaskId: string;
  activeFilter: TaskFilter;
  priorityFilter: PriorityFilter;
  sortBy: TaskSortValue;
  sortAscending: boolean;
  page: number;
  pageSize: number;
  setError: Dispatch<SetStateAction<string | null>>;
  setSelected: Dispatch<SetStateAction<string[]>>;
  setMenuTaskId: Dispatch<SetStateAction<string | null>>;
};

export function useTaskPageData({
  activeProjectId,
  searchQuery,
  targetTaskId,
  activeFilter,
  priorityFilter,
  sortBy,
  sortAscending,
  page,
  pageSize,
  setError,
  setSelected,
  setMenuTaskId,
}: TaskPageDataOptions) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [counts, setCounts] = useState<Record<TaskFilter, number>>({
    All: 0,
    Pending: 0,
    'In Progress': 0,
    Done: 0,
    Overdue: 0,
  });
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const refreshTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (targetTaskId) {
        const task = await getTask(targetTaskId);
        setTasks([toTask(task)]);
        setTotalPages(1);
        setSelected([]);
        setMenuTaskId(null);
        return;
      }

      const response = await listTasks({
        projectId: activeProjectId || undefined,
        search: searchQuery || undefined,
        status: filterToApi[activeFilter],
        priority: priorityFilterToApi[priorityFilter],
        sortBy,
        sortOrder: sortAscending ? 'asc' : 'desc',
        page,
        pageSize,
      });
      setTasks(response.items.map(toTask));
      setTotalPages(response.total_pages);
      setSelected([]);
      setMenuTaskId(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setTasks([]);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  }, [
    activeFilter,
    activeProjectId,
    page,
    pageSize,
    priorityFilter,
    searchQuery,
    sortAscending,
    sortBy,
    targetTaskId,
    setError,
    setSelected,
    setMenuTaskId,
  ]);

  const refreshCounts = useCallback(async () => {
    try {
      const projectId = activeProjectId || undefined;
      const [all, pending, inProgress, done, overdue] = await Promise.all([
        listTasks({
          projectId,
          search: searchQuery || undefined,
          page: 1,
          pageSize: 1,
        }),
        listTasks({
          projectId,
          search: searchQuery || undefined,
          status: 'pending',
          page: 1,
          pageSize: 1,
        }),
        listTasks({
          projectId,
          search: searchQuery || undefined,
          status: 'in_progress',
          page: 1,
          pageSize: 1,
        }),
        listTasks({
          projectId,
          search: searchQuery || undefined,
          status: 'done',
          page: 1,
          pageSize: 1,
        }),
        listTasks({
          projectId,
          search: searchQuery || undefined,
          status: 'overdue',
          page: 1,
          pageSize: 1,
        }),
      ]);
      setCounts({
        All: all.total,
        Pending: pending.total,
        'In Progress': inProgress.total,
        Done: done.total,
        Overdue: overdue.total,
      });
    } catch {
      // The main task request displays the actionable API error.
    }
  }, [activeProjectId, searchQuery]);

  useEffect(() => {
    void refreshTasks();
  }, [refreshTasks]);

  useEffect(() => {
    void refreshCounts();
    void listProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [refreshCounts]);

  useEffect(
    () =>
      onTaskDataChanged(() => {
        void refreshTasks();
        void refreshCounts();
      }),
    [refreshCounts, refreshTasks],
  );

  useEffect(
    () =>
      onProjectDataChanged(() => {
        void listProjects()
          .then(setProjects)
          .catch(() => setProjects([]));
        void refreshCounts();
      }),
    [refreshCounts],
  );

  return { tasks, setTasks, projects, counts, totalPages, isLoading, refreshTasks, refreshCounts };
}
