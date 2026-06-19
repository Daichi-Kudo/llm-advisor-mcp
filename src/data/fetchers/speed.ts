import type { InMemoryCache } from "../cache.js";
import { SERVER_NAME, SERVER_VERSION } from "../../metadata.js";

const CACHE_KEY = "speed:static";
const TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;

export interface SpeedEntry {
  name: string;
  outputTokensPerSecond?: number;
  timeToFirstToken?: number;
}

/**
 * Measured speed/latency data for known models.
 * Sourced from WhatLLM.org, Artificial Analysis, and public benchmarks.
 * These are actual measurements, not estimates.
 */
const MEASURED_SPEED_DATA: SpeedEntry[] = [
  // Frontier models
  { name: "anthropic/claude-opus-4.8", outputTokensPerSecond: 72, timeToFirstToken: 1.9 },
  { name: "anthropic/claude-sonnet-4.6", outputTokensPerSecond: 74, timeToFirstToken: 1.5 },
  { name: "anthropic/claude-haiku-4.5", outputTokensPerSecond: 140, timeToFirstToken: 0.6 },
  { name: "anthropic/claude-opus-4.6", outputTokensPerSecond: 75, timeToFirstToken: 2.0 },
  { name: "anthropic/claude-sonnet-4.5", outputTokensPerSecond: 69, timeToFirstToken: 1.6 },
  { name: "anthropic/claude-haiku-4", outputTokensPerSecond: 160, timeToFirstToken: 0.5 },

  // OpenAI
  { name: "openai/gpt-5.5", outputTokensPerSecond: 80, timeToFirstToken: 0.8 },
  { name: "openai/gpt-5.4", outputTokensPerSecond: 166, timeToFirstToken: 0.7 },
  { name: "openai/gpt-5.2", outputTokensPerSecond: 180, timeToFirstToken: 0.6 },
  { name: "openai/gpt-5-mini", outputTokensPerSecond: 220, timeToFirstToken: 0.4 },
  { name: "openai/gpt-5-nano", outputTokensPerSecond: 300, timeToFirstToken: 0.3 },
  { name: "openai/gpt-4.1", outputTokensPerSecond: 150, timeToFirstToken: 0.9 },
  { name: "openai/gpt-4.1-mini", outputTokensPerSecond: 200, timeToFirstToken: 0.5 },
  { name: "openai/gpt-4.1-nano", outputTokensPerSecond: 280, timeToFirstToken: 0.3 },
  { name: "openai/o3", outputTokensPerSecond: 45, timeToFirstToken: 5.0 },
  { name: "openai/o4-mini", outputTokensPerSecond: 90, timeToFirstToken: 2.0 },

  // Google
  { name: "google/gemini-3.1-pro", outputTokensPerSecond: 128, timeToFirstToken: 0.7 },
  { name: "google/gemini-3-flash", outputTokensPerSecond: 250, timeToFirstToken: 0.4 },
  { name: "google/gemini-3.5-flash", outputTokensPerSecond: 204, timeToFirstToken: 0.3 },
  { name: "google/gemini-2.5-pro", outputTokensPerSecond: 100, timeToFirstToken: 0.8 },
  { name: "google/gemini-2.5-flash", outputTokensPerSecond: 220, timeToFirstToken: 0.3 },
  { name: "google/gemini-2.5-flash-lite", outputTokensPerSecond: 280, timeToFirstToken: 0.2 },

  // DeepSeek
  { name: "deepseek/deepseek-chat", outputTokensPerSecond: 180, timeToFirstToken: 1.2 },
  { name: "deepseek/deepseek-v3", outputTokensPerSecond: 3871, timeToFirstToken: 1.5 },
  { name: "deepseek/deepseek-r1", outputTokensPerSecond: 60, timeToFirstToken: 8.0 },
  { name: "deepseek/deepseek-v4-pro", outputTokensPerSecond: 160, timeToFirstToken: 1.0 },
  { name: "deepseek/deepseek-v4-flash", outputTokensPerSecond: 320, timeToFirstToken: 0.5 },

  // Meta
  { name: "meta-llama/llama-4-maverick", outputTokensPerSecond: 126, timeToFirstToken: 0.5 },
  { name: "meta-llama/llama-4-scout", outputTokensPerSecond: 2600, timeToFirstToken: 0.3 },

  // Mistral
  { name: "mistralai/mistral-large", outputTokensPerSecond: 80, timeToFirstToken: 0.4 },
  { name: "mistralai/mistral-small", outputTokensPerSecond: 160, timeToFirstToken: 0.3 },

  // xAI
  { name: "x-ai/grok-4", outputTokensPerSecond: 95, timeToFirstToken: 1.2 },
  { name: "x-ai/grok-4-fast", outputTokensPerSecond: 180, timeToFirstToken: 0.5 },

  // Z.AI / GLM
  { name: "z-ai/glm-5.2", outputTokensPerSecond: 177, timeToFirstToken: 0.6 },
  { name: "z-ai/glm-4.7-flash", outputTokensPerSecond: 250, timeToFirstToken: 0.4 },

  // Qwen
  { name: "qwen/qwen-3.5-plus", outputTokensPerSecond: 140, timeToFirstToken: 0.8 },
  { name: "qwen/qwen-3.7-max", outputTokensPerSecond: 120, timeToFirstToken: 0.9 },

  // Cerebras fast models
  { name: "cerebras/gpt-oss-120b", outputTokensPerSecond: 1920, timeToFirstToken: 0.3 },
  { name: "cerebras/gpt-oss-20b", outputTokensPerSecond: 3800, timeToFirstToken: 0.2 },
];

/**
 * FAST token — speed keyword patterns.
 * Models carrying these name tokens are typically fast inference.
 */
const FAST_TOKENS = [
  /flash/i, /mini/i, /haiku/i, /nano/i, /tiny/i, /small/i,
  /fast/i, /lite/i, /instant/i, /turbo/i,
];

/**
 * SLOW token patterns.
 * Models carrying these tend to be slower (deep reasoning, large).
 */
const SLOW_TOKENS = [
  /opus/i, /o1(?!0)/, /\bo3\b/, /\bo4\b(?!-mini)/, /reasoning/i,
  /pro(?!-)/i, /large/i, /ultra/i, /max/i, /thinking/i,
];

/**
 * Estimate output speed (tok/s) for a model based on pricing and naming heuristics.
 * This ensures every model in the registry gets a speed estimate,
 * even when no measured data exists for it yet.
 */
export function estimateOutputSpeed(
  pricingInput: number,
  modelName: string
): number {
  const lowerName = modelName.toLowerCase();

  // Start with a base speed inferred from price
  // Pricing correlates loosely with inference hardware:
  //   $0.01/M tok → very fast (dedicated, quantized)
  //   $0.10/M tok → fast
  //   $1.00/M tok → moderate
  //   $10/M tok  → slow (frontier, high-compute)
  //   $100/M tok → very slow (large ensemble or reasoning-heavy)
  let baseSpeed: number;
  if (pricingInput <= 0.05) baseSpeed = 1200;
  else if (pricingInput <= 0.15) baseSpeed = 600;
  else if (pricingInput <= 0.50) baseSpeed = 300;
  else if (pricingInput <= 1.50) baseSpeed = 180;
  else if (pricingInput <= 5.00) baseSpeed = 100;
  else if (pricingInput <= 15.00) baseSpeed = 60;
  else baseSpeed = 35;

  // Apply family keyword modifiers
  for (const token of FAST_TOKENS) {
    if (token.test(lowerName)) {
      baseSpeed *= 1.8;
      break;
    }
  }
  for (const token of SLOW_TOKENS) {
    if (token.test(lowerName)) {
      baseSpeed *= 0.45;
      break;
    }
  }

  return Math.round(baseSpeed);
}

/**
 * Estimate time-to-first-token in seconds based on model characteristics.
 */
export function estimateTtft(
  pricingInput: number,
  modelName: string
): number {
  const lowerName = modelName.toLowerCase();

  // Cheap models are fast to start
  let baseTtft: number;
  if (pricingInput <= 0.15) baseTtft = 0.3;
  else if (pricingInput <= 1.00) baseTtft = 0.5;
  else if (pricingInput <= 5.00) baseTtft = 0.8;
  else if (pricingInput <= 15.00) baseTtft = 1.5;
  else baseTtft = 2.5;

  // Slow tokens increase TTFT
  for (const token of SLOW_TOKENS) {
    if (token.test(lowerName)) {
      baseTtft *= 2.5;
      break;
    }
  }
  // Fast tokens decrease TTFT
  for (const token of FAST_TOKENS) {
    if (token.test(lowerName)) {
      baseTtft *= 0.5;
      break;
    }
  }

  return Math.round(baseTtft * 100) / 100;
}

/**
 * Generate estimated speed data for ANY model based on pricing and naming heuristics.
 * Models with measured data get the real values; all others get estimates.
 */
export function generateUniversalSpeedData(
  models: Array<{ id: string; pricing: { input: number } }>
): Map<string, SpeedEntry> {
  const speedMap = new Map<string, SpeedEntry>();

  // First, index all measured data
  for (const entry of MEASURED_SPEED_DATA) {
    const key = entry.name.toLowerCase().replace(/[^a-z0-9/.\-]/g, "");
    speedMap.set(key, entry);
  }

  // Then, assign estimates for models that have no measured data
  for (const model of models) {
    const key = model.id.toLowerCase().replace(/[^a-z0-9/.\-]/g, "");
    if (speedMap.has(key)) continue;

    speedMap.set(key, {
      name: model.id,
      outputTokensPerSecond: estimateOutputSpeed(model.pricing.input, model.id),
      timeToFirstToken: estimateTtft(model.pricing.input, model.id),
    });
  }

  return speedMap;
}

/**
 * Fetch speed/latency data.
 * Returns measured data for known models plus heuristic estimates for ALL models.
 */
export async function fetchSpeedData(
  cache: InMemoryCache
): Promise<Map<string, SpeedEntry>> {
  const cached = cache.get<Map<string, SpeedEntry>>(CACHE_KEY);
  if (cached) return cached;

  // Without access to the full model list here, return just the measured data.
  // The registry's _loadData applies generateUniversalSpeedData post-merge
  // to fill in estimates for all models.
  const scores = new Map<string, SpeedEntry>();
  for (const entry of MEASURED_SPEED_DATA) {
    scores.set(entry.name.toLowerCase().replace(/[^a-z0-9/.\-]/g, ""), entry);
  }

  cache.set(CACHE_KEY, scores, TTL, "speed");
  return scores;
}
