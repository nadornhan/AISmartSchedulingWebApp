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
    <article className="dashboard-stat-card relative flex aspect-square min-w-0 flex-col justify-between rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-[clamp(0.75rem,4vw,1rem)] shadow-panel [container-type:inline-size] sm:p-6 lg:aspect-auto lg:h-44">
      <div className="flex flex-1 flex-col items-start justify-center gap-2 sm:flex-row sm:gap-4">
        {icon ? (
          <div
            className={cn(
              'grid h-[clamp(1.75rem,17cqi,2rem)] w-[clamp(1.75rem,17cqi,2rem)] shrink-0 place-items-center rounded-full sm:h-11 sm:w-11',
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
          <h2 className="font-poppins text-[clamp(12px,7.2cqi,13px)] font-medium text-dashboard-muted sm:text-sm">{label}</h2>
          <p
            className={cn(
              'relative top-0.5 mt-2 text-[clamp(22px,20cqi,32px)] font-[550] leading-tight tracking-normal sm:top-px sm:mt-3 sm:text-4xl',
              accent === 'danger' && 'text-[var(--red-light)]',
              accent === 'info' && 'text-[var(--blue-light)]',
              accent === 'warning' && 'text-[var(--yellow)]',
              accent === 'muted' && 'text-dashboard-muted',
              accent === 'default' && 'text-dashboard-text',
            )}
          >
            {value}
          </p>
          {meta ? <p className="mt-2 text-[clamp(11px,6.8cqi,12px)] text-dashboard-subtle sm:text-sm lg:mt-3">{meta}</p> : null}
        </div>
      </div>
      {clampedProgress !== null ? (
        <div className="mt-2 h-1.5 shrink-0 overflow-hidden rounded-full bg-dashboard-bg/80 lg:mt-4">
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
