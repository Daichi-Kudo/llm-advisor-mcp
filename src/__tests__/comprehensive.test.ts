import { describe, it, expect } from "vitest";
import { estimateOutputSpeed, estimateTtft, generateUniversalSpeedData } from "../data/fetchers/speed.js";
import { parseBfclTable } from "../data/fetchers/bfcl.js";
import { getPerProviderPricing, getProviderDisplayName } from "../data/static/per-provider-pricing.js";
import { generateSlug } from "../tools/slugs.js";
import { isOpenSource } from "../data/fetchers/openrouter.js";

// ============================================================
// Speed estimation tests
// ============================================================

describe("estimateOutputSpeed", () => {
  it("returns fast speed for cheap models", () => {
    expect(estimateOutputSpeed(0.01, "openai/gpt-5-nano")).toBeGreaterThanOrEqual(500);
  });

  it("returns moderate speed for mid-priced models", () => {
    const speed = estimateOutputSpeed(2.00, "anthropic/claude-sonnet-4.6");
    expect(speed).toBeGreaterThanOrEqual(50);
    expect(speed).toBeLessThanOrEqual(500);
  });

  it("returns slow speed for expensive reasoning models", () => {
    const speed = estimateOutputSpeed(150, "openai/o3-reasoning");
    expect(speed).toBeLessThanOrEqual(100);
  });

  it("boosts speed for flash/mini models", () => {
    const normal = estimateOutputSpeed(1.00, "google/gemini-pro");
    const boosted = estimateOutputSpeed(1.00, "google/gemini-flash");
    expect(boosted).toBeGreaterThan(normal);
  });

  it("reduces speed for opus/reasoning models", () => {
    const normal = estimateOutputSpeed(3.00, "anthropic/claude-sonnet-4.6");
    const reduced = estimateOutputSpeed(3.00, "anthropic/claude-opus-4.8");
    expect(reduced).toBeLessThan(normal);
  });

  it("handles free/zero-priced models", () => {
    expect(estimateOutputSpeed(0, "meta-llama/llama-free")).toBeGreaterThanOrEqual(500);
  });
});

describe("estimateTtft", () => {
  it("returns fast TTFT for cheap models", () => {
    expect(estimateTtft(0.10, "google/gemini-flash")).toBeLessThanOrEqual(1);
  });

  it("returns slower TTFT for expensive models", () => {
    expect(estimateTtft(20.00, "anthropic/claude-opus-4.8")).toBeGreaterThanOrEqual(0.5);
  });

  it("returns much slower TTFT for reasoning models", () => {
    const normal = estimateTtft(3.00, "openai/gpt-4.1");
    const slow = estimateTtft(3.00, "openai/o3-reasoning");
    expect(slow).toBeGreaterThan(normal);
  });
});

describe("generateUniversalSpeedData", () => {
  it("assigns speed to all input models, not just measured ones", () => {
    const models = [
      { id: "openai/gpt-5.5", pricing: { input: 5.00 } },
      { id: "brand-new-model/unreleased-v1", pricing: { input: 0.50 } },
    ];
    const data = generateUniversalSpeedData(models);
    // Should include measured data + the new model
    expect(data.size).toBeGreaterThanOrEqual(2);
    // The new model should have estimated speed
    const newModelKey = "brand-new-model/unreleased-v1".toLowerCase().replace(/[^a-z0-9/.-]/g, "");
    expect(data.get(newModelKey)?.outputTokensPerSecond).toBeDefined();
  });

  it("prefers measured data over estimates for known models", () => {
    const models = [
      { id: "anthropic/claude-sonnet-4.6", pricing: { input: 3.00 } },
    ];
    const data = generateUniversalSpeedData(models);
    const entry = data.get("anthropic/claude-sonnet-4.6");
    expect(entry?.outputTokensPerSecond).toBe(74); // measured value
  });
});

// ============================================================
// BFCL parser tests
// ============================================================

describe("parseBfclTable", () => {
  it("parses a valid BFCL V4 table", () => {
    const html = `<html><body>
      <table>
        <tr><th>Rank</th><th>Overall Acc</th><th>Model</th><th>Cost</th></tr>
        <tr><td>1</td><td>77.47</td><td><a href="/model">Claude-Opus-4-5-20251101 (FC)</a></td><td>86.55</td></tr>
        <tr><td>2</td><td>73.24</td><td><a href="/model">Claude-Sonnet-4-5-20250929 (FC)</a></td><td>43.73</td></tr>
        <tr><td>3</td><td>72.51</td><td><a href="/model">Gemini-3-Pro-Preview (Prompt)</a></td><td>298.47</td></tr>
      </table>
    </body></html>`;
    const scores = parseBfclTable(html);
    expect(scores.size).toBe(3);
    const first = scores.get("claude-opus-4-5-20251101-fc");
    expect(first?.overall).toBe(77.47);
    expect(first?.cost).toBe(86.55);
  });

  it("returns empty map for table with no data rows", () => {
    const html = `<html><body><table><tr><th>Rank</th></tr></table></body></html>`;
    const scores = parseBfclTable(html);
    expect(scores.size).toBe(0);
  });

  it("returns empty map for HTML with no table", () => {
    const scores = parseBfclTable("<html><body>No table here</body></html>");
    expect(scores.size).toBe(0);
  });

  it("skips rows where overall accuracy cannot be parsed", () => {
    const html = `<html><body>
      <table>
        <tr><td>1</td><td>N/A</td><td>Test Model</td><td>0</td></tr>
      </table>
    </body></html>`;
    const scores = parseBfclTable(html);
    expect(scores.size).toBe(0);
  });

  it("handles model names without links", () => {
    const html = `<html><body>
      <table>
        <tr><td>1</td><td>72.38</td><td>GLM-4.6 (FC thinking)</td><td>4.64</td></tr>
      </table>
    </body></html>`;
    const scores = parseBfclTable(html);
    expect(scores.size).toBe(1);
  });
});

// ============================================================
// Per-provider pricing tests
// ============================================================

describe("getPerProviderPricing", () => {
  it("returns known pricing for a well-known model", () => {
    const pricing = getPerProviderPricing("openai/gpt-5.5", 5.00, 30.00);
    expect(pricing).not.toBeNull();
    expect(pricing!.openrouter.input).toBe(5.00);
    expect(pricing!["openai-direct"]).toBeDefined();
  });

  it("auto-estimates pricing for any model", () => {
    const pricing = getPerProviderPricing("new-provider/future-model-v1", 2.00, 8.00);
    expect(pricing).not.toBeNull();
    expect(pricing!.openrouter.input).toBe(2.00);
    // Should have estimated providers
    expect(pricing!.groq).toBeDefined();
    expect(pricing!.together).toBeDefined();
    expect(pricing!.fireworks).toBeDefined();
  });

  it("applies Bedrock +10% markup for anthropic models", () => {
    const pricing = getPerProviderPricing("anthropic/claude-sonnet-4.6", 3.00, 15.00);
    expect(pricing?.bedrock?.input).toBeCloseTo(3.30);
    expect(pricing?.bedrock?.output).toBeCloseTo(16.50);
  });

  it("applies Azure +10% markup for openai models", () => {
    const pricing = getPerProviderPricing("openai/gpt-5.5", 5.00, 30.00);
    expect(pricing?.azure?.input).toBeCloseTo(5.50);
  });

  it("applies Cerebras -10% discount for auto-estimated models", () => {
    // Use a model NOT in KNOWN_PRICING to test estimation
    const pricing = getPerProviderPricing("unknown-lab/new-model", 1.00, 4.00);
    expect(pricing?.cerebras?.input).toBeCloseTo(0.90);
  });

  it("returns null for free models", () => {
    const pricing = getPerProviderPricing("free/model", 0, 0);
    expect(pricing).toBeNull();
  });
});

describe("getProviderDisplayName", () => {
  it("returns human-readable names", () => {
    expect(getProviderDisplayName("openrouter")).toBe("OpenRouter");
    expect(getProviderDisplayName("anthropic-direct")).toBe("Anthropic Direct");
    expect(getProviderDisplayName("bedrock")).toBe("AWS Bedrock");
    expect(getProviderDisplayName("vertex")).toBe("Vertex AI");
    expect(getProviderDisplayName("replicate")).toBe("Replicate");
  });

  it("returns the raw key for unknown providers", () => {
    expect(getProviderDisplayName("unknown-provider")).toBe("unknown-provider");
  });
});

// ============================================================
// Provider slug generator tests
// ============================================================

describe("generateSlug", () => {
  it("generates bedrock slug for anthropic models", () => {
    const slug = generateSlug("anthropic/claude-sonnet-4.6");
    expect(slug.bedrock).toContain("anthropic");
    expect(slug.bedrock).toContain("claude");
  });

  it("generates groq slug", () => {
    const slug = generateSlug("google/gemini-3.1-pro");
    expect(slug.groq).toBe("gemini-3.1-pro");
  });

  it("generates vertex ai slug for google models", () => {
    const slug = generateSlug("google/gemini-3.1-pro");
    expect(slug.vertexAi).toBe("gemini-3.1-pro");
  });

  it("generates together slug", () => {
    const slug = generateSlug("meta-llama/llama-4-maverick");
    expect(slug.together).toContain("meta-llama");
  });

  it("generates replicate slug", () => {
    const slug = generateSlug("anthropic/claude-sonnet-4.6");
    expect(slug.replicate).toContain("anthropic");
  });

  it("generates huggingface slug", () => {
    const slug = generateSlug("mistralai/mistral-large");
    expect(slug.huggingface).toContain("mistralai");
  });

  it("sets azure slug for openai models", () => {
    const slug = generateSlug("openai/gpt-5.5");
    expect(slug.azure).toBeDefined();
  });

  it("sets google slug for google models", () => {
    const slug = generateSlug("google/gemini-3-flash");
    expect(slug.google).toBeDefined();
  });

  it("handles unknown providers gracefully", () => {
    const slug = generateSlug("unicorn/rainbow-v1");
    expect(slug.openrouter).toBe("unicorn/rainbow-v1");
    expect(slug.model).toBeDefined();
  });
});

// ============================================================
// OpenRouter isOpenSource tests
// ============================================================

describe("isOpenSource", () => {
  it("classifies llama models as open source", () => {
    expect(isOpenSource("meta-llama/llama-4-maverick")).toBe(true);
  });

  it("classifies deepseek models as open source", () => {
    expect(isOpenSource("deepseek/deepseek-chat")).toBe(true);
  });

  it("classifies qwen models as open source", () => {
    expect(isOpenSource("qwen/qwen-3.5-plus")).toBe(true);
  });

  it("classifies gemini models as proprietary", () => {
    expect(isOpenSource("google/gemini-3.1-pro")).toBe(false);
  });

  it("classifies gpt models as proprietary", () => {
    expect(isOpenSource("openai/gpt-5.5")).toBe(false);
  });

  it("classifies claude models as proprietary", () => {
    expect(isOpenSource("anthropic/claude-sonnet-4.6")).toBe(false);
  });

  it("classifies perplexity models as proprietary", () => {
    expect(isOpenSource("perplexity/sonar-pro")).toBe(false);
  });

  it("classifies inception models as proprietary", () => {
    expect(isOpenSource("inception/mercury-2")).toBe(false);
  });

  it("classifies grok 1 as open source but grok 4 as proprietary", () => {
    expect(isOpenSource("x-ai/grok-1")).toBe(true);
    expect(isOpenSource("x-ai/grok-4")).toBe(false);
  });
});

// ============================================================
// Ollama local models data integrity tests
// ============================================================

describe("Ollama model data", () => {
  it("all models have valid hardware tiers", async () => {
    const { getOllamaModels } = await import("../data/static/local-models.js");
    const models = getOllamaModels();
    expect(models.length).toBeGreaterThan(0);
    const validTiers = ["mac", "consumer-gpu", "pro-gpu", "multi-gpu"];
    for (const m of models) {
      expect(validTiers).toContain(m.hardwareTier);
      expect(m.minVramGb).toBeGreaterThan(0);
      expect(m.qualityScore).toBeGreaterThanOrEqual(0);
    }
  });
});
