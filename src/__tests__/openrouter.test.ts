import { describe, expect, it } from "vitest";
import { isOpenSource } from "../data/fetchers/openrouter.js";

describe("isOpenSource", () => {
  it("does not classify proprietary Google Gemini models as open-source", () => {
    expect(isOpenSource("google/gemini-3.1-pro")).toBe(false);
  });

  it("classifies Google Gemma models as open-source", () => {
    expect(isOpenSource("google/gemma-3-27b-it")).toBe(true);
  });

  it("classifies common open-weight providers beyond the original allowlist", () => {
    expect(isOpenSource("internlm/internlm3-8b-instruct")).toBe(true);
    expect(isOpenSource("snowflake/arctic-instruct")).toBe(true);
  });
});
