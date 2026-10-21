'use client';

import { useEffect, useState } from 'react';
import { ReactLenis } from 'lenis/react';
import 'lenis/dist/lenis.css';

export function LandingMotion() {
  const [reducedMotion, setReducedMotion] = useState(true);

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

  return <ReactLenis root options={{ autoRaf: true, anchors: true, smoothWheel: true, lerp: 0.1 }} />;
}
