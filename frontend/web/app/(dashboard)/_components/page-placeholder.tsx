type PagePlaceholderProps = {
  eyebrow: string;
  summary: string;
  items: string[];
};

export function PagePlaceholder({ eyebrow, summary, items }: PagePlaceholderProps) {
  return (
    <section className="mx-auto grid max-w-7xl gap-6">
      <div className="rounded-lg border border-dashboard-border bg-dashboard-surface/70 p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.02em] text-dashboard-accent">
          {eyebrow}
        </p>
        <p className="mt-3 max-w-3xl text-base leading-7 text-dashboard-muted">{summary}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <div
            className="rounded-lg border border-dashboard-border bg-dashboard-surface/55 p-5 text-dashboard-text transition hover:border-dashboard-accent/50"
            key={item}
          >
            <p className="text-sm font-medium text-dashboard-muted">{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
