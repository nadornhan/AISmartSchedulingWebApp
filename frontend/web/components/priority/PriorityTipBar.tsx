export function PriorityTipBar() {
  return (
    <aside className="flex flex-wrap items-center gap-3 rounded-xl border border-dashboard-border bg-dashboard-surface/70 px-5 py-4 text-base text-dashboard-muted">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-dashboard-accent/10 text-dashboard-accent">☼</span>
      <p className="min-w-0 flex-1"><span className="font-medium text-dashboard-text">Tip:</span> Focus on high priority tasks first. Break them down and take action!</p>
      <button className="rounded-lg border border-dashboard-accent/40 px-4 py-2 text-sm font-medium text-dashboard-text transition hover:bg-dashboard-accent/10" type="button">
        <span className="mr-2 inline-grid h-4 w-4 place-items-center rounded-full border border-dashboard-muted text-xs">?</span>
        How priority works
      </button>
    </aside>
  );
}
