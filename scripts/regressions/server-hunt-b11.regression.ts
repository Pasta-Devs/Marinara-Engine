// Connection image uploads must clean up files that no connection references any more,
// while keeping files still shared by a duplicated connection.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const previous = {
  DATA_DIR: process.env.DATA_DIR,
  FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR,
  LOG_LEVEL: process.env.LOG_LEVEL,
};
const directory = mkdtempSync(join(tmpdir(), "marinara-hunt-b11-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.LOG_LEVEL = "silent";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
).toString("base64");
const imagesDir = join(directory, "connections", "images");
const fileOf = (imagePath: string) => join(imagesDir, imagePath.split("/").pop()!);

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { connectionsRoutes } = await import("../../packages/server/src/routes/connections.routes.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");

const app = Fastify();
const db = await createFileNativeDB();
try {
  const storage = createConnectionsStorage(db);
  app.decorate("db", db);
  await app.register(connectionsRoutes, { prefix: "/api/connections" });

  const conn = await storage.create({ name: "Image owner", provider: "openai", baseUrl: "", apiKey: "", model: "" });
  const upload = async (id: string) => {
    const res = await app.inject({ method: "POST", url: `/api/connections/${id}/image`, payload: { image: PNG } });
    assert.equal(res.statusCode, 200, res.body);
    return res.json().imagePath as string;
  };

  // Re-uploading removes the previous, now unreferenced file.
  const first = await upload(conn.id);
  assert.ok(existsSync(fileOf(first)));
  const second = await upload(conn.id);
  assert.ok(existsSync(fileOf(second)));
  assert.equal(existsSync(fileOf(first)), false, "previous connection image should be deleted on re-upload");

  // A duplicate shares the file, so re-uploading on the original must keep it.
  const dup = await app.inject({ method: "POST", url: `/api/connections/${conn.id}/duplicate` });
  assert.equal(dup.statusCode, 200, dup.body);
  const dupId = dup.json().id as string;
  assert.equal((await storage.getById(dupId))?.imagePath, second);
  const third = await upload(conn.id);
  assert.ok(existsSync(fileOf(second)), "image still used by the duplicate must be kept");

  // Deleting the duplicate frees the shared file.
  const delDup = await app.inject({ method: "DELETE", url: `/api/connections/${dupId}` });
  assert.equal(delDup.statusCode, 204);
  assert.equal(existsSync(fileOf(second)), false, "deleting the last referencing connection should remove its image");

  // PATCH clearing the image removes the file.
  const patch = await app.inject({ method: "PATCH", url: `/api/connections/${conn.id}`, payload: { imagePath: null } });
  assert.equal(patch.statusCode, 200, patch.body);
  assert.equal(existsSync(fileOf(third)), false, "clearing imagePath should remove the old file");

  // Deleting a connection removes its image.
  const fourth = await upload(conn.id);
  const del = await app.inject({ method: "DELETE", url: `/api/connections/${conn.id}` });
  assert.equal(del.statusCode, 204);
  assert.equal(existsSync(fileOf(fourth)), false, "deleting a connection should remove its image");
} finally {
  try {
    await app.close();
  } finally {
    await db._fileStore.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(directory, { recursive: true, force: true });
  }
}
console.log("server-hunt-b11 regressions passed.");
