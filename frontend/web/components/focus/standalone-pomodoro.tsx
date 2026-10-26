'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FocusTimerPanel } from './focus-timer-panel';
import { useStandalonePomodoro } from './use-standalone-pomodoro';

export function StandalonePomodoro() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const timer = useStandalonePomodoro(setSettingsOpen);

  return (
    <main className="min-h-svh bg-dashboard-bg px-4 py-5 text-dashboard-text sm:px-8 sm:py-8">
      <div className="mx-auto max-w-[1450px]">
        <header className="mb-5 flex items-center justify-between gap-4 sm:mb-8">
          <Link
            aria-label="Chrono home"
            className="flex items-center gap-[5px] font-poppins text-[26px] font-medium tracking-[-0.04em]"
            href="/"
          >
            <img alt="" className="h-10 w-10 object-contain" height="40" src="/chrono-logo.png" width="40" />
            <span className="mt-[3px]">Chrono</span>
          </Link>
          <Link
            className="rounded-full border border-dashboard-border px-4 py-2 text-sm font-medium text-dashboard-muted transition hover:border-dashboard-accent/50 hover:text-dashboard-text"
            href="/"
          >
            Back to website
          </Link>
        </header>
        <FocusTimerPanel
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
          showSessionCount={false}
          timer={timer}
        />
      </div>
    </main>
  );
}
