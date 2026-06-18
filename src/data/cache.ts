import type { CacheEntry } from "../types.js";

export class InMemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > entry.ttl) {
      return null;
    }
    return cloneCachedData(entry.data) as T;
  }

  set<T>(key: string, data: T, ttl: number, source: string, etag?: string): void {
    if (!Number.isFinite(ttl) || ttl <= 0) {
      throw new Error(`Cache TTL must be a positive finite number for key ${key}`);
    }
    this.store.set(key, { data, fetchedAt: Date.now(), ttl, source, etag });
  }

  /** Returns cached data even if stale, with a flag indicating staleness */
  getStaleOrNull<T>(key: string): { data: T; stale: boolean } | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    const stale = Date.now() - entry.fetchedAt > entry.ttl;
    return { data: cloneCachedData(entry.data) as T, stale };
  }

  /** Get the fetchedAt timestamp for a cache key */
  getFreshnessInfo(key: string): { fetchedAt: number; ttl: number } | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    return { fetchedAt: entry.fetchedAt, ttl: entry.ttl };
  }

  /** Get the oldest freshness timestamp across cache keys, for mixed-source outputs. */
  getOldestFreshnessInfo(keys: string[]): { fetchedAt: number; ttl: number } | null {
    let oldest: { fetchedAt: number; ttl: number } | null = null;
    for (const key of keys) {
      const info = this.getFreshnessInfo(key);
      if (!info) continue;
      if (!oldest || info.fetchedAt < oldest.fetchedAt) oldest = info;
    }
    return oldest;
  }

  clear(): void {
    this.store.clear();
  }
}

function cloneCachedData<T>(data: T): T {
  return structuredClone(data);
}
