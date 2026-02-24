import { describe, it, expect } from "vitest";
import { computeFreshnessBonus } from "../tools/recommend.js";

describe("computeFreshnessBonus", () => {
  it("returns 3 for models released within last 3 months", () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 30); // 30 days ago
    expect(computeFreshnessBonus(recent.toISOString().split("T")[0])).toBe(3);
  });

  it("returns 3 for models released today", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(computeFreshnessBonus(today)).toBe(3);
  });

  it("returns 1 for models released 4 months ago", () => {
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setDate(fourMonthsAgo.getDate() - 120); // ~4 months
    expect(computeFreshnessBonus(fourMonthsAgo.toISOString().split("T")[0])).toBe(1);
  });

  it("returns 0 for models released over 6 months ago", () => {
    const old = new Date();
    old.setDate(old.getDate() - 200); // ~7 months
    expect(computeFreshnessBonus(old.toISOString().split("T")[0])).toBe(0);
  });

  it("returns 0 for undefined releaseDate", () => {
    expect(computeFreshnessBonus(undefined)).toBe(0);
  });

  it("returns 0 for invalid date string", () => {
    expect(computeFreshnessBonus("not-a-date")).toBe(0);
  });
});
