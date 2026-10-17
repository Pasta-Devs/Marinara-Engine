// #7742 regression: a game checkpoint saves the game's own chat-metadata keys (party cards, NPCs,
// journal, inventory, …) and loading it puts them back. Before, a checkpoint captured only the turn
// snapshot, the spatial snapshot and the engine state, so a load rewound the scene while the party,
// the NPCs and the items stayed as they were after the save.
//
// Three parts:
//   1) The pure helpers: only allow-listed keys are captured; a load restores what was captured,
//      clears what was added later, moves the party sheet revision forward and drops the
//      inventory's turn record.
//   2) End-to-end: create → change metadata → POST /game/checkpoint/load → keys are back, settings
//      and keys outside the allow-list are untouched.
//   2b) The chat's characterIds column (the party's library members) is rewound with the metadata,
//      so a member recruited after the save does not come back at the next session start. 2d: also
//      when the save had no gamePartyCharacterIds yet.
//   3) A checkpoint from before the field (gameMetadataData null) loads as it always did.
import assert from "node:assert/strict";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { gameRoutes } from "../../packages/server/src/routes/game.routes.js";
import { createChatsStorage } from "../../packages/server/src/services/storage/chats.storage.js";
import { createGameStateStorage } from "../../packages/server/src/services/storage/game-state.storage.js";
import {
  buildCheckpointGameMetadataRestore,
  captureCheckpointGameMetadata,
  CHECKPOINT_GAME_METADATA_KEYS,
  createCheckpointService,
} from "../../packages/server/src/services/game/checkpoint.service.js";
import { readMetadata } from "../../packages/server/src/services/game/game-inventory.service.js";
import { gameCheckpoints } from "../../packages/server/src/db/schema/index.js";
import { eq } from "../../packages/server/src/db/file-query.js";

// ── Part 1: pure helpers ──
{
  const metadata = {
    gameNpcs: [{ id: "n1", name: "Old Wick", reputation: 10 }],
    gameInventory: [{ name: "Rope", quantity: 1 }],
    gameSystemPrompt: "a setting, never rewound",
    gameId: "g1",
  };
  const captured = captureCheckpointGameMetadata(metadata);
  assert.deepEqual(
    captured,
    { gameNpcs: metadata.gameNpcs, gameInventory: metadata.gameInventory },
    "only allow-listed keys are captured",
  );
  assert.notEqual(captured!.gameNpcs, metadata.gameNpcs, "the capture is a copy, not a live reference");
  assert.equal(captureCheckpointGameMetadata({ gameSystemPrompt: "x" }), null, "nothing to capture is null");

  const current = {
    gameNpcs: [
      { id: "n1", name: "Old Wick", reputation: -40 },
      { id: "n2", name: "Mira" },
    ],
    gameInventory: [],
    gameInventoryTurn: { messageId: "m9", before: [], swipes: {} },
    gameJournal: { entries: ["added after the save"] },
    gamePartySheet: { hp: 3 },
    gamePartySheetRevision: 4,
  };
  const patch = buildCheckpointGameMetadataRestore(captured!, current);
  assert.deepEqual(patch.gameNpcs, metadata.gameNpcs, "a captured key is restored");
  assert.deepEqual(patch.gameInventory, metadata.gameInventory);
  assert.equal(patch.gameJournal, null, "a key added after the save is cleared");
  assert.equal(patch.gamePartySheet, null);
  assert.equal(patch.gamePartySheetRevision, 5, "the party sheet revision moves forward, never back");
  assert.equal(patch.gameInventoryTurn, null, "the turn record of replaced stacks is dropped");
  assert.equal(Object.hasOwn(patch, "gameMorale"), false, "a key absent then and now is left alone");
  for (const key of Object.keys(patch)) {
    assert.ok(
      (CHECKPOINT_GAME_METADATA_KEYS as readonly string[]).includes(key) ||
        key === "gamePartySheetRevision" ||
        key === "gameInventoryTurn",
      `the restore only writes allow-listed keys and their companions (${key})`,
    );
  }
}

// ── Parts 2 and 3: end-to-end through the routes ──
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const db = await getDB();
const chats = createChatsStorage(db);
const stateStore = createGameStateStorage(db);
const checkpointSvc = createCheckpointService(db);
const createdChatIds: string[] = [];

const app = Fastify();
app.decorate("db", db);
await app.register(gameRoutes, { prefix: "/api/game" });

async function seedGameChat(name: string, metadata: Record<string, unknown>) {
  const chat = await chats.create({ name, mode: "game", characterIds: [] });
  assert.ok(chat);
  createdChatIds.push(chat.id);
  await chats.patchMetadata(chat.id, metadata);
  const message = await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    characterId: null,
    content: "turn 1",
  } as Parameters<typeof chats.createMessage>[0]);
  assert.ok(message);
  await stateStore.create({
    chatId: chat.id,
    messageId: message.id,
    swipeIndex: 0,
    date: "",
    time: "",
    location: "",
    weather: "",
    temperature: "",
    worldCustomFields: [],
    presentCharacters: [],
    recentEvents: [],
    playerStats: null,
    personaStats: null,
    fieldLocks: {},
    hiddenTrackerFields: [],
    committed: true,
  } as Parameters<typeof stateStore.create>[0]);
  const snapshot = await stateStore.getLatest(chat.id);
  assert.ok(snapshot);
  return { chatId: chat.id, snapshot };
}

const createCheckpoint = (chatId: string, snapshot: { id: string; messageId: string }) =>
  checkpointSvc.create({
    chatId,
    snapshotId: snapshot.id,
    spatialSnapshotId: null,
    messageId: snapshot.messageId,
    label: "before the quarry",
    triggerType: "manual",
  });

const loadCheckpoint = async (chatId: string, checkpointId: string) => {
  const res = await app.inject({
    method: "POST",
    url: "/api/game/checkpoint/load",
    payload: { chatId, checkpointId },
  });
  assert.equal(res.statusCode, 200, `checkpoint load should succeed: ${res.statusCode} ${res.body}`);
};

const metadataOf = async (chatId: string) => readMetadata((await chats.getById(chatId))!.metadata);

try {
  // ── Part 2: create → change → load rewinds the game's metadata ──
  {
    const atSave = {
      gameCharacterCards: [{ name: "Luna", hp: 12 }],
      gameNpcs: [{ id: "n1", name: "Old Wick", reputation: 10 }],
      gameInventory: [{ name: "Rope", quantity: 1 }],
      gameMorale: 50,
      gameSystemPrompt: "keep this",
    };
    const { chatId, snapshot } = await seedGameChat("checkpoint metadata restore", atSave);
    const checkpointId = await createCheckpoint(chatId, snapshot);

    await chats.patchMetadata(chatId, {
      gameCharacterCards: [{ name: "Luna", hp: 2 }],
      gameNpcs: [...atSave.gameNpcs, { id: "n2", name: "Mira" }],
      gameInventory: [
        { name: "Rope", quantity: 1 },
        { name: "Iron bar", quantity: 1 },
      ],
      gameJournal: { entries: ["met Mira"] },
      gameMorale: 10,
      gameSystemPrompt: "changed after the save",
    });

    await loadCheckpoint(chatId, checkpointId);
    const after = await metadataOf(chatId);
    assert.deepEqual(after.gameCharacterCards, atSave.gameCharacterCards, "party cards are rewound");
    assert.deepEqual(after.gameNpcs, atSave.gameNpcs, "an NPC met after the save is gone again");
    assert.deepEqual(after.gameInventory, atSave.gameInventory, "the inventory is rewound");
    assert.equal(after.gameMorale, 50);
    assert.equal(after.gameJournal, null, "a journal started after the save is cleared");
    assert.equal(after.gameSystemPrompt, "changed after the save", "settings are never rewound");
  }

  // ── Part 2b: the characterIds mirror of the party is rewound too ──
  {
    const { chatId, snapshot } = await seedGameChat("checkpoint party mirror", {
      gamePartyCharacterIds: ["char-luna", "npc:old-wick"],
    });
    await chats.patchMetadataWithCharacterIds(chatId, () => ({ metadata: {}, characterIds: ["char-luna"] }));
    const checkpointId = await createCheckpoint(chatId, snapshot);

    await chats.patchMetadataWithCharacterIds(chatId, () => ({
      metadata: { gamePartyCharacterIds: ["char-luna", "char-mira", "npc:old-wick"] },
      characterIds: ["char-luna", "char-mira"],
    }));

    await loadCheckpoint(chatId, checkpointId);
    const chat = await chats.getById(chatId);
    assert.deepEqual((await metadataOf(chatId)).gamePartyCharacterIds, ["char-luna", "npc:old-wick"]);
    assert.deepEqual(
      JSON.parse(chat!.characterIds as unknown as string),
      ["char-luna"],
      "a member recruited after the save leaves the chat's characters too",
    );
  }

  // ── Part 2c: a checkpoint taken before the game had any of the keys still clears them ──
  {
    const { chatId, snapshot } = await seedGameChat("checkpoint empty capture", { gameSystemPrompt: "keep" });
    const checkpointId = await createCheckpoint(chatId, snapshot);
    const [row] = await db.select().from(gameCheckpoints).where(eq(gameCheckpoints.id, checkpointId));
    assert.equal(row?.gameMetadataData, "{}", "an empty capture is stored as {}, not as a legacy null");
    await chats.patchMetadata(chatId, { gameJournal: { entries: ["after the save"] } });

    await loadCheckpoint(chatId, checkpointId);
    assert.equal((await metadataOf(chatId)).gameJournal, null, "a key added after an empty capture is cleared");
  }

  // ── Part 2d: a save without gamePartyCharacterIds still rewinds characterIds ──
  {
    const { chatId, snapshot } = await seedGameChat("checkpoint party column only", { gameMorale: 50 });
    await chats.patchMetadataWithCharacterIds(chatId, () => ({ metadata: {}, characterIds: ["char-luna"] }));
    const checkpointId = await createCheckpoint(chatId, snapshot);

    await chats.patchMetadataWithCharacterIds(chatId, () => ({
      metadata: { gamePartyCharacterIds: ["char-luna", "char-mira"] },
      characterIds: ["char-luna", "char-mira"],
    }));

    await loadCheckpoint(chatId, checkpointId);
    const chat = await chats.getById(chatId);
    assert.equal((await metadataOf(chatId)).gamePartyCharacterIds, null, "the later party list is cleared");
    assert.deepEqual(
      JSON.parse(chat!.characterIds as unknown as string),
      ["char-luna"],
      "the chat's characters go back to the save, even with no party list in it",
    );
  }

  // ── Part 3: a checkpoint from before the field loads as it did ──
  {
    const { chatId, snapshot } = await seedGameChat("legacy checkpoint", { gameMorale: 50 });
    const checkpointId = await createCheckpoint(chatId, snapshot);
    await db.update(gameCheckpoints).set({ gameMetadataData: null }).where(eq(gameCheckpoints.id, checkpointId));
    await chats.patchMetadata(chatId, { gameMorale: 10 });

    await loadCheckpoint(chatId, checkpointId);
    assert.equal((await metadataOf(chatId)).gameMorale, 10, "an old checkpoint leaves the metadata alone");
  }

  console.log("Game checkpoint metadata regression checks passed.");
} finally {
  for (const id of createdChatIds) await chats.remove(id).catch(() => {});
  await app.close();
  await closeDB();
}
