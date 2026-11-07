// Music DJ folders per character and per chat (#8901): saving a typed folder path needs the same access as the
// folder picker, because the Music DJ lists the files in that folder and the app plays them. Keeping a saved
// folder, clearing one, and every other settings change stay open, so a browser on another device can still use
// Chat Settings and the Music DJ editor. The device paths never travel in exports or settings profiles.
//
// Driven through the real app, like beholder-state-reachable. The app-wide login hook is satisfied by allowing
// private-network access, so what is measured is each route's own gate.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CHAT_METADATA_LOCAL_DESTINATION_KEYS,
  CHAT_PRESET_EXCLUDED_METADATA_KEYS,
} from "../../packages/shared/dist/index.js";
import { sanitizeAgentSettingsForTransfer } from "../../packages/client/src/lib/agent-transfer.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-music-dj-folder-access-"));
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

/** Another machine on the LAN: no loopback and no admin secret. */
const REMOTE = "192.168.1.50";

let app: {
  close(): Promise<void>;
  ready(): Promise<unknown>;
  inject(options: Record<string, unknown>): Promise<{ statusCode: number; body: string }>;
} | null = null;

try {
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

  const send = (method: string, url: string, payload?: unknown, remoteAddress?: string) =>
    app!.inject({
      method,
      url,
      ...(remoteAddress ? { remoteAddress } : {}),
      headers: { host: "127.0.0.1:7860", "content-type": "application/json" },
      ...(payload === undefined ? {} : { payload }),
    });
  const denied = await send("POST", "/api/game-assets/pick-local-music-folder", {}, REMOTE);
  assert.equal(denied.statusCode, 403, `the picker itself is gated: ${denied.body}`);
  const assertDenied = (response: { statusCode: number; body: string }, what: string) => {
    assert.equal(response.statusCode, denied.statusCode, `${what}: ${response.body}`);
    assert.equal(response.body, denied.body, `${what} answers with the folder picker's error`);
  };

  const agents = createAgentsStorage(await getDB());
  const stored = {
    musicProvider: "custom",
    customMusicSource: "folder",
    customMusicExternalFolder: "/music/default",
    customMusicCharacterFolders: { nazuna: "/music/nazuna" },
    contextSize: 5,
  };
  const config = await agents.create({
    type: "spotify",
    name: "Music DJ",
    description: "seeded for this regression",
    phase: "post_processing",
    connectionId: null,
    imagePath: null,
    promptTemplate: "",
    settings: stored,
  } as never);
  assert.ok(config?.id);
  const savedSettings = async () => JSON.parse(String((await agents.getById(config!.id))?.settings ?? "{}"));

  // ── Agent settings: a new default or character folder is refused from another machine ──
  assertDenied(
    await send(
      "PATCH",
      `/api/agents/${config!.id}`,
      { settings: { ...stored, customMusicExternalFolder: "/etc" } },
      REMOTE,
    ),
    "a new default folder",
  );
  assertDenied(
    await send(
      "PATCH",
      `/api/agents/${config!.id}`,
      { settings: { ...stored, customMusicCharacterFolders: { nazuna: "/music/nazuna", keyleth: "/home" } } },
      REMOTE,
    ),
    "a new character folder",
  );
  assertDenied(
    await send(
      "PATCH",
      `/api/agents/${config!.id}`,
      { settings: { ...stored, localMusicExternalFolder: "/etc", customMusicExternalFolder: undefined } },
      REMOTE,
    ),
    "a new folder under the older setting name",
  );
  assertDenied(
    await send(
      "PATCH",
      "/api/agents/type/spotify",
      { settings: { ...stored, customMusicExternalFolder: "/etc" } },
      REMOTE,
    ),
    "a new folder through the agent type route",
  );
  assertDenied(
    await send(
      "POST",
      "/api/agents",
      { type: "spotify", name: "Music DJ", phase: "post_processing", settings: { customMusicExternalFolder: "/etc" } },
      REMOTE,
    ),
    "a new folder in a created agent",
  );
  assert.deepEqual(await savedSettings(), stored, "refused changes save nothing");

  // ── Keeping or clearing folders, and other settings, stay open ──
  const unchanged = await send(
    "PATCH",
    `/api/agents/${config!.id}`,
    { settings: { ...stored, contextSize: 9 } },
    REMOTE,
  );
  assert.equal(unchanged.statusCode, 200, unchanged.body);
  assert.equal((await savedSettings()).contextSize, 9, "a save that keeps the folders goes through");
  const cleared = await send(
    "PATCH",
    `/api/agents/${config!.id}`,
    { settings: { ...stored, customMusicExternalFolder: "", customMusicCharacterFolders: {} } },
    REMOTE,
  );
  assert.equal(cleared.statusCode, 200, `unlinking and clearing are not new paths: ${cleared.body}`);
  const local = await send("PATCH", `/api/agents/${config!.id}`, {
    settings: { ...stored, customMusicExternalFolder: "/music/new" },
  });
  assert.equal(local.statusCode, 200, `this computer may save a typed path: ${local.body}`);
  assert.equal((await savedSettings()).customMusicExternalFolder, "/music/new");

  // ── This chat's folder: the same gate on the chat metadata route ──
  const created = await send("POST", "/api/chats", { name: "Music folder chat", mode: "roleplay", characterIds: [] });
  assert.equal(created.statusCode, 200, created.body);
  const chatId = JSON.parse(created.body).id as string;
  const chatFolder = async () => {
    const chat = JSON.parse((await send("GET", `/api/chats/${chatId}`)).body) as { metadata: unknown };
    const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata;
    return (metadata as Record<string, unknown>).customMusicExternalFolder;
  };
  assertDenied(
    await send("PATCH", `/api/chats/${chatId}/metadata`, { customMusicExternalFolder: "/etc" }, REMOTE),
    "a new chat folder",
  );
  assert.equal(await chatFolder(), undefined, "a refused chat folder is not saved");
  const chatLocal = await send("PATCH", `/api/chats/${chatId}/metadata`, {
    customMusicExternalFolder: " /music/chat ",
  });
  assert.equal(chatLocal.statusCode, 200, chatLocal.body);
  assert.equal(await chatFolder(), "/music/chat", "a chat folder is saved trimmed");
  const chatSame = await send(
    "PATCH",
    `/api/chats/${chatId}/metadata`,
    { customMusicExternalFolder: "/music/chat" },
    REMOTE,
  );
  assert.equal(chatSame.statusCode, 200, `re-sending the saved chat folder is not a new path: ${chatSame.body}`);
  const chatCleared = await send("PATCH", `/api/chats/${chatId}/metadata`, { customMusicExternalFolder: "" }, REMOTE);
  assert.equal(chatCleared.statusCode, 200, `Use default is allowed from anywhere: ${chatCleared.body}`);
  assert.equal(await chatFolder(), null, "clearing stores null, which follows the character and then the default");

  // ── The paths stay on this install ──
  assert.ok(CHAT_PRESET_EXCLUDED_METADATA_KEYS.includes("customMusicExternalFolder"), "settings profiles skip it");
  assert.ok(CHAT_METADATA_LOCAL_DESTINATION_KEYS.includes("customMusicExternalFolder"), "chat exports drop it");
  const exported = sanitizeAgentSettingsForTransfer(stored);
  assert.equal(exported.customMusicExternalFolder, undefined, "agent exports drop the default folder");
  assert.equal(exported.customMusicCharacterFolders, undefined, "agent exports drop the character folders");
  assert.equal(exported.customMusicSource, "folder", "the rest of the Music DJ settings still travel");

  console.info("Music DJ folder access regression passed");
} finally {
  await app?.close().catch(() => {});
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
