import type { InMemoryCache } from "../cache.js";

const ARENA_URL = "https://arena.ai/leaderboard/text";
const HF_FALLBACK_URL =
  "https://datasets-server.huggingface.co/rows?dataset=mathewhe/chatbot-arena-elo&config=default&split=train&offset=0&length=100";
const CACHE_KEY = "arena:elo";
const TTL = 6 * 60 * 60 * 1000; // 6 hours

export interface ArenaEntry {
  name: string;
  arenaScore: number;
  ciLower?: number;
  ciUpper?: number;
  votes?: number;
  organization?: string;
  rank?: number;
}

// ============================================================
// arena.ai RSC entry type
// ============================================================

interface ArenaRscEntry {
  modelDisplayName?: string;
  rating?: number;
  ratingLower?: number;
  ratingUpper?: number;
  votes?: number;
  modelOrganization?: string;
  rank?: number;
}

// ============================================================
// HuggingFace datasets-server types
// ============================================================

interface HfRow {
  row: {
    Model?: string;
    "Arena Score"?: number;
    "95% CI"?: string;
    Votes?: number;
    Organization?: string;
    "Rank* (UB)"?: number;
    [key: string]: unknown;
  };
}

interface HfResponse {
  rows: HfRow[];
  num_rows_total: number;
}

/**
 * Fetch LM Arena / Arena scores.
 * Primary: arena.ai RSC embedded data (real-time, 314+ models).
 * Fallback: HuggingFace datasets-server (stable but may be stale).
 */
export async function fetchArenaScores(
  cache: InMemoryCache
): Promise<Map<string, ArenaEntry>> {
  const cached = cache.get<Map<string, ArenaEntry>>(CACHE_KEY);
  if (cached) return cached;

  const stale = cache.getStaleOrNull<Map<string, ArenaEntry>>(CACHE_KEY);

  try {
    // Try primary source first
    const result = await fetchFromArenaAi();
    if (result.size > 0) {
      cache.set(CACHE_KEY, result, TTL, "arena.ai");
      return result;
    }

    // Fall back to HuggingFace datasets-server
    const fallback = await fetchFromHuggingFace();
    if (fallback.size > 0) {
      cache.set(CACHE_KEY, fallback, TTL, "hf-datasets");
      return fallback;
    }

    throw new Error("Both Arena sources returned empty data");
  } catch (error) {
    if (stale) return stale.data;
    return new Map();
  }
}

// ============================================================
// Primary: arena.ai RSC embedded data
// ============================================================

async function fetchFromArenaAi(): Promise<Map<string, ArenaEntry>> {
  const response = await fetch(ARENA_URL, {
    signal: AbortSignal.timeout(20_000),
    headers: {
      "User-Agent": "llm-advisor-mcp/0.2.0",
      Accept: "text/html",
    },
  });

  if (!response.ok) {
    throw new Error(`arena.ai returned ${response.status}`);
  }

  const html = await response.text();

  // arena.ai uses React Server Components (RSC) streaming.
  // Leaderboard data is embedded in self.__next_f.push([1,"b:..."]) chunks.
  const rscMatch = html.match(
    /self\.__next_f\.push\(\[1,"b:(.+?)"\]\)/s
  );
  if (!rscMatch) {
    throw new Error("Could not find RSC leaderboard data in arena.ai response");
  }

  // Unescape the RSC string (escaped JSON inside a JS string literal)
  let raw = rscMatch[1];
  raw = raw.replace(/\\"/g, '"');
  raw = raw.replace(/\\n/g, "\n");
  raw = raw.replace(/\\\\/g, "\\");

  // Extract the "entries" JSON array from the unescaped RSC payload
  const entriesIdx = raw.indexOf('"entries":[');
  if (entriesIdx === -1) {
    throw new Error("No entries array found in arena.ai RSC data");
  }

  // Find the matching closing bracket
  const arrayStart = raw.indexOf("[", entriesIdx);
  let depth = 0;
  let arrayEnd = -1;
  for (let i = arrayStart; i < raw.length; i++) {
    if (raw[i] === "[") depth++;
    if (raw[i] === "]") depth--;
    if (depth === 0) {
      arrayEnd = i + 1;
      break;
    }
  }
  if (arrayEnd === -1) {
    throw new Error("Malformed entries array in arena.ai RSC data");
  }

  const entries = JSON.parse(
    raw.substring(arrayStart, arrayEnd)
  ) as ArenaRscEntry[];

  const scores = new Map<string, ArenaEntry>();

  for (const entry of entries) {
    const name = entry.modelDisplayName;
    const rating = entry.rating;
    if (!name || typeof rating !== "number" || rating <= 0) continue;

    scores.set(normalizeArenaName(name), {
      name,
      arenaScore: Math.round(rating),
      ciLower: entry.ratingLower ? Math.round(entry.ratingLower) : undefined,
      ciUpper: entry.ratingUpper ? Math.round(entry.ratingUpper) : undefined,
      votes: entry.votes,
      organization: entry.modelOrganization ?? undefined,
      rank: entry.rank,
    });
  }

  return scores;
}

// ============================================================
// Fallback: HuggingFace datasets-server
// ============================================================

async function fetchFromHuggingFace(): Promise<Map<string, ArenaEntry>> {
  const scores = new Map<string, ArenaEntry>();

  // Fetch first 100 rows
  const first = await fetchHfPage(0);
  for (const entry of first.entries) {
    scores.set(normalizeArenaName(entry.name), entry);
  }

  // Fetch remaining rows if needed
  if (first.total > 100) {
    const pages = Math.ceil(first.total / 100);
    for (let page = 1; page < pages && page < 5; page++) {
      const next = await fetchHfPage(page * 100);
      for (const entry of next.entries) {
        scores.set(normalizeArenaName(entry.name), entry);
      }
    }
  }

  return scores;
}

async function fetchHfPage(
  offset: number
): Promise<{ entries: ArenaEntry[]; total: number }> {
  const url = `${HF_FALLBACK_URL.replace("offset=0", `offset=${offset}`)}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`HF datasets-server returned ${response.status}`);
  }

  const data = (await response.json()) as HfResponse;
  const entries: ArenaEntry[] = [];

  for (const row of data.rows) {
    const r = row.row;
    const name = r.Model;
    const score = r["Arena Score"];
    if (!name || typeof score !== "number") continue;

    // Parse CI: "(-12, +8)" or similar
    let ciLower: number | undefined;
    let ciUpper: number | undefined;
    if (r["95% CI"]) {
      const ciMatch = String(r["95% CI"]).match(
        /(-?\d+\.?\d*)\s*,\s*\+?(-?\d+\.?\d*)/
      );
      if (ciMatch) {
        ciLower = score + parseFloat(ciMatch[1]);
        ciUpper = score + parseFloat(ciMatch[2]);
      }
    }

    entries.push({
      name,
      arenaScore: Math.round(score),
      ciLower,
      ciUpper,
      votes: typeof r.Votes === "number" ? r.Votes : undefined,
      organization: typeof r.Organization === "string" ? r.Organization : undefined,
      rank: typeof r["Rank* (UB)"] === "number" ? r["Rank* (UB)"] : undefined,
    });
  }

  return { entries, total: data.num_rows_total };
}

// ============================================================
// Name normalization
// ============================================================

/**
 * Normalize Arena model names for matching:
 * "Claude 4.5 Opus" → "claude-4.5-opus"
 * "GPT-5.1-turbo" → "gpt-5.1-turbo"
 */
function normalizeArenaName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
