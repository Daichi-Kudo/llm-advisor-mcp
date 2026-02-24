import type { UnifiedModel, ModelCategory, BenchmarkScores } from "../types.js";
import { InMemoryCache } from "./cache.js";
import { fetchOpenRouterModels } from "./fetchers/openrouter.js";
import { fetchSweBenchScores } from "./fetchers/swe-bench.js";
import { fetchArenaScores } from "./fetchers/arena.js";
import { mergeBenchmarkData } from "./normalizer.js";

export class ModelRegistry {
  private models = new Map<string, UnifiedModel>();
  private cache: InMemoryCache;
  private warmupPromise: Promise<void> | null = null;

  constructor(cache: InMemoryCache) {
    this.cache = cache;
  }

  /** Pre-fetch data on startup. Non-blocking — callers can use getModel even if warmup is incomplete. */
  async warmup(): Promise<void> {
    if (this.warmupPromise) return this.warmupPromise;
    this.warmupPromise = this._loadData();
    return this.warmupPromise;
  }

  private async _loadData(): Promise<void> {
    // Phase 1: Load base model data from OpenRouter (required)
    const openRouterModels = await fetchOpenRouterModels(this.cache);
    for (const model of openRouterModels) {
      this.models.set(model.id, model);
    }

    // Phase 2: Enrich with benchmark data (best-effort, parallel)
    const [sweScores, arenaScores] = await Promise.all([
      fetchSweBenchScores(this.cache).catch(() => new Map()),
      fetchArenaScores(this.cache).catch(() => new Map()),
    ]);

    mergeBenchmarkData(this.models, sweScores, arenaScores);
  }

  /** Ensure data is loaded, refreshing if needed */
  async ensureLoaded(): Promise<void> {
    if (this.models.size === 0) {
      await this.warmup();
    }
  }

  /** Get a model by exact ID or fuzzy match */
  getModel(query: string): UnifiedModel | null {
    // 1. Exact match
    const exact = this.models.get(query);
    if (exact) return exact;

    // 2. Case-insensitive exact match
    const queryLower = query.toLowerCase();
    for (const [id, model] of this.models) {
      if (id.toLowerCase() === queryLower) return model;
    }

    // 3. Slug contains match
    for (const [, model] of this.models) {
      if (model.slug.includes(queryLower.replace(/[^a-z0-9/\-]/g, ""))) {
        return model;
      }
    }

    // 4. Name contains match
    for (const [, model] of this.models) {
      if (model.name.toLowerCase().includes(queryLower)) {
        return model;
      }
    }

    return null;
  }

  /** Find similar model names for suggestions */
  findSimilar(query: string, limit = 5): string[] {
    const queryLower = query.toLowerCase();
    const prefix = queryLower.slice(0, Math.min(4, queryLower.length));
    return Array.from(this.models.values())
      .filter(
        (m) =>
          m.id.toLowerCase().includes(prefix) ||
          m.name.toLowerCase().includes(prefix)
      )
      .slice(0, limit)
      .map((m) => m.id);
  }

  /** Get all models */
  getAllModels(): UnifiedModel[] {
    return Array.from(this.models.values());
  }

  /** Get top models for a category, sorted by the relevant metric */
  getTopModels(category: ModelCategory, limit = 10): UnifiedModel[] {
    const allModels = this.getAllModels();

    switch (category) {
      case "coding":
        return sortByBenchmark(allModels, "sweBenchVerified", "arenaElo").slice(0, limit);

      case "math":
        return sortByBenchmark(allModels, "math500", "gpqaDiamond").slice(0, limit);

      case "vision":
        return allModels
          .filter((m) => m.capabilities.inputModalities.includes("image"))
          .sort((a, b) => (b.benchmarks.mmmu ?? 0) - (a.benchmarks.mmmu ?? 0) || comparePricePerformance(a, b))
          .slice(0, limit);

      case "general":
        return sortByBenchmark(allModels, "arenaElo", "mmluPro").slice(0, limit);

      case "cost-effective":
        return allModels
          .filter((m) => m.pricing.input > 0)
          .sort(comparePricePerformance)
          .slice(0, limit);

      case "open-source":
        return allModels
          .filter((m) => m.metadata.isOpenSource)
          .sort((a, b) => (b.benchmarks.arenaElo ?? 0) - (a.benchmarks.arenaElo ?? 0) || comparePricePerformance(a, b))
          .slice(0, limit);

      case "speed":
        // Sort by price (proxy for speed — lower price models tend to be faster inference)
        // Real speed data would come from a future data source
        return allModels
          .sort((a, b) => a.pricing.output - b.pricing.output)
          .slice(0, limit);

      case "context-window":
        return allModels
          .sort((a, b) => b.capabilities.contextLength - a.capabilities.contextLength)
          .slice(0, limit);

      case "reasoning":
        return allModels
          .filter((m) => m.capabilities.supportsReasoning)
          .sort((a, b) => (b.benchmarks.gpqaDiamond ?? 0) - (a.benchmarks.gpqaDiamond ?? 0) || (b.benchmarks.arenaElo ?? 0) - (a.benchmarks.arenaElo ?? 0))
          .slice(0, limit);

      default:
        return sortByBenchmark(allModels, "arenaElo", "mmluPro").slice(0, limit);
    }
  }

  /** Get cache freshness info */
  getCacheFreshnessMs(): number | undefined {
    const info = this.cache.getFreshnessInfo("openrouter:models");
    return info?.fetchedAt;
  }
}

// ============================================================
// Sorting helpers
// ============================================================

function sortByBenchmark(
  models: UnifiedModel[],
  primary: keyof BenchmarkScores,
  secondary: keyof BenchmarkScores
): UnifiedModel[] {
  return [...models].sort((a, b) => {
    const aPrimary = a.benchmarks[primary] ?? -1;
    const bPrimary = b.benchmarks[primary] ?? -1;
    if (aPrimary !== bPrimary) return (bPrimary as number) - (aPrimary as number);

    const aSecondary = a.benchmarks[secondary] ?? -1;
    const bSecondary = b.benchmarks[secondary] ?? -1;
    return (bSecondary as number) - (aSecondary as number);
  });
}

/** Lower price with decent benchmarks ranks higher */
function comparePricePerformance(a: UnifiedModel, b: UnifiedModel): number {
  const aElo = a.benchmarks.arenaElo ?? 0;
  const bElo = b.benchmarks.arenaElo ?? 0;
  const aBlended = a.pricing.input * 0.75 + a.pricing.output * 0.25;
  const bBlended = b.pricing.input * 0.75 + b.pricing.output * 0.25;

  // Score = elo / price (higher is better)
  const aScore = aBlended > 0 ? aElo / aBlended : 0;
  const bScore = bBlended > 0 ? bElo / bBlended : 0;
  return bScore - aScore;
}
