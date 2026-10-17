'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { onProjectDataChanged, onTaskDataChanged } from '../../lib/data-events';
import { getCachedProjects, listProjects, type Project } from '../../lib/projects';
import { getCachedTaskList, getCachedTaskCounts, getTaskCounts, getTask, listTasks, type TaskCounts, type TaskSortValue } from '../../lib/tasks';
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
  const taskParams = {
    projectId: activeProjectId || undefined,
    search: searchQuery || undefined,
    status: filterToApi[activeFilter],
    priority: priorityFilterToApi[priorityFilter],
    sortBy,
    sortOrder: sortAscending ? 'asc' as const : 'desc' as const,
    page,
    pageSize,
  };
  const cached = targetTaskId ? undefined : getCachedTaskList(taskParams);
  const countParams = { projectId: activeProjectId || undefined, search: searchQuery || undefined };
  const displayCounts = (value?: TaskCounts): Record<TaskFilter, number> => ({
    All: value?.total ?? 0,
    Pending: value?.pending ?? 0,
    'In Progress': value?.in_progress ?? 0,
    Done: value?.done ?? 0,
    Overdue: value?.overdue ?? 0,
  });
  const [tasks, setTasks] = useState<Task[]>(() => cached?.items.map(toTask) ?? []);
  const [projects, setProjects] = useState<Project[]>(() => getCachedProjects() ?? []);
  const [counts, setCounts] = useState(() => displayCounts(getCachedTaskCounts(countParams)));
  const [totalPages, setTotalPages] = useState(cached?.total_pages ?? 0);
  const [totalTasks, setTotalTasks] = useState(cached?.total ?? 0);
  const [isLoading, setIsLoading] = useState(!cached);
  const taskRevision = useRef(0);
  const countRevision = useRef(0);
  const projectRevision = useRef(0);

  const refreshTasks = useCallback(async () => {
    const revision = ++taskRevision.current;
    const previous = targetTaskId ? undefined : getCachedTaskList(taskParams);
    if (previous) {
      setTasks(previous.items.map(toTask));
      setTotalPages(previous.total_pages);
      setTotalTasks(previous.total);
    }
    setIsLoading(!previous);
    setError(null);

    try {
      if (targetTaskId) {
        const task = await getTask(targetTaskId);
        if (revision !== taskRevision.current) return;
        setTasks([toTask(task)]);
        setTotalPages(1);
        setTotalTasks(1);
        setSelected([]);
        setMenuTaskId(null);
        return;
      }

      const response = await listTasks(taskParams);
      if (revision !== taskRevision.current) return;
      setTasks(response.items.map(toTask));
      setTotalPages(response.total_pages);
      setTotalTasks(response.total);
      setSelected([]);
      setMenuTaskId(null);
    } catch (requestError) {
      if (revision !== taskRevision.current) return;
      setError(getErrorMessage(requestError));
      if (!previous) {
        setTasks([]);
        setTotalPages(0);
        setTotalTasks(0);
      }
    } finally {
      if (revision === taskRevision.current) setIsLoading(false);
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
    const revision = ++countRevision.current;
    try {
      const response = await getTaskCounts(countParams);
      if (revision === countRevision.current) setCounts(displayCounts(response));
    } catch {
      // The main task request displays the actionable API error.
    }
  }, [activeProjectId, searchQuery]);

  const refreshProjects = useCallback(async () => {
    const revision = ++projectRevision.current;
    try {
      const response = await listProjects();
      if (revision === projectRevision.current) setProjects(response);
    } catch {
      if (revision === projectRevision.current && !getCachedProjects()) setProjects([]);
    }
  }, []);

  useEffect(() => {
    void refreshTasks();
    return () => { taskRevision.current++; };
  }, [refreshTasks]);

  useEffect(() => {
    void refreshCounts();
    return () => { countRevision.current++; };
  }, [refreshCounts]);

  useEffect(() => {
    void refreshProjects();
    return () => { projectRevision.current++; };
  }, [refreshProjects]);

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
        void refreshProjects();
        void refreshTasks();
        void refreshCounts();
      }),
    [refreshCounts, refreshProjects, refreshTasks],
  );

  return {
    tasks,
    setTasks,
    projects,
    counts,
    totalPages,
    totalTasks,
    isLoading,
    refreshTasks,
    refreshCounts,
  };
}
