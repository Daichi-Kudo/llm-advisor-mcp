import type { UnifiedModel } from "../types.js";

/** Build a compact Markdown table. Truncates at maxRows with a "... N more" note. */
export function buildMarkdownTable(
  headers: string[],
  rows: string[][],
  maxRows = 10
): string {
  const truncated = rows.length > maxRows;
  const displayRows = rows.slice(0, maxRows);

  const headerLine = `| ${headers.join(" | ")} |`;
  const separatorLine = `|${headers.map(() => "------").join("|")}|`;
  const dataLines = displayRows.map((row) => `| ${row.join(" | ")} |`);

  let table = [headerLine, separatorLine, ...dataLines].join("\n");
  if (truncated) {
    table += `\n| ... | +${rows.length - maxRows} more ||`;
  }
  return table;
}

/** Format price as "$X.XX" or "free" */
export function fmtPrice(price: number | undefined): string {
  if (price === undefined || price === null) return "n/a";
  if (price === 0) return "free";
  if (price < 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(2)}`;
}

/** Format large context lengths: 128000 → "128K", 1000000 → "1M" */
export function fmtContext(tokens: number | undefined): string {
  if (!tokens) return "n/a";
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
  return String(tokens);
}

/** Format benchmark score: 72.1 → "72.1%" or "n/a" */
export function fmtScore(score: number | undefined): string {
  if (score === undefined || score === null) return "n/a";
  return `${score.toFixed(1)}%`;
}

/** Format Elo rating */
export function fmtElo(elo: number | undefined): string {
  if (elo === undefined || elo === null) return "n/a";
  return String(Math.round(elo));
}

/** Format modalities as short string: ["text", "image"] → "text+image" */
export function fmtModalities(mods: string[]): string {
  return mods.join("+") || "text";
}

/** Data freshness footer */
export function freshnessFooter(fetchedAt?: number): string {
  if (!fetchedAt) return "";
  const date = new Date(fetchedAt).toISOString().replace(/\.\d{3}Z$/, "Z");
  const ageMin = Math.round((Date.now() - fetchedAt) / 60_000);
  return `\n**Data freshness**: ${date} (${ageMin}min ago)`;
}

/** Format a single model as compact Markdown for get_model_info */
export function formatModelDetail(model: UnifiedModel, fetchedAt?: number): string {
  const lines: string[] = [];

  lines.push(`## ${model.id}`);
  lines.push("");
  const metaParts = [
    `**Provider**: ${model.metadata.provider}`,
    `**Modality**: ${fmtModalities(model.capabilities.inputModalities)}→${fmtModalities(model.capabilities.outputModalities)}`,
  ];
  if (model.metadata.releaseDate) {
    metaParts.push(`**Released**: ${model.metadata.releaseDate}`);
  }
  if (model.metadata.isOpenSource) {
    metaParts.push("**Open Source**");
  }
  lines.push(metaParts.join(" | "));

  // Pricing
  lines.push("");
  lines.push("### Pricing");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| Input | ${fmtPrice(model.pricing.input)} /1M tok |`);
  lines.push(`| Output | ${fmtPrice(model.pricing.output)} /1M tok |`);
  if (model.pricing.cacheRead !== undefined) {
    lines.push(`| Cache Read | ${fmtPrice(model.pricing.cacheRead)} /1M tok |`);
  }
  if (model.pricing.reasoning !== undefined) {
    lines.push(`| Reasoning | ${fmtPrice(model.pricing.reasoning)} /1M tok |`);
  }
  lines.push(`| Context | ${fmtContext(model.capabilities.contextLength)} |`);
  if (model.capabilities.maxOutputTokens) {
    lines.push(`| Max Output | ${fmtContext(model.capabilities.maxOutputTokens)} |`);
  }

  // Benchmarks (only non-null)
  const benchEntries = Object.entries(model.benchmarks).filter(
    ([, v]) => v !== undefined && v !== null
  );
  if (benchEntries.length > 0) {
    lines.push("");
    lines.push("### Benchmarks");
    lines.push("| Benchmark | Score |");
    lines.push("|-----------|-------|");
    for (const [key, value] of benchEntries) {
      const label = benchmarkLabel(key);
      const formatted = key === "arenaElo" ? fmtElo(value as number) : fmtScore(value as number);
      lines.push(`| ${label} | ${formatted} |`);
    }
  }

  // Percentile ranks (only non-null)
  const percEntries = Object.entries(model.percentiles).filter(
    ([, v]) => v !== undefined && v !== null
  );
  if (percEntries.length > 0) {
    lines.push("");
    lines.push("### Percentile Ranks");
    lines.push("| Category | Percentile |");
    lines.push("|----------|------------|");
    for (const [key, value] of percEntries) {
      lines.push(`| ${percentileLabel(key)} | P${value} |`);
    }
  }

  // Capabilities
  const caps: string[] = [];
  if (model.capabilities.supportsTools) caps.push("Tools");
  if (model.capabilities.supportsReasoning) caps.push("Reasoning");
  if (model.capabilities.inputModalities.includes("image")) caps.push("Vision");
  if (caps.length > 0) {
    lines.push("");
    lines.push(`**Capabilities**: ${caps.join(", ")}`);
  }

  lines.push(freshnessFooter(fetchedAt));

  return lines.join("\n");
}

/** Format top models list as compact table */
export function formatTopList(
  category: string,
  models: UnifiedModel[],
  keyScoreExtractor: (m: UnifiedModel) => string,
  limit: number,
  fetchedAt?: number
): string {
  const lines: string[] = [];
  lines.push(`## Top ${Math.min(models.length, limit)}: ${category}`);
  lines.push("");

  const headers = ["#", "Model", "Key Score", "Input $/1M", "Output $/1M", "Context", "Released"];
  const rows = models.slice(0, limit).map((m, i) => [
    String(i + 1),
    m.id,
    keyScoreExtractor(m),
    fmtPrice(m.pricing.input),
    fmtPrice(m.pricing.output),
    fmtContext(m.capabilities.contextLength),
    m.metadata.releaseDate ?? "n/a",
  ]);

  lines.push(buildMarkdownTable(headers, rows, limit));
  lines.push(freshnessFooter(fetchedAt));

  return lines.join("\n");
}

/** Human-readable benchmark label */
function benchmarkLabel(key: string): string {
  const labels: Record<string, string> = {
    sweBenchVerified: "SWE-bench Verified",
    sweBenchLite: "SWE-bench Lite",
    humanEval: "HumanEval",
    aiderPolyglot: "Aider Polyglot",
    arenaElo: "Arena Elo",
    mmluPro: "MMLU-Pro",
    gpqaDiamond: "GPQA Diamond",
    math500: "MATH-500",
    aime2024: "AIME 2024",
    mmmu: "MMMU",
    mmBench: "MMBench",
    ocrBench: "OCRBench",
    ai2d: "AI2D",
    mathVista: "MathVista",
  };
  return labels[key] ?? key;
}

/** Human-readable percentile category label */
function percentileLabel(key: string): string {
  const labels: Record<string, string> = {
    coding: "Coding",
    math: "Math & Reasoning",
    general: "General",
    vision: "Vision",
    costEfficiency: "Cost Efficiency",
  };
  return labels[key] ?? key;
}
