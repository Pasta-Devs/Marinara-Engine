// #7173: a Termux install updated in place from 2.4.6 kept @emnapi/runtime in pnpm's
// "skipped" list, so sharp's WebAssembly fallback could not finish starting. Its
// loader fails inside an un-awaited async run(), so besides the caught import error a
// second, detached rejection reached the server's unhandledRejection handler and shut
// the server down the first time a browser asked for a background thumbnail.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = mkdtempSync(join(tmpdir(), "marinara-sharp-wasm-"));
process.env.DATA_DIR = dataDir;
process.env.LOG_LEVEL = "silent";

try {
  const { isSharpLoaderRejection } = await import("../../../packages/server/src/services/image/sharp-runtime.js");
  const { resolveThumbPath } = await import("../../../packages/server/src/services/image/image-thumbnail.js");

  // Reproduce the stale install: Android has no native prebuild, so sharp takes the
  // WebAssembly fallback, whose loader then cannot find @emnapi/runtime.
  Object.defineProperty(process, "platform", { value: "android" });
  registerHooks({
    resolve: (specifier, context, nextResolve) =>
      nextResolve(specifier === "@emnapi/runtime" ? "@emnapi/runtime-missing-7173" : specifier, context),
  });

  const rejections: unknown[] = [];
  process.on("unhandledRejection", (reason) => {
    rejections.push(reason);
    if (!isSharpLoaderRejection(reason)) {
      console.error(reason);
      process.exit(1);
    }
  });

  const source = join(dataDir, "Black.jpg");
  writeFileSync(source, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  assert.equal(await resolveThumbPath(source, 320), null, "a broken sharp serves the original image");
  await new Promise((settle) => setTimeout(settle, 50));

  assert.equal(rejections.length, 1, "sharp's WebAssembly loader leaves exactly one detached rejection");
  assert.equal((rejections[0] as NodeJS.ErrnoException).code, "MODULE_NOT_FOUND");
  assert.equal(isSharpLoaderRejection(rejections[0]), true, "sharp's loader failure is not fatal");
  assert.equal(isSharpLoaderRejection(new Error("engine bug")), false, "every other rejection stays fatal");
  assert.equal(isSharpLoaderRejection("not an error"), false);

  const indexSource = readFileSync(join(repositoryRoot, "packages/server/src/index.ts"), "utf8").replace(/\s+/gu, " ");
  assert.ok(
    /process\.on\("unhandledRejection", \(reason\) => \{ if \(isSharpLoaderRejection\(reason\)\) \{/u.test(indexSource),
    "the server's unhandledRejection handler must let sharp's loader failure through before exiting",
  );
  console.info("A missing sharp WebAssembly runtime serves original images and keeps the server running.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
