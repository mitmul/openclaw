import {
  resolveAgentModelFallbackValues,
  resolveAgentModelPrimaryValue,
} from "openclaw/plugin-sdk/provider-onboard";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createConfigWithFallbacks,
  EXPECTED_FALLBACKS,
} from "../../test/helpers/plugins/onboard-config.js";

const loadPluginManifestRegistry = vi.hoisted(() => vi.fn());
const resolvePluginSetupServiceRuntime = vi.hoisted(() => vi.fn());

vi.mock("../../src/plugins/manifest-registry.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/plugins/manifest-registry.js")>();
  return {
    ...actual,
    loadPluginManifestRegistry,
  };
});

vi.mock("../../src/plugins/setup-registry.runtime.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/plugins/setup-registry.runtime.js")>();
  return {
    ...actual,
    resolvePluginSetupServiceRuntime,
  };
});

import { applyPlamoConfig, applyPlamoProviderConfig, PLAMO_DEFAULT_MODEL_REF } from "./onboard.js";

function manifest(params: {
  id: string;
  origin?: "bundled" | "workspace" | "global" | "config";
  enabledByDefault?: boolean;
  cliBackends?: string[];
  source?: string;
  rootDir?: string;
}) {
  return {
    id: params.id,
    enabledByDefault: params.enabledByDefault,
    channels: [],
    providers: [],
    cliBackends: params.cliBackends ?? [],
    skills: [],
    hooks: [],
    origin: params.origin ?? "bundled",
    rootDir: params.rootDir ?? `/tmp/${params.id}`,
    source: params.source ?? `/tmp/${params.id}/index.ts`,
    manifestPath: `/tmp/${params.id}/openclaw.plugin.json`,
  };
}

describe("plamo onboard", () => {
  beforeEach(() => {
    loadPluginManifestRegistry.mockReset();
    resolvePluginSetupServiceRuntime.mockReset();
    loadPluginManifestRegistry.mockReturnValue({
      plugins: [],
      diagnostics: [],
    });
    resolvePluginSetupServiceRuntime.mockReturnValue(undefined);
  });

  it("adds the PLaMo provider in provider-only mode without changing the primary model", () => {
    const cfg = applyPlamoProviderConfig({
      agents: {
        defaults: {
          model: { primary: "openai/gpt-5.4" },
        },
      },
    });

    expect(cfg.models?.providers?.plamo).toMatchObject({
      baseUrl: "https://api.platform.preferredai.jp/v1",
      api: "openai-completions",
    });
    expect(resolveAgentModelPrimaryValue(cfg.agents?.defaults?.model)).toBe("openai/gpt-5.4");
  });

  it("sets the default model and ACP backend when the effective acpx plugin exposes the backend", () => {
    loadPluginManifestRegistry.mockReturnValue({
      plugins: [
        manifest({
          id: "acpx",
          enabledByDefault: true,
        }),
      ],
      diagnostics: [],
    });
    resolvePluginSetupServiceRuntime.mockReturnValue({
      pluginId: "acpx",
      service: { id: "acpx-runtime" },
    });

    const cfg = applyPlamoConfig({});
    expect(resolveAgentModelPrimaryValue(cfg.agents?.defaults?.model)).toBe(
      PLAMO_DEFAULT_MODEL_REF,
    );
    expect(cfg.acp?.backend).toBe("acpx");
  });

  it("does not default ACP backend when the winning acpx plugin lacks the acpx backend capability", () => {
    loadPluginManifestRegistry.mockReturnValue({
      plugins: [
        manifest({
          id: "acpx",
          origin: "config",
          source: "/overrides/acpx/index.ts",
          rootDir: "/overrides/acpx",
        }),
        manifest({
          id: "acpx",
          enabledByDefault: true,
          source: "/bundled/acpx/index.ts",
          rootDir: "/bundled/acpx",
        }),
      ],
      diagnostics: [],
    });

    const cfg = applyPlamoConfig({});
    expect(resolveAgentModelPrimaryValue(cfg.agents?.defaults?.model)).toBe(
      PLAMO_DEFAULT_MODEL_REF,
    );
    expect(cfg.acp?.backend).toBeUndefined();
  });

  it("does not default ACP backend when the effective acpx plugin is disabled", () => {
    loadPluginManifestRegistry.mockReturnValue({
      plugins: [
        manifest({
          id: "acpx",
          enabledByDefault: true,
        }),
      ],
      diagnostics: [],
    });
    resolvePluginSetupServiceRuntime.mockReturnValue({
      pluginId: "acpx",
      service: { id: "acpx-runtime" },
    });

    const cfg = applyPlamoConfig({
      plugins: {
        entries: {
          acpx: {
            enabled: false,
          },
        },
      },
    });

    expect(cfg.acp?.backend).toBeUndefined();
  });

  it("uses workspace-scoped plugin discovery when onboarding receives a workspaceDir", () => {
    loadPluginManifestRegistry.mockImplementation((params?: { workspaceDir?: string }) => ({
      plugins:
        params?.workspaceDir === "/workspace"
          ? [
              manifest({
                id: "acpx",
                origin: "workspace",
                enabledByDefault: true,
                source: "/workspace/.openclaw/extensions/acpx/index.ts",
                rootDir: "/workspace/.openclaw/extensions/acpx",
              }),
            ]
          : [],
      diagnostics: [],
    }));
    resolvePluginSetupServiceRuntime.mockImplementation(
      (params?: {
        workspaceDir?: string;
        pluginId?: string;
        serviceId?: string;
        rootDir?: string;
      }) =>
        params?.workspaceDir === "/workspace" &&
        params.pluginId === "acpx" &&
        params.serviceId === "acpx-runtime" &&
        params.rootDir === "/workspace/.openclaw/extensions/acpx"
          ? { pluginId: "acpx", service: { id: "acpx-runtime" } }
          : undefined,
    );

    const cfg = {
      plugins: {
        entries: {
          acpx: {
            enabled: true,
          },
        },
      },
    };

    const withoutWorkspace = applyPlamoConfig(cfg);
    const withWorkspace = applyPlamoConfig(cfg, { workspaceDir: "/workspace" });

    expect(withoutWorkspace.acp?.backend).toBeUndefined();
    expect(withWorkspace.acp?.backend).toBe("acpx");
  });

  it("does not accept acpx runtime service registrations from a losing duplicate plugin record", () => {
    loadPluginManifestRegistry.mockReturnValue({
      plugins: [
        manifest({
          id: "acpx",
          origin: "config",
          enabledByDefault: true,
          source: "/overrides/acpx/index.ts",
          rootDir: "/overrides/acpx",
        }),
        manifest({
          id: "acpx",
          enabledByDefault: true,
          source: "/bundled/acpx/index.ts",
          rootDir: "/bundled/acpx",
        }),
      ],
      diagnostics: [],
    });
    resolvePluginSetupServiceRuntime.mockImplementation(
      (params?: { rootDir?: string; pluginId?: string; serviceId?: string }) =>
        params?.pluginId === "acpx" &&
        params.serviceId === "acpx-runtime" &&
        params.rootDir === "/bundled/acpx"
          ? { pluginId: "acpx", service: { id: "acpx-runtime" } }
          : undefined,
    );

    const cfg = applyPlamoConfig({
      plugins: {
        entries: {
          acpx: {
            enabled: true,
          },
        },
      },
    });

    expect(cfg.acp?.backend).toBeUndefined();
  });

  it("preserves existing model fallbacks", () => {
    const cfg = applyPlamoConfig(createConfigWithFallbacks());
    expect(resolveAgentModelFallbackValues(cfg.agents?.defaults?.model)).toEqual([
      ...EXPECTED_FALLBACKS,
    ]);
  });
});
