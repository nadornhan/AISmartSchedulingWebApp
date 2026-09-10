'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  finishFocusSession as saveFinishedFocusSession,
  getActiveFocusSession,
  startFocusSession,
  updateFocusSession,
} from '../../lib/focus';
import { FocusSettingsModal, type FocusDurations } from './FocusSettingsModal';

type Mode = 'Pomodoro' | 'Short Break' | 'Long Break';

type FocusTask = {
  id: string;
  title: string;
  done: boolean;
};

const modes: Mode[] = ['Pomodoro', 'Short Break', 'Long Break'];

const defaultDurations: FocusDurations = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
};

function getModeSeconds(mode: Mode, durations: FocusDurations) {
  if (mode === 'Pomodoro') return durations.focus * 60;
  if (mode === 'Short Break') return durations.shortBreak * 60;
  return durations.longBreak * 60;
}

export function FocusMode() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>('Pomodoro');
  const [durations, setDurations] = useState<FocusDurations>(defaultDurations);
  const [seconds, setSeconds] = useState(defaultDurations.focus * 60);
  const [running, setRunning] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tasks, setTasks] = useState<FocusTask[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isSessionMutating, setIsSessionMutating] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endTimeRef = useRef<number | null>(null);
  const remainingRef = useRef(defaultDurations.focus * 60);
  const completionSoundPlayedRef = useRef(false);
  const sessionStartedAtRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const activeSegmentStartedAtRef = useRef<number | null>(null);
  const focusedMillisecondsRef = useRef(0);
  const isSavingSessionRef = useRef(false);
  const selectedTaskId = searchParams.get('task_id');
  const selectedTaskTitle = searchParams.get('task_title');
  const selectedDuration = Number(searchParams.get('duration'));
  const focusTaskId = selectedTaskId && selectedTaskId.trim() ? selectedTaskId : null;

  const totalSeconds = getModeSeconds(mode, durations);
  const progress = totalSeconds > 0 ? seconds / totalSeconds : 0;
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');

  useEffect(() => {
    remainingRef.current = seconds;
  }, [seconds]);

  useEffect(() => {
    audioRef.current = new Audio('/sounds/focus-complete.wav');
    audioRef.current.preload = 'auto';
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void getActiveFocusSession(controller.signal)
      .then((session) => {
        setSessionError(null);
        if (!session) return;

        sessionIdRef.current = session.id;
        sessionStartedAtRef.current = session.started_at;
        focusedMillisecondsRef.current = session.actual_duration_seconds * 1000;
        const plannedSeconds = session.planned_duration_minutes * 60;
        setDurations((current) => ({
          ...current,
          focus: session.planned_duration_minutes,
        }));
        setMode('Pomodoro');
        setSeconds(Math.max(0, plannedSeconds - session.actual_duration_seconds));
        setRunning(false);
        setSessionMessage('Previous focus session restored · paused');

        if (session.status === 'active') {
          void updateFocusSession(session.id, {
            actual_duration_seconds: session.actual_duration_seconds,
            status: 'paused',
          });
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setSessionError('Unable to restore the active focus session.');
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedTaskId || !selectedTaskTitle) return;

    setTasks((current) => {
      if (current.some((task) => task.id === selectedTaskId)) {
        return current;
      }

      return [
        {
          id: selectedTaskId,
          title: selectedTaskTitle,
          done: false,
        },
        ...current,
      ];
    });
  }, [selectedTaskId, selectedTaskTitle]);

  useEffect(() => {
    if (!Number.isInteger(selectedDuration) || selectedDuration <= 0) return;

    setDurations((current) => ({
      ...current,
      focus: selectedDuration,
    }));
    setMode('Pomodoro');
    setSeconds(selectedDuration * 60);
    setRunning(false);
    endTimeRef.current = null;
    completionSoundPlayedRef.current = false;
  }, [selectedDuration]);

  useEffect(() => {
    if (!running) return;

    function tick() {
      if (endTimeRef.current === null) return;

      const nextSeconds = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));

      setSeconds((current) => {
        if (nextSeconds === 0 && current > 0 && !completionSoundPlayedRef.current) {
          completionSoundPlayedRef.current = true;
          audioRef.current?.play().catch(() => {});
        }

        return nextSeconds;
      });

      if (nextSeconds === 0) {
        setRunning(false);
        endTimeRef.current = null;
        if (mode === 'Pomodoro' && completionSoundPlayedRef.current) {
          void finishFocusSession(true);
        }
      }
    }

    tick();
    const timer = window.setInterval(tick, 250);

    return () => window.clearInterval(timer);
  }, [mode, running]);

  function captureActiveSegment() {
    if (activeSegmentStartedAtRef.current === null) return;

    focusedMillisecondsRef.current += Math.max(
      0,
      Date.now() - activeSegmentStartedAtRef.current,
    );
    activeSegmentStartedAtRef.current = null;
  }

  async function finishFocusSession(completed: boolean) {
    if (!sessionIdRef.current || isSavingSessionRef.current) return;

    captureActiveSegment();
    const sessionId = sessionIdRef.current;
    const actualSeconds = Math.max(0, Math.round(focusedMillisecondsRef.current / 1000));
    const actualMinutes = Math.max(1, Math.ceil(actualSeconds / 60));

    sessionIdRef.current = null;
    sessionStartedAtRef.current = null;
    focusedMillisecondsRef.current = 0;
    isSavingSessionRef.current = true;
    setSessionError(null);
    setSessionMessage('Saving focus session...');

    try {
      await saveFinishedFocusSession(sessionId, actualSeconds, completed);
      setSessionMessage(
        completed
          ? `Focus session completed · ${actualMinutes} min recorded`
          : `Focus session stopped · ${actualMinutes} min recorded`,
      );
    } catch (requestError) {
      setSessionMessage(null);
      setSessionError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to save this focus session.',
      );
    } finally {
      isSavingSessionRef.current = false;
    }
  }

  function selectMode(nextMode: Mode) {
    if (mode === 'Pomodoro' && sessionStartedAtRef.current) {
      void finishFocusSession(false);
    }
    setMode(nextMode);
    setSeconds(getModeSeconds(nextMode, durations));
    setRunning(false);
    endTimeRef.current = null;
    completionSoundPlayedRef.current = false;
  }

  function saveDurations(nextDurations: FocusDurations) {
    if (mode === 'Pomodoro' && sessionStartedAtRef.current) {
      void finishFocusSession(false);
    }
    setDurations(nextDurations);
    setSeconds(getModeSeconds(mode, nextDurations));
    setRunning(false);
    endTimeRef.current = null;
    completionSoundPlayedRef.current = false;
    setSettingsOpen(false);
  }

  async function toggleTimer() {
    if (seconds === 0) {
      setSeconds(totalSeconds);
      endTimeRef.current = null;
      completionSoundPlayedRef.current = false;
      return;
    }

    if (running) {
      captureActiveSegment();
      endTimeRef.current = null;
      setRunning(false);
      if (mode === 'Pomodoro' && sessionIdRef.current) {
        const actualSeconds = Math.round(focusedMillisecondsRef.current / 1000);
        void updateFocusSession(sessionIdRef.current, {
          actual_duration_seconds: actualSeconds,
          status: 'paused',
        }).catch(() => setSessionError('Timer paused, but progress could not be synced.'));
      }
      return;
    }

    setSessionError(null);
    setIsSessionMutating(true);
    try {
      if (mode === 'Pomodoro' && !sessionIdRef.current) {
        const session = await startFocusSession({
          task_id: focusTaskId,
          planned_duration_minutes: Math.max(1, Math.round(totalSeconds / 60)),
        });
        sessionIdRef.current = session.id;
        sessionStartedAtRef.current = session.started_at;
        focusedMillisecondsRef.current = session.actual_duration_seconds * 1000;
        setSessionMessage(null);
      } else if (mode === 'Pomodoro' && sessionIdRef.current) {
        await updateFocusSession(sessionIdRef.current, {
          actual_duration_seconds: Math.round(focusedMillisecondsRef.current / 1000),
          status: 'active',
        });
      }

      completionSoundPlayedRef.current = false;
      endTimeRef.current = Date.now() + remainingRef.current * 1000;
      if (mode === 'Pomodoro') activeSegmentStartedAtRef.current = Date.now();
      audioRef.current?.load();
      setRunning(true);
    } catch (requestError) {
      setSessionError(
        requestError instanceof Error ? requestError.message : 'Unable to start focus session.',
      );
    } finally {
      setIsSessionMutating(false);
    }
  }

  function skipSession() {
    if (mode === 'Pomodoro' && sessionStartedAtRef.current) {
      void finishFocusSession(false);
    }
    selectMode(mode === 'Pomodoro' ? 'Short Break' : 'Pomodoro');
  }

  function addTask() {
    const title = draft.trim();

    if (!title) return;

    setTasks((current) => [...current, { id: String(Date.now()), title, done: false }]);
    setDraft('');
    setAdding(false);
  }

  function toggleTask(taskId: string) {
    setTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task)),
    );
  }

  return (
    <div className="mx-auto max-w-[1450px] space-y-7">
      <section className="focus-mode-panel relative overflow-hidden rounded-2xl border border-dashboard-border">
        <button
          aria-label="Focus settings"
          className="absolute right-6 top-6 grid h-11 w-11 place-items-center rounded-xl border border-dashboard-border bg-dashboard-surface text-dashboard-text hover:border-dashboard-accent/50"
          onClick={() => setSettingsOpen(true)}
          type="button"
        >
          <GearIcon />
        </button>

        <div className="mx-auto flex w-fit overflow-hidden rounded-xl border border-dashboard-border bg-dashboard-bg/70 p-1">
          {modes.map((item) => (
            <button
              className={`min-w-28 rounded-lg px-5 py-2.5 text-sm transition ${
                mode === item
                  ? 'bg-dashboard-accent/15 font-semibold text-dashboard-accent'
                  : 'text-dashboard-muted hover:text-dashboard-text'
              }`}
              key={item}
              onClick={() => selectMode(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>

        <div className="focus-timer-stage">
          <svg aria-hidden="true" className="focus-timer-ring" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              fill="none"
              r="96"
              stroke="rgba(34,240,177,.16)"
              strokeWidth="2"
            />
            <circle
              cx="100"
              cy="100"
              fill="none"
              pathLength="100"
              r="96"
              stroke="var(--dashboard-accent)"
              strokeDasharray={`${progress * 100} 100`}
              strokeLinecap="round"
              strokeWidth="2.6"
            />
          </svg>

          <div className="relative z-10 flex flex-col items-center">
            <div className="mb-5 flex items-center gap-2 text-dashboard-accent">
              <ClockIcon />
              <span className="text-lg font-medium">
                {mode === 'Pomodoro' ? 'Focus Time' : mode}
              </span>
            </div>

            <p className="focus-timer-time font-poppins font-medium leading-none tracking-tight text-dashboard-text">
              {minutes}:{remainder}
            </p>

            <div className="focus-timer-controls">
              <button
                className="focus-timer-action rounded-full bg-gradient-to-r from-dashboard-accent-strong to-dashboard-accent px-8 py-3 text-lg font-semibold text-white shadow-glow transition hover:brightness-110"
                disabled={isSessionMutating}
                onClick={() => void toggleTimer()}
                type="button"
              >
                {isSessionMutating
                  ? 'Starting...'
                  : seconds === 0
                    ? 'Reset'
                    : running
                      ? 'Pause'
                      : 'Start'}
              </button>

              <button
                aria-label={mode === 'Pomodoro' ? 'Skip to short break' : 'Skip to focus session'}
                className="focus-skip-action"
                onClick={skipSession}
                title={mode === 'Pomodoro' ? 'Skip to break' : 'Skip to focus'}
                type="button"
              >
                <SkipIcon />
              </button>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-7 text-center">
          <p className="text-lg text-dashboard-muted">#1</p>
          <p className="mt-1 text-lg font-medium text-dashboard-text">
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
          {mode === 'Pomodoro' && selectedTaskTitle ? (
            <p className="mt-2 text-sm text-dashboard-muted">
              Focusing on: <span className="text-dashboard-text">{selectedTaskTitle}</span>
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-medium text-dashboard-text">Tasks</h2>

        <div className="overflow-hidden rounded-2xl border border-dashboard-border bg-dashboard-surface/55">
          {tasks.map((task) => (
            <label
              className="flex min-h-14 cursor-pointer items-center gap-3 border-b border-dashboard-border px-5 last:border-0"
              key={task.id}
            >
              <input
                checked={task.done}
                className="h-4 w-4 accent-[var(--dashboard-accent)]"
                onChange={() => toggleTask(task.id)}
                type="checkbox"
              />
              <span
                className={`text-sm text-dashboard-text ${
                  task.done ? 'line-through opacity-50' : ''
                }`}
              >
                {task.title}
              </span>
            </label>
          ))}

          {adding ? (
            <form
              className="flex min-h-16 items-center gap-3 px-5"
              onSubmit={(event) => {
                event.preventDefault();
                addTask();
              }}
            >
              <input
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-sm text-dashboard-text outline-none placeholder:text-dashboard-muted"
                onChange={(event) => setDraft(event.target.value)}
                placeholder="What do you want to focus on?"
                value={draft}
              />
              <button
                className="rounded-lg bg-dashboard-accent px-4 py-2 text-sm font-semibold text-dashboard-bg"
                type="submit"
              >
                Add
              </button>
              <button
                className="px-2 py-2 text-sm text-dashboard-muted"
                onClick={() => setAdding(false)}
                type="button"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              className="flex min-h-20 w-full items-center justify-center gap-3 text-lg text-dashboard-muted transition hover:bg-white/[0.025] hover:text-dashboard-text"
              onClick={() => setAdding(true)}
              type="button"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full pr-[0.2px] border border-dashboard-accent text-dashboard-accent">
                <PlusIcon />
              </span>
              Add Task
            </button>
          )}
        </div>
      </section>

      <FocusSettingsModal
        durations={durations}
        onClose={() => setSettingsOpen(false)}
        onSave={saveDurations}
        open={settingsOpen}
      />
    </div>
  );
}

function ClockIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2M8 2h8" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      className="block h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
      viewBox="0 0 16 16"
    >
      <path d="M8 3v10M3 8h10" />
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
