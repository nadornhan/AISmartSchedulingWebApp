'use client';

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  finishFocusSession as saveFinishedFocusSession,
  getActiveFocusSession,
  startFocusSession,
  updateFocusSession,
} from '../../lib/focus';
import type { FocusDurations } from './FocusSettingsModal';

type Mode = 'Pomodoro' | 'Short Break' | 'Long Break';

export const modes: Mode[] = ['Pomodoro', 'Short Break', 'Long Break'];

const defaultDurations: FocusDurations = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
};

const timerStorageKey = 'focus-timer-state-v1';

type PersistedTimerState = {
  version: 1;
  mode: Mode;
  durations: FocusDurations;
  remainingByMode: Record<Mode, number>;
  running: boolean;
  endTime: number | null;
  sessionId: string | null;
  sessionStartedAt: string | null;
  focusedMilliseconds: number;
  activeSegmentStartedAt: number | null;
  hasStarted?: boolean;
};

function modeSeconds(durations: FocusDurations): Record<Mode, number> {
  return {
    Pomodoro: durations.focus * 60,
    'Short Break': durations.shortBreak * 60,
    'Long Break': durations.longBreak * 60,
  };
}

function readPersistedTimer(): PersistedTimerState | null {
  if (typeof window === 'undefined') return null;

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(timerStorageKey) ?? 'null',
    ) as PersistedTimerState | null;
    if (!parsed || parsed.version !== 1 || !modes.includes(parsed.mode)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getModeSeconds(mode: Mode, durations: FocusDurations) {
  if (mode === 'Pomodoro') return durations.focus * 60;
  if (mode === 'Short Break') return durations.shortBreak * 60;
  return durations.longBreak * 60;
}

type FocusTimerOptions = {
  selectedTaskId: string | null;
  selectedDuration: number;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
};

export function useFocusTimer({
  selectedTaskId,
  selectedDuration,
  setSettingsOpen,
}: FocusTimerOptions) {
  const [restoredTimer, setRestoredTimer] = useState<PersistedTimerState | null>(null);
  const [timerHydrated, setTimerHydrated] = useState(false);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const [mode, setMode] = useState<Mode>('Pomodoro');
  const [durations, setDurations] = useState<FocusDurations>(defaultDurations);
  const [seconds, setSeconds] = useState(defaultDurations.focus * 60);
  const [running, setRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isSessionMutating, setIsSessionMutating] = useState(false);
  const [sessionTaskLocked, setSessionTaskLocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endTimeRef = useRef<number | null>(null);
  const remainingRef = useRef(defaultDurations.focus * 60);
  const remainingByModeRef = useRef<Record<Mode, number>>(modeSeconds(defaultDurations));
  const completionSoundPlayedRef = useRef(false);
  const sessionStartedAtRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const activeSegmentStartedAtRef = useRef<number | null>(null);
  const focusedMillisecondsRef = useRef(0);
  const isSavingSessionRef = useRef(false);
  const [selectedFocusTaskIds, setSelectedFocusTaskIds] = useState<string[]>(() =>
    selectedTaskId && selectedTaskId.trim() ? [selectedTaskId] : [],
  );

  const totalSeconds = getModeSeconds(mode, durations);
  const progress = totalSeconds > 0 ? Math.min(1, Math.max(0, seconds / totalSeconds)) : 0;
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');

  function persistTimerSnapshot() {
    const snapshot: PersistedTimerState = {
      version: 1,
      mode,
      durations,
      remainingByMode: { ...remainingByModeRef.current },
      running,
      endTime: endTimeRef.current,
      sessionId: sessionIdRef.current,
      sessionStartedAt: sessionStartedAtRef.current,
      focusedMilliseconds: focusedMillisecondsRef.current,
      activeSegmentStartedAt: activeSegmentStartedAtRef.current,
      hasStarted,
    };
    window.localStorage.setItem(timerStorageKey, JSON.stringify(snapshot));
  }

  useEffect(() => {
    const restored = readPersistedTimer();
    if (restored) {
      const restoredSeconds =
        restored.running && restored.endTime !== null
          ? Math.max(0, Math.ceil((restored.endTime - Date.now()) / 1000))
          : restored.remainingByMode[restored.mode];
      setRestoredTimer(restored);
      setMode(restored.mode);
      setDurations(restored.durations);
      setSeconds(restoredSeconds);
      setRunning(restored.running);
      setHasStarted(
        restored.hasStarted ??
          (restored.running || restoredSeconds < getModeSeconds(restored.mode, restored.durations)),
      );
      endTimeRef.current = restored.endTime;
      remainingRef.current = restoredSeconds;
      remainingByModeRef.current = {
        ...restored.remainingByMode,
        [restored.mode]: restoredSeconds,
      };
      completionSoundPlayedRef.current = Boolean(
        restored.running && restored.endTime !== null && restoredSeconds === 0,
      );
      sessionStartedAtRef.current = restored.sessionStartedAt;
      sessionIdRef.current = restored.sessionId;
      activeSegmentStartedAtRef.current = restored.activeSegmentStartedAt;
      focusedMillisecondsRef.current = restored.focusedMilliseconds;
    }
    setTimerHydrated(true);
  }, []);

  useEffect(() => {
    if (!timerHydrated) return;
    remainingRef.current = seconds;
    remainingByModeRef.current[mode] = seconds;
    persistTimerSnapshot();
  }, [durations, hasStarted, mode, running, seconds, timerHydrated]);

  useEffect(() => {
    audioRef.current = new Audio('/sounds/focus-complete.wav');
    audioRef.current.preload = 'auto';
    audioRef.current.volume = 0.28;
  }, []);

  useEffect(() => {
    if (!timerHydrated) return;
    const controller = new AbortController();

    void getActiveFocusSession(controller.signal)
      .then((session) => {
        setSessionError(null);
        if (!session) {
          sessionIdRef.current = null;
          sessionStartedAtRef.current = null;
          focusedMillisecondsRef.current = 0;
          activeSegmentStartedAtRef.current = null;
          setSessionTaskLocked(false);
          if (mode === 'Pomodoro' && running) {
            setRunning(false);
            endTimeRef.current = null;
          }
          persistTimerSnapshot();
          return;
        }

        sessionIdRef.current = session.id;
        sessionStartedAtRef.current = session.started_at;
        const restoredSessionMatches = restoredTimer?.sessionId === session.id;
        focusedMillisecondsRef.current = Math.max(
          restoredSessionMatches ? focusedMillisecondsRef.current : 0,
          session.actual_duration_seconds * 1000,
        );
        setSelectedFocusTaskIds(
          session.task_ids.length > 0 ? session.task_ids : session.task_id ? [session.task_id] : [],
        );
        setHasStarted(true);
        setSessionTaskLocked(true);
        const plannedSeconds = session.planned_duration_minutes * 60;
        setDurations((current) => ({
          ...current,
          focus: session.planned_duration_minutes,
        }));

        if (restoredSessionMatches) {
          setSessionMessage(
            restoredTimer.running ? 'Focus session restored' : 'Focus session restored · paused',
          );
          if (!restoredTimer.running || restoredTimer.mode !== 'Pomodoro') {
            void updateFocusSession(session.id, {
              actual_duration_seconds: Math.round(focusedMillisecondsRef.current / 1000),
              status: 'paused',
            });
          }
          return;
        }

        setMode('Pomodoro');
        setSeconds(Math.max(0, plannedSeconds - session.actual_duration_seconds));
        remainingByModeRef.current.Pomodoro = Math.max(
          0,
          plannedSeconds - session.actual_duration_seconds,
        );
        setRunning(false);
        endTimeRef.current = null;
        activeSegmentStartedAtRef.current = null;
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
      })
      .finally(() => {
        if (!controller.signal.aborted) setSessionHydrated(true);
      });

    return () => controller.abort();
  }, [timerHydrated]);

  useEffect(() => {
    if (!timerHydrated) return;
    if (restoredTimer) return;
    if (!Number.isInteger(selectedDuration) || selectedDuration <= 0) return;

    setDurations((current) => ({
      ...current,
      focus: selectedDuration,
    }));
    setMode('Pomodoro');
    setSeconds(selectedDuration * 60);
    remainingRef.current = selectedDuration * 60;
    setRunning(false);
    endTimeRef.current = null;
    completionSoundPlayedRef.current = false;
  }, [restoredTimer, selectedDuration, timerHydrated]);

  useEffect(() => {
    if (!timerHydrated || !sessionHydrated || !running) return;

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
        if (mode === 'Pomodoro') {
          captureActiveSegment(endTimeRef.current ?? Date.now());
        }
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
  }, [mode, running, sessionHydrated, timerHydrated]);

  function captureActiveSegment(segmentEndedAt = Date.now()) {
    if (activeSegmentStartedAtRef.current === null) return;

    focusedMillisecondsRef.current += Math.max(
      0,
      segmentEndedAt - activeSegmentStartedAtRef.current,
    );
    activeSegmentStartedAtRef.current = null;
  }

  async function finishFocusSession(completed: boolean): Promise<boolean> {
    if (!sessionIdRef.current) return true;
    if (isSavingSessionRef.current) return false;

    captureActiveSegment();
    const sessionId = sessionIdRef.current;
    const actualSeconds = Math.max(0, Math.round(focusedMillisecondsRef.current / 1000));
    const actualMinutes = Math.ceil(actualSeconds / 60);

    isSavingSessionRef.current = true;
    setIsSessionMutating(true);
    setSessionError(null);
    setSessionMessage('Saving focus session...');

    try {
      await saveFinishedFocusSession(sessionId, actualSeconds, completed);
      sessionIdRef.current = null;
      sessionStartedAtRef.current = null;
      focusedMillisecondsRef.current = 0;
      activeSegmentStartedAtRef.current = null;
      setRunning(false);
      setHasStarted(false);
      setSeconds(totalSeconds);
      remainingRef.current = totalSeconds;
      remainingByModeRef.current[mode] = totalSeconds;
      endTimeRef.current = null;
      completionSoundPlayedRef.current = false;
      setSessionTaskLocked(false);
      setSessionMessage(
        completed
          ? `Focus session completed · ${actualMinutes} min recorded`
          : `Focus session stopped · ${actualMinutes} min recorded`,
      );
      persistTimerSnapshot();
      return true;
    } catch (requestError) {
      setSessionMessage(null);
      setSessionTaskLocked(true);
      setSessionError(
        requestError instanceof Error ? requestError.message : 'Unable to save this focus session.',
      );
      return false;
    } finally {
      isSavingSessionRef.current = false;
      setIsSessionMutating(false);
    }
  }

  async function selectMode(nextMode: Mode) {
    if (nextMode === mode || isSessionMutating || isSavingSessionRef.current) return;

    remainingByModeRef.current[mode] = remainingRef.current;
    if (running) {
      if (mode === 'Pomodoro') captureActiveSegment();
      setRunning(false);
      endTimeRef.current = null;

      if (mode === 'Pomodoro' && sessionIdRef.current) {
        try {
          await updateFocusSession(sessionIdRef.current, {
            actual_duration_seconds: Math.round(focusedMillisecondsRef.current / 1000),
            status: 'paused',
          });
        } catch {
          setSessionError('Timer switched modes, but focus progress could not be synced.');
        }
      }
    }

    const nextSeconds = remainingByModeRef.current[nextMode];
    setMode(nextMode);
    setSeconds(nextSeconds);
    remainingRef.current = nextSeconds;
    completionSoundPlayedRef.current = false;
  }

  async function saveDurations(nextDurations: FocusDurations) {
    if (mode === 'Pomodoro' && sessionStartedAtRef.current) {
      const stopped = await finishFocusSession(false);
      if (!stopped) return;
    }
    setDurations(nextDurations);
    remainingByModeRef.current = modeSeconds(nextDurations);
    setSeconds(remainingByModeRef.current[mode]);
    remainingRef.current = remainingByModeRef.current[mode];
    setRunning(false);
    endTimeRef.current = null;
    completionSoundPlayedRef.current = false;
    setSettingsOpen(false);
  }

  async function toggleTimer() {
    if (seconds === 0) {
      setSeconds(totalSeconds);
      setHasStarted(false);
      remainingRef.current = totalSeconds;
      remainingByModeRef.current[mode] = totalSeconds;
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
          task_ids: selectedFocusTaskIds,
          planned_duration_minutes: Math.max(1, Math.round(totalSeconds / 60)),
        });
        sessionIdRef.current = session.id;
        sessionStartedAtRef.current = session.started_at;
        focusedMillisecondsRef.current = session.actual_duration_seconds * 1000;
        setSessionTaskLocked(true);
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
      setHasStarted(true);
      setRunning(true);
    } catch (requestError) {
      setSessionError(
        requestError instanceof Error ? requestError.message : 'Unable to start focus session.',
      );
    } finally {
      setIsSessionMutating(false);
    }
  }

  async function skipSession() {
    if (isSessionMutating || isSavingSessionRef.current) return;
    captureActiveSegment();
    setRunning(false);
    endTimeRef.current = null;

    if (sessionIdRef.current && !(await finishFocusSession(false))) return;

    const nextMode = mode === 'Pomodoro' ? 'Short Break' : 'Pomodoro';
    const nextSeconds = getModeSeconds(nextMode, durations);
    // Skip advances to a fresh phase, unlike manually viewing another mode.
    remainingByModeRef.current[mode] = getModeSeconds(mode, durations);
    remainingByModeRef.current[nextMode] = nextSeconds;
    remainingRef.current = nextSeconds;
    setMode(nextMode);
    setSeconds(nextSeconds);
    setHasStarted(false);
    completionSoundPlayedRef.current = false;
    setSessionError(null);
  }

  function stopFocusSession() {
    if (!sessionIdRef.current || isSavingSessionRef.current) return;

    captureActiveSegment();
    setRunning(false);
    endTimeRef.current = null;
    void finishFocusSession(false);
  }

  function toggleFocusTask(taskId: string) {
    setSelectedFocusTaskIds((current) =>
      current.includes(taskId)
        ? current.filter((selectedId) => selectedId !== taskId)
        : current.length < 20
          ? [...current, taskId]
          : current,
    );
  }

  const timerActionLabel = isSessionMutating
    ? isSavingSessionRef.current
      ? 'Saving...'
      : 'Starting...'
    : running
      ? 'Pause'
      : 'Start';

  return {
    mode,
    durations,
    seconds,
    running,
    hasStarted,
    progress,
    minutes,
    remainder,
    sessionMessage,
    sessionError,
    isSessionMutating,
    sessionTaskLocked,
    selectedFocusTaskIds,
    setSelectedFocusTaskIds,
    timerActionLabel,
    selectMode,
    saveDurations,
    toggleTimer,
    skipSession,
    stopFocusSession,
    toggleFocusTask,
  };
}
