import { SettingsSection } from './settings-section';

const actions = [
  {
    label: 'Change Password',
    buttonLabel: 'Change',
    destructive: false,
  },
  {
    label: 'Export Data',
    buttonLabel: 'Export',
    destructive: false,
  },
  {
    label: 'Delete Account',
    buttonLabel: 'Delete',
    destructive: true,
  },
];

export function AccountActions() {
  return (
    <SettingsSection
      eyebrow="Account"
      title="Account Actions"
      description="Manage access, exports, and destructive account operations."
    >
      <div className="divide-y divide-dashboard-border">
        {actions.map((action) => (
          <div className="flex items-center justify-between gap-4 py-3" key={action.label}>
            <p
              className={`min-w-0 text-sm font-medium ${
                action.destructive ? 'text-[var(--red-light)]' : 'text-dashboard-text'
              }`}
            >
              {action.label}
            </p>
            <button
              className={`shrink-0 rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                action.destructive
                  ? 'border-[var(--red-border)] bg-[var(--red-soft)] text-[var(--red-light)] hover:border-[var(--red-light)] focus-visible:outline-[var(--red)]'
                  : 'border-dashboard-border bg-[var(--bg-input)] text-dashboard-muted hover:border-dashboard-border-strong hover:text-dashboard-text focus-visible:outline-dashboard-accent'
              }`}
              type="button"
            >
              {action.buttonLabel}
            </button>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}
