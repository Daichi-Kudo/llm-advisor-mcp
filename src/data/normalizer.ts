import type { UnifiedModel } from "../types.js";
import type { SweBenchEntry } from "./fetchers/swe-bench.js";
import type { ArenaEntry } from "./fetchers/arena.js";
import type { VlmEntry } from "./fetchers/vlm-leaderboard.js";
import type { AiderEntry } from "./fetchers/aider.js";
import type { BfclEntry } from "./fetchers/bfcl.js";
import type { SpeedEntry } from "./fetchers/speed.js";

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
    // Strip trailing year or month-year suffixes before version normalization.
    .replace(/[-\s]?\(?(?:(?:0[1-9]|1[0-2])-)?20\d{2}\)?$/g, "")
    // Strip thinking/reasoning suffixes for base model matching
    .replace(/-thinking(?:-\d+k)?$/, "")
    // Strip common variant suffixes
    .replace(/-(chat|latest|preview|turbo|mini|fast)(?=$|-)/g, (m, suffix) => {
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

  // Convert version-number hyphens to dots: "4-6" → "4.6", "3-1" → "3.1".
  // Match before any textual variant suffix, not just a small allowlist, so
  // "claude-3-5-haiku", "gpt-4-1-mini", and "gemini-2-5-flash" align with
  // benchmark names that spell the same versions with dots.
  key = key.replace(/(\d+)-(\d+)(?=$|-[a-z][a-z0-9]*)/g, "$1.$2");

  return key;
}

/**
 * Normalize upstream benchmark names for Map indexing before richer matching.
 * This intentionally avoids provider/date/version heuristics so fetchers all
 * store keys with the same minimal punctuation and whitespace normalization.
 */
export function normalizeForIndex(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Generate multiple matching keys for a model name to increase match rate.
 * Returns an array of keys sorted by specificity (most specific first).
 */
export function generateMatchKeys(name: string): string[] {
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
 * Build a reverse lookup index (normalized key → OpenRouter model ID) from the
 * model registry. Indexed by both model ID and display name, most-specific-first.
 */
export function buildKeyToId(
  models: Map<string, UnifiedModel>
): Map<string, string> {
  const keyToId = new Map<string, string>();
  for (const [id, model] of models) {
    const indexedId = normalizeForIndex(id);
    if (!keyToId.has(indexedId)) keyToId.set(indexedId, id);
    const indexedName = normalizeForIndex(model.name);
    if (!keyToId.has(indexedName)) keyToId.set(indexedName, id);

    for (const key of generateMatchKeys(id)) {
      if (!keyToId.has(key)) keyToId.set(key, id);
    }
    // Also index by display name
    for (const key of generateMatchKeys(model.name)) {
      if (!keyToId.has(key)) keyToId.set(key, id);
    }
  }
  return keyToId;
}

/**
 * Merge benchmark data from all sources into the model registry.
 * Uses normalized keys for cross-source matching.
 */
export function mergeBenchmarkData(
  models: Map<string, UnifiedModel>,
  sweScores: Map<string, SweBenchEntry>,
  arenaScores: Map<string, ArenaEntry>,
  vlmScores?: Map<string, VlmEntry>,
  aiderScores?: Map<string, AiderEntry>,
  bfclScores?: Map<string, BfclEntry>,
  speedEntries?: Map<string, SpeedEntry>
): void {
  // Build a reverse lookup: normalizedKey → OpenRouter model ID
  const keyToId = buildKeyToId(models);

  // Merge SWE-bench scores
  for (const [, sweEntry] of sweScores) {
    const matchedId = findMatch(sweEntry.name, keyToId);
    if (!matchedId) continue;

    const model = models.get(matchedId);
    if (!model) continue;

    if (
      !model.benchmarks.sweBenchVerified ||
      sweEntry.resolved > model.benchmarks.sweBenchVerified
    ) {
      if (Number.isFinite(sweEntry.resolved)) {
        model.benchmarks.sweBenchVerified = sweEntry.resolved;
      }
    }
  }

  // Merge Arena scores
  for (const [, arenaEntry] of arenaScores) {
    const matchedId = findMatch(arenaEntry.name, keyToId);
    if (!matchedId) continue;

    const model = models.get(matchedId);
    if (!model) continue;

    if (
      !model.benchmarks.arenaElo ||
      arenaEntry.arenaScore > model.benchmarks.arenaElo
    ) {
      if (Number.isFinite(arenaEntry.arenaScore)) {
        model.benchmarks.arenaElo = arenaEntry.arenaScore;
      }
    }
  }

  // Merge VLM scores (only for vision-capable models)
  if (vlmScores) {
    for (const [, vlmEntry] of vlmScores) {
      const matchedId = findMatch(vlmEntry.name, keyToId);
      if (!matchedId) continue;

      const model = models.get(matchedId);
      if (!model) continue;
      // A text-only model must not inherit vision benchmarks from a name-colliding VLM entry.
      if (!model.capabilities.inputModalities.includes("image")) continue;

      if (vlmEntry.mmmu !== undefined && Number.isFinite(vlmEntry.mmmu) && (!model.benchmarks.mmmu || vlmEntry.mmmu > model.benchmarks.mmmu)) {
        model.benchmarks.mmmu = vlmEntry.mmmu;
      }
      if (vlmEntry.mmBench !== undefined && Number.isFinite(vlmEntry.mmBench) && (!model.benchmarks.mmBench || vlmEntry.mmBench > model.benchmarks.mmBench)) {
        model.benchmarks.mmBench = vlmEntry.mmBench;
      }
      if (vlmEntry.ocrBench !== undefined && Number.isFinite(vlmEntry.ocrBench) && (!model.benchmarks.ocrBench || vlmEntry.ocrBench > model.benchmarks.ocrBench)) {
        model.benchmarks.ocrBench = vlmEntry.ocrBench;
      }
      if (vlmEntry.ai2d !== undefined && Number.isFinite(vlmEntry.ai2d) && (!model.benchmarks.ai2d || vlmEntry.ai2d > model.benchmarks.ai2d)) {
        model.benchmarks.ai2d = vlmEntry.ai2d;
      }
      if (vlmEntry.mathVista !== undefined && Number.isFinite(vlmEntry.mathVista) && (!model.benchmarks.mathVista || vlmEntry.mathVista > model.benchmarks.mathVista)) {
        model.benchmarks.mathVista = vlmEntry.mathVista;
      }
    }
  }

  // Merge Aider Polyglot scores
  if (aiderScores) {
    for (const [, aiderEntry] of aiderScores) {
      const matchedId = findMatch(aiderEntry.name, keyToId);
      if (!matchedId) continue;

      const model = models.get(matchedId);
      if (!model) continue;

      if (
        !model.benchmarks.aiderPolyglot ||
        aiderEntry.passRate2 > model.benchmarks.aiderPolyglot
      ) {
        if (Number.isFinite(aiderEntry.passRate2)) {
          model.benchmarks.aiderPolyglot = aiderEntry.passRate2;
        }
      }
    }
  }

  // Merge BFCL V4 agentic benchmark scores
  if (bfclScores) {
    for (const [, bfclEntry] of bfclScores) {
      const matchedId = findMatch(bfclEntry.name, keyToId);
      if (!matchedId) continue;

      const model = models.get(matchedId);
      if (!model) continue;

      if (bfclEntry.overall !== undefined && Number.isFinite(bfclEntry.overall) &&
          (!model.benchmarks.bfclV4Overall || bfclEntry.overall > model.benchmarks.bfclV4Overall)) {
        model.benchmarks.bfclV4Overall = bfclEntry.overall;
      }
      if (bfclEntry.agentic !== undefined && Number.isFinite(bfclEntry.agentic) &&
          (!model.benchmarks.bfclV4Agentic || bfclEntry.agentic > model.benchmarks.bfclV4Agentic)) {
        model.benchmarks.bfclV4Agentic = bfclEntry.agentic;
      }
      if (bfclEntry.multiTurn !== undefined && Number.isFinite(bfclEntry.multiTurn) &&
          (!model.benchmarks.bfclV4MultiTurn || bfclEntry.multiTurn > model.benchmarks.bfclV4MultiTurn)) {
        model.benchmarks.bfclV4MultiTurn = bfclEntry.multiTurn;
      }
      if (bfclEntry.singleTurn !== undefined && Number.isFinite(bfclEntry.singleTurn) &&
          (!model.benchmarks.bfclV4SingleTurn || bfclEntry.singleTurn > model.benchmarks.bfclV4SingleTurn)) {
        model.benchmarks.bfclV4SingleTurn = bfclEntry.singleTurn;
      }
      if (bfclEntry.cost !== undefined && Number.isFinite(bfclEntry.cost) &&
          (!model.benchmarks.bfclV4Cost || bfclEntry.cost < model.benchmarks.bfclV4Cost)) {
        model.benchmarks.bfclV4Cost = bfclEntry.cost;
      }
    }
  }

  // Merge speed/latency data
  if (speedEntries) {
    for (const [, speedEntry] of speedEntries) {
      const matchedId = findMatch(speedEntry.name, keyToId);
      if (!matchedId) continue;

      const model = models.get(matchedId);
      if (!model) continue;

      if (speedEntry.outputTokensPerSecond !== undefined && Number.isFinite(speedEntry.outputTokensPerSecond)) {
        model.speed.outputTokensPerSecond = speedEntry.outputTokensPerSecond;
        model.benchmarks.outputTokensPerSecond = speedEntry.outputTokensPerSecond;
      }
      if (speedEntry.timeToFirstToken !== undefined && Number.isFinite(speedEntry.timeToFirstToken)) {
        model.speed.timeToFirstToken = speedEntry.timeToFirstToken;
        model.benchmarks.timeToFirstToken = speedEntry.timeToFirstToken;
      }
    }
  }
}

/**
 * Try to find a matching OpenRouter model ID for an external model name.
 */
export function findMatch(
  externalName: string,
  keyToId: Map<string, string>
): string | null {
  const candidates = generateMatchKeys(externalName);

  // 1. Exact normalized key match
  for (const key of candidates) {
    const id = keyToId.get(key);
    if (id) return id;
  }

  // 2. Substring match: check if any candidate is contained in a key (or vice versa).
  //    BOTH sides must be ≥6 chars: a short indexed stem (e.g. "gpt", left over from
  //    stripping "gpt-chat-latest" down to "gpt") would otherwise swallow unrelated
  //    names like "PandaGPT-13B", "ShareGPT4V", or "MiniGPT-4".
  const primaryKey = candidates[0];
  const primaryIsVision = hasVisionToken(primaryKey);
  for (const [indexedKey, id] of keyToId) {
    if (primaryKey.length < 6 || indexedKey.length < 6) continue;
    if (indexedKey.includes(primaryKey) || primaryKey.includes(indexedKey)) {
      // Vision and non-vision model lines must not collapse into each other.
      // "DeepSeek-VL-7B" is not "deepseek-chat", and a base "Qwen2.5" score
      // must not attach to "qwen2.5-vl-72b-instruct".
      if (primaryIsVision !== hasVisionToken(indexedKey)) continue;
      return id;
    }
  }

  return null;
}

/** True if a normalized key carries a vision/VL model-line token. */
function hasVisionToken(key: string): boolean {
  return /(^|-)(vl\d*|vision)(-|$)/.test(key);
}
