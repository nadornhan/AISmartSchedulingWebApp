import { SettingsSection } from './settings-section';

export type WorkPreferencesValue = {
  workStart: string;
  workEnd: string;
  pomodoroMinutes: number;
};

type WorkPreferencesProps = {
  value: WorkPreferencesValue;
  onChange: (value: WorkPreferencesValue) => void;
};

const pomodoroOptions = [15, 20, 25, 30, 45, 60];

export function WorkPreferences({ value, onChange }: WorkPreferencesProps) {
  function updateField(field: keyof WorkPreferencesValue, nextValue: string | number) {
    onChange({ ...value, [field]: nextValue });
  }

  return (
    <SettingsSection
      eyebrow="Work pattern"
      title="Work Preferences"
      description="Default planning windows used by the scheduling flow."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Work start
          <input
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            onChange={(event) => updateField('workStart', event.target.value)}
            type="time"
            value={value.workStart}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Work end
          <input
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            onChange={(event) => updateField('workEnd', event.target.value)}
            type="time"
            value={value.workEnd}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Pomodoro
          <select
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            onChange={(event) => updateField('pomodoroMinutes', Number(event.target.value))}
            value={value.pomodoroMinutes}
          >
            {pomodoroOptions.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} min
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-5 flex justify-end">
        <button
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          type="button"
        >
          Save Changes
        </button>
      </div>
    </SettingsSection>
  );
}
