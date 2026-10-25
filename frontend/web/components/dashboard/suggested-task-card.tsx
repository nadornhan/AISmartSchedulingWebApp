import Link from 'next/link';

import type { DashboardTaskSummary } from '../../lib/dashboard';
import { DashboardTaskCard } from './dashboard-task-card';

function SparkleStarsIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-9 shrink-0 text-dashboard-accent sm:size-10"
      fill="currentColor"
      viewBox="0 0 48 48"
    >
      <path d="M17 2c2.3 10.7 5.3 13.7 16 16-10.7 2.3-13.7 5.3-16 16C14.7 23.3 11.7 20.3 1 18 11.7 15.7 14.7 12.7 17 2Z" />
      <path d="M38 3c1.1 5.1 2.6 6.6 7.7 7.7-5.1 1.1-6.6 2.6-7.7 7.7-1.1-5.1-2.6-6.6-7.7-7.7C35.4 9.6 36.9 8.1 38 3Z" />
      <path d="M36 25c1.2 5.8 2.9 7.5 8.7 8.7-5.8 1.2-7.5 2.9-8.7 8.7-1.2-5.8-2.9-7.5-8.7-8.7 5.8-1.2 7.5-2.9 8.7-8.7Z" />
    </svg>
  );
}

export function SuggestedTaskCard({
  task,
}: Readonly<{
  task: DashboardTaskSummary | null;
}>) {
  return (
    <section
      aria-label="AI Pick for Today"
      className="relative isolate flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-dashboard-accent/20 bg-dashboard-surface px-5 pb-4 pt-6 shadow-panel lg:p-6"
    >
      <div
        aria-hidden="true"
        className="suggested-task-card-background pointer-events-none absolute inset-x-0 top-0 z-0 h-56 bg-[url('/images/dashboard/ai-suggestion-mountains-v2.webp')] bg-cover bg-[position:right_42%]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-56"
        style={{
          backgroundImage:
            'linear-gradient(90deg, rgb(var(--dashboard-surface-rgb) / 0.82) 0%, rgb(var(--dashboard-surface-rgb) / 0.58) 56%, rgb(var(--dashboard-surface-rgb) / 0.22) 100%), linear-gradient(0deg, rgb(var(--dashboard-surface-rgb)) 0%, rgb(var(--dashboard-surface-rgb) / 0.58) 27%, transparent 72%)',
        }}
      />
      <div className="relative z-10 mb-5 min-w-0 space-y-3 sm:mb-6">
        <div className="flex items-center gap-3">
          <SparkleStarsIcon />
          <h2 className="whitespace-nowrap font-poppins text-[21px] font-semibold leading-tight text-dashboard-text sm:text-2xl lg:text-[28px]">
            AI Pick for Today
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-dashboard-muted lg:text-base">
          Your next step, picked from your tasks, priorities, and deadlines.
        </p>
      </div>
      {task ? (
        <div className="relative z-10 flex flex-1 flex-col gap-4 sm:gap-5">
          <Link
            aria-label={`View task: ${task.title}`}
            className="block rounded-[var(--radius-md)] transition hover:ring-1 hover:ring-dashboard-accent/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent"
            href={`/tasks?task_id=${encodeURIComponent(task.id)}`}
          >
            <DashboardTaskCard compact task={task} variant="recommendation" />
          </Link>
          <Link
            className="flex min-h-12 w-full shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-dashboard-accent px-4 py-3 text-base font-semibold text-dashboard-on-accent transition hover:bg-dashboard-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent sm:min-h-14 sm:text-lg lg:mt-auto"
            href={`/tasks?task_id=${encodeURIComponent(task.id)}`}
          >
            View task
          </Link>
        </div>
      ) : (
        <p
          className="relative z-10 rounded-[var(--radius-sm)] border border-dashboard-border p-4 text-sm text-dashboard-muted"
          role="status"
        >
          No open task to suggest.
        </p>
      )}
    </section>
  );
}
