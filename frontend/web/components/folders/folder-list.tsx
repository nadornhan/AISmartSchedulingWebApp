import type { Folder } from '../../lib/folders';
import { FolderCard, type FolderTaskPreview } from './folder-card';

export type TasksByFolder = Record<string, FolderTaskPreview[]>;

type FolderListProps = {
  folders: Folder[];
  tasksByFolder?: TasksByFolder;
  error?: string | null;
  isLoading?: boolean;
  onAddFolder?: () => void;
  onDeleteFolder?: (folder: Folder) => void;
  onEditFolder?: (folder: Folder) => void;
  onMoveTask?: (
    sourceFolder: Folder,
    task: FolderTaskPreview,
    destinationFolderId: string | null,
  ) => void;
  onTaskToggle?: (folder: Folder, task: FolderTaskPreview) => void;
  onViewFolder?: (folder: Folder) => void;
};

function FolderCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="min-h-[360px] animate-pulse rounded-lg border border-dashboard-border bg-dashboard-surface/55 p-5"
    >
      <div className="flex items-center gap-3">
        <span className="h-5 w-5 rounded-full bg-dashboard-raised" />
        <span className="h-6 w-28 rounded bg-dashboard-raised" />
      </div>
      <div className="mt-4 h-4 w-36 rounded bg-dashboard-raised" />
      <div className="mt-6 h-1.5 rounded-full bg-dashboard-raised" />
      <div className="mt-6 space-y-3">
        <div className="h-12 rounded-lg bg-dashboard-raised" />
        <div className="h-12 rounded-lg bg-dashboard-raised" />
        <div className="h-12 rounded-lg bg-dashboard-raised" />
      </div>
    </div>
  );
}

export function FolderList({
  folders,
  tasksByFolder = {},
  error = null,
  isLoading = false,
  onAddFolder,
  onDeleteFolder,
  onEditFolder,
  onMoveTask,
  onTaskToggle,
  onViewFolder,
}: FolderListProps) {
  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading folders"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        <FolderCardSkeleton />
        <FolderCardSkeleton />
        <FolderCardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-dashboard-danger/30 bg-dashboard-danger/10 px-6 py-8 text-center"
        role="alert"
      >
        <p className="font-semibold text-dashboard-danger">Unable to load folders</p>
        <p className="mt-2 text-sm text-dashboard-muted">{error}</p>
      </div>
    );
  }

  if (folders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-dashboard-border-strong bg-dashboard-surface/35 px-6 py-12 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-dashboard-accent-soft text-2xl text-dashboard-accent">
          ▱
        </span>
        <h2 className="mt-4 text-xl font-semibold text-dashboard-text">No folders yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-dashboard-muted">
          Create a folder to group related tasks and track their progress.
        </p>
        {onAddFolder ? (
          <button
            className="mt-6 h-11 rounded-lg bg-dashboard-accent px-5 font-semibold text-dashboard-bg transition hover:brightness-110"
            onClick={onAddFolder}
            type="button"
          >
            + Create Folder
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {folders.map((folder) => (
        <FolderCard
          folder={folder}
          folderOptions={folders}
          key={folder.id}
          onDelete={onDeleteFolder}
          onEdit={onEditFolder}
          onTaskToggle={
            onTaskToggle
              ? (task) => onTaskToggle(folder, task)
              : undefined
          }
          onMoveTask={
            onMoveTask
              ? (task, destinationFolderId) =>
                  onMoveTask(folder, task, destinationFolderId)
              : undefined
          }
          onViewAll={onViewFolder}
          tasks={tasksByFolder[folder.id] ?? []}
        />
      ))}
    </div>
  );
}
