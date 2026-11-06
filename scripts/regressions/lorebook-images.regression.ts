import { assemblePrompt, type AssemblerInput } from "../../packages/server/src/services/prompt/assembler.js";
import { lorebookEntries } from "../../packages/server/src/db/schema/lorebooks.js";
import { backupRoutes } from "../../packages/server/src/routes/backup.routes.js";
import AdmZip from "../../node_modules/adm-zip/adm-zip.js";
import assert from "node:assert/strict";
import { mkdir, symlink, writeFile, unlink, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { getDB, closeDB } from "../../packages/server/src/db/connection.js";
import { createCharactersStorage } from "../../packages/server/src/services/storage/characters.storage.js";
import { embedLorebookIntoCharacter } from "../../packages/server/src/services/lorebook/character-book-sync.js";
import { createLorebooksStorage } from "../../packages/server/src/services/storage/lorebooks.storage.js";
import { lorebooksRoutes } from "../../packages/server/src/routes/lorebooks.routes.js";
import { processLorebooks } from "../../packages/server/src/services/lorebook/index.js";
import { importMarinara } from "../../packages/server/src/services/import/marinara.importer.js";
import { importSTLorebook } from "../../packages/server/src/services/import/st-lorebook.importer.js";
import {
  readLorebookImageDataUrl,
  saveLorebookImage,
  restoreLorebookImages,
  lorebookImagesDirectory,
  embedCharacterBookImages,
  embedLorebookImages,
} from "../../packages/server/src/services/lorebook/lorebook-images.js";
import { ZodError } from "../../packages/server/node_modules/zod/index.js";
import { characterDataSchema, createLorebookEntrySchema } from "../../packages/shared/dist/index.js";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import multipart from "../../packages/server/node_modules/@fastify/multipart/index.js";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2jX8AAAAASUVORK5CYII=",
  "base64",
);
const db = await getDB();
const storage = createLorebooksStorage(db);
const app = Fastify();
app.decorate("db", db);
app.setErrorHandler((error, _request, reply) =>
  reply.status(error instanceof ZodError ? 400 : (error.statusCode ?? 500)).send({ error: error.message }),
);
await app.register(multipart);
await app.register(lorebooksRoutes, { prefix: "/api/lorebooks" });
await app.register(backupRoutes, { prefix: "/api/backup" });
function uploadPayload(buffer: Buffer, filename = "ref.png") {
  const boundary = "marinara-lorebook-image-regression";
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      buffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  };
}
try {
  const book = (await storage.create({ name: "Wardrobe references" }))!;
  const entry = (await storage.createEntry({
    lorebookId: book.id,
    name: "Coat",
    content: "The coat is blue.",
    keys: ["wardrobe"],
  }))!;
  assert.deepEqual(entry.images, [], "legacy entries default to no images");
  for (const [asset, mime] of [
    ["../../packages/server/src/assets/default-backgrounds/winter_mountains.jpg", "image/jpeg"],
    ["../../packages/client/public/illustrations/professor-mari-whats-new.webp", "image/webp"],
  ]) {
    const bytes = await readFile(new URL(asset!, import.meta.url));
    const formatEntry = (await storage.createEntry({ lorebookId: book.id, name: mime!, content: "Format reference" }))!;
    const uploadedFormat = await app.inject({
      method: "POST",
      url: `/api/lorebooks/${book.id}/entries/${formatEntry.id}/images`,
      ...uploadPayload(bytes),
    });
    assert.equal(uploadedFormat.statusCode, 200, uploadedFormat.body);
    const servedFormat = await app.inject(uploadedFormat.json().images[0].path);
    assert.equal(servedFormat.headers["content-type"], mime, "actual file signature determines image type");
    assert.deepEqual(servedFormat.rawPayload, bytes);
    await storage.removeEntry(formatEntry.id);
  }
  await assert.rejects(() => storage.appendEntryImage(entry.id, book.id, { path: "/etc/passwd", caption: "bad" }));
  assert.deepEqual((await storage.getEntry(entry.id))!.images, []);
  const url = `/api/lorebooks/${book.id}/entries/${entry.id}/images`;
  const uploaded = await app.inject({ method: "POST", url, ...uploadPayload(png) });
  assert.equal(uploaded.statusCode, 200, uploaded.body);
  const image = uploaded.json().images[0];
  assert.match(image.path, /^\/api\/lorebooks\/entry-images\//);
  const served = await app.inject(image.path);
  assert.equal(served.statusCode, 200, served.body);
  assert.equal(served.headers["content-type"], "image/png");
  assert.deepEqual(served.rawPayload, png);
  const filesBeforeFailedAttach = new Set(await readdir(lorebookImagesDirectory()));
  const originalTransaction = db.transaction;
  try {
    for (const [message, status, removedBeforeRollback] of [
      ["Injected image attachment failure", 500, true],
      ["Maximum 4 images per entry", 400, true],
      ["Injected image attachment failure", 500, false],
    ] as const) {
      db.transaction = async () => {
        const createdFiles = (await readdir(lorebookImagesDirectory())).filter(
          (file) => !filesBeforeFailedAttach.has(file),
        );
        assert.equal(createdFiles.length, 1);
        // Also cover another cleanup removing the file before attachment rollback.
        if (removedBeforeRollback) await unlink(join(lorebookImagesDirectory(), createdFiles[0]!));
        throw new Error(message);
      };
      const failedAttach = await app.inject({ method: "POST", url, ...uploadPayload(png) });
      assert.equal(failedAttach.statusCode, status);
      assert.equal(failedAttach.json().error, message);
      assert.deepEqual((await storage.getEntry(entry.id))!.images, [image]);
      assert.deepEqual(
        new Set(await readdir(lorebookImagesDirectory())),
        filesBeforeFailedAttach,
        "failed attachments leave no new image file behind",
      );
    }
  } finally {
    db.transaction = originalTransaction;
  }
  const budgetBook = (await storage.create({ name: "Image budget", tokenBudget: 1000 }))!;
  const mixed = (await storage.createEntry({
    lorebookId: budgetBook.id,
    name: "Mixed reference",
    keys: ["budget"],
    order: 0,
    content: "A blue coat.",
    images: [image],
  }))!;
  const scanBudget = (tokenBudget: number) =>
    processLorebooks(db, [{ role: "user", content: "budget" }], null, {
      activeLorebookIds: [budgetBook.id],
      tokenBudget,
      previewOnly: true,
    });
  assert.equal((await scanBudget(1000)).imageEntries?.[0]?.images.length, 1, "text keeps affordable images");
  const laterText = (await storage.createEntry({
    lorebookId: budgetBook.id,
    name: "Later text",
    keys: ["budget"],
    order: 1,
    content: "The queen guards the northern gate. ".repeat(15),
  }))!;
  const textFirst = await scanBudget(300);
  assert.deepEqual(new Set(textFirst.activatedEntryIds), new Set([mixed.id, laterText.id]));
  assert.equal(textFirst.imageEntries, undefined, "all affordable text precedes optional images");
  await storage.removeEntry(laterText.id);
  const secondImage = await saveLorebookImage(png);
  await storage.updateEntry(mixed.id, { content: "", images: [image, secondImage] });
  assert.equal(
    (await scanBudget(800)).imageEntries?.[0]?.images.length,
    2,
    "image-only references are charged once and retain both fitting images",
  );
  assert.equal((await scanBudget(300)).imageEntries?.[0]?.images.length, 1, "image-only references obey the budget");
  await storage.remove(budgetBook.id);
  assert.equal(
    (await app.inject({ method: "POST", url, ...uploadPayload(Buffer.from("<svg/>"), "fake.png") })).statusCode,
    400,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/api/lorebooks/not-this-book/entries/${entry.id}/images`,
        ...uploadPayload(png),
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await app.inject({
        method: "PATCH",
        url: `/api/lorebooks/${book.id}/entries/${entry.id}`,
        payload: { images: [{ path: "/etc/passwd", caption: "" }] },
      })
    ).statusCode,
    400,
  );
  const patched = await app.inject({
    method: "PATCH",
    url: `/api/lorebooks/${book.id}/entries/${entry.id}`,
    payload: { images: [{ ...image, caption: "Blue coat" }] },
  });
  assert.equal(patched.statusCode, 200, patched.body);
  assert.equal(patched.json().content, entry.content, "image editing preserves text");
  const native = await app.inject(`/api/lorebooks/${book.id}/export`);
  assert.equal(native.statusCode, 200, native.body);
  const envelope = native.json();
  assert.equal(envelope.data.entries[0].images[0].path, undefined, "portable export carries no foreign local paths");
  const dataUrl = envelope.data.entries[0].images[0].dataUrl;
  assert.equal(dataUrl, await readLorebookImageDataUrl(image.path));
  const imported = await importMarinara(envelope, db);
  assert.equal(imported.success, true);
  const restored = (await storage.listEntries(imported.id!))[0]!;
  assert.equal(restored.images[0]?.caption, "Blue coat");
  assert.notEqual(restored.images[0]?.path, image.path);
  assert.equal(await readLorebookImageDataUrl(restored.images[0]!.path), dataUrl);
  const compatible = await app.inject(`/api/lorebooks/${book.id}/export?format=compatible`);
  const importedCompatible = await importSTLorebook(compatible.json(), db);
  assert.equal(importedCompatible.success, true);
  const compatibleEntry = (await storage.listEntries(importedCompatible.lorebookId!))[0]!;
  assert.equal(await readLorebookImageDataUrl(compatibleEntry.images[0]!.path), dataUrl);
  const character = (await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Tailor" })))!;
  const embedded = await embedLorebookIntoCharacter(db, character.id, book.id);
  assert.equal(
    embedded.characterBook.entries[0]!.extensions.marinaraImages[0].path,
    image.path,
    "embedded books mirror small local references",
  );
  assert.equal(
    lorebookImagesDirectory(),
    join(process.env.DATA_DIR!, "lorebooks", "images", "entries"),
    "assets live in the profile-backed-up image tree",
  );
  const portableCharacter = await embedCharacterBookImages({ character_book: embedded.characterBook });
  assert.equal(portableCharacter.character_book.entries[0]!.extensions.marinaraImages[0].dataUrl, dataUrl);
  const exportBudget = { remainingBytes: png.length * 2 };
  await embedLorebookImages([{ images: [image] }], exportBudget);
  await embedCharacterBookImages({ character_book: embedded.characterBook }, exportBudget);
  assert.equal(exportBudget.remainingBytes, 0, "books and embedded character books share one export allowance");
  await assert.rejects(
    () => embedLorebookImages([{ images: [image] }], exportBudget),
    (error: any) => error.statusCode === 413 && /64 MiB.*fewer items/.test(error.message),
    "aggregate export bytes are bounded across successive books and callers",
  );
  const corrupt = await saveLorebookImage(png);
  const corruptFile = join(lorebookImagesDirectory(), corrupt.path.split("/").at(-1)!);
  await writeFile(corruptFile, Buffer.alloc(png.length));
  const validBudget = { remainingBytes: png.length };
  const partlyReadable = await embedLorebookImages([{ images: [corrupt, image] }], validBudget);
  assert.equal(partlyReadable[0]!.images.length, 1, "skipped corrupt files do not displace valid export images");
  assert.equal(validBudget.remainingBytes, 0);
  await unlink(corruptFile);
  const profileResponse = await app.inject("/api/backup/export-profile");
  assert.equal(profileResponse.statusCode, 200, profileResponse.body);
  const profile = profileResponse.json();
  const assetPath = `lorebooks/images/entries/${image.path.split("/").at(-1)}`;
  assert.equal(
    profile.data.fileStorage.files.find((asset: { path: string }) => asset.path === assetPath)?.data,
    png.toString("base64"),
  );
  const compatibleProfileResponse = await app.inject("/api/backup/export-profile?format=compatible");
  assert.equal(compatibleProfileResponse.statusCode, 200, compatibleProfileResponse.body);
  const profileZip = new AdmZip(compatibleProfileResponse.rawPayload);
  const exportedCharacter = JSON.parse(
    profileZip
      .getEntries()
      .find((entry) => entry.entryName.startsWith("characters/"))!
      .getData()
      .toString(),
  );
  assert.equal(exportedCharacter.data.character_book.entries[0].extensions.marinaraImages[0].dataUrl, dataUrl);
  const exportedBook = profileZip
    .getEntries()
    .filter((entry) => entry.entryName.startsWith("lorebooks/"))
    .map((entry) => JSON.parse(entry.getData().toString()))
    .find((book) => book.name === "Wardrobe references");
  assert.equal(exportedBook.entries["0"].extensions.marinaraImages[0].dataUrl, dataUrl);
  const reimport = await importSTLorebook(embedded.characterBook, db, { allowLocalImagePaths: true });
  assert.equal(reimport.success, true);
  assert.equal((await storage.listEntries(reimport.lorebookId!))[0]!.images[0]!.caption, "Blue coat");
  assert.equal(
    (await storage.listEntries(reimport.lorebookId!))[0]!.images[0]!.path,
    image.path,
    "local reimport reuses files",
  );
  const outlet = (await storage.createEntry({
    lorebookId: book.id,
    name: "Outlet",
    keys: ["wardrobe"],
    position: 7,
    outletName: "outfit",
    content: "stone",
    images: [image],
  }))!;
  const after = (await storage.createEntry({
    lorebookId: book.id,
    name: "After",
    keys: ["wardrobe"],
    position: 1,
    content: "stone",
  }))!;
  const makeSection = (
    id: string,
    content: string,
    markerConfig: string | null = null,
  ): AssemblerInput["sections"][number] => ({
    id,
    presetId: "fixture",
    identifier: id,
    name: id,
    content,
    role: "system",
    enabled: "true",
    isMarker: markerConfig ? "true" : "false",
    groupId: null,
    markerConfig,
    injectionPosition: "relative",
    injectionDepth: 0,
    injectionOrder: 0,
    forbidOverrides: "false",
  });
  const promptInput: AssemblerInput = {
    db,
    preset: {
      id: "fixture",
      name: "fixture",
      sectionOrder: '["after","outlet"]',
      groupOrder: "[]",
      wrapFormat: "xml",
      parameters: "{}",
      variableGroups: "[]",
      variableValues: "{}",
    },
    sections: [makeSection("after", "", '{"type":"world_info_after"}'), makeSection("outlet", "stone")],
    groups: [],
    choiceBlocks: [],
    chatChoices: {},
    chatId: "fixture",
    characterIds: [],
    personaName: "User",
    personaDescription: "",
    chatMessages: [{ role: "user", content: "wardrobe" }],
    activeLorebookIds: [book.id],
    previewOnly: true,
  };
  const unused = await assemblePrompt(promptInput);
  assert.ok(
    !unused.lorebookScanResult?.imageEntries?.some((entry) => entry.id === outlet.id),
    "after marker and matching text never activate an unused Outlet image",
  );
  const replaced = await assemblePrompt({
    ...promptInput,
    sections: [promptInput.sections[0]!, makeSection("outlet", "{{outlet::outfit}}", '{"type":"chat_summary"}')],
    chatSummary: "A summary",
  });
  assert.ok(
    !replaced.lorebookScanResult?.imageEntries?.some((entry) => entry.id === outlet.id),
    "marker replacement cannot claim an Outlet from discarded template text",
  );
  const conditional = await assemblePrompt({
    ...promptInput,
    sections: [
      promptInput.sections[0]!,
      makeSection("outlet", 'kept {{#if char == "Nobody At All"}}{{outlet::outfit}}{{/if}}'),
    ],
  });
  assert.ok(
    !conditional.lorebookScanResult?.imageEntries?.find((entry) => entry.id === outlet.id)?.outletUsed,
    "an Outlet removed by a conditional cannot claim its images",
  );
  const used = await assemblePrompt({
    ...promptInput,
    sections: [promptInput.sections[0]!, makeSection("outlet", "{{outlet::outfit}}")],
  });
  assert.equal(
    used.lorebookScanResult?.imageEntries?.find((entry) => entry.id === outlet.id)?.outletUsed,
    true,
    "emitted Outlet references carry their images",
  );
  const portrait = (await storage.createEntry({
    lorebookId: book.id,
    name: "Portrait",
    constant: true,
    position: 7,
    outletName: "portrait",
    content: "",
    images: [image],
  }))!;
  const imageOnly = await assemblePrompt({
    ...promptInput,
    sections: [promptInput.sections[0]!, makeSection("outlet", "{{outlet::portrait}}")],
  });
  assert.equal(
    imageOnly.lorebookScanResult?.imageEntries?.find((entry) => entry.id === portrait.id)?.outletUsed,
    true,
    "an explicitly used image-only Outlet keeps its images",
  );
  await storage.removeEntry(portrait.id);
  await storage.removeEntry(outlet.id);
  await storage.removeEntry(after.id);
  const filesBefore = await readdir(lorebookImagesDirectory());
  const booksBefore = (await storage.list()).length;
  await assert.rejects(() =>
    importMarinara(
      {
        ...envelope,
        data: {
          lorebook: { name: "Invalid later image" },
          entries: [
            { name: "Valid first", images: [{ dataUrl, caption: "valid" }] },
            { name: "Invalid second", images: [{ dataUrl: "bad", caption: "invalid" }] },
          ],
        },
      },
      db,
    ),
  );
  assert.deepEqual(await readdir(lorebookImagesDirectory()), filesBefore);
  assert.equal((await storage.list()).length, booksBefore);
  // Force persistence failure after portable image files have been saved.
  const failingDb: typeof db = new Proxy(db, {
    get(target, property) {
      // Transactions pass a handle to their callback; keep failure injection active there too.
      if (property === "transaction")
        return (operation: (tx: typeof db) => Promise<unknown>) => target.transaction(() => operation(failingDb));
      if (property === "insert")
        return (table: unknown) => {
          if (table === lorebookEntries)
            return {
              values: () => {
                throw new Error("Forced entry write failure");
              },
            };
          return target.insert(table as Parameters<typeof target.insert>[0]);
        };
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  await assert.rejects(() => importMarinara(envelope, failingDb), /Forced entry write failure/);
  assert.deepEqual(await readdir(lorebookImagesDirectory()), filesBefore, "failed native import removes saved assets");
  assert.equal((await storage.list()).length, booksBefore, "failed native import removes its book");
  const oldEntries = await storage.listEntries(book.id);
  await assert.rejects(
    () => importSTLorebook(compatible.json(), failingDb, { existingLorebookId: book.id }),
    /Forced entry write failure/,
  );
  assert.deepEqual(
    await readdir(lorebookImagesDirectory()),
    filesBefore,
    "failed compatible import removes saved assets",
  );
  assert.deepEqual(await storage.listEntries(book.id), oldEntries, "failed reimport preserves existing entries");
  const defaultCaption = await storage.createEntry({
    lorebookId: book.id,
    name: "Caption default",
    images: [{ path: image.path }],
  } as any);
  assert.equal(defaultCaption!.images[0]!.caption, "", "create stores schema defaults");
  await storage.removeEntry(defaultCaption!.id);
  const copiedBook = (await storage.create({ name: "Copy target" }))!;
  const transferred = await app.inject({
    method: "POST",
    url: `/api/lorebooks/${book.id}/entries/transfer`,
    payload: { entryIds: [entry.id], targetLorebookId: copiedBook.id, operation: "copy" },
  });
  assert.equal(transferred.statusCode, 200, transferred.body);
  assert.deepEqual(transferred.json().created[0].images, [{ ...image, caption: "Blue coat" }]);
  await assert.rejects(() =>
    importSTLorebook(
      {
        name: "Invalid re-import",
        entries: [{ keys: ["wardrobe"], content: "bad", extensions: { marinaraImages: [{ path: image.path }] } }],
      },
      db,
      { existingLorebookId: book.id },
    ),
  );
  assert.equal(
    (await storage.listEntries(book.id))[0]?.content,
    entry.content,
    "invalid attachment import never destroys existing entries",
  );
  const appendResults = await Promise.all(
    [saveLorebookImage(png), saveLorebookImage(png)].map(async (saved) =>
      storage.appendEntryImage(entry.id, book.id, await saved),
    ),
  );
  assert.equal(appendResults.length, 2);
  assert.equal((await storage.getEntry(entry.id))!.images.length, 3, "concurrent uploads append atomically");
  await storage.appendEntryImage(entry.id, book.id, await saveLorebookImage(png));
  assert.equal((await app.inject({ method: "POST", url, ...uploadPayload(png) })).statusCode, 400);
  assert.equal((await storage.getEntry(entry.id))!.images.length, 4);
  assert.throws(() =>
    createLorebookEntrySchema.parse({ lorebookId: book.id, name: "bad", images: [image, image, image, image, image] }),
  );
  await assert.rejects(() => restoreLorebookImages([{ path: image.path, caption: "foreign" }]));
  assert.equal(await readLorebookImageDataUrl("https://example.com/ref.png"), null);
  assert.equal(await readLorebookImageDataUrl("/api/lorebooks/entry-images/../../secret.png"), null);
  await mkdir(lorebookImagesDirectory(), { recursive: true });
  const filename = "00000000-0000-0000-0000-000000000000.png";
  const outside = join(process.env.DATA_DIR!, "not-an-image.png");
  await writeFile(outside, png);
  await symlink(outside, join(lorebookImagesDirectory(), filename));
  assert.equal(
    await readLorebookImageDataUrl(`/api/lorebooks/entry-images/${filename}`),
    null,
    "symlinks do not expose other files",
  );
  await unlink(join(lorebookImagesDirectory(), filename));
  await unlink(join(lorebookImagesDirectory(), image.path.split("/").pop()!));
  const missingExport = await app.inject("/api/backup/export-profile?format=compatible");
  assert.equal(missingExport.statusCode, 200, "a missing reference image must not abort the whole export");
  console.info("Lorebook image storage, routes and portable import/export regressions passed");
} finally {
  await app.close();
  await closeDB();
}
