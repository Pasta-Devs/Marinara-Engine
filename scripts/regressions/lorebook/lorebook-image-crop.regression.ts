// Lorebook cover crop: the stored `imageCrop` round-trips through the routes, a new picture starts uncropped,
// removing the picture drops the crop, a garbage stored value reads back as null, and the avatar-generation
// routes accept the "cover" purpose (and still refuse an unknown one).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-lorebook-image-crop-"));
const previous = {
  DATA_DIR: process.env.DATA_DIR,
  FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR,
  MARINARA_FILE_STORAGE_DIR: process.env.MARINARA_FILE_STORAGE_DIR,
};
let closeStorage: (() => Promise<void>) | null = null;
let closeApp: (() => Promise<void>) | null = null;

try {
  const fileStorageDir = join(dataDir, "file-storage");
  process.env.DATA_DIR = dataDir;
  process.env.FILE_STORAGE_DIR = fileStorageDir;
  process.env.MARINARA_FILE_STORAGE_DIR = fileStorageDir;

  const [{ createFileNativeDB }, { lorebooksRoutes }, { charactersRoutes }, { lorebooks }, { eq }, registry] =
    await Promise.all([
      import("../../../packages/server/src/db/file-backed-store.js"),
      import("../../../packages/server/src/routes/lorebooks.routes.js"),
      import("../../../packages/server/src/routes/characters.routes.js"),
      import("../../../packages/server/src/db/schema/lorebooks.js"),
      import("../../../packages/server/src/db/file-query.js"),
      import("../../../packages/server/src/services/prompt-overrides/index.js"),
    ]);
  const db = await createFileNativeDB();
  closeStorage = () => db._fileStore.close();
  const Fastify = createRequire(new URL("../../../packages/server/package.json", import.meta.url))("fastify");
  const app = Fastify();
  app.decorate("db", db);
  // The server maps a failed zod parse to 400; the bare test app needs the same.
  app.setErrorHandler((error: { name?: string; statusCode?: number; message: string }, _request: unknown, reply: any) =>
    reply.status(error.name === "ZodError" ? 400 : (error.statusCode ?? 500)).send({ error: error.message }),
  );
  await app.register(lorebooksRoutes, { prefix: "/api/lorebooks" });
  await app.register(charactersRoutes, { prefix: "/api/characters" });
  closeApp = () => app.close();

  const request = async (method: string, url: string, payload?: unknown, status = 200): Promise<any> => {
    const response = await app.inject({ method, url, payload });
    assert.equal(response.statusCode, status, `${method} ${url} -> ${response.statusCode} ${response.body}`);
    return response.body ? response.json() : null;
  };
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2jX8AAAAASUVORK5CYII=";
  const crop = { srcX: 0.1, srcY: 0.2, srcWidth: 0.5, srcHeight: 0.5 };

  // A new book has no crop.
  const book = await request("POST", "/api/lorebooks", { name: "Covered" });
  assert.equal(book.imageCrop, null);

  // A crop saved through the normal update reads back, from the row and from the list.
  const withCrop = await request("PATCH", `/api/lorebooks/${book.id}`, { imageCrop: crop });
  assert.deepEqual(withCrop.imageCrop, crop);
  assert.deepEqual((await request("GET", `/api/lorebooks/${book.id}`)).imageCrop, crop);
  const listed = (await request("GET", "/api/lorebooks")) as Array<{ id: string; imageCrop: unknown }>;
  assert.deepEqual(listed.find((item) => item.id === book.id)?.imageCrop, crop);

  // A crop that leaves the source image is refused at the boundary.
  await request("PATCH", `/api/lorebooks/${book.id}`, { imageCrop: { ...crop, srcWidth: 2 } }, 400);

  // Saving another field leaves the crop alone.
  const renamed = await request("PATCH", `/api/lorebooks/${book.id}`, { name: "Covered again" });
  assert.deepEqual(renamed.imageCrop, crop);

  // A new picture starts uncropped.
  const uploaded = await request("POST", `/api/lorebooks/${book.id}/image`, { image: png });
  assert.ok(uploaded.imagePath, "the upload stores a picture");
  assert.equal(uploaded.imageCrop, null);

  // Crop it again, then remove the picture: the crop goes with it.
  await request("PATCH", `/api/lorebooks/${book.id}`, { imageCrop: crop });
  const removed = await request("PATCH", `/api/lorebooks/${book.id}`, { imagePath: null });
  assert.equal(removed.imagePath, null);
  assert.equal(removed.imageCrop, null);

  // Garbage in the stored column reads back as no crop instead of failing the book.
  await db.update(lorebooks).set({ imageCrop: "{not json" }).where(eq(lorebooks.id, book.id));
  assert.equal((await request("GET", `/api/lorebooks/${book.id}`)).imageCrop, null);
  await db
    .update(lorebooks)
    .set({ imageCrop: JSON.stringify({ srcX: 0, srcY: 0, srcWidth: 9, srcHeight: 9 }) })
    .where(eq(lorebooks.id, book.id));
  assert.equal((await request("GET", `/api/lorebooks/${book.id}`)).imageCrop, null);

  // Avatar generation: "cover" is a known purpose with its own registered prompt; anything else is refused.
  const keys = registry.PROMPT_OVERRIDE_REGISTRY.map((def: { key: string }) => def.key);
  assert.ok(keys.includes("characters.lorebookCover"));
  const coverPrompt = registry.CHARACTERS_LOREBOOK_COVER.defaultBuilder({
    name: "The Ashen Marches",
    appearance: "a ruined watchtower.",
  });
  assert.match(coverPrompt, /titled "The Ashen Marches"/);
  assert.match(coverPrompt, /a ruined watchtower\. Evocative scene or emblem, no text, no lettering\.$/);
  const badPurpose = await request(
    "POST",
    "/api/characters/avatar-generation/preview",
    { connectionId: "none", purpose: "banner", appearance: "x" },
    400,
  );
  assert.match(badPurpose.error, /avatar, character-sheet, cover, background, sticker-sheet or emoji-sheet/);
  // "cover" passes the purpose check and fails later, on the missing connection.
  const coverNoConnection = await request(
    "POST",
    "/api/characters/avatar-generation/preview",
    { connectionId: "none", purpose: "cover", appearance: "x" },
    400,
  );
  assert.doesNotMatch(coverNoConnection.error, /purpose/);
} finally {
  await closeApp?.();
  await closeStorage?.();
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key as keyof typeof previous];
    else process.env[key as keyof typeof previous] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
