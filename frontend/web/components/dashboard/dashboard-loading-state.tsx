export function DashboardLoadingState() {
  return (
    <div className="grid min-h-[420px] place-items-center rounded-[var(--radius-lg)] border border-dashboard-border bg-dashboard-surface/65 text-sm text-dashboard-muted">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-dashboard-border border-t-dashboard-accent" />
        <p className="mt-3">Loading dashboard...</p>
      </div>
    </div>
  );
}
