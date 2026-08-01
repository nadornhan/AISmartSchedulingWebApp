import type { ReactNode } from 'react';

type AuthShellProps = {
  children: ReactNode;
  tagline?: string;
};

export function AuthShell({
  children,
  tagline = 'Join thousands of productive people managing their work smarter',
}: AuthShellProps) {
  return (
    <main className="flex min-h-screen bg-[#000306] text-[var(--text-primary)]">
      <aside className="relative hidden w-[51%] min-h-screen overflow-hidden lg:block">
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-bottom"
          src="/auth/auth-hero.png"
        />
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 flex flex-col items-center px-10 pt-[22%] text-center">
          <img
            alt="Chrono logo"
            className="mb-3 size-[101px] object-cover"
            src="/auth/auth-logo.png"
          />
          <h1 className="font-[family-name:var(--font-poppins)] text-[58px] font-semibold leading-none text-white">
            Chrono
          </h1>
          <p className="mt-4 max-w-[324px] text-lg font-light tracking-[0.72px] text-white">
            {tagline}
          </p>
        </div>
      </aside>

      <section className="flex w-full min-h-screen items-center justify-center bg-[#000306] px-6 py-10 lg:w-[49%] lg:rounded-r-2xl lg:px-[clamp(2rem,8vw,6.5rem)]">
        <div className="w-full max-w-[404px]">
          <div className="mb-10 flex flex-col items-center text-center lg:hidden">
            <img
              alt="Chrono logo"
              className="mb-3 size-16 object-cover"
              src="/auth/auth-logo.png"
            />
            <p className="font-[family-name:var(--font-poppins)] text-4xl font-semibold text-white">
              Chrono
            </p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
