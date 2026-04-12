import { createRequire } from "node:module";
import { normalizeProviderId } from "../agents/provider-id.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import { loadPluginManifestRegistry } from "./manifest-registry.js";
import { listSetupCliBackendIds } from "./setup-descriptors.js";

type SetupRegistryRuntimeModule = Pick<
  typeof import("./setup-registry.js"),
  "resolvePluginSetupCliBackend" | "resolvePluginSetupService"
>;

type SetupCliBackendRuntimeEntry = {
  pluginId: string;
  backend: {
    id: string;
  };
};

type SetupServiceRuntimeEntry = {
  pluginId: string;
  service: {
    id: string;
  };
};

const require = createRequire(import.meta.url);
const SETUP_REGISTRY_RUNTIME_CANDIDATES = ["./setup-registry.js", "./setup-registry.ts"] as const;

let setupRegistryRuntimeModule: SetupRegistryRuntimeModule | null | undefined;
let bundledSetupCliBackendsCache: SetupCliBackendRuntimeEntry[] | undefined;

export const __testing = {
  resetRuntimeState(): void {
    setupRegistryRuntimeModule = undefined;
    bundledSetupCliBackendsCache = undefined;
  },
  setRuntimeModuleForTest(module: SetupRegistryRuntimeModule | null | undefined): void {
    setupRegistryRuntimeModule = module;
  },
};

function resolveBundledSetupCliBackends(): SetupCliBackendRuntimeEntry[] {
  if (bundledSetupCliBackendsCache) {
    return bundledSetupCliBackendsCache;
  }
  bundledSetupCliBackendsCache = loadPluginManifestRegistry({ cache: true }).plugins.flatMap(
    (plugin) => {
      if (plugin.origin !== "bundled") {
        return [];
      }
      const backendIds = listSetupCliBackendIds(plugin);
      if (backendIds.length === 0) {
        return [];
      }
      return backendIds.map(
        (backendId) =>
          ({
            pluginId: plugin.id,
            backend: { id: backendId },
          }) satisfies SetupCliBackendRuntimeEntry,
      );
    },
  );
  return bundledSetupCliBackendsCache;
}

function loadSetupRegistryRuntime(): SetupRegistryRuntimeModule | null {
  if (setupRegistryRuntimeModule !== undefined) {
    return setupRegistryRuntimeModule;
  }
  for (const candidate of SETUP_REGISTRY_RUNTIME_CANDIDATES) {
    try {
      setupRegistryRuntimeModule = require(candidate) as SetupRegistryRuntimeModule;
      return setupRegistryRuntimeModule;
    } catch {
      // Try source/runtime candidates in order.
    }
  }
  return null;
}

export function resolvePluginSetupCliBackendRuntime(params: { backend: string }) {
  const normalized = normalizeProviderId(params.backend);
  const runtime = loadSetupRegistryRuntime();
  if (runtime !== null) {
    return runtime.resolvePluginSetupCliBackend(params);
  }
  return resolveBundledSetupCliBackends().find(
    (entry) => normalizeProviderId(entry.backend.id) === normalized,
  );
}

export function resolvePluginSetupServiceRuntime(params: {
  pluginId: string;
  serviceId: string;
  rootDir?: string;
  config?: OpenClawConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
}): SetupServiceRuntimeEntry | undefined {
  const runtime = loadSetupRegistryRuntime();
  if (!runtime) {
    return undefined;
  }
  const resolved = runtime.resolvePluginSetupService(params);
  if (!resolved) {
    return undefined;
  }
  return {
    pluginId: resolved.pluginId,
    service: {
      id: resolved.service.id,
    },
  };
}
