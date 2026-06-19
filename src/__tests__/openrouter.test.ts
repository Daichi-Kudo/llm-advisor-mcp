import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryCache } from "../data/cache.js";
import { fetchOpenRouterModels, isOpenSource } from "../data/fetchers/openrouter.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

  it("only treats Grok 1, not proprietary later Grok releases, as open-source", () => {
    expect(isOpenSource("x-ai/grok-1")).toBe(true);
    expect(isOpenSource("x-ai/grok-1-beta")).toBe(true);
    expect(isOpenSource("x-ai/grok-1.5")).toBe(false);
    expect(isOpenSource("x-ai/grok-2")).toBe(false);
  });
});

describe("fetchOpenRouterModels", () => {
  it("defaults optional architecture and top_provider fields when upstream omits them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(
        JSON.stringify({
          data: [
            {
              id: "test/model",
              name: "Test Model",
              created: 1_700_000_000,
              context_length: 128_000,
              pricing: { prompt: "0.000001", completion: "0.000002", request: "0.01" },
              supported_parameters: [],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      ))
    );

    const models = await fetchOpenRouterModels(new InMemoryCache());

    expect(models).toHaveLength(1);
    expect(models[0].capabilities.inputModalities).toEqual(["text"]);
    expect(models[0].capabilities.outputModalities).toEqual(["text"]);
    expect(models[0].capabilities.maxOutputTokens).toBeUndefined();
    expect(models[0].pricing.request).toBe(0.01);
  });

  it("rejects invalid upstream pricing instead of treating it as free", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(
        JSON.stringify({
          data: [
            {
              id: "test/invalid-price",
              name: "Invalid Price",
              created: 1_700_000_000,
              context_length: 128_000,
              pricing: { prompt: "not available", completion: "0.000002" },
              supported_parameters: [],
            },
            {
              id: "test/valid-price",
              name: "Valid Price",
              created: 1_700_000_000,
              context_length: 128_000,
              pricing: { prompt: "0.000001", completion: "0.000002" },
              supported_parameters: [],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      ))
    );

    const models = await fetchOpenRouterModels(new InMemoryCache());

    expect(models.map((model) => model.id)).toEqual(["test/valid-price"]);
  });
});
