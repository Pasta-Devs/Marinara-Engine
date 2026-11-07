// GET /game-assets/local-music-file plays a track the Music DJ picked from a folder on this device. It serves a file
// only from a folder the Music DJ plays from: the default folder, a character's or a chat's (#8901). Any other audio
// file on the device, one named through `..`, and one reached through a link inside a folder that leads out answer
// like a missing file (#8915). A configured folder that is itself a link still plays.
//
// Driven through the real app, like music-dj-folder-access.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { listMusicDjFolders } from "../../packages/shared/dist/index.js";

const root = mkdtempSync(join(tmpdir(), "marinara-local-music-file-"));
const previous = {
  DATA_DIR: process.env.DATA_DIR,
  FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR,
  MARINARA_FILE_STORAGE_DIR: process.env.MARINARA_FILE_STORAGE_DIR,
  NODE_ENV: process.env.NODE_ENV,
  MARINARA_LITE: process.env.MARINARA_LITE,
  LOG_LEVEL: process.env.LOG_LEVEL,
  ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK: process.env.ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK,
  ADMIN_SECRET: process.env.ADMIN_SECRET,
};

let app: {
  close(): Promise<void>;
  ready(): Promise<unknown>;
  inject(options: Record<string, unknown>): Promise<{ statusCode: number; body: string }>;
} | null = null;

try {
  // ── The folders a Music DJ setup lists, under the current and the older setting names ──
  assert.deepEqual(
    listMusicDjFolders(
      { customMusicExternalFolder: " /music/default ", customMusicCharacterFolders: { a: "/music/a" } },
      [
        JSON.stringify({ customMusicExternalFolder: "/music/chat" }),
        JSON.stringify({ other: "/music/not-a-folder" }),
        { customMusicExternalFolder: "/music/default" },
        { customMusicExternalFolder: null },
        "not json",
      ],
    ),
    ["/music/default", "/music/a", "/music/chat"],
  );
  assert.deepEqual(listMusicDjFolders(JSON.stringify({ localMusicExternalFolder: "/music/old" }), []), ["/music/old"]);
  assert.deepEqual(listMusicDjFolders(null, []), [], "no Music DJ and no chat folder lists nothing");

  // ── A device with three Music DJ folders and other audio around them ──
  const music = join(root, "music");
  const outside = join(root, "outside");
  const files: Record<string, string> = {
    [join(music, "default", "track.mp3")]: "default track",
    [join(music, "default", "calm", "deep.ogg")]: "nested track",
    [join(music, "character-real", "theme.mp3")]: "character theme",
    [join(music, "chat", "chat.mp3")]: "chat track",
    [join(music, "default-evil", "evil.mp3")]: "a sibling folder whose name starts like the default",
    [join(outside, "secret.mp3")]: "outside the Music DJ folders",
  };
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  // The character's folder is configured through a link, as a folder on another disk might be.
  symlinkSync(join(music, "character-real"), join(music, "character-link"), "dir");
  // Links inside a configured folder that lead out of it.
  symlinkSync(join(outside, "secret.mp3"), join(music, "default", "linked.mp3"));
  symlinkSync(outside, join(music, "default", "linked-dir"), "dir");
  // A link named like a track, inside the folder, that points at a file that is not audio (review, #8915).
  writeFileSync(join(music, "default", "notes.txt"), "not audio");
  symlinkSync(join(music, "default", "notes.txt"), join(music, "default", "disguised.mp3"));

  const dataDir = join(root, "data");
  const fileStorageDir = join(dataDir, "file-storage");
  process.env.DATA_DIR = dataDir;
  process.env.FILE_STORAGE_DIR = fileStorageDir;
  process.env.MARINARA_FILE_STORAGE_DIR = fileStorageDir;
  process.env.NODE_ENV = "test";
  process.env.MARINARA_LITE = "true";
  process.env.LOG_LEVEL = "silent";
  process.env.ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK = "true";
  delete process.env.ADMIN_SECRET;

  const [{ buildApp }, { getDB }, { createAgentsStorage }] = await Promise.all([
    import("../../packages/server/src/app.js"),
    import("../../packages/server/src/db/connection.js"),
    import("../../packages/server/src/services/storage/agents.storage.js"),
  ]);
  app = await buildApp();
  await app.ready();

  const send = (method: string, url: string, payload?: unknown) =>
    app!.inject({
      method,
      url,
      headers: { host: "127.0.0.1:7860", "content-type": "application/json" },
      ...(payload === undefined ? {} : { payload }),
    });
  const play = (path: string) =>
    send("GET", `/api/game-assets/local-music-file?path=${Buffer.from(path, "utf8").toString("base64url")}`);
  const assertServed = async (path: string, content: string, what: string) => {
    const response = await play(path);
    assert.equal(response.statusCode, 200, `${what}: ${response.body}`);
    assert.equal(response.body, content, what);
  };
  const assertRefused = async (path: string, what: string) => {
    const response = await play(path);
    assert.equal(response.statusCode, 404, `${what}: ${response.body}`);
    assert.deepEqual(
      JSON.parse(response.body),
      { error: "Music file not found" },
      `${what} answers like a missing file`,
    );
  };

  await createAgentsStorage(await getDB()).create({
    type: "spotify",
    name: "Music DJ",
    description: "seeded for this regression",
    phase: "post_processing",
    connectionId: null,
    imagePath: null,
    promptTemplate: "",
    settings: {
      musicProvider: "custom",
      customMusicSource: "folder",
      customMusicExternalFolder: join(music, "default"),
      customMusicCharacterFolders: { nazuna: join(music, "character-link") },
    },
  } as never);
  const created = await send("POST", "/api/chats", { name: "Music folder chat", mode: "roleplay", characterIds: [] });
  assert.equal(created.statusCode, 200, created.body);
  const chatId = JSON.parse(created.body).id as string;
  const setChatFolder = async (folder: string) => {
    const response = await send("PATCH", `/api/chats/${chatId}/metadata`, { customMusicExternalFolder: folder });
    assert.equal(response.statusCode, 200, response.body);
  };
  await setChatFolder(join(music, "chat"));

  // ── Tracks in the configured folders still play ──
  await assertServed(join(music, "default", "track.mp3"), "default track", "a track in the default folder");
  await assertServed(join(music, "default", "calm", "deep.ogg"), "nested track", "a track in a subfolder");
  await assertServed(join(music, "character-link", "theme.mp3"), "character theme", "a track in a linked folder");
  await assertServed(join(music, "character-real", "theme.mp3"), "character theme", "the same track by its real path");
  await assertServed(join(music, "chat", "chat.mp3"), "chat track", "a track in a chat's folder");

  // ── Everything else on the device is refused ──
  await assertRefused(join(outside, "secret.mp3"), "an audio file outside every Music DJ folder");
  await assertRefused(`${join(music, "default")}/../../outside/secret.mp3`, "a path that climbs out with ..");
  await assertRefused(join(music, "default", "linked.mp3"), "a file link that leads out of the folder");
  await assertRefused(join(music, "default", "linked-dir", "secret.mp3"), "a folder link that leads out");
  await assertRefused(join(music, "default-evil", "evil.mp3"), "a sibling folder that shares the name's start");
  await assertRefused(join(music, "default", "missing.mp3"), "a missing file");
  await assertRefused(join(music, "default", "disguised.mp3"), "a track-named link to a file that is not audio");

  // ── A folder stops counting once it is no longer configured ──
  await setChatFolder("");
  await assertRefused(join(music, "chat", "chat.mp3"), "a track in a cleared chat folder");

  console.info("Local music file security regression passed");
} finally {
  await app?.close().catch(() => {});
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(root, { recursive: true, force: true });
}
