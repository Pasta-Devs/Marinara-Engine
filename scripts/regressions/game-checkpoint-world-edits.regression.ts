/**
 * #7783 regression: a game checkpoint saves the world's hand-edits layer (gameWorld.edits) and a load
 * puts it back, through the same checks and snapshot re-save as PUT /world/edits.
 *
 * Before, a checkpoint captured the game's metadata keys but not the layer inside gameWorld, so a load
 * rewound the tracker and the story while leaving newer hand edits in place. When those edits took away
 * something the restored story names, the story read as null and the game spent the rest of the
 * campaign with no story at all — silently, since the load itself reported success.
 *
 * Three parts:
 *   1) The pure helpers: the layer is captured by value; `{ edits: null }` means a world without one
 *      (a load clears later edits) and no capture means a chat with no world (a load leaves it alone);
 *      a restore is checked against the world, its towns and the story restored with it.
 *   2) End-to-end: save → change the story and the layer → load → the layer is back, the restored story
 *      plays again (gameStoryFromMetadata is not null), and the world snapshot was re-saved with it.
 *   3) End-to-end: a world with no layer at the save has the layer added later cleared by the load.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  WORLD_GENERATOR_VERSION,
  WORLD_STARTER_KITS,
  checkStoryScript,
  checkWorldBrief,
  compileGameWorld,
  gameStoryFromMetadata,
  gameWorldFromMetadata,
  parseWorldKit,
  type StoryScriptInput,
  type WorldEdits,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-checkpoint-world-edits-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.LOG_LEVEL = "silent";

const parsedKit = parseWorldKit(WORLD_STARTER_KITS.find((each) => each.id === "high_fantasy")!);
assert.ok(parsedKit.ok);
const kit = parsedKit.kit;
const settlementLayer = kit.layers.find((layer) => layer.settlements)!;
const checkedBrief = checkWorldBrief(kit, {
  briefVersion: 1,
  premise: "A river kingdom",
  places: [{ name: "Ashford", layer: settlementLayer.id, size: kit.sizes.at(-1)!.id, tags: [] }],
  groups: [{ name: "The Wardens", kind: kit.groupKinds[0]!.id, seat: "Ashford", allies: [], rivals: [] }],
  peopleNames: kit.cultures.map((culture) => ({
    culture: culture.id,
    given: ["Ama", "Tobin", "Hesk", "Mira", "Oswin", "Bryn", "Calla", "Doran"],
    family: ["Holt", "Drey", "Marrow", "Vane"],
    order: "given-family" as const,
  })),
});
assert.ok(checkedBrief.ok);
const brief = checkedBrief.brief;
const seed = 4242;
const worldRecipe = { seed, generatorVersion: WORLD_GENERATOR_VERSION, grounding: "expand" as const, brief };
const ashford = compileGameWorld({ kit, ...worldRecipe }).places.find((place) => place.name === "Ashford")!;

// The layer adds a person by hand; the story names her. Only the pair fits: without the layer, the
// story names somebody the world no longer has (exactly the silent-inactive case #7783 describes).
const odda = { id: `${ashford.id}-e1`, placeId: ashford.id, name: "Odda Reed" };
const withOdda: WorldEdits = { editsVersion: 1, addedPeople: [odda] };
const story: StoryScriptInput = {
  storyVersion: 1,
  events: [{ id: "odda", when: { on: "meet", person: odda.id }, do: [{ tell: "Odda Reed knows the river." }] }],
};

const { buildCheckpointWorldEditsRestore, captureCheckpointWorldEdits } =
  await import("../../packages/server/src/services/game/checkpoint.service.js");

// ── Part 1: the pure helpers ──
{
  const atSave = { gameWorldKit: kit, gameWorld: { ...worldRecipe, edits: withOdda }, gameStory: story };
  const captured = captureCheckpointWorldEdits(atSave);
  assert.deepEqual(captured, { edits: withOdda }, "the layer is captured");
  assert.notEqual(captured!.edits, withOdda, "the capture is a copy, not a live reference");
  assert.deepEqual(
    captureCheckpointWorldEdits({ gameWorldKit: kit, gameWorld: worldRecipe }),
    { edits: null },
    "a world without a layer is captured as an empty one, so a load clears what came later",
  );
  assert.equal(
    captureCheckpointWorldEdits({ gameMorale: 50 }),
    null,
    "a chat with no world captures nothing: a load must leave the layer alone",
  );

  // The game as it stands after a later edit: the story was rewritten and the person taken out.
  const later = { gameWorldKit: kit, gameWorld: worldRecipe, gameStory: { storyVersion: 1 } };
  const brokenToday = { ...later, gameStory: story };
  assert.equal(
    gameStoryFromMetadata(brokenToday, gameWorldFromMetadata(brokenToday)),
    null,
    "the gap: the older story with the newer layer reads as inactive",
  );

  // The pair comes back together, and the story plays.
  const restored = buildCheckpointWorldEditsRestore({ edits: withOdda }, brokenToday);
  assert.ok(restored.patch, "a captured layer is put back");
  assert.equal(restored.refusal, null);
  assert.deepEqual(restored.patch!.gameWorld.edits, withOdda);
  const afterLoad = { ...brokenToday, ...restored.patch };
  assert.ok(
    gameStoryFromMetadata(afterLoad, gameWorldFromMetadata(afterLoad)),
    "the restored story fits the restored layer, so it plays",
  );

  // An empty capture clears a layer added after the save.
  const cleared = buildCheckpointWorldEditsRestore(
    { edits: null },
    {
      gameWorldKit: kit,
      gameWorld: { ...worldRecipe, edits: withOdda },
    },
  );
  assert.ok(cleared.patch);
  assert.equal(Object.hasOwn(cleared.patch!.gameWorld, "edits"), false, "empty edits clear the layer");

  // A load that would put back the layer the chat already carries writes nothing (no lock, no
  // snapshot re-save): the common rewind where only the tracker and story moved.
  assert.deepEqual(
    buildCheckpointWorldEditsRestore({ edits: withOdda }, atSave),
    { patch: null, refusal: null },
    "the chat already carries the captured layer",
  );
  assert.deepEqual(
    buildCheckpointWorldEditsRestore({ edits: null }, { gameWorldKit: kit, gameWorld: worldRecipe }),
    { patch: null, refusal: null },
    "an empty capture over a world with no layer changes nothing",
  );

  // Nothing to put back: no capture (a checkpoint from before the field) or no world now.
  assert.equal(buildCheckpointWorldEditsRestore(null, atSave).patch, null, "a legacy capture leaves it alone");
  assert.equal(
    buildCheckpointWorldEditsRestore({ edits: withOdda }, { gameMorale: 50 }).patch,
    null,
    "a chat with no world has no layer to restore",
  );

  // A capture that would take away what the restored story names is refused, not applied.
  const refused = buildCheckpointWorldEditsRestore(
    { edits: null },
    {
      gameWorldKit: kit,
      gameWorld: { ...worldRecipe, edits: withOdda },
      gameStory: story,
    },
  );
  assert.equal(refused.patch, null, "the story is checked against the layer being restored");
  assert.match(refused.refusal ?? "", /story/i);
  assert.ok(checkStoryScript(gameWorldFromMetadata(atSave)!, story).ok, "the fixture story is valid to begin with");
}

// ── Parts 2 and 3: end to end through the routes ──
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage, withChatMetadataPatchQueue } =
  await import("../../packages/server/src/services/storage/chats.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { createCheckpointService } = await import("../../packages/server/src/services/game/checkpoint.service.js");
const { loadGameWorld, saveGameWorldSnapshot } =
  await import("../../packages/server/src/services/game/game-world.service.js");
const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");

const db = await getDB();
const chats = createChatsStorage(db);
const stateStore = createGameStateStorage(db);
const checkpointSvc = createCheckpointService(db);
const createdChatIds: string[] = [];

const app = Fastify();
app.decorate("db", db);
await app.register(gameRoutes, { prefix: "/api/game" });

async function seedGame(name: string, atSave: Record<string, unknown>) {
  const chat = await chats.create({ name, mode: "game", characterIds: [] });
  assert.ok(chat);
  createdChatIds.push(chat.id);
  await chats.patchMetadata(chat.id, atSave);
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
  const checkpointId = await checkpointSvc.create({
    chatId: chat.id,
    snapshotId: snapshot.id,
    spatialSnapshotId: null,
    messageId: snapshot.messageId,
    label: "before Odda",
    triggerType: "manual",
  });
  return { chatId: chat.id, checkpointId };
}

const metadataOf = async (chatId: string) =>
  JSON.parse((await chats.getById(chatId))!.metadata as unknown as string) as Record<string, unknown>;

const loadCheckpoint = async (chatId: string, checkpointId: string) => {
  const res = await app.inject({
    method: "POST",
    url: "/api/game/checkpoint/load",
    payload: { chatId, checkpointId },
  });
  assert.equal(res.statusCode, 200, `checkpoint load should succeed: ${res.statusCode} ${res.body}`);
};

try {
  // ── Part 2: a later edit took away what the story names; the load puts both back ──
  {
    const { chatId, checkpointId } = await seedGame("restore the hand edits", {
      gameWorldKit: kit,
      gameWorld: { ...worldRecipe, edits: withOdda },
      gameStory: story,
    });

    // The story is rewritten (no longer naming Odda) and the layer drops her, as the editor allows.
    await chats.patchMetadata(chatId, {
      gameWorld: worldRecipe,
      gameStory: { storyVersion: 1 },
    });
    // A stale snapshot without the layer, so only the load re-saving one can make the assertion below
    // pass (loadGameWorld reads the snapshot, never the metadata, once a snapshot exists).
    await saveGameWorldSnapshot(db, chatId, await metadataOf(chatId));

    await loadCheckpoint(chatId, checkpointId);
    const after = await metadataOf(chatId);
    assert.deepEqual((after.gameWorld as { edits?: unknown }).edits, withOdda, "the hand edits are rewound");
    assert.ok(
      gameStoryFromMetadata(after, gameWorldFromMetadata(after)),
      "the restored story fits the restored layer, so it plays instead of reading as inactive",
    );
    const world = await loadGameWorld(db, chatId, after);
    assert.deepEqual(world?.edits, withOdda, "the world snapshot describes the restored layer, not the newer one");
  }

  // ── Part 3: a world with no layer at the save has the one added later cleared ──
  {
    const renamed: WorldEdits = { editsVersion: 1, places: [{ id: ashford.id, name: "Newhaven" }] };
    const { chatId, checkpointId } = await seedGame("clear the later hand edits", {
      gameWorldKit: kit,
      gameWorld: worldRecipe,
    });
    await chats.patchMetadata(chatId, { gameWorld: { ...worldRecipe, edits: renamed } });
    assert.deepEqual((await metadataOf(chatId)).gameWorld, { ...worldRecipe, edits: renamed });

    await loadCheckpoint(chatId, checkpointId);
    const after = await metadataOf(chatId);
    assert.equal(
      Object.hasOwn(after.gameWorld as Record<string, unknown>, "edits"),
      false,
      "edits added after an empty capture are cleared",
    );
  }

  // ── Part 4: a world from a generator this Engine no longer reads keeps its layer ──
  {
    const { chatId, checkpointId } = await seedGame("a world from an older generator", {
      gameWorldKit: kit,
      gameWorld: { ...worldRecipe, edits: withOdda },
    });
    // The chat now carries a world version this Engine cannot make again, so applying the saved layer
    // would have to reshape that world: the load must leave it exactly as it is (and still succeed).
    const older = { ...worldRecipe, generatorVersion: 0 };
    await chats.patchMetadata(chatId, { gameWorld: older });

    await loadCheckpoint(chatId, checkpointId);
    assert.deepEqual((await metadataOf(chatId)).gameWorld, older, "an unreadable world is left untouched");
  }

  // ── Part 5: the restore and its snapshot are one transaction, so a failed save writes nothing ──
  // The load cannot be made to fail its snapshot insert from here: the store's only failure seam
  // exists when the DB is created and fires on flush, not on an insert. So this pins the contract the
  // load relies on — a patch made inside the transaction is rolled back when the save after it throws.
  {
    const { chatId } = await seedGame("a load whose snapshot cannot be saved", {
      gameWorldKit: kit,
      gameWorld: { ...worldRecipe, edits: withOdda },
      gameStory: story,
    });
    const before = await metadataOf(chatId);
    await withChatMetadataPatchQueue(chatId, () =>
      assert.rejects(
        app.db.transaction(async (tx) => {
          await createChatsStorage(tx).patchMetadata(
            chatId,
            { gameStory: { storyVersion: 1 }, gameWorld: worldRecipe },
            { metadataQueueHeld: true },
          );
          throw new Error("the snapshot could not be saved");
        }),
        /snapshot could not be saved/,
      ),
    );
    assert.deepEqual(
      await metadataOf(chatId),
      before,
      "a load that cannot save its snapshot leaves the story and the world as they were",
    );
  }

  console.log("Game checkpoint world edits regression checks passed.");
} finally {
  for (const id of createdChatIds) await chats.remove(id).catch(() => {});
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
