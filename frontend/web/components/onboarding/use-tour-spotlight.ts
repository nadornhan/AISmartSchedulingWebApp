'use client';

import { useEffect, useState, type RefObject } from 'react';
import { placeTourPopover, type TourPlacement } from './tour-position';

type SpotlightStep = { route: string; targets: readonly string[]; fallback: string };

function visibleTarget(selectors: readonly string[]) {
  for (const selector of selectors) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      const bounds = element.getBoundingClientRect();
      if (
        bounds.width > 0 &&
        bounds.height > 0 &&
        getComputedStyle(element).visibility !== 'hidden'
      )
        return element;
    }
  }
  return null;
}

export function useTourSpotlight(
  open: boolean,
  step: SpotlightStep,
  pathname: string,
  popupRef: RefObject<HTMLElement | null>,
) {
  const [placement, setPlacement] = useState<{
    step: SpotlightStep;
    pathname: string;
    value: TourPlacement;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    let request = 0;
    let previousTick = -Infinity;
    let previousTarget: HTMLElement | null = null;
    let previousViewport = '';
    let previousPlacement = '';
    const startedAt = performance.now();
    setPlacement(null);

    function update(now: number) {
      request = window.requestAnimationFrame(update);
      if (now - previousTick < 80) return;
      previousTick = now;
      const popup = popupRef.current;
      if (!popup) return;
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const ready = pathname === step.route.split('?')[0];
      const target = ready
        ? (visibleTarget(step.targets) ??
          (now - startedAt > 1800
            ? visibleTarget([step.fallback, '[data-tour="workspace"]'])
            : null))
        : null;
      const viewportKey = `${viewport.width}:${viewport.height}`;
      if (target && (target !== previousTarget || viewportKey !== previousViewport)) {
        previousTarget = target;
        previousViewport = viewportKey;
        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
        // Reserve room below a mobile target for its explanatory popup.
        if (viewport.width < 1024) {
          const bounds = target.getBoundingClientRect();
          const available = viewport.height - popup.offsetHeight - 44;
          if (bounds.height <= available && bounds.bottom > available + 12) {
            let scrollParent: HTMLElement | null = target.parentElement;
            while (
              scrollParent &&
              !(
                scrollParent.scrollHeight > scrollParent.clientHeight &&
                /auto|scroll/.test(getComputedStyle(scrollParent).overflowY)
              )
            )
              scrollParent = scrollParent.parentElement;
            const delta = bounds.top - 16;
            if (scrollParent) scrollParent.scrollBy({ top: delta, behavior: 'instant' });
            else window.scrollBy({ top: delta, behavior: 'instant' });
          }
        }
      }
      const bounds = target?.getBoundingClientRect() ?? null;
      const next = placeTourPopover(
        bounds,
        { width: popup.offsetWidth, height: popup.offsetHeight },
        viewport,
      );
      const serialized = JSON.stringify(next);
      if (serialized !== previousPlacement) {
        previousPlacement = serialized;
        setPlacement({ step, pathname, value: next });
      }
    }
    request = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(request);
  }, [open, pathname, popupRef, step]);

  return open && placement?.step === step && placement.pathname === pathname
    ? placement.value
    : null;
}
