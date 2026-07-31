'use client';

import { useCallback, useEffect, useState } from 'react';
import { CreateFolderModal } from '../../../components/folders/create-folder-modal';
import { DeleteFolderDialog } from '../../../components/folders/delete-folder-dialog';
import { EditFolderModal } from '../../../components/folders/edit-folder-modal';
import {
  FolderList,
  type TasksByFolder,
} from '../../../components/folders/folder-list';
import { InboxList, type InboxTask } from '../../../components/folders/inbox-list';
import { PlusIcon } from '../../../components/layout/icons';
import {
  seedFolders,
  seedInboxTasks,
  seedTasksByFolder,
} from '../../../lib/folder-seed';
import {
  deleteFolder,
  getFolders,
  updateFolder,
  type Folder,
} from '../../../lib/folders';
import { deleteTask, getTasks, updateTask } from '../../../lib/tasks';

const useSeedData = process.env.NEXT_PUBLIC_USE_FOLDER_SEED_DATA !== 'false';

export default function FoldersPage() {
  const [isCreateOpenLocally, setIsCreateOpenLocally] = useState(false);
  const [folders, setFolders] = useState<Folder[]>(useSeedData ? seedFolders : []);
  const [tasksByFolder, setTasksByFolder] = useState<TasksByFolder>(
    useSeedData ? seedTasksByFolder : {},
  );
  const [inboxTasks, setInboxTasks] = useState<InboxTask[]>(
    useSeedData ? seedInboxTasks : [],
  );
  const [isLoading, setIsLoading] = useState(!useSeedData);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [isCreateOpenFromHash, setIsCreateOpenFromHash] = useState(false);
  const isCreateOpen = isCreateOpenLocally || isCreateOpenFromHash;

  useEffect(() => {
    const syncModalWithHash = () => {
      setIsCreateOpenFromHash(window.location.hash === '#create-folder');
    };

    syncModalWithHash();
    window.addEventListener('hashchange', syncModalWithHash);
    const openCreateModal = () => setIsCreateOpenLocally(true);
    window.addEventListener('open-create-folder', openCreateModal);

    return () => {
      window.removeEventListener('hashchange', syncModalWithHash);
      window.removeEventListener('open-create-folder', openCreateModal);
    };
  }, []);

  useEffect(() => {
    if (useSeedData) return;

    const accessToken = window.localStorage.getItem('access_token');

    if (!accessToken) {
      setLoadError('Please sign in to view your folders.');
      setIsLoading(false);
      return;
    }

    const authenticatedToken = accessToken;
    const controller = new AbortController();

    async function loadFolders() {
      try {
        setLoadError(null);
        setIsLoading(true);
        const result = await getFolders({
          accessToken: authenticatedToken,
          signal: controller.signal,
        });
        const [folderTaskResults, inboxResult] = await Promise.all([
          Promise.all(
            result.map((folder) =>
              getTasks(
                { projectId: folder.id, pageSize: 100 },
                { accessToken: authenticatedToken, signal: controller.signal },
              ),
            ),
          ),
          getTasks(
            { inbox: true },
            { accessToken: authenticatedToken, signal: controller.signal },
          ),
        ]);
        const nextTasksByFolder: TasksByFolder = {};
        const foldersWithCounts = result.map((folder, index) => {
          const tasks = folderTaskResults[index].items;
          nextTasksByFolder[folder.id] = tasks.map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
          }));
          return {
            ...folder,
            task_count: folderTaskResults[index].total,
            completed_task_count: tasks.filter((task) => task.status === 'done').length,
          };
        });
        setFolders(foldersWithCounts);
        setTasksByFolder(nextTasksByFolder);
        setInboxTasks(
          inboxResult.items.map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            icon: 'tool',
          })),
        );
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setLoadError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load folders.',
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadFolders();
    return () => controller.abort();
  }, []);

  const closeCreateModal = useCallback(() => {
    setIsCreateOpenLocally(false);
    setIsCreateOpenFromHash(false);
    if (window.location.hash === '#create-folder') {
      window.history.replaceState(null, '', '/folders');
    }
  }, []);

  function requireToken(): string | null {
    const token = window.localStorage.getItem('access_token');
    if (!token) setActionError('Please sign in to change folders or tasks.');
    return token;
  }

  async function handleEditFolder(folder: Folder, values: { name: string; color: string }) {
    setActionError(null);
    setIsMutating(true);
    try {
      const updated = useSeedData
        ? { ...folder, ...values, updated_at: new Date().toISOString() }
        : await (async () => {
            const token = requireToken();
            if (!token) throw new Error('Please sign in to edit this folder.');
            return updateFolder(values, { accessToken: token, folderId: folder.id });
          })();
      setFolders((current) =>
        current.map((item) =>
          item.id === folder.id
            ? { ...updated, task_count: item.task_count, completed_task_count: item.completed_task_count }
            : item,
        ),
      );
      setEditingFolder(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to edit folder.');
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDeleteFolder(folder: Folder) {
    setActionError(null);
    setIsMutating(true);
    try {
      if (!useSeedData) {
        const token = requireToken();
        if (!token) throw new Error('Please sign in to delete this folder.');
        await deleteFolder({ accessToken: token, folderId: folder.id });
      }
      const displacedTasks = tasksByFolder[folder.id] ?? [];
      setInboxTasks((current) => [
        ...current,
        ...displacedTasks.map((task) => ({ ...task, icon: 'tool' as const })),
      ]);
      setTasksByFolder((current) => {
        const next = { ...current };
        delete next[folder.id];
        return next;
      });
      setFolders((current) => current.filter((item) => item.id !== folder.id));
      setDeletingFolder(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to delete folder.');
    } finally {
      setIsMutating(false);
    }
  }

  async function handleMoveTask(task: InboxTask, folderId: string) {
    setActionError(null);
    try {
      if (!useSeedData) {
        const token = requireToken();
        if (!token) return;
        await updateTask(task.id, { project_id: folderId }, { accessToken: token });
      }
      setInboxTasks((current) => current.filter((item) => item.id !== task.id));
      setTasksByFolder((current) => ({
        ...current,
        [folderId]: [...(current[folderId] ?? []), task],
      }));
      setFolders((current) =>
        current.map((folder) =>
          folder.id === folderId
            ? {
                ...folder,
                task_count: (folder.task_count ?? 0) + 1,
                completed_task_count:
                  (folder.completed_task_count ?? 0) + (task.status === 'done' ? 1 : 0),
              }
            : folder,
        ),
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to move task.');
    }
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-end gap-4">
        <button
          className="flex h-11 items-center gap-2 rounded-lg border border-dashboard-accent px-5 font-semibold text-dashboard-accent transition hover:bg-dashboard-accent-soft"
          onClick={() => setIsCreateOpenLocally(true)}
          type="button"
        >
          <PlusIcon className="h-5 w-5" />
          Add Folder
        </button>
      </div>

      <FolderList
        error={loadError}
        folders={folders}
        isLoading={isLoading}
        onAddFolder={() => setIsCreateOpenLocally(true)}
        onDeleteFolder={setDeletingFolder}
        onEditFolder={setEditingFolder}
        onMoveTask={async (sourceFolder, task, destinationFolderId) => {
          try {
            if (!useSeedData) {
              const token = requireToken();
              if (!token) return;
              await updateTask(
                task.id,
                { project_id: destinationFolderId },
                { accessToken: token },
              );
            }

            setTasksByFolder((current) => {
              const next = {
                ...current,
                [sourceFolder.id]: (current[sourceFolder.id] ?? []).filter(
                  (item) => item.id !== task.id,
                ),
              };
              if (destinationFolderId) {
                next[destinationFolderId] = [
                  ...(next[destinationFolderId] ?? []),
                  task,
                ];
              }
              return next;
            });

            if (!destinationFolderId) {
              setInboxTasks((current) => [
                ...current,
                { ...task, icon: 'tool' },
              ]);
            }

            setFolders((current) =>
              current.map((folder) => {
                const completedDelta = task.status === 'done' ? 1 : 0;
                if (folder.id === sourceFolder.id) {
                  return {
                    ...folder,
                    task_count: Math.max(0, (folder.task_count ?? 0) - 1),
                    completed_task_count: Math.max(
                      0,
                      (folder.completed_task_count ?? 0) - completedDelta,
                    ),
                  };
                }
                if (folder.id === destinationFolderId) {
                  return {
                    ...folder,
                    task_count: (folder.task_count ?? 0) + 1,
                    completed_task_count:
                      (folder.completed_task_count ?? 0) + completedDelta,
                  };
                }
                return folder;
              }),
            );
          } catch (error) {
            setActionError(
              error instanceof Error ? error.message : 'Unable to move task.',
            );
          }
        }}
        onTaskToggle={async (folder, task) => {
          const nextStatus = task.status === 'done' ? 'pending' : 'done';
          try {
            if (!useSeedData) {
              const token = requireToken();
              if (!token) return;
              await updateTask(task.id, { status: nextStatus }, { accessToken: token });
            }
            setTasksByFolder((current) => ({
              ...current,
              [folder.id]: (current[folder.id] ?? []).map((item) =>
                item.id === task.id ? { ...item, status: nextStatus } : item,
              ),
            }));
            setFolders((current) =>
              current.map((item) =>
                item.id === folder.id
                  ? {
                      ...item,
                      completed_task_count: Math.max(
                        0,
                        (item.completed_task_count ?? 0) +
                          (nextStatus === 'done' ? 1 : -1),
                      ),
                    }
                  : item,
              ),
            );
          } catch (error) {
            setActionError(error instanceof Error ? error.message : 'Unable to update task.');
          }
        }}
        tasksByFolder={tasksByFolder}
      />

      {actionError ? (
        <p className="mt-4 rounded-lg border border-dashboard-danger/30 bg-dashboard-danger/10 p-4 text-sm text-dashboard-danger">
          {actionError}
        </p>
      ) : null}

      <InboxList
        folders={folders}
        onMoveToFolder={handleMoveTask}
        onRemove={async (task) => {
          try {
            if (!useSeedData) {
              const token = requireToken();
              if (!token) return;
              await deleteTask(task.id, { accessToken: token });
            }
            setInboxTasks((current) => current.filter((item) => item.id !== task.id));
          } catch (error) {
            setActionError(error instanceof Error ? error.message : 'Unable to delete task.');
          }
        }}
        onTaskToggle={async (task) => {
          const nextStatus = task.status === 'done' ? 'pending' : 'done';
          try {
            if (!useSeedData) {
              const token = requireToken();
              if (!token) return;
              await updateTask(task.id, { status: nextStatus }, { accessToken: token });
            }
            setInboxTasks((current) =>
              current.map((item) =>
                item.id === task.id ? { ...item, status: nextStatus } : item,
              ),
            );
          } catch (error) {
            setActionError(error instanceof Error ? error.message : 'Unable to update task.');
          }
        }}
        tasks={inboxTasks}
      />

      <CreateFolderModal
        isOpen={isCreateOpen}
        onClose={closeCreateModal}
        onCreated={(folder) => {
          setFolders((current) => [folder, ...current]);
          setLoadError(null);
        }}
      />
      <EditFolderModal
        error={actionError}
        folder={editingFolder}
        isSaving={isMutating}
        onClose={() => {
          setEditingFolder(null);
          setActionError(null);
        }}
        onSave={handleEditFolder}
      />
      <DeleteFolderDialog
        error={actionError}
        folder={deletingFolder}
        isDeleting={isMutating}
        onCancel={() => {
          setDeletingFolder(null);
          setActionError(null);
        }}
        onConfirm={handleDeleteFolder}
      />
    </>
  );
}
