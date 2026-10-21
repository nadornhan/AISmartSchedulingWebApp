'use client';

import { FormEvent, useState } from 'react';
import styles from '../../components/auth/auth.module.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  AuthCheckbox,
  AuthField,
  AuthPrimaryButton,
  AuthShell,
  AuthSocialRow,
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
    <AuthShell
      footer={
        <p>
          Don&apos;t have an account? <Link href="/register">Create an account</Link>
        </p>
      }
    >
      <div className={styles.stack}>
        <header className={styles.heading}>
          <h1>Sign in</h1>
          <p>Welcome back. Find your focus.</p>
        </header>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.fields}>
            <AuthField
              autoComplete="email"
              id="email"
              label="Email"
              name="email"
              placeholder="you@example.com"
              type="email"
              required
            />
            <AuthField
              autoComplete="current-password"
              id="password"
              label="Password"
              name="password"
              placeholder="Enter your password"
              type="password"
              required
            />
          </div>
          <div className={styles.options}>
            <AuthCheckbox
              checked={rememberMe}
              id="remember"
              label="Remember me"
              onChange={setRememberMe}
            />
            <a href="#">Recover password</a>
          </div>
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-[var(--red-border)] bg-[var(--red-soft)] px-3 py-2 text-[13px] font-medium text-[var(--red-light)]"
            >
              {error}
            </p>
          ) : null}
          <AuthPrimaryButton disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </AuthPrimaryButton>
        </form>
        <AuthSocialRow />
      </div>
    </AuthShell>
  );
}
