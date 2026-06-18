#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { InMemoryCache } from "./data/cache.js";
import { ModelRegistry } from "./data/registry.js";
import { registerModelInfoTool } from "./tools/model-info.js";
import { registerListTopTool } from "./tools/list-top.js";
import { registerCompareTool } from "./tools/compare.js";
import { registerRecommendTool } from "./tools/recommend.js";
import { SERVER_NAME, SERVER_VERSION } from "./metadata.js";

const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
});

const cache = new InMemoryCache();
const registry = new ModelRegistry(cache);
let transport: StdioServerTransport | null = null;
let shuttingDown = false;

// Register tools
registerModelInfoTool(server, registry);
registerListTopTool(server, registry);
registerCompareTool(server, registry);
registerRecommendTool(server, registry);

// Graceful shutdown
function installSignalHandler(signal: NodeJS.Signals, exitCode: number): void {
  process.on(signal, () => {
    void shutdown(exitCode);
  });
}

async function shutdown(exitCode: number): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = exitCode;
  await transport?.close().catch(() => undefined);
  process.exit(exitCode);
}

installSignalHandler("SIGINT", 130);
installSignalHandler("SIGTERM", 143);
installSignalHandler("SIGHUP", 129);

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  void shutdown(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  void shutdown(1);
});

async function main() {
  // Pre-warm cache (non-blocking)
  registry.warmup().catch((err) => {
    console.error(
      "Cache warmup failed (will fetch on first request):",
      err instanceof Error ? err.message : String(err)
    );
  });

  transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
