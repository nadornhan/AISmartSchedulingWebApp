import { useState } from 'react';
import Link from 'next/link';

import type { DashboardTaskSummary } from '../../lib/dashboard';
import { CalendarIcon, CheckIcon } from '../layout/icons';
import { DashboardTaskCard } from './dashboard-task-card';
import { DashboardPagination } from './dashboard-pagination';
import styles from './quick-wins-card.module.css';

const ITEMS_PER_PAGE = 2;

export function QuickWinsCard({
  completingTaskId,
  onComplete,
  tasks,
}: Readonly<{
  completingTaskId?: string | null;
  onComplete: (taskId: string) => void;
  tasks: DashboardTaskSummary[];
}>) {
  const [selectedPage, setSelectedPage] = useState(0);
  const [flipDirection, setFlipDirection] = useState<'forward' | 'backward'>('forward');
  const pageCount = Math.ceil(tasks.length / ITEMS_PER_PAGE);
  const page = Math.min(selectedPage, Math.max(0, pageCount - 1));
  const visibleTasks = tasks.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  function changePage(nextPage: number) {
    setFlipDirection(nextPage > page ? 'forward' : 'backward');
    setSelectedPage(nextPage);
  }

  return (
    <section className="flex h-[25rem] min-w-0 flex-col rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-dashboard-text">Quick Wins</h2>
        <Link
          className="ml-auto text-sm font-medium text-dashboard-accent hover:underline"
          href="/tasks"
        >
          View all tasks
        </Link>
      </div>

      {tasks.length ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div aria-live="polite" className={styles.slideViewport}>
            <div
              className={[
                styles.slidePage,
                flipDirection === 'forward' ? styles.forward : styles.backward,
              ].join(' ')}
              key={page}
            >
              {visibleTasks.map((task) => (
                <div className="flex items-start gap-3" key={task.id}>
                  <button
                    aria-label={`Complete ${task.title}`}
                    className="mt-4 grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border border-dashboard-border-strong bg-[var(--bg-input)] text-transparent transition hover:border-dashboard-accent hover:bg-dashboard-accent hover:text-dashboard-on-accent disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={completingTaskId === task.id}
                    onClick={() => onComplete(task.id)}
                    type="button"
                  >
                    <CheckIcon className="h-3.5 w-3.5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <DashboardTaskCard compact task={task} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DashboardPagination
            ariaLabel="Quick Wins pages"
            onPageChange={changePage}
            page={page}
            pageCount={pageCount}
          />
        </div>
      ) : (
        <div
          className={`${styles.emptyState} flex flex-1 items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-dashboard-border p-5 text-center`}
        >
          <div className="flex flex-col items-center">
            <span className="mb-3 grid h-12 w-12 place-items-center rounded-xl border border-dashboard-accent/20 bg-dashboard-bg/70 text-dashboard-accent shadow-panel">
              <CalendarIcon aria-hidden="true" className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold text-dashboard-text">No quick wins yet</p>
            <p className="mt-1 max-w-64 text-xs leading-relaxed text-dashboard-muted">
              Tasks estimated at 10 minutes or less will show up here.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
