/* Illustrative scheduling review; updates only this slide using the deck clock. */
(() => {
  'use strict';
  const scene = document.getElementById('scheduling-review');
  if (!scene) return;
  const slide = scene.closest('.slide.scheduling');
  const stage = scene.closest('.stage');
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const shell = scene.querySelector('[data-schedule-shell]');
  const checks = scene.querySelector('[data-schedule-checks]');
  const progress = scene.querySelector('[data-schedule-progress]');
  const status = scene.querySelector('[data-schedule-status]');
  const steps = Array.from(scene.querySelectorAll('[data-schedule-step]')).map((element) => ({
    element,
    at: Number(element.dataset.at),
  }));
  const ticks = Array.from(scene.querySelectorAll('[data-schedule-tick]')).map((element) => ({
    element,
    at: Number(element.dataset.at),
  }));
  let active = false;
  let elapsed = 0;

  const clamp = (value) => Math.min(1, Math.max(0, value));
  const ease = (value) => value * value * (3 - 2 * value);

  function render(time) {
    const motion = stage.dataset.motion !== 'reduced' && !media.matches;
    const frame = motion ? time : 6000;
    const entrance = ease(clamp(frame / 450));
    shell.style.opacity = String(entrance);
    shell.style.transform = `translateY(${12 * (1 - entrance)}px)`;

    checks.style.opacity = String(ease(clamp(frame / 250)) * (1 - ease(clamp((frame - 1500) / 300))));
    progress.setAttribute('width', String(774 * clamp(frame / 1600)));
    progress.style.opacity = String(1 - ease(clamp((frame - 1600) / 300)));
    ticks.forEach(({ element, at }) => {
      element.style.opacity = String(ease(clamp((frame - at) / 250)));
    });
    steps.forEach(({ element, at }) => {
      const reveal = ease(clamp((frame - at) / 320));
      element.style.opacity = String(reveal);
      element.style.transform = `translateY(${8 * (1 - reveal)}px)`;
    });

    const message = frame < 1700
      ? 'Checking working hours, deadlines and locked tasks…'
      : 'Times are validated against working hours, deadlines and locked tasks.';
    if (status.textContent !== message) status.textContent = message;
    scene.dataset.reviewPhase = frame < 1800 ? 'checking'
      : frame < 2200 ? 'capacity'
      : frame < 3600 ? 'issues' : 'review';
  }

  document.addEventListener('showcase:slidechange', (event) => {
    active = event.detail.current === slide;
    elapsed = 0;
    if (active) render(0);
  });
  document.addEventListener('showcase:clock', (event) => {
    if (!active) return;
    elapsed = event.detail.elapsed;
    render(elapsed);
  });
  document.addEventListener('showcase:motionchange', () => {
    if (active) render(elapsed);
  });
})();
