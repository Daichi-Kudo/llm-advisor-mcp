import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CliError, formatZodError, parseCommandArgs, parseRunArgs } from "../cli-args.js";

describe("CLI argument parsing", () => {
  it("parses compare models as an array and consumes all positional args", () => {
    expect(
      parseCommandArgs(
        { tool: "compare_models", positional: ["models"] },
        ["claude-sonnet", "gpt-5", "gemini-pro"]
      )
    ).toEqual({ models: ["claude-sonnet", "gpt-5", "gemini-pro"] });
  });

  it("rejects compare with too few or too many models", () => {
    expect(() =>
      parseCommandArgs({ tool: "compare_models", positional: ["models"] }, ["claude-sonnet"])
    ).toThrow(CliError);

    expect(() =>
      parseCommandArgs(
        { tool: "compare_models", positional: ["models"] },
        ["a", "b", "c", "d", "e", "f"]
      )
    ).toThrow(CliError);
  });

  it("parses flags, defaults, and scalar positional args", () => {
    expect(
      parseCommandArgs(
        { tool: "list_top_models", positional: ["category"], defaults: { limit: 10 } },
        ["coding", "--limit", "5", "--require-tools", "--max-input-price=3"]
      )
    ).toEqual({
      category: "coding",
      limit: 5,
      require_tools: true,
      max_input_price: 3,
    });
  });

  it("parses run JSON exactly", () => {
    expect(parseRunArgs(["--json", "{\"category\":\"coding\",\"limit\":5}"])).toEqual({
      category: "coding",
      limit: 5,
    });
  });

  it("formats zod errors without dumping raw issue objects", () => {
    const result = z.object({ category: z.enum(["coding"]) }).safeParse({ category: "nope" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toContain("category:");
      expect(formatZodError(result.error)).not.toContain("\"code\"");
    }
  });
});
