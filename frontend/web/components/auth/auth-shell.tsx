'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { PageEntrance } from '../layout/page-entrance';
import styles from './auth.module.css';

type AuthShellProps = {
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({ children, footer }: AuthShellProps) {
  const router = useRouter();
  const prepared = useRef(false);

  useEffect(() => {
    if (prepared.current) return;
    prepared.current = true;
    router.prefetch('/dashboard');
    // Start a sleeping API while the user fills in the form. This single public
    // request carries no credentials and is never awaited by sign-in.
    void fetch('/api/health/live', {
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(60_000),
    }).catch(() => undefined);
  }, [router]);

  return (
    <main data-theme="dark" className={styles.page}>
      <div className={styles.shell}>
        <Link href="/" className={styles.brand} aria-label="Chrono home">
          <img alt="" width={40} height={40} src="/chrono-logo.png" />
          <span>Chrono</span>
        </Link>
        <section className={styles.formColumn}>
          <PageEntrance className={styles.formContent}>{children}</PageEntrance>
          <div className={styles.footer}>{footer}</div>
        </section>
        <aside className={styles.artwork} aria-label="Mountain landscape">
          <img
            alt="A mint trail winding towards a mountain summit at night"
            src="/auth/auth-hero.png"
            className={styles.mountain}
          />
          <div className={styles.imageShade} />
        </aside>
        <Link className={styles.close} href="/">
          <span>Back to website</span>
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
