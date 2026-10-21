'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { clearSession, getCurrentUser, type UserResponse } from '../../lib/auth';
import { getAccessToken, onUnauthorized } from '../../lib/api';
import { createCurrentUserSession, type SessionStatus } from '../../lib/auth-session';
import { detectBrowserTimezone } from '../../lib/settings';

type CurrentUserContextValue = {
  user: UserResponse | null;
  isCheckingSession: boolean;
  sessionStatus: SessionStatus;
  error: string | null;
  refreshUser: () => Promise<UserResponse | null>;
  setUser: (user: UserResponse | null) => void;
  signOut: () => void;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

function localBypassUser(): UserResponse {
  const now = new Date().toISOString();

  return {
    id: 'local-test-user',
    email: 'tester@localhost',
    first_name: 'Local',
    last_name: 'Tester',
    role: 'student',
    avatar_url: null,
    is_active: true,
    created_at: now,
    updated_at: now,
  };
}

export function CurrentUserProvider({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const router = useRouter();
  const session = useMemo(
    () =>
      createCurrentUserSession({
        getAccessToken: () =>
          process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true' ? 'local-bypass' : getAccessToken(),
        getCurrentUser: (signal) =>
          process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true'
            ? Promise.resolve(localBypassUser())
            : getCurrentUser({ signal }),
        clearSession,
        onUnauthenticated: () => router.replace('/login'),
        subscribeToUnauthorized: onUnauthorized,
        onVerified: async (signal) => {
          if (process.env.NEXT_PUBLIC_BYPASS_AUTH !== 'true') {
            await detectBrowserTimezone({ signal });
          }
        },
      }),
    [router],
  );
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );

  useEffect(() => {
    // Warm the public destination in production; never wait for it to verify auth.
    // Next.js does not prefetch routes in development.
    router.prefetch('/login');
    void session.start();
    return () => session.dispose();
  }, [router, session]);

  const value = useMemo<CurrentUserContextValue>(
    () => ({
      user: snapshot.user,
      isCheckingSession: snapshot.status === 'checking',
      sessionStatus: snapshot.status,
      error: snapshot.error,
      refreshUser: session.refresh,
      setUser: session.setUser,
      signOut: session.signOut,
    }),
    [session, snapshot],
  );

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  const value = useContext(CurrentUserContext);

  if (!value) {
    throw new Error('useCurrentUser must be used within CurrentUserProvider.');
  }

  return value;
}
