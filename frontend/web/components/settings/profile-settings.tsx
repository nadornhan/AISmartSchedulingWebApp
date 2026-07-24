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
        <div className="flex flex-col items-start gap-4 rounded-lg bg-emerald-50 p-4 sm:flex-row sm:items-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-emerald-600 text-base font-semibold text-white">
            {initials || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-950">{displayName}</p>
            <p className="text-sm text-slate-500">{value.role}</p>
          </div>
          <button
            className="rounded-lg border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            type="button"
          >
            Change Photo
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            First name
            <input
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => updateField('firstName', event.target.value)}
              value={value.firstName}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Last name
            <input
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => updateField('lastName', event.target.value)}
              value={value.lastName}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
            Email
            <input
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
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
