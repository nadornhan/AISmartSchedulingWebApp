import { useState } from 'react';
import Link from 'next/link';

import type { DashboardTaskSummary } from '../../lib/dashboard';
import { DashboardTaskCard } from './dashboard-task-card';
import { DashboardPagination } from './dashboard-pagination';

const ITEMS_PER_PAGE = 2;

export function InProgressList({
  tasks,
}: Readonly<{
  tasks: DashboardTaskSummary[];
}>) {
  const [selectedPage, setSelectedPage] = useState(0);
  const pageCount = Math.ceil(tasks.length / ITEMS_PER_PAGE);
  const page = Math.min(selectedPage, Math.max(0, pageCount - 1));
  const visibleTasks = tasks.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  return (
    <section className="flex h-[31rem] min-w-0 flex-col rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-dashboard-text">In Progress</h2>
        <Link
          className="ml-auto text-sm font-medium text-dashboard-accent hover:underline"
          href="/tasks"
        >
          View all
        </Link>
        <span className="rounded-[var(--radius-pill)] bg-dashboard-bg/60 px-3 py-1 text-xs font-medium text-dashboard-muted">
          {tasks.length}
        </span>
      </div>

      {tasks.length ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {visibleTasks.map((task) => (
            <DashboardTaskCard compact key={task.id} showOverdue={false} task={task} />
          ))}
          <DashboardPagination
            ariaLabel="In Progress pages"
            onPageChange={setSelectedPage}
            page={page}
            pageCount={pageCount}
          />
        </div>
      ) : (
        <p className="flex flex-1 items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-dashboard-border bg-dashboard-bg/25 p-5 text-sm text-dashboard-muted">
          No tasks are currently in progress.
        </p>
      )}
    </section>
  );
}
