import type { ReactNode } from 'react';

type SettingsSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  eyebrow?: string;
};

export function SettingsSection({ title, description, children, eyebrow }: SettingsSectionProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase text-emerald-700">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
