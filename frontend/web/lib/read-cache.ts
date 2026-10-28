// Authors (Git history): Truong Ha Anh Minh
// Bounded, authentication-scoped in-memory read cache. See AUTHORS.md and docs/AUTHORSHIP.json.
// Short-lived, memory-only cache. Authentication changes discard cached data.
type Entry = { value?: unknown; updatedAt: number; pending?: Promise<unknown> };
const entries = new Map<string, Entry>();
let currentScope: string | null | undefined;
// Retained snapshots support immediate rendering; maxAgeMs separately controls
// whether a read can skip revalidation. This cache never persists to storage.
const RETENTION_MS = 5 * 60_000;

function cacheKey(scope: string | null, group: string, key: string) {
  if (currentScope !== scope) {
    clearReadCache();
    currentScope = scope;
  }
  return `${group}:${key}`;
}

export function clearReadCache() {
  entries.clear();
  currentScope = undefined;
}

export function invalidateReadCache(group: string) {
  for (const key of entries.keys()) {
    if (key.startsWith(`${group}:`)) entries.delete(key);
  }
}

export function peekReadCache<T>(scope: string | null, group: string, key: string): T | undefined {
  const entry = entries.get(cacheKey(scope, group, key));
  return entry && Date.now() - entry.updatedAt < RETENTION_MS
    ? (entry.value as T | undefined)
    : undefined;
}

export function cachedRead<T>(
  scope: string | null,
  group: string,
  key: string,
  load: () => Promise<T>,
  maxAgeMs = 15_000,
): Promise<T> {
  const id = cacheKey(scope, group, key);
  let entry = entries.get(id);
  if (entry?.pending) return entry.pending as Promise<T>;
  if (entry?.value !== undefined && Date.now() - entry.updatedAt < maxAgeMs) {
    return Promise.resolve(entry.value as T);
  }
  if (!entry) {
    if (entries.size >= 50) entries.delete(entries.keys().next().value!);
    entry = { updatedAt: 0 };
    entries.set(id, entry);
  }
  const target = entry;
  const pending = Promise.resolve()
    .then(load)
    .then((value) => {
      // Discard results invalidated by mutations or an authentication change.
      if (currentScope === scope && entries.get(id) === target) {
        target.value = value;
        target.updatedAt = Date.now();
      }
      return value;
    })
    .finally(() => {
      if (target.pending === pending) target.pending = undefined;
    });
  target.pending = pending;
  return pending;
}

// Cancellation belongs to the caller, so leaving a page does not cancel the
// shared read needed by another view or prevent it from warming the cache.
export function cachedReadWithSignal<T>(
  scope: string | null,
  group: string,
  key: string,
  load: () => Promise<T>,
  maxAgeMs: number,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) return Promise.reject(signal.reason);
  const pending = cachedRead(scope, group, key, load, maxAgeMs);
  if (!signal) return pending;

  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    pending.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );
  });
}
