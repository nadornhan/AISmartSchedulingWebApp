import Link from 'next/link';

type AuthPrimaryButtonProps = {
  children: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
  /** Login Figma uses white label; Register uses dark label. */
  tone?: 'dark' | 'light';
};

export function AuthPrimaryButton({
  children,
  disabled,
  type = 'submit',
  onClick,
  tone = 'dark',
}: AuthPrimaryButtonProps) {
  return (
    <button
      className={`h-[46px] flex-1 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold transition hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70 ${
        tone === 'light' ? 'text-white' : 'text-[#040c14]'
      }`}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

type AuthSecondaryLinkProps = {
  href: string;
  children: string;
};

export function AuthSecondaryLink({ href, children }: AuthSecondaryLinkProps) {
  return (
    <Link
      className="inline-flex h-[46px] flex-1 items-center justify-center rounded-lg bg-[rgba(94,129,244,0.1)] px-4 text-sm font-bold text-[var(--accent)] transition hover:bg-[rgba(94,129,244,0.16)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      href={href}
    >
      {children}
    </Link>
  );
}

export function AuthSocialRow() {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="text-sm text-white">Or sign in with</p>
      <div className="grid w-full grid-cols-2 gap-3">
        <SocialMockButton name="Google" />
        <SocialMockButton name="Facebook" />
      </div>
    </div>
  );
}

function SocialMockButton({ name }: { name: string }) {
  return (
    <button
      aria-label={`${name} sign-in (mockup)`}
      className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-dashboard-border bg-dashboard-surface text-sm font-semibold text-dashboard-text transition hover:bg-dashboard-surface-hover"
      type="button"
    >
      {name === 'Google' ? (
        <GoogleMark />
      ) : (
        <span aria-hidden="true" className="rounded-full bg-[#1877f2] px-1.5 text-base font-bold leading-[22px] text-white">f</span>
      )}
      {name}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="size-[18px]" viewBox="0 0 24 24">
      <path d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.44c-.28 1.45-1.12 2.68-2.39 3.5v2.92h3.87c2.26-2.08 3.57-5.15 3.57-8.66Z" fill="#4285F4" />
      <path d="M12 24c3.24 0 5.95-1.08 7.93-2.93l-3.87-2.92c-1.08.72-2.46 1.14-4.06 1.14-3.12 0-5.77-2.1-6.72-4.93H1.29v3.01C3.26 21.12 7.27 24 12 24Z" fill="#34A853" />
      <path d="M5.28 14.36A7.2 7.2 0 0 1 4.9 12c0-.82.14-1.61.38-2.36V6.63H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.37l3.99-3.01Z" fill="#FBBC05" />
      <path d="M12 4.71c1.77 0 3.35.61 4.6 1.81l3.43-3.43C17.95 1.15 15.24 0 12 0 7.27 0 3.26 2.88 1.29 6.63l3.99 3.01C6.23 6.81 8.88 4.71 12 4.71Z" fill="#EA4335" />
    </svg>
  );
}
