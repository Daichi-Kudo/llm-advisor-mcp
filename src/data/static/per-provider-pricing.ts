/**
 * Per-provider pricing data.
 *
 * Uses known prices for popular models AND auto-estimates for ANY model
 * based on provider-specific markup patterns. This ensures every model
 * in the registry gets at least estimated per-provider pricing.
 *
 * Real data takes priority; estimates fill the gaps for new models.
 */

export interface ProviderPrice {
  input: number;
  output: number;
}

export interface PerProviderPricing {
  openrouter: ProviderPrice;
  [provider: string]: ProviderPrice;
}

/**
 * Known per-provider pricing for models with verified data.
 * These override any auto-estimated values.
 */
const KNOWN_PRICING: Record<string, PerProviderPricing> = {
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
  "openai/gpt-5.5": {
    openrouter: { input: 5.00, output: 30.00 },
    "openai-direct": { input: 5.00, output: 30.00 },
    azure: { input: 5.50, output: 33.00 },
  },
  "openai/gpt-4.1": {
    openrouter: { input: 2.00, output: 8.00 },
    "openai-direct": { input: 2.00, output: 8.00 },
    bedrock: { input: 2.20, output: 8.80 },
    azure: { input: 2.20, output: 8.80 },
  },
  "google/gemini-3.1-pro": {
    openrouter: { input: 2.50, output: 15.00 },
    "google-direct": { input: 2.00, output: 12.00 },
    groq: { input: 2.50, output: 15.00 },
  },
  "meta-llama/llama-4-maverick": {
    openrouter: { input: 0.20, output: 0.60 },
    groq: { input: 0.20, output: 0.60 },
    together: { input: 0.22, output: 0.66 },
    fireworks: { input: 0.20, output: 0.60 },
    deepinfra: { input: 0.20, output: 0.60 },
  },
};

/**
 * Estimate pricing for a model on alternative providers based on its OpenRouter price.
 * Uses known markup patterns per provider.
 *
 * Provider markup patterns:
 * - Direct (anthropic/openai/google): same as OpenRouter (OpenRouter is a router, same API pricing)
 * - Bedrock: ~10% markup on Anthropic models
 * - Azure: ~10% markup on OpenAI models
 * - Groq: same as OpenRouter (competitive pricing)
 * - Together/Fireworks/DeepInfra: typically same or slightly more than OpenRouter
 */
function estimatePricing(
  inputPrice: number,
  outputPrice: number,
  provider: string
): PerProviderPricing {
  const result: PerProviderPricing = {
    openrouter: { input: inputPrice, output: outputPrice },
  };

  // Direct providers — typically same as OpenRouter since OpenRouter is a router
  const directKey = getDirectProviderKey(provider);
  if (directKey) {
    result[directKey] = { input: inputPrice, output: outputPrice };
  }

  // Bedrock — ~10% markup on OpenRouter (known pattern for Anthropic/OpenAI models)
  if (["anthropic", "openai"].includes(provider)) {
    result["bedrock"] = {
      input: roundPrice(inputPrice * 1.10),
      output: roundPrice(outputPrice * 1.10),
    };
  }

  // Azure — ~10% markup (for OpenAI models)
  if (provider === "openai") {
    result["azure"] = {
      input: roundPrice(inputPrice * 1.10),
      output: roundPrice(outputPrice * 1.10),
    };
  }

  // Groq — typically competitive with OpenRouter
  result["groq"] = { input: inputPrice, output: outputPrice };

  // Together — typically ~5-10% more
  result["together"] = {
    input: roundPrice(inputPrice * 1.05),
    output: roundPrice(outputPrice * 1.05),
  };

  // Fireworks — typically competitive
  result["fireworks"] = { input: inputPrice, output: outputPrice };

  // DeepInfra — typically competitive
  result["deepinfra"] = { input: inputPrice, output: outputPrice };

  // Cerebras — typically cheaper
  result["cerebras"] = {
    input: roundPrice(inputPrice * 0.90),
    output: roundPrice(outputPrice * 0.90),
  };

  // Google AI Studio direct
  if (provider === "google") {
    result["google-direct"] = {
      input: roundPrice(inputPrice * 0.80),
      output: roundPrice(outputPrice * 0.80),
    };
  }

  return result;
}

function roundPrice(p: number): number {
  return Math.round(p * 100) / 100;
}

function getDirectProviderKey(provider: string): string | null {
  const map: Record<string, string> = {
    anthropic: "anthropic-direct",
    openai: "openai-direct",
    google: "google-direct",
    deepseek: "deepseek-direct",
    mistralai: "mistral-direct",
    "x-ai": "xai-direct",
    "z-ai": "zai-direct",
  };
  return map[provider] ?? null;
}

/**
 * Get per-provider pricing for a specific model.
 * Uses known data if available; auto-estimates for any unrecognized model.
 */
export function getPerProviderPricing(
  modelId: string,
  openrouterInput: number,
  openrouterOutput: number
): PerProviderPricing | null {
  // Return null for free models (can't estimate)
  if (openrouterInput <= 0 && openrouterOutput <= 0) return null;

  // Use known pricing if available
  if (KNOWN_PRICING[modelId]) {
    return KNOWN_PRICING[modelId];
  }

  // Auto-estimate for ANY model
  const [provider] = modelId.split("/");
  return estimatePricing(openrouterInput, openrouterOutput, provider);
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
    vertex: "Vertex AI",
    replicate: "Replicate",
  };
  return names[provider] ?? provider;
}
