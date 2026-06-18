import { describe, expect, it } from "vitest";
import { isoDateSchema } from "../tools/schemas.js";

describe("tool input schemas", () => {
  it("accepts valid ISO calendar dates", () => {
    expect(isoDateSchema.parse("2026-02-28")).toBe("2026-02-28");
    expect(isoDateSchema.parse("2024-02-29")).toBe("2024-02-29");
  });

  it("rejects impossible dates even when they match YYYY-MM-DD", () => {
    expect(() => isoDateSchema.parse("2026-02-29")).toThrow();
    expect(() => isoDateSchema.parse("2026-13-01")).toThrow();
    expect(() => isoDateSchema.parse("2026-00-10")).toThrow();
  });

  it("rejects non-date strings", () => {
    expect(() => isoDateSchema.parse("2026-2-1")).toThrow();
    expect(() => isoDateSchema.parse("not-a-date")).toThrow();
  });
});
