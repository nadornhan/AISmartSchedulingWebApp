import type { ReactNode } from 'react';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function DashboardStatCard({
  accent = 'default',
  icon,
  label,
  meta,
  progress,
  value,
}: Readonly<{
  accent?: 'default' | 'danger' | 'info' | 'muted' | 'warning';
  icon?: ReactNode;
  label: string;
  meta?: string;
  progress?: number | null;
  value: string;
}>) {
  const clampedProgress =
    progress === null || progress === undefined ? null : Math.max(0, Math.min(100, progress));

  return (
    <article className="dashboard-stat-card relative flex aspect-square min-w-0 flex-col justify-between rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-3 shadow-panel sm:p-5 lg:aspect-auto">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:gap-4">
        {icon ? (
          <div
            className={cn(
              'grid h-7 w-7 shrink-0 place-items-center rounded-full sm:h-11 sm:w-11',
              accent === 'danger' && 'bg-[var(--red-soft)] text-[var(--red-light)]',
              accent === 'info' && 'bg-[var(--blue-soft)] text-[var(--blue-light)]',
              accent === 'warning' && 'bg-[var(--orange-soft)] text-[var(--yellow)]',
              accent === 'muted' && 'bg-dashboard-bg/60 text-dashboard-muted',
              accent === 'default' && 'bg-dashboard-accent-soft text-dashboard-accent',
            )}
          >
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-normal text-dashboard-muted lg:text-sm lg:font-medium">
            {label}
          </p>
          <p
            className={cn(
              'mt-1 text-[28px] font-semibold leading-tight tracking-normal sm:mt-2 sm:text-3xl',
              accent === 'danger' && 'text-[var(--red-light)]',
              accent === 'info' && 'text-[var(--blue-light)]',
              accent === 'warning' && 'text-[var(--yellow)]',
              accent === 'muted' && 'text-dashboard-muted',
              accent === 'default' && 'text-dashboard-text',
            )}
          >
            {value}
          </p>
          {meta ? <p className="mt-1 text-xs text-dashboard-subtle lg:mt-2">{meta}</p> : null}
        </div>
      </div>
      {clampedProgress !== null ? (
        <div className="mt-2 h-2 shrink-0 overflow-hidden rounded-full bg-dashboard-bg/80 lg:mt-4">
          <div
            className={cn(
              'h-full rounded-full',
              accent === 'danger' && 'bg-[var(--red-fill)]',
              accent === 'info' && 'bg-[var(--blue-fill)]',
              accent === 'warning' && 'bg-[var(--yellow-fill)]',
              accent !== 'danger' &&
                accent !== 'info' &&
                accent !== 'warning' &&
                'bg-dashboard-accent',
            )}
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
      ) : null}
    </article>
  );
}
