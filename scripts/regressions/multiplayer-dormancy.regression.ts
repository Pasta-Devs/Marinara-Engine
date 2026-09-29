import assert from "node:assert/strict";
import type { DB } from "../../packages/server/src/db/connection.js";

process.env.LOG_LEVEL = "silent";
const { MultiplayerService } = await import("../../packages/server/src/services/multiplayer/service.js");
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");

const unexpectedWork = () => {
  throw new Error("Disabled multiplayer must not access storage, TLS or generation");
};
const unavailable = new MultiplayerService({
  db: new Proxy({} as DB, { get: unexpectedWork }),
  available: false,
  tls: unexpectedWork,
  abortGeneration: unexpectedWork,
});
await unavailable.initialize();
for (let attempt = 0; attempt < 10; attempt++) {
  assert.equal(unavailable.status().enabled, false);
  assert.equal(unavailable.status().tlsAvailable, false);
  assert.equal(await unavailable.autonomousEnabled("saved_room"), false);
}
await assert.rejects(unavailable.prepare({ mode: "conversation", name: "Disabled" }), /disabled/);
await assert.rejects(unavailable.settings(true), /disabled/);
await unavailable.close();

const db = await createFileNativeDB();
const settings = createAppSettingsStorage(db);
const chats = createChatsStorage(db);
let reads = 0;
let tlsReads = 0;
const countedDb = new Proxy(db, {
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);
    if (property === "select") {
      return (...args: unknown[]) => {
        reads++;
        return Reflect.apply(value, target, args);
      };
    }
    return typeof value === "function" ? value.bind(target) : value;
  },
});
const dormant = new MultiplayerService({
  db: countedDb,
  available: true,
  tls: () => {
    tlsReads++;
    return null;
  },
  abortGeneration: unexpectedWork,
});
try {
  await settings.set("multiplayer", "false");
  const chat = await chats.create({ mode: "game", name: "Saved room", characterIds: [] });
  assert.ok(chat);
  const savedRoom = { role: "host", status: "active", generation: "running", round: { phase: "resolving" } };
  await chats.patchMetadata(chat.id, { multiplayer: savedRoom });
  await dormant.initialize();
  assert.equal(reads, 1, "only the activation setting is read; disabled startup does not scan chats");
  for (let attempt = 0; attempt < 10; attempt++) {
    assert.equal(dormant.status().enabled, false);
    assert.equal(dormant.status().tlsAvailable, false);
    assert.equal(await dormant.autonomousEnabled(chat.id), false);
  }
  await assert.rejects(dormant.guestState(), /disabled/);
  await assert.rejects(dormant.hostState(), /disabled/);
  assert.equal(reads, 1, "disabled status and autonomy checks do not perform storage work");
  assert.equal(tlsReads, 0, "Settings disabled means no certificate availability checks");
  const metadata = () => {
    return chats.getById(chat.id).then((row) => {
      const value = row!.metadata;
      return (typeof value === "string" ? JSON.parse(value) : value).multiplayer;
    });
  };
  assert.deepEqual(await metadata(), savedRoom, "disabled startup leaves saved chats untouched");
  const enabled = await dormant.settings(true);
  assert.equal(enabled.enabled, true);
  assert.equal(enabled.hosting, false);
  assert.equal(enabled.joined, false);
  assert.equal((await metadata()).status, "ended", "explicit activation clears stale sessions without restoring them");
  assert.equal((await metadata()).round.phase, "interrupted");
  await dormant.settings(false);
  const readsAfterDisable = reads;
  const tlsAfterDisable = tlsReads;
  dormant.status();
  assert.equal(await dormant.autonomousEnabled(chat.id), false);
  assert.equal(reads, readsAfterDisable);
  assert.equal(tlsReads, tlsAfterDisable);

  // Hold the real chat-list read while a newer disable supersedes an enable.
  let releaseList!: () => void;
  let enteredList!: () => void;
  const heldList = new Promise<void>((resolve) => (releaseList = resolve));
  const listStarted = new Promise<void>((resolve) => (enteredList = resolve));
  const delayedDb = new Proxy(db, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (property !== "select") return typeof value === "function" ? value.bind(target) : value;
      return (...args: unknown[]) => {
        const select = Reflect.apply(value, target, args);
        return new Proxy(select, {
          get(selectTarget, selectKey) {
            if (selectKey !== "from") return Reflect.get(selectTarget, selectKey);
            return (...fromArgs: unknown[]) => {
              const query = Reflect.apply(selectTarget.from, selectTarget, fromArgs);
              return new Proxy(query, {
                get(queryTarget, queryKey) {
                  const method = Reflect.get(queryTarget, queryKey);
                  if (queryKey !== "orderBy") return typeof method === "function" ? method.bind(queryTarget) : method;
                  return async (...orderArgs: unknown[]) => {
                    enteredList();
                    await heldList;
                    return Reflect.apply(method, queryTarget, orderArgs);
                  };
                },
              });
            };
          },
        });
      };
    },
  });
  const raced = new MultiplayerService({
    db: delayedDb,
    available: true,
    tls: unexpectedWork,
    abortGeneration: unexpectedWork,
  });
  await chats.patchMetadata(chat.id, { multiplayer: savedRoom });
  await raced.initialize();
  const enabling = raced.settings(true);
  await listStarted;
  const deniedHost = assert.rejects(
    raced.startHost({
      chatId: chat.id,
      publicOrigin: "https://localhost:9443",
      password: "fixture-password",
      displayName: "Host",
      persona: { name: "Host", description: "Reviewed persona" },
    }),
    /disabled/,
  );
  const disabling = raced.settings(false);
  releaseList();
  assert.equal((await enabling).enabled, false, "a superseded enable never reopens the gate");
  await deniedHost;
  await disabling;
  assert.equal(await settings.get("multiplayer"), "false");
  assert.deepEqual(await metadata(), savedRoom, "superseded cleanup stops before updating saved rooms");
  await raced.close();
} finally {
  await dormant.close();
  await db._fileStore.close();
}
console.info("Multiplayer dormancy: disabled gates perform no session scans, TLS checks, or autonomous work.");
