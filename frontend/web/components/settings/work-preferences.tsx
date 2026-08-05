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
        <label className="grid gap-2 text-sm font-medium text-dashboard-text">
          Work start
          <input
            className="h-[var(--input-height-desktop)] rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 text-sm text-dashboard-muted outline-none [color-scheme:dark] focus:border-dashboard-accent focus:shadow-[0_0_0_3px_rgba(53,227,181,.1)]"
            onChange={(event) => updateField('workStart', event.target.value)}
            type="time"
            value={value.workStart}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-dashboard-text">
          Work end
          <input
            className="h-[var(--input-height-desktop)] rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 text-sm text-dashboard-muted outline-none [color-scheme:dark] focus:border-dashboard-accent focus:shadow-[0_0_0_3px_rgba(53,227,181,.1)]"
            onChange={(event) => updateField('workEnd', event.target.value)}
            type="time"
            value={value.workEnd}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-dashboard-text">
          Pomodoro
          <select
            className="h-[var(--input-height-desktop)] rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 text-sm text-dashboard-text outline-none focus:border-dashboard-accent focus:shadow-[0_0_0_3px_rgba(53,227,181,.1)]"
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
          className="h-11 rounded-[var(--radius-sm)] bg-gradient-to-r from-dashboard-accent to-dashboard-accent-strong px-5 text-sm font-semibold text-[#04110d] shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent"
          type="button"
        >
          Save Changes
        </button>
      </div>
    </SettingsSection>
  );
}
