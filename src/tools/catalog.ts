import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { InMemoryCache } from "../data/cache.js";
import { ModelRegistry } from "../data/registry.js";
import { registerCompareProvidersTool } from "./compare-providers.js";
import { registerCompareTool } from "./compare.js";
import { registerEstimateTool } from "./estimate.js";
import { registerListTopTool } from "./list-top.js";
import { registerModelInfoTool } from "./model-info.js";
import { registerNewModelsTool } from "./new-models.js";
import { registerProvidersTool } from "./providers.js";
import { registerRecommendTool } from "./recommend.js";
import { registerSearchTool } from "./search.js";
import { registerSlugsTool } from "./slugs.js";

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

export const TOOL_NAMES = [
  "compare_models",
  "compare_providers",
  "estimate_cost",
  "get_model_info",
  "list_new_models",
  "list_providers",
  "list_model_slugs",
  "list_top_models",
  "recommend_model",
  "search_models",
] as const;

export function createRegistry(): ModelRegistry {
  return new ModelRegistry(new InMemoryCache());
}

export function registerAllTools(server: McpServer, registry: ModelRegistry): void {
  registerModelInfoTool(server, registry);
  registerListTopTool(server, registry);
  registerCompareTool(server, registry);
  registerRecommendTool(server, registry);
  registerSearchTool(server, registry);
  registerProvidersTool(server, registry);
  registerEstimateTool(server, registry);
  registerNewModelsTool(server, registry);
  registerSlugsTool(server, registry);
  registerCompareProvidersTool(server, registry);
}

export function createToolHandlers(registry: ModelRegistry): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();
  const captureServer = {
    registerTool(name: string, config: unknown, handler: ToolHandler): void {
      handlers.set(name, async (args) => handler(parseInput(config, args)));
    },
  } as unknown as McpServer;

  registerAllTools(captureServer, registry);
  return handlers;
}

function parseInput(config: unknown, args: Record<string, unknown>): Record<string, unknown> {
  if (!hasInputSchema(config)) return args;
  return z.object(config.inputSchema).parse(args);
}

function hasInputSchema(config: unknown): config is { inputSchema: z.ZodRawShape } {
  return (
    typeof config === "object" &&
    config !== null &&
    "inputSchema" in config &&
    typeof (config as { inputSchema?: unknown }).inputSchema === "object" &&
    (config as { inputSchema?: unknown }).inputSchema !== null
  );
}

export function extractTextContent(result: unknown): {
  text: string;
  isError: boolean;
} {
  if (!isToolResult(result)) return { text: "", isError: false };

  const text = result.content
    .filter((item): item is { type: "text"; text: string } => item.type === "text")
    .map((item) => item.text)
    .join("\n");

  return { text, isError: result.isError === true };
}

function isToolResult(result: unknown): result is {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
} {
  return (
    typeof result === "object" &&
    result !== null &&
    "content" in result &&
    Array.isArray((result as { content?: unknown }).content)
  );
}
