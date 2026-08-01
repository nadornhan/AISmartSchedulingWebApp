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
  UserIcon,
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
    <AuthShell>
      <div className="flex flex-col gap-[62px]">
        <div className="flex flex-col gap-[11px]">
          <h2 className="text-[32px] font-bold leading-[42px] text-[#f4f7f6]">
            Create your account
          </h2>
          <p className="text-sm leading-[21px] text-[#b6b6b6]">
            Enter your details to proceed further
          </p>
        </div>

        <form className="flex flex-col gap-[38px]" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-[34px]">
            <div className="flex flex-col gap-[13px]">
              <AuthField
                autoComplete="name"
                icon={<UserIcon />}
                id="full-name"
                label="Full name"
                name="fullName"
                placeholder="Chrono"
                type="text"
              />
              <AuthField
                autoComplete="email"
                icon={<EmailIcon />}
                id="email"
                label="Email"
                name="email"
                placeholder="support@chrono.com"
                type="email"
              />
              <AuthField
                autoComplete="new-password"
                icon={<LockIcon />}
                id="password"
                label="Password"
                name="password"
                placeholder="Start typing…"
                type="password"
              />
            </div>

            <AuthCheckbox
              checked={agreedToTerms}
              id="terms"
              label="I agree with terms & conditions"
              onChange={setAgreedToTerms}
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-[var(--red-border)] bg-[var(--red-soft)] px-3 py-2 text-[13px] font-medium text-[var(--red-light)]">
              {error}
            </p>
          ) : null}

          <div className="flex gap-[9px]">
            <AuthPrimaryButton disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Sign Up'}
            </AuthPrimaryButton>
            <AuthSecondaryLink href="/login">Sign In</AuthSecondaryLink>
          </div>
        </form>

        <AuthSocialRow />
      </div>
    </AuthShell>
  );
}
