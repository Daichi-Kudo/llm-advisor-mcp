import { describe, it, expect } from "vitest";
import { normalizeKey, mergeBenchmarkData } from "../data/normalizer.js";
import type { UnifiedModel } from "../types.js";
import type { SweBenchEntry } from "../data/fetchers/swe-bench.js";
import type { ArenaEntry } from "../data/fetchers/arena.js";
import type { VlmEntry } from "../data/fetchers/vlm-leaderboard.js";
import type { AiderEntry } from "../data/fetchers/aider.js";

// ============================================================
// normalizeKey
// ============================================================

describe("normalizeKey", () => {
  it("strips provider prefix", () => {
    expect(normalizeKey("anthropic/claude-opus-4.6")).toBe("claude-opus-4.6");
    expect(normalizeKey("openai/gpt-5.2")).toBe("gpt-5.2");
    expect(normalizeKey("x-ai/grok-3")).toBe("grok-3");
  });

  it("strips date suffixes", () => {
    expect(normalizeKey("gpt-5.2-20260210")).toBe("gpt-5.2");
    expect(normalizeKey("claude-sonnet-4-2025-11-18")).toBe("claude-sonnet-4");
  });

  it("normalizes hyphens to dots for version numbers", () => {
    expect(normalizeKey("claude-opus-4-6")).toBe("claude-opus-4.6");
    expect(normalizeKey("gemini-3-1-pro")).toBe("gemini-3.1-pro");
  });

  it("strips -thinking suffix", () => {
    expect(normalizeKey("claude-opus-4-thinking")).toBe("claude-opus-4");
    expect(normalizeKey("claude-opus-4-thinking-16k")).toBe("claude-opus-4");
  });

  it("strips -chat and -latest but keeps -preview and -mini", () => {
    expect(normalizeKey("gpt-5.2-chat-latest")).toBe("gpt-5.2");
    expect(normalizeKey("gpt-5.2-preview")).toContain("preview");
    expect(normalizeKey("gpt-5.2-mini")).toContain("mini");
  });

  it("lowercases and normalizes whitespace", () => {
    expect(normalizeKey("Claude 4.5 Opus")).toBe("claude-4.5-opus");
    expect(normalizeKey("GPT  5.2")).toBe("gpt-5.2");
  });

  it("handles already-clean names", () => {
    expect(normalizeKey("claude-opus-4.6")).toBe("claude-opus-4.6");
    expect(normalizeKey("gpt-5.2")).toBe("gpt-5.2");
  });
});

// ============================================================
// mergeBenchmarkData
// ============================================================

describe("mergeBenchmarkData", () => {
  function makeModel(id: string, name: string): UnifiedModel {
    return {
      id,
      slug: id.replace(/\//g, "-").toLowerCase(),
      name,
      pricing: { input: 3, output: 15 },
      benchmarks: {},
      capabilities: {
        contextLength: 200000,
        inputModalities: ["text"],
        outputModalities: ["text"],
        supportsTools: true,
        supportsStreaming: true,
        supportsReasoning: false,
      },
      metadata: {
        provider: "test",
        family: "test",
        isOpenSource: false,
      },
      percentiles: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  it("merges SWE-bench scores by normalized name", () => {
    const models = new Map<string, UnifiedModel>();
    models.set("anthropic/claude-opus-4.6", makeModel("anthropic/claude-opus-4.6", "Claude Opus 4.6"));

    const sweScores = new Map<string, SweBenchEntry>();
    sweScores.set("claude-opus-4-6", { name: "Claude Opus 4-6", resolved: 72.0, total: 500 });

    mergeBenchmarkData(models, sweScores, new Map());

    expect(models.get("anthropic/claude-opus-4.6")!.benchmarks.sweBenchVerified).toBe(72.0);
  });

  it("merges Arena scores by normalized name", () => {
    const models = new Map<string, UnifiedModel>();
    models.set("openai/gpt-5.2", makeModel("openai/gpt-5.2", "GPT-5.2"));

    const arenaScores = new Map<string, ArenaEntry>();
    arenaScores.set("gpt-5.2", { name: "GPT-5.2", arenaScore: 1350, ci95Upper: 1360, ci95Lower: 1340 });

    mergeBenchmarkData(models, new Map(), arenaScores);

    expect(models.get("openai/gpt-5.2")!.benchmarks.arenaElo).toBe(1350);
  });

  it("merges VLM scores for vision models", () => {
    const models = new Map<string, UnifiedModel>();
    const m = makeModel("openai/gpt-5.2", "GPT-5.2");
    m.capabilities.inputModalities = ["text", "image"];
    models.set("openai/gpt-5.2", m);

    const vlmScores = new Map<string, VlmEntry>();
    vlmScores.set("gpt-5.2", { name: "GPT-5.2", mmmu: 75.2, mmBench: 82.1 });

    mergeBenchmarkData(models, new Map(), new Map(), vlmScores);

    expect(m.benchmarks.mmmu).toBe(75.2);
    expect(m.benchmarks.mmBench).toBe(82.1);
  });

  it("merges Aider Polyglot scores", () => {
    const models = new Map<string, UnifiedModel>();
    models.set("anthropic/claude-sonnet-4.6", makeModel("anthropic/claude-sonnet-4.6", "Claude Sonnet 4.6"));

    const aiderScores = new Map<string, AiderEntry>();
    aiderScores.set("claude-sonnet-4.6", { name: "claude-sonnet-4.6", passRate2: 85.3 });

    mergeBenchmarkData(models, new Map(), new Map(), undefined, aiderScores);

    expect(models.get("anthropic/claude-sonnet-4.6")!.benchmarks.aiderPolyglot).toBe(85.3);
  });

  it("keeps higher scores when merging duplicates", () => {
    const models = new Map<string, UnifiedModel>();
    const m = makeModel("anthropic/claude-opus-4.6", "Claude Opus 4.6");
    m.benchmarks.sweBenchVerified = 70.0;
    models.set("anthropic/claude-opus-4.6", m);

    const sweScores = new Map<string, SweBenchEntry>();
    sweScores.set("claude-opus-4-6", { name: "Claude Opus 4-6", resolved: 72.0, total: 500 });

    mergeBenchmarkData(models, sweScores, new Map());

    // Higher score (72.0) should win
    expect(m.benchmarks.sweBenchVerified).toBe(72.0);
  });

  it("does not overwrite with lower scores", () => {
    const models = new Map<string, UnifiedModel>();
    const m = makeModel("anthropic/claude-opus-4.6", "Claude Opus 4.6");
    m.benchmarks.sweBenchVerified = 75.0;
    models.set("anthropic/claude-opus-4.6", m);

    const sweScores = new Map<string, SweBenchEntry>();
    sweScores.set("claude-opus-4-6", { name: "Claude Opus 4-6", resolved: 70.0, total: 500 });

    mergeBenchmarkData(models, sweScores, new Map());

    // Existing higher score (75.0) should be preserved
    expect(m.benchmarks.sweBenchVerified).toBe(75.0);
  });
});
