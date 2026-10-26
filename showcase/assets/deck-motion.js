/* Standalone slide choreography. No application imports or network calls. */
(() => {
  'use strict';
  const stage = document.getElementById('stage');
  const tree = document.getElementById('tree-object');
  const activeAnimations = new Set();
  const fullMotion = true;

  document.querySelectorAll('.capture').forEach((capture) => {
    if (
      !capture.matches(
        '.phone-screen, .laptop-screen, .qr, [data-capture="ai"], [data-capture="tasks"], [data-capture="calendar"], .focus-visual',
      )
    ) {
      capture.classList.add('window-mockup');
    }
  });

  function cancelTransitions() {
    activeAnimations.forEach((animation) => animation.cancel());
    activeAnimations.clear();
    document
      .querySelectorAll('.slide.is-leaving')
      .forEach((slide) => slide.classList.remove('is-leaving'));
  }

  function animate(element, frames, options) {
    const animation = element.animate(frames, options);
    activeAnimations.add(animation);
    animation.finished
      .then(() => {
        activeAnimations.delete(animation);
      })
      .catch(() => {});
    return animation;
  }

  function setTreePosition(slide) {
    const variant = slide.classList.contains('cover')
      ? 'hero'
      : slide.classList.contains('forest')
        ? 'forest'
        : slide.classList.contains('closing')
          ? 'closing'
          : slide.classList.contains('focus')
            ? 'focus'
            : 'hidden';
    stage.dataset.tree = variant;
    const fallback = tree.querySelector('img');
    if (variant !== 'hidden') {
      const image =
        variant === 'hero'
          ? 'chrono-tree.png'
          : variant === 'forest' || variant === 'focus'
            ? 'chrono-growing.png'
            : 'chrono-seedling.png';
      fallback.src = `assets/${image}`;
    }
  }

  document.addEventListener('showcase:slidechange', (event) => {
    const { current, previous, direction = 1 } = event.detail;
    cancelTransitions();
    setTreePosition(current);
    const calm = current.classList.contains('focus');
    stage.dataset.mood = calm ? 'calm' : 'showcase';
    if (!fullMotion) return;
    const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';

    if (previous && previous !== current) {
      previous.classList.add('is-leaving');
      const exit = animate(
        previous,
        [
          { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)', filter: 'blur(0px)' },
          {
            opacity: 0,
            transform:
              calm || previous.classList.contains('focus')
                ? 'none'
                : `translate3d(${-65 * direction}px, -8px, 0) scale(0.97)`,
            filter: calm ? 'blur(0px)' : 'blur(5px)',
          },
        ],
        { duration: calm ? 1100 : 720, easing, fill: 'none' },
      );
      exit.finished.then(() => previous.classList.remove('is-leaving')).catch(() => {});
    }

    const morph = current.classList.contains('themes') || current.classList.contains('forest');
    animate(
      current,
      [
        {
          opacity: 0,
          transform: calm ? 'none' : `translate3d(${90 * direction}px, 22px, 0) scale(1.035)`,
          filter: calm ? 'blur(0px)' : 'blur(5px)',
          clipPath: morph ? 'inset(3% 4% round 70px)' : 'inset(0% round 0px)',
        },
        {
          opacity: 1,
          transform: 'translate3d(0, 0, 0) scale(1)',
          filter: 'blur(0px)',
          clipPath: 'inset(0% round 0px)',
        },
      ],
      { duration: calm ? 1800 : 1150, easing, fill: 'none' },
    );

    const reveals = Array.from(
      current.querySelectorAll(
        '.eyebrow, h1, h2, .body, blockquote, .feature-line, .annotation-rail span, .analytics-key span, .theme-name, .mobile-caption, .closing-url, .small-signature',
      ),
    );
    reveals.forEach((element, revealIndex) => {
      animate(
        element,
        [
          { opacity: 0, translate: calm ? '0 12px' : '0 26px' },
          { opacity: 1, translate: '0 0' },
        ],
        {
          duration: calm ? 1300 : 850,
          delay: 120 + Math.min(revealIndex * 70, 490),
          easing,
          fill: 'backwards',
        },
      );
    });
    current
      .querySelectorAll('.capture, .device-laptop, .stack-phone, .floating-component, .planting-visual')
      .forEach((element, visualIndex) => {
        animate(
          element,
          [
            {
              opacity: 0,
              translate: calm ? '0 0' : '0 42px',
              filter: calm ? 'blur(0px)' : 'blur(5px)',
            },
            { opacity: 1, translate: '0 0', filter: 'blur(0px)' },
          ],
          {
            duration: calm ? 1800 : 1150,
            delay: 160 + Math.min(visualIndex * 85, 340),
            easing,
            fill: 'backwards',
          },
        );
      });
  });
  setTreePosition(document.querySelector('.slide.active'));
  stage.dataset.motion = 'full';
  document.dispatchEvent(
    new CustomEvent('showcase:motionchange', { detail: { enabled: true } }),
  );
})();
