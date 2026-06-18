import { describe, expect, it } from "vitest";
import { parseSimpleYamlList, normalizeYamlScalar } from "../data/fetchers/aider.js";
import { extractModelName } from "../data/fetchers/swe-bench.js";
import { extractDisplayName, extractScore } from "../data/fetchers/vlm-leaderboard.js";

describe("SWE-bench helpers", () => {
  it("extracts model names from agent plus model entries", () => {
    expect(extractModelName("mini-SWE-agent + Claude 4.5 Opus (high reasoning)")).toBe("Claude 4.5 Opus");
    expect(extractModelName("live-SWE-agent + Gemini 3 Pro Preview (2025-11-18)")).toBe("Gemini 3 Pro Preview");
    expect(extractModelName("TRAE + Doubao-Seed-Code")).toBe("Doubao-Seed-Code");
  });

  it("does not guess model names from agent-only entries", () => {
    expect(extractModelName("Atlassian Rovo Dev (2025-09-02)")).toBeNull();
  });
});

describe("Aider helpers", () => {
  it("normalizes quoted YAML scalars", () => {
    expect(normalizeYamlScalar('"gpt-4.1"')).toBe("gpt-4.1");
    expect(normalizeYamlScalar("'claude-sonnet'")).toBe("claude-sonnet");
    expect(normalizeYamlScalar("raw-value")).toBe("raw-value");
  });

  it("parses flat YAML list entries and strips quoted values", () => {
    const entries = parseSimpleYamlList(`
- model: "gpt-4.1"
  pass_rate_2: 85
  edit_format: 'diff'
- model: claude-sonnet
  pass_rate_2: 75
`);

    expect(entries).toEqual([
      { model: "gpt-4.1", pass_rate_2: "85", edit_format: "diff" },
      { model: "claude-sonnet", pass_rate_2: "75" },
    ]);
  });
});

describe("VLM helpers", () => {
  it("extracts positive numeric scores from numbers and strings", () => {
    expect(extractScore({ Overall: 75.2 }, "Overall")).toBe(75.2);
    expect(extractScore({ "Final Score": "80.5" }, "Final Score")).toBe(80.5);
    expect(extractScore({ Overall: 0 }, "Overall")).toBeUndefined();
    expect(extractScore(null, "Overall")).toBeUndefined();
  });

  it("extracts display names from OpenCompass Method variants", () => {
    expect(extractDisplayName(["Claude Opus 4.6", "https://example.test"], "fallback")).toBe("Claude Opus 4.6");
    expect(extractDisplayName("Gemini 3 Pro", "fallback")).toBe("Gemini 3 Pro");
    expect(extractDisplayName(undefined, "fallback")).toBe("fallback");
  });
});
