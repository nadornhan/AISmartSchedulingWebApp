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
      className={`h-11 flex-1 rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold shadow-sm transition hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70 ${
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
      className="font-semibold text-[var(--accent)] transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      href={href}
    >
      {children}
    </Link>
  );
}

export function AuthSocialRow() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <p className="text-sm text-white">Or sign in with</p>
      <div className="flex items-center gap-2">
        <SocialIcon alt="X" src="/auth/icon-x.svg" />
        <SocialIcon alt="Google" src="/auth/icon-google.svg" />
        <SocialIcon alt="Facebook" src="/auth/icon-facebook.svg" />
      </div>
    </div>
  );
}

function SocialIcon({ alt, src }: { alt: string; src: string }) {
  return (
    <button
      aria-label={`Continue with ${alt}`}
      className="size-[46px] overflow-hidden rounded-lg transition hover:opacity-90"
      type="button"
    >
      <img alt={alt} className="size-full" height={46} src={src} width={46} />
    </button>
  );
}
