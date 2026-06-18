import type { UnifiedModel, ModelCategory } from "../types.js";
import { InMemoryCache } from "./cache.js";
import { fetchOpenRouterModels } from "./fetchers/openrouter.js";
import { fetchSweBenchScores } from "./fetchers/swe-bench.js";
import { fetchArenaScores } from "./fetchers/arena.js";
import { fetchVlmScores } from "./fetchers/vlm-leaderboard.js";
import { fetchAiderScores } from "./fetchers/aider.js";
import { mergeBenchmarkData } from "./normalizer.js";
import {
  computePercentiles,
  getBlendedTokenPrice,
  getCompositeBenchmarkScore,
  getCostEfficiencyScore,
  getOverallBenchmarkScore,
} from "./percentiles.js";

export interface TopModelFilters {
  minContext?: number;
  minReleaseDate?: string;
}

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
    const [sweScores, arenaScores, vlmScores, aiderScores] = await Promise.all([
      fetchSweBenchScores(this.cache).catch(() => new Map()),
      fetchArenaScores(this.cache).catch(() => new Map()),
      fetchVlmScores(this.cache).catch(() => new Map()),
      fetchAiderScores(this.cache).catch(() => new Map()),
    ]);

    mergeBenchmarkData(this.models, sweScores, arenaScores, vlmScores, aiderScores);

    // Phase 3: Compute percentile ranks across all models
    computePercentiles(this.models);
  }

  /** Ensure data is loaded, refreshing if needed */
  async ensureLoaded(): Promise<void> {
    if (this.models.size === 0) {
      await this.warmup();
    }
  }

  /** Get a model by exact ID or fuzzy match */
  getModel(query: string): UnifiedModel | null {
    // 1. Exact match by full ID
    const exact = this.models.get(query);
    if (exact) return exact;

    const queryLower = query.toLowerCase();
    const querySlug = queryLower.replace(/[^a-z0-9/\-]/g, "");

    // 2. Case-insensitive exact match
    for (const [id, model] of this.models) {
      if (id.toLowerCase() === queryLower) return model;
    }

    // 3. Exact match on model part only (without provider prefix)
    //    e.g. "gpt-4o" matches "openai/gpt-4o" exactly
    for (const [id, model] of this.models) {
      const modelPart = id.split("/").slice(1).join("/").toLowerCase();
      if (modelPart === queryLower || modelPart === querySlug) return model;
    }

    // 4. Contains match — prefer shortest ID (closest match)
    //    e.g. "gpt-4o" matches "openai/gpt-4o" over "openai/gpt-4o-audio-preview"
    const candidates: UnifiedModel[] = [];
    for (const [, model] of this.models) {
      if (model.slug.includes(querySlug) || model.name.toLowerCase().includes(queryLower)) {
        candidates.push(model);
      }
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.id.length - b.id.length);
      return candidates[0];
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
  getTopModels(category: ModelCategory, limit = 10, filters: TopModelFilters = {}): UnifiedModel[] {
    const allModels = this.getAllModels().filter((m) => modelMatchesFilters(m, filters));

    switch (category) {
      case "coding":
        return sortByComposite(allModels, (m) => getCompositeBenchmarkScore(m, "coding")).slice(0, limit);

      case "math":
        return sortByComposite(allModels, (m) => getCompositeBenchmarkScore(m, "math")).slice(0, limit);

      case "vision":
        return sortByComposite(
          allModels.filter((m) => m.capabilities.inputModalities.includes("image")),
          (m) => getCompositeBenchmarkScore(m, "vision")
        ).slice(0, limit);

      case "general":
        return sortByComposite(allModels, (m) => getCompositeBenchmarkScore(m, "general")).slice(0, limit);

      case "cost-effective":
        return sortByComposite(
          allModels.filter((m) => m.pricing.input > 0),
          getCostEfficiencyScore
        ).slice(0, limit);

      case "open-source":
        return sortByComposite(
          allModels.filter((m) => m.metadata.isOpenSource),
          (m) =>
            getCompositeBenchmarkScore(m, "general") ??
            getCompositeBenchmarkScore(m, "coding") ??
            getCompositeBenchmarkScore(m, "vision")
        ).slice(0, limit);

      case "speed":
        // Sort by price (proxy for speed — lower price models tend to be faster inference)
        // Real speed data would come from a future data source
        return allModels
          .sort((a, b) => a.pricing.output - b.pricing.output || a.id.localeCompare(b.id))
          .slice(0, limit);

      case "context-window":
        return allModels
          .sort((a, b) => b.capabilities.contextLength - a.capabilities.contextLength || a.id.localeCompare(b.id))
          .slice(0, limit);

      case "reasoning":
        return sortByComposite(
          allModels.filter((m) => m.capabilities.supportsReasoning),
          (m) => getCompositeBenchmarkScore(m, "reasoning") ?? getCompositeBenchmarkScore(m, "general")
        ).slice(0, limit);

      default:
        return sortByComposite(allModels, (m) => getCompositeBenchmarkScore(m, "general")).slice(0, limit);
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

function sortByComposite(
  models: UnifiedModel[],
  scoreFn: (model: UnifiedModel) => number | undefined
): UnifiedModel[] {
  return [...models].sort((a, b) => {
    const aScore = scoreFn(a);
    const bScore = scoreFn(b);

    if (aScore !== undefined && bScore !== undefined && aScore !== bScore) {
      return bScore - aScore;
    }
    if (aScore !== undefined && bScore === undefined) return -1;
    if (aScore === undefined && bScore !== undefined) return 1;

    return comparePricePerformance(a, b) || a.id.localeCompare(b.id);
  });
}

function modelMatchesFilters(model: UnifiedModel, filters: TopModelFilters): boolean {
  if (filters.minContext !== undefined && model.capabilities.contextLength < filters.minContext) {
    return false;
  }
  if (
    filters.minReleaseDate !== undefined &&
    (model.metadata.releaseDate === undefined || model.metadata.releaseDate < filters.minReleaseDate)
  ) {
    return false;
  }
  return true;
}

/** Lower price with decent composite benchmarks ranks higher */
function comparePricePerformance(a: UnifiedModel, b: UnifiedModel): number {
  const aPerf = getOverallBenchmarkScore(a) ?? 0;
  const bPerf = getOverallBenchmarkScore(b) ?? 0;
  const aBlended = getBlendedTokenPrice(a);
  const bBlended = getBlendedTokenPrice(b);

  const aScore = aBlended > 0 ? aPerf / aBlended : 0;
  const bScore = bBlended > 0 ? bPerf / bBlended : 0;
  if (aScore !== bScore) return bScore - aScore;

  return a.pricing.output - b.pricing.output;
}
