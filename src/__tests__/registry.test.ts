import { describe, expect, it } from "vitest";
import { InMemoryCache } from "../data/cache.js";
import { ModelRegistry, modelMatchesFilters } from "../data/registry.js";
import type { UnifiedModel } from "../types.js";

function makeModel(
  id: string,
  overrides: {
    benchmarks?: Partial<UnifiedModel["benchmarks"]>;
    capabilities?: Partial<UnifiedModel["capabilities"]>;
    pricing?: Partial<UnifiedModel["pricing"]>;
    metadata?: Partial<UnifiedModel["metadata"]>;
  } = {}
): UnifiedModel {
  return {
    id,
    slug: id.toLowerCase(),
    name: id,
    pricing: { input: 1, output: 1, ...overrides.pricing },
    benchmarks: { ...overrides.benchmarks },
    capabilities: {
      contextLength: 8_000,
      inputModalities: ["text"],
      outputModalities: ["text"],
      supportsTools: false,
      supportsStreaming: true,
      supportsReasoning: false,
      ...overrides.capabilities,
    },
    metadata: {
      provider: "test",
      family: "test",
      isOpenSource: false,
      ...overrides.metadata,
    },
    percentiles: {},
    lastUpdated: "2026-01-01T00:00:00Z",
  };
}

function makeRegistry(models: UnifiedModel[]): ModelRegistry {
  const registry = new ModelRegistry(new InMemoryCache());
  const modelMap = (registry as unknown as { models: Map<string, UnifiedModel> }).models;
  for (const model of models) modelMap.set(model.id, model);
  return registry;
}

describe("ModelRegistry.getTopModels", () => {
  it("filters before limiting so lower-ranked matching models are not dropped", () => {
    const models = Array.from({ length: 30 }, (_, i) =>
      makeModel(`model-${String(i).padStart(2, "0")}`, {
        benchmarks: { arenaElo: 1400 - i * 10 },
        capabilities: { contextLength: i < 15 ? 8_000 : 200_000 },
      })
    );
    const registry = makeRegistry(models);

    const top = registry.getTopModels("general", 10, { minContext: 200_000 });

    expect(top).toHaveLength(10);
    expect(top.map((m) => m.id)).toEqual([
      "model-15",
      "model-16",
      "model-17",
      "model-18",
      "model-19",
      "model-20",
      "model-21",
      "model-22",
      "model-23",
      "model-24",
    ]);
  });

  it("uses model id as final tiebreaker for deterministic ordering", () => {
    const registry = makeRegistry([
      makeModel("z-model", { benchmarks: { arenaElo: 1200 }, pricing: { input: 2, output: 2 } }),
      makeModel("a-model", { benchmarks: { arenaElo: 1200 }, pricing: { input: 2, output: 2 } }),
    ]);

    expect(registry.getTopModels("general", 2).map((m) => m.id)).toEqual(["a-model", "z-model"]);
  });

  it("returns cloned model objects so callers cannot mutate registry state", () => {
    const registry = makeRegistry([
      makeModel("mutable-model", { benchmarks: { arenaElo: 1200 } }),
    ]);

    const first = registry.getAllModels();
    first[0].benchmarks.arenaElo = 9999;
    first[0].capabilities.inputModalities.push("image");

    const second = registry.getAllModels();
    expect(second[0].benchmarks.arenaElo).toBe(1200);
    expect(second[0].capabilities.inputModalities).toEqual(["text"]);
  });

  it("returns cloned exact and fuzzy matches", () => {
    const registry = makeRegistry([
      makeModel("provider/fuzzy-model", { benchmarks: { arenaElo: 1200 } }),
    ]);

    const exact = registry.getModel("provider/fuzzy-model");
    exact!.benchmarks.arenaElo = 9999;
    expect(registry.getModel("provider/fuzzy-model")?.benchmarks.arenaElo).toBe(1200);

    const fuzzy = registry.getModel("fuzzy-model");
    fuzzy!.benchmarks.arenaElo = 8888;
    expect(registry.getModel("provider/fuzzy-model")?.benchmarks.arenaElo).toBe(1200);
  });
});

describe("modelMatchesFilters", () => {
  it("does not suggest unrelated models for one-character queries", () => {
    const registry = makeRegistry([
      makeModel("openai/gpt-5.1"),
      makeModel("google/gemini-3-pro"),
    ]);

    expect(registry.findSimilar("g")).toEqual([]);
  });

  it("applies shared recommendation and top-list filters", () => {
    const model = makeModel("candidate", {
      pricing: { input: 2, output: 5 },
      capabilities: { contextLength: 128_000, inputModalities: ["text", "image"], supportsTools: true },
      metadata: { releaseDate: "2026-01-15", isOpenSource: true },
    });

    expect(modelMatchesFilters(model, {
      maxInputPrice: 2,
      maxOutputPrice: 5,
      minContext: 128_000,
      minReleaseDate: "2026-01-01",
      requireVision: true,
      requireTools: true,
      requireOpenSource: true,
    })).toBe(true);

    expect(modelMatchesFilters(model, { maxInputPrice: 1 })).toBe(false);
    expect(modelMatchesFilters(model, { maxOutputPrice: 4 })).toBe(false);
    expect(modelMatchesFilters(model, { minContext: 200_000 })).toBe(false);
    expect(modelMatchesFilters(model, { minReleaseDate: "2026-02-01" })).toBe(false);
    expect(modelMatchesFilters(makeModel("text-only"), { requireVision: true })).toBe(false);
    expect(modelMatchesFilters(makeModel("no-tools"), { requireTools: true })).toBe(false);
    expect(modelMatchesFilters(makeModel("closed"), { requireOpenSource: true })).toBe(false);
  });
});
