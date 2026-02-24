import { describe, it, expect } from "vitest";
import {
  fmtPrice,
  fmtContext,
  fmtScore,
  fmtElo,
  fmtModalities,
  buildMarkdownTable,
  formatModelDetail,
} from "../tools/formatters.js";
import type { UnifiedModel } from "../types.js";

describe("fmtPrice", () => {
  it("formats zero as 'free'", () => expect(fmtPrice(0)).toBe("free"));
  it("formats undefined as 'n/a'", () => expect(fmtPrice(undefined)).toBe("n/a"));
  it("formats small prices with 4 decimals", () => expect(fmtPrice(0.005)).toBe("$0.0050"));
  it("formats normal prices with 2 decimals", () => expect(fmtPrice(3.0)).toBe("$3.00"));
});

describe("fmtContext", () => {
  it("formats millions", () => expect(fmtContext(1_000_000)).toBe("1M"));
  it("formats thousands", () => expect(fmtContext(128_000)).toBe("128K"));
  it("formats small numbers", () => expect(fmtContext(512)).toBe("512"));
  it("handles undefined", () => expect(fmtContext(undefined)).toBe("n/a"));
});

describe("fmtScore", () => {
  it("formats percentage", () => expect(fmtScore(72.1)).toBe("72.1%"));
  it("handles undefined", () => expect(fmtScore(undefined)).toBe("n/a"));
});

describe("fmtElo", () => {
  it("formats elo as integer", () => expect(fmtElo(1342.7)).toBe("1343"));
  it("handles undefined", () => expect(fmtElo(undefined)).toBe("n/a"));
});

describe("fmtModalities", () => {
  it("joins modalities with +", () => expect(fmtModalities(["text", "image"])).toBe("text+image"));
  it("defaults to text for empty", () => expect(fmtModalities([])).toBe("text"));
});

describe("buildMarkdownTable", () => {
  it("builds basic table", () => {
    const table = buildMarkdownTable(["A", "B"], [["1", "2"], ["3", "4"]]);
    expect(table).toContain("| A | B |");
    expect(table).toContain("| 1 | 2 |");
    expect(table).toContain("| 3 | 4 |");
  });

  it("truncates with note when exceeding maxRows", () => {
    const rows = Array.from({ length: 15 }, (_, i) => [String(i)]);
    const table = buildMarkdownTable(["X"], rows, 10);
    expect(table).toContain("+5 more");
  });
});

describe("formatModelDetail", () => {
  function makeModel(overrides: Partial<UnifiedModel> = {}): UnifiedModel {
    return {
      id: "anthropic/claude-opus-4.6",
      slug: "anthropic-claude-opus-4.6",
      name: "Claude Opus 4.6",
      pricing: { input: 15, output: 75 },
      benchmarks: { arenaElo: 1350, sweBenchVerified: 72 },
      capabilities: {
        contextLength: 200_000,
        inputModalities: ["text", "image"],
        outputModalities: ["text"],
        supportsTools: true,
        supportsStreaming: true,
        supportsReasoning: true,
      },
      metadata: {
        provider: "anthropic",
        family: "claude",
        isOpenSource: false,
      },
      percentiles: { coding: 95, general: 98 },
      lastUpdated: new Date().toISOString(),
      ...overrides,
    };
  }

  it("includes model ID as heading", () => {
    const output = formatModelDetail(makeModel());
    expect(output).toContain("## anthropic/claude-opus-4.6");
  });

  it("shows pricing section", () => {
    const output = formatModelDetail(makeModel());
    expect(output).toContain("$15.00");
    expect(output).toContain("$75.00");
  });

  it("shows benchmark scores", () => {
    const output = formatModelDetail(makeModel());
    expect(output).toContain("SWE-bench Verified");
    expect(output).toContain("72.0%");
    expect(output).toContain("Arena Elo");
    expect(output).toContain("1350");
  });

  it("shows percentile ranks when present", () => {
    const output = formatModelDetail(makeModel());
    expect(output).toContain("Percentile Ranks");
    expect(output).toContain("Coding");
    expect(output).toContain("P95");
    expect(output).toContain("General");
    expect(output).toContain("P98");
  });

  it("omits percentile section when empty", () => {
    const output = formatModelDetail(makeModel({ percentiles: {} }));
    expect(output).not.toContain("Percentile Ranks");
  });

  it("shows capabilities", () => {
    const output = formatModelDetail(makeModel());
    expect(output).toContain("Tools");
    expect(output).toContain("Reasoning");
    expect(output).toContain("Vision");
  });

  it("shows release date when present", () => {
    const output = formatModelDetail(makeModel({
      metadata: { provider: "anthropic", family: "claude", isOpenSource: false, releaseDate: "2026-01-15" },
    }));
    expect(output).toContain("**Released**: 2026-01-15");
  });

  it("omits release date when absent", () => {
    const output = formatModelDetail(makeModel());
    expect(output).not.toContain("Released");
  });
});
