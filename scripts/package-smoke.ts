import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SERVER_NAME } from "../src/metadata.js";

const EXPECTED_TOOLS = [
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
const MAX_STDERR_CHARS = 2_000;

async function main(): Promise<void> {
  const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
  if (!process.env.SKIP_BUILD) {
    execFileSync("npm", ["run", "build"], { cwd: projectRoot, stdio: "inherit" });
  }
  const distEntry = join(projectRoot, "dist", "index.js");
  if (!existsSync(distEntry) || statSync(distEntry).size < 1000) {
    throw new Error(`${distEntry} is missing or unexpectedly small. Run npm run build first.`);
  }
  const packJson = execFileSync("npm", ["pack", "--json"], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  const packResult = JSON.parse(packJson) as { filename: string } | Array<{ filename: string }>;
  const [{ filename }] = Array.isArray(packResult) ? packResult : [packResult];
  const tarball = join(projectRoot, filename);
  const installDir = mkdtempSync(join(tmpdir(), "llm-advisor-mcp-pack-"));

  try {
    execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], {
      cwd: installDir,
      stdio: "inherit",
    });

    const bin = join(installDir, "node_modules", ".bin", "llm-advisor-mcp");
    const installedPackageRoot = join(installDir, "node_modules", "llm-advisor-mcp");
    const installedPackageJson = JSON.parse(
      readFileSync(join(installedPackageRoot, "package.json"), "utf8")
    ) as { main?: string; exports?: Record<string, unknown> };
    // The package root is intentionally non-importable (no "main" or "." export)
    // to prevent import side effects. Only the bin entry point should be used.
    if (installedPackageJson.main !== undefined) {
      throw new Error(`Expected no package main (non-importable), got: ${installedPackageJson.main}`);
    }
    if (installedPackageJson.exports?.["."] !== undefined) {
      throw new Error("Expected no package root export (non-importable), got root export");
    }
    if (!existsSync(join(installedPackageRoot, "server.json"))) {
      throw new Error("Packed package is missing server.json for MCP Registry discovery");
    }
    if (!existsSync(join(installedPackageRoot, "CHANGELOG.md"))) {
      throw new Error("Packed package is missing CHANGELOG.md release history");
    }

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
        console.error("Server stderr (truncated):");
        console.error(truncateStderr(stderr));
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

function truncateStderr(stderr: string): string {
  const trimmed = stderr.trim();
  if (trimmed.length <= MAX_STDERR_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_STDERR_CHARS)}\n... truncated ${trimmed.length - MAX_STDERR_CHARS} chars`;
}
