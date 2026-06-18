import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SERVER_NAME } from "../src/metadata.js";

const EXPECTED_TOOLS = [
  "get_model_info",
  "list_top_models",
  "compare_models",
  "recommend_model",
] as const;

async function main(): Promise<void> {
  const projectRoot = resolve(new URL("..", import.meta.url).pathname);
  execFileSync("npm", ["run", "build"], { cwd: projectRoot, stdio: "inherit" });
  const packJson = execFileSync("npm", ["pack", "--json"], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  const [{ filename }] = JSON.parse(packJson) as Array<{ filename: string }>;
  const tarball = join(projectRoot, filename);
  const installDir = mkdtempSync(join(tmpdir(), "llm-advisor-mcp-pack-"));

  try {
    execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], {
      cwd: installDir,
      stdio: "inherit",
    });

    const bin = join(installDir, "node_modules", ".bin", "llm-advisor-mcp");
    const client = new Client({ name: "llm-advisor-package-smoke", version: "0.0.0" });
    const transport = new StdioClientTransport({ command: bin, stderr: "pipe" });
    let stderr = "";
    transport.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });

    try {
      await client.connect(transport);
      const serverVersion = client.getServerVersion();
      if (serverVersion?.name !== SERVER_NAME) {
        throw new Error(`Unexpected server name: ${serverVersion?.name ?? "missing"}`);
      }

      const { tools } = await client.listTools();
      const names = tools.map((tool) => tool.name).sort();
      const expected = [...EXPECTED_TOOLS].sort();
      if (JSON.stringify(names) !== JSON.stringify(expected)) {
        throw new Error(`Unexpected tools: ${names.join(", ")}`);
      }

      console.log(`Package smoke passed: ${filename}, ${tools.length} tools, server ${serverVersion.version}`);
    } catch (error) {
      if (stderr.trim()) {
        console.error("Server stderr:");
        console.error(stderr.trim());
      }
      throw error;
    } finally {
      await client.close().catch(() => undefined);
    }
  } finally {
    rmSync(tarball, { force: true });
    rmSync(installDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
