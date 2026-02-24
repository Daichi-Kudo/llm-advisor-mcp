#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { InMemoryCache } from "./data/cache.js";
import { ModelRegistry } from "./data/registry.js";
import { registerModelInfoTool } from "./tools/model-info.js";
import { registerListTopTool } from "./tools/list-top.js";
import { registerCompareTool } from "./tools/compare.js";
import { registerRecommendTool } from "./tools/recommend.js";

const server = new McpServer({
  name: "llm-advisor-mcp",
  version: "0.3.0",
});

const cache = new InMemoryCache();
const registry = new ModelRegistry(cache);

// Register tools
registerModelInfoTool(server, registry);
registerListTopTool(server, registry);
registerCompareTool(server, registry);
registerRecommendTool(server, registry);

// Graceful shutdown
process.on("SIGINT", () => {
  cache.clear();
  process.exit(0);
});

process.on("SIGTERM", () => {
  cache.clear();
  process.exit(0);
});

async function main() {
  // Pre-warm cache (non-blocking)
  registry.warmup().catch((err) => {
    console.error("Cache warmup failed (will fetch on first request):", err.message);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
