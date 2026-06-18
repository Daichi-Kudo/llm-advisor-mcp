import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SERVER_NAME } from "../src/metadata.js";

const DIST_ENTRY = "dist/index.js";
const EXPECTED_TOOLS = [
  "get_model_info",
  "list_top_models",
  "compare_models",
  "recommend_model",
] as const;

function textContent(result: Awaited<ReturnType<Client["callTool"]>>): string {
  const content = (result as { content?: unknown }).content;
  assert(Array.isArray(content), "tool response should contain a content array");
  const first = content[0];
  assert(first?.type === "text", "tool response should contain text content");
  return first.text;
}

async function main(): Promise<void> {
  execFileSync("npm", ["run", "build"], { stdio: "inherit" });
  assert(existsSync(DIST_ENTRY), `${DIST_ENTRY} does not exist. Run npm run build first.`);

  const client = new Client({ name: "llm-advisor-mcp-smoke", version: "0.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [DIST_ENTRY],
    stderr: "pipe",
  });

  let stderr = "";
  transport.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });

  try {
    await client.connect(transport);

    const serverVersion = client.getServerVersion();
    assert.equal(serverVersion?.name, SERVER_NAME);
    assert.match(serverVersion?.version ?? "", /^\d+\.\d+\.\d+/);

    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, [...EXPECTED_TOOLS].sort());

    for (const toolName of EXPECTED_TOOLS) {
      const tool = tools.find((candidate) => candidate.name === toolName);
      assert(tool, `missing tool ${toolName}`);
      assert(tool.description?.includes("llm-advisor"), `${toolName} missing versioned description`);
      assert.equal(tool.annotations?.readOnlyHint, true, `${toolName} should be read-only`);
      assert.equal(tool.annotations?.destructiveHint, false, `${toolName} should be non-destructive`);
      assert.equal(tool.annotations?.idempotentHint, true, `${toolName} should be idempotent`);
      assert.equal(tool.annotations?.openWorldHint, true, `${toolName} should query open-world data`);
      assert.equal(tool.inputSchema.type, "object", `${toolName} should expose an object input schema`);
    }

    if (process.env.LLM_ADVISOR_MCP_SMOKE_LIVE !== "0") {
      const result = await client.callTool({
        name: "list_top_models",
        arguments: { category: "context-window", limit: 1 },
      });
      const text = textContent(result);
      assert.match(text, /Top 1: context-window/);
      assert.match(text, /\| 1 \| [^|]+\//);
    }

    console.log(`MCP smoke passed: ${tools.length} tools, server ${serverVersion?.version}`);
  } catch (error) {
    if (stderr.trim()) {
      console.error("Server stderr:");
      console.error(stderr.trim());
    }
    throw error;
  } finally {
    await client.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
