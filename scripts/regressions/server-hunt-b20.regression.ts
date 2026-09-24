// Regression checks for server hunt batch 20 (import.routes.ts):
// 1. The folder picker kills its dialog process when the 60s timeout fires.
// 2. A corrupt avatar entry in a .marinara package gives a 400, not a 500.
// 3. JSON import routes reject a null body with a 400 instead of throwing.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import fastifyMultipart from "../../packages/server/node_modules/@fastify/multipart/index.js";
import AdmZip from "../../packages/server/node_modules/adm-zip/adm-zip.js";

process.env.LOG_LEVEL = "silent";
const dataDir = mkdtempSync(join(tmpdir(), "marinara-b20-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = `${process.env.DATA_DIR}/storage`; // never the live store named in .env

const { importRoutes } = await import("../../packages/server/src/routes/import.routes.js");

const app = Fastify({ logger: false });
await app.register(fastifyMultipart);
// The paths under test return before touching storage.
app.decorate("db", {} as any);
await app.register(importRoutes, { prefix: "/api/import" });
await app.ready();

try {
  // 3. Null JSON body.
  for (const route of ["/api/import/marinara", "/api/import/st-preset", "/api/import/st-lorebook"]) {
    const res = await app.inject({
      method: "POST",
      url: route,
      headers: { "content-type": "application/json" },
      payload: "null",
    });
    assert.equal(res.statusCode, 400, `${route} must reject a null body with 400 (got ${res.statusCode})`);
    assert.equal(res.json().success, false);
  }

  // 2. Corrupt avatar entry.
  const zip = new AdmZip();
  zip.addFile("data.json", Buffer.from(JSON.stringify({ type: "marinara_character", version: 1, data: { name: "X" } })));
  const avatarBytes = Buffer.alloc(4096);
  for (let i = 0; i < avatarBytes.length; i++) avatarBytes[i] = (i * 31 + (i >> 3)) & 0xff;
  zip.addFile("avatar.png", avatarBytes);
  const pkg = zip.toBuffer();
  // Flip bytes inside the avatar's stored/compressed data so decompression or the CRC check fails.
  const nameAt = pkg.indexOf(Buffer.from("avatar.png"));
  assert.ok(nameAt > 0, "fixture must contain the avatar local header");
  const dataStart = nameAt + "avatar.png".length + pkg.readUInt16LE(nameAt - 2);
  for (let i = 4; i < 64; i++) pkg[dataStart + i] ^= 0xa5;
  assert.throws(() => new AdmZip(pkg).getEntry("avatar.png")!.getData(), "fixture avatar must be unreadable");

  const boundary = "----b20boundary";
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="x.marinara"\r\nContent-Type: application/octet-stream\r\n\r\n`,
    ),
    pkg,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const res = await app.inject({
    method: "POST",
    url: "/api/import/marinara-package",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: body,
  });
  assert.equal(res.statusCode, 400, `corrupt package avatar must give 400 (got ${res.statusCode}: ${res.body})`);
  assert.match(res.json().error, /avatar/i);

  // 1. Folder picker timeout kills the child (spawns a real GUI dialog, so check source).
  const source = readFileSync(new URL("../../packages/server/src/routes/import.routes.ts", import.meta.url), "utf8");
  const pick = source.slice(source.indexOf("function pickFolder("), source.indexOf("/** Read PNG tEXt chunk"));
  assert.match(pick, /setTimeout\(\(\) => \{[\s\S]*?child\?\.kill\(\)[\s\S]*?done\(null\)/, "timeout must kill the dialog child");
  for (const cmd of ["osascript", "powershell.exe", "zenity", "kdialog"]) {
    assert.ok(
      new RegExp(String.raw`child = execFile\(\s*"` + cmd.replace(/\./g, String.raw`\.`) + '"').test(pick),
      `${cmd} child must be tracked`,
    );
  }
  assert.match(pick, /if \(resolved\) return;\s*child = execFile\(\s*"kdialog"/, "kdialog must not start after timeout");

  console.log("server-hunt-b20 regression: ok");
} finally {
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
}
