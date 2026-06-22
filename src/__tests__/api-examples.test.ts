import { describe, expect, it } from "vitest";
import { getApiExample } from "../data/static/api-examples.js";

describe("getApiExample", () => {
  it("escapes model ids inside Python string literals without changing safe shell characters", () => {
    const example = getApiExample("openai_sdk", 'provider/model"with\\chars$`');

    expect(example?.code).toContain('model="provider/model\\"with\\\\chars$`"');
  });

  it("escapes single quotes in curl single-quoted JSON payloads", () => {
    const example = getApiExample("curl", "provider/model'with-quote");

    expect(example?.code).toContain(`"model": "provider/model'"'"'with-quote"`);
  });

  it("returns null for unknown formats", () => {
    expect(getApiExample("unknown", "provider/model")).toBeNull();
  });
});
