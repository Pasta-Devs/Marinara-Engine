import { createRequire, findPackageJSON } from "node:module";
import { lstat, mkdir, readFile, realpath, symlink, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { logger } from "../../lib/logger.js";

/** Bundled SDK code resolves native helpers from the package entrypoint, outside pnpm's dependency tree. */
export async function linkCapabilityNativeDependencies(
  snapshotsRoot: string,
  sdkEntry = createRequire(import.meta.url).resolve("@anthropic-ai/claude-agent-sdk"),
) {
  const sdkRequire = createRequire(sdkEntry);
  const manifest = JSON.parse(await readFile(join(dirname(sdkEntry), "package.json"), "utf8"));
  for (const name of Object.keys(manifest.optionalDependencies ?? {})) {
    if (!name.startsWith("@anthropic-ai/claude-agent-sdk-")) continue;
    let target: string;
    try {
      target = dirname(sdkRequire.resolve(`${name}/package.json`));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "MODULE_NOT_FOUND") continue;
      throw error;
    }
    const link = join(snapshotsRoot, "node_modules", name);
    await mkdir(dirname(link), { recursive: true });
    const existing = await lstat(link).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (existing) {
      if ((await realpath(link).catch(() => null)) === (await realpath(target))) continue;
      if (!existing.isSymbolicLink()) throw new Error(`Native dependency path is not a managed link: ${link}`);
      await unlink(link);
    }
    await symlink(target, link, process.platform === "win32" ? "junction" : "dir");
  }
}

/**
 * Point `<packageRoot>/node_modules` at the Engine server's own `node_modules`. Package servers resolve bare imports
 * through it, so they get the Engine's copies of its direct dependencies (zod, nanoid, ...), not copies of their own.
 * A link left by another install path (a moved data folder, a reinstall elsewhere) is replaced, including a dangling
 * one; anything that is not a link is left alone. Never throws: a package without shared imports still activates.
 */
export async function linkCapabilityPackageDependencies(packageRoot: string, serverNodeModules: string): Promise<void> {
  const link = join(packageRoot, "node_modules");
  try {
    const target = await realpath(serverNodeModules).catch(() => null);
    if (!target) return;
    const existing = await lstat(link).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (existing) {
      if ((await realpath(link).catch(() => null)) === target) return;
      if (!existing.isSymbolicLink()) {
        logger.warn("Package runtime dependencies at %s are not a link to the Engine's; leaving them", link);
        return;
      }
      // Removes the link (a junction on Windows) itself, never what it points to.
      await unlink(link);
      logger.info("Relinking package runtime dependencies at %s to %s", link, serverNodeModules);
    }
    await mkdir(packageRoot, { recursive: true });
    await symlink(serverNodeModules, link, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    // Another start may have made the same link first; anything else leaves package imports unresolved.
    const linked = await realpath(link).catch(() => null);
    if (!linked || linked !== (await realpath(serverNodeModules).catch(() => null))) {
      logger.warn(error, "Could not link package runtime dependencies");
    }
  }
}

/** An Engine dependency/setup failure, which changing package versions cannot repair. */
export class CapabilityHostDependencyError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CapabilityHostDependencyError";
  }
}

/** Keep API-1 package validators on Zod 3; other imports retain the Engine's module instances. */
export async function linkCapabilitySnapshotDependencies(
  snapshotRoot: string,
  serverNodeModules: string,
): Promise<void> {
  try {
    const modules = join(snapshotRoot, "node_modules");
    const existing = await lstat(modules).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (existing) {
      // Earlier verified snapshots linked directly to this Engine. Remove only that managed link itself.
      if (!existing.isSymbolicLink() || (await realpath(modules)) !== (await realpath(serverNodeModules))) {
        throw new Error("Snapshot dependencies are not a managed Engine link");
      }
      await unlink(modules);
    }
    await mkdir(modules, { mode: 0o700 });
    // Resolve from the server manifest: hoisted installs may have no local node_modules at all.
    const serverManifestPath = join(dirname(serverNodeModules), "package.json");
    const manifest = JSON.parse(await readFile(serverManifestPath, "utf8")) as {
      dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    // Keep installed development tools available, as in the previous direct-directory view.
    const optional = { ...manifest.devDependencies, ...manifest.optionalDependencies };
    const dependencies = { ...manifest.dependencies, ...optional };
    for (const name of Object.keys(dependencies)) {
      const provider = name === "zod" ? "zod-v3" : name;
      let target: string;
      try {
        const packageManifestPath = findPackageJSON(provider, serverManifestPath);
        if (!packageManifestPath) {
          if (name !== "zod" && Object.hasOwn(optional, name)) continue;
          throw new Error(`Package runtime dependency ${provider} has no package manifest`);
        }
        const dependency = JSON.parse(await readFile(packageManifestPath, "utf8")) as { version?: string };
        if (name === "zod" && !dependency.version?.startsWith("3.")) {
          throw new Error("API-1 packages require the Engine's Zod 3 compatibility dependency (zod-v3)");
        }
        target = await realpath(dirname(packageManifestPath));
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (name !== "zod" && Object.hasOwn(optional, name) && (code === "ERR_MODULE_NOT_FOUND" || code === "ENOENT")) {
          continue;
        }
        throw new CapabilityHostDependencyError(
          `Could not resolve package runtime dependency ${provider} from the Engine server`,
          {
            cause: error,
          },
        );
      }
      const link = join(modules, name);
      await mkdir(dirname(link), { recursive: true, mode: 0o700 });
      await symlink(target, link, process.platform === "win32" ? "junction" : "dir");
    }
  } catch (error) {
    if (error instanceof CapabilityHostDependencyError) throw error;
    throw new CapabilityHostDependencyError(
      error instanceof Error ? error.message : "Could not prepare Engine package runtime dependencies",
      { cause: error },
    );
  }
}
