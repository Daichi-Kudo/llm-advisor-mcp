import type { InMemoryCache } from "../cache.js";
import { SERVER_NAME, SERVER_VERSION } from "../../metadata.js";
import { normalizeForIndex } from "../normalizer.js";
import { readResponseText } from "./http.js";

const API_URL = "https://gorilla.cs.berkeley.edu/leaderboard.html";
const CACHE_KEY = "bfcl:v4";
const TTL = 6 * 60 * 60 * 1000; // 6 hours
const MAX_RESPONSE_BYTES = 500 * 1024;
const MAX_STALE_MS = 24 * 60 * 60 * 1000;

export interface BfclEntry {
  name: string;
  overall: number;
  agentic?: number;
  multiTurn?: number;
  singleTurn?: number;
  cost?: number;
}

/**
 * Fetch BFCL V4 leaderboard scores from the Berkeley Function Calling Leaderboard.
 * Scrapes the HTML table at gorilla.cs.berkeley.edu/leaderboard.html.
 * Returns a Map of normalized model names → BFCL scores.
 */
export async function fetchBfclScores(
  cache: InMemoryCache
): Promise<Map<string, BfclEntry>> {
  const cached = cache.get<Map<string, BfclEntry>>(CACHE_KEY);
  if (cached) return cached;

  const stale = cache.getStaleOrNull<Map<string, BfclEntry>>(CACHE_KEY, MAX_STALE_MS);

  try {
    const response = await fetch(API_URL, {
      headers: {
        "User-Agent": `${SERVER_NAME}/${SERVER_VERSION}`,
        "Accept": "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`BFCL page returned ${response.status}`);
    }

    const html = await readResponseText(response, MAX_RESPONSE_BYTES, "BFCL");

    const scores = parseBfclTable(html);

    if (scores.size === 0) {
      throw new Error("BFCL table parsing returned no entries");
    }

    cache.set(CACHE_KEY, scores, TTL, "bfcl");
    return scores;
  } catch (error) {
    console.error(`BFCL fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    if (stale) return stale.data;
    return new Map();
  }
}

/**
 * Parse the BFCL V4 HTML leaderboard table.
 * The table has columns: Rank, Overall, Model, Cost, Latency.
 * We extract: model name (text from the <a> tag), overall score, and optionally
 * sub-scores from the model detail row if present.
 */
export function parseBfclTable(html: string): Map<string, BfclEntry> {
  const scores = new Map<string, BfclEntry>();

  // Find the leaderboard table
  const tableMatch = html.match(/<table[^>]*>[\s\S]*?<\/table>/i);
  if (!tableMatch) return scores;

  const table = tableMatch[0];

  // Find all data rows (skip header row)
  // Pattern: <tr><td>Rank</td><td>Overall%</td><td>Model name (with optional link)</td><td>Cost</td>...
  const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(table)) !== null) {
    const row = rowMatch[0];

    // Skip header rows
    if (row.includes("<th") || row.includes("Overall Acc")) continue;

    // Extract cells
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    if (!cells || cells.length < 3) continue;

    // Extract overall accuracy — try column 2 (second cell, 0-indexed)
    const overallCell = stripTags(cells[1] ?? "").trim();
    const overall = parseScore(overallCell);
    if (overall === undefined) continue;

    // Extract model name — column 3
    const modelCell = cells[2] ?? "";
    const modelLink = modelCell.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
    const modelName = modelLink
      ? stripTags(modelLink[1]).trim()
      : stripTags(modelCell).trim();

    if (!modelName || modelName.length < 2) continue;

    // Skip aggregate/header rows like "Overall Average"
    if (/overall|average|rank|model/i.test(modelName) && modelName.length > 15) continue;

    // Extract cost — column 4 (if available)
    let cost: number | undefined;
    if (cells.length >= 4) {
      cost = parseScore(stripTags(cells[3]).trim());
    }

    scores.set(normalizeForIndex(modelName), {
      name: modelName,
      overall,
      cost,
    });
  }

  return scores;
}

function parseScore(text: string): number | undefined {
  // Remove % and non-numeric chars except decimal
  const cleaned = text.replace(/[^0-9.]/g, "");
  if (!cleaned) return undefined;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * @internal Exported for parser regression tests only.
 */
export { readResponseText } from "./http.js";
