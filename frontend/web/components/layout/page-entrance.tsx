'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';

export function PageEntrance({
  children,
  className,
}: Readonly<{ children: ReactNode; className?: string }>) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!element || reducedMotion.matches) return;

    // Replay without remounting the page, restarting requests, or resetting its state.
    const animation = element.animate(
      [
        { opacity: 0, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
    const cancel = () => animation.cancel();
    reducedMotion.addEventListener('change', cancel);

    return () => {
      animation.cancel();
      reducedMotion.removeEventListener('change', cancel);
    };
  }, [pathname]);

  return (
    <div className={className} ref={ref}>
      {children}
    </div>
  );
}
