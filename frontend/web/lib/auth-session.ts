import { ApiError } from './api';
import type { UserResponse } from './auth';

export type SessionStatus = 'checking' | 'authenticated' | 'unavailable' | 'unauthenticated';

export type SessionSnapshot = {
  user: UserResponse | null;
  status: SessionStatus;
  error: string | null;
};

type SessionDependencies = {
  getAccessToken: () => string | null;
  getCurrentUser: (signal: AbortSignal) => Promise<UserResponse>;
  clearSession: () => void;
  onUnauthenticated: () => void;
  onVerified?: (signal: AbortSignal) => Promise<unknown>;
};

export function createCurrentUserSession(dependencies: SessionDependencies) {
  const initialSnapshot: SessionSnapshot = { user: null, status: 'checking', error: null };
  let snapshot = initialSnapshot;
  let active = false;
  let revision = 0;
  let controller: AbortController | null = null;
  let verifiedToken: string | null = null;
  const listeners = new Set<() => void>();

  function publish(next: SessionSnapshot) {
    snapshot = next;
    listeners.forEach((listener) => listener());
  }

  function invalidate() {
    revision += 1;
    controller?.abort();
    controller = null;
  }

  function unauthenticate(error: string | null) {
    invalidate();
    verifiedToken = null;
    dependencies.clearSession();
    publish({ user: null, status: 'unauthenticated', error });
    dependencies.onUnauthenticated();
  }

  async function refresh(): Promise<UserResponse | null> {
    if (!active) return null;
    invalidate();
    const requestRevision = revision;
    const token = dependencies.getAccessToken();
    if (!token) {
      unauthenticate('No active session.');
      return null;
    }

    const requestController = new AbortController();
    controller = requestController;
    const isCurrent = () =>
      active &&
      revision === requestRevision &&
      !requestController.signal.aborted &&
      dependencies.getAccessToken() === token;
    publish({ ...snapshot, status: 'checking', error: null });

    try {
      const user = await dependencies.getCurrentUser(requestController.signal);
      if (!isCurrent()) return null;
      verifiedToken = token;
      publish({ user, status: 'authenticated', error: null });
      // Timezone synchronization is best-effort, not an authentication check.
      void dependencies.onVerified?.(requestController.signal).catch(() => undefined);
      return user;
    } catch (error) {
      if (!isCurrent()) return null;
      const message = error instanceof Error ? error.message : 'Unable to check your session.';
      if (error instanceof ApiError && error.status === 401) {
        unauthenticate(message);
      } else {
        publish({ ...snapshot, status: 'unavailable', error: message });
      }
      return null;
    }
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initialSnapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      active = true;
      return refresh();
    },
    refresh,
    dispose() {
      active = false;
      invalidate();
    },
    signOut() {
      unauthenticate(null);
    },
    setUser(user: UserResponse | null) {
      if (!active || snapshot.status !== 'authenticated') return;
      if (!user) {
        unauthenticate(null);
        return;
      }
      if (dependencies.getAccessToken() !== verifiedToken || user.id !== snapshot.user?.id) return;
      invalidate();
      publish({ user, status: 'authenticated', error: null });
    },
  };
}
