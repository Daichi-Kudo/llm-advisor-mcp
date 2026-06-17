/**
 * Live smoke test — hits all real data sources and reports coverage.
 *
 * Run: `npm run smoke`
 *
 * Exists because a data source can break silently (e.g. an expired TLS cert)
 * and the server degrades gracefully to empty benchmarks — looking "fine" while
 * a whole feature is dead. This fails loudly when any source returns nothing.
 */
import { InMemoryCache } from "../src/data/cache.js";
import { ModelRegistry } from "../src/data/registry.js";

const cache = new InMemoryCache();
const registry = new ModelRegistry(cache);

const start = Date.now();
await registry.warmup();
const elapsed = Date.now() - start;

const all = registry.getAllModels();
const count = (pred: (m: (typeof all)[number]) => boolean) => all.filter(pred).length;

const coverage = {
  models: all.length,
  sweBenchVerified: count((m) => m.benchmarks.sweBenchVerified != null),
  arenaElo: count((m) => m.benchmarks.arenaElo != null),
  aiderPolyglot: count((m) => m.benchmarks.aiderPolyglot != null),
  mmmu: count((m) => m.benchmarks.mmmu != null),
};

console.log(`warmup: ${elapsed}ms`);
console.table(coverage);

const topVision = registry
  .getTopModels("vision", 5)
  .map((m) => ({ id: m.id, mmmu: m.benchmarks.mmmu ?? null }));
console.log("top vision (by MMMU):");
console.table(topVision);

// Fail loudly if any source contributed zero rows — that means it's broken.
const sources: Record<string, number> = {
  "OpenRouter (models)": coverage.models,
  "SWE-bench": coverage.sweBenchVerified,
  "LM Arena": coverage.arenaElo,
  "Aider Polyglot": coverage.aiderPolyglot,
  "OpenCompass VLM": coverage.mmmu,
};
const dead = Object.entries(sources).filter(([, n]) => n === 0).map(([s]) => s);
if (dead.length > 0) {
  console.error(`\n❌ DEAD SOURCE(S): ${dead.join(", ")}`);
  process.exit(1);
}
console.log("\n✅ all 5 sources returned data");
