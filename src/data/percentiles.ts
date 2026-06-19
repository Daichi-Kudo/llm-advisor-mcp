import type { UnifiedModel } from "../types.js";

export type CompositeScoreCategory =
  | "coding"
  | "math"
  | "general"
  | "vision"
  | "creative"
  | "reasoning";

const INPUT_PRICE_WEIGHT = 0.75;
const OUTPUT_PRICE_WEIGHT = 0.25;

export function getBlendedTokenPrice(m: UnifiedModel): number {
  const input = Number.isFinite(m.pricing.input) ? m.pricing.input : 0;
  const output = Number.isFinite(m.pricing.output) ? m.pricing.output : 0;
  return roundWeightedPrice(input * INPUT_PRICE_WEIGHT + output * OUTPUT_PRICE_WEIGHT);
}

function roundWeightedPrice(price: number): number {
  // Weighted decimal prices can produce binary floating-point artifacts
  // (e.g. 0.1 * 0.75 + 0.3 * 0.25 -> 0.15000000000000002).
  // Keep meaningful precision while avoiding noisy downstream sorting/output.
  return Number(price.toPrecision(15));
}

/**
 * Compute percentile ranks for all models across seven categories.
 * Percentile = (number of models scoring lower / (total models with a score - 1)) * 100.
 * Models without relevant benchmarks get no percentile for that category.
 */
export function computePercentiles(models: Map<string, UnifiedModel>): void {
  const all = Array.from(models.values());

  // Clear any stale percentile values before recomputing
  for (const m of all) {
    m.percentiles.coding = undefined;
    m.percentiles.math = undefined;
    m.percentiles.general = undefined;
    m.percentiles.vision = undefined;
    m.percentiles.costEfficiency = undefined;
    m.percentiles.speed = undefined;
    m.percentiles.agentic = undefined;
  }

  assignPercentile(all, "coding", (m) => getCompositeBenchmarkScore(m, "coding"));
  assignPercentile(all, "math", (m) => getCompositeBenchmarkScore(m, "math"));
  assignPercentile(all, "general", (m) => getCompositeBenchmarkScore(m, "general"));
  assignPercentile(all, "vision", (m) => getCompositeBenchmarkScore(m, "vision"));
  assignPercentile(all, "costEfficiency", getCostEfficiencyScore);

  // Assign "speed" percentile based on output tokens/second
  assignPercentile(all, "speed", (m) => m.speed.outputTokensPerSecond);

  // Assign "agentic" percentile based on BFCL V4 overall score
  assignPercentile(all, "agentic", (m) => m.benchmarks.bfclV4Overall);
}

// ============================================================
// Category score functions — return undefined if no data
// ============================================================

/**
 * Composite benchmark score on a 0-100-ish scale.
 * Uses all available top sources for the category instead of treating one
 * leaderboard as authoritative and relegating the others to tie-breakers.
 */
export function getCompositeBenchmarkScore(
  m: UnifiedModel,
  category: CompositeScoreCategory
): number | undefined {
  switch (category) {
    case "coding":
      // Require at least one coding-specific benchmark (SWE-bench or Aider)
      // to prevent a generic Arena-Elo-only model from getting a coding score
      // and outranking models with actual coding benchmark data.
      if (m.benchmarks.sweBenchVerified === undefined && m.benchmarks.aiderPolyglot === undefined) {
        return undefined;
      }
      return weightedAvg([
        [m.benchmarks.sweBenchVerified, 2],
        [m.benchmarks.aiderPolyglot, 2],
        [normalizeArenaElo(m.benchmarks.arenaElo), 1],
      ]);

    case "math":
    case "reasoning":
      return weightedAvg([
        [m.benchmarks.math500, 2],
        [m.benchmarks.gpqaDiamond, 2],
        [m.benchmarks.aime2024, 1],
      ]);

    case "general":
      return weightedAvg([
        [normalizeArenaElo(m.benchmarks.arenaElo), 2],
        [m.benchmarks.mmluPro, 1],
        [m.benchmarks.gpqaDiamond, 0.5],
      ]);

    case "creative":
      // No creative-specific leaderboard exists yet; general chat quality is
      // the closest available proxy until one is added.
      return getCompositeBenchmarkScore(m, "general");

    case "vision":
      // Only compute for vision-capable models
      if (!m.capabilities.inputModalities.includes("image")) return undefined;
      return weightedAvg([
        [m.benchmarks.mmmu, 2],
        [m.benchmarks.mmBench, 1],
        [m.benchmarks.ocrBench, 1],
        [m.benchmarks.ai2d, 1],
        [m.benchmarks.mathVista, 1],
      ]);
  }
}

export function getCostEfficiencyScore(m: UnifiedModel): number | undefined {
  // Need at least one benchmark and a non-zero price
  const blendedPrice = getBlendedTokenPrice(m);
  if (!Number.isFinite(blendedPrice) || blendedPrice <= 0) return undefined;

  const perfScore = getOverallBenchmarkScore(m);
  if (perfScore === undefined) return undefined;

  // Higher performance per dollar = better
  return perfScore / blendedPrice;
}

export function getOverallBenchmarkScore(m: UnifiedModel): number | undefined {
  return weightedAvg([
    [getCompositeBenchmarkScore(m, "general"), 2],
    [getCompositeBenchmarkScore(m, "coding"), 1],
    [getCompositeBenchmarkScore(m, "vision"), 1],
    [getCompositeBenchmarkScore(m, "math"), 1],
  ]);
}

// ============================================================
// Helpers
// ============================================================

type PercentileCategory = "coding" | "math" | "general" | "vision" | "costEfficiency" | "speed" | "agentic";

function assignPercentile(
  models: UnifiedModel[],
  category: PercentileCategory,
  scoreFn: (m: UnifiedModel) => number | undefined
): void {
  // Collect models with scores
  const scored: { model: UnifiedModel; score: number }[] = [];
  for (const m of models) {
    const s = scoreFn(m);
    if (s !== undefined && Number.isFinite(s)) scored.push({ model: m, score: s });
  }

  if (scored.length === 0) return;

  // Sort ascending by score
  scored.sort((a, b) => a.score - b.score);

  // Assign percentile: fraction of models scoring strictly lower
  const total = scored.length;
  if (total === 1) {
    scored[0].model.percentiles[category] = 100;
    return;
  }
  let i = 0;
  while (i < total) {
    let j = i;
    while (j + 1 < total && scored[j + 1].score === scored[i].score) {
      j++;
    }
    const percentile = Math.round((i / (total - 1 || 1)) * 100);
    for (let k = i; k <= j; k++) {
      scored[k].model.percentiles[category] = percentile;
    }
    i = j + 1;
  }
}

function normalizeArenaElo(elo: number | undefined): number | undefined {
  if (elo === undefined || !Number.isFinite(elo)) return undefined;
  // Arena Elo is on a different scale (~800-1400+); clamp to keep composites bounded.
  return Math.max(0, Math.min(100, ((elo - 800) / 600) * 100));
}

/** Weighted average of available scores. Returns undefined if no scores available. */
function weightedAvg(pairs: [number | undefined, number][]): number | undefined {
  let sum = 0;
  let weightSum = 0;
  for (const [val, weight] of pairs) {
    if (val !== undefined) {
      if (!Number.isFinite(val)) continue;
      sum += val * weight;
      weightSum += weight;
    }
  }
  return weightSum > 0 ? sum / weightSum : undefined;
}
