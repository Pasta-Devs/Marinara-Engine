import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { mkdir, symlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import {
  registerTurnGameEngine,
  type AnyTurnGameEngine,
  type CapabilityRuntimeHost,
  type CapabilityRuntimeLogArgument,
  type InstalledCapabilityPackage,
} from "@marinara-engine/shared";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import { logger, logDebugOverride } from "../../lib/logger.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import { parseGameJsonish } from "../game/jsonish.js";
import { capabilityPackageManager } from "./package-manager.service.js";
import {
  registerCapabilityConversationCommand,
  type CapabilityConversationCommandRegistration,
} from "./capability-command-registry.service.js";
import { registerCapabilityService } from "./capability-service-registry.service.js";
import { createCapabilityLanguageModelHost } from "./capability-language-model.service.js";
import { createCapabilityPersistenceHost } from "./capability-persistence.service.js";
import { createCapabilityResourceHost } from "./capability-resources.service.js";

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
  };
};

function createCapabilityRuntimeHost(app: FastifyInstance): CapabilityRuntimeHost {
  return Object.freeze({
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

  private async activateOne(
    app: FastifyInstance,
    runtimePackage: Awaited<ReturnType<typeof capabilityPackageManager.runtimePackages>>[number],
    allowRollback: boolean,
    throwOnFailure: boolean,
  ): Promise<void> {
    const { installed, serverEntrypoint } = runtimePackage;
    const registeredCleanups: Cleanup[] = [];
    let moduleCleanup: Cleanup | undefined;
    try {
      await capabilityPackageManager.markRuntimeReadiness(installed.id, "pending");
      const blockReason = capabilityPackageManager.runtimeBlockReason(installed);
      if (blockReason) throw new Error(blockReason);

      const moduleUrl = new URL(pathToFileURL(serverEntrypoint).href);
      moduleUrl.searchParams.set("activation", `${installed.version}-${Date.now()}`);
      const module = (await import(moduleUrl.href)) as CapabilityModule;
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
          runtime: createCapabilityRuntimeHost(app),
          registerTurnGameEngine: (engine) => trackCleanup(registerTurnGameEngine(engine)),
          registerConversationCommand: (registration) =>
            trackCleanup(registerCapabilityConversationCommand(registration)),
          registerService: (key, service) => trackCleanup(registerCapabilityService(key, service)),
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
