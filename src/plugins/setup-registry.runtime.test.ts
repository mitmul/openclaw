import { afterEach, describe, expect, it, vi } from "vitest";

const loadPluginManifestRegistryMock = vi.hoisted(() => vi.fn());

vi.mock("./manifest-registry.js", () => ({
  loadPluginManifestRegistry: loadPluginManifestRegistryMock,
}));

afterEach(() => {
  loadPluginManifestRegistryMock.mockReset();
});

describe("setup-registry runtime fallback", () => {
  it("uses bundled manifest cliBackends when the setup-registry runtime is unavailable", async () => {
    loadPluginManifestRegistryMock.mockReturnValue({
      diagnostics: [],
      plugins: [
        {
          id: "openai",
          origin: "bundled",
          cliBackends: ["legacy-openai-cli"],
          setup: {
            cliBackends: ["Codex-CLI"],
            requiresRuntime: true,
          },
        },
        {
          id: "local",
          origin: "workspace",
          cliBackends: ["local-cli"],
        },
      ],
    });

    const { __testing, resolvePluginSetupCliBackendRuntime } =
      await import("./setup-registry.runtime.js");
    __testing.resetRuntimeState();
    __testing.setRuntimeModuleForTest(null);

    expect(resolvePluginSetupCliBackendRuntime({ backend: "codex-cli" })).toEqual({
      pluginId: "openai",
      backend: { id: "Codex-CLI" },
    });
    expect(resolvePluginSetupCliBackendRuntime({ backend: "local-cli" })).toBeUndefined();
    expect(loadPluginManifestRegistryMock).toHaveBeenCalledTimes(1);
    expect(loadPluginManifestRegistryMock).toHaveBeenCalledWith({ cache: true });
  });

  it("uses bundled manifest services when the setup-registry runtime is unavailable", async () => {
    loadPluginManifestRegistryMock.mockReturnValue({
      diagnostics: [],
      plugins: [
        {
          id: "acpx",
          origin: "bundled",
          rootDir: "/bundled/acpx",
          cliBackends: [],
          setup: {
            services: ["acpx-runtime"],
          },
        },
        {
          id: "local",
          origin: "workspace",
          rootDir: "/workspace/acpx",
          cliBackends: [],
          setup: {
            services: ["workspace-runtime"],
          },
        },
      ],
    });

    const { __testing, resolvePluginSetupServiceRuntime } =
      await import("./setup-registry.runtime.js");
    __testing.resetRuntimeState();
    __testing.setRuntimeModuleForTest(null);

    expect(
      resolvePluginSetupServiceRuntime({
        pluginId: "acpx",
        serviceId: "acpx-runtime",
        rootDir: "/bundled/acpx",
      }),
    ).toEqual({
      pluginId: "acpx",
      service: { id: "acpx-runtime" },
    });
    expect(
      resolvePluginSetupServiceRuntime({
        pluginId: "acpx",
        serviceId: "acpx-runtime",
        rootDir: "/workspace/acpx",
      }),
    ).toBeUndefined();
    expect(
      resolvePluginSetupServiceRuntime({
        pluginId: "local",
        serviceId: "workspace-runtime",
        rootDir: "/workspace/acpx",
      }),
    ).toBeUndefined();
    expect(loadPluginManifestRegistryMock).toHaveBeenCalledTimes(1);
    expect(loadPluginManifestRegistryMock).toHaveBeenCalledWith({ cache: true });
  });

  it("preserves fail-closed setup lookup when the runtime module explicitly declines to resolve", async () => {
    loadPluginManifestRegistryMock.mockReturnValue({
      diagnostics: [],
      plugins: [
        {
          id: "openai",
          origin: "bundled",
          cliBackends: ["legacy-openai-cli"],
          setup: {
            cliBackends: ["Codex-CLI"],
            requiresRuntime: true,
          },
        },
      ],
    });

    const { __testing, resolvePluginSetupCliBackendRuntime, resolvePluginSetupServiceRuntime } =
      await import("./setup-registry.runtime.js");
    __testing.resetRuntimeState();
    __testing.setRuntimeModuleForTest({
      resolvePluginSetupCliBackend: () => undefined,
      resolvePluginSetupService: () => undefined,
    });

    expect(resolvePluginSetupCliBackendRuntime({ backend: "codex-cli" })).toBeUndefined();
    expect(
      resolvePluginSetupServiceRuntime({ pluginId: "acpx", serviceId: "acpx-runtime" }),
    ).toBeUndefined();
    expect(loadPluginManifestRegistryMock).not.toHaveBeenCalled();
  });
});
