import type { UnifiedModel } from "../types.js";
import type { SweBenchEntry } from "./fetchers/swe-bench.js";
import type { ArenaEntry } from "./fetchers/arena.js";

/**
 * Normalize a model name to a canonical key for cross-source matching.
 *
 * Examples:
 *   "anthropic/claude-opus-4.6"  → "claude-opus-4.6"
 *   "claude-opus-4-6"            → "claude-opus-4.6"
 *   "Claude 4.5 Opus"            → "claude-4.5-opus"
 *   "gpt-5.2-chat-latest-20260210" → "gpt-5.2"
 *   "gemini-3-pro"               → "gemini-3-pro"
 */
export function normalizeKey(name: string): string {
  let key = name
    .toLowerCase()
    .trim()
    // Strip provider prefix (e.g. "anthropic/", "openai/", "x-ai/")
    .replace(/^[a-z0-9_-]+\//, "")
    // Strip date suffixes: -20251101, -2025-11-18, (20251101)
    .replace(/[-\s]?\(?20\d{2}-?\d{2}-?\d{2}\)?/g, "")
    // Strip thinking/reasoning suffixes for base model matching
    .replace(/-thinking(?:-\d+k)?$/, "")
    // Strip common variant suffixes
    .replace(/-(chat|latest|preview|turbo|mini|fast|high|medium|low)(?=$|-)/g, (m, suffix) => {
      // Keep "preview", "mini", "fast" as they distinguish different models
      if (["preview", "mini", "fast"].includes(suffix)) return m;
      return "";
    })
    // Normalize spaces and special chars to hyphens
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9.\-]/g, "")
    // Collapse multiple hyphens
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  // Convert version-number hyphens to dots: "4-6" → "4.6", "3-1" → "3.1"
  // But only for version-like patterns (digit-digit at end or before known suffix)
  key = key.replace(/(\d+)-(\d+)(?=$|-(?:pro|flash|opus|sonnet|plus|max|mini))/g, "$1.$2");

  return key;
}

/**
 * Generate multiple matching keys for a model name to increase match rate.
 * Returns an array of keys sorted by specificity (most specific first).
 */
function generateMatchKeys(name: string): string[] {
  const primary = normalizeKey(name);
  const keys = [primary];

  // Also try without trailing qualifiers
  const withoutTrailing = primary
    .replace(/-(preview|experimental|beta|alpha|rc\d*)$/, "");
  if (withoutTrailing !== primary) keys.push(withoutTrailing);

  // For Claude models, try both orderings: "claude-4.5-opus" ↔ "claude-opus-4.5"
  const claudeMatch = primary.match(/^claude-(\d+\.?\d*)-?(opus|sonnet|haiku)$/);
  if (claudeMatch) {
    keys.push(`claude-${claudeMatch[2]}-${claudeMatch[1]}`);
  }
  const claudeMatch2 = primary.match(/^claude-(opus|sonnet|haiku)-(\d+\.?\d*)$/);
  if (claudeMatch2) {
    keys.push(`claude-${claudeMatch2[2]}-${claudeMatch2[1]}`);
  }

  return keys;
}

/**
 * Merge benchmark data from SWE-bench and Arena into the model registry.
 * Uses normalized keys for cross-source matching.
 */
export function mergeBenchmarkData(
  models: Map<string, UnifiedModel>,
  sweScores: Map<string, SweBenchEntry>,
  arenaScores: Map<string, ArenaEntry>
): void {
  // Build a reverse lookup: normalizedKey → OpenRouter model ID
  const keyToId = new Map<string, string>();
  for (const [id, model] of models) {
    for (const key of generateMatchKeys(id)) {
      if (!keyToId.has(key)) keyToId.set(key, id);
    }
    // Also index by display name
    for (const key of generateMatchKeys(model.name)) {
      if (!keyToId.has(key)) keyToId.set(key, id);
    }
  }

  // Merge SWE-bench scores
  for (const [, sweEntry] of sweScores) {
    const matchedId = findMatch(sweEntry.name, keyToId);
    if (!matchedId) continue;

    const model = models.get(matchedId);
    if (!model) continue;

    // Only update if this score is better than existing
    if (
      !model.benchmarks.sweBenchVerified ||
      sweEntry.resolved > model.benchmarks.sweBenchVerified
    ) {
      model.benchmarks.sweBenchVerified = sweEntry.resolved;
    }
  }

  // Merge Arena scores
  for (const [, arenaEntry] of arenaScores) {
    const matchedId = findMatch(arenaEntry.name, keyToId);
    if (!matchedId) continue;

    const model = models.get(matchedId);
    if (!model) continue;

    // Only update if this is a higher score (or no existing score)
    if (
      !model.benchmarks.arenaElo ||
      arenaEntry.arenaScore > model.benchmarks.arenaElo
    ) {
      model.benchmarks.arenaElo = arenaEntry.arenaScore;
    }
  }
}

/**
 * Try to find a matching OpenRouter model ID for an external model name.
 */
function findMatch(
  externalName: string,
  keyToId: Map<string, string>
): string | null {
  const candidates = generateMatchKeys(externalName);

  // 1. Exact normalized key match
  for (const key of candidates) {
    const id = keyToId.get(key);
    if (id) return id;
  }

  // 2. Substring match: check if any candidate is contained in a key (or vice versa)
  const primaryKey = candidates[0];
  for (const [indexedKey, id] of keyToId) {
    if (
      primaryKey.length >= 6 &&
      (indexedKey.includes(primaryKey) || primaryKey.includes(indexedKey))
    ) {
      return id;
    }
  }

  return null;
}
