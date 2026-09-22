// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: A tiny promise cache for data that does not change between two renders —
// one loader per key at a time, a TTL on success, and no memory of failures.

interface Entry<T> {
  expiresAt: number;
  value: Promise<T>;
}

export interface PromiseCache<T> {
  /** Resolves the cached value, or runs `loader` once and shares it with every concurrent caller. */
  get(key: string, loader: () => Promise<T>): Promise<T>;
  /** Forgets one key, or everything. */
  clear(key?: string): void;
  /** Number of live entries (tests). */
  size(): number;
}

/**
 * Concurrent callers share one in-flight promise, so two components mounting
 * in the same frame produce one request. A rejected loader is evicted at once,
 * so a transient failure is retried on the next call rather than remembered.
 */
export function createPromiseCache<T>(ttlMs: number, now: () => number = Date.now): PromiseCache<T> {
  const entries = new Map<string, Entry<T>>();
  return {
    get(key, loader) {
      const hit = entries.get(key);
      if (hit && hit.expiresAt > now()) return hit.value;
      const value = loader().catch((error: unknown) => {
        if (entries.get(key)?.value === value) entries.delete(key);
        throw error;
      });
      entries.set(key, { expiresAt: now() + ttlMs, value });
      return value;
    },
    clear(key) {
      if (key === undefined) entries.clear();
      else entries.delete(key);
    },
    size() {
      return entries.size;
    },
  };
}

// --- End of requestCache.ts ---
