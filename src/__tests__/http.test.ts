import { describe, expect, it, vi } from "vitest";
import { readResponseJson, readResponseText } from "../data/fetchers/http.js";

describe("HTTP response readers", () => {
  it("reads streamed response text within the byte limit", async () => {
    const response = new Response("hello world", {
      headers: { "content-type": "text/plain" },
    });

    await expect(readResponseText(response, 20, "test source")).resolves.toBe("hello world");
  });

  it("rejects streamed responses that exceed the byte limit", async () => {
    const response = new Response("hello world");

    await expect(readResponseText(response, 5, "test source")).rejects.toThrow(
      /test source response exceeded 5 bytes/
    );
  });

  it("rejects responses whose content-length is over the byte limit before reading", async () => {
    const response = new Response("small", {
      headers: { "content-length": "100" },
    });

    await expect(readResponseText(response, 10, "test source")).rejects.toThrow(
      /test source response too large: 100 bytes/
    );
  });

  it("falls back to response.text when a non-streamed response declares a bounded content length", async () => {
    const response = {
      headers: new Headers({ "content-length": "5" }),
      body: null,
      text: vi.fn(async () => "hello"),
    } as unknown as Response;

    await expect(readResponseText(response, 10, "test source")).resolves.toBe("hello");
    expect(response.text).toHaveBeenCalledOnce();

    const oversized = {
      headers: new Headers({ "content-length": "5" }),
      body: null,
      text: vi.fn(async () => "hello"),
    } as unknown as Response;
    await expect(readResponseText(oversized, 4, "test source")).rejects.toThrow(
      /test source response too large: 5 bytes/
    );
  });

  it("rejects non-streamed responses without content-length before reading", async () => {
    const response = {
      headers: new Headers(),
      body: null,
      text: vi.fn(async () => "hello"),
    } as unknown as Response;

    await expect(readResponseText(response, 10, "test source")).rejects.toThrow(
      /no readable body and no content-length/
    );
    expect(response.text).not.toHaveBeenCalled();
  });

  it("parses bounded JSON responses", async () => {
    const response = new Response(JSON.stringify({ ok: true }));

    await expect(readResponseJson<{ ok: boolean }>(response, 100, "json source")).resolves.toEqual({ ok: true });
  });

  it("propagates malformed JSON errors after bounded reading", async () => {
    const response = new Response("not json");

    await expect(readResponseJson(response, 100, "json source")).rejects.toThrow(SyntaxError);
  });
});
