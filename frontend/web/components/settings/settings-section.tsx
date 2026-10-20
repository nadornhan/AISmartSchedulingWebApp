import type { ReactNode } from 'react';

type SettingsSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  eyebrow?: string;
  showHeader?: boolean;
};

export function SettingsSection({ title, description, children, eyebrow, showHeader = true }: SettingsSectionProps) {
  return (
    <section className={showHeader
      ? 'rounded-[var(--radius-lg)] border border-dashboard-border bg-dashboard-surface/65 p-5 shadow-panel'
      : 'border-0 bg-transparent p-0 shadow-none'}>
      {showHeader ? (
        <div className="mb-5">
          {eyebrow ? (
            <p className="mb-1 text-xs font-semibold uppercase tracking-[var(--tracking-label)] text-dashboard-accent">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="text-lg font-semibold text-dashboard-text">{title}</h2>
          {description ? <p className="mt-1 text-sm text-dashboard-muted">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
