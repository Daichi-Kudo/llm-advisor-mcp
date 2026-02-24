import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ModelRegistry } from "../data/registry.js";
import type { UnifiedModel } from "../types.js";
import { fmtPrice, fmtContext, fmtScore, fmtElo, freshnessFooter } from "./formatters.js";

export function registerCompareTool(
  server: McpServer,
  registry: ModelRegistry
): void {
  server.tool(
    "compare_models",
    "Compare 2-5 LLM/VLM models side-by-side: pricing, benchmarks, capabilities. " +
      "Returns a compact Markdown comparison table (~400 tokens).",
    {
      models: z
        .array(z.string())
        .min(2)
        .max(5)
        .describe(
          'Model IDs or partial names (e.g., ["claude-sonnet-4.6", "gpt-5.2", "gemini-3-pro"])'
        ),
    },
    async ({ models: modelQueries }) => {
      await registry.ensureLoaded();

      const resolved: UnifiedModel[] = [];
      const notFound: string[] = [];

      for (const query of modelQueries) {
        const found = registry.getModel(query);
        if (found) {
          resolved.push(found);
        } else {
          notFound.push(query);
        }
      }

      if (resolved.length < 2) {
        const similar = notFound
          .flatMap((q) => registry.findSimilar(q))
          .slice(0, 5);
        return {
          content: [
            {
              type: "text" as const,
              text:
                `Need at least 2 models to compare. Not found: ${notFound.join(", ")}.` +
                (similar.length > 0
                  ? ` Did you mean: ${similar.join(", ")}?`
                  : ""),
            },
          ],
          isError: true,
        };
      }

      const fetchedAt = registry.getCacheFreshnessMs();
      const output = formatComparison(resolved, notFound, fetchedAt);

      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );
}

function formatComparison(
  models: UnifiedModel[],
  notFound: string[],
  fetchedAt?: number
): string {
  const lines: string[] = [];

  lines.push(`## Model Comparison (${models.length} models)`);
  if (notFound.length > 0) {
    lines.push(`\n> Not found: ${notFound.join(", ")}`);
  }
  lines.push("");

  // Header row: Feature | Model1 | Model2 | ...
  const header = `| | ${models.map((m) => `**${m.id}**`).join(" | ")} |`;
  const sep = `|------|${models.map(() => "------").join("|")}|`;

  const rows: string[] = [];

  // Pricing
  rows.push(row("Input $/1M", models.map((m) => fmtPrice(m.pricing.input))));
  rows.push(row("Output $/1M", models.map((m) => fmtPrice(m.pricing.output))));
  if (models.some((m) => m.pricing.cacheRead !== undefined)) {
    rows.push(
      row("Cache Read $/1M", models.map((m) => fmtPrice(m.pricing.cacheRead)))
    );
  }

  // Context & output
  rows.push(
    row("Context", models.map((m) => fmtContext(m.capabilities.contextLength)))
  );
  rows.push(
    row(
      "Max Output",
      models.map((m) => fmtContext(m.capabilities.maxOutputTokens))
    )
  );

  // Benchmarks — only show rows where at least one model has data
  const benchmarks: [string, (m: UnifiedModel) => string][] = [
    ["SWE-bench", (m) => fmtScore(m.benchmarks.sweBenchVerified)],
    ["Arena Elo", (m) => fmtElo(m.benchmarks.arenaElo)],
    ["MMLU-Pro", (m) => fmtScore(m.benchmarks.mmluPro)],
    ["GPQA Diamond", (m) => fmtScore(m.benchmarks.gpqaDiamond)],
    ["MATH-500", (m) => fmtScore(m.benchmarks.math500)],
    ["MMMU", (m) => fmtScore(m.benchmarks.mmmu)],
  ];

  for (const [label, extractor] of benchmarks) {
    const values = models.map(extractor);
    if (values.some((v) => v !== "n/a")) {
      // Bold the best value
      rows.push(row(label, highlightBest(values)));
    }
  }

  // Capabilities
  rows.push(
    row("Vision", models.map((m) =>
      m.capabilities.inputModalities.includes("image") ? "Yes" : "No"
    ))
  );
  rows.push(
    row("Tools", models.map((m) =>
      m.capabilities.supportsTools ? "Yes" : "No"
    ))
  );
  rows.push(
    row("Reasoning", models.map((m) =>
      m.capabilities.supportsReasoning ? "Yes" : "No"
    ))
  );
  rows.push(
    row("Open Source", models.map((m) =>
      m.metadata.isOpenSource ? "Yes" : "No"
    ))
  );

  lines.push(header);
  lines.push(sep);
  lines.push(...rows);
  lines.push(freshnessFooter(fetchedAt));

  return lines.join("\n");
}

function row(label: string, values: string[]): string {
  return `| ${label} | ${values.join(" | ")} |`;
}

/** Bold the best (highest) numeric value in the array */
function highlightBest(values: string[]): string[] {
  const nums = values.map((v) => {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? -Infinity : n;
  });
  const max = Math.max(...nums);
  if (max === -Infinity) return values;

  return values.map((v, i) => (nums[i] === max && v !== "n/a" ? `**${v}**` : v));
}
