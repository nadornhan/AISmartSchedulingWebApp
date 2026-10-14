'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  AuthCheckbox,
  AuthField,
  AuthPrimaryButton,
  AuthSecondaryLink,
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
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <h2 className="font-poppins text-[32px] font-bold leading-[42px] text-[#f4f7f6]">
            Sign in
          </h2>
          <p className="text-sm leading-[21px] text-[#8181a5]">
            Enter your details to proceed further
          </p>
        </div>

        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
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

          <div className="flex gap-[9px]">
            <AuthPrimaryButton disabled={isSubmitting} tone="light">
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </AuthPrimaryButton>
          </div>
        </form>

        <AuthSocialRow />
        <p className="text-center text-xs text-[#8181a5]">
          Don&apos;t have an account?{' '}
          <AuthSecondaryLink href="/register">Sign Up</AuthSecondaryLink>
        </p>
      </div>
    </AuthShell>
  );
}
