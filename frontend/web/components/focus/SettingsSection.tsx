import type { ReactNode } from 'react';

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-dashboard-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-dashboard-accent">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
