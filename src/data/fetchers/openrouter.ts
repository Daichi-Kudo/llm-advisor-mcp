import type { OpenRouterResponse, UnifiedModel } from "../../types.js";
import { InMemoryCache } from "../cache.js";

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
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API returned ${response.status}`);
    }

    const data = (await response.json()) as OpenRouterResponse;
    const models = data.data
      .filter((m) => m.pricing.prompt !== "0" || m.pricing.completion !== "0")
      .map(transformModel);

    cache.set(CACHE_KEY, models, TTL, "openrouter");
    return models;
  } catch (error) {
    // Return stale data if available
    if (stale) return stale.data;
    throw error;
  }
}

function transformModel(raw: OpenRouterResponse["data"][0]): UnifiedModel {
  const perTokenToPerMillion = (s: string | undefined): number | undefined => {
    if (!s || s === "0") return undefined;
    const n = parseFloat(s);
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
      cacheRead: perTokenToPerMillion(raw.pricing.input_cache_read),
      cacheWrite: perTokenToPerMillion(raw.pricing.input_cache_write),
      image: perTokenToPerMillion(raw.pricing.image),
      reasoning: perTokenToPerMillion(raw.pricing.internal_reasoning),
    },
    benchmarks: {},
    capabilities: {
      contextLength: raw.context_length,
      maxOutputTokens: raw.top_provider.max_completion_tokens ?? undefined,
      inputModalities: raw.architecture.input_modalities ?? ["text"],
      outputModalities: raw.architecture.output_modalities ?? ["text"],
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
  "google",  // gemma
  "microsoft",  // phi
  "nvidia",
  "zhipuai",
]);

const OPEN_SOURCE_PATTERNS = [
  /llama/i, /mistral/i, /mixtral/i, /qwen/i, /deepseek/i,
  /gemma/i, /phi-/i, /yi-/i, /command-r/i, /glm/i,
];

function isOpenSource(modelId: string): boolean {
  const [provider] = modelId.split("/");
  if (OPEN_SOURCE_PROVIDERS.has(provider)) return true;
  return OPEN_SOURCE_PATTERNS.some((p) => p.test(modelId));
}
