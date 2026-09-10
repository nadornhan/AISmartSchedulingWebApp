'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  clearSession,
  getCachedCurrentUser,
  getCurrentUser,
  logout,
  type UserResponse,
} from '../../lib/auth';

type CurrentUserContextValue = {
  user: UserResponse | null;
  isCheckingSession: boolean;
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
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const signOut = useCallback(() => {
    logout();
    setUser(null);
    router.replace('/login');
  }, [router]);

  const refreshUser = useCallback(async () => {
    if (process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true') {
      const bypassUser = localBypassUser();
      setUser(bypassUser);
      setError(null);
      setIsCheckingSession(false);
      return bypassUser;
    }

    try {
      setError(null);
      const nextUser = await getCurrentUser();
      setUser(nextUser);
      return nextUser;
    } catch (requestError) {
      clearSession();
      setUser(null);
      setError(requestError instanceof Error ? requestError.message : 'Your session has expired.');
      router.replace('/login');
      return null;
    } finally {
      setIsCheckingSession(false);
    }
  }, [router]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true') {
      setUser(localBypassUser());
      setIsCheckingSession(false);
      return;
    }

    const cachedUser = getCachedCurrentUser();

    if (cachedUser) {
      setUser(cachedUser);
    }

    let isMounted = true;

    getCurrentUser()
      .then((nextUser) => {
        if (isMounted) {
          setUser(nextUser);
          setError(null);
        }
      })
      .catch((requestError) => {
        if (!isMounted) return;

        clearSession();
        setUser(null);
        setError(
          requestError instanceof Error ? requestError.message : 'Your session has expired.',
        );
        router.replace('/login');
      })
      .finally(() => {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  const value = useMemo<CurrentUserContextValue>(
    () => ({
      user,
      isCheckingSession,
      error,
      refreshUser,
      setUser,
      signOut,
    }),
    [error, isCheckingSession, refreshUser, signOut, user],
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
