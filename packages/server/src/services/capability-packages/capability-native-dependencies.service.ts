import { createRequire } from "node:module";
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
