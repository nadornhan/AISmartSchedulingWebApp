import type { PriorityColumnData } from './priority.types';

export function PrioritySummaryCard({ column }: { column: PriorityColumnData }) {
  return (
    <article className="rounded-xl border border-dashboard-border bg-dashboard-surface/80 px-7 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
      <div className="flex items-center gap-3">
        <FlagIcon className={column.flagColor} />
        <h2 className="text-sm font-semibold text-dashboard-text">{column.title}</h2>
      </div>
      <div className="mt-3 flex items-end gap-3">
        <span className="text-4xl font-medium leading-none text-dashboard-text">{column.tasks.length}</span>
        <span className="pb-0.5 text-md text-dashboard-muted">tasks</span>
      </div>
      <p className="mt-4 text-sm font-medium" style={{ color: column.accent }}>
        {column.description}
      </p>
    </article>
  );
}

function FlagIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" className={`h-5 w-5 fill-current ${className}`} viewBox="0 0 24 24">
      <path d="M5 3.5a1 1 0 0 1 1 1v.7c2.2-1.1 4-.4 5.5.2 1.8.7 3.1 1.2 5.5-.5a1 1 0 0 1 1.6.8v9.2a1 1 0 0 1-.4.8c-3.2 2.3-5.4 1.4-7.3.7-1.7-.7-2.9-1.1-4.9.2v3.9a1 1 0 1 1-2 0v-16a1 1 0 0 1 1-1Z" />
    </svg>
  );
}
