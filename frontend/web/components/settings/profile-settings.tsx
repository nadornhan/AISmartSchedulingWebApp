import { SettingsSection } from './settings-section';

export type ProfileSettingsValue = {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

type ProfileSettingsProps = {
  value: ProfileSettingsValue;
  onChange: (value: ProfileSettingsValue) => void;
};

export function ProfileSettings({ value, onChange }: ProfileSettingsProps) {
  const initials = `${value.firstName.at(0) ?? ''}${value.lastName.at(0) ?? ''}`.toUpperCase();
  const displayName = `${value.firstName} ${value.lastName}`.trim() || 'New User';

  function updateField(field: keyof ProfileSettingsValue, nextValue: string) {
    onChange({ ...value, [field]: nextValue });
  }

  return (
    <SettingsSection
      eyebrow="Profile"
      title="Profile Settings"
      description="Keep account details ready for scheduling and reminders."
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-start gap-4 rounded-[var(--radius-md)] border border-dashboard-border bg-[var(--bg-surface-raised)] p-4 sm:flex-row sm:items-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-dashboard-accent to-dashboard-accent-strong text-base font-semibold text-[#04110d] shadow-glow">
            {initials || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-dashboard-text">{displayName}</p>
            <p className="text-sm text-dashboard-muted">{value.role}</p>
          </div>
          <button
            className="rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-3 py-2 text-sm font-medium text-dashboard-text transition hover:border-dashboard-accent/50 hover:text-dashboard-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent"
            type="button"
          >
            Change Photo
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-dashboard-text">
            First name
            <input
              className="h-[var(--input-height-desktop)] rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 text-sm text-dashboard-text outline-none placeholder:text-[var(--text-placeholder)] focus:border-dashboard-accent focus:shadow-[0_0_0_3px_rgba(53,227,181,.1)]"
              onChange={(event) => updateField('firstName', event.target.value)}
              value={value.firstName}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-dashboard-text">
            Last name
            <input
              className="h-[var(--input-height-desktop)] rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 text-sm text-dashboard-text outline-none placeholder:text-[var(--text-placeholder)] focus:border-dashboard-accent focus:shadow-[0_0_0_3px_rgba(53,227,181,.1)]"
              onChange={(event) => updateField('lastName', event.target.value)}
              value={value.lastName}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-dashboard-text sm:col-span-2">
            Email
            <input
              className="h-[var(--input-height-desktop)] rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 text-sm text-dashboard-text outline-none placeholder:text-[var(--text-placeholder)] focus:border-dashboard-accent focus:shadow-[0_0_0_3px_rgba(53,227,181,.1)]"
              onChange={(event) => updateField('email', event.target.value)}
              type="email"
              value={value.email}
            />
          </label>
        </div>
      </div>
    </SettingsSection>
  );
}
