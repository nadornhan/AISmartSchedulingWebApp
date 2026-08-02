import type { PriorityTask } from './priority.types';

type PriorityTaskCardProps = {
  task: PriorityTask;
  accent: string;
  onToggle: (id: string) => void;
};

export function PriorityTaskCard({ task, accent, onToggle }: PriorityTaskCardProps) {
  return (
    <article className="min-h-[92px] rounded-xl border border-dashboard-border bg-dashboard-raised/90 px-4 py-3.5 transition hover:-translate-y-0.5 hover:border-dashboard-border-strong">
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label={`Complete ${task.title}`}
          aria-pressed={task.completed}
          onClick={() => onToggle(task.id)}
          className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border border-dashboard-muted transition"
          style={task.completed ? { borderColor: accent, backgroundColor: accent } : undefined}
        >
          {task.completed ? (
            <span className="text-[10px] font-bold text-dashboard-bg">✓</span>
          ) : null}
        </button>

        <div className="min-w-0 flex-1">
          <h3
            className={`truncate text-[15px] font-medium leading-5 text-dashboard-text ${task.completed ? 'line-through opacity-50' : ''}`}
          >
            {task.title}
          </h3>

          {task.dueDate ? (
            <p
              className={
                task.overdue
                  ? 'mt-1 text-[13px] font-medium leading-4 text-dashboard-danger'
                  : 'mt-1 text-[13px] font-medium leading-4'
              }
              style={!task.overdue ? { color: accent } : undefined}
            >
              {task.dueDate}
            </p>
          ) : null}

          <div className="mt-2.5 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: task.folderColor }} />

            <span className="text-[13px] leading-4 text-dashboard-muted">{task.folder}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
