import type { PriorityColumnData } from './priority.types';
import { PriorityTaskCard } from './PriorityTaskCard';

type Props = {
  column: PriorityColumnData;
  onAddTask: (columnId: PriorityColumnData['id']) => void;
  onToggle: (id: string) => void;
};

export function PriorityColumn({ column, onAddTask, onToggle }: Props) {
  return (
    <section
      className="flex min-h-[480px] flex-col overflow-hidden rounded-xl border bg-dashboard-surface/55"
      style={{ borderColor: `rgb(${column.accentRgb} / .32)` }}
    >
      <header className="flex h-16 items-center gap-2 border-b border-dashboard-border px-5" style={{ borderLeft: `3px solid ${column.accent}` }}>
        <h2 className="text-md font-semibold" style={{ color: column.accent }}>{column.title}</h2>
        <span className="grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-semibold" style={{ color: column.accent, background: `rgb(${column.accentRgb} / .13)` }}>
          {column.tasks.length}
        </span>
        <button aria-label={`More ${column.title} options`} className="ml-auto px-1 text-xl leading-none text-dashboard-muted hover:text-dashboard-text" type="button">⋮</button>
      </header>

      <div className="flex flex-1 flex-col p-2.5">
        <div className="space-y-2.5">
          {column.tasks.map((task) => (
            <PriorityTaskCard accent={column.accent} key={task.id} onToggle={onToggle} task={task} />
          ))}
        </div>
        <button
          className="mx-auto mt-3 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition hover:bg-white/5"
          onClick={() => onAddTask(column.id)}
          style={{ color: column.accent }}
          type="button"
        >
          <span className="text-lg leading-none">+</span> Add task
        </button>
      </div>
    </section>
  );
}
