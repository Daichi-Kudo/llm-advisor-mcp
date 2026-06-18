import { describe, expect, it, vi } from "vitest";
import { InMemoryCache } from "../data/cache.js";

describe("InMemoryCache", () => {
  it("rejects non-positive and non-finite TTL values", () => {
    const cache = new InMemoryCache();

    expect(() => cache.set("zero", new Map(), 0, "test")).toThrow(/positive finite/);
    expect(() => cache.set("negative", new Map(), -1, "test")).toThrow(/positive finite/);
    expect(() => cache.set("infinite", new Map(), Infinity, "test")).toThrow(/positive finite/);
  });

  it("returns cloned data from get so callers cannot mutate cached state", () => {
    const cache = new InMemoryCache();
    const models = new Map([["model", { score: 1 }]]);

    cache.set("models", models, 60_000, "test");
    const first = cache.get<Map<string, { score: number }>>("models");
    expect(first).not.toBeNull();
    first!.get("model")!.score = 999;

    const second = cache.get<Map<string, { score: number }>>("models");
    expect(second?.get("model")?.score).toBe(1);
  });

  it("returns cloned stale data and marks expired entries stale", () => {
    const cache = new InMemoryCache();
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    cache.set("models", new Map([["model", { score: 1 }]]), 1_000, "test");

    vi.mocked(Date.now).mockReturnValue(now + 2_000);
    const stale = cache.getStaleOrNull<Map<string, { score: number }>>("models");
    expect(stale).not.toBeNull();
    stale!.data.get("model")!.score = 999;

    expect(stale?.stale).toBe(true);
    expect(cache.getStaleOrNull<Map<string, { score: number }>>("models")?.data.get("model")?.score).toBe(1);

    vi.restoreAllMocks();
  });

  it("preserves expired entries so callers can still serve stale fallback data", () => {
    const cache = new InMemoryCache();
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    cache.set("models", new Map(), 1_000, "test");

    vi.mocked(Date.now).mockReturnValue(now + 2_000);

    expect(cache.get("models")).toBeNull();
    expect(cache.getFreshnessInfo("models")).toEqual({ fetchedAt: now, ttl: 1_000 });
    expect(cache.getStaleOrNull("models")?.stale).toBe(true);

    vi.restoreAllMocks();
  });

  it("can cap stale fallback age without deleting cached freshness metadata", () => {
    const cache = new InMemoryCache();
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    cache.set("models", new Map(), 1_000, "test");

    vi.mocked(Date.now).mockReturnValue(now + 10_000);

    expect(cache.getStaleOrNull("models", 5_000)).toBeNull();
    expect(cache.getFreshnessInfo("models")).toEqual({ fetchedAt: now, ttl: 1_000 });

    vi.restoreAllMocks();
  });

  it("treats exact TTL and exact max-stale boundaries as still usable", () => {
    const cache = new InMemoryCache();
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    cache.set("models", new Map([["model", { score: 1 }]]), 1_000, "test");

    vi.mocked(Date.now).mockReturnValue(now + 1_000);
    expect(cache.getStaleOrNull("models")?.stale).toBe(false);

    vi.mocked(Date.now).mockReturnValue(now + 5_000);
    expect(cache.getStaleOrNull("models", 5_000)).not.toBeNull();

    vi.restoreAllMocks();
  });

  it("returns null freshness info for missing keys", () => {
    const cache = new InMemoryCache();

    expect(cache.getFreshnessInfo("missing")).toBeNull();
  });

  it("returns the oldest freshness info across known keys", () => {
    const cache = new InMemoryCache();
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    cache.set("newer", new Map(), 60_000, "test");
    vi.mocked(Date.now).mockReturnValue(now - 10_000);
    cache.set("older", new Map(), 60_000, "test");

    expect(cache.getOldestFreshnessInfo(["missing"])).toBeNull();
    expect(cache.getOldestFreshnessInfo(["newer", "older", "missing"])).toEqual({
      fetchedAt: now - 10_000,
      ttl: 60_000,
    });

    vi.restoreAllMocks();
  });
});
