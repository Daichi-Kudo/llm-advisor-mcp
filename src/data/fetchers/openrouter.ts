import type { OpenRouterResponse, UnifiedModel } from "../../types.js";
import { InMemoryCache } from "../cache.js";
import { SERVER_NAME, SERVER_VERSION } from "../../metadata.js";

const API_URL = "https://openrouter.ai/api/v1/models";
const CACHE_KEY = "openrouter:models";
const TTL = 60 * 60 * 1000; // 1 hour

export async function fetchOpenRouterModels(
  cache: InMemoryCache
): Promise<UnifiedModel[]> {
  // Check cache first
  const cached = cache.get<UnifiedModel[]>(CACHE_KEY);
  if (cached) return cached;

  // Check stale cache (use while fetching fails)
  const stale = cache.getStaleOrNull<UnifiedModel[]>(CACHE_KEY);

  try {
    const response = await fetch(API_URL, {
      headers: {
        "Accept": "application/json",
        "User-Agent": `${SERVER_NAME}/${SERVER_VERSION}`,
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API returned ${response.status}`);
    }

    const data = (await response.json()) as OpenRouterResponse;
    if (!data || !Array.isArray(data.data)) {
      throw new Error("Invalid OpenRouter API response: missing data array");
    }
    const models = data.data
      .filter((m) => {
        // Exclude free models (both prices "0")
        if (m.pricing.prompt === "0" && m.pricing.completion === "0") return false;
        // Exclude OpenRouter meta-models (virtual routing models with negative/invalid pricing)
        if (m.id.startsWith("openrouter/")) return false;
        // Exclude models with negative pricing
        const prompt = parseFloat(m.pricing.prompt ?? "0");
        const completion = parseFloat(m.pricing.completion ?? "0");
        if (prompt < 0 || completion < 0) return false;
        return true;
      })
      .map(transformModel);

    if (models.length === 0) {
      throw new Error("OpenRouter API returned no usable paid models");
    }

    cache.set(CACHE_KEY, models, TTL, "openrouter");
    return models;
  } catch (error) {
    console.error(`OpenRouter fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    // Return stale data if available
    if (stale) return stale.data;
    throw error;
  }
}

function transformModel(raw: OpenRouterResponse["data"][0]): UnifiedModel {
  const perTokenToPerMillion = (s: string | undefined): number | undefined => {
    if (!s || s === "0") return undefined;
    const n = parseFloat(s.replace(/,/g, ""));
    return isNaN(n) ? undefined : n * 1_000_000;
  };

  const inputPrice = perTokenToPerMillion(raw.pricing.prompt) ?? 0;
  const outputPrice = perTokenToPerMillion(raw.pricing.completion) ?? 0;

  // Extract provider and family from ID (e.g., "anthropic/claude-sonnet-4.6")
  const [provider, ...rest] = raw.id.split("/");
  const modelSlug = rest.join("/");
  const family = extractFamily(modelSlug);

  return {
    id: raw.id,
    slug: raw.id.toLowerCase().replace(/[^a-z0-9/\-]/g, ""),
    name: raw.name,
    pricing: {
      input: inputPrice,
      output: outputPrice,
      request: normalizeOptionalPositiveNumber(raw.pricing.request),
      cacheRead: perTokenToPerMillion(raw.pricing.input_cache_read),
      cacheWrite: perTokenToPerMillion(raw.pricing.input_cache_write),
      image: perTokenToPerMillion(raw.pricing.image),
      reasoning: perTokenToPerMillion(raw.pricing.internal_reasoning),
    },
    benchmarks: {},
    capabilities: {
      contextLength: normalizePositiveNumber(raw.context_length),
      maxOutputTokens: normalizeOptionalPositiveNumber(raw.top_provider?.max_completion_tokens),
      inputModalities: raw.architecture?.input_modalities ?? ["text"],
      outputModalities: raw.architecture?.output_modalities ?? ["text"],
      supportsTools: raw.supported_parameters?.includes("tools") ?? false,
      supportsStreaming: true,
      supportsReasoning: raw.supported_parameters?.includes("reasoning") ?? false,
    },
    metadata: {
      provider,
      family,
      isOpenSource: isOpenSource(raw.id),
      releaseDate: raw.created
        ? new Date(raw.created * 1000).toISOString().split("T")[0]
        : undefined,
    },
    percentiles: {},
    lastUpdated: new Date().toISOString(),
  };
}

function normalizePositiveNumber(value: unknown): number {
  return normalizeOptionalPositiveNumber(value) ?? 0;
}

function normalizeOptionalPositiveNumber(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function extractFamily(slug: string): string {
  // claude-sonnet-4.6 → claude
  // gpt-5.1 → gpt
  // gemini-3.1-pro → gemini
  const match = slug.match(/^([a-z]+)/);
  return match?.[1] ?? slug;
}

const OPEN_SOURCE_PROVIDERS = new Set([
  "meta-llama",
  "mistralai",
  "qwen",
  "deepseek",
  "microsoft", // phi
  "nvidia",
  "zhipuai",
  "01-ai",
  "allenai",
  "cognitivecomputations",
  "databricks",
  "inception",
  "internlm",
  "nousresearch",
  "perplexity",
  "snowflake",
  "teknium",
  "tngtech",
  "x-ai", // Grok 1 only; proprietary Grok variants are excluded by explicit patterns below.
]);

const OPEN_SOURCE_PATTERNS = [
  /llama/i, /mistral/i, /mixtral/i, /qwen/i, /deepseek/i,
  /gemma/i, /phi-/i, /yi-/i, /command-r/i, /glm/i, /grok-1/i,
];

const PROPRIETARY_PATTERNS = [
  /gemini/i,
  /grok-(?!1(?:\b|-))/i,
];

export function isOpenSource(modelId: string): boolean {
  if (PROPRIETARY_PATTERNS.some((p) => p.test(modelId))) return false;
  const [provider] = modelId.split("/");
  if (OPEN_SOURCE_PROVIDERS.has(provider)) return true;
  return OPEN_SOURCE_PATTERNS.some((p) => p.test(modelId));
}
