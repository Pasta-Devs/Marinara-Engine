import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtureRoot = mkdtempSync(join(tmpdir(), "marinara-server-hunt-b23-"));
process.env.DATA_DIR = join(fixtureRoot, "data");
process.env.FILE_STORAGE_DIR = `${process.env.DATA_DIR}/storage`; // never the live store named in .env
process.env.LOG_LEVEL = "silent";
const requireFromServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const app = requireFromServer("fastify")();
const sharp = requireFromServer("sharp");

async function solidPng(color: { r: number; g: number; b: number }) {
  return (await sharp({
    create: { width: 32, height: 32, channels: 3, background: color },
  })
    .png()
    .toBuffer()) as Buffer;
}

try {
  const { spritesRoutes } = await import("../../packages/server/src/routes/sprites.routes.ts");
  await app.register(spritesRoutes, { prefix: "/api/sprites" });
  const spriteDir = join(process.env.DATA_DIR, "sprites", "char-1");

  // 1) Re-uploading an expression with a different extension replaces the old file.
  const png = await solidPng({ r: 255, g: 0, b: 0 });
  const first = await app.inject({
    method: "POST",
    url: "/api/sprites/char-1",
    payload: { expression: "happy", image: `data:image/png;base64,${png.toString("base64")}` },
  });
  assert.equal(first.statusCode, 200);
  const jpeg = (await sharp(png).jpeg().toBuffer()) as Buffer;
  const second = await app.inject({
    method: "POST",
    url: "/api/sprites/char-1",
    payload: { expression: "happy", image: `data:image/jpeg;base64,${jpeg.toString("base64")}` },
  });
  assert.equal(second.statusCode, 200);
  assert.equal(second.json().filename, "happy.jpeg");
  assert.deepEqual(
    readdirSync(spriteDir).filter((f) => f.startsWith("happy.")),
    ["happy.jpeg"],
    "upload with a new extension must remove the previous file for the same expression",
  );
  // Same-name re-upload keeps the single file.
  const third = await app.inject({
    method: "POST",
    url: "/api/sprites/char-1",
    payload: { expression: "happy", image: `data:image/jpeg;base64,${jpeg.toString("base64")}` },
  });
  assert.equal(third.statusCode, 200);
  assert.deepEqual(
    readdirSync(spriteDir).filter((f) => f.startsWith("happy.")),
    ["happy.jpeg"],
  );
  // Review fix: an upload type outside SPRITE_FILE_RE (bmp, heic...) is refused
  // before anything is written, so the working sprite is never deleted for it.
  const bmp = await app.inject({
    method: "POST",
    url: "/api/sprites/char-1",
    payload: { expression: "happy", image: `data:image/bmp;base64,${png.toString("base64")}` },
  });
  assert.equal(bmp.statusCode, 400, bmp.body);
  assert.deepEqual(
    readdirSync(spriteDir).filter((f) => f.startsWith("happy.")),
    ["happy.jpeg"],
    "an unsupported upload type must not delete the existing sprite",
  );
  // Review fix: a case-only differing file (happy.JPEG vs happy.jpeg) is the same
  // file on case-insensitive disks; the replace loop must not delete what it just wrote.
  const caseDir = join(process.env.DATA_DIR, "sprites", "char-3");
  mkdirSync(caseDir, { recursive: true });
  writeFileSync(join(caseDir, "happy.JPEG"), jpeg);
  const caseUpload = await app.inject({
    method: "POST",
    url: "/api/sprites/char-3",
    payload: { expression: "happy", image: `data:image/jpeg;base64,${jpeg.toString("base64")}` },
  });
  assert.equal(caseUpload.statusCode, 200, caseUpload.body);
  const caseFiles = readdirSync(caseDir).filter((f) => f.toLowerCase().startsWith("happy."));
  assert.equal(caseFiles.length, 1, `exactly one happy sprite must remain, got ${caseFiles.join(",")}`);
  assert.ok(readFileSync(join(caseDir, caseFiles[0]!)).equals(jpeg), "the uploaded bytes must survive");
  const listed = await app.inject({ method: "GET", url: "/api/sprites/char-1" });
  assert.equal(listed.json().filter((row: { expression: string }) => row.expression === "happy").length, 1);

  // 2) cleanup-saved must not overwrite an existing PNG (duplicates already on disk) without a backup.
  const dupDir = join(process.env.DATA_DIR, "sprites", "char-2");
  mkdirSync(dupDir, { recursive: true });
  const originalPng = await solidPng({ r: 0, g: 200, b: 0 });
  writeFileSync(join(dupDir, "happy.png"), originalPng);
  writeFileSync(
    join(dupDir, "happy.jpeg"),
    (await sharp(await solidPng({ r: 0, g: 0, b: 200 }))
      .jpeg()
      .toBuffer()) as Buffer,
  );
  const cleaned = await app.inject({
    method: "POST",
    url: "/api/sprites/char-2/cleanup-saved",
    payload: { engine: "builtin" },
  });
  assert.equal(cleaned.statusCode, 200, cleaned.body);
  const cleanedBody = cleaned.json();
  assert.equal(cleanedBody.processed, 1);
  assert.equal(cleanedBody.failed.length, 1);
  assert.equal(cleanedBody.failed[0].expression, "happy");
  assert.match(cleanedBody.failed[0].error, /already exists/);
  assert.ok(existsSync(join(dupDir, "happy.jpeg")), "conflicting JPEG must be left untouched");
  const backupDir = join(dupDir, ".cleanup-backups", cleanedBody.backupId);
  const manifest = JSON.parse(readFileSync(join(backupDir, "manifest.json"), "utf8"));
  assert.equal(manifest.entries.length, 1);
  assert.equal(manifest.entries[0].originalFilename, "happy.png");
  assert.ok(
    readFileSync(join(backupDir, "happy.png")).equals(originalPng),
    "the backup must hold the untouched original PNG",
  );

  // 3) POST handlers without any body answer 400, not 500.
  const noBody: Array<[string, number]> = [
    ["/api/sprites/char-1", 400],
    ["/api/sprites/char-1/cleanup-restore", 400],
    ["/api/sprites/cleanup", 400],
    ["/api/sprites/pixelize", 400],
    ["/api/sprites/generate-sheet", 400],
    ["/api/sprites/generate-sheet/preview", 400],
    ["/api/sprites/generate-animated-expressions", 400],
    ["/api/sprites/generate-animated-expressions/preview", 400],
  ];
  for (const [url, status] of noBody) {
    const response = await app.inject({ method: "POST", url });
    assert.equal(response.statusCode, status, `${url} without a body: ${response.body}`);
  }
  const exported = await app.inject({ method: "POST", url: "/api/sprites/char-1/export" });
  assert.equal(exported.statusCode, 200, "export without a body falls back to all expressions");

  // 4) generate-sheet skips the per-cell AI rerun once the sheet was cleaned by backgroundremover.
  const source = readFileSync(new URL("../../packages/server/src/routes/sprites.routes.ts", import.meta.url), "utf8");
  assert.match(source, /sheetCleanedByAi = cleaned\.engine === "backgroundremover"/);
  assert.match(source, /if \(shouldCleanBackground && !sheetCleanedByAi\)/);
  // Review fix: file identity uses bigint stats (64-bit NTFS file IDs lose precision as Numbers).
  assert.match(source, /statSync\(a, \{ bigint: true \}\)/);
  assert.match(source, /statSync\(b, \{ bigint: true \}\)/);
} finally {
  await app.close();
  rmSync(fixtureRoot, { recursive: true, force: true });
}
console.log("server-hunt-b23 regression passed");
