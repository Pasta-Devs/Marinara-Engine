import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtureRoot = mkdtempSync(join(tmpdir(), "marinara-sprite-list-security-"));
process.env.DATA_DIR = join(fixtureRoot, "data");
const requireFromServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const app = requireFromServer("fastify")();

try {
  const { spritesRoutes } = await import("../../packages/server/src/routes/sprites.routes.ts");
  await app.register(spritesRoutes, { prefix: "/api/sprites" });

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
} finally {
  await app.close();
  rmSync(fixtureRoot, { recursive: true, force: true });
}
