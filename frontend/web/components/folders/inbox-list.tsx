import type { Folder } from '../../lib/folders';
import type { FolderTaskPreview } from './folder-card';

export type InboxTask = FolderTaskPreview & {
  icon: 'calendar' | 'search' | 'tool';
};

type InboxListProps = {
  folders: Folder[];
  tasks: InboxTask[];
  onMoveToFolder?: (task: InboxTask, folderId: string) => void;
  onRemove?: (task: InboxTask) => void;
  onTaskToggle?: (task: InboxTask) => void;
  onViewAll?: () => void;
};

function TaskIcon({ icon }: Readonly<{ icon: InboxTask['icon'] }>) {
  const paths = {
    calendar: (
      <>
        <path d="M7 3v4m10-4v4M4 9h16M5 5h14a2 2 0 0 1 2 2v12H3V7a2 2 0 0 1 2-2Z" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="5.5" />
        <path d="m15 15 5 5" />
      </>
    ),
    tool: <path d="M14 6a4 4 0 0 0-5 5L3 17l4 4 6-6a4 4 0 0 0 5-5l-3 3-3-3 2-4Z" />,
  };

  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
    >
      {paths[icon]}
    </svg>
  );
}

export function InboxList({
  folders,
  tasks,
  onMoveToFolder,
  onRemove,
  onTaskToggle,
  onViewAll,
}: InboxListProps) {
  return (
    <section className="mt-5 rounded-lg border border-dashboard-border bg-dashboard-surface/45 p-5 shadow-panel">
      <header className="flex items-center gap-4 border-b border-dashboard-border pb-5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-dashboard-accent-soft text-dashboard-accent">
          <svg
            aria-hidden="true"
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
            viewBox="0 0 24 24"
          >
            <path d="M4 6h16l2 7v6H2v-6l2-7Z" />
            <path d="M2 13h6l1.5 3h5l1.5-3h6" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-dashboard-text">
            Inbox — Unassigned Tasks
          </h2>
          <p className="mt-1 text-sm leading-5 text-dashboard-muted">
            Tasks without a folder are stored here.
            <br />
            Assign them to stay organized.
          </p>
        </div>
        <span className="rounded-full border border-dashboard-border bg-dashboard-bg/25 px-4 py-2 text-sm text-dashboard-muted">
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </span>
      </header>

      {tasks.length === 0 ? (
        <div className="grid min-h-40 place-items-center text-center">
          <div>
            <p className="font-medium text-dashboard-text">Inbox is empty</p>
            <p className="mt-2 text-sm text-dashboard-muted">
              Tasks without a folder will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div>
          {tasks.map((task) => {
            const completed = task.status === 'done';

            return (
              <div
                className="flex min-h-16 items-center gap-4 border-b border-dashboard-border px-3 last:border-0"
                key={task.id}
              >
                <button
                  aria-label={`${completed ? 'Reopen' : 'Complete'} ${task.title}`}
                  aria-pressed={completed}
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition ${completed ? 'border-dashboard-accent bg-dashboard-accent text-dashboard-bg' : 'border-dashboard-muted hover:border-dashboard-accent'}`}
                  disabled={!onTaskToggle}
                  onClick={() => onTaskToggle?.(task)}
                  type="button"
                >
                  {completed ? <span className="text-xs">✓</span> : null}
                </button>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-dashboard-border bg-dashboard-surface text-dashboard-muted">
                  <TaskIcon icon={task.icon} />
                </span>
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${completed ? 'text-dashboard-muted line-through' : 'text-dashboard-text'}`}
                >
                  {task.title}
                </span>
                <select
                  aria-label={`Move ${task.title} to folder`}
                  className="h-10 w-40 rounded-lg border border-dashboard-border bg-dashboard-bg/35 px-3 text-sm text-dashboard-muted outline-none focus:border-dashboard-accent disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!onMoveToFolder || folders.length === 0}
                  onChange={(event) => {
                    if (event.target.value) onMoveToFolder?.(task, event.target.value);
                  }}
                  value=""
                >
                  <option value="">Move to folder</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
                <button
                  aria-label={`Remove ${task.title}`}
                  className="grid h-9 w-9 place-items-center rounded-lg text-2xl text-dashboard-muted transition hover:bg-dashboard-danger/10 hover:text-dashboard-danger disabled:cursor-default disabled:opacity-40"
                  disabled={!onRemove}
                  onClick={() => onRemove?.(task)}
                  type="button"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {onViewAll && tasks.length > 0 ? (
        <button
          className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-semibold text-dashboard-accent transition hover:text-dashboard-text"
          onClick={onViewAll}
          type="button"
        >
          View all unassigned tasks <span aria-hidden="true">→</span>
        </button>
      ) : null}
    </section>
  );
}
