import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
    const installedPackageJson = JSON.parse(
      readFileSync(join(installDir, "node_modules", "llm-advisor-mcp", "package.json"), "utf8")
    ) as { main?: string; exports?: Record<string, unknown> };
    if (installedPackageJson.main !== "dist/index.js") {
      throw new Error(`Unexpected package main: ${installedPackageJson.main ?? "missing"}`);
    }
    if (installedPackageJson.exports?.["."] !== "./dist/index.js") {
      throw new Error("Package root export should point at ./dist/index.js");
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
