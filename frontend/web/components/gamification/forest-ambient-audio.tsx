'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const FOREST_AMBIENCE_SOURCE = '/sounds/forest-ambience.mp3';
const FOREST_AMBIENCE_PREFERENCE = 'chrono:forest-ambience-enabled';
const FOREST_AMBIENCE_VOLUME = 0.12;
const FADE_DURATION_MS = 1_800;
const FADE_INTERVAL_MS = 50;

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M11 5 6.5 9H3v6h3.5l4.5 4V5Z" />
      {muted ? (
        <>
          <path d="m16 9 5 6" />
          <path d="m21 9-5 6" />
        </>
      ) : (
        <>
          <path d="M15 9.5a4 4 0 0 1 0 5" />
          <path d="M18 7a7 7 0 0 1 0 10" />
        </>
      )}
    </svg>
  );
}

export function ForestAmbientAudio({ iconOnly = false }: { iconOnly?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const enabledRef = useRef(true);
  const mountedRef = useRef(false);
  const [enabled, setEnabled] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [needsInteraction, setNeedsInteraction] = useState(false);

  const cancelFade = useCallback(() => {
    if (fadeTimerRef.current !== null) {
      window.clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const fadeTo = useCallback(
    (targetVolume: number, onComplete?: () => void) => {
      const audio = audioRef.current;
      if (!audio) return;

      cancelFade();
      const startVolume = audio.volume;
      const startedAt = performance.now();

      fadeTimerRef.current = window.setInterval(() => {
        const progress = Math.min((performance.now() - startedAt) / FADE_DURATION_MS, 1);
        audio.volume = Math.max(
          0,
          Math.min(1, startVolume + (targetVolume - startVolume) * progress),
        );

        if (progress >= 1) {
          cancelFade();
          onComplete?.();
        }
      }, FADE_INTERVAL_MS);
    },
    [cancelFade],
  );

  const playWithFade = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !enabledRef.current || document.hidden) return;

    cancelFade();
    audio.volume = 0;
    try {
      await audio.play();
      if (!mountedRef.current) return;
      setIsPlaying(true);
      setNeedsInteraction(false);
      fadeTo(FOREST_AMBIENCE_VOLUME);
    } catch {
      if (!mountedRef.current) return;
      setIsPlaying(false);
      setNeedsInteraction(true);
    }
  }, [cancelFade, fadeTo]);

  const pauseWithFade = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) {
      setIsPlaying(false);
      return;
    }

    fadeTo(0, () => {
      audio.pause();
      if (mountedRef.current) setIsPlaying(false);
    });
  }, [fadeTo]);

  useEffect(() => {
    mountedRef.current = true;
    const storedPreference = window.localStorage.getItem(FOREST_AMBIENCE_PREFERENCE);
    const shouldPlay = storedPreference !== 'false';
    enabledRef.current = shouldPlay;
    setEnabled(shouldPlay);

    const audio = new Audio(FOREST_AMBIENCE_SOURCE);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    audioRef.current = audio;

    if (shouldPlay) void playWithFade();

    const unlockAudio = () => {
      if (enabledRef.current && audio.paused) void playWithFade();
    };
    const handleVisibilityChange = () => {
      if (document.hidden) pauseWithFade();
      else if (enabledRef.current) void playWithFade();
    };

    document.addEventListener('pointerdown', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      document.removeEventListener('pointerdown', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cancelFade();

      const startVolume = audio.volume;
      const startedAt = performance.now();
      const exitFade = window.setInterval(() => {
        const progress = Math.min((performance.now() - startedAt) / FADE_DURATION_MS, 1);
        audio.volume = Math.max(0, startVolume * (1 - progress));
        if (progress >= 1) {
          window.clearInterval(exitFade);
          audio.pause();
          audio.src = '';
        }
      }, FADE_INTERVAL_MS);
      audioRef.current = null;
    };
  }, [cancelFade, pauseWithFade, playWithFade]);

  function handleToggle() {
    if (enabled && needsInteraction) {
      void playWithFade();
      return;
    }

    const nextEnabled = !enabled;
    enabledRef.current = nextEnabled;
    setEnabled(nextEnabled);
    window.localStorage.setItem(FOREST_AMBIENCE_PREFERENCE, String(nextEnabled));

    if (nextEnabled) void playWithFade();
    else pauseWithFade();
  }

  const label = needsInteraction
    ? 'Play forest ambience'
    : enabled && isPlaying
      ? 'Forest ambience on'
      : 'Forest ambience off';

  return (
    <button
      aria-label={label}
      aria-pressed={enabled && isPlaying}
      className={
        iconOnly
          ? 'grid size-10 place-items-center rounded-lg border border-white/20 bg-black/45 text-white shadow-sm backdrop-blur transition hover:border-dashboard-accent hover:bg-black/65'
          : 'inline-flex items-center gap-2 rounded-lg border border-dashboard-border bg-dashboard-surface px-4 py-2 text-sm font-medium text-dashboard-text transition hover:border-dashboard-accent/50'
      }
      onClick={handleToggle}
      title={label}
      type="button"
    >
      <SpeakerIcon muted={!enabled || !isPlaying} />
      {iconOnly ? null : (
        <span>{needsInteraction ? 'Play ambience' : enabled ? 'Sound on' : 'Sound off'}</span>
      )}
    </button>
  );
}
