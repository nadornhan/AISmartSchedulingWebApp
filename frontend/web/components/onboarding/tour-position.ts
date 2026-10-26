export type TourRect = { left: number; top: number; width: number; height: number };
export type TourViewport = { width: number; height: number };
export type TourPlacement = {
  left: number;
  top: number;
  side: 'left' | 'right' | 'top' | 'bottom' | 'center';
  arrow: number;
  frame: TourRect | null;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function placeTourPopover(
  target: TourRect | null,
  popup: { width: number; height: number },
  viewport: TourViewport,
): TourPlacement {
  const margin = 12;
  const gap = 16;
  const width = Math.min(popup.width, viewport.width - margin * 2);
  const height = Math.min(popup.height, viewport.height - margin * 2);
  const maxLeft = Math.max(margin, viewport.width - width - margin);
  const maxTop = Math.max(margin, viewport.height - height - margin);
  if (!target)
    return {
      left: (viewport.width - width) / 2,
      top: (viewport.height - height) / 2,
      side: 'center',
      arrow: 0,
      frame: null,
    };

  const left = clamp(target.left - 6, margin / 2, viewport.width - margin);
  const top = clamp(target.top - 6, margin / 2, viewport.height - margin);
  const right = clamp(target.left + target.width + 6, left + 1, viewport.width - margin / 2);
  const bottom = clamp(target.top + target.height + 6, top + 1, viewport.height - margin / 2);
  let frame = { left, top, width: right - left, height: bottom - top };
  const centeredLeft = clamp(left + frame.width / 2 - width / 2, margin, maxLeft);
  const centeredTop = clamp(top + frame.height / 2 - height / 2, margin, maxTop);

  if (viewport.width >= 1024 && right + gap + width <= viewport.width - margin) {
    return {
      left: right + gap,
      top: centeredTop,
      side: 'right',
      arrow: clamp(top + frame.height / 2 - centeredTop, 22, height - 22),
      frame,
    };
  }
  if (viewport.width >= 1024 && left - gap - width >= margin) {
    return {
      left: left - gap - width,
      top: centeredTop,
      side: 'left',
      arrow: clamp(top + frame.height / 2 - centeredTop, 22, height - 22),
      frame,
    };
  }
  if (bottom + gap + height <= viewport.height - margin) {
    return {
      left: centeredLeft,
      top: bottom + gap,
      side: 'bottom',
      arrow: clamp(left + frame.width / 2 - centeredLeft, 22, width - 22),
      frame,
    };
  }
  if (top - gap - height >= margin) {
    return {
      left: centeredLeft,
      top: top - gap - height,
      side: 'top',
      arrow: clamp(left + frame.width / 2 - centeredLeft, 22, width - 22),
      frame,
    };
  }

  // Keep a visible part of a tall component above or below the popup on small screens.
  // The popup never covers the framed area, even on a short landscape viewport.
  if (top < viewport.height / 2) {
    const popupTop = maxTop;
    const available = Math.max(0, popupTop - gap - top);
    frame = { ...frame, height: Math.min(frame.height, available) };
    return {
      left: centeredLeft,
      top: popupTop,
      side: available > 0 ? 'bottom' : 'center',
      arrow: clamp(left + frame.width / 2 - centeredLeft, 22, width - 22),
      frame: available > 0 ? frame : null,
    };
  }
  const visibleTop = Math.max(top, margin + height + gap);
  frame = { ...frame, top: visibleTop, height: Math.max(0, bottom - visibleTop) };
  return {
    left: centeredLeft,
    top: margin,
    side: frame.height > 0 ? 'top' : 'center',
    arrow: clamp(left + frame.width / 2 - centeredLeft, 22, width - 22),
    frame: frame.height > 0 ? frame : null,
  };
}
