import type { Folder } from '../../lib/folders';
import type { TaskPriority, TaskStatus } from '../../lib/tasks';

export type TaskFilterValues = {
  status: TaskStatus | '';
  priority: TaskPriority | '';
  projectId: string;
};

type TaskFiltersProps = {
  folders: Folder[];
  values: TaskFilterValues;
  onChange: (values: TaskFilterValues) => void;
  onClear: () => void;
};

const controlClass =
  'h-11 rounded-lg border border-dashboard-border bg-dashboard-surface px-3 text-sm text-dashboard-muted outline-none focus:border-dashboard-accent';

export function TaskFilters({ folders, values, onChange, onClear }: TaskFiltersProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-dashboard-border bg-dashboard-surface/45 p-4">
      <select
        aria-label="Filter by status"
        className={controlClass}
        onChange={(event) =>
          onChange({ ...values, status: event.target.value as TaskFilterValues['status'] })
        }
        value={values.status}
      >
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="in_progress">In progress</option>
        <option value="done">Done</option>
        <option value="overdue">Overdue</option>
      </select>
      <select
        aria-label="Filter by priority"
        className={controlClass}
        onChange={(event) =>
          onChange({
            ...values,
            priority: event.target.value as TaskFilterValues['priority'],
          })
        }
        value={values.priority}
      >
        <option value="">All priorities</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
        <option value="no_priority">No priority</option>
      </select>
      <select
        aria-label="Filter by folder"
        className={controlClass}
        onChange={(event) => onChange({ ...values, projectId: event.target.value })}
        value={values.projectId}
      >
        <option value="">All folders</option>
        <option value="inbox">Inbox</option>
        {folders.map((folder) => (
          <option key={folder.id} value={folder.id}>
            {folder.name}
          </option>
        ))}
      </select>
      <button
        className="h-11 rounded-lg px-4 text-sm font-medium text-dashboard-muted transition hover:bg-dashboard-raised hover:text-dashboard-text"
        onClick={onClear}
        type="button"
      >
        Clear filters
      </button>
    </div>
  );
}
