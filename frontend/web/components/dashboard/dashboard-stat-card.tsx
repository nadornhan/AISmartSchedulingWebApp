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
    progress === null || progress === undefined
      ? null
      : Math.max(0, Math.min(100, progress));

  return (
    <article className="rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-4 shadow-panel sm:p-5">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:gap-4">
        {icon ? (
          <div
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-full sm:h-11 sm:w-11',
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
          <p className="text-sm font-medium text-dashboard-muted">{label}</p>
          <p
            className={cn(
              'mt-1 text-2xl font-semibold tracking-normal sm:mt-2 sm:text-3xl',
              accent === 'danger' && 'text-[var(--red-light)]',
              accent === 'info' && 'text-[var(--blue-light)]',
              accent === 'warning' && 'text-[var(--yellow)]',
              accent === 'muted' && 'text-dashboard-muted',
              accent === 'default' && 'text-dashboard-text',
            )}
          >
            {value}
          </p>
          {meta ? <p className="mt-2 text-xs text-dashboard-subtle">{meta}</p> : null}
        </div>
      </div>
      {clampedProgress !== null ? (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-dashboard-bg/80">
          <div
            className={cn(
              'h-full rounded-full',
              accent === 'danger' && 'bg-[var(--red-light)]',
              accent === 'info' && 'bg-[var(--blue-light)]',
              accent === 'warning' && 'bg-[var(--yellow)]',
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
