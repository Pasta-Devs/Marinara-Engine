// The real-path helpers for app folders (utils/app-folder.ts) refuse a path that names somewhere outside the folder as
// written before they look at anything there, and on Windows they do not treat a folder whose name differs only by a
// letter that lower-cases to an ASCII one as the same folder.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = realpathSync(mkdtempSync(join(tmpdir(), "marinara-app-folder-bounds-")));
const dataDir = join(root, "data");
const sprites = join(dataDir, "sprites");
mkdirSync(sprites, { recursive: true });
mkdirSync(join(root, "outside"));
writeFileSync(join(root, "outside", "file.txt"), "not a folder");
process.env.DATA_DIR = dataDir;
process.env.NODE_ENV = "test";

const { insideByAsciiCase, realPathInAppFolder, realPathInRealFolder } =
  await import("../../packages/server/src/utils/app-folder.js");

// A path through an outside file would make the real-path walk fail on that file (ENOTDIR) before the bounds check.
const throughOutsideFile = join(sprites, "..", "..", "outside", "file.txt", "x");
for (const [name, check] of [
  ["realPathInAppFolder", realPathInAppFolder],
  ["realPathInRealFolder", realPathInRealFolder],
] as const) {
  assert.throws(
    () => check(sprites, throughOutsideFile),
    { message: "Path escapes the allowed directory" },
    `${name} refuses a path outside the folder as written, before looking at it`,
  );
  assert.equal(
    check(sprites, join(sprites, "owner", "face.png")),
    join(sprites, "owner", "face.png"),
    `${name} keeps an inside path`,
  );
  assert.equal(check(sprites, sprites), sprites, `${name} keeps the folder itself`);
}

const gameAssets = "C:\\M\\packages\\server\\data\\game-assets";
assert.throws(
  () => insideByAsciiCase(gameAssets, "C:\\M\\pac\u212Aages\\server\\data\\game-assets\\sub"),
  { message: "Path escapes the allowed directory" },
  "a folder named with a letter that only lower-cases to an ASCII one is another folder",
);
assert.equal(
  insideByAsciiCase(gameAssets, "c:\\m\\PACKAGES\\server\\data\\game-assets\\sub\\x.txt"),
  "c:\\m\\PACKAGES\\server\\data\\game-assets\\sub\\x.txt",
  "ASCII letters still ignore case on Windows",
);
assert.equal(insideByAsciiCase(gameAssets, gameAssets), gameAssets, "the folder itself is inside");
assert.equal(insideByAsciiCase("C:\\", "C:\\data\\x"), "C:\\data\\x", "a drive root holds what is on it");
assert.throws(() => insideByAsciiCase(gameAssets, "C:\\M\\packages\\server\\data\\game-assets-old\\x"), {
  message: "Path escapes the allowed directory",
});
// On Windows, a path from the root of the current drive (/data/…) resolves onto that drive (C:\data\…).
if (process.platform !== "win32") {
  assert.equal(
    insideByAsciiCase("/data/sprites", "/data/sprites/a.png"),
    "/data/sprites/a.png",
    "POSIX paths are unchanged",
  );
}

console.log("app-folder bounds: ok");
