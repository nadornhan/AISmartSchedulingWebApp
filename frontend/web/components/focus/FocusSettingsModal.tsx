'use client';

import { useEffect, useState } from 'react';
import { DurationInput } from './DurationInput';
import { NumberStepper } from './NumberStepper';
import { SettingsSection } from './SettingsSection';
import { SettingToggle } from './SettingToggle';
import { VolumeSlider } from './VolumeSlider';

export type FocusDurations = {
  focus: number;
  shortBreak: number;
  longBreak: number;
};

type FocusSettingsModalProps = {
  open: boolean;
  durations: FocusDurations;
  onClose: () => void;
  onSave: (durations: FocusDurations) => void;
};

export function FocusSettingsModal({
  open,
  durations,
  onClose,
  onSave,
}: FocusSettingsModalProps) {
  const [focus, setFocus] = useState(durations.focus);
  const [shortBreak, setShortBreak] = useState(durations.shortBreak);
  const [longBreak, setLongBreak] = useState(durations.longBreak);
  const [sessions, setSessions] = useState(4);
  const [autoStart, setAutoStart] = useState(false);
  const [sound, setSound] = useState(true);
  const [volume, setVolume] = useState(70);

  useEffect(() => {
    if (!open) return;

    setFocus(durations.focus);
    setShortBreak(durations.shortBreak);
    setLongBreak(durations.longBreak);
  }, [durations, open]);

  if (!open) return null;

  function saveSettings() {
    onSave({ focus, shortBreak, longBreak });
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[300] grid place-items-center bg-black/65 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-dashboard-border bg-[#07131d] p-5 shadow-panel sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-dashboard-text">
            Focus settings
          </h2>
          <button
            aria-label="Close settings"
            className="grid h-9 w-9 place-items-center rounded-lg text-xl text-dashboard-muted hover:bg-white/5 hover:text-dashboard-text"
            onClick={onClose}
            type="button"
          >
            &times;
          </button>
        </div>

        <div className="space-y-5">
          <SettingsSection title="Timer durations">
            <DurationInput
              label="Focus time"
              onChange={setFocus}
              value={focus}
            />
            <DurationInput
              label="Short break"
              onChange={setShortBreak}
              value={shortBreak}
            />
            <DurationInput
              label="Long break"
              onChange={setLongBreak}
              value={longBreak}
            />
          </SettingsSection>

          <SettingsSection title="Sessions">
            <NumberStepper
              label="Sessions until long break"
              max={8}
              onChange={setSessions}
              value={sessions}
            />
            <SettingToggle
              checked={autoStart}
              description="Begin the next timer automatically"
              label="Auto-start sessions"
              onChange={setAutoStart}
            />
          </SettingsSection>

          <SettingsSection title="Sound">
            <SettingToggle
              checked={sound}
              label="Timer alert"
              onChange={setSound}
            />
            {sound ? (
              <VolumeSlider onChange={setVolume} value={volume} />
            ) : null}
          </SettingsSection>
        </div>

        <button
          className="mt-6 h-11 w-full rounded-xl bg-dashboard-accent font-semibold text-dashboard-bg transition hover:bg-dashboard-accent-strong"
          onClick={saveSettings}
          type="button"
        >
          Save settings
        </button>
      </div>
    </div>
  );
}
