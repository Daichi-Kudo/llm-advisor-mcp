import type { InMemoryCache } from "../cache.js";

const API_URL =
  "https://raw.githubusercontent.com/SWE-bench/swe-bench.github.io/master/data/leaderboards.json";
const CACHE_KEY = "swebench:verified";
const TTL = 6 * 60 * 60 * 1000; // 6 hours

export interface SweBenchEntry {
  name: string;
  resolved: number;
  date: string;
  cost?: number;
}

interface SweBenchResponse {
  leaderboards: Array<{
    name: string;
    results: Array<{
      name: string;
      resolved: number;
      date: string;
      cost: number | null;
    }>;
  }>;
}

/**
 * Fetch SWE-bench Verified leaderboard.
 * Returns the best score per model (many entries are agent+model combos).
 */
export async function fetchSweBenchScores(
  cache: InMemoryCache
): Promise<Map<string, SweBenchEntry>> {
  const cached = cache.get<Map<string, SweBenchEntry>>(CACHE_KEY);
  if (cached) return cached;

  const stale = cache.getStaleOrNull<Map<string, SweBenchEntry>>(CACHE_KEY);

  try {
    const response = await fetch(API_URL, {
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`SWE-bench API returned ${response.status}`);
    }

    const data = (await response.json()) as SweBenchResponse;
    const verified = data.leaderboards.find((lb) => lb.name === "Verified");
    if (!verified) throw new Error("SWE-bench Verified leaderboard not found");

    const modelScores = new Map<string, SweBenchEntry>();

    for (const result of verified.results) {
      if (!result.resolved || result.resolved <= 0) continue;

      // Extract model name from agent+model combo
      const modelName = extractModelName(result.name);
      if (!modelName) continue;

      // Keep the best score per model
      const existing = modelScores.get(modelName);
      if (!existing || result.resolved > existing.resolved) {
        modelScores.set(modelName, {
          name: modelName,
          resolved: result.resolved,
          date: result.date,
          cost: result.cost ?? undefined,
        });
      }
    }

    cache.set(CACHE_KEY, modelScores, TTL, "swe-bench");
    return modelScores;
  } catch (error) {
    if (stale) return stale.data;
    return new Map();
  }
}

/**
 * Extract the base model name from SWE-bench entry names like:
 * "mini-SWE-agent + Claude 4.5 Opus (high reasoning)" → "Claude 4.5 Opus"
 * "live-SWE-agent + Gemini 3 Pro Preview (2025-11-18)" → "Gemini 3 Pro Preview"
 * "TRAE + Doubao-Seed-Code" → "Doubao-Seed-Code"
 * "Atlassian Rovo Dev (2025-09-02)" → null (no clear model name)
 */
function extractModelName(entryName: string): string | null {
  // Pattern: "Agent + Model (qualifier)" — extract after "+"
  const plusMatch = entryName.match(/\+\s*(.+)/);
  if (plusMatch) {
    let model = plusMatch[1].trim();
    // Remove trailing qualifiers like "(high reasoning)", "(20251101)", date patterns
    model = model.replace(/\s*\((?:high|medium|low)\s*reasoning\)/i, "");
    model = model.replace(/\s*\(\d{4}-?\d{2}-?\d{2}\)/i, "");
    model = model.replace(/\s*\(\d{8}\)/i, "");
    return model.trim() || null;
  }

  // No "+" separator — check if it contains a known model name pattern
  const knownPatterns = [
    /claude/i, /gpt/i, /gemini/i, /deepseek/i, /qwen/i, /llama/i,
    /sonnet/i, /opus/i, /mistral/i,
  ];
  if (knownPatterns.some((p) => p.test(entryName))) {
    // Remove agent prefixes and date suffixes
    let model = entryName.replace(/\s*\(\d{4}-?\d{2}-?\d{2}\)/i, "");
    return model.trim();
  }

  return null;
}
