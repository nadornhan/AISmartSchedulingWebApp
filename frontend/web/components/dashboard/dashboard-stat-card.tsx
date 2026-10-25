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
    <article className="dashboard-stat-card relative flex min-h-[170px] min-w-0 flex-col rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 px-5 py-[clamp(0.75rem,3.6vw,1rem)] shadow-panel [container-type:inline-size] sm:p-5">
      <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:gap-[13px]">
        {icon ? (
          <div
            className={cn(
              'grid h-[clamp(1.75rem,16cqi,1.9rem)] w-[clamp(1.75rem,16cqi,1.9rem)] shrink-0 place-items-center rounded-full [&>svg]:h-4 [&>svg]:w-4 sm:h-[42px] sm:w-[42px] sm:[&>svg]:h-[18px] sm:[&>svg]:w-[18px]',
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
          <h2 className="font-poppins text-[clamp(14px,calc(3.96cqi+3px),17.3px)] font-medium text-dashboard-muted sm:text-[17.3px]">
            {label}
          </h2>
          <p
            className={cn(
              'relative top-0.5 mt-1.5 text-[clamp(19.8px,17.6cqi,28.6px)] font-[550] leading-tight tracking-normal sm:top-px sm:mt-[10px] sm:text-[31.9px]',
              accent === 'danger' && 'text-[var(--red-light)]',
              accent === 'info' && 'text-[var(--blue-light)]',
              accent === 'warning' && 'text-[var(--yellow)]',
              accent === 'muted' && 'text-dashboard-muted',
              accent === 'default' && 'text-dashboard-text',
            )}
          >
            {value}
          </p>
          {meta ? (
            <p className="mt-1.5 text-[clamp(14px,calc(3.96cqi+3px),17.3px)] text-dashboard-subtle sm:text-[17.3px] lg:mt-[10px]">
              {meta}
            </p>
          ) : null}
        </div>
      </div>
      {clampedProgress !== null ? (
        <div className="mt-3 h-[5px] shrink-0 overflow-hidden rounded-full bg-dashboard-bg/80">
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
