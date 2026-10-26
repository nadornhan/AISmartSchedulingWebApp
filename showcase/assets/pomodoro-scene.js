/* A single countdown with a quick scene change. Driven by the deck's own clock. */
(() => {
  'use strict';
  const scene = document.querySelector('.fullscreen-pomo');
  const stage = document.getElementById('stage');
  const progress = document.getElementById('progress');
  const clock = document.getElementById('pomo-clock');
  const label = document.getElementById('pomo-phase-label');
  const caption = document.getElementById('pomo-state-caption');
  const ring = scene.querySelector('.pomo-ring-progress');
  const circumference = Math.PI * 2 * 282;
  const colors = { focus: [41, 216, 180], break: [179, 160, 230] };
  const modeSwitchAtMs = Number(scene.dataset.seconds) * 1000 * 0.4;
  const sceneTransitionDurationMs = 600;
  let active = false;
  let phase = 'focus';
  let lastSecond = -1;
  let phaseAnimation = null;

  function render(elapsed) {
    const motion = stage.dataset.motion !== 'reduced';
    const nextPhase = elapsed >= modeSwitchAtMs ? 'break' : 'focus';
    const linearMix = motion
      ? Math.min(
          1,
          Math.max(0, (elapsed - modeSwitchAtMs) / sceneTransitionDurationMs),
        )
      : nextPhase === 'break' ? 1 : 0;
    const mix = linearMix * linearMix * (3 - 2 * linearMix);
    const total = nextPhase === 'break' ? 300 : 1500;
    const phaseElapsed = nextPhase === 'break' ? Math.max(0, elapsed - modeSwitchAtMs) : elapsed;
    const remaining = Math.max(0, total - Math.floor(phaseElapsed / 1000));
    const accent = colors.focus.map((channel, index) =>
      Math.round(channel + (colors.break[index] - channel) * mix),
    );
    progress.style.backgroundColor = `rgb(${accent.join(', ')})`;
    scene.style.setProperty('--pomo-break', mix.toFixed(4));
    scene.style.setProperty('--pomo-accent', `rgb(${accent.join(', ')})`);
    scene.dataset.phase = nextPhase;
    ring.style.strokeDasharray = String(circumference);
    ring.style.strokeDashoffset = String(circumference * (1 - remaining / total));

    if (nextPhase !== phase) {
      phase = nextPhase;
      label.textContent = phase === 'break' ? 'Short break' : 'Pomodoro';
      caption.textContent = phase === 'break' ? 'Time for a break' : 'Time to focus';
      lastSecond = -1;
      phaseAnimation?.cancel();
      if (motion)
        phaseAnimation = clock.animate(
          [
            { opacity: 0.6, translate: '0 2px' },
            { opacity: 1, translate: '0 0' },
          ],
          { duration: 180, easing: 'ease-out' },
        );
    }
    if (remaining !== lastSecond) {
      clock.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
      clock.dateTime = `PT${remaining}S`;
      clock.setAttribute(
        'aria-label',
        `${phase === 'break' ? 'Break' : 'Focus'} countdown: ${Math.floor(remaining / 60)} minutes ${remaining % 60} seconds`,
      );
      lastSecond = remaining;
    }
    document.dispatchEvent(new CustomEvent('showcase:pomophase', { detail: { mix } }));
  }

  document.addEventListener('showcase:slidechange', (event) => {
    active = event.detail.current === scene;
    phaseAnimation?.cancel();
    if (active) render(0);
    else {
      progress.style.backgroundColor = 'var(--mint)';
      document.dispatchEvent(new CustomEvent('showcase:pomophase', { detail: { mix: 0 } }));
    }
  });
  document.addEventListener('showcase:clock', (event) => {
    if (active) render(event.detail.elapsed);
  });
  document.addEventListener('showcase:motionchange', () => {
    if (stage.dataset.motion === 'reduced') phaseAnimation?.cancel();
  });
})();
