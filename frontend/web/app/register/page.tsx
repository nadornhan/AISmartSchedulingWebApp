'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

import { RegistrationRole, registerAndSignIn } from '../../lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const firstName = String(formData.get('firstName') ?? '');
    const lastName = String(formData.get('lastName') ?? '');
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');
    const role = String(formData.get('role') ?? 'student') as RegistrationRole;

    try {
      if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
        throw new Error('Please fill in all required fields.');
      }

      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters.');
      }

      await registerAndSignIn({
        firstName,
        lastName,
        email,
        password,
        role,
      });

      router.push('/');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not create account.');
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#e5e7eb] px-4 py-8 text-slate-950">
      <section className="flex w-full max-w-[960px] overflow-hidden rounded-2xl bg-slate-50 shadow-[0_20px_40px_rgba(0,0,0,0.12)] max-md:flex-col">
        <aside className="flex w-[45%] flex-col justify-center bg-slate-900 px-9 py-8 text-slate-200 max-md:w-full">
          <div className="mb-6 flex items-center">
            <div className="mr-2.5 flex h-[37px] w-[37px] items-center justify-center rounded-lg bg-green-500">
              <img alt="Chrono logo" className="h-6 w-6" src="/chrono-logo.svg" />
            </div>
            <div className="text-[45px] font-bold leading-none text-slate-50 max-sm:text-4xl">
              Chrono
            </div>
          </div>

          <p className="text-sm leading-6 text-indigo-100">
            Join thousands of productive people managing their work smarter.
          </p>
        </aside>

        <section className="flex w-[55%] flex-col justify-center bg-slate-100 px-10 py-9 max-md:w-full max-sm:px-6">
          <h1 className="mb-1.5 text-2xl font-bold text-slate-900">Create your account</h1>
          <p className="mb-6 text-sm text-slate-500">
            Get started and be productive in under 2 minutes.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mb-4 flex items-stretch gap-5 max-sm:flex-col max-sm:gap-4">
              <div className="flex flex-1 flex-col">
                <label
                  className="mb-1.5 block text-[13px] font-semibold text-slate-700"
                  htmlFor="first-name"
                >
                  First Name
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-200"
                  id="first-name"
                  name="firstName"
                  placeholder="Alex"
                  type="text"
                />
              </div>

              <div className="flex flex-1 flex-col">
                <label
                  className="mb-1.5 block text-[13px] font-semibold text-slate-700"
                  htmlFor="last-name"
                >
                  Last Name
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-200"
                  id="last-name"
                  name="lastName"
                  placeholder="Johnson"
                  type="text"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block text-[13px] font-semibold text-slate-700" htmlFor="email">
                Email
              </label>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-200"
                id="email"
                name="email"
                placeholder="alex@example.com"
                type="email"
              />
            </div>

            <div className="mb-4">
              <label
                className="mb-1.5 block text-[13px] font-semibold text-slate-700"
                htmlFor="password"
              >
                Password
              </label>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-200"
                id="password"
                name="password"
                placeholder="At least 8 characters"
                type="password"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block text-[13px] font-semibold text-slate-700" htmlFor="role">
                I am a...
              </label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                id="role"
                name="role"
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="other">Other</option>
              </select>
            </div>

            {error ? (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
                {error}
              </p>
            ) : null}

            <button
              className="mb-4 w-full rounded-full bg-green-500 px-4 py-2.5 text-sm font-semibold text-green-950 transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>

            <div className="my-4 flex items-center text-xs text-slate-500">
              <div className="h-px flex-1 bg-slate-300" />
              <span className="mx-2">Or</span>
              <div className="h-px flex-1 bg-slate-300" />
            </div>

            <button
              className="mb-2.5 flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-[9px] text-[13px] text-slate-900 transition hover:border-blue-500"
              type="button"
            >
              <img
                alt="Google logo"
                className="h-4 w-4"
                src="https://img.icons8.com/?size=100&id=17949&format=png&color=000000"
              />
              <span>Log in with Google</span>
            </button>

            <button
              className="mb-2.5 flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-[9px] text-[13px] text-slate-900 transition hover:border-blue-500"
              type="button"
            >
              <img
                alt="Apple logo"
                className="h-4 w-4"
                src="https://img.icons8.com/?size=100&id=95294&format=png&color=000000"
              />
              <span>Log in with Apple</span>
            </button>
          </form>

          <div className="mt-2.5 text-xs leading-5 text-slate-500">
            <p className="mb-1">
              Already have an account?{' '}
              <a className="font-semibold text-green-600" href="/login">
                Log in
              </a>
            </p>
            <p>
              By continuing with Google or Apple you agree to Chrono&apos;s{' '}
              <a className="font-medium text-blue-600" href="#">
                Terms of Service
              </a>{' '}
              and{' '}
              <a className="font-medium text-blue-600" href="#">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
