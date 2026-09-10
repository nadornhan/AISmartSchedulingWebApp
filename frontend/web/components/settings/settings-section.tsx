import type { ReactNode } from 'react';

type SettingsSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  eyebrow?: string;
};

export function SettingsSection({ title, description, children, eyebrow }: SettingsSectionProps) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-dashboard-border bg-dashboard-surface/65 p-5 shadow-panel">
      <div className="mb-5">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[var(--tracking-label)] text-dashboard-accent">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-lg font-semibold text-dashboard-text">{title}</h2>
        {description ? <p className="mt-1 text-sm text-dashboard-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
