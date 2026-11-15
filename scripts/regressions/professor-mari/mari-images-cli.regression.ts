// #9329: Professor Mari's `mari images` command. The images it makes must load from the URL it hands her (they have no
// gallery row, only a manifest entry).
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "marinara-mari-images-cli-"));
const originalEnv = { DATA_DIR: process.env.DATA_DIR, FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR };
process.env.DATA_DIR = root;
process.env.FILE_STORAGE_DIR = join(root, "storage");
process.env.LOG_LEVEL = "silent";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

// A local AUTOMATIC1111 stand-in that records what Marinara sent it.
const sent: Array<{ prompt?: string; negative_prompt?: string }> = [];
const imageServer = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    if (body) sent.push(JSON.parse(body) as { prompt?: string; negative_prompt?: string });
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ images: [PNG.toString("base64")] }));
  });
});
await new Promise<void>((resolve) => imageServer.listen(0, "127.0.0.1", resolve));
const imageBaseUrl = `http://127.0.0.1:${(imageServer.address() as AddressInfo).port}`;

const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify");
const { getDB } = await import("../../../packages/server/src/db/connection.js");
const { galleryRoutes } = await import("../../../packages/server/src/routes/gallery.routes.js");
const { getMariDbService } = await import("../../../packages/server/src/services/mari-db/mari-db.service.js");
const { createConnectionsStorage } =
  await import("../../../packages/server/src/services/storage/connections.storage.js");
const { createConnectionSchema } = await import("../../../packages/shared/dist/index.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(galleryRoutes, { prefix: "/api/gallery" });

try {
  const mari = getMariDbService(db);
  const images = async (...args: string[]) => {
    const result = await mari.executeCli({ argv: ["images", ...args], sessionId: "mari-images-cli" });
    assert.equal(result.ok, true, `mari images ${args.join(" ")}\n${JSON.stringify(result)}`);
    return result.output as Record<string, unknown>;
  };
  await createConnectionsStorage(db).create(
    createConnectionSchema.parse({
      name: "Local A1111",
      provider: "image_generation",
      baseUrl: imageBaseUrl,
      imageService: "automatic1111",
    }),
  );

  // 1. The URL a generated preview asset returns serves the image.
  const generated = (await images("generate", "--prompt", "a castle above a lake at dusk")) as {
    asset: { url: string; filename: string };
  };
  const served = await app.inject(generated.asset.url);
  assert.equal(served.statusCode, 200, `preview asset URL ${generated.asset.url} loads`);
  assert.deepEqual(served.rawPayload, PNG, "the URL serves the saved image");
  assert.equal((await app.inject(`${generated.asset.url}?w=320`)).statusCode, 200, "a thumbnail request loads too");

  // A file dropped into the folder that the manifest doesn't list stays unserved.
  writeFileSync(join(root, "gallery", "mari-images", "stray.png"), PNG);
  assert.equal((await app.inject("/api/gallery/file/mari-images/stray.png")).statusCode, 404, "unlisted file");
  assert.equal(
    (await app.inject("/api/gallery/file/mari-images/manifest.json")).statusCode,
    404,
    "the manifest is not an image",
  );
  assert.ok(readFileSync(join(root, "gallery", "mari-images", generated.asset.filename)).length > 0);

  console.log("mari images CLI regression passed.");
} finally {
  await app.close();
  await db._fileStore?.close?.();
  imageServer.close();
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(root, { recursive: true, force: true });
}
