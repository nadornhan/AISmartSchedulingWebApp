'use client';

import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';

type HeaderDropdownProps = {
  children: ReactNode;
  label: string;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  className?: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function focusMenuItem(items: HTMLElement[], nextIndex: number) {
  const item = items.at(nextIndex);
  item?.focus();
}

export function HeaderDropdown({
  children,
  className,
  label,
  onClose,
  triggerRef,
}: HeaderDropdownProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) return;

      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }

      onClose();
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      onClose();
      triggerRef.current?.focus();
    }

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, triggerRef]);

  function handlePanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)'),
    );

    if (!items.length) return;

    event.preventDefault();

    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const offset = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex =
      currentIndex === -1
        ? event.key === 'ArrowDown'
          ? 0
          : items.length - 1
        : (currentIndex + offset + items.length) % items.length;

    focusMenuItem(items, nextIndex);
  }

  return (
    <div
      aria-label={label}
      className={cn(
        'absolute right-0 top-full z-[200] mt-3 max-h-[calc(100vh-8rem)] w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-dashboard-border bg-[#071923] p-2 text-dashboard-text shadow-panel outline-none',
        className,
      )}
      onKeyDown={handlePanelKeyDown}
      ref={panelRef}
      role="dialog"
    >
      {children}
    </div>
  );
}
