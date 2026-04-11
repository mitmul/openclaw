import { createRequire } from "node:module";
import { normalizeProviderId } from "../agents/provider-id.js";
import { loadPluginManifestRegistry } from "./manifest-registry.js";

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

let setupRegistryRuntimeModule: SetupRegistryRuntimeModule | undefined;
let bundledSetupCliBackendsCache: SetupCliBackendRuntimeEntry[] | undefined;

function resolveBundledSetupCliBackends(): SetupCliBackendRuntimeEntry[] {
  if (bundledSetupCliBackendsCache) {
    return bundledSetupCliBackendsCache;
  }
  bundledSetupCliBackendsCache = loadPluginManifestRegistry({ cache: true })
    .plugins.filter((plugin) => plugin.origin === "bundled" && plugin.cliBackends.length > 0)
    .flatMap((plugin) =>
      plugin.cliBackends.map(
        (backendId) =>
          ({
            pluginId: plugin.id,
            backend: { id: backendId },
          }) satisfies SetupCliBackendRuntimeEntry,
      ),
    );
  return bundledSetupCliBackendsCache;
}

function loadSetupRegistryRuntime(): SetupRegistryRuntimeModule | null {
  if (setupRegistryRuntimeModule) {
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
  if (runtime) {
    const resolved = runtime.resolvePluginSetupCliBackend(params);
    if (resolved) {
      return resolved;
    }
  }
  return resolveBundledSetupCliBackends().find(
    (entry) => normalizeProviderId(entry.backend.id) === normalized,
  );
}

export function resolvePluginSetupServiceRuntime(params: {
  pluginId: string;
  serviceId: string;
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
