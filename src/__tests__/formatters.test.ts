import { describe, it, expect } from "vitest";
import {
  fmtPrice,
  fmtContext,
  fmtScore,
  fmtElo,
  fmtModalities,
  escapeMarkdownInline,
  buildMarkdownTable,
  formatModelDetail,
} from "../tools/formatters.js";
import type { UnifiedModel } from "../types.js";

describe("fmtPrice", () => {
  it("formats zero as 'free'", () => expect(fmtPrice(0)).toBe("free"));
  it("formats undefined as 'n/a'", () => expect(fmtPrice(undefined)).toBe("n/a"));
  it("formats null as 'n/a'", () => expect(fmtPrice(null as unknown as undefined)).toBe("n/a"));
  it("does not round very small non-zero prices to free-looking zeroes", () => expect(fmtPrice(0.00003)).toBe("$0.00003"));
  it("formats tiny prices without misleading trailing zeroes", () => {
    expect(fmtPrice(0.00001)).toBe("$0.00001");
    expect(fmtPrice(0.0000999)).toBe("$0.0000999");
  });
  it("formats small prices with 4 decimals", () => expect(fmtPrice(0.005)).toBe("$0.0050"));
  it("formats normal prices with 2 decimals", () => expect(fmtPrice(3.0)).toBe("$3.00"));
});

describe("escapeMarkdownInline", () => {
  it("escapes inline Markdown control characters and collapses newlines", () => {
    expect(escapeMarkdownInline("model_[x](y)#1\nnext")).toBe("model\\_\\[x\\]\\(y\\)\\#1 next");
  });
});

describe("fmtContext", () => {
  it("formats millions", () => expect(fmtContext(1_000_000)).toBe("1M"));
  it("floors non-round millions instead of overstating context", () => expect(fmtContext(1_999_999)).toBe("1.9M"));
  it("formats thousands", () => expect(fmtContext(128_000)).toBe("128K"));
  it("formats small numbers", () => expect(fmtContext(512)).toBe("512"));
  it("formats zero explicitly", () => expect(fmtContext(0)).toBe("0"));
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

  it("escapes Markdown table separators in cells", () => {
    const table = buildMarkdownTable(["A|B", "C"], [["x|y", "z\nq"]]);
    expect(table).toContain("A\\|B");
    expect(table).toContain("x\\|y");
    expect(table).toContain("z q");
  });

  it("skips short rows and trims extra cells", () => {
    const table = buildMarkdownTable(["A", "B"], [["short"], ["1", "2", "extra"]]);
    expect(table).not.toContain("short");
    expect(table).toContain("| 1 | 2 |");
    expect(table).not.toContain("extra");
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
    expect(output).toContain("## anthropic/claude\\-opus\\-4\\.6");
  });

  it("escapes external Markdown in headings and metadata", () => {
    const output = formatModelDetail(makeModel({
      id: "provider/model_[x](y)#1",
      metadata: { provider: "provider_[x](y)#1", family: "test", isOpenSource: false },
    }));

    expect(output).toContain("## provider/model\\_\\[x\\]\\(y\\)\\#1");
    expect(output).toContain("**Provider**: provider\\_\\[x\\]\\(y\\)\\#1");
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
