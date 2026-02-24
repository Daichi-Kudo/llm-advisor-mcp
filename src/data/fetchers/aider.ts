import type { InMemoryCache } from "../cache.js";

const API_URL =
  "https://raw.githubusercontent.com/Aider-AI/aider/main/aider/website/_data/polyglot_leaderboard.yml";
const CACHE_KEY = "aider:polyglot";
const TTL = 6 * 60 * 60 * 1000; // 6 hours

export interface AiderEntry {
  name: string;
  /** Pass rate after 2 attempts (the main benchmark score), percentage 0-100 */
  passRate2: number;
  /** Pass rate after 1 attempt, percentage 0-100 */
  passRate1?: number;
  /** Percentage of well-formed outputs */
  wellFormed?: number;
  /** Cost in USD for the benchmark run */
  totalCost?: number;
  /** Edit format used (diff, whole, etc.) */
  editFormat?: string;
}

/**
 * Fetch Aider Polyglot benchmark scores.
 * Returns a Map of normalized model names → benchmark scores.
 * Data source: ~63 models from aider.chat GitHub repo (YAML).
 */
export async function fetchAiderScores(
  cache: InMemoryCache
): Promise<Map<string, AiderEntry>> {
  const cached = cache.get<Map<string, AiderEntry>>(CACHE_KEY);
  if (cached) return cached;

  const stale = cache.getStaleOrNull<Map<string, AiderEntry>>(CACHE_KEY);

  try {
    const response = await fetch(API_URL, {
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`Aider leaderboard returned ${response.status}`);
    }

    const text = await response.text();
    const entries = parseSimpleYamlList(text);
    const scores = new Map<string, AiderEntry>();

    for (const entry of entries) {
      const model = entry.model;
      const passRate2 = parseFloat(entry.pass_rate_2);
      if (!model || isNaN(passRate2) || passRate2 <= 0) continue;

      const key = normalizeAiderName(model);

      // Keep the best score per model (some models have multiple entries with different edit formats)
      const existing = scores.get(key);
      if (existing && existing.passRate2 >= passRate2) continue;

      scores.set(key, {
        name: model,
        passRate2,
        passRate1: safeParseFloat(entry.pass_rate_1),
        wellFormed: safeParseFloat(entry.percent_cases_well_formed),
        totalCost: safeParseFloat(entry.total_cost),
        editFormat: entry.edit_format || undefined,
      });
    }

    cache.set(CACHE_KEY, scores, TTL, "aider");
    return scores;
  } catch (error) {
    if (stale) return stale.data;
    return new Map();
  }
}

// ============================================================
// Minimal YAML list parser for flat key-value entries
// ============================================================

interface YamlEntry {
  [key: string]: string;
}

/**
 * Parse a simple YAML list of flat key-value pairs.
 * Handles the specific format used by Aider leaderboard:
 *   - key1: value1
 *     key2: value2
 *     ...
 *   - key1: value1
 *     ...
 *
 * Does NOT handle: nested objects, multiline strings, anchors, etc.
 */
function parseSimpleYamlList(text: string): YamlEntry[] {
  const entries: YamlEntry[] = [];
  let current: YamlEntry | null = null;

  for (const line of text.split("\n")) {
    const trimmed = line.trimEnd();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // New list item: "- key: value"
    const newItemMatch = trimmed.match(/^-\s+(\w[\w_]*):\s*(.*)$/);
    if (newItemMatch) {
      if (current) entries.push(current);
      current = {};
      current[newItemMatch[1]] = newItemMatch[2].trim();
      continue;
    }

    // Continuation: "  key: value"
    const contMatch = trimmed.match(/^\s+(\w[\w_]*):\s*(.*)$/);
    if (contMatch && current) {
      current[contMatch[1]] = contMatch[2].trim();
    }
  }

  if (current) entries.push(current);
  return entries;
}

// ============================================================
// Helpers
// ============================================================

function safeParseFloat(val: string | undefined): number | undefined {
  if (!val) return undefined;
  const n = parseFloat(val);
  return isNaN(n) ? undefined : n;
}

/** Normalize Aider model names for matching */
function normalizeAiderName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
