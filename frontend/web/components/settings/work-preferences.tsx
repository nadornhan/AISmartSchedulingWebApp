import { SettingsSection } from './settings-section';

export type WorkPreferencesValue = {
  workStart: string;
  workEnd: string;
  timezone: string;
  pomodoroMinutes: number;
  dailyWorkLimitMinutes: number;
};

type WorkPreferencesProps = {
  value: WorkPreferencesValue;
  onChange: (value: WorkPreferencesValue) => void;
  isDisabled?: boolean;
};

const pomodoroOptions = [15, 20, 25, 30, 45, 60];

export function WorkPreferences({ isDisabled = false, value, onChange }: WorkPreferencesProps) {
  function updateField(field: keyof WorkPreferencesValue, nextValue: string | number) {
    onChange({ ...value, [field]: nextValue });
  }

  return (
    <SettingsSection
      eyebrow="Work pattern"
      title="Work Preferences"
      description="Default planning windows used by the scheduling flow."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="grid gap-2 text-sm font-medium text-dashboard-text">
          Work start
          <input
            className="h-[var(--input-height-desktop)] rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 text-sm text-dashboard-muted outline-none [color-scheme:dark] focus:border-dashboard-accent focus:shadow-[0_0_0_3px_rgba(53,227,181,.1)]"
            disabled={isDisabled}
            onChange={(event) => updateField('workStart', event.target.value)}
            type="time"
            value={value.workStart}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-dashboard-text">
          Work end
          <input
            className="h-[var(--input-height-desktop)] rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 text-sm text-dashboard-muted outline-none [color-scheme:dark] focus:border-dashboard-accent focus:shadow-[0_0_0_3px_rgba(53,227,181,.1)]"
            disabled={isDisabled}
            onChange={(event) => updateField('workEnd', event.target.value)}
            type="time"
            value={value.workEnd}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-dashboard-text">
          Daily scheduling limit
          <div className="relative">
            <input
              className="h-[var(--input-height-desktop)] w-full rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 pr-14 text-sm text-dashboard-muted outline-none focus:border-dashboard-accent focus:shadow-[0_0_0_3px_rgba(53,227,181,.1)]"
              disabled={isDisabled}
              max="24"
              min="0.5"
              onChange={(event) => {
                const hours = event.target.valueAsNumber;
                if (Number.isFinite(hours)) {
                  updateField('dailyWorkLimitMinutes', Math.round(hours * 60));
                }
              }}
              step="0.5"
              type="number"
              value={value.dailyWorkLimitMinutes / 60}
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-dashboard-subtle">
              hours
            </span>
          </div>
          <span className="text-xs font-normal text-dashboard-subtle">
            Maximum task time the scheduler may place in one day.
          </span>
        </label>
        <label className="grid gap-2 text-sm font-medium text-dashboard-text">
          Pomodoro
          <select
            className="h-[var(--input-height-desktop)] rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 text-sm text-dashboard-text outline-none focus:border-dashboard-accent focus:shadow-[0_0_0_3px_rgba(53,227,181,.1)]"
            disabled={isDisabled}
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
        <label className="grid gap-2 text-sm font-medium text-dashboard-text">
          Timezone
          <input
            className="h-[var(--input-height-desktop)] rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 text-sm text-dashboard-muted outline-none focus:border-dashboard-accent focus:shadow-[0_0_0_3px_rgba(53,227,181,.1)]"
            disabled
            value={value.timezone}
          />
        </label>
      </div>
    </SettingsSection>
  );
}
