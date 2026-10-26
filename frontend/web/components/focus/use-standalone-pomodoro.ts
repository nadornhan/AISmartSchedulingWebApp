'use client';

import { useEffect, useRef, useState } from 'react';
import type { FocusDurations } from './FocusSettingsModal';
import type { FocusTimerMode } from './focus-timer-panel';

const initialDurations: FocusDurations = { focus: 25, shortBreak: 5, longBreak: 15 };
const modes: FocusTimerMode[] = ['Pomodoro', 'Short Break', 'Long Break'];

function getModeSeconds(mode: FocusTimerMode, durations: FocusDurations) {
  const minutes = mode === 'Pomodoro'
    ? durations.focus
    : mode === 'Short Break'
      ? durations.shortBreak
      : durations.longBreak;
  return minutes * 60;
}

function getModeSecondsByMode(durations: FocusDurations): Record<FocusTimerMode, number> {
  return {
    Pomodoro: durations.focus * 60,
    'Short Break': durations.shortBreak * 60,
    'Long Break': durations.longBreak * 60,
  };
}

export function useStandalonePomodoro(setSettingsOpen: (open: boolean) => void) {
  const [mode, setMode] = useState<FocusTimerMode>('Pomodoro');
  const [durations, setDurations] = useState(initialDurations);
  const [seconds, setSeconds] = useState(initialDurations.focus * 60);
  const [running, setRunning] = useState(false);
  const remainingByModeRef = useRef(getModeSecondsByMode(initialDurations));
  const endTimeRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const totalSeconds = getModeSeconds(mode, durations);
  const progress = totalSeconds > 0 ? Math.min(1, Math.max(0, seconds / totalSeconds)) : 0;
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');

  useEffect(() => {
    const audio = new Audio('/sounds/focus-complete.wav');
    audio.preload = 'auto';
    audio.volume = 0.28;
    audioRef.current = audio;
    return () => {
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!running || endTimeRef.current === null) return;

    function tick() {
      if (endTimeRef.current === null) return;
      const nextSeconds = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      setSeconds(nextSeconds);
      remainingByModeRef.current[mode] = nextSeconds;

      if (nextSeconds === 0) {
        endTimeRef.current = null;
        setRunning(false);
        audioRef.current?.play().catch(() => {});
      }
    }

    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [mode, running]);

  function selectMode(nextMode: FocusTimerMode) {
    if (nextMode === mode) return;

    if (running && endTimeRef.current !== null) {
      remainingByModeRef.current[mode] = Math.max(
        0,
        Math.ceil((endTimeRef.current - Date.now()) / 1000),
      );
      setRunning(false);
      endTimeRef.current = null;
    } else {
      remainingByModeRef.current[mode] = seconds;
    }

    setMode(nextMode);
    setSeconds(remainingByModeRef.current[nextMode]);
  }

  function saveDurations(nextDurations: FocusDurations) {
    const nextRemaining = getModeSecondsByMode(nextDurations);
    remainingByModeRef.current = nextRemaining;
    setDurations(nextDurations);
    setSeconds(nextRemaining[mode]);
    setRunning(false);
    endTimeRef.current = null;
    setSettingsOpen(false);
  }

  function toggleTimer() {
    if (running && endTimeRef.current !== null) {
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      remainingByModeRef.current[mode] = remaining;
      setSeconds(remaining);
      setRunning(false);
      endTimeRef.current = null;
      return;
    }

    const startingSeconds = seconds > 0 ? seconds : totalSeconds;
    remainingByModeRef.current[mode] = startingSeconds;
    setSeconds(startingSeconds);
    endTimeRef.current = Date.now() + startingSeconds * 1000;
    setRunning(true);
  }

  function skipSession() {
    const nextMode = mode === 'Pomodoro' ? 'Short Break' : 'Pomodoro';
    const nextSeconds = getModeSeconds(nextMode, durations);
    remainingByModeRef.current[mode] = totalSeconds;
    remainingByModeRef.current[nextMode] = nextSeconds;
    endTimeRef.current = null;
    setRunning(false);
    setMode(nextMode);
    setSeconds(nextSeconds);
  }

  return {
    mode,
    durations,
    running,
    progress,
    minutes,
    remainder,
    sessionMessage: null,
    sessionError: null,
    isSessionMutating: false,
    sessionTaskLocked: false,
    timerActionLabel: running ? 'Pause' : 'Start',
    selectMode,
    saveDurations,
    toggleTimer,
    skipSession,
  };
}
