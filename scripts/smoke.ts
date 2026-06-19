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
import type { UnifiedModel } from "../src/types.js";

const cache = new InMemoryCache();
const registry = new ModelRegistry(cache);

const start = Date.now();
await registry.warmup();
const elapsed = Date.now() - start;

const all = registry.getAllModels();
const count = (pred: (m: (typeof all)[number]) => boolean) => all.filter(pred).length;

const shapeErrors = all.flatMap(validateModelShape);
if (shapeErrors.length > 0) {
  console.error("\n❌ INVALID MODEL DATA SHAPE(S):");
  for (const error of shapeErrors.slice(0, 25)) {
    console.error(`- ${error}`);
  }
  if (shapeErrors.length > 25) {
    console.error(`- ... ${shapeErrors.length - 25} more`);
  }
  process.exit(1);
}

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
console.log("top vision (by composite score):");
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

function validateModelShape(model: UnifiedModel): string[] {
  const prefix = model?.id || "<missing id>";
  const errors: string[] = [];

  if (!isNonEmptyString(model.id)) errors.push(`${prefix}: id must be a non-empty string`);
  if (!isNonEmptyString(model.slug)) errors.push(`${prefix}: slug must be a non-empty string`);
  if (!isNonEmptyString(model.name)) errors.push(`${prefix}: name must be a non-empty string`);
  if (!isNonEmptyString(model.lastUpdated) || Number.isNaN(Date.parse(model.lastUpdated))) {
    errors.push(`${prefix}: lastUpdated must be a valid ISO date string`);
  }

  validatePricing(model, errors, prefix);
  validateCapabilities(model, errors, prefix);
  validateMetadata(model, errors, prefix);
  validateNumericRecord(model.benchmarks, "benchmarks", errors, prefix);
  validateNumericRecord(model.percentiles, "percentiles", errors, prefix, 0, 100);

  return errors;
}

function validatePricing(model: UnifiedModel, errors: string[], prefix: string): void {
  const pricing = model.pricing;
  if (!isNonNegativeFiniteNumber(pricing?.input)) errors.push(`${prefix}: pricing.input must be a non-negative finite number`);
  if (!isNonNegativeFiniteNumber(pricing?.output)) errors.push(`${prefix}: pricing.output must be a non-negative finite number`);
  for (const key of ["request", "cacheRead", "cacheWrite", "image", "reasoning"] as const) {
    const value = pricing?.[key];
    if (value !== undefined && !isNonNegativeFiniteNumber(value)) {
      errors.push(`${prefix}: pricing.${key} must be a non-negative finite number when present`);
    }
  }
}

function validateCapabilities(model: UnifiedModel, errors: string[], prefix: string): void {
  const capabilities = model.capabilities;
  if (!isNonNegativeFiniteNumber(capabilities?.contextLength)) {
    errors.push(`${prefix}: capabilities.contextLength must be a non-negative finite number`);
  }
  if (capabilities?.maxOutputTokens !== undefined && !isNonNegativeFiniteNumber(capabilities.maxOutputTokens)) {
    errors.push(`${prefix}: capabilities.maxOutputTokens must be a non-negative finite number when present`);
  }
  if (!isStringArray(capabilities?.inputModalities)) {
    errors.push(`${prefix}: capabilities.inputModalities must be a string array`);
  }
  if (!isStringArray(capabilities?.outputModalities)) {
    errors.push(`${prefix}: capabilities.outputModalities must be a string array`);
  }
  for (const key of ["supportsTools", "supportsStreaming", "supportsReasoning"] as const) {
    if (typeof capabilities?.[key] !== "boolean") {
      errors.push(`${prefix}: capabilities.${key} must be boolean`);
    }
  }
}

function validateMetadata(model: UnifiedModel, errors: string[], prefix: string): void {
  const metadata = model.metadata;
  if (!isNonEmptyString(metadata?.provider)) errors.push(`${prefix}: metadata.provider must be a non-empty string`);
  if (!isNonEmptyString(metadata?.family)) errors.push(`${prefix}: metadata.family must be a non-empty string`);
  if (typeof metadata?.isOpenSource !== "boolean") errors.push(`${prefix}: metadata.isOpenSource must be boolean`);
  if (metadata?.releaseDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(metadata.releaseDate)) {
    errors.push(`${prefix}: metadata.releaseDate must be YYYY-MM-DD when present`);
  }
}

function validateNumericRecord(
  record: Record<string, number | undefined> | undefined,
  name: string,
  errors: string[],
  prefix: string,
  min = 0,
  max = Infinity
): void {
  if (record === undefined || record === null || typeof record !== "object") {
    errors.push(`${prefix}: ${name} must be an object`);
    return;
  }
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined && (!Number.isFinite(value) || value < min || value > max)) {
      errors.push(`${prefix}: ${name}.${key} must be a finite number in range ${min}..${max}`);
    }
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}
