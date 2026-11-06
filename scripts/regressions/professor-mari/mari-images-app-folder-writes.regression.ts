// `mari images` writes and reads files in the app folders (the preview folder and its manifest, backgrounds and their
// meta.json, avatars, lorebook images, sprites, chat and character galleries). Professor Mari's shell can write into
// those folders when the data dir sits inside her workspace, so a file or folder there may be a link. Every read, write
// and delete stays inside the real folder: a linked file or folder, dangling or not, is refused and its target is never
// touched, a chat or character ID cannot move a gallery write out of its folder, and the shared gallery cleanup (also
// used by the gallery UI) never deletes through a linked folder. Normal work, with DATA_DIR itself reached through a
// link, still writes. Both mari CLI routes run this service.
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = realpathSync(mkdtempSync(join(tmpdir(), "marinara-mari-images-writes-")));
const dataDir = join(root, "data");
const outside = join(root, "outside");
const originalEnv = { DATA_DIR: process.env.DATA_DIR, FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR };
mkdirSync(join(dataDir, "storage"), { recursive: true });
mkdirSync(outside);
symlinkSync(dataDir, join(root, "data-link"), "dir");
process.env.DATA_DIR = join(root, "data-link");
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const DATA_URL = `data:image/png;base64,${PNG.toString("base64")}`;
const BAIT = "outside-file-mari-must-not-touch";

// A local AUTOMATIC1111 stand-in, so `mari images generate` runs without a network.
const imageServer = createServer((request, response) => {
  request.resume();
  request.on("end", () => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ images: [PNG.toString("base64")] }));
  });
});
await new Promise<void>((resolve) => imageServer.listen(0, "127.0.0.1", resolve));
const imageBaseUrl = `http://127.0.0.1:${(imageServer.address() as AddressInfo).port}`;

const { createFileNativeDB } = await import("../../../packages/server/src/db/file-backed-store.js");
const { getMariDbService } = await import("../../../packages/server/src/services/mari-db/mari-db.service.js");
const { createCharactersStorage } = await import("../../../packages/server/src/services/storage/characters.storage.js");
const { createLorebooksStorage } = await import("../../../packages/server/src/services/storage/lorebooks.storage.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } =
  await import("../../../packages/server/src/services/storage/connections.storage.js");
const { unlinkGalleryFileIfUnreferenced } =
  await import("../../../packages/server/src/services/image/gallery-file-lifecycle.js");
const { characterDataSchema, createChatSchema, createConnectionSchema, createLorebookSchema } =
  await import("../../../packages/shared/dist/index.js");

const db = await createFileNativeDB();
try {
  const mari = getMariDbService(db);
  const images = async (...args: string[]) => {
    const result = await mari.executeCli({ argv: ["images", ...args], sessionId: "app-folder-writes" });
    return { ...result, text: JSON.stringify(result) };
  };
  const ok = async (...args: string[]) => {
    const result = await images(...args);
    assert.equal(result.ok, true, `mari images ${args.join(" ")}\n${result.text}`);
    return result;
  };
  const contents = (path: string) => (existsSync(path) ? readFileSync(path) : null);
  // Refused, without showing, changing, deleting or creating the outside files named.
  const refused = async (args: string[], ...untouched: string[]) => {
    const snapshot = untouched.map((path) => [path, contents(path)] as const);
    const result = await images(...args);
    assert.equal(result.ok, false, `mari images ${args.join(" ")} is refused\n${result.text}`);
    assert.match(
      result.text,
      /escapes the allowed directory|Linked app file refused|ENOENT|Invalid gallery folder ID/u,
      args.join(" "),
    );
    assert.ok(!result.text.includes(BAIT), `${args.join(" ")} never shows the outside file:\n${result.text}`);
    for (const [path, before] of snapshot) assert.deepEqual(contents(path), before, `${args.join(" ")}: ${path}`);
  };
  const bait = (name: string, content = BAIT) => {
    const path = join(outside, name);
    writeFileSync(path, content);
    return path;
  };
  // Swaps an app folder for a link to a folder outside, and returns a function that puts the real folder back.
  const linkFolder = (folder: string, target: string) => {
    mkdirSync(target, { recursive: true });
    const aside = `${folder}.real`;
    if (existsSync(folder)) renameSync(folder, aside);
    symlinkSync(target, folder, "dir");
    return () => {
      rmSync(folder);
      if (existsSync(aside)) renameSync(aside, folder);
    };
  };
  const files = (dir: string) => (existsSync(dir) ? readdirSync(dir).sort() : []);

  const characters = createCharactersStorage(db);
  const character = (await characters.create(characterDataSchema.parse({ name: "Folder proof" })))!;
  const persona = (await characters.createPersona("Folder persona", ""))!;
  const lorebook = (await createLorebooksStorage(db).create(createLorebookSchema.parse({ name: "Folder lorebook" })))!;
  const chat = (await createChatsStorage(db).create(
    createChatSchema.parse({ name: "Folder chat", mode: "roleplay", characterIds: [character.id] }),
  ))!;
  await createConnectionsStorage(db).create(
    createConnectionSchema.parse({
      name: "Local A1111",
      provider: "image_generation",
      baseUrl: imageBaseUrl,
      imageService: "automatic1111",
    }),
  );
  const previewDir = join(dataDir, "gallery", "mari-images");
  const backgrounds = join(dataDir, "backgrounds");
  const avatars = join(dataDir, "avatars");
  const sprites = join(dataDir, "sprites");
  const characterSprites = join(sprites, character.id);

  // Normal work still writes, through a DATA_DIR that is itself a link.
  const generated = (await ok("generate", "--prompt", "a lantern")).output as {
    asset: { id: string; filename: string };
  };
  assert.deepEqual(readFileSync(join(previewDir, generated.asset.filename)), PNG, "generate saves the preview");
  const listed = (await ok("list", "assets")).output as Array<{ id: string }>;
  assert.deepEqual(
    listed.map((asset) => asset.id),
    [generated.asset.id],
    "the manifest lists it",
  );
  const fromAsset = ["--asset", generated.asset.id, "--apply"];
  await ok("assign", "--target", "background", "--name", "dawn", "--tags", "sky", ...fromAsset);
  assert.deepEqual(readFileSync(join(backgrounds, "dawn.png")), PNG);
  assert.deepEqual(JSON.parse(readFileSync(join(backgrounds, "meta.json"), "utf8")), { "dawn.png": { tags: ["sky"] } });
  const listedBackgrounds = (await ok("list", "backgrounds")).output as Array<{ filename: string; tags: string[] }>;
  assert.deepEqual(listedBackgrounds, [{ filename: "dawn.png", url: "/api/backgrounds/file/dawn.png", tags: ["sky"] }]);
  await ok("assign", "--target", "character-avatar", "--character", character.id, ...fromAsset);
  await ok("assign", "--target", "persona-avatar", "--persona", persona.id, ...fromAsset);
  assert.equal(files(avatars).length, 2, "both avatars are saved");
  const characterAvatar = (await characters.getById(character.id))!.avatarPath!;
  assert.ok(existsSync(join(avatars, characterAvatar.split("/").pop()!)));
  await ok("assign", "--target", "lorebook-image", "--lorebook", lorebook.id, ...fromAsset);
  assert.equal(files(join(dataDir, "lorebooks", "images")).length, 1);
  const sprite = ["--target", "sprite", "--character", character.id];
  await ok("assign", ...sprite, "--expression", "smile", ...fromAsset);
  await ok("assign", ...sprite, "--expression", "smile", "--source", DATA_URL, "--apply");
  assert.deepEqual(files(characterSprites), ["catalog.json", "smile.png"], "a sprite is replaced under its name");
  const imageId = (result: { output?: unknown }) =>
    (result.output as { result: { image: { id: string } } }).result.image.id;
  const chatImageId = imageId(await ok("assign", "--target", "chat-gallery", "--chat", chat.id, ...fromAsset));
  assert.equal(files(join(dataDir, "gallery", chat.id)).length, 1);
  const characterImageId = imageId(
    await ok("assign", "--target", "character-gallery", "--character", character.id, ...fromAsset),
  );
  assert.equal(files(join(dataDir, "gallery", "characters", character.id)).length, 1);
  await ok("delete", "--target", "background", "--filename", "dawn.png", "--apply");
  assert.ok(!existsSync(join(backgrounds, "dawn.png")));
  assert.deepEqual(JSON.parse(readFileSync(join(backgrounds, "meta.json"), "utf8")), {});
  await ok("delete", "--target", "character-avatar", "--character", character.id, "--delete-file", "--apply");
  assert.equal(files(avatars).length, 1, "the character avatar file is removed");
  await ok("delete", "--target", "asset", "--asset", generated.asset.id, "--apply");
  assert.deepEqual(files(previewDir), ["manifest.json"], "the preview is removed and the manifest kept");
  for (const dir of [previewDir, backgrounds, avatars, characterSprites, join(dataDir, "lorebooks", "images")]) {
    assert.ok(!files(dir).some((name) => name.endsWith(".tmp")), `no temporary file is left in ${dir}`);
  }

  // A linked file at a destination name: an existing target is never overwritten, a missing one never created.
  const linkedSprite = bait("sprite.png");
  symlinkSync(linkedSprite, join(characterSprites, "wink.png"), "file");
  await refused(["assign", ...sprite, "--expression", "wink", "--source", DATA_URL, "--apply"], linkedSprite);
  symlinkSync(join(outside, "created-sprite.png"), join(characterSprites, "nod.png"), "file");
  await refused(
    ["assign", ...sprite, "--expression", "nod", "--source", DATA_URL, "--apply"],
    join(outside, "created-sprite.png"),
  );
  symlinkSync(join(outside, "created-background.png"), join(backgrounds, "night.png"), "file");
  await refused(
    ["assign", "--target", "background", "--name", "night", "--source", DATA_URL, "--apply"],
    join(outside, "created-background.png"),
  );
  rmSync(join(backgrounds, "night.png"));

  // A linked meta.json is neither read nor rewritten, and no background is saved beside it.
  writeFileSync(join(backgrounds, "dusk.png"), PNG);
  const linkedMeta = bait("meta.json", JSON.stringify({ "dusk.png": { tags: [BAIT] } }));
  rmSync(join(backgrounds, "meta.json"));
  symlinkSync(linkedMeta, join(backgrounds, "meta.json"), "file");
  await refused(["list", "backgrounds"], linkedMeta);
  await refused(["assign", "--target", "background", "--name", "noon", "--source", DATA_URL, "--apply"], linkedMeta);
  assert.ok(!existsSync(join(backgrounds, "noon.png")));
  await refused(["delete", "--target", "background", "--filename", "dusk.png", "--apply"], linkedMeta);
  assert.ok(existsSync(join(backgrounds, "dusk.png")));
  rmSync(join(backgrounds, "meta.json"));

  // A linked preview manifest is neither read nor rewritten.
  const linkedManifest = bait(
    "manifest.json",
    JSON.stringify([{ id: "outside-asset", filename: "outside.png", prompt: BAIT }]),
  );
  rmSync(join(previewDir, "manifest.json"));
  symlinkSync(linkedManifest, join(previewDir, "manifest.json"), "file");
  await refused(["list", "assets"], linkedManifest);
  await refused(["get", "outside-asset"], linkedManifest);
  await refused(["delete", "--target", "asset", "--asset", "outside-asset", "--apply"], linkedManifest);
  await refused(["generate", "--prompt", "a lantern"], linkedManifest);
  assert.deepEqual(files(previewDir), ["manifest.json"], "no preview is saved beside a refused manifest");
  rmSync(join(previewDir, "manifest.json"));

  // A dangling link at the manifest or meta.json name is refused before any image is saved beside it.
  symlinkSync(join(outside, "missing-manifest.json"), join(previewDir, "manifest.json"), "file");
  await refused(["generate", "--prompt", "a lantern"], join(outside, "missing-manifest.json"));
  assert.deepEqual(files(previewDir), ["manifest.json"], "no preview is saved beside a dangling manifest");
  rmSync(join(previewDir, "manifest.json"));
  symlinkSync(join(outside, "missing-meta.json"), join(backgrounds, "meta.json"), "file");
  await refused(
    ["assign", "--target", "background", "--name", "noon", "--source", DATA_URL, "--apply"],
    join(outside, "missing-meta.json"),
  );
  assert.ok(!existsSync(join(backgrounds, "noon.png")), "no background is saved beside a dangling meta.json");
  rmSync(join(backgrounds, "meta.json"));

  // A manifest or meta.json linked to another file in its own folder is refused by the read as well as the write, so
  // nothing is saved or deleted before the write would refuse it.
  const kept = (await ok("generate", "--prompt", "a lantern")).output as { asset: { id: string; filename: string } };
  const keptPreview = join(previewDir, kept.asset.filename);
  const siblingManifest = join(previewDir, "manifest-copy.json");
  renameSync(join(previewDir, "manifest.json"), siblingManifest);
  symlinkSync(siblingManifest, join(previewDir, "manifest.json"), "file");
  const previews = files(previewDir);
  for (const args of [
    ["generate", "--prompt", "a lantern"],
    ["edit", "--source", DATA_URL, "--prompt", "a lantern"],
    ["list", "assets"],
    ["delete", "--target", "asset", "--asset", kept.asset.id, "--apply"],
  ]) {
    await refused(args, siblingManifest, keptPreview);
    assert.deepEqual(files(previewDir), previews, `${args[0]}: no preview is saved or deleted beside the link`);
  }
  rmSync(join(previewDir, "manifest.json"));
  renameSync(siblingManifest, join(previewDir, "manifest.json"));
  const siblingMeta = join(backgrounds, "meta-copy.json");
  writeFileSync(siblingMeta, JSON.stringify({ "dusk.png": { tags: ["evening"] } }));
  symlinkSync(siblingMeta, join(backgrounds, "meta.json"), "file");
  const backgroundFiles = files(backgrounds);
  for (const args of [
    ["assign", "--target", "background", "--name", "noon", "--source", DATA_URL, "--apply"],
    ["list", "backgrounds"],
    ["delete", "--target", "background", "--filename", "dusk.png", "--apply"],
  ]) {
    await refused(args, siblingMeta, join(backgrounds, "dusk.png"));
    assert.deepEqual(files(backgrounds), backgroundFiles, `${args[0]}: no background is saved or deleted beside it`);
  }
  rmSync(join(backgrounds, "meta.json"));
  rmSync(siblingMeta);

  // A linked app folder: nothing is written, read or deleted in the folder it points to.
  const outsidePreviews = join(outside, "previews");
  let restore = linkFolder(previewDir, outsidePreviews);
  await refused(["generate", "--prompt", "a lantern"]);
  assert.deepEqual(files(outsidePreviews), []);
  restore();

  const outsideAvatars = join(outside, "avatars");
  restore = linkFolder(avatars, outsideAvatars);
  const characterBait = join(outsideAvatars, "character-bait.png");
  const personaBait = join(outsideAvatars, "persona-bait.png");
  writeFileSync(characterBait, BAIT);
  writeFileSync(personaBait, BAIT);
  await refused([
    "assign",
    "--target",
    "character-avatar",
    "--character",
    character.id,
    "--source",
    DATA_URL,
    "--apply",
  ]);
  await refused(["assign", "--target", "persona-avatar", "--persona", persona.id, "--source", DATA_URL, "--apply"]);
  assert.deepEqual(files(outsideAvatars), ["character-bait.png", "persona-bait.png"]);
  await characters.updateAvatar(character.id, "/api/avatars/file/character-bait.png");
  await characters.updatePersona(persona.id, { avatarPath: "/api/avatars/file/persona-bait.png" });
  await refused(
    ["delete", "--target", "character-avatar", "--character", character.id, "--delete-file", "--apply"],
    characterBait,
  );
  await refused(
    ["delete", "--target", "persona-avatar", "--persona", persona.id, "--delete-file", "--apply"],
    personaBait,
  );
  restore();

  const outsideLorebookImages = join(outside, "lorebook-images");
  restore = linkFolder(join(dataDir, "lorebooks", "images"), outsideLorebookImages);
  await refused(["assign", "--target", "lorebook-image", "--lorebook", lorebook.id, "--source", DATA_URL, "--apply"]);
  assert.deepEqual(files(outsideLorebookImages), []);
  restore();

  const outsideChatGallery = join(outside, "chat-gallery");
  restore = linkFolder(join(dataDir, "gallery", chat.id), outsideChatGallery);
  await refused(["assign", "--target", "chat-gallery", "--chat", chat.id, "--source", DATA_URL, "--apply"]);
  assert.deepEqual(files(outsideChatGallery), []);
  restore();

  const outsideCharacterGallery = join(outside, "character-gallery");
  restore = linkFolder(join(dataDir, "gallery", "characters", character.id), outsideCharacterGallery);
  await refused([
    "assign",
    "--target",
    "character-gallery",
    "--character",
    character.id,
    "--source",
    DATA_URL,
    "--apply",
  ]);
  assert.deepEqual(files(outsideCharacterGallery), []);
  restore();

  // A gallery delete never removes a file through a linked gallery folder, whatever file name the row was given.
  const patchFilePath = async (table: string, id: string, filePath: string) => {
    const result = await mari.executeCli({
      argv: ["db", "patch", table, id, "--json", JSON.stringify({ filePath }), "--apply"],
      sessionId: "app-folder-writes",
    });
    assert.equal(result.ok, true, JSON.stringify(result));
  };
  await patchFilePath("chat_images", chatImageId, `${chat.id}/precious.docx`);
  const outsideChatDelete = join(outside, "chat-gallery-delete");
  restore = linkFolder(join(dataDir, "gallery", chat.id), outsideChatDelete);
  const chatPrecious = join(outsideChatDelete, "precious.docx");
  writeFileSync(chatPrecious, BAIT);
  await refused(
    ["delete", "--target", "chat-gallery", "--chat", chat.id, "--image", chatImageId, "--apply"],
    chatPrecious,
  );
  restore();
  await patchFilePath("character_images", characterImageId, `characters/${character.id}/precious.docx`);
  const outsideCharacterDelete = join(outside, "character-gallery-delete");
  restore = linkFolder(join(dataDir, "gallery", "characters", character.id), outsideCharacterDelete);
  const characterPrecious = join(outsideCharacterDelete, "precious.docx");
  writeFileSync(characterPrecious, BAIT);
  await refused(
    ["delete", "--target", "character-gallery", "--character", character.id, "--image", characterImageId, "--apply"],
    characterPrecious,
  );
  // The shared cleanup behind these deletes and the gallery UI's own: an unreferenced name in a linked folder stays.
  const unreferenced = join(outsideCharacterDelete, "unreferenced.docx");
  writeFileSync(unreferenced, BAIT);
  assert.equal(
    await unlinkGalleryFileIfUnreferenced({ db, filePath: `characters/${character.id}/unreferenced.docx` }),
    false,
  );
  assert.ok(existsSync(unreferenced), "the shared cleanup never deletes through a linked folder");
  restore();

  // A chat or character ID is one gallery folder name, so an ID with `..` writes nothing anywhere.
  const cli = async (...argv: string[]) => {
    const result = await mari.executeCli({ argv, sessionId: "app-folder-writes" });
    assert.equal(result.ok, true, JSON.stringify(result));
  };
  await cli("characters", "create", "--id", "../../../outside-character", "--name", "Traversal", "--apply");
  await refused([
    "assign",
    "--target",
    "character-gallery",
    "--character",
    "../../../outside-character",
    "--source",
    DATA_URL,
    "--apply",
  ]);
  assert.ok(!existsSync(join(root, "outside-character")), "a character ID never names a folder outside the gallery");
  await cli(
    "db",
    "insert",
    "chats",
    "--json",
    JSON.stringify({
      id: "../../outside-chat",
      name: "Traversal chat",
      mode: "roleplay",
      characterIds: [],
      metadata: "{}",
      sortOrder: 0,
    }),
    "--apply",
  );
  await refused([
    "assign",
    "--target",
    "chat-gallery",
    "--chat",
    "../../outside-chat",
    "--source",
    DATA_URL,
    "--apply",
  ]);
  assert.ok(!existsSync(join(root, "outside-chat")), "a chat ID never names a folder outside the gallery");

  const outsideBackgrounds = join(outside, "backgrounds");
  restore = linkFolder(backgrounds, outsideBackgrounds);
  const backgroundBait = join(outsideBackgrounds, "bait.png");
  writeFileSync(backgroundBait, BAIT);
  await refused(["assign", "--target", "background", "--name", "dusk", "--source", DATA_URL, "--apply"]);
  await refused(["list", "backgrounds"]);
  await refused(["delete", "--target", "background", "--filename", "bait.png", "--apply"], backgroundBait);
  assert.deepEqual(files(outsideBackgrounds), ["bait.png"]);
  restore();

  // The sprites folder linked out of the data dir, and an owner's sprite folder that is itself a link.
  const outsideSprites = join(outside, "sprites");
  mkdirSync(join(outsideSprites, character.id), { recursive: true });
  const spriteBait = join(outsideSprites, character.id, "grin.png");
  writeFileSync(spriteBait, PNG);
  restore = linkFolder(sprites, outsideSprites);
  await refused(["assign", ...sprite, "--expression", "laugh", "--source", DATA_URL, "--apply"]);
  await refused(["list", "sprites", "--character", character.id]);
  await refused(["delete", ...sprite, "--expression", "grin", "--apply"], spriteBait);
  assert.deepEqual(files(join(outsideSprites, character.id)), ["grin.png"], "no sprite or catalog is written there");
  restore();
  const outsideOwner = join(outside, "owner-sprites");
  restore = linkFolder(characterSprites, outsideOwner);
  const ownerResult = await images("assign", ...sprite, "--expression", "laugh", "--source", DATA_URL, "--apply");
  assert.equal(ownerResult.ok, false, ownerResult.text);
  assert.deepEqual(files(outsideOwner), []);
  restore();

  // With every link gone, the same folders take writes again.
  await ok("assign", "--target", "background", "--name", "dusk", "--source", DATA_URL, "--apply");
  await ok("assign", ...sprite, "--expression", "laugh", "--source", DATA_URL, "--apply");
  assert.deepEqual(readFileSync(join(characterSprites, "laugh.png")), PNG);
  console.log("mari images app-folder write regression passed.");
} finally {
  await db._fileStore.close();
  imageServer.close();
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(root, { recursive: true, force: true });
}
