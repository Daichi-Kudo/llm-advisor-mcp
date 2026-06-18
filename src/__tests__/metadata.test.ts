import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import { MCP_REGISTRY_NAME, SERVER_NAME, SERVER_VERSION } from "../metadata.js";

describe("server metadata", () => {
  it("matches package metadata used for MCP registration", () => {
    expect(SERVER_NAME).toBe(packageJson.name);
    expect(SERVER_VERSION).toBe(packageJson.version);
    expect(MCP_REGISTRY_NAME).toBe(packageJson.mcpName);
  });
});
