'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { seedFolders, seedInboxTasks, seedTasksByFolder } from '../../lib/folder-seed';
import { getFolders, type Folder } from '../../lib/folders';
import { getTasks, type Task, type TaskPriority, type TaskStatus } from '../../lib/tasks';
import { TaskFilters, type TaskFilterValues } from './task-filters';

const useSeedData = process.env.NEXT_PUBLIC_USE_FOLDER_SEED_DATA !== 'false';

type TaskBoardProps = {
  search: string;
  initialStatus: TaskStatus | '';
  initialPriority: TaskPriority | '';
  initialProjectId: string;
};

type DisplayTask = Pick<Task, 'id' | 'title' | 'status' | 'priority' | 'project_id'> & {
  projectName?: string;
};

const priorityClasses = {
  no_priority: 'text-dashboard-muted',
  low: 'bg-dashboard-accent-soft text-dashboard-accent',
  medium: 'bg-dashboard-warning/15 text-dashboard-warning',
  high: 'bg-dashboard-danger/15 text-dashboard-danger',
};

function getSeedTasks(): DisplayTask[] {
  const folderTasks = seedFolders.flatMap((folder) =>
    (seedTasksByFolder[folder.id] ?? []).map((task) => ({
      ...task,
      project_id: folder.id,
      projectName: folder.name,
    })),
  );
  const inboxTasks = seedInboxTasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    project_id: null,
    projectName: 'Inbox',
  }));
  return [...folderTasks, ...inboxTasks];
}

export function TaskBoard({
  search,
  initialStatus,
  initialPriority,
  initialProjectId,
}: TaskBoardProps) {
  const router = useRouter();
  const [folders, setFolders] = useState<Folder[]>(useSeedData ? seedFolders : []);
  const [tasks, setTasks] = useState<DisplayTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const values: TaskFilterValues = {
    status: initialStatus,
    priority: initialPriority,
    projectId: initialProjectId,
  };

  useEffect(() => {
    if (useSeedData) {
      let result = getSeedTasks();
      if (search) {
        const normalized = search.toLowerCase();
        result = result.filter((task) => task.title.toLowerCase().includes(normalized));
      }
      if (initialStatus) result = result.filter((task) => task.status === initialStatus);
      if (initialPriority) result = result.filter((task) => task.priority === initialPriority);
      if (initialProjectId === 'inbox') {
        result = result.filter((task) => task.project_id === null);
      } else if (initialProjectId) {
        result = result.filter((task) => task.project_id === initialProjectId);
      }
      setTasks(result);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);
        const [folderResult, taskResult] = await Promise.all([
          getFolders({ signal: controller.signal }),
          getTasks(
            {
              search: search || undefined,
              status: initialStatus || undefined,
              priority: initialPriority || undefined,
              projectId:
                initialProjectId && initialProjectId !== 'inbox'
                  ? initialProjectId
                  : undefined,
              inbox: initialProjectId === 'inbox',
              pageSize: 100,
            },
            { signal: controller.signal },
          ),
        ]);
        setFolders(folderResult);
        setTasks(
          taskResult.items.map((task) => ({
            ...task,
            projectName: task.project?.name ?? 'Inbox',
          })),
        );
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to load tasks.');
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadData();
    return () => controller.abort();
  }, [initialPriority, initialProjectId, initialStatus, search]);

  function updateFilters(next: TaskFilterValues) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (next.status) params.set('status', next.status);
    if (next.priority) params.set('priority', next.priority);
    if (next.projectId) params.set('project_id', next.projectId);
    router.push(params.size ? `/tasks?${params.toString()}` : '/tasks');
  }

  return (
    <div className="mx-auto max-w-7xl">
      {search ? (
        <p className="mb-4 text-sm text-dashboard-muted">
          Search results for <span className="text-dashboard-text">“{search}”</span>
        </p>
      ) : null}
      <TaskFilters
        folders={folders}
        onChange={updateFilters}
        onClear={() => router.push(search ? `/tasks?search=${encodeURIComponent(search)}` : '/tasks')}
        values={values}
      />

      {isLoading ? <p className="py-12 text-center text-dashboard-muted">Loading tasks…</p> : null}
      {error ? <p className="rounded-lg border border-dashboard-danger/30 bg-dashboard-danger/10 p-5 text-dashboard-danger">{error}</p> : null}
      {!isLoading && !error && tasks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-dashboard-border p-12 text-center text-dashboard-muted">No tasks match these filters.</p>
      ) : null}
      {!isLoading && !error && tasks.length > 0 ? (
        <div className="space-y-3">
          {tasks.map((task) => (
            <article className="flex items-center gap-4 rounded-lg border border-dashboard-border bg-dashboard-surface/50 p-4" key={task.id}>
              <span className="h-5 w-5 rounded-full border border-dashboard-muted" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-medium text-dashboard-text">{task.title}</h2>
                <p className="mt-1 text-xs text-dashboard-muted">{task.projectName}</p>
              </div>
              <span className="text-xs capitalize text-dashboard-muted">{task.status.replace('_', ' ')}</span>
              <span className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize ${priorityClasses[task.priority]}`}>{task.priority.replace('_', ' ')}</span>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
