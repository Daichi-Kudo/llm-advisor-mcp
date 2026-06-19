/**
 * Static per-provider pricing data for popular models.
 *
 * This maps OpenRouter model IDs → prices on different API providers.
 * Prices are in USD per 1M tokens (input / output).
 *
 * Sources: Official provider pricing pages, verified June 2026.
 * Updated with each release.
 */

export interface ProviderPrice {
  input: number;
  output: number;
}

export interface PerProviderPricing {
  /** OpenRouter price (our default) */
  openrouter: ProviderPrice;
  /** Other known providers */
  [provider: string]: ProviderPrice;
}

const PER_PROVIDER_PRICING: Record<string, PerProviderPricing> = {
  // ── Anthropic ──────────────────────────────────────────
  "anthropic/claude-opus-4.8": {
    openrouter: { input: 5.00, output: 25.00 },
    "anthropic-direct": { input: 5.00, output: 25.00 },
    bedrock: { input: 5.50, output: 27.50 },
  },
  "anthropic/claude-sonnet-4.6": {
    openrouter: { input: 3.00, output: 15.00 },
    "anthropic-direct": { input: 3.00, output: 15.00 },
    bedrock: { input: 3.30, output: 16.50 },
    groq: { input: 3.00, output: 15.00 },
  },
  "anthropic/claude-haiku-4.5": {
    openrouter: { input: 1.00, output: 5.00 },
    "anthropic-direct": { input: 1.00, output: 5.00 },
    bedrock: { input: 1.10, output: 5.50 },
  },
  "anthropic/claude-opus-4.6": {
    openrouter: { input: 15.00, output: 75.00 },
    "anthropic-direct": { input: 15.00, output: 75.00 },
    bedrock: { input: 16.50, output: 82.50 },
  },

  // ── OpenAI ─────────────────────────────────────────────
  "openai/gpt-5.5": {
    openrouter: { input: 5.00, output: 30.00 },
    "openai-direct": { input: 5.00, output: 30.00 },
    azure: { input: 5.50, output: 33.00 },
  },
  "openai/gpt-5.4": {
    openrouter: { input: 2.50, output: 10.00 },
    "openai-direct": { input: 2.50, output: 10.00 },
    azure: { input: 2.75, output: 11.00 },
  },
  "openai/gpt-5-mini": {
    openrouter: { input: 0.25, output: 2.00 },
    "openai-direct": { input: 0.25, output: 2.00 },
    azure: { input: 0.28, output: 2.20 },
  },
  "openai/gpt-4.1": {
    openrouter: { input: 2.00, output: 8.00 },
    "openai-direct": { input: 2.00, output: 8.00 },
    bedrock: { input: 2.20, output: 8.80 },
    azure: { input: 2.20, output: 8.80 },
  },
  "openai/o3": {
    openrouter: { input: 10.00, output: 40.00 },
    "openai-direct": { input: 10.00, output: 40.00 },
  },
  "openai/o4-mini": {
    openrouter: { input: 1.10, output: 4.40 },
    "openai-direct": { input: 1.10, output: 4.40 },
  },

  // ── Google ─────────────────────────────────────────────
  "google/gemini-3.1-pro": {
    openrouter: { input: 2.50, output: 15.00 },
    "google-direct": { input: 2.00, output: 12.00 },
    groq: { input: 2.50, output: 15.00 },
  },
  "google/gemini-3-flash": {
    openrouter: { input: 0.30, output: 1.50 },
    "google-direct": { input: 0.25, output: 1.25 },
    groq: { input: 0.30, output: 1.50 },
  },
  "google/gemini-2.5-pro": {
    openrouter: { input: 1.25, output: 10.00 },
    "google-direct": { input: 1.25, output: 10.00 },
  },
  "google/gemini-2.5-flash": {
    openrouter: { input: 0.15, output: 0.60 },
    "google-direct": { input: 0.10, output: 0.40 },
    groq: { input: 0.15, output: 0.60 },
  },

  // ── DeepSeek ───────────────────────────────────────────
  "deepseek/deepseek-v4-pro": {
    openrouter: { input: 0.44, output: 0.87 },
    "deepseek-direct": { input: 0.44, output: 0.87 },
    together: { input: 0.48, output: 0.96 },
    fireworks: { input: 0.44, output: 0.87 },
    deepinfra: { input: 0.44, output: 0.87 },
  },
  "deepseek/deepseek-v4-flash": {
    openrouter: { input: 0.14, output: 0.28 },
    "deepseek-direct": { input: 0.14, output: 0.28 },
    together: { input: 0.15, output: 0.31 },
    fireworks: { input: 0.14, output: 0.28 },
    deepinfra: { input: 0.14, output: 0.28 },
  },
  "deepseek/deepseek-chat": {
    openrouter: { input: 0.27, output: 1.10 },
    "deepseek-direct": { input: 0.27, output: 1.10 },
    groq: { input: 0.30, output: 1.20 },
  },

  // ── Meta / Llama ──────────────────────────────────────
  "meta-llama/llama-4-maverick": {
    openrouter: { input: 0.20, output: 0.60 },
    groq: { input: 0.20, output: 0.60 },
    together: { input: 0.22, output: 0.66 },
    fireworks: { input: 0.20, output: 0.60 },
    deepinfra: { input: 0.20, output: 0.60 },
  },
  "meta-llama/llama-4-scout": {
    openrouter: { input: 0.11, output: 0.34 },
    groq: { input: 0.11, output: 0.34 },
    together: { input: 0.12, output: 0.37 },
    fireworks: { input: 0.11, output: 0.34 },
  },

  // ── Mistral ────────────────────────────────────────────
  "mistralai/mistral-large": {
    openrouter: { input: 2.00, output: 6.00 },
    "mistral-direct": { input: 2.00, output: 6.00 },
    groq: { input: 2.00, output: 6.00 },
  },

  // ── xAI ────────────────────────────────────────────────
  "x-ai/grok-4": {
    openrouter: { input: 5.00, output: 15.00 },
    "xai-direct": { input: 5.00, output: 15.00 },
  },
  "x-ai/grok-4-fast": {
    openrouter: { input: 2.50, output: 7.50 },
    "xai-direct": { input: 2.50, output: 7.50 },
  },

  // ── Z.AI / GLM ────────────────────────────────────────
  "z-ai/glm-5.2": {
    openrouter: { input: 1.72, output: 1.72 },
    "zai-direct": { input: 1.72, output: 1.72 },
  },

  // ── Qwen ───────────────────────────────────────────────
  "qwen/qwen-3.5-plus": {
    openrouter: { input: 0.50, output: 1.50 },
    together: { input: 0.55, output: 1.65 },
    deepinfra: { input: 0.50, output: 1.50 },
  },
  "qwen/qwen-3.7-max": {
    openrouter: { input: 1.25, output: 1.25 },
    together: { input: 1.38, output: 1.38 },
  },

  // ── Cerebras fast models ───────────────────────────────
  "cerebras/gpt-oss-120b": {
    openrouter: { input: 0.10, output: 0.10 },
    cerebras: { input: 0.10, output: 0.10 },
  },
};

export function getPerProviderPricing(): Record<string, PerProviderPricing> {
  return PER_PROVIDER_PRICING;
}

export function getProviderDisplayName(provider: string): string {
  const names: Record<string, string> = {
    openrouter: "OpenRouter",
    "anthropic-direct": "Anthropic Direct",
    "openai-direct": "OpenAI Direct",
    "google-direct": "Google AI Studio",
    "deepseek-direct": "DeepSeek Direct",
    "mistral-direct": "Mistral Direct",
    "xai-direct": "xAI Direct",
    "zai-direct": "Z.AI Direct",
    bedrock: "AWS Bedrock",
    azure: "Azure OpenAI",
    groq: "Groq",
    together: "Together",
    fireworks: "Fireworks",
    deepinfra: "DeepInfra",
    cerebras: "Cerebras",
    sambanova: "SambaNova",
  };
  return names[provider] ?? provider;
}
