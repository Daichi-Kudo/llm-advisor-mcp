// ============================================================
// OpenRouter API response types
// ============================================================

export interface OpenRouterModel {
  id: string;
  name: string;
  created: number;
  context_length: number;
  architecture: {
    modality: string;
    input_modalities: string[];
    output_modalities: string[];
    tokenizer: string;
  };
  pricing: {
    prompt: string;
    completion: string;
    image?: string;
    request?: string;
    input_cache_read?: string;
    input_cache_write?: string;
    internal_reasoning?: string;
  };
  top_provider: {
    context_length: number | null;
    max_completion_tokens: number | null;
    is_moderated: boolean;
  };
  supported_parameters?: string[];
}

export interface OpenRouterResponse {
  data: OpenRouterModel[];
}

// ============================================================
// Unified model types
// ============================================================

export interface ModelPricing {
  /** USD per 1M input tokens */
  input: number;
  /** USD per 1M output tokens */
  output: number;
  /** USD per request */
  request?: number;
  /** USD per 1M cached input tokens */
  cacheRead?: number;
  /** USD per 1M cache write tokens */
  cacheWrite?: number;
  /** USD per image */
  image?: number;
  /** USD per 1M reasoning tokens */
  reasoning?: number;
}

export interface BenchmarkScores {
  // Coding
  sweBenchVerified?: number;
  aiderPolyglot?: number;

  // General
  arenaElo?: number;
  mmluPro?: number;
  gpqaDiamond?: number;

  // Math & Reasoning
  math500?: number;
  aime2024?: number;

  // Vision (VLM)
  mmmu?: number;
  mmBench?: number;
  ocrBench?: number;
  ai2d?: number;
  mathVista?: number;

  // Agentic (BFCL V4)
  bfclV4Overall?: number;
  bfclV4Agentic?: number;
  bfclV4MultiTurn?: number;
  bfclV4SingleTurn?: number;
  bfclV4Cost?: number;

  // Speed
  outputTokensPerSecond?: number;
  timeToFirstToken?: number;
}

export interface ModelCapabilities {
  contextLength: number;
  maxOutputTokens?: number;
  inputModalities: string[];
  outputModalities: string[];
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsReasoning: boolean;
}

/** Speed and latency data for a model. Undefined when no data is available. */
export interface ModelSpeed {
  /** Output tokens per second */
  outputTokensPerSecond?: number;
  /** Time to first token in seconds */
  timeToFirstToken?: number;
}

export interface ModelMetadata {
  provider: string;
  family: string;
  isOpenSource: boolean;
  releaseDate?: string;
}

export interface PercentileRanks {
  coding?: number;
  math?: number;
  general?: number;
  vision?: number;
  costEfficiency?: number;
  speed?: number;
  agentic?: number;
}

export interface UnifiedModel {
  /** OpenRouter canonical ID (e.g. "anthropic/claude-sonnet-4.6") */
  id: string;
  /** Normalized slug for matching */
  slug: string;
  /** Display name */
  name: string;
  pricing: ModelPricing;
  benchmarks: BenchmarkScores;
  capabilities: ModelCapabilities;
  metadata: ModelMetadata;
  percentiles: PercentileRanks;
  /** Speed/latency data (may be sparse) */
  speed: ModelSpeed;
  /** ISO 8601 timestamp of last data update */
  lastUpdated: string;
}

// ============================================================
// Tool parameter types
// ============================================================

export const USE_CASES = [
  "coding",
  "math",
  "general",
  "vision",
  "creative",
  "reasoning",
  "cost-effective",
] as const;

export type UseCase = (typeof USE_CASES)[number];

export const MODEL_CATEGORIES = [
  "coding",
  "math",
  "vision",
  "general",
  "cost-effective",
  "open-source",
  "speed",
  "context-window",
  "reasoning",
  "quality",
] as const;

export type ModelCategory = (typeof MODEL_CATEGORIES)[number];

// ============================================================
// Cache types
// ============================================================

export interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  ttl: number;
  source: string;
  etag?: string;
}
