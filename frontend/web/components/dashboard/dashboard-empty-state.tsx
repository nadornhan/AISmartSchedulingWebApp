export function DashboardEmptyState() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-dashboard-border bg-dashboard-surface/45 p-8 text-center">
      <p className="text-base font-semibold text-dashboard-text">No active tasks yet</p>
      <p className="mt-2 text-sm text-dashboard-muted">
        Create a task with a due date or estimate to fill your Dashboard.
      </p>
    </div>
  );
}
