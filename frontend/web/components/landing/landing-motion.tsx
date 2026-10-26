'use client';

import { useEffect, useState } from 'react';
import { ReactLenis, useLenis } from 'lenis/react';
import { Pause, Play } from 'lucide-react';
import styles from '../../app/landing/page.module.css';
import 'lenis/dist/lenis.css';

const SECTION_PAUSE_MS = 6_000;

function LandingAutoScroll({ enabled }: { enabled: boolean }) {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis || !enabled) return;

    const sections = Array.from(document.querySelectorAll<HTMLElement>('#main > section'));
    if (sections.length < 2) return;

    let timer: number | undefined;
    let disposed = false;
    let scrollingAutomatically = false;

    function scheduleNextSection() {
      window.clearTimeout(timer);
      if (disposed || document.hidden) return;
      timer = window.setTimeout(advanceSection, SECTION_PAUSE_MS);
    }

    const advanceSection = () => {
      if (disposed || document.hidden) return;
      if (
        document.activeElement?.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"]',
        )
      ) {
        scheduleNextSection();
        return;
      }

      let currentIndex = 0;
      sections.forEach((section, index) => {
        if (section.getBoundingClientRect().top <= window.innerHeight * 0.35) {
          currentIndex = index;
        }
      });

      const nextSection = sections[currentIndex + 1];
      if (!nextSection) return;

      scrollingAutomatically = true;
      lenis.scrollTo(nextSection, {
        offset: -24,
        duration: 1.2,
        lerp: 0,
        easing: (progress) => 1 - Math.pow(1 - progress, 3),
        onComplete: () => {
          scrollingAutomatically = false;
          scheduleNextSection();
        },
      });
    };

    // Give visitors another full pause after they scroll or interact manually.
    const interactionEvents = ['wheel', 'touchstart', 'touchmove', 'pointerdown', 'keydown'] as const;
    interactionEvents.forEach((event) => {
      window.addEventListener(event, scheduleNextSection, { passive: true });
    });
    document.addEventListener('visibilitychange', scheduleNextSection);
    scheduleNextSection();

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      if (scrollingAutomatically) lenis.scrollTo(lenis.actualScroll, { immediate: true });
      interactionEvents.forEach((event) => {
        window.removeEventListener(event, scheduleNextSection);
      });
      document.removeEventListener('visibilitychange', scheduleNextSection);
    };
  }, [enabled, lenis]);

  return null;
}

export function LandingMotion() {
  const [reducedMotion, setReducedMotion] = useState(true);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => setReducedMotion(preference.matches);

    syncPreference();
    preference.addEventListener('change', syncPreference);
    return () => preference.removeEventListener('change', syncPreference);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;

    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!targets.length) return;

    for (const target of targets) {
      const delayStep = Number(target.dataset.revealDelay ?? 0);
      target.style.setProperty('--reveal-delay', `${Math.max(0, Math.min(delayStep, 4)) * 90}ms`);
    }

    if (!('IntersectionObserver' in window)) {
      targets.forEach((target) => target.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.14, rootMargin: '0px 0px -6% 0px' },
    );

    targets.forEach((target) => observer.observe(target));
    document.documentElement.classList.add('landing-motion-ready');

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove('landing-motion-ready');
    };
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return (
    <>
      <ReactLenis root options={{ autoRaf: true, anchors: true, smoothWheel: true, lerp: 0.1 }}>
        <LandingAutoScroll enabled={autoScrollEnabled} />
      </ReactLenis>
      <button
        type="button"
        className={styles.autoScrollToggle}
        aria-label="Auto scroll"
        aria-pressed={autoScrollEnabled}
        title={autoScrollEnabled ? 'Pause automatic scrolling' : 'Resume automatic scrolling'}
        onClick={() => setAutoScrollEnabled((enabled) => !enabled)}
      >
        {autoScrollEnabled ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
        <span>Auto scroll</span>
        <span className={styles.autoScrollState} aria-hidden="true">
          {autoScrollEnabled ? 'On' : 'Off'}
        </span>
      </button>
    </>
  );
}
