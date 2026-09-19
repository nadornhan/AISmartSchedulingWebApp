'use client';

import { useUiPreferences, type ColorTheme } from '../layout/ui-preferences-provider';
import { SettingsSection } from './settings-section';

const themeOptions: Array<{
  value: ColorTheme;
  label: string;
  description: string;
}> = [
  {
    value: 'dark',
    label: 'Dark',
    description: 'The current Chrono theme, designed for deep focus.',
  },
  {
    value: 'light',
    label: 'Light',
    description: 'A bright, clean theme for daytime planning.',
  },
];

export function AppearanceSettings() {
  const { setTheme, theme } = useUiPreferences();

  return (
    <SettingsSection
      description="Choose how Chrono looks. Your choice is saved on this device."
      eyebrow="Interface"
      title="Appearance"
    >
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Color theme">
        {themeOptions.map((option) => {
          const selected = theme === option.value;

          return (
            <button
              aria-checked={selected}
              className={`rounded-[var(--radius-md)] border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent ${
                selected
                  ? 'border-dashboard-accent bg-dashboard-accent-soft'
                  : 'border-dashboard-border bg-dashboard-raised hover:border-dashboard-border-strong'
              }`}
              key={option.value}
              onClick={() => setTheme(option.value)}
              role="radio"
              type="button"
            >
              <span className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`grid h-10 w-10 place-items-center rounded-full border ${
                    option.value === 'dark'
                      ? 'border-[#29404b] bg-[#07151f]'
                      : 'border-[#d1dfda] bg-white'
                  }`}
                >
                  <span
                    className={`h-3 w-3 rounded-full ${selected ? 'bg-dashboard-accent' : 'bg-dashboard-muted'}`}
                  />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-dashboard-text">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-dashboard-muted">
                    {option.description}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </SettingsSection>
  );
}
