/* A seven-second illustrative growth preview, synchronized with deck playback. */
(() => {
  'use strict';
  const scene = document.getElementById('forest-growth-scene');
  const stage = document.getElementById('stage');
  const tree = scene.querySelector('[data-growth-tree]');
  const slide = scene.closest('.slide');
  const xp = document.getElementById('forest-xp');
  const status = document.getElementById('forest-growing-label');
  const stageLabel = document.getElementById('forest-stage-label');
  const percentage = document.getElementById('forest-growth-percent');
  const bar = scene.querySelector('[role="progressbar"]');
  const particles = Array.from(scene.querySelectorAll('.forest-xp-particle'));
  const fallback = tree.querySelector('img');
  const fallbackImages = {
    seedling: 'assets/chrono-seedling.png',
    growing: 'assets/chrono-growing.png',
    mature: 'assets/chrono-tree.png',
  };
  let active = false;
  let elapsed = 0;
  let lastVariant = '';

  function render(time) {
    const motion = stage.dataset.motion !== 'reduced' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const progress = motion ? Math.min(1, Math.max(0, (time - 500) / 5200)) : 1;
    const eased = progress * progress * (3 - 2 * progress);
    const variant = progress < 0.3 ? 'seedling' : progress < 0.72 ? 'growing' : 'mature';
    const scale = 0.28 + eased * 0.72;
    const percent = Math.round(progress * 100);
    scene.style.setProperty('--growth-progress', progress.toFixed(4));
    tree.style.setProperty('--forest-tree-scale', scale.toFixed(4));
    scene.dataset.growthStage = variant;
    scene.dataset.growthProgress = progress.toFixed(4);
    scene.dataset.growthScale = scale.toFixed(4);
    scene.dataset.growthElapsed = String(time);
    xp.textContent = String(Math.round(progress * 150));
    status.textContent = progress === 1 ? 'Fully grown' : 'Growing';
    stageLabel.textContent = { seedling: 'Seedling', growing: 'Growing tree', mature: 'Mature tree' }[variant];
    percentage.textContent = `${percent}%`;
    bar.setAttribute('aria-valuenow', String(percent));
    if (variant !== lastVariant) {
      fallback.src = fallbackImages[variant];
      lastVariant = variant;
    }
    particles.forEach((particle, index) => {
      const age = time - (500 + ((index + 1) * 5200) / particles.length);
      const fraction = age / 850;
      const visible = motion && fraction >= 0 && fraction <= 1;
      particle.style.opacity = visible ? String(Math.sin(Math.PI * fraction)) : '0';
      particle.style.transform = `translateY(${-65 * Math.max(0, fraction)}px)`;
    });
    document.dispatchEvent(new CustomEvent('showcase:forestgrowth', {
      detail: { variant, scale, progress, elapsed: time },
    }));
  }

  document.addEventListener('showcase:slidechange', (event) => {
    active = event.detail.current === slide;
    elapsed = 0;
    lastVariant = '';
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
