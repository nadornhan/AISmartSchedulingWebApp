/* A seven-second task proposal illustration, synchronized with deck playback. */
(() => {
  'use strict';
  const scene = document.getElementById('ai-task-flow');
  if (!scene) return;
  const slide = scene.closest('.slide');
  const stage = document.getElementById('stage');
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const flowPlaybackRate = 2;
  const nodes = Array.from(scene.querySelectorAll('[data-flow-node]')).map((element) => ({
    element,
    at: Number(element.dataset.at),
    baseOpacity: element.hasAttribute('data-flow-reveal') ? 0.08 : 0.52,
  }));
  const routes = Array.from(scene.querySelectorAll('[data-flow-route]')).map((element) => {
    const path = element.querySelector('path');
    const trace = element.querySelector('.ai-flow-trace');
    const length = path.getTotalLength();
    trace.style.strokeDasharray = `${length} ${length}`;
    return {
      path,
      trace,
      packet: element.querySelector('.ai-flow-packet'),
      length,
      at: Number(element.dataset.at),
      duration: Number(element.dataset.duration),
      alternative: element.hasAttribute('data-flow-alternative'),
    };
  });
  const halo = scene.querySelector('[data-flow-halo]');
  let active = false;
  let elapsed = 0;

  const clamp = (value) => Math.max(0, Math.min(1, value));
  const smooth = (value) => value * value * (3 - 2 * value);

  function render(time) {
    const motion = stage.dataset.motion !== 'reduced' && !media.matches;
    const frame = motion ? time * flowPlaybackRate : 6000;
    nodes.forEach(({ element, at, baseOpacity }) => {
      const reveal = smooth(clamp((frame - at) / 350));
      element.style.opacity = String(baseOpacity + (1 - baseOpacity) * reveal);
      element.style.transform = `translateY(${(1 - reveal) * 5}px)`;
      element.classList.toggle('is-current', frame >= at && frame < at + 700);
    });
    routes.forEach(({ path, trace, packet, length, at, duration, alternative }) => {
      const progress = alternative ? 0 : clamp((frame - at) / duration);
      trace.style.strokeDashoffset = String(length * (1 - progress));
      const settled = clamp((frame - at - duration) / 500);
      trace.style.opacity = progress > 0 ? String(0.72 - 0.5 * settled) : '0';
      const point = path.getPointAtLength(length * progress);
      packet.setAttribute('cx', String(point.x));
      packet.setAttribute('cy', String(point.y));
      packet.style.opacity = motion && progress > 0 && progress < 1 ? '1' : '0';
    });
    const processing = motion && time >= 1500 && time < 2600;
    halo.style.opacity = String(processing ? 0.12 + Math.sin(((time - 1500) / 1100) * Math.PI) * 0.3 : 0.08);
    scene.dataset.flowStep = frame < 1400 ? 'context'
      : frame < 2400 ? 'understand'
      : frame < 3500 ? 'route'
      : frame < 4300 ? 'check'
      : frame < 5350 ? 'proposal' : 'review';
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
