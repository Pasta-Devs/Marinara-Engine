// Background images: the defaults seeded into a new data folder, and background metadata that can't change
// Object.prototype.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { seedDefaultBackgrounds } from "../../../packages/server/src/db/seed-backgrounds.js";
import { normalizeBackgroundMeta } from "../../../packages/server/src/routes/backgrounds.routes.js";

const backgroundSeedRoot = mkdtempSync(join(tmpdir(), "marinara-default-background-"));
const backgroundSeedDir = join(backgroundSeedRoot, "backgrounds");
try {
  mkdirSync(backgroundSeedDir, { recursive: true });
  const customBackgroundPath = join(backgroundSeedDir, "custom.jpg");
  const customBackground = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  writeFileSync(customBackgroundPath, customBackground);
  await seedDefaultBackgrounds(backgroundSeedDir);
  assert.deepEqual(readFileSync(customBackgroundPath), customBackground);
  assert.equal(existsSync(join(backgroundSeedDir, "Black.jpg")), true);
  assert.ok(readFileSync(join(backgroundSeedDir, "Black.jpg")).length > 0);
  const backgroundMeta = JSON.parse(readFileSync(join(backgroundSeedDir, "meta.json"), "utf8")) as Record<
    string,
    { tags?: unknown }
  >;
  assert.deepEqual(backgroundMeta["Black.jpg"]?.tags, ["black", "plain", "dark"]);
} finally {
  rmSync(backgroundSeedRoot, { recursive: true, force: true });
}
const reservedBackgroundMeta = normalizeBackgroundMeta(
  JSON.parse('{"__proto__":{"tags":["kept"]},"normal.png":{"tags":["normal",7]}}'),
);
assert.equal(Object.getPrototypeOf(reservedBackgroundMeta), null);
assert.deepEqual(reservedBackgroundMeta.__proto__?.tags, ["kept"]);
assert.deepEqual(reservedBackgroundMeta["normal.png"]?.tags, ["normal"]);
reservedBackgroundMeta.__proto__ = { tags: ["updated"] };
