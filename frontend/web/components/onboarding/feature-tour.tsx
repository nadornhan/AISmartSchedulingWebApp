'use client';

import { ArrowRight, Check, ChevronLeft, LoaderCircle, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { tourSteps } from './feature-tour-content';
import { useTourSpotlight } from './use-tour-spotlight';
import styles from './feature-tour.module.css';

export function FeatureTour({ userId }: { userId?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const offered = useRef(false);
  const ownsTaskForm = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const popupRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const storageKey = userId ? `chrono-onboarding:v1:${userId}` : null;
  const step = tourSteps[stepIndex];
  const placement = useTourSpotlight(open, step, pathname, popupRef);
  const frame = placement?.frame;

  const start = useCallback(() => {
    if (!userId) return;
    offered.current = true;
    setStepIndex(0);
    setOpen(true);
    router.replace('/dashboard', { scroll: false });
  }, [router, userId]);

  const closeTourTaskForm = useCallback(() => {
    if (!ownsTaskForm.current) return;
    ownsTaskForm.current = false;
    window.dispatchEvent(new Event('chrono:close-tour-task-form'));
  }, []);

  const dismiss = useCallback(
    (result: 'completed' | 'skipped') => {
      const wasShowingTaskForm = ownsTaskForm.current;
      closeTourTaskForm();
      if (wasShowingTaskForm) router.replace('/tasks', { scroll: false });
      if (storageKey) {
        try {
          window.localStorage.setItem(storageKey, result);
        } catch {
          /* Keep the close controls available when browser storage is blocked. */
        }
      }
      setOpen(false);
    },
    [closeTourTaskForm, router, storageKey],
  );

  useEffect(() => {
    if (!storageKey || pathname !== '/dashboard' || offered.current) return;
    try {
      if (window.localStorage.getItem(storageKey)) {
        offered.current = true;
        return;
      }
    } catch {
      /* Offer it once this session when storage is unavailable. */
    }
    const timeout = window.setTimeout(() => {
      offered.current = true;
      if (document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return;
      start();
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [pathname, start, storageKey]);

  useEffect(() => {
    window.addEventListener('chrono:start-feature-tour', start);
    return () => window.removeEventListener('chrono:start-feature-tour', start);
  }, [start]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      closeTourTaskForm();
    };
  }, [closeTourTaskForm, open]);

  useEffect(() => {
    if (open) headingRef.current?.focus({ preventScroll: true });
  }, [open, stepIndex]);

  function goToStep(index: number) {
    closeTourTaskForm();
    const next = tourSteps[index];
    ownsTaskForm.current = next.id === 'ai';
    setStepIndex(index);
    router.replace(next.route, { scroll: false });
  }

  function next() {
    if (stepIndex === tourSteps.length - 1) dismiss('completed');
    else goToStep(stepIndex + 1);
  }

  return (
    <dialog
      aria-describedby="chrono-tour-description"
      aria-labelledby="chrono-tour-title"
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault();
        dismiss('skipped');
      }}
      ref={dialogRef}
    >
      <svg aria-hidden="true" className={styles.shade} width="100%" height="100%">
        <defs>
          <mask id="chrono-tour-spotlight" maskUnits="userSpaceOnUse">
            <rect width="100%" height="100%" fill="white" />
            {frame ? (
              <rect
                x={frame.left}
                y={frame.top}
                width={frame.width}
                height={frame.height}
                rx="12"
                fill="black"
              />
            ) : null}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 3, 6, .68)"
          mask="url(#chrono-tour-spotlight)"
        />
      </svg>
      {frame ? (
        <div
          aria-hidden="true"
          className={styles.frame}
          style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}
        />
      ) : null}
      <section
        className={styles.popup}
        data-placement={placement?.side ?? 'center'}
        ref={popupRef}
        style={
          placement
            ? ({
                left: placement.left,
                top: placement.top,
                '--arrow-offset': `${placement.arrow}px`,
              } as CSSProperties)
            : undefined
        }
      >
        {frame && placement?.side !== 'center' ? (
          <span aria-hidden="true" className={styles.pointer} />
        ) : null}
        <div className={styles.surface}>
          <header className={styles.header}>
            <p className={styles.eyebrow}>
              <step.icon size={17} />
              <span>{step.label}</span>
            </p>
            <button
              aria-label="Skip tour"
              className={styles.iconButton}
              onClick={() => dismiss('skipped')}
              type="button"
            >
              <X size={18} />
            </button>
          </header>
          <div className={styles.copy} key={step.id}>
            <h2 id="chrono-tour-title" ref={headingRef} tabIndex={-1}>
              {step.title}
            </h2>
            <p className={styles.description} id="chrono-tour-description">
              {step.description}
            </p>
            <ul className={styles.tips}>
              {step.tips.map((tip) => (
                <li key={tip}>
                  <Check size={15} />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
            <p className={styles.location}>
              <span className={styles.desktopHint}>{step.desktop}</span>
              <span className={styles.mobileHint}>{step.mobile}</span>
            </p>
            {!frame ? (
              <p className={styles.finding} role="status">
                <LoaderCircle size={13} /> Finding this part of your workspace…
              </p>
            ) : null}
          </div>
          <nav aria-label="Tour steps" className={styles.steps}>
            {tourSteps.map((item, index) => (
              <button
                aria-current={index === stepIndex ? 'step' : undefined}
                aria-label={`Step ${index + 1} of ${tourSteps.length}: ${item.label}`}
                className={index <= stepIndex ? styles.reachedStep : ''}
                key={item.id}
                onClick={() => goToStep(index)}
                type="button"
              >
                <span />
              </button>
            ))}
          </nav>
          <footer className={styles.footer}>
            <div className={styles.footerStart}>
              {stepIndex > 0 ? (
                <button
                  aria-label="Previous tour step"
                  className={styles.backButton}
                  onClick={() => goToStep(stepIndex - 1)}
                  type="button"
                >
                  <ChevronLeft size={18} />
                </button>
              ) : null}
              <span className={styles.counter}>
                {stepIndex + 1} of {tourSteps.length}
              </span>
              <button
                className={styles.skipButton}
                onClick={() => dismiss('skipped')}
                type="button"
              >
                Skip
              </button>
            </div>
            <button className={styles.primaryButton} onClick={next} type="button">
              {stepIndex === tourSteps.length - 1 ? 'Finish tour' : 'Next'}
              {stepIndex === tourSteps.length - 1 ? <Check size={16} /> : <ArrowRight size={16} />}
            </button>
          </footer>
        </div>
      </section>
    </dialog>
  );
}
