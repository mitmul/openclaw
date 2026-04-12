import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/types.js";
import type { PluginManifestRecord } from "../plugins/manifest-registry.js";
import { __testing as setupRegistryRuntimeTesting } from "../plugins/setup-registry.runtime.js";

const { loadPluginManifestRegistryMock } = vi.hoisted(() => {
  return {
    loadPluginManifestRegistryMock:
      vi.fn<typeof import("../plugins/manifest-registry.js").loadPluginManifestRegistry>(),
  };
});

vi.mock("../plugins/manifest-registry.js", async () => {
  const actual = await vi.importActual<typeof import("../plugins/manifest-registry.js")>(
    "../plugins/manifest-registry.js",
  );
  return {
    ...actual,
    loadPluginManifestRegistry: loadPluginManifestRegistryMock,
  };
});

describe("provider-onboard explicit install matching", () => {
  let effectivePluginRegistersService: typeof import("./provider-onboard.js").effectivePluginRegistersService;

  beforeAll(async () => {
    ({ effectivePluginRegistersService } = await import("./provider-onboard.js"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    loadPluginManifestRegistryMock.mockReset();
    setupRegistryRuntimeTesting.resetRuntimeState();
  });

  it("matches explicit tracked file paths case-insensitively on Windows", () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("win32");
    loadPluginManifestRegistryMock.mockReturnValue({
      diagnostics: [],
      plugins: [
        {
          id: "plamo",
          origin: "bundled",
          rootDir: "/tmp/Bundled/plamo",
          source: "/tmp/Bundled/plamo",
          manifestPath: "/tmp/Bundled/plamo/openclaw.plugin.json",
          channels: [],
          providers: ["plamo"],
          cliBackends: [],
          skills: [],
          hooks: [],
          enabledByDefault: true,
        },
        {
          id: "plamo",
          origin: "global",
          rootDir: "/tmp/Global/plamo",
          source: "/tmp/Plugins/plamo/index.js",
          manifestPath: "/tmp/Global/plamo/openclaw.plugin.json",
          channels: [],
          providers: ["plamo"],
          cliBackends: [],
          skills: [],
          hooks: [],
        },
      ] satisfies PluginManifestRecord[],
    });
    setupRegistryRuntimeTesting.setRuntimeModuleForTest({
      resolvePluginSetupCliBackend: () => undefined,
      resolvePluginSetupService: ({ rootDir, pluginId, serviceId }) => {
        if (rootDir !== "/tmp/Global/plamo" || pluginId !== "plamo" || serviceId !== "auth") {
          return undefined;
        }
        return {
          pluginId,
          service: {
            id: serviceId,
            start: () => {},
          },
        };
      },
    });

    const cfg: OpenClawConfig = {
      plugins: {
        installs: {
          plamo: {
            source: "path",
            sourcePath: "/tmp/plugins/PLAMO/index.js",
          },
        },
      },
    };

    expect(effectivePluginRegistersService({ cfg, pluginId: "plamo", serviceId: "auth" })).toBe(
      true,
    );
  });

  it("uses bundled setup service descriptors when the setup runtime module is unavailable", () => {
    loadPluginManifestRegistryMock.mockReturnValue({
      diagnostics: [],
      plugins: [
        {
          id: "acpx",
          origin: "bundled",
          rootDir: "/tmp/Bundled/acpx",
          source: "/tmp/Bundled/acpx/index.js",
          manifestPath: "/tmp/Bundled/acpx/openclaw.plugin.json",
          channels: [],
          providers: [],
          cliBackends: [],
          skills: [],
          hooks: [],
          enabledByDefault: true,
          setup: {
            services: ["acpx-runtime"],
          },
        },
      ] satisfies PluginManifestRecord[],
    });
    setupRegistryRuntimeTesting.setRuntimeModuleForTest(null);

    expect(
      effectivePluginRegistersService({ cfg: {}, pluginId: "acpx", serviceId: "acpx-runtime" }),
    ).toBe(true);
  });
});
