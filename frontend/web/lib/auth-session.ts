// Authors (Git history): Truong Ha Anh Minh
// Session verification and stale-response isolation. See AUTHORS.md and docs/AUTHORSHIP.json.
import { ApiError } from './api';
import type { UserResponse } from './auth';

export type SessionStatus = 'checking' | 'authenticated' | 'unavailable' | 'unauthenticated';

export type SessionSnapshot = {
  user: UserResponse | null;
  status: SessionStatus;
  error: string | null;
};

type SessionDependencies = {
  getSessionKey: () => string | null;
  getCurrentUser: (signal: AbortSignal) => Promise<UserResponse>;
  clearSession: () => void;
  endSession?: () => Promise<void>;
  onUnauthenticated: () => void;
  subscribeToUnauthorized?: (listener: (sessionKey: string, message: string) => void) => () => void;
  onVerified?: (signal: AbortSignal) => Promise<unknown>;
};

export function createCurrentUserSession(dependencies: SessionDependencies) {
  const initialSnapshot: SessionSnapshot = { user: null, status: 'checking', error: null };
  let snapshot = initialSnapshot;
  let active = false;
  let revision = 0;
  let controller: AbortController | null = null;
  let verifiedSessionKey: string | null = null;
  let unsubscribeUnauthorized: (() => void) | undefined;
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
    verifiedSessionKey = null;
    dependencies.clearSession();
    publish({ user: null, status: 'unauthenticated', error });
    dependencies.onUnauthenticated();
  }

  async function refresh(): Promise<UserResponse | null> {
    if (!active) return null;
    invalidate();
    const requestRevision = revision;
    const sessionKey = dependencies.getSessionKey();
    if (!sessionKey) {
      unauthenticate('No active session.');
      return null;
    }

    const requestController = new AbortController();
    controller = requestController;
    // A response from a previous login or refresh must not replace the new session.
    const isCurrent = () =>
      active &&
      revision === requestRevision &&
      !requestController.signal.aborted &&
      dependencies.getSessionKey() === sessionKey;
    publish({ ...snapshot, status: 'checking', error: null });

    try {
      const user = await dependencies.getCurrentUser(requestController.signal);
      if (!isCurrent()) return null;
      verifiedSessionKey = sessionKey;
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
      unsubscribeUnauthorized?.();
      unsubscribeUnauthorized = dependencies.subscribeToUnauthorized?.((sessionKey, message) => {
        if (
          active &&
          snapshot.status !== 'unauthenticated' &&
          dependencies.getSessionKey() === sessionKey
        ) {
          unauthenticate(message);
        }
      });
      return refresh();
    },
    refresh,
    dispose() {
      active = false;
      unsubscribeUnauthorized?.();
      unsubscribeUnauthorized = undefined;
      invalidate();
    },
    async signOut() {
      invalidate();
      const requestRevision = revision;
      publish({ ...snapshot, status: 'checking', error: null });
      try {
        if (dependencies.endSession) await dependencies.endSession();
        if (active && revision === requestRevision) unauthenticate(null);
      } catch {
        if (active && revision === requestRevision) {
          publish({
            ...snapshot,
            status: 'unavailable',
            error: 'Unable to sign out. Please try again.',
          });
        }
      }
    },
    setUser(user: UserResponse | null) {
      if (!active || snapshot.status !== 'authenticated') return;
      if (!user) {
        unauthenticate(null);
        return;
      }
      if (dependencies.getSessionKey() !== verifiedSessionKey || user.id !== snapshot.user?.id)
        return;
      invalidate();
      publish({ user, status: 'authenticated', error: null });
    },
  };
}
