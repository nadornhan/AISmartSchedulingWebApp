'use client';

import { useEffect, useRef, useState } from 'react';

export function useFocusFullscreen() {
  const panelRef = useRef<HTMLElement>(null);
  const fallbackActive = useRef(false);
  const requestPending = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');

  useEffect(() => {
    function syncFullscreen() {
      fallbackActive.current = false;
      setIsFullscreen(document.fullscreenElement === panelRef.current);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (fallbackActive.current) {
        fallbackActive.current = false;
        setIsFullscreen(false);
      } else if (document.fullscreenElement === panelRef.current) {
        void document.exitFullscreen().catch(() => {
          setFullscreenError('Fullscreen could not be changed. Please try again.');
        });
      }
    }

    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  async function toggleFullscreen() {
    const panel = panelRef.current;
    if (!panel || requestPending.current) return;
    setFullscreenError('');
    requestPending.current = true;

    try {
      if (document.fullscreenElement === panel) {
        await document.exitFullscreen();
        setIsFullscreen(document.fullscreenElement === panel);
      } else if (fallbackActive.current) {
        fallbackActive.current = false;
        setIsFullscreen(false);
      } else if (document.fullscreenEnabled && panel.requestFullscreen) {
        await panel.requestFullscreen();
        setIsFullscreen(document.fullscreenElement === panel);
      } else {
        // Mobile browsers without the Fullscreen API can still fill the viewport.
        fallbackActive.current = true;
        setIsFullscreen(true);
      }
    } catch {
      setFullscreenError('Fullscreen could not be changed. Please try again.');
    } finally {
      requestPending.current = false;
    }
  }

  return { panelRef, isFullscreen, fullscreenError, toggleFullscreen };
}
