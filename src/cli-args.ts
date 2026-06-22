import { z } from "zod";

export type CliArgs = Record<string, unknown>;

export interface CommandSpec {
  tool: string;
  positional: string[];
  defaults?: CliArgs;
}

export class CliError extends Error {}

export function parseRunArgs(argv: string[]): CliArgs {
  const jsonIndex = argv.findIndex((arg) => arg === "--json");
  if (jsonIndex === -1) return parseFlags(argv);
  const jsonValue = argv[jsonIndex + 1];
  if (!jsonValue) throw new CliError("Missing JSON after --json.");
  try {
    return JSON.parse(jsonValue) as CliArgs;
  } catch (error) {
    throw new CliError(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function parseCommandArgs(spec: CommandSpec, argv: string[]): CliArgs {
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

  const args: CliArgs = { ...(spec.defaults ?? {}), ...parseFlags(flags) };

  for (const name of spec.positional) {
    if (name === "models") {
      if (positional.length < 2 || positional.length > 5) {
        throw new CliError("`compare` needs 2-5 model names.");
      }
      args[name] = [...positional];
      positional.length = 0;
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

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".") || "input";
      return `${path}: ${issue.message}`;
    })
    .join("\n");
}

function parseFlags(argv: string[]): CliArgs {
  const args: CliArgs = {};
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
