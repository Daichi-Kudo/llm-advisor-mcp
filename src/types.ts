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
  sweBenchLite?: number;
  humanEval?: number;
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
  /** ISO 8601 timestamp of last data update */
  lastUpdated: string;
}

// ============================================================
// Tool parameter types
// ============================================================

export type UseCase =
  | "coding"
  | "math"
  | "general"
  | "vision"
  | "creative"
  | "reasoning"
  | "cost-effective";

export type ModelCategory =
  | "coding"
  | "math"
  | "vision"
  | "general"
  | "cost-effective"
  | "open-source"
  | "speed"
  | "context-window"
  | "reasoning";

export type ApiExampleFormat = "openai_sdk" | "curl" | "python_requests";

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

// ============================================================
// Scoring types
// ============================================================

export interface ScoringWeights {
  benchmarkWeight: number;
  priceWeight: number;
  speedWeight: number;
  primaryBenchmarks: (keyof BenchmarkScores)[];
}
