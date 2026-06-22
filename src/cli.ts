#!/usr/bin/env node

import { createRegistry, createToolHandlers, extractTextContent, TOOL_NAMES } from "./tools/catalog.js";

type Args = Record<string, unknown>;

interface CommandSpec {
  tool: string;
  positional: string[];
  defaults?: Args;
}

const COMMANDS: Record<string, CommandSpec> = {
  info: { tool: "get_model_info", positional: ["model"] },
  top: { tool: "list_top_models", positional: ["category"], defaults: { limit: 10 } },
  compare: { tool: "compare_models", positional: ["models"] },
  recommend: { tool: "recommend_model", positional: ["use_case"] },
  search: { tool: "search_models", positional: ["query"], defaults: { limit: 10 } },
  providers: { tool: "list_providers", positional: [] },
  estimate: {
    tool: "estimate_cost",
    positional: ["model"],
    defaults: { input_tokens: 10_000, output_tokens: 2_000 },
  },
  "new-models": { tool: "list_new_models", positional: [], defaults: { max_age_days: 90, limit: 10 } },
  slugs: { tool: "list_model_slugs", positional: [] },
  "compare-providers": { tool: "compare_providers", positional: ["model"] },
};

const USAGE = `llm-advisor <command> [args] [options]

Commands:
  info <model>                         Show pricing, benchmarks, and capabilities
  top <category> [--limit 10]           List top models
  compare <model...>                    Compare 2-5 models
  recommend <use_case> [filters]        Recommend models for a use case
  search <query> [filters]              Search by model, provider, or query text
  providers [--provider anthropic]      List providers
  estimate <model> [token options]      Estimate per-call and monthly cost
  new-models [--max-age-days 90]        List recent releases
  slugs [--model claude]                List provider-specific model IDs
  compare-providers <model>             Compare provider prices for one model
  run <tool> --json '{"..."}'           Call any MCP tool directly
  tools                                 List MCP tools

Common options use kebab-case or snake_case:
  --max-input-price 3
  --max-output-price 15
  --min-context 200000
  --require-tools
  --require-vision
  --require-open-source

Examples:
  llm-advisor top coding --limit 5 --require-tools
  llm-advisor compare claude-sonnet gpt-5 gemini-pro
  llm-advisor run list_top_models --json '{"category":"coding","limit":5}'`;

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(USAGE);
    return;
  }

  const registry = createRegistry();
  const handlers = createToolHandlers(registry);
  try {
    if (command === "tools") {
      for (const tool of TOOL_NAMES) console.log(tool);
      return;
    }

    if (command === "run") {
      const [tool, ...toolArgs] = rest;
      if (!tool) throw new CliError("Missing tool name for `run`.");
      const args = parseRunArgs(toolArgs);
      await printToolResult(handlers, tool, args);
      return;
    }

    const spec = COMMANDS[command];
    if (!spec) throw new CliError(`Unknown command: ${command}`);

    const args = parseCommandArgs(spec, rest);
    await printToolResult(handlers, spec.tool, args);
  } catch (error) {
    if (error instanceof CliError) {
      console.error(error.message);
      console.error("");
      console.error(USAGE);
      process.exitCode = 2;
      return;
    }
    throw error;
  }
}

function parseRunArgs(argv: string[]): Args {
  const jsonIndex = argv.findIndex((arg) => arg === "--json");
  if (jsonIndex === -1) return parseFlags(argv);
  const jsonValue = argv[jsonIndex + 1];
  if (!jsonValue) throw new CliError("Missing JSON after --json.");
  try {
    return JSON.parse(jsonValue) as Args;
  } catch (error) {
    throw new CliError(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseCommandArgs(spec: CommandSpec, argv: string[]): Args {
  const positional: string[] = [];
  const flags: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      flags.push(arg);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags.push(next);
        i++;
      }
    } else {
      positional.push(arg);
    }
  }

  const args: Args = { ...(spec.defaults ?? {}), ...parseFlags(flags) };

  for (const name of spec.positional) {
    if (name === "models") {
      if (positional.length < 2 || positional.length > 5) {
        throw new CliError("`compare` needs 2-5 model names.");
      }
      args[name] = positional;
      continue;
    }

    const value = positional.shift();
    if (!value) throw new CliError(`Missing required argument: ${name}`);
    args[name] = value;
  }

  if (positional.length > 0) {
    throw new CliError(`Unexpected argument: ${positional[0]}`);
  }

  return args;
}

function parseFlags(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (!raw.startsWith("--")) {
      throw new CliError(`Unexpected argument: ${raw}`);
    }

    const eqIndex = raw.indexOf("=");
    const rawName = eqIndex === -1 ? raw.slice(2) : raw.slice(2, eqIndex);
    const name = rawName.replace(/-/g, "_");
    const inlineValue = eqIndex === -1 ? undefined : raw.slice(eqIndex + 1);
    const next = argv[i + 1];

    if (inlineValue !== undefined) {
      args[name] = coerceValue(inlineValue);
    } else if (next !== undefined && !next.startsWith("--")) {
      args[name] = coerceValue(next);
      i++;
    } else {
      args[name] = true;
    }
  }
  return args;
}

function coerceValue(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return value;
}

async function printToolResult(
  handlers: Map<string, (args: Record<string, unknown>) => Promise<unknown>>,
  tool: string,
  args: Args
): Promise<void> {
  const handler = handlers.get(tool);
  if (!handler) throw new CliError(`Unknown MCP tool: ${tool}`);

  const { text, isError } = extractTextContent(await runQuietly(handler, args));
  if (text) console.log(text);
  if (isError) process.exitCode = 1;
}

async function runQuietly(
  handler: (args: Record<string, unknown>) => Promise<unknown>,
  args: Args
): Promise<unknown> {
  if (process.env["LLM_ADVISOR_CLI_DEBUG"] === "1") {
    return handler(args);
  }

  const originalError = console.error;
  console.error = () => undefined;
  try {
    return await handler(args);
  } finally {
    console.error = originalError;
  }
}

class CliError extends Error {}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
