import { describe, expect, it } from "vitest";
import { InMemoryCache } from "../data/cache.js";
import { ModelRegistry } from "../data/registry.js";
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
});
