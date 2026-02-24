import { describe, it, expect } from "vitest";
import { computePercentiles } from "../data/percentiles.js";
import type { UnifiedModel } from "../types.js";

function makeModel(
  id: string,
  overrides: {
    benchmarks?: Partial<UnifiedModel["benchmarks"]>;
    capabilities?: Partial<UnifiedModel["capabilities"]>;
    pricing?: Partial<UnifiedModel["pricing"]>;
  } = {}
): UnifiedModel {
  return {
    id,
    slug: id.replace(/\//g, "-").toLowerCase(),
    name: id,
    pricing: { input: 3, output: 15, ...overrides.pricing },
    benchmarks: { ...overrides.benchmarks },
    capabilities: {
      contextLength: 200000,
      inputModalities: ["text"],
      outputModalities: ["text"],
      supportsTools: true,
      supportsStreaming: true,
      supportsReasoning: false,
      ...overrides.capabilities,
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

describe("computePercentiles", () => {
  it("assigns coding percentiles based on SWE-bench and Aider scores", () => {
    const models = new Map<string, UnifiedModel>();
    models.set("low", makeModel("low", { benchmarks: { sweBenchVerified: 30 } }));
    models.set("mid", makeModel("mid", { benchmarks: { sweBenchVerified: 50 } }));
    models.set("high", makeModel("high", { benchmarks: { sweBenchVerified: 70 } }));

    computePercentiles(models);

    expect(models.get("low")!.percentiles.coding).toBe(0);
    expect(models.get("mid")!.percentiles.coding).toBe(50);
    expect(models.get("high")!.percentiles.coding).toBe(100);
  });

  it("assigns general percentiles based on Arena Elo", () => {
    const models = new Map<string, UnifiedModel>();
    models.set("a", makeModel("a", { benchmarks: { arenaElo: 900 } }));
    models.set("b", makeModel("b", { benchmarks: { arenaElo: 1100 } }));
    models.set("c", makeModel("c", { benchmarks: { arenaElo: 1300 } }));

    computePercentiles(models);

    expect(models.get("a")!.percentiles.general).toBe(0);
    expect(models.get("c")!.percentiles.general).toBe(100);
  });

  it("assigns vision percentiles only to vision-capable models", () => {
    const models = new Map<string, UnifiedModel>();
    models.set(
      "vision-model",
      makeModel("vision-model", {
        benchmarks: { mmmu: 80 },
        capabilities: { inputModalities: ["text", "image"] },
      })
    );
    models.set(
      "text-model",
      makeModel("text-model", {
        benchmarks: { mmmu: 90 }, // Has score but no image modality
      })
    );

    computePercentiles(models);

    expect(models.get("vision-model")!.percentiles.vision).toBeDefined();
    expect(models.get("text-model")!.percentiles.vision).toBeUndefined();
  });

  it("does not assign percentiles for categories without data", () => {
    const models = new Map<string, UnifiedModel>();
    models.set("empty", makeModel("empty"));

    computePercentiles(models);

    const p = models.get("empty")!.percentiles;
    expect(p.coding).toBeUndefined();
    expect(p.math).toBeUndefined();
    expect(p.general).toBeUndefined();
    expect(p.vision).toBeUndefined();
    expect(p.costEfficiency).toBeUndefined();
  });

  it("handles ties correctly (same percentile for tied models)", () => {
    const models = new Map<string, UnifiedModel>();
    models.set("a", makeModel("a", { benchmarks: { sweBenchVerified: 50 } }));
    models.set("b", makeModel("b", { benchmarks: { sweBenchVerified: 50 } }));
    models.set("c", makeModel("c", { benchmarks: { sweBenchVerified: 70 } }));

    computePercentiles(models);

    // Both tied models should have the same percentile
    expect(models.get("a")!.percentiles.coding).toBe(models.get("b")!.percentiles.coding);
    expect(models.get("c")!.percentiles.coding).toBe(100);
  });

  it("assigns cost efficiency percentiles based on performance/price", () => {
    const models = new Map<string, UnifiedModel>();
    // Cheap model with decent score
    models.set(
      "cheap",
      makeModel("cheap", {
        benchmarks: { arenaElo: 1200 },
        pricing: { input: 0.5, output: 1 },
      })
    );
    // Expensive model with same score
    models.set(
      "expensive",
      makeModel("expensive", {
        benchmarks: { arenaElo: 1200 },
        pricing: { input: 30, output: 60 },
      })
    );

    computePercentiles(models);

    // Cheap model should have higher cost efficiency percentile
    expect(models.get("cheap")!.percentiles.costEfficiency).toBeGreaterThan(
      models.get("expensive")!.percentiles.costEfficiency!
    );
  });

  it("skips cost efficiency for free models", () => {
    const models = new Map<string, UnifiedModel>();
    models.set(
      "free",
      makeModel("free", {
        benchmarks: { arenaElo: 1100 },
        pricing: { input: 0, output: 0 },
      })
    );

    computePercentiles(models);

    expect(models.get("free")!.percentiles.costEfficiency).toBeUndefined();
  });

  it("handles single model (percentile = 0)", () => {
    const models = new Map<string, UnifiedModel>();
    models.set("only", makeModel("only", { benchmarks: { sweBenchVerified: 50 } }));

    computePercentiles(models);

    // Single model: lowerCount=0, total-1=0, division by (0||1) = 0
    expect(models.get("only")!.percentiles.coding).toBe(0);
  });
});
