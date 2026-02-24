import type { InMemoryCache } from "../cache.js";

const API_URL = "https://opencompass.openxlab.space/assets/OpenVLM.json";
const CACHE_KEY = "vlm:opencompass";
const TTL = 6 * 60 * 60 * 1000; // 6 hours

export interface VlmEntry {
  name: string;
  mmmu?: number;
  mmBench?: number;
  ocrBench?: number;
  ai2d?: number;
  mathVista?: number;
  organization?: string;
}

// ============================================================
// OpenCompass VLM JSON types
// ============================================================

interface OpenVlmResponse {
  time: string;
  results: Record<string, OpenVlmModelData>;
}

interface OpenVlmModelData {
  META: {
    Method: [string, string?] | string;
    Org?: string;
    Time?: string;
    OpenSource?: string;
    [key: string]: unknown;
  };
  MMMU_VAL?: { Overall?: number; [key: string]: unknown };
  MMBench_TEST_EN_V11?: { Overall?: number; [key: string]: unknown };
  OCRBench?: { "Final Score"?: number; [key: string]: unknown };
  AI2D?: { Overall?: number; [key: string]: unknown };
  MathVista?: { Overall?: number; [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * Fetch VLM benchmark scores from OpenCompass leaderboard.
 * Returns a Map of normalized model names → VLM benchmark scores.
 * Data source: ~284 models, ~6.5MB JSON.
 */
export async function fetchVlmScores(
  cache: InMemoryCache
): Promise<Map<string, VlmEntry>> {
  const cached = cache.get<Map<string, VlmEntry>>(CACHE_KEY);
  if (cached) return cached;

  const stale = cache.getStaleOrNull<Map<string, VlmEntry>>(CACHE_KEY);

  try {
    const response = await fetch(API_URL, {
      signal: AbortSignal.timeout(30_000), // 30s — file is ~6.5MB
    });

    if (!response.ok) {
      throw new Error(`OpenCompass VLM API returned ${response.status}`);
    }

    const data = (await response.json()) as OpenVlmResponse;

    if (!data.results || typeof data.results !== "object") {
      throw new Error("Invalid OpenCompass VLM response: no results");
    }

    const scores = new Map<string, VlmEntry>();

    for (const [modelName, modelData] of Object.entries(data.results)) {
      const mmmu = extractScore(modelData.MMMU_VAL, "Overall");
      const mmBench = extractScore(modelData.MMBench_TEST_EN_V11, "Overall");
      // OCRBench is on 0-1000 scale; normalize to 0-100 for consistency
      const ocrRaw = extractScore(modelData.OCRBench, "Final Score");
      const ocrBench = ocrRaw !== undefined ? ocrRaw / 10 : undefined;
      const ai2d = extractScore(modelData.AI2D, "Overall");
      const mathVista = extractScore(modelData.MathVista, "Overall");

      // Skip models with no benchmark data at all
      if (
        mmmu === undefined &&
        mmBench === undefined &&
        ocrBench === undefined &&
        ai2d === undefined &&
        mathVista === undefined
      ) {
        continue;
      }

      const displayName = extractDisplayName(modelData.META?.Method, modelName);
      const org = modelData.META?.Org;

      scores.set(normalizeVlmName(displayName), {
        name: displayName,
        mmmu,
        mmBench,
        ocrBench,
        ai2d,
        mathVista,
        organization: typeof org === "string" ? org : undefined,
      });
    }

    cache.set(CACHE_KEY, scores, TTL, "opencompass");
    return scores;
  } catch (error) {
    if (stale) return stale.data;
    return new Map();
  }
}

// ============================================================
// Helpers
// ============================================================

/** Extract a numeric score from a benchmark object */
function extractScore(
  benchData: unknown,
  scoreKey: string
): number | undefined {
  if (!benchData || typeof benchData !== "object") return undefined;
  const obj = benchData as Record<string, unknown>;
  const val = obj[scoreKey];
  if (typeof val === "number" && val > 0) return val;
  if (typeof val === "string") {
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

/**
 * Extract display name from META.Method field.
 * Method can be ["ModelName", "url"] or just "ModelName".
 */
function extractDisplayName(
  method: [string, string?] | string | unknown,
  fallback: string
): string {
  if (Array.isArray(method) && method.length > 0 && typeof method[0] === "string") {
    return method[0];
  }
  if (typeof method === "string") return method;
  return fallback;
}

/** Normalize VLM model names for matching */
function normalizeVlmName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
