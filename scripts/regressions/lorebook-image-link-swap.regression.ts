// A lorebook image swapped for a link to a file outside the images folder, after readLorebookImageDataUrl checked its
// real path and before it opened it, must not be read. Windows has no O_NOFOLLOW, so there only the check that the
// file opened is the file checked stops it. The swap happens inside a wrapped fs/promises open, so the race is exact.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const outside = mkdtempSync(join(tmpdir(), "marinara-lorebook-link-swap-"));
const name = "33333333-3333-4333-8333-333333333333.png";
const pngBytes = (padding: number) =>
  Buffer.concat([
    Buffer.from(
      "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C6360000002000154A24F5D0000000049454E44AE426082",
      "hex",
    ),
    Buffer.alloc(padding),
  ]);
const secret = join(outside, "secret.png");
writeFileSync(secret, pngBytes(37));

try {
  const linkProbe = join(outside, "link-probe.png");
  let canLink = true;
  try {
    symlinkSync(secret, linkProbe, "file");
    unlinkSync(linkProbe);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
    canLink = false;
  }
  if (!canLink) {
    console.info("Lorebook image link swap regression skipped: this Windows account cannot create symbolic links.");
  } else {
    const fsPromises = createRequire(import.meta.url)("node:fs/promises") as typeof import("node:fs/promises");
    const realOpen = fsPromises.open as (...args: unknown[]) => ReturnType<typeof fsPromises.open>;
    const realLstat = fsPromises.lstat as (...args: unknown[]) => Promise<import("node:fs").BigIntStats>;
    // A FAT32 or exFAT volume reports ino 0 (and here dev 0) for every file.
    let noFileIds = false;
    const withoutIds = <T>(stats: T) => (noFileIds ? Object.assign(stats as object, { ino: 0n, dev: 0n }) : stats) as T;
    let swapped = false;
    fsPromises.lstat = (async (...args: unknown[]) => withoutIds(await realLstat(...args))) as typeof fsPromises.lstat;
    fsPromises.open = (async (path: unknown, ...rest: unknown[]) => {
      if (!swapped && String(path).endsWith(name)) {
        swapped = true;
        unlinkSync(path as string);
        symlinkSync(secret, path as string, "file");
      }
      const handle = await realOpen(path, ...rest);
      const realStat = handle.stat.bind(handle) as (...args: unknown[]) => Promise<unknown>;
      handle.stat = (async (...args: unknown[]) => withoutIds(await realStat(...args))) as typeof handle.stat;
      return handle;
    }) as typeof fsPromises.open;
    syncBuiltinESMExports();

    const { lorebookImagesDirectory, readLorebookImageDataUrl } =
      await import("../../packages/server/src/services/lorebook/lorebook-images.js");
    mkdirSync(lorebookImagesDirectory(), { recursive: true });
    for (const volume of ["with file IDs", "without file IDs"]) {
      noFileIds = volume === "without file IDs";
      swapped = false;
      writeFileSync(join(lorebookImagesDirectory(), name), pngBytes(0));
      const result = await readLorebookImageDataUrl(`/api/lorebooks/entry-images/${name}`);
      assert.ok(swapped, `${volume}: the image was swapped for a link between the check and the open`);
      assert.equal(result, null, `${volume}: a link swapped in after the real-path check is not read`);
      unlinkSync(join(lorebookImagesDirectory(), name));
    }
    console.info("Lorebook image link swap regression passed.");
  }
} finally {
  rmSync(outside, { recursive: true, force: true });
}
