'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  AuthCheckbox,
  AuthField,
  AuthPrimaryButton,
  AuthShell,
  AuthSocialRow,
  EmailIcon,
  LockIcon,
} from '../../components/auth';
import { loginUser } from '../../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');

    try {
      if (!email.trim() || !password.trim()) {
        throw new Error('Please enter your email and password.');
      }

      await loginUser(email, password);
      router.push('/');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not sign in.');
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-[11px]">
          <h2 className="font-poppins text-[32px] font-bold leading-[42px] text-[#f4f7f6]">
            <span className="lg:hidden">Sign In</span>
            <span className="hidden lg:inline">Sign in to continue to <span className="text-[var(--accent)]">Chrono.</span></span>
          </h2>
          <p className="text-sm leading-[21px] text-[#8181a5]">
            Enter your details to proceed further
          </p>
        </div>

        <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <AuthField
                autoComplete="email"
                icon={<EmailIcon />}
                id="email"
                label="Email"
                name="email"
                placeholder="john.doe@gmail.com"
                type="email"
              />
              <AuthField
                autoComplete="current-password"
                icon={<LockIcon />}
                id="password"
                label="Password"
                name="password"
                placeholder="Start typing…"
                type="password"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <AuthCheckbox
                checked={rememberMe}
                id="remember"
                label="Remember me"
                onChange={setRememberMe}
              />
              <a className="text-sm font-semibold text-[var(--accent)]" href="#">
                Recover password
              </a>
            </div>
          </div>

          {error ? (
            <p className="rounded-lg border border-[var(--red-border)] bg-[var(--red-soft)] px-3 py-2 text-[13px] font-medium text-[var(--red-light)]">
              {error}
            </p>
          ) : null}

          <div className="grid gap-3">
            <AuthPrimaryButton disabled={isSubmitting} tone="light">
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </AuthPrimaryButton>
            <p className="text-right text-sm text-dashboard-muted">
              Don&apos;t have an account?{' '}
              <Link className="font-semibold text-[var(--accent)] hover:underline" href="/register">
                Create an account
              </Link>
            </p>
          </div>
        </form>

        <AuthSocialRow />
      </div>
    </AuthShell>
  );
}
