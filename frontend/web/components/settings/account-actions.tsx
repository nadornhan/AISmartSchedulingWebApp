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
      <div className="divide-y divide-slate-100">
        {actions.map((action) => (
          <div className="flex items-center justify-between gap-4 py-3" key={action.label}>
            <p
              className={`min-w-0 text-sm font-medium ${
                action.destructive ? 'text-red-600' : 'text-slate-950'
              }`}
            >
              {action.label}
            </p>
            <button
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                action.destructive
                  ? 'border-red-200 bg-red-50 text-red-600 focus-visible:outline-red-600'
                  : 'border-slate-200 bg-slate-50 text-slate-700 focus-visible:outline-emerald-600'
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
