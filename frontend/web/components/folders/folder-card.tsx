import type { Folder } from '../../lib/folders';

export type FolderTaskPreview = {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'done' | 'overdue';
  priority: 'no_priority' | 'low' | 'medium' | 'high';
};

type FolderCardProps = {
  folder: Folder;
  folderOptions?: Folder[];
  tasks: FolderTaskPreview[];
  onDelete?: (folder: Folder) => void;
  onEdit?: (folder: Folder) => void;
  onTaskToggle?: (task: FolderTaskPreview) => void;
  onMoveTask?: (task: FolderTaskPreview, destinationFolderId: string | null) => void;
  onViewAll?: (folder: Folder) => void;
};

const priorityStyles: Record<FolderTaskPreview['priority'], string> = {
  no_priority: 'bg-dashboard-surface text-dashboard-muted',
  low: 'bg-dashboard-accent-soft text-dashboard-accent',
  medium: 'bg-dashboard-warning/15 text-dashboard-warning',
  high: 'bg-dashboard-danger/15 text-dashboard-danger',
};

const priorityLabels: Record<FolderTaskPreview['priority'], string> = {
  no_priority: 'None',
  low: 'Low',
  medium: 'Med',
  high: 'High',
};

function EditIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="m14.5 5.5 4 4M5 19l3.7-.7L19 8a2.1 2.1 0 0 0-3-3L5.7 15.3 5 19Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function FolderCard({
  folder,
  folderOptions = [],
  tasks,
  onDelete,
  onEdit,
  onTaskToggle,
  onMoveTask,
  onViewAll,
}: FolderCardProps) {
  const taskCount = folder.task_count ?? tasks.length;
  const completedCount =
    folder.completed_task_count ?? tasks.filter((task) => task.status === 'done').length;
  const progress =
    taskCount === 0 ? 0 : Math.round((completedCount / taskCount) * 100);
  const previewTasks = tasks.slice(0, 3);

  return (
    <article className="flex min-h-[360px] flex-col rounded-lg border border-dashboard-border bg-dashboard-surface/55 p-5 shadow-panel">
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="h-5 w-5 shrink-0 rounded-full"
          style={{ backgroundColor: folder.color }}
        />
        <h2 className="min-w-0 flex-1 truncate text-xl font-semibold text-dashboard-text">
          {folder.name}
        </h2>
        <button
          aria-label={`Edit ${folder.name}`}
          className="grid h-9 w-9 place-items-center rounded-lg text-dashboard-muted transition hover:bg-dashboard-raised hover:text-dashboard-text disabled:cursor-default disabled:opacity-40"
          disabled={!onEdit}
          onClick={() => onEdit?.(folder)}
          type="button"
        >
          <EditIcon />
        </button>
        <button
          aria-label={`Delete ${folder.name}`}
          className="grid h-9 w-9 place-items-center rounded-lg text-dashboard-muted transition hover:bg-dashboard-danger/10 hover:text-dashboard-danger disabled:cursor-default disabled:opacity-40"
          disabled={!onDelete}
          onClick={() => onDelete?.(folder)}
          type="button"
        >
          <DeleteIcon />
        </button>
      </header>

      <p className="mt-2 text-sm text-dashboard-muted">
        {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
        <span className="mx-2">•</span>
        {completedCount} completed
      </p>

      <div className="mt-5 flex items-center gap-3">
        <div
          aria-label={`${progress}% completed`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-dashboard-raised"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-dashboard-accent transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="w-10 text-right text-sm text-dashboard-muted">{progress}%</span>
      </div>

      <div className="mt-5 space-y-2.5">
        {previewTasks.map((task) => {
          const completed = task.status === 'done';

          return (
            <div
              className="flex h-12 items-center gap-3 rounded-lg border border-dashboard-border bg-dashboard-bg/35 px-3"
              key={task.id}
            >
              <button
                aria-label={`${completed ? 'Reopen' : 'Complete'} ${task.title}`}
                aria-pressed={completed}
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border transition ${completed ? 'border-dashboard-accent bg-dashboard-accent text-dashboard-bg' : 'border-dashboard-muted hover:border-dashboard-accent'}`}
                disabled={!onTaskToggle}
                onClick={() => onTaskToggle?.(task)}
                type="button"
              >
                {completed ? <span className="text-[10px] leading-none">✓</span> : null}
              </button>
              <span
                className={`min-w-0 flex-1 truncate text-sm ${completed ? 'text-dashboard-muted line-through' : 'text-dashboard-text'}`}
              >
                {task.title}
              </span>
              {onMoveTask ? (
                <select
                  aria-label={`Move ${task.title}`}
                  className="h-8 max-w-28 rounded-md border border-dashboard-border bg-dashboard-bg px-2 text-xs text-dashboard-muted outline-none focus:border-dashboard-accent"
                  onChange={(event) => {
                    if (event.target.value === 'inbox') onMoveTask(task, null);
                    else if (event.target.value) onMoveTask(task, event.target.value);
                  }}
                  value=""
                >
                  <option value="">Move</option>
                  <option value="inbox">Inbox</option>
                  {folderOptions
                    .filter((option) => option.id !== folder.id)
                    .map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                </select>
              ) : null}
              <span
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${priorityStyles[task.priority]}`}
              >
                {priorityLabels[task.priority]}
              </span>
            </div>
          );
        })}

        {previewTasks.length === 0 ? (
          <div className="grid h-[134px] place-items-center rounded-lg border border-dashed border-dashboard-border text-sm text-dashboard-muted">
            No tasks in this folder
          </div>
        ) : null}
      </div>

      <button
        className="mt-auto flex items-center justify-center gap-2 pt-6 text-sm font-semibold text-dashboard-accent transition hover:text-dashboard-text disabled:cursor-default disabled:opacity-40"
        disabled={!onViewAll}
        onClick={() => onViewAll?.(folder)}
        type="button"
      >
        View all tasks <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}
