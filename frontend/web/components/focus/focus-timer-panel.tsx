'use client';

import { Clock3, LoaderCircle, Maximize, Minimize } from 'lucide-react';
import { FocusSettingsModal, type FocusDurations } from './FocusSettingsModal';
import { useFocusFullscreen } from './use-focus-fullscreen';

export type FocusTimerMode = 'Pomodoro' | 'Short Break' | 'Long Break';

export const focusTimerModes: FocusTimerMode[] = ['Pomodoro', 'Short Break', 'Long Break'];

export type FocusTimerPanelState = {
  mode: FocusTimerMode;
  durations: FocusDurations;
  running: boolean;
  progress: number;
  minutes: string;
  remainder: string;
  sessionMessage: string | null;
  sessionError: string | null;
  isSessionMutating: boolean;
  sessionTaskLocked: boolean;
  timerActionLabel: string;
  selectMode: (mode: FocusTimerMode) => void | Promise<void>;
  saveDurations: (durations: FocusDurations) => void | Promise<void>;
  toggleTimer: () => void | Promise<void>;
  skipSession: () => void | Promise<void>;
  stopFocusSession?: () => void;
};

type FocusTimerPanelProps = {
  timer: FocusTimerPanelState;
  taskSummary?: string;
  showSessionCount?: boolean;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
};

export function FocusTimerPanel({
  timer,
  taskSummary,
  showSessionCount = true,
  settingsOpen,
  setSettingsOpen,
}: Readonly<FocusTimerPanelProps>) {
  const { panelRef, isFullscreen, fullscreenError, toggleFullscreen } = useFocusFullscreen();
  const {
    mode,
    durations,
    running,
    progress,
    minutes,
    remainder,
    sessionMessage,
    sessionError,
    isSessionMutating,
    sessionTaskLocked,
    timerActionLabel,
    selectMode,
    saveDurations,
    toggleTimer,
    skipSession,
    stopFocusSession,
  } = timer;

  return (
    <section
      ref={panelRef}
      aria-label="Focus timer"
      className={`focus-mode-panel relative overflow-hidden rounded-2xl border border-dashboard-border${isFullscreen ? ' is-fullscreen' : ''}`}
      data-phase={mode === 'Pomodoro' ? 'focus' : 'break'}
    >
      <div className="focus-panel-toolbar absolute right-3 top-3 z-20 flex gap-2 sm:right-6 sm:top-6">
        <button
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          aria-pressed={isFullscreen}
          className="focus-panel-tool"
          onClick={() => void toggleFullscreen()}
          title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
          type="button"
        >
          {isFullscreen ? <Minimize aria-hidden="true" className="h-5 w-5" /> : <Maximize aria-hidden="true" className="h-5 w-5" />}
        </button>
        <button
          aria-label="Focus settings"
          className="focus-panel-tool"
          onClick={() => setSettingsOpen(true)}
          type="button"
        >
          <GearIcon />
        </button>
      </div>

      <div className="focus-mode-tabs relative z-10 mx-auto grid w-full shrink-0 grid-cols-3 overflow-hidden rounded-xl border border-dashboard-border bg-dashboard-bg/70 p-1 sm:w-fit">
        <span
          aria-hidden="true"
          className="focus-mode-tab-indicator"
          style={{ transform: `translateX(${focusTimerModes.indexOf(mode) * 100}%)` }}
        />
        {focusTimerModes.map((item) => (
          <button
            className={`relative z-10 min-w-0 rounded-lg px-2 py-2.5 text-sm transition sm:min-w-28 sm:px-5 ${
              mode === item
                ? 'focus-mode-tab--active font-semibold text-dashboard-accent'
                : 'text-dashboard-muted hover:text-dashboard-text'
            }`}
            key={item}
            aria-pressed={mode === item}
            disabled={isSessionMutating}
            onClick={() => void selectMode(item)}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>

      <div className="focus-timer-stage" data-running={running}>
        <svg aria-hidden="true" className="focus-start-waves" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="96" />
          <circle cx="100" cy="100" r="96" />
          <circle cx="100" cy="100" r="96" />
        </svg>
        <svg aria-hidden="true" className="focus-timer-ring" viewBox="0 0 200 200">
          <circle
            cx="100"
            cy="100"
            fill="none"
            r="96"
            stroke="var(--focus-ring-track, rgba(34,240,177,.16))"
            strokeWidth="2"
          />
          <circle
            cx="100"
            cy="100"
            fill="none"
            pathLength="100"
            r="96"
            stroke="var(--focus-ring-progress, rgb(var(--accent-fill-strong-rgb)))"
            strokeDasharray={`${progress * 100} 100`}
            strokeLinecap="round"
            strokeWidth="2.6"
          />
        </svg>

        <div className="focus-timer-content">
          <Clock3 aria-hidden="true" className="focus-timer-clock text-dashboard-accent" />
          <p className="focus-timer-time font-poppins font-medium leading-none tracking-tight text-dashboard-text">
            {minutes}:{remainder}
          </p>

          <div
            className={`focus-timer-controls${mode === 'Pomodoro' && sessionTaskLocked ? ' focus-timer-controls--with-stop' : ''}`}
          >
            <button
              aria-label={timerActionLabel}
              className="focus-timer-action rounded-full bg-gradient-to-r from-dashboard-accent-strong to-dashboard-accent font-semibold text-dashboard-on-accent-inverse shadow-glow transition hover:brightness-110"
              disabled={isSessionMutating}
              onClick={() => void toggleTimer()}
              type="button"
            >
              <span className="focus-timer-action-label">{timerActionLabel}</span>
              <span aria-hidden="true" className="focus-timer-action-icon">
                {isSessionMutating ? (
                  <LoaderCircle className="animate-spin motion-reduce:animate-none" />
                ) : running ? (
                  <PauseIcon />
                ) : (
                  <PlayIcon />
                )}
              </span>
            </button>

            {mode === 'Pomodoro' && sessionTaskLocked && stopFocusSession ? (
              <button
                aria-label="Stop current focus session"
                className="focus-stop-action"
                disabled={isSessionMutating}
                onClick={stopFocusSession}
                title="Stop focus session"
                type="button"
              >
                <StopIcon />
              </button>
            ) : null}

            <button
              aria-label={mode === 'Pomodoro' ? 'Skip to short break' : 'Skip to focus session'}
              className="focus-skip-action"
              disabled={isSessionMutating}
              onClick={() => void skipSession()}
              title={mode === 'Pomodoro' ? 'Skip to break' : 'Skip to focus'}
              type="button"
            >
              <SkipIcon />
            </button>
          </div>
        </div>
      </div>

      <div className="focus-timer-caption relative z-10 mt-4 text-center sm:mt-7">
        {showSessionCount ? (
          <p className="focus-timer-session-count text-sm text-dashboard-muted sm:text-lg">#1</p>
        ) : null}
        <p className="focus-timer-session-title mt-1 text-sm font-medium text-dashboard-text sm:text-lg">
          {mode === 'Pomodoro' ? 'Time to focus!' : 'Take a breather'}
        </p>
        {sessionMessage ? (
          <p className="mt-3 text-sm text-dashboard-accent" role="status">
            {sessionMessage}
          </p>
        ) : null}
        {sessionError ? (
          <p className="mt-3 text-sm text-dashboard-danger" role="alert">
            {sessionError}
          </p>
        ) : null}
        {fullscreenError ? (
          <p className="mt-3 text-sm text-dashboard-danger" role="alert">
            {fullscreenError}
          </p>
        ) : null}
        {mode === 'Pomodoro' && taskSummary ? (
          <p className="mt-2 text-sm text-dashboard-muted">
            Focusing on: <span className="text-dashboard-text">{taskSummary}</span>
          </p>
        ) : null}
      </div>

      <FocusSettingsModal
        durations={durations}
        onClose={() => setSettingsOpen(false)}
        onSave={saveDurations}
        open={settingsOpen}
      />
    </section>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
      <path d="m8 5 11 7-11 7V5Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 5h4v14H6V5Zm8 0h4v14h-4V5Z" />
    </svg>
  );
}

function SkipIcon() {
  return (
    <svg aria-hidden="true" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6.5 5.7a1 1 0 0 1 1.5-.86l8.5 5.3a1 1 0 0 1 0 1.72L8 17.16a1 1 0 0 1-1.5-.86V5.7ZM18 5a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
      <rect height="9" rx="1.5" width="9" x="3.5" y="3.5" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.1l2-1.5-2-3.5-2.4 1a7.7 7.7 0 0 0-1.9-1.1L14.3 3H9.7l-.3 2.8a7.7 7.7 0 0 0-1.9 1.1l-2.4-1-2 3.5 2 1.5A7.3 7.3 0 0 0 5 12c0 .4 0 .8.1 1.1l-2 1.5 2 3.5 2.4-1a7.7 7.7 0 0 0 1.9 1.1l.3 2.8h4.6l.3-2.8a7.7 7.7 0 0 0 1.9-1.1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1.1Z" />
    </svg>
  );
}
