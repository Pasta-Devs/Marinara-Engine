import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtureRoot = mkdtempSync(join(tmpdir(), "marinara-sprite-list-security-"));
process.env.DATA_DIR = join(fixtureRoot, "data");
const requireFromServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const app = requireFromServer("fastify")();
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");

try {
  const { spritesRoutes } = await import("../../packages/server/src/routes/sprites.routes.ts");
  const { charactersRoutes } = await import("../../packages/server/src/routes/characters.routes.js");
  app.decorate("db", await getDB());
  await app.register(spritesRoutes, { prefix: "/api/sprites" });
  await app.register(charactersRoutes, { prefix: "/api/characters" });

  const outside = join(fixtureRoot, "outside");
  mkdirSync(outside);
  writeFileSync(join(outside, "private-name.png"), "outside fixture");
  for (const characterId of ["../../created-by-list", "../../outside", "..\\outside", "valid/child"]) {
    for (const method of ["GET", "POST", "PATCH"] as const) {
      const response = await app.inject({
        method,
        url: `/api/sprites/${encodeURIComponent(characterId)}${method === "PATCH" ? "/happy" : ""}`,
        ...(method !== "GET" ? { payload: { expression: "happy", image: "fixture" } } : {}),
      });
      assert.equal(response.statusCode, 400, `invalid character ID must be rejected: ${method} ${characterId}`);
      assert.deepEqual(response.json(), { error: "Invalid character ID" });
    }
  }
  assert.equal(existsSync(join(fixtureRoot, "created-by-list")), false, "listing must not create escaped folders");
  assert.equal(existsSync(join(process.env.DATA_DIR, "sprites", "valid")), false);

  const empty = await app.inject({ method: "GET", url: "/api/sprites/valid-character" });
  assert.equal(empty.statusCode, 200);
  assert.deepEqual(empty.json(), []);
  const spriteDir = join(process.env.DATA_DIR, "sprites", "valid-character");
  mkdirSync(spriteDir, { recursive: true });
  writeFileSync(join(spriteDir, "happy.png"), "sprite fixture");
  writeFileSync(join(spriteDir, "notes.txt"), "not a sprite");
  const listed = await app.inject({ method: "GET", url: "/api/sprites/valid-character" });
  assert.equal(listed.statusCode, 200);
  const rows = listed.json();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].filename, "happy.png");
  assert.equal(rows[0].expression, "happy");
  assert.match(rows[0].url, /^\/api\/sprites\/valid-character\/file\/happy\.png\?v=\d+$/);
  const brokenCatalog = join(spriteDir, "catalog.json");
  writeFileSync(brokenCatalog, "{broken");
  const recovered = await app.inject({ method: "GET", url: "/api/sprites/valid-character" });
  assert.equal(recovered.statusCode, 200, "optional metadata cannot hide sprite image files");
  assert.deepEqual(recovered.json(), rows);
  const exported = await app.inject({ method: "POST", url: "/api/sprites/valid-character/export", payload: {} });
  assert.equal(exported.statusCode, 200);
  const mutation = await app.inject({
    method: "POST",
    url: "/api/sprites/valid-character/folders",
    payload: { name: "New folder" },
  });
  assert.equal(mutation.statusCode, 500, "mutations must refuse to overwrite damaged metadata");
  assert.equal(readFileSync(brokenCatalog, "utf8"), "{broken");

  const linked = await app.inject({
    method: "POST",
    url: "/api/characters",
    payload: { data: { name: "Linked sprite proof" } },
  });
  assert.equal(linked.statusCode, 200);
  const linkedOwner = linked.json().id;
  writeFileSync(
    join(outside, "private-name.png"),
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aU1cAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  symlinkSync(
    outside,
    join(process.env.DATA_DIR, "sprites", linkedOwner),
    process.platform === "win32" ? "junction" : "dir",
  );
  for (const suffix of ["export?format=native", "export-png"]) {
    const response = await app.inject({ method: "GET", url: `/api/characters/${linkedOwner}/${suffix}` });
    assert.equal(response.statusCode, 500, "export must refuse a linked owner directory");
  }
  const { listCharacterSprites, listPartySprites } =
    await import("../../packages/server/src/services/game/sprite.service.js");
  const { listSpriteCatalog } = await import("../../packages/server/src/services/sprites/sprite-catalog.js");
  assert.equal(listCharacterSprites("../outside"), null);
  assert.deepEqual((await app.inject({ method: "GET", url: `/api/sprites/${linkedOwner}` })).json(), []);
  assert.deepEqual(
    listPartySprites([
      { id: linkedOwner, name: "Unavailable" },
      { id: "valid-character", name: "Available" },
    ]).map((owner) => owner.name),
    ["Available"],
  );
  const { logger } = await import("../../packages/server/src/lib/logger.js");
  const { resetRateLimitedLogs } = await import("../../packages/server/src/lib/log-rate-limit.js");
  const originalWarn = logger.warn;
  const warnings: unknown[] = [];
  logger.warn = ((...args: unknown[]) => {
    warnings.push(args);
  }) as typeof logger.warn;
  try {
    resetRateLimitedLogs();
    assert.equal(listSpriteCatalog("valid-character").sprites.length, 1);
    assert.equal(listSpriteCatalog("valid-character").sprites.length, 1);
    const another = join(process.env.DATA_DIR, "sprites", "another");
    mkdirSync(another);
    writeFileSync(join(another, "catalog.json"), "{broken");
    listSpriteCatalog("another");
    assert.equal(warnings.length, 2, "each damaged owner logs once per window");
  } finally {
    logger.warn = originalWarn;
    resetRateLimitedLogs();
  }
  const fs = requireFromServer("node:fs");
  const originalStat = fs.lstatSync;
  writeFileSync(join(spriteDir, "survivor.png"), "fixture");
  fs.lstatSync = (path: string, ...options: unknown[]) => {
    if (path === join(spriteDir, "happy.png"))
      throw Object.assign(new Error("Sprite deleted during scan"), { code: "ENOENT" });
    return originalStat(path, ...options);
  };
  syncBuiltinESMExports();
  try {
    assert.deepEqual(
      listSpriteCatalog("valid-character").sprites.map((sprite) => sprite.expression),
      ["survivor"],
      "a disappearing file must not abort the other files",
    );
  } finally {
    fs.lstatSync = originalStat;
    syncBuiltinESMExports();
  }
} finally {
  await app.close();
  await closeDB();
  rmSync(fixtureRoot, { recursive: true, force: true });
}
