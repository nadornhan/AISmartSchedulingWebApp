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
import { registerAndSignIn } from '../../lib/auth';

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get('fullName') ?? '');
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');
    const { firstName, lastName } = splitFullName(fullName);

    try {
      if (!fullName.trim() || !email.trim() || !password.trim()) {
        throw new Error('Please fill in all required fields.');
      }

      if (!agreedToTerms) {
        throw new Error('Please agree with terms & conditions.');
      }

      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters.');
      }

      await registerAndSignIn({
        firstName,
        lastName,
        email,
        password,
        role: 'student',
      });

      router.push('/');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not create account.');
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      footer={
        <p>
          Have an account? <Link href="/login">Sign in</Link>
        </p>
      }
    >
      <div className={styles.stack}>
        <header className={styles.heading}>
          <img
            alt=""
            aria-hidden="true"
            className={styles.formTree}
            src="/images/plants/chrono/mature.png"
          />
          <h1>Create account</h1>
          <p>Make space for what matters.</p>
        </header>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.fields}>
            <AuthField
              autoComplete="name"
              id="full-name"
              label="Full name"
              name="fullName"
              placeholder="Your name"
              type="text"
              required
            />
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
              autoComplete="new-password"
              id="password"
              label="Password"
              name="password"
              placeholder="At least 8 characters"
              type="password"
              minLength={8}
              required
            />
          </div>
          <div className={styles.options}>
            <AuthCheckbox
              checked={agreedToTerms}
              id="terms"
              label="I agree with terms & conditions"
              onChange={setAgreedToTerms}
            />
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
            {isSubmitting ? 'Creating account...' : 'Sign up'}
          </AuthPrimaryButton>
        </form>
        <AuthSocialRow />
      </div>
    </AuthShell>
  );
}
