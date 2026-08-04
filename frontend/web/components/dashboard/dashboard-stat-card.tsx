function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function DashboardStatCard({
  accent = 'default',
  label,
  meta,
  value,
}: Readonly<{
  accent?: 'default' | 'danger' | 'info' | 'muted';
  label: string;
  meta?: string;
  value: string;
}>) {
  return (
    <article className="rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-5 shadow-panel">
      <p className="text-sm font-medium text-dashboard-muted">{label}</p>
      <p
        className={cn(
          'mt-3 text-3xl font-semibold tracking-normal',
          accent === 'danger' && 'text-[var(--red-light)]',
          accent === 'info' && 'text-[var(--blue-light)]',
          accent === 'muted' && 'text-dashboard-muted',
          accent === 'default' && 'text-dashboard-text',
        )}
      >
        {value}
      </p>
      {meta ? <p className="mt-2 text-xs text-dashboard-subtle">{meta}</p> : null}
    </article>
  );
}
