import { createRequire } from "node:module";
import { lstat, mkdir, readFile, realpath, symlink, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";

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
