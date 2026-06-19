#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { InMemoryCache } from "./data/cache.js";
import { ModelRegistry } from "./data/registry.js";
import { registerModelInfoTool } from "./tools/model-info.js";
import { registerListTopTool } from "./tools/list-top.js";
import { registerCompareTool } from "./tools/compare.js";
import { registerRecommendTool } from "./tools/recommend.js";
import { registerSearchTool } from "./tools/search.js";
import { registerProvidersTool } from "./tools/providers.js";
import { registerEstimateTool } from "./tools/estimate.js";
import { registerNewModelsTool } from "./tools/new-models.js";
import { registerSlugsTool } from "./tools/slugs.js";
import { registerCompareProvidersTool } from "./tools/compare-providers.js";
import { SERVER_NAME, SERVER_VERSION } from "./metadata.js";

const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
});

const cache = new InMemoryCache();
const registry = new ModelRegistry(cache);
let shuttingDown = false;

// Shared transport reference — set in main()
let httpTransport: StreamableHTTPServerTransport | null = null;

// Register tools
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
  try {
    if (httpTransport) {
      await httpTransport.close();
    }
  } catch (error) {
    console.error("Shutdown: transport close failed:", error);
  }
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

async function main(): Promise<void> {
  // Pre-warm cache (non-blocking, unless SMOKE_LIVE=0 skips it)
  if (process.env["LLM_ADVISOR_MCP_SKIP_WARMUP"] !== "1") {
    registry.warmup().catch((err) => {
      console.error(
        "Cache warmup failed (will fetch on first request):",
        err instanceof Error ? err.message : String(err)
      );
    });
  }

  const httpPort = process.env["MCP_HTTP_PORT"] || process.env["PORT"];
  if (httpPort) {
    await startHttp(parseInt(httpPort, 10));
  } else {
    await startStdio();
  }
}

async function startStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function startHttp(port: number): Promise<void> {
  httpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () =>
      crypto.randomUUID(),
  });

  const app = createMcpExpressApp();

  // POST endpoint for JSON-RPC messages
  app.post("/mcp", (req, res) => {
    void httpTransport!.handleRequest(req, res, req.body);
  });

  // GET endpoint for SSE streaming (required by Streamable HTTP)
  app.get("/mcp", (req, res) => {
    void httpTransport!.handleRequest(req, res);
  });

  // Health check
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      server: SERVER_NAME,
      version: SERVER_VERSION,
      tools: 10,
    });
  });

  await server.connect(httpTransport);
  app.listen(port, () => {
    console.error(`${SERVER_NAME} v${SERVER_VERSION} running in HTTP mode on port ${port}`);
    console.error(`MCP endpoint: http://localhost:${port}/mcp`);
    console.error(`Health check: http://localhost:${port}/health`);
  });
}

main().catch((err) => {
  if (shuttingDown) return;
  console.error("Fatal:", err);
  void shutdown(1);
});
