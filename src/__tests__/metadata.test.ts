import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import serverJson from "../../server.json";
import { MCP_REGISTRY_NAME, SERVER_NAME, SERVER_VERSION } from "../metadata.js";

describe("server metadata", () => {
  it("matches package metadata used for MCP registration", () => {
    expect(SERVER_NAME).toBe(packageJson.name);
    expect(SERVER_VERSION).toBe(packageJson.version);
    expect(MCP_REGISTRY_NAME).toBe(packageJson.mcpName);
  });

  it("keeps MCP registry metadata aligned with server.json constraints", () => {
    expect(serverJson.name).toBe(packageJson.mcpName);
    expect(serverJson.version).toBe(packageJson.version);
    expect(serverJson.description.length).toBeLessThanOrEqual(100);
    expect(packageJson.files).toContain("server.json");

    const [npmPackage] = serverJson.packages;
    expect(serverJson.packages).toHaveLength(1);
    expect(npmPackage.registryType).toBe("npm");
    expect(npmPackage.identifier).toBe(packageJson.name);
    expect(npmPackage.version).toBe(packageJson.version);
    expect(npmPackage.transport.type).toBe("stdio");
    expect(npmPackage.environmentVariables).toEqual([]);
  });
});
