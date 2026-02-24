import type { UnifiedModel } from "../types.js";

/**
 * Compute percentile ranks for all models across five categories.
 * Percentile = (number of models scoring lower / total models with a score) * 100.
 * Models without relevant benchmarks get no percentile for that category.
 */
export function computePercentiles(models: Map<string, UnifiedModel>): void {
  const all = Array.from(models.values());

  assignPercentile(all, "coding", codingScore);
  assignPercentile(all, "math", mathScore);
  assignPercentile(all, "general", generalScore);
  assignPercentile(all, "vision", visionScore);
  assignPercentile(all, "costEfficiency", costEfficiencyScore);
}

// ============================================================
// Category score functions — return undefined if no data
// ============================================================

function codingScore(m: UnifiedModel): number | undefined {
  return weightedAvg([
    [m.benchmarks.sweBenchVerified, 2],
    [m.benchmarks.aiderPolyglot, 2],
    [m.benchmarks.humanEval, 1],
  ]);
}

function mathScore(m: UnifiedModel): number | undefined {
  return weightedAvg([
    [m.benchmarks.math500, 2],
    [m.benchmarks.gpqaDiamond, 1],
    [m.benchmarks.aime2024, 1],
  ]);
}

function generalScore(m: UnifiedModel): number | undefined {
  // Arena Elo is on a different scale (~800-1400), normalize to 0-100 range
  const normalizedElo =
    m.benchmarks.arenaElo !== undefined
      ? ((m.benchmarks.arenaElo - 800) / 600) * 100
      : undefined;

  return weightedAvg([
    [normalizedElo, 2],
    [m.benchmarks.mmluPro, 1],
  ]);
}

function visionScore(m: UnifiedModel): number | undefined {
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

function costEfficiencyScore(m: UnifiedModel): number | undefined {
  // Need at least one benchmark and a non-zero price
  const blendedPrice = m.pricing.input * 0.75 + m.pricing.output * 0.25;
  if (blendedPrice <= 0) return undefined;

  const perfScore = weightedAvg([
    [m.benchmarks.arenaElo !== undefined ? ((m.benchmarks.arenaElo - 800) / 600) * 100 : undefined, 2],
    [m.benchmarks.sweBenchVerified, 1],
    [m.benchmarks.mmluPro, 1],
  ]);
  if (perfScore === undefined) return undefined;

  // Higher performance per dollar = better
  return perfScore / blendedPrice;
}

// ============================================================
// Helpers
// ============================================================

type PercentileCategory = "coding" | "math" | "general" | "vision" | "costEfficiency";

function assignPercentile(
  models: UnifiedModel[],
  category: PercentileCategory,
  scoreFn: (m: UnifiedModel) => number | undefined
): void {
  // Collect models with scores
  const scored: { model: UnifiedModel; score: number }[] = [];
  for (const m of models) {
    const s = scoreFn(m);
    if (s !== undefined) scored.push({ model: m, score: s });
  }

  if (scored.length === 0) return;

  // Sort ascending by score
  scored.sort((a, b) => a.score - b.score);

  // Assign percentile: fraction of models scoring strictly lower
  const total = scored.length;
  for (let i = 0; i < total; i++) {
    // Handle ties: count models with strictly lower scores
    let lowerCount = i;
    while (lowerCount > 0 && scored[lowerCount - 1].score === scored[i].score) {
      lowerCount--;
    }
    scored[i].model.percentiles[category] = Math.round((lowerCount / (total - 1 || 1)) * 100);
  }
}

/** Weighted average of available scores. Returns undefined if no scores available. */
function weightedAvg(pairs: [number | undefined, number][]): number | undefined {
  let sum = 0;
  let weightSum = 0;
  for (const [val, weight] of pairs) {
    if (val !== undefined) {
      sum += val * weight;
      weightSum += weight;
    }
  }
  return weightSum > 0 ? sum / weightSum : undefined;
}
