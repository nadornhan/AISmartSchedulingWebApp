import Link from 'next/link';
import { Sparkles } from 'lucide-react';

import type { DashboardForestSummary, DashboardTaskSummary } from '../../lib/dashboard';
import { PlantVisual } from '../gamification/plant-visual';
import { DashboardTaskCard } from './dashboard-task-card';

export function SuggestedTaskCard({
  task,
  forest,
}: Readonly<{
  task: DashboardTaskSummary | null;
  forest?: DashboardForestSummary | null;
}>) {
  return (
    <section
      aria-label="AI Pick for Today"
      className="flex min-w-0 flex-col rounded-[var(--radius-md)] border border-dashboard-accent/20 bg-dashboard-surface/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.08)_0%,transparent_45%),linear-gradient(155deg,transparent_20%,var(--dashboard-accent-soft)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl lg:p-6"
    >
      <div className="relative mb-4 min-h-[72px] min-w-0 pr-[88px] lg:mb-6 lg:min-h-[144px] lg:pr-40">
        <div className="ml-1 min-w-0 space-y-2 lg:ml-0">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-dashboard-accent/15 bg-dashboard-accent/10 lg:h-11 lg:w-11">
            <Sparkles aria-hidden="true" className="h-5 w-5 text-dashboard-accent lg:h-6 lg:w-6" />
          </span>
          <h2 className="!mt-4 ml-1 text-xl font-semibold text-dashboard-text lg:!mt-5 lg:text-3xl">
            AI Pick for Today
          </h2>
          <p className="ml-1 max-w-sm text-sm leading-6 text-dashboard-muted">
            Your next step, picked from your tasks, priorities, and deadlines.
          </p>
        </div>
        <div className="pointer-events-none absolute right-0 top-0 h-[72px] w-[72px] lg:h-[144px] lg:w-[144px]">
          <PlantVisual
            className="!h-full !w-full [&>svg]:h-full [&>svg]:w-full"
            size={144}
            speciesKey={forest?.species_name?.toLowerCase().replace(/\s+/g, '_')}
            stage={forest?.growth_stage || 'seedling'}
          />
        </div>
      </div>
      {task ? (
        <div className="flex flex-1 flex-col gap-4 lg:gap-6">
          <Link
            aria-label={`View task: ${task.title}`}
            className="block rounded-[var(--radius-sm)] transition hover:ring-1 hover:ring-dashboard-accent/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent lg:[&_article]:p-5 lg:[&_h3]:text-xl lg:[&_h3]:leading-7"
            href={`/tasks?task_id=${encodeURIComponent(task.id)}`}
          >
            <DashboardTaskCard compact task={task} />
          </Link>
          <Link
            className="flex min-h-10 w-full shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-dashboard-accent px-4 py-2 text-sm font-semibold text-dashboard-on-accent transition hover:bg-dashboard-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent lg:mt-auto lg:min-h-12"
            href={`/tasks?task_id=${encodeURIComponent(task.id)}`}
          >
            View task
          </Link>
        </div>
      ) : (
        <p
          className="rounded-[var(--radius-sm)] border border-dashboard-border p-4 text-sm text-dashboard-muted"
          role="status"
        >
          No open task to suggest.
        </p>
      )}
    </section>
  );
}
