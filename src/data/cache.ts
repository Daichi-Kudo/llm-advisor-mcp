import type { CacheEntry } from "../types.js";

export class InMemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > entry.ttl) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl: number, source: string, etag?: string): void {
    this.store.set(key, { data, fetchedAt: Date.now(), ttl, source, etag });
  }

  /** Returns cached data even if stale, with a flag indicating staleness */
  getStaleOrNull<T>(key: string): { data: T; stale: boolean } | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    const stale = Date.now() - entry.fetchedAt > entry.ttl;
    return { data: entry.data as T, stale };
  }

  /** Get the fetchedAt timestamp for a cache key */
  getFreshnessInfo(key: string): { fetchedAt: number; ttl: number } | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    return { fetchedAt: entry.fetchedAt, ttl: entry.ttl };
  }

  clear(): void {
    this.store.clear();
  }
}
