import type { UnifiedModel, ModelCategory } from "../types.js";
import { InMemoryCache } from "./cache.js";
import { fetchOpenRouterModels } from "./fetchers/openrouter.js";
import { fetchSweBenchScores } from "./fetchers/swe-bench.js";
import { fetchArenaScores } from "./fetchers/arena.js";
import { fetchVlmScores } from "./fetchers/vlm-leaderboard.js";
import { fetchAiderScores } from "./fetchers/aider.js";
import { fetchBfclScores } from "./fetchers/bfcl.js";
import { fetchSpeedData, generateUniversalSpeedData } from "./fetchers/speed.js";
import { mergeBenchmarkData } from "./normalizer.js";
import {
  computePercentiles,
  getBlendedTokenPrice,
  getCompositeBenchmarkScore,
  getCostEfficiencyScore,
  getOverallBenchmarkScore,
} from "./percentiles.js";

export interface TopModelFilters {
  maxInputPrice?: number;
  maxOutputPrice?: number;
  minContext?: number;
  minReleaseDate?: string;
  requireVision?: boolean;
  requireTools?: boolean;
  requireOpenSource?: boolean;
}

export class ModelRegistry {
  private models = new Map<string, UnifiedModel>();
  private cache: InMemoryCache;
  private warmupPromise: Promise<void> | null = null;
  private lastLoadFailureAt: number | null = null;
  private lastLoadError: unknown;
  private ready = false;

  constructor(cache: InMemoryCache, initialModels: UnifiedModel[] = []) {
    this.cache = cache;
    for (const model of initialModels) {
      this.models.set(model.id, structuredClone(model));
    }
    this.ready = initialModels.length > 0;
  }

  /** Pre-fetch data on startup. Non-blocking — callers can use getModel even if warmup is incomplete. */
  async warmup(): Promise<void> {
    if (this.warmupPromise) return this.warmupPromise;
    if (!this.ready && this.lastLoadFailureAt !== null) {
      const retryAfterMs = this.lastLoadFailureAt + LOAD_RETRY_COOLDOWN_MS - Date.now();
      if (retryAfterMs > 0) {
        throw new Error(
          `Model data load failed recently; retry available in ${Math.ceil(retryAfterMs / 1000)}s: ${formatLoadError(this.lastLoadError)}`
        );
      }
    }
    this.warmupPromise = this._loadData()
      .then(() => {
        this.lastLoadFailureAt = null;
        this.lastLoadError = undefined;
        this.ready = true;
      })
      .catch((error) => {
        this.ready = this.models.size > 0;
        this.lastLoadFailureAt = Date.now();
        this.lastLoadError = error;
        throw error;
      })
      .finally(() => {
        this.warmupPromise = null;
      });
    return this.warmupPromise;
  }

  private async _loadData(): Promise<void> {
    const models = new Map<string, UnifiedModel>();

    // Phase 1: Load base model data from OpenRouter (required)
    const openRouterModels = await fetchOpenRouterModels(this.cache);
    for (const model of openRouterModels) {
      models.set(model.id, model);
    }

    // Phase 2: Enrich with benchmark data (best-effort, parallel)
    const [sweScores, arenaScores, vlmScores, aiderScores, bfclScores, speedEntries] = await Promise.all([
      fetchSweBenchScores(this.cache).catch((err) => {
        console.error("SWE-bench enrichment failed unexpectedly:", err);
        return new Map();
      }),
      fetchArenaScores(this.cache).catch((err) => {
        console.error("Arena enrichment failed unexpectedly:", err);
        return new Map();
      }),
      fetchVlmScores(this.cache).catch((err) => {
        console.error("VLM enrichment failed unexpectedly:", err);
        return new Map();
      }),
      fetchAiderScores(this.cache).catch((err) => {
        console.error("Aider enrichment failed unexpectedly:", err);
        return new Map();
      }),
      fetchBfclScores(this.cache).catch((err) => {
        console.error("BFCL enrichment failed unexpectedly:", err);
        return new Map();
      }),
      fetchSpeedData(this.cache).catch((err) => {
        console.error("Speed data enrichment failed unexpectedly:", err);
        return new Map();
      }),
    ]);

    mergeBenchmarkData(models, sweScores, arenaScores, vlmScores, aiderScores, bfclScores, speedEntries);

    // Phase 3: Assign estimated speed data to ANY model without measured data.
    // This ensures every model in the registry has speed/latency estimates,
    // even when no real benchmark data exists yet.
    const universalSpeed = generateUniversalSpeedData(
      Array.from(models.values()).map((m) => ({
        id: m.id,
        pricing: { input: m.pricing.input },
      }))
    );
    for (const [, model] of models) {
      const key = model.id.toLowerCase().replace(/[^a-z0-9/.\-]/g, "");
      const speed = universalSpeed.get(key);
      if (speed && model.speed.outputTokensPerSecond === undefined) {
        model.speed.outputTokensPerSecond = speed.outputTokensPerSecond;
        model.speed.timeToFirstToken = speed.timeToFirstToken;
        model.benchmarks.outputTokensPerSecond = speed.outputTokensPerSecond;
        model.benchmarks.timeToFirstToken = speed.timeToFirstToken;
      }
    }

    // Phase 4: Compute percentile ranks across all models
    computePercentiles(models);
    this.models = models;
  }

  /** Ensure data is loaded, refreshing if needed */
  async ensureLoaded(): Promise<void> {
    if (!this.ready) {
      await this.warmup();
    }
  }

  /** Get a model by exact ID or fuzzy match */
  getModel(query: string): UnifiedModel | null {
    // 1. Exact match by full ID
    const exact = this.models.get(query);
    if (exact) return structuredClone(exact);

    const queryLower = query.toLowerCase();
    const querySlug = queryLower.replace(/[^a-z0-9/\-]/g, "");
    // A punctuation-only or empty query must not return an arbitrary model
    // via the substring (step 4) path where empty string matches everything.
    if (querySlug.length < 2) return null;

    // 2. Case-insensitive exact match
    for (const [id, model] of this.models) {
      if (id.toLowerCase() === queryLower) return structuredClone(model);
    }

    // 3. Exact match on model part only (without provider prefix)
    //    e.g. "gpt-4o" matches "openai/gpt-4o" exactly
    for (const [id, model] of this.models) {
      const modelPart = id.split("/").slice(1).join("/").toLowerCase();
      if (modelPart === queryLower || modelPart === querySlug) return structuredClone(model);
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
      return structuredClone(candidates[0]);
    }

    return null;
  }

  /** Find similar model names for suggestions */
  findSimilar(query: string, limit = 5): string[] {
    const queryLower = query.toLowerCase();
    if (queryLower.length < 2) return [];
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
    return structuredClone(Array.from(this.models.values()));
  }

  /** Get top models for a category, sorted by the relevant metric */
  getTopModels(category: ModelCategory, limit = 10, filters: TopModelFilters = {}): UnifiedModel[] {
    const allModels = Array.from(this.models.values()).filter((m) => modelMatchesFilters(m, filters));
    const takeCloned = (models: UnifiedModel[]): UnifiedModel[] =>
      structuredClone(models.slice(0, limit));

    switch (category) {
      case "coding":
        return takeCloned(sortByComposite(allModels, (m) => getCompositeBenchmarkScore(m, "coding")));

      case "math":
        return takeCloned(sortByComposite(allModels, (m) => getCompositeBenchmarkScore(m, "math")));

      case "vision":
        return takeCloned(sortByComposite(
          allModels.filter((m) => m.capabilities.inputModalities.includes("image")),
          (m) => getCompositeBenchmarkScore(m, "vision")
        ));

      case "general":
        return takeCloned(sortByComposite(allModels, (m) => getCompositeBenchmarkScore(m, "general")));

      case "cost-effective":
        return takeCloned(sortByComposite(
          allModels.filter((m) => getBlendedTokenPrice(m) > 0),
          getCostEfficiencyScore
        ));

      case "open-source":
        return takeCloned(sortByComposite(
          allModels.filter((m) => m.metadata.isOpenSource),
          (m) =>
            getCompositeBenchmarkScore(m, "general") ??
            getCompositeBenchmarkScore(m, "coding") ??
            getCompositeBenchmarkScore(m, "vision")
        ));

      case "speed":
        return takeCloned(allModels
          .sort((a, b) => {
            const aSpeed = a.speed.outputTokensPerSecond ?? a.pricing.output;
            const bSpeed = b.speed.outputTokensPerSecond ?? b.pricing.output;
            // Higher speed = better rank. Fall back to inverse price if no speed data.
            if (a.speed.outputTokensPerSecond !== undefined && b.speed.outputTokensPerSecond !== undefined) {
              return b.speed.outputTokensPerSecond - a.speed.outputTokensPerSecond || a.id.localeCompare(b.id);
            }
            // One has speed data, one doesn't — prefer the one with data
            if (a.speed.outputTokensPerSecond !== undefined) return -1;
            if (b.speed.outputTokensPerSecond !== undefined) return 1;
            // Neither has speed data — fall back to price proxy
            return a.pricing.output - b.pricing.output || a.id.localeCompare(b.id);
          })
        );

      case "context-window":
        return takeCloned(allModels
          .sort((a, b) => b.capabilities.contextLength - a.capabilities.contextLength || a.id.localeCompare(b.id))
        );

      case "reasoning":
        return takeCloned(sortByComposite(
          allModels.filter((m) => m.capabilities.supportsReasoning),
          (m) => getCompositeBenchmarkScore(m, "reasoning") ?? getCompositeBenchmarkScore(m, "general")
        ));

      case "quality":
        return takeCloned(sortByComposite(
          allModels,
          (m) => getOverallBenchmarkScore(m)
        ));

      default:
        return takeCloned(sortByComposite(allModels, (m) => getCompositeBenchmarkScore(m, "general")));
    }
  }

  /** Get cache freshness info */
  getCacheFreshnessMs(): number | undefined {
    const info = this.cache.getOldestFreshnessInfo(DATA_CACHE_KEYS);
    return info?.fetchedAt;
  }
}

const LOAD_RETRY_COOLDOWN_MS = 60_000;
const DATA_CACHE_KEYS = [
  "openrouter:models",
  "swebench:verified",
  "arena:elo",
  "vlm:opencompass",
  "aider:polyglot",
  "bfcl:v4",
  "speed:static",
];

function formatLoadError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ============================================================
// Sorting helpers
// ============================================================

function sortByComposite(
  models: UnifiedModel[],
  scoreFn: (model: UnifiedModel) => number | undefined
): UnifiedModel[] {
  const scores = new Map(models.map((model) => [model.id, scoreFn(model)]));
  const normalize = (s: number | undefined) =>
    s !== undefined && Number.isFinite(s) ? s : undefined;
  return [...models].sort((a, b) => {
    const aScore = normalize(scores.get(a.id));
    const bScore = normalize(scores.get(b.id));

    if (aScore !== undefined && bScore !== undefined && aScore !== bScore) {
      return bScore - aScore;
    }
    if (aScore !== undefined && bScore === undefined) return -1;
    if (aScore === undefined && bScore !== undefined) return 1;

    return comparePricePerformance(a, b) || a.id.localeCompare(b.id);
  });
}

export function modelMatchesFilters(model: UnifiedModel, filters: TopModelFilters): boolean {
  if (filters.maxInputPrice !== undefined && model.pricing.input > filters.maxInputPrice) {
    return false;
  }
  if (filters.maxOutputPrice !== undefined && model.pricing.output > filters.maxOutputPrice) {
    return false;
  }
  if (filters.minContext !== undefined && model.capabilities.contextLength < filters.minContext) {
    return false;
  }
  if (filters.requireVision && !model.capabilities.inputModalities.includes("image")) {
    return false;
  }
  if (filters.requireTools && !model.capabilities.supportsTools) {
    return false;
  }
  if (filters.requireOpenSource && !model.metadata.isOpenSource) {
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
  const aPerf = getOverallBenchmarkScore(a);
  const bPerf = getOverallBenchmarkScore(b);
  if (aPerf !== undefined && bPerf === undefined) return -1;
  if (aPerf === undefined && bPerf !== undefined) return 1;
  const aBlended = getBlendedTokenPrice(a);
  const bBlended = getBlendedTokenPrice(b);

  const aScore = aBlended > 0 && aPerf !== undefined ? aPerf / aBlended : -Infinity;
  const bScore = bBlended > 0 && bPerf !== undefined ? bPerf / bBlended : -Infinity;
  if (aScore !== bScore) return bScore - aScore;

  return aBlended - bBlended || a.id.localeCompare(b.id);
}
