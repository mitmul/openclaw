import { describe, expect, it, vi } from "vitest";
import { createProviderApiKeyAuthMethod } from "./provider-api-key-auth.js";

describe("createProviderApiKeyAuthMethod", () => {
  it("passes workspaceDir into applyConfig during non-interactive auth", async () => {
    const applyConfig = vi.fn(
      (cfg: Record<string, unknown>, context?: { workspaceDir?: string }) => ({
        ...cfg,
        acp: {
          backend: context?.workspaceDir === "/workspace" ? "acpx" : "missing",
        },
      }),
    );

    const method = createProviderApiKeyAuthMethod({
      providerId: "plamo",
      methodId: "api-key",
      label: "PLaMo API key",
      optionKey: "plamoApiKey",
      flagName: "--plamo-api-key",
      envVar: "PLAMO_API_KEY",
      promptMessage: "Enter PLaMo API key",
      applyConfig,
    });

    const result = await method.runNonInteractive?.({
      authChoice: "plamo-api-key",
      config: {},
      baseConfig: {},
      opts: {},
      runtime: {
        log() {},
        error() {},
        exit() {
          throw new Error("unexpected exit");
        },
      },
      workspaceDir: "/workspace",
      resolveApiKey: async () => ({
        key: "test-key",
        source: "profile",
      }),
      toApiKeyCredential: () => null,
    });

    expect(applyConfig).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ workspaceDir: "/workspace" }),
    );
    expect(result).toMatchObject({
      acp: {
        backend: "acpx",
      },
    });
  });
});
