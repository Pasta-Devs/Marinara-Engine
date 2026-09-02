import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import {
  registerTurnGameEngine,
  type AnyTurnGameEngine,
  type CapabilityRuntimeHost,
  type CapabilityRuntimeLogArgument,
  type InstalledCapabilityPackage,
  parseAgentSettingsRecord,
} from "@marinara-engine/shared";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import { logger, logDebugOverride } from "../../lib/logger.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import { parseGameJsonish } from "../game/jsonish.js";
import { createAgentsStorage } from "../storage/agents.storage.js";
import { capabilityPackageManager } from "./package-manager.service.js";
import {
  registerCapabilityConversationCommand,
  type CapabilityConversationCommandRegistration,
} from "./capability-command-registry.service.js";
import { registerCapabilityService } from "./capability-service-registry.service.js";
import { assertCapabilityAgentRuntimeServiceRegistration } from "./capability-agent-runtime.service.js";
import { createCapabilityLanguageModelHost } from "./capability-language-model.service.js";
import {
  createCapabilityEmbeddingHost,
  createConfiguredCapabilityEmbeddingHost,
} from "./capability-embedding.service.js";
import { createCapabilityPersistenceHost } from "./capability-persistence.service.js";
import { createCapabilityResourceHost } from "./capability-resources.service.js";
import { registerCapabilityPrivilegedRoutes } from "./capability-route-registration.service.js";
import {
  registerCapabilityPromptContext,
  type CapabilityPromptContextContributor,
} from "./capability-prompt-context.service.js";

type Cleanup = () => void | Promise<void>;
type CapabilityActivationContext = {
  app: FastifyInstance;
  dataDir: string;
  package: InstalledCapabilityPackage;
  api: {
    runtime: CapabilityRuntimeHost;
    registerTurnGameEngine(engine: AnyTurnGameEngine): Cleanup;
    registerConversationCommand(registration: CapabilityConversationCommandRegistration): Cleanup;
    registerService<T>(key: string, service: T): Cleanup;
    /** Contribute text to each turn's system prompt. Requires the `prompt-context` permission. */
    registerPromptContext(contributor: CapabilityPromptContextContributor): Cleanup;
    registerPrivilegedRoutes(
      routes: import("fastify").FastifyPluginAsync,
      options: { prefix: string },
    ): Promise<Cleanup>;
  };
};

async function createCapabilityRuntimeHost(app: FastifyInstance, packageId: string): Promise<CapabilityRuntimeHost> {
  const agents = app.db ? createAgentsStorage(app.db) : null;
  const config = await agents?.getByType(packageId);
  const embeddings = app.db
    ? await createConfiguredCapabilityEmbeddingHost(app.db, config?.connectionId)
    : createCapabilityEmbeddingHost();
  return Object.freeze({
    embeddings,
    async resolveEmbeddings() {
      const config = await agents?.getByType(packageId);
      return app.db
        ? createConfiguredCapabilityEmbeddingHost(app.db, config?.connectionId)
        : createCapabilityEmbeddingHost();
    },
    async getAgentConfig() {
      const config = await agents?.getByType(packageId);
      return config ? { connectionId: config.connectionId, settings: parseAgentSettingsRecord(config.settings) } : null;
    },
    isDebugAgentsEnabled,
    json: Object.freeze({ parseJsonish: parseGameJsonish }),
    languageModels: createCapabilityLanguageModelHost(app.db),
    logger: Object.freeze({
      debug: (message: string, ...args: CapabilityRuntimeLogArgument[]) =>
        Reflect.apply(logger.debug, logger, [message, ...args]),
      info: (message: string, ...args: CapabilityRuntimeLogArgument[]) =>
        Reflect.apply(logger.info, logger, [message, ...args]),
      warn: (message: string, ...args: CapabilityRuntimeLogArgument[]) =>
        Reflect.apply(logger.warn, logger, [message, ...args]),
      error: (error: unknown, message: string, ...args: CapabilityRuntimeLogArgument[]) =>
        Reflect.apply(logger.error, logger, [error, message, ...args]),
      debugOverride: (overrideEnabled: boolean, message: string, ...args: CapabilityRuntimeLogArgument[]) =>
        logDebugOverride(overrideEnabled, message, ...args),
    }),
    persistence: createCapabilityPersistenceHost(app.db),
    resources: createCapabilityResourceHost(app.db),
  });
}
type CapabilityModule = {
  activate?: (context: CapabilityActivationContext) => void | Cleanup | Promise<void | Cleanup>;
  selfCheck?: (context: CapabilityActivationContext) => void | Promise<void>;
};

export function prepareCapabilityRuntimeEnvironment(dataDir = DATA_DIR): void {
  // Downloaded runtimes bundle Engine utilities and evaluate them before
  // activate(context). Give those bundles the host's absolute resolved path;
  // preserving a relative DATA_DIR would resolve beside the nested server.mjs.
  process.env.DATA_DIR = dataDir;
}

async function runCleanups(cleanups: Cleanup[]): Promise<void> {
  let firstError: unknown;
  for (const cleanup of cleanups.splice(0).reverse()) {
    try {
      await cleanup();
    } catch (error) {
      firstError ??= error;
    }
  }
  if (firstError) throw firstError;
}

class CapabilityModuleRuntime {
  private cleanups = new Map<string, Cleanup>();

  async start(app: FastifyInstance): Promise<void> {
    // Bundled package modules execute before activate(context), so give their
    // shared Engine utilities the host's already-resolved data root up front.
    // Without this, a package can derive DATA_DIR from its nested server.mjs
    // location and fail to see host-owned models and storage.
    prepareCapabilityRuntimeEnvironment();
    await this.ensureModuleResolution();
    for (const runtimePackage of await capabilityPackageManager.runtimePackages()) {
      await this.activateOne(app, runtimePackage, true, false);
    }
  }

  private async ensureModuleResolution(): Promise<void> {
    const packageRoot = join(DATA_DIR, "capability-packages");
    const link = join(packageRoot, "node_modules");
    if (existsSync(link)) return;
    const serverNodeModules = resolve(dirname(fileURLToPath(import.meta.url)), "../../../node_modules");
    if (!existsSync(serverNodeModules)) return;
    await mkdir(packageRoot, { recursive: true });
    try {
      await symlink(serverNodeModules, link, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (!existsSync(link)) logger.warn(error, "Could not link package runtime dependencies");
    }
  }

  private async createVerifiedRuntimeSnapshot(
    installed: InstalledCapabilityPackage,
    verified: Awaited<ReturnType<typeof capabilityPackageManager.verifiedRuntimeFiles>>,
  ) {
    const snapshotsRoot = join(DATA_DIR, "capability-runtime-snapshots");
    const root = join(snapshotsRoot, `${installed.id}-${installed.version}-${randomUUID()}`);
    await mkdir(snapshotsRoot, { recursive: true, mode: 0o700 });
    await mkdir(root, { mode: 0o700 });
    try {
      for (const [relativePath, data] of verified.files) {
        const output = join(root, relativePath);
        await mkdir(dirname(output), { recursive: true, mode: 0o700 });
        await writeFile(output, data, { flag: "wx", mode: 0o400 });
      }
      await writeFile(join(root, "manifest.json"), JSON.stringify(installed.manifest), { flag: "wx", mode: 0o400 });
      const nodeModules = join(DATA_DIR, "capability-packages", "node_modules");
      if (existsSync(nodeModules) && !existsSync(join(root, "node_modules"))) {
        await symlink(nodeModules, join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
      }
      return {
        entrypoint: join(root, verified.entrypoint),
        cleanup: () => rm(root, { recursive: true, force: true }),
      };
    } catch (error) {
      await rm(root, { recursive: true, force: true });
      throw error;
    }
  }

  private async activateOne(
    app: FastifyInstance,
    runtimePackage: Awaited<ReturnType<typeof capabilityPackageManager.runtimePackages>>[number],
    allowRollback: boolean,
    throwOnFailure: boolean,
  ): Promise<void> {
    const { installed } = runtimePackage;
    const registeredCleanups: Cleanup[] = [];
    let moduleCleanup: Cleanup | undefined;
    try {
      await capabilityPackageManager.markRuntimeReadiness(installed.id, "pending");
      const blockReason = capabilityPackageManager.runtimeBlockReason(installed);
      if (blockReason) throw new Error(blockReason);
      const verified = await capabilityPackageManager.verifiedRuntimeFiles(installed);
      const runtimeSnapshot = await this.createVerifiedRuntimeSnapshot(installed, verified);
      registeredCleanups.push(runtimeSnapshot.cleanup);
      const module = (await import(pathToFileURL(runtimeSnapshot.entrypoint).href)) as CapabilityModule;
      if (typeof module.activate !== "function") throw new Error("Server entrypoint must export activate(context)");
      const trackCleanup = (cleanup: Cleanup) => {
        let called = false;
        const guardedCleanup = () => {
          if (called) return;
          called = true;
          return cleanup();
        };
        registeredCleanups.push(guardedCleanup);
        return guardedCleanup;
      };
      const context: CapabilityActivationContext = {
        app,
        dataDir: DATA_DIR,
        package: installed,
        api: {
          runtime: await createCapabilityRuntimeHost(app, installed.id),
          registerTurnGameEngine: (engine) => trackCleanup(registerTurnGameEngine(engine)),
          registerConversationCommand: (registration) => {
            if (registration.handler && !installed.manifest.permissions?.includes("conversation-actions")) {
              throw new Error(
                `Capability package ${installed.id} must declare the "conversation-actions" permission to handle model actions`,
              );
            }
            return trackCleanup(registerCapabilityConversationCommand(registration));
          },
          registerService: (key, service) => {
            assertCapabilityAgentRuntimeServiceRegistration(installed.id, installed.manifest.permissions ?? [], key);
            return trackCleanup(registerCapabilityService(key, service));
          },
          // Gated on the permission the manifest already declares, so a package can't reach the prompt
          // without asking for it up front. Contract in capability-prompt-context.service.ts.
          registerPromptContext: (contributor) => {
            if (!installed.manifest.permissions?.includes("prompt-context")) {
              throw new Error(
                `Capability package ${installed.id} must declare the "prompt-context" permission to contribute prompt context`,
              );
            }
            return trackCleanup(registerCapabilityPromptContext(installed.id, contributor));
          },
          registerPrivilegedRoutes: async (routes, options) =>
            trackCleanup(await registerCapabilityPrivilegedRoutes(app, installed, routes, options)),
        },
      };
      const cleanup = await module.activate(context);
      if (typeof cleanup === "function") moduleCleanup = cleanup;
      await capabilityPackageManager.markRuntimeReadiness(installed.id, "registered");
      await module.selfCheck?.(context);
      await capabilityPackageManager.markRuntimeStatus(installed.id, "active");
      await capabilityPackageManager.markRuntimeReadiness(installed.id, "ready");
      this.cleanups.set(installed.id, async () => {
        if (moduleCleanup) await moduleCleanup();
        await runCleanups(registeredCleanups);
      });
      logger.info("Activated and verified capability package %s@%s", installed.id, installed.version);
    } catch (error) {
      logger.error(error, "Failed to activate capability package %s@%s", installed.id, installed.version);
      try {
        if (moduleCleanup) await moduleCleanup();
        await runCleanups(registeredCleanups);
      } catch (cleanupError) {
        logger.warn(cleanupError, "Capability package %s cleanup failed after activation error", installed.id);
      }
      const previous = allowRollback ? await capabilityPackageManager.rollbackRuntime(installed.id) : null;
      if (previous) {
        logger.warn("Rolling capability package %s back to %s", installed.id, previous.installed.version);
        await this.activateOne(app, previous, false, false);
        if (throwOnFailure) {
          throw new Error(
            `Could not activate ${installed.id}@${installed.version}; restored ${previous.installed.version}`,
            { cause: error },
          );
        }
        return;
      }
      await capabilityPackageManager.markRuntimeStatus(
        installed.id,
        "error",
        error instanceof Error ? error.message : String(error),
      );
      await capabilityPackageManager.markRuntimeReadiness(
        installed.id,
        "error",
        error instanceof Error ? error.message : String(error),
      );
      if (throwOnFailure) throw error;
    }
  }

  async activatePackage(app: FastifyInstance, packageId: string): Promise<InstalledCapabilityPackage> {
    prepareCapabilityRuntimeEnvironment();
    await this.ensureModuleResolution();
    const runtimePackage = (await capabilityPackageManager.runtimePackages()).find(
      ({ installed }) => installed.id === packageId,
    );
    if (!runtimePackage) throw new Error(`Installed capability package ${packageId} has no server runtime`);
    await this.deactivatePackage(packageId);
    await this.activateOne(app, runtimePackage, true, true);
    const installed = (await capabilityPackageManager.installed()).find((item) => item.id === packageId);
    if (!installed) throw new Error(`Capability package ${packageId} disappeared during activation`);
    return installed;
  }

  async deactivatePackage(packageId: string): Promise<void> {
    const cleanup = this.cleanups.get(packageId);
    if (!cleanup) return;
    this.cleanups.delete(packageId);
    try {
      await cleanup();
    } catch (error) {
      logger.warn(error, "Capability package %s cleanup failed during deactivation", packageId);
    }
    logger.info("Deactivated capability package %s", packageId);
  }

  async stop(): Promise<void> {
    for (const [packageId, cleanup] of [...this.cleanups.entries()].reverse()) {
      this.cleanups.delete(packageId);
      try {
        await cleanup();
      } catch (error) {
        logger.warn(error, "Capability package cleanup failed");
      }
    }
  }
}

export const capabilityModuleRuntime = new CapabilityModuleRuntime();
