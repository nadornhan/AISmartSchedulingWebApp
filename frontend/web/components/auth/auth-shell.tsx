import type { ReactNode } from 'react';
import { PageEntrance } from '../layout/page-entrance';

type AuthShellProps = {
  children: ReactNode;
  tagline?: string;
};

export function AuthShell({
  children,
  tagline = '“The secret of getting ahead is getting started.” — Mark Twain',
}: AuthShellProps) {
  return (
    <main data-theme="dark" className="flex min-h-screen flex-col bg-[#000306] text-[var(--text-primary)] lg:flex-row">
      <div className="relative h-[30svh] min-h-[220px] max-h-[380px] overflow-hidden lg:hidden">
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[center_80%]"
          src="/auth/auth-hero.png"
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,transparent_68%,#000306_100%)]" />
        <div className="absolute left-6 top-[max(1.25rem,env(safe-area-inset-top))] flex items-start gap-1">
          <img alt="Chrono logo" className="size-9 object-contain" src="/chrono-logo.png" />
          <span className="mt-1 font-[family-name:var(--font-poppins)] text-xl font-semibold text-white">Chrono</span>
        </div>
      </div>
      <aside className="relative hidden w-[60%] min-h-screen overflow-hidden lg:block">
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-bottom"
          src="/auth/auth-hero.png"
        />
        <div className="absolute inset-0 bg-black/20" />
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 w-28 bg-gradient-to-r from-transparent to-[#000306]"
        />
        <div className="absolute left-8 top-8 z-10 flex items-center gap-1 lg:left-10 lg:top-10">
          <img
            alt="Chrono logo"
            className="size-12 object-contain"
            src="/chrono-logo.png"
          />
          <h1 className="mt-1 font-[family-name:var(--font-poppins)] text-3xl font-semibold leading-none text-white">
            Chrono
          </h1>
        </div>
        <div className="absolute bottom-10 left-8 z-10 max-w-md text-left lg:bottom-12 lg:left-10">
          <p className="mt-4 max-w-[324px] text-lg font-light tracking-[0.72px] text-white">
            {tagline}
          </p>
        </div>
      </aside>
      <section className="flex w-full min-h-[70svh] flex-1 items-start justify-center bg-[#000306] px-6 pb-6 pt-0 lg:min-h-screen lg:flex-none lg:w-[40%] lg:items-center lg:rounded-r-2xl lg:px-[clamp(1.5rem,3vw,3.5rem)] lg:py-10">
        <PageEntrance className="w-full max-w-[404px]">
          {children}
        </PageEntrance>
      </section>
    </main>
  );
}
