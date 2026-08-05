'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

import { loginUser } from '../../lib/auth';

const features = [
  {
    icon: '🤖',
    title: 'AI-Powered Scheduling',
    description: 'Automatically organizes your tasks based on deadlines and work patterns',
  },
  {
    icon: '🎯',
    title: 'Focus Mode + Pomodoro',
    description: 'Deep work sessions with intelligent break reminders',
  },
  {
    icon: '📁',
    title: 'Smart Folder System',
    description: 'Auto-inbox for unassigned tasks, drag & sort across projects',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

          <p className="mb-8 text-sm leading-6 text-indigo-100">
            Your intelligent task scheduling companion.
            <br />
            Stay focused, get more done.
          </p>

          <div className="space-y-5">
            {features.map((feature) => (
              <div className="flex" key={feature.title}>
                <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-lg">
                  {feature.icon}
                </div>
                <div>
                  <h2 className="mb-1 text-[15px] font-semibold text-slate-200">
                    {feature.title}
                  </h2>
                  <p className="text-[13px] leading-5 text-slate-400">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="flex w-[55%] flex-col justify-center bg-slate-100 px-10 py-9 max-md:w-full max-sm:px-6">
          <h1 className="mb-1.5 text-2xl font-bold text-slate-900">Welcome back! 👋</h1>
          <p className="mb-6 text-sm text-slate-500">Sign in to your Chrono account</p>

          <form onSubmit={handleSubmit}>
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
                placeholder="Password"
                type="password"
              />
            </div>

            <div className="mb-[18px] flex items-center justify-between gap-3 text-[13px]">
              <div className="flex items-center gap-1.5 text-slate-700">
                <input className="h-3.5 w-3.5 accent-green-500" id="remember" type="checkbox" />
                <label htmlFor="remember">Remember me</label>
              </div>
              <a className="font-medium text-blue-600" href="#">
                Forgot Password?
              </a>
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
              {isSubmitting ? 'Signing in...' : 'Sign In'}
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
              No account yet?{' '}
              <a className="font-semibold text-green-600" href="/register">
                Sign Up Free
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
