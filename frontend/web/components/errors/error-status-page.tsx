'use client';

import Link from 'next/link';
import { Clock3, SearchX } from 'lucide-react';

type ErrorStatusPageProps = {
  kind: 'not-found' | 'timeout';
};

export function ErrorStatusPage({ kind }: ErrorStatusPageProps) {
  const isTimeout = kind === 'timeout';
  const Icon = isTimeout ? Clock3 : SearchX;
  const code = isTimeout ? '408' : '404';
  const title = isTimeout ? 'Request timed out' : 'Page not found';
  const description = isTimeout
    ? 'The request took too long to finish. Check your connection and try again.'
    : 'This page may have moved or no longer exists. Let’s get you back on track.';

  return (
    <main className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden bg-dashboard-bg px-5 py-12 text-dashboard-text">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_42%,rgba(53,227,181,0.1),transparent_55%)]"
      />
      <section className="w-full max-w-lg rounded-3xl border border-dashboard-border bg-dashboard-surface/85 p-7 text-center shadow-panel backdrop-blur sm:p-10">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-dashboard-accent/20 bg-dashboard-accent-soft text-dashboard-accent">
          <Icon aria-hidden="true" className="size-7" strokeWidth={1.7} />
        </div>
        <p className="mt-6 font-poppins text-6xl font-semibold tracking-tight text-dashboard-accent sm:text-7xl">
          {code}
        </p>
        <h1 className="mt-3 font-poppins text-2xl font-semibold text-dashboard-text sm:text-3xl">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-dashboard-muted sm:text-base">
          {description}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {isTimeout ? (
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-dashboard-accent-strong to-dashboard-accent px-5 text-sm font-semibold text-dashboard-on-accent-inverse shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent"
              onClick={() => window.location.reload()}
              type="button"
            >
              Try again
            </button>
          ) : (
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-dashboard-accent-strong to-dashboard-accent px-5 text-sm font-semibold text-dashboard-on-accent-inverse shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent"
              href="/"
            >
              Go to home
            </Link>
          )}
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dashboard-border px-5 text-sm font-medium text-dashboard-text transition hover:border-dashboard-accent/50 hover:bg-dashboard-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent"
            href="/dashboard"
          >
            Go to dashboard
          </Link>
        </div>
        <p className="mt-8 text-xs font-medium tracking-[0.18em] text-dashboard-subtle">CHRONO</p>
      </section>
    </main>
  );
}
