// #5406 regression: one per-chat monotonic write ordinal shared by the experience-state
// rows and the queued chat-metadata patch path.
//
// A game-surface Experience keeps its save in two stores: the per-anchor game_engine_state
// row (#5102, the authority, rewinds with the story) and a chat-metadata key it maintains
// as a boot cache (chat-global, never rewinds). When a session degrades to metadata-only
// writes the two disagree at the next boot, and nothing let the client tell "metadata is
// ahead because the last session was degraded" from "the row is behind because the player
// swiped back". A single server-assigned counter that BOTH paths draw from makes the boot
// comparison total: whichever store carries the higher ordinal is the later write.
//
// Pinned behaviors:
//   1. Consecutive PUTs return strictly increasing writeOrdinal values; GET returns the
//      stored row's ordinal, and a chat with no save reads writeOrdinal: null.
//   2. A queued metadata patch that changes a top-level key draws from the SAME counter and
//      stamps metadata.metadataWriteOrdinals[key]; the mirror never stamps itself.
//   3. Interleaved PUT/PATCH storms allocate strictly increasing values with no reuse across
//      the two lock domains (experience write lock vs metadata patch queue).
//   4. The mirror is engine-owned: a patch supplying metadataWriteOrdinals cannot forge it.
//   5. A patch that changes nothing burns no ordinal and leaves the mirror alone (so a
//      spread-`current` updater cannot falsely advance an untouched package's key), while an
//      updater that mutates a nested value IN PLACE still stamps the key it mutated.
//   6. Deleting a key drops its mirror entry but still advances the counter.
//   7. Pre-#5406 rows (written without an ordinal) read back writeOrdinal: null.
//   8. Checkpoint restore re-allocates rather than cloning the captured ordinal, so the
//      restored world is the newest experience-store write and never reuses a value — and it
//      stamps only experience rows, leaving restored turn-game rows unordered.
//   9. Branching through the REAL route survives a source-chat save that lands mid-branch:
//      the branch's first allocation is above every ordinal it copied, from either store.
//  10. Both allocators floor the counter by the ordinals the chat's mirror already carries, so
//      a mirror moved into a chat with a lower (or null) counter cannot invert the ordering.
//  11. Checkpoint restore writes its engine rows INSIDE the experience-state write lock, so a
//      racing autosave PUT cannot end up with a higher ordinal than the surviving row.
//  12. A new game session carries no mirror into its brand-new chat.
//  13. Chat settings profiles never carry the mirror, and applying one preserves the target
//      chat's own mirror.
//  14. The bulk import (#5405) allocates a fresh ordinal per row in array order, floored by the
//      destination's carried mirror, and never honors a caller-supplied writeOrdinal — so a
//      freshly imported campaign beats a stale metadata cache at the next boot.
import assert from "node:assert/strict";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { CHAT_PRESET_EXCLUDED_METADATA_KEYS } from "../../packages/shared/src/types/chat-preset.js";
import { chatsRoutes } from "../../packages/server/src/routes/chats.routes.js";
import { gameRoutes } from "../../packages/server/src/routes/game.routes.js";
import { createCheckpointService } from "../../packages/server/src/services/game/checkpoint.service.js";
import {
  createChatsStorage,
  withChatMetadataPatchQueue,
} from "../../packages/server/src/services/storage/chats.storage.js";
import { createChatPresetsStorage } from "../../packages/server/src/services/storage/chat-presets.storage.js";
import { createGameEngineStateStorage } from "../../packages/server/src/services/storage/game-engine-state.storage.js";
import { createGameStateStorage } from "../../packages/server/src/services/storage/game-state.storage.js";
import { chats as chatsTable } from "../../packages/server/src/db/schema/chats.js";

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const db = await getDB();
const chats = createChatsStorage(db);
const engineStore = createGameEngineStateStorage(db);
const stateStore = createGameStateStorage(db);
const checkpointSvc = createCheckpointService(db);
const presets = createChatPresetsStorage(db);
const createdChatIds: string[] = [];
const createdPresetIds: string[] = [];

/**
 * Hook fired synchronously for every `chats` row the ROUTES insert (case 9 only).
 *
 * A route handler here is microtask-driven end to end, so two injected requests never interleave
 * — whichever Fastify dispatches first runs to completion. Landing a write "mid-branch" therefore
 * means parking the branch handler, and the only per-chat lock it takes before copying engine
 * rows is the metadata patch queue of the branch chat it just created. This hook is how the test
 * learns that id from inside the handler's own chain, in time to take the queue first.
 */
let onRouteChatInsert: ((row: { id?: unknown }) => void) | null = null;
const gatedDb: typeof db = {
  ...db,
  insert: ((table: Parameters<typeof db.insert>[0]) => {
    const builder = db.insert(table);
    if (table !== chatsTable || !onRouteChatInsert) return builder;
    return {
      ...builder,
      values: ((rows: Parameters<typeof builder.values>[0]) => {
        for (const row of Array.isArray(rows) ? rows : [rows]) onRouteChatInsert?.(row as { id?: unknown });
        return builder.values(rows);
      }) as typeof builder.values,
    };
  }) as typeof db.insert,
};

const app = Fastify();
app.decorate("db", gatedDb);
await app.register(gameRoutes, { prefix: "/api/game" });
await app.register(chatsRoutes, { prefix: "/api/chats" });

const EXPERIENCE_ID = "experience-ordinal-test";
const PACKAGE_KEY = "pixelforgeSaveCache";
/** A bare (non-"experience:") gameType, i.e. a turn-game row: single store, nothing to order. */
const TURN_GAME_TYPE = "ordinal-turn-game";

async function createExperienceChat(name: string, extra: { groupId?: string } = {}) {
  const chat = await chats.create({ name, mode: "game", characterIds: [], ...extra } as Parameters<
    typeof chats.create
  >[0]);
  assert.ok(chat);
  createdChatIds.push(chat.id);
  await chats.patchMetadata(chat.id, () => ({ gameExperienceId: EXPERIENCE_ID }));
  return chat;
}

/** A game chat whose metadata blob was written whole (unstamped), leaving its counter null. */
async function createCarriedMirrorChat(name: string, metadata: Record<string, unknown>) {
  const chat = await chats.create({ name, mode: "game", characterIds: [] });
  assert.ok(chat);
  createdChatIds.push(chat.id);
  await chats.updateMetadata(chat.id, metadata);
  return chat;
}

const putState = (chatId: string, payload: unknown) =>
  app.inject({ method: "PUT", url: `/api/game/${chatId}/experience-state`, payload: payload as object });
const getState = (chatId: string) => app.inject({ method: "GET", url: `/api/game/${chatId}/experience-state` });
const importState = (chatId: string, payload: unknown) =>
  app.inject({ method: "POST", url: `/api/game/${chatId}/experience-state/import`, payload: payload as object });

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Poll until `probe` returns something truthy, or fail loudly rather than hang out the runner. */
async function waitFor<T>(probe: () => Promise<T | null | undefined>, label: string, timeoutMs = 5_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await tick(1);
  }
}

const addAssistantMessage = async (chatId: string, content: string) => {
  const message = await chats.createMessage({
    chatId,
    role: "assistant",
    characterId: null,
    content,
  } as Parameters<typeof chats.createMessage>[0]);
  assert.ok(message);
  return message;
};

async function readMetadata(chatId: string): Promise<Record<string, unknown>> {
  const chat = await chats.getById(chatId);
  assert.ok(chat, "chat should still exist");
  const raw = (chat as { metadata?: unknown }).metadata;
  if (typeof raw !== "string") return (raw as Record<string, unknown>) ?? {};
  return JSON.parse(raw) as Record<string, unknown>;
}

async function readMirror(chatId: string): Promise<Record<string, number>> {
  const meta = await readMetadata(chatId);
  const mirror = meta.metadataWriteOrdinals;
  return mirror && typeof mirror === "object" ? (mirror as Record<string, number>) : {};
}

async function readCounter(chatId: string): Promise<number | null | undefined> {
  const chat = await chats.getById(chatId);
  assert.ok(chat, "chat should still exist");
  return (chat as { writeOrdinalCounter?: number | null }).writeOrdinalCounter;
}

/** The system marker message a checkpoint load inserts, once the handler has created it. */
async function findRestoreAnchorId(chatId: string): Promise<string | null> {
  const messages = await chats.listMessages(chatId);
  const marker = [...messages].reverse().find((message) => {
    if (message.role !== "system") return false;
    const extra = typeof message.extra === "string" ? JSON.parse(message.extra) : (message.extra ?? {});
    return (extra as { gameStateAnchor?: string }).gameStateAnchor === "checkpoint_restore";
  });
  return marker?.id ?? null;
}

const isPositiveInt = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

try {
  // ── 1. PUT returns increasing ordinals; GET returns the row's ordinal ──
  {
    const chat = await createExperienceChat("ordinal round trip");
    const empty = await getState(chat.id);
    assert.equal(empty.statusCode, 200, empty.body);
    assert.equal(empty.json().writeOrdinal, null, "a chat with no save reports writeOrdinal: null");

    await addAssistantMessage(chat.id, "turn 1");
    const first = await putState(chat.id, { state: { step: 1 } });
    assert.equal(first.statusCode, 200, first.body);
    const firstOrdinal = first.json().writeOrdinal;
    assert.ok(isPositiveInt(firstOrdinal), `PUT returns a positive integer ordinal, got ${firstOrdinal}`);

    const second = await putState(chat.id, { state: { step: 2 } });
    const secondOrdinal = second.json().writeOrdinal;
    assert.ok(
      isPositiveInt(secondOrdinal) && secondOrdinal > firstOrdinal,
      `a later PUT allocates a strictly higher ordinal (${firstOrdinal} -> ${secondOrdinal})`,
    );

    const get = await getState(chat.id);
    assert.equal(get.json().writeOrdinal, secondOrdinal, "GET returns the stored row's ordinal");
    assert.deepEqual(get.json().state, { step: 2 }, "GET still returns the state alongside the ordinal");

    // A save on a NEW anchor keeps its own ordinal — swiping back must surface the ordinal
    // of the row the reader is looking at, not the chat's high-water mark.
    const m2 = await addAssistantMessage(chat.id, "turn 2");
    const third = await putState(chat.id, { state: { step: 3 } });
    const thirdOrdinal = third.json().writeOrdinal;
    assert.ok(thirdOrdinal > secondOrdinal, "a new-anchor save still advances the counter");
    const row = await engineStore.getByChatAndMessage(chat.id, m2.id, 0, `experience:${EXPERIENCE_ID}`);
    assert.ok(row);
    assert.equal(row.writeOrdinal, thirdOrdinal, "the stored row carries the ordinal the PUT returned");
  }

  // ── 2. A metadata patch draws from the same counter and stamps the mirror ──
  {
    const chat = await createExperienceChat("ordinal metadata stamp");
    await addAssistantMessage(chat.id, "turn 1");

    const put = await putState(chat.id, { state: { world: "A" } });
    const rowOrdinal = put.json().writeOrdinal;

    await chats.patchMetadata(chat.id, () => ({ [PACKAGE_KEY]: { world: "A" } }));
    const mirror = await readMirror(chat.id);
    assert.ok(isPositiveInt(mirror[PACKAGE_KEY]), "the patched key is stamped in the mirror");
    assert.ok(
      mirror[PACKAGE_KEY] > rowOrdinal,
      `the metadata patch draws from the SAME counter as the row (${rowOrdinal} -> ${mirror[PACKAGE_KEY]})`,
    );
    assert.equal(mirror.metadataWriteOrdinals, undefined, "the engine-owned mirror never stamps an ordinal for itself");

    // And back the other way: the next row write must exceed the metadata stamp.
    const after = await putState(chat.id, { state: { world: "B" } });
    assert.ok(
      after.json().writeOrdinal > mirror[PACKAGE_KEY],
      "a row write after a metadata patch exceeds the metadata stamp",
    );
  }

  // ── 3. Interleaved PUT/PATCH: strictly increasing, no reuse ──
  {
    const chat = await createExperienceChat("ordinal interleave");
    await addAssistantMessage(chat.id, "turn 1");

    const ROUNDS = 8;
    const puts: Array<Promise<number>> = [];
    const patchKeys: string[] = [];
    for (let index = 0; index < ROUNDS; index += 1) {
      puts.push(putState(chat.id, { state: { tick: index } }).then((res) => res.json().writeOrdinal as number));
      const key = `interleaveKey${index}`;
      patchKeys.push(key);
      // Distinct keys so every patch's ordinal stays independently observable in the mirror.
      puts.push(chats.patchMetadata(chat.id, () => ({ [key]: index })).then(() => -1));
    }
    const settled = await Promise.all(puts);
    const putOrdinals = settled.filter((value) => value !== -1);
    const mirror = await readMirror(chat.id);
    const patchOrdinals = patchKeys.map((key) => mirror[key]);

    for (const ordinal of [...putOrdinals, ...patchOrdinals]) {
      assert.ok(isPositiveInt(ordinal), `every allocated ordinal is a positive integer, got ${ordinal}`);
    }
    const all = [...putOrdinals, ...patchOrdinals];
    assert.equal(
      new Set(all).size,
      all.length,
      `no ordinal is ever reused across the two lock domains (saw ${JSON.stringify(all.slice().sort((a, b) => a - b))})`,
    );
    // Issue order is NOT the contract — which racer reaches the allocator first is decided by
    // lock acquisition, not by the order the requests were fired. What IS the contract: the two
    // stores draw from one sequence, so each store's own values are all distinct and no value is
    // shared between them.
    const sortedPutOrdinals = [...putOrdinals].sort((a, b) => a - b);
    for (let index = 1; index < sortedPutOrdinals.length; index += 1) {
      assert.ok(
        sortedPutOrdinals[index] > sortedPutOrdinals[index - 1],
        `sorted PUT ordinals are strictly increasing (saw ${JSON.stringify(sortedPutOrdinals)})`,
      );
    }
    const patchOrdinalSet = new Set(patchOrdinals);
    for (const ordinal of putOrdinals) {
      assert.ok(!patchOrdinalSet.has(ordinal), `PUT ordinal ${ordinal} is disjoint from every metadata-patch ordinal`);
    }
    assert.ok(
      (await readCounter(chat.id))! >= Math.max(...all),
      "the persisted counter is at least the highest value it handed out",
    );
  }

  // ── 4. The mirror is engine-owned: a patch cannot forge it ──
  {
    const chat = await createExperienceChat("ordinal forgery");
    await chats.patchMetadata(chat.id, () => ({ [PACKAGE_KEY]: { world: "real" } }));
    const honest = (await readMirror(chat.id))[PACKAGE_KEY];
    assert.ok(isPositiveInt(honest));

    await chats.patchMetadata(chat.id, () => ({
      metadataWriteOrdinals: { [PACKAGE_KEY]: 9_000_000 },
      unrelatedKey: 1,
    }));
    const mirror = await readMirror(chat.id);
    assert.notEqual(mirror[PACKAGE_KEY], 9_000_000, "a caller-supplied mirror is discarded, not merged");
    assert.equal(mirror[PACKAGE_KEY], honest, "the untouched key keeps its real ordinal");
    assert.ok(isPositiveInt(mirror.unrelatedKey), "the real key in the same patch is still stamped");
  }

  // ── 5. Change detection: no-op patches burn nothing, in-place mutation still counts ──
  {
    const chat = await createExperienceChat("ordinal no-op");
    await chats.patchMetadata(chat.id, () => ({ [PACKAGE_KEY]: { entries: ["a"] }, other: 1 }));
    const before = await readMirror(chat.id);
    const beforeCounter = await readCounter(chat.id);

    // The `{ ...current, changedKey }` shape used across the storage layer: every key is
    // present in the patch, but only one value actually differs.
    await chats.patchMetadata(chat.id, (current) => ({ ...current, other: 2 }));
    const after = await readMirror(chat.id);
    assert.equal(
      after[PACKAGE_KEY],
      before[PACKAGE_KEY],
      "a spread-`current` patch does not falsely advance an untouched key's ordinal",
    );
    assert.ok(after.other > before.other, "the key whose value changed IS re-stamped");

    // A patch where nothing changes at all must not allocate.
    const stableCounter = await readCounter(chat.id);
    await chats.patchMetadata(chat.id, (current) => ({ ...current }));
    assert.equal(await readCounter(chat.id), stableCounter, "a patch that changes nothing burns no ordinal");
    assert.ok(typeof beforeCounter === "number" && stableCounter! > beforeCounter, "the real change did advance");

    // An updater that mutates a nested value IN PLACE and spreads `current` — the exact shape
    // the tool runtime hands to package-supplied code. `current[key]` and the merged value are
    // then the SAME (already mutated) object, so only a fingerprint taken before the updater ran
    // can see the write.
    const beforeMutation = await readMirror(chat.id);
    await chats.patchMetadata(chat.id, (current) => {
      (current[PACKAGE_KEY] as { entries: string[] }).entries.push("b");
      return { ...current };
    });
    const afterMutation = await readMirror(chat.id);
    assert.deepEqual(
      (await readMetadata(chat.id))[PACKAGE_KEY],
      { entries: ["a", "b"] },
      "the in-place mutation really was persisted",
    );
    assert.ok(
      afterMutation[PACKAGE_KEY] > beforeMutation[PACKAGE_KEY],
      "an updater that mutates a nested value in place still stamps that key",
    );
    assert.equal(afterMutation.other, beforeMutation.other, "keys the mutating updater left alone keep their ordinal");

    // Values too large to fingerprint fall back to reference identity: re-supplying the SAME
    // object is not a write, re-sending an equal-but-distinct object is (over-stamping is the
    // safe direction, and double-stringifying a multi-megabyte value on every patch is not).
    const oversizeValue = { blob: "x".repeat(40_000) };
    await chats.patchMetadata(chat.id, () => ({ oversizeKey: oversizeValue }));
    const oversizeStamp = (await readMirror(chat.id)).oversizeKey;
    assert.ok(isPositiveInt(oversizeStamp), "the oversize key is stamped on the write that introduced it");
    await chats.patchMetadata(chat.id, (current) => ({ ...current, other: 3 }));
    assert.equal(
      (await readMirror(chat.id)).oversizeKey,
      oversizeStamp,
      "an oversize value re-supplied by reference is not re-stamped",
    );
    await chats.patchMetadata(chat.id, () => ({ oversizeKey: { blob: "x".repeat(40_000) } }));
    assert.ok(
      (await readMirror(chat.id)).oversizeKey > oversizeStamp,
      "an oversize value re-sent as a fresh object counts as a write",
    );
  }

  // ── 6. Deleting a key drops its mirror entry but still advances the counter ──
  {
    const chat = await createExperienceChat("ordinal delete");
    await chats.patchMetadata(chat.id, () => ({ doomed: { a: 1 } }));
    assert.ok(isPositiveInt((await readMirror(chat.id)).doomed));
    const beforeCounter = (await readCounter(chat.id))!;

    await chats.patchMetadata(chat.id, () => ({ doomed: undefined }));
    assert.equal((await readMirror(chat.id)).doomed, undefined, "a deleted key's mirror entry is pruned");
    assert.ok(
      (await readCounter(chat.id))! > beforeCounter,
      "the delete still advances the counter so later writes sort after it",
    );
  }

  // ── 7. Pre-#5406 rows read back as null ──
  {
    const chat = await createExperienceChat("ordinal legacy row");
    const m1 = await addAssistantMessage(chat.id, "turn 1");
    // Written the way every pre-#5406 caller wrote: no ordinal supplied.
    await engineStore.create({
      chatId: chat.id,
      messageId: m1.id,
      swipeIndex: 0,
      gameType: `experience:${EXPERIENCE_ID}`,
      schemaVersion: 1,
      state: JSON.stringify({ legacy: true }),
      committed: true,
    });
    const get = await getState(chat.id);
    assert.equal(get.statusCode, 200, get.body);
    assert.equal(get.json().writeOrdinal, null, "a row written without an ordinal reads back as null, not undefined");
    assert.ok("writeOrdinal" in get.json(), "writeOrdinal is always present in the GET shape");
  }

  // ── 8. Checkpoint restore re-allocates, and stamps only experience rows ──
  {
    const chat = await createExperienceChat("ordinal checkpoint restore");
    const m1 = await addAssistantMessage(chat.id, "turn 1");
    const captured = await putState(chat.id, { state: { world: "at-checkpoint" } });
    const capturedOrdinal = captured.json().writeOrdinal as number;
    // A turn-game row at the same anchor: the checkpoint captures one row per gameType, and the
    // restore must recreate this one WITHOUT an ordinal (single store, nothing to order against).
    await engineStore.create({
      chatId: chat.id,
      messageId: m1.id,
      swipeIndex: 0,
      gameType: TURN_GAME_TYPE,
      schemaVersion: 1,
      state: JSON.stringify({ turn: 1 }),
      committed: true,
    });

    await stateStore.create({
      chatId: chat.id,
      messageId: m1.id,
      swipeIndex: 0,
      location: "",
      gameState: "exploration",
      committed: true,
    } as Parameters<typeof stateStore.create>[0]);
    const snapshot = await stateStore.getLatest(chat.id);
    assert.ok(snapshot);
    const cpId = await checkpointSvc.create({
      chatId: chat.id,
      snapshotId: snapshot.id,
      spatialSnapshotId: null,
      messageId: m1.id,
      label: "ordinal cp",
      triggerType: "manual",
    });

    // Metadata races ahead while the row sits at its checkpoint value — the degraded-session
    // shape the discriminator exists for.
    await chats.patchMetadata(chat.id, () => ({ [PACKAGE_KEY]: { world: "metadata-ahead" } }));
    const metadataOrdinal = (await readMirror(chat.id))[PACKAGE_KEY];
    assert.ok(metadataOrdinal > capturedOrdinal);

    const res = await app.inject({
      method: "POST",
      url: "/api/game/checkpoint/load",
      payload: { chatId: chat.id, checkpointId: cpId },
    });
    assert.equal(res.statusCode, 200, `checkpoint load should succeed: ${res.statusCode} ${res.body}`);

    const restored = await getState(chat.id);
    assert.deepEqual(restored.json().state, { world: "at-checkpoint" }, "restore recovers the captured world");
    const restoredOrdinal = restored.json().writeOrdinal;
    assert.ok(
      isPositiveInt(restoredOrdinal) && restoredOrdinal > metadataOrdinal,
      `the restored row is the newest experience-store write (${metadataOrdinal} -> ${restoredOrdinal}), so the boot` +
        " comparison keeps the restore instead of adopting the stale metadata copy",
    );
    assert.notEqual(restoredOrdinal, capturedOrdinal, "the restore allocates a fresh ordinal, never reusing one");

    const restoreAnchorId = await findRestoreAnchorId(chat.id);
    assert.ok(restoreAnchorId, "the restore inserted its checkpoint_restore marker message");
    const restoredTurnGameRow = await engineStore.getByChatAndMessage(chat.id, restoreAnchorId, 0, TURN_GAME_TYPE);
    assert.ok(restoredTurnGameRow, "the restore recreated the turn-game row too");
    assert.equal(
      restoredTurnGameRow.writeOrdinal,
      null,
      "a restored turn-game row stays unordered — it has one store, so an ordinal would be meaningless",
    );
  }

  // ── 9. Branch through the REAL route, with a source save landing mid-branch ──
  {
    const groupId = `ordinal-branch-${Date.now()}`;
    const source = await createExperienceChat("ordinal branch source", { groupId });
    for (let index = 0; index < 4; index += 1) await addAssistantMessage(source.id, `turn ${index + 1}`);
    await putState(source.id, { state: { world: "source" } });
    await chats.patchMetadata(source.id, () => ({ [PACKAGE_KEY]: { world: "source" } }));
    const sourceMirrorMax = Math.max(...Object.values(await readMirror(source.id)));
    const sourceCounterAtBranch = (await readCounter(source.id))!;

    // Take the branch chat's metadata patch queue the instant the handler creates it. The handler
    // reads the source counter in its first await, creates the chat, copies the messages, and
    // only THEN raises its write-ordinal floor — which is where this hold parks it, still a long
    // way short of copying the source's engine rows.
    let branchChatId: string | null = null;
    let releaseBranchGate!: () => void;
    const branchGate = new Promise<void>((resolve) => (releaseBranchGate = resolve));
    let branchGateHold: Promise<unknown> = Promise.resolve();
    let announceBranchChat!: () => void;
    const branchChatCreated = new Promise<void>((resolve) => (announceBranchChat = resolve));
    onRouteChatInsert = (row) => {
      const id = typeof row.id === "string" ? row.id : null;
      if (!id || branchChatId) return;
      branchChatId = id;
      // Registered synchronously, so the handler's later raiseWriteOrdinalFloor queues behind it.
      branchGateHold = withChatMetadataPatchQueue(id, () => branchGate);
      announceBranchChat();
    };

    // The REAL route, so updateMetadata, the pre-metadata floor raise and copyEngineSnapshot all
    // run in their real order.
    const branchResponse = app.inject({ method: "POST", url: `/api/chats/${source.id}/branch` });
    await branchChatCreated;
    onRouteChatInsert = null;
    assert.ok(branchChatId, "the branch handler created its new chat");
    createdChatIds.push(branchChatId);

    // The interleaving source save: it allocates AFTER the handler snapshotted the source counter
    // and completes BEFORE the handler copies the source's engine rows, so the copy picks up a row
    // whose ordinal is above the floor the handler inherited.
    const racingPut = await putState(source.id, { state: { world: "mid-branch" } });
    assert.equal(racingPut.statusCode, 200, racingPut.body);
    const racingOrdinal = racingPut.json().writeOrdinal as number;
    assert.ok(racingOrdinal > sourceCounterAtBranch, "the racing save allocated after the handler read the counter");
    assert.equal(
      (await readMetadata(branchChatId)).branchName,
      undefined,
      "the handler is still parked at its floor raise, so the save really did land mid-branch",
    );

    releaseBranchGate();
    await branchGateHold;
    const branched = await branchResponse;
    assert.equal(branched.statusCode, 200, branched.body);
    const branchId = branched.json().id as string;
    assert.equal(branchId, branchChatId);

    const copiedRows = await chats
      .listMessages(branchId)
      .then((messages) =>
        Promise.all(messages.map((message) => engineStore.listByChatAndMessage(branchId, message.id, 0))),
      )
      .then((rows) => rows.flat());
    const copiedOrdinals = copiedRows
      .map((row) => row.writeOrdinal)
      .filter((ordinal): ordinal is number => typeof ordinal === "number");
    assert.ok(
      copiedOrdinals.includes(racingOrdinal),
      `the interleave must actually land in the copy — expected ${racingOrdinal} among ${JSON.stringify(copiedOrdinals)}`,
    );

    await addAssistantMessage(branchId, "branch turn 1");
    const branchPut = await putState(branchId, { state: { world: "branch" } });
    const branchOrdinal = branchPut.json().writeOrdinal as number;
    const highestCopied = Math.max(sourceMirrorMax, ...copiedOrdinals);
    assert.ok(
      branchOrdinal > highestCopied,
      `the branch's first allocation exceeds every ordinal it inherited from either store (${highestCopied} -> ${branchOrdinal})`,
    );

    // The floor never lowers a counter that is already ahead, and it is reentrant-safe for a
    // caller that already holds the metadata queue.
    await chats.raiseWriteOrdinalFloor(branchId, 1);
    assert.ok((await readCounter(branchId))! >= branchOrdinal, "raiseWriteOrdinalFloor never lowers a higher counter");
    const heldRaise = withChatMetadataPatchQueue(branchId, () =>
      chats.raiseWriteOrdinalFloor(branchId, branchOrdinal + 500, { metadataQueueHeld: true }),
    );
    const raiseOutcome = await Promise.race([heldRaise.then(() => "done"), tick(2_000).then(() => "deadlocked")]);
    assert.equal(raiseOutcome, "done", "raiseWriteOrdinalFloor accepts a queue-held caller instead of deadlocking");
    assert.equal(await readCounter(branchId), branchOrdinal + 500, "the queue-held raise still moved the counter");
  }

  // ── 10. Both allocators floor by the mirror the chat already carries ──
  {
    // `updateMetadata` is the unstamped whole-blob path — the shape a branch, a session carry or
    // a restored backup uses to move a metadata blob into a chat whose counter knows nothing
    // about it. Here the mirror lands at 40 while the counter is still null, so an allocator that
    // trusted the counter alone would hand out 1 and invert the ordering for good.
    const carriedBlob = {
      gameExperienceId: EXPERIENCE_ID,
      [PACKAGE_KEY]: { world: "carried" },
      metadataWriteOrdinals: { [PACKAGE_KEY]: 40 },
    };
    const rowChat = await createCarriedMirrorChat("ordinal mirror floor row", carriedBlob);
    assert.equal(await readCounter(rowChat.id), null, "the carried blob left the counter untouched");
    await addAssistantMessage(rowChat.id, "turn 1");
    const put = await putState(rowChat.id, { state: { world: "first" } });
    assert.equal(
      put.json().writeOrdinal,
      41,
      "the experience-state allocator starts above the mirror it found, not at 1",
    );

    const patchChat = await createCarriedMirrorChat("ordinal mirror floor patch", carriedBlob);
    assert.equal(await readCounter(patchChat.id), null, "the carried blob left the counter untouched");
    await chats.patchMetadata(patchChat.id, () => ({ freshKey: 1 }));
    assert.equal(
      (await readMirror(patchChat.id)).freshKey,
      41,
      "the metadata-patch allocator starts above the mirror it found too",
    );
    assert.equal(
      (await readMirror(patchChat.id))[PACKAGE_KEY],
      40,
      "the carried stamp is preserved, so the new write is unambiguously the later one",
    );
  }

  // ── 11. Checkpoint restore's engine writes happen inside the experience write lock ──
  {
    const chat = await createExperienceChat("ordinal restore lock");
    const m1 = await addAssistantMessage(chat.id, "turn 1");
    // Only a turn-game row is captured, deliberately: it takes no ordinal, so it needs nothing
    // from the metadata patch queue. That makes this probe read the LOCK and only the lock.
    await engineStore.create({
      chatId: chat.id,
      messageId: m1.id,
      swipeIndex: 0,
      gameType: TURN_GAME_TYPE,
      schemaVersion: 1,
      state: JSON.stringify({ turn: 1 }),
      committed: true,
    });
    await stateStore.create({
      chatId: chat.id,
      messageId: m1.id,
      swipeIndex: 0,
      location: "",
      gameState: "exploration",
      committed: true,
    } as Parameters<typeof stateStore.create>[0]);
    const snapshot = await stateStore.getLatest(chat.id);
    assert.ok(snapshot);
    const cpId = await checkpointSvc.create({
      chatId: chat.id,
      snapshotId: snapshot.id,
      spatialSnapshotId: null,
      messageId: m1.id,
      label: "restore lock cp",
      triggerType: "manual",
    });

    // Hold the chat's metadata queue, then fire an autosave PUT: it takes the experience write
    // lock and then parks on the queue to allocate. The lock is now held for as long as we like.
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => (releaseGate = resolve));
    const gateHold = withChatMetadataPatchQueue(chat.id, () => gate);
    const parkedPut = putState(chat.id, { state: { world: "racing-autosave" } });
    await tick(50);

    const restore = app.inject({
      method: "POST",
      url: "/api/game/checkpoint/load",
      payload: { chatId: chat.id, checkpointId: cpId },
    });
    // Ample time for an unlocked restore to have written its rows; the fixed one stays blocked.
    await tick(150);
    const restoreAnchorId = await waitFor(() => findRestoreAnchorId(chat.id), "the restore marker message");
    assert.ok(
      !(await engineStore.getByChatAndMessage(chat.id, restoreAnchorId, 0, TURN_GAME_TYPE)),
      "the restore's engine-row writes wait for the experience write lock the parked PUT holds;" +
        " outside it, a racing autosave can outrank the surviving row and resurrect the pre-restore world",
    );

    releaseGate();
    await gateHold;
    const putRes = await parkedPut;
    const restoreRes = await restore;
    assert.equal(putRes.statusCode, 200, putRes.body);
    assert.equal(restoreRes.statusCode, 200, restoreRes.body);
    assert.ok(
      await engineStore.getByChatAndMessage(chat.id, restoreAnchorId, 0, TURN_GAME_TYPE),
      "the restore's row lands once the lock is free",
    );

    const surviving = await getState(chat.id);
    assert.equal(surviving.statusCode, 200, surviving.body);
    assert.equal(
      surviving.json().writeOrdinal,
      await readCounter(chat.id),
      "the surviving experience row carries the chat's highest ordinal, so the boot comparison prefers it",
    );
  }

  // ── 12. A new game session carries no mirror into its brand-new chat ──
  {
    const gameId = `ordinal-session-${Date.now()}`;
    const previous = await createExperienceChat("Ordinal Game — Session 1", { groupId: gameId });
    await chats.patchMetadata(previous.id, () => ({
      gameSessionStatus: "concluded",
      gameSessionNumber: 1,
      [PACKAGE_KEY]: { world: "session 1" },
    }));
    assert.ok(isPositiveInt((await readMirror(previous.id))[PACKAGE_KEY]), "the previous session has a live mirror");

    const started = await app.inject({ method: "POST", url: "/api/game/session/start", payload: { gameId } });
    assert.equal(started.statusCode, 200, `session start should succeed: ${started.statusCode} ${started.body}`);
    const sessionChatId = started.json().sessionChat.id as string;
    createdChatIds.push(sessionChatId);
    assert.notEqual(sessionChatId, previous.id, "a new session chat was created");

    const carried = await readMetadata(sessionChatId);
    assert.deepEqual(carried[PACKAGE_KEY], { world: "session 1" }, "the package's own key still carries over");
    assert.equal(
      carried.metadataWriteOrdinals,
      undefined,
      "the write-ordinal mirror does NOT travel into a chat with its own (null) counter",
    );
  }

  // ── 13. Chat settings profiles never carry the mirror ──
  {
    const preset = await presets.create({
      name: `ordinal mirror profile ${Date.now()}`,
      mode: "roleplay",
      settings: {
        metadata: {
          enableAgents: false,
          metadataWriteOrdinals: { [PACKAGE_KEY]: 77 },
        } as Record<string, unknown>,
      },
    } as Parameters<typeof presets.create>[0]);
    assert.ok(preset);
    createdPresetIds.push(preset.id);
    assert.equal(
      (preset.settings.metadata as Record<string, unknown> | undefined)?.metadataWriteOrdinals,
      undefined,
      "saving a profile strips one chat's ordinals instead of stamping every chat it is applied to",
    );

    const target = await chats.create({ name: "ordinal preset target", mode: "roleplay", characterIds: [] });
    assert.ok(target);
    createdChatIds.push(target.id);
    await chats.patchMetadata(target.id, () => ({ [PACKAGE_KEY]: { world: "target" } }));
    const ownStamp = (await readMirror(target.id))[PACKAGE_KEY];
    assert.ok(isPositiveInt(ownStamp));

    await presets.applyToChat(preset.id, target.id);
    assert.equal(
      (await readMirror(target.id))[PACKAGE_KEY],
      ownStamp,
      "applying a profile preserves the target chat's own ordering instead of wiping it",
    );

    // Both behaviors above are driven by one exclusion list, so pin the entry itself last.
    assert.ok(
      CHAT_PRESET_EXCLUDED_METADATA_KEYS.includes("metadataWriteOrdinals"),
      "the mirror is on the profile exclusion list",
    );
  }

  // ── 14. Imported rows draw fresh ordinals from the destination chat ──
  // The import (#5405) is an experience-store write like any other. If its rows landed with
  // writeOrdinal null, a freshly imported campaign would LOSE the boot comparison to the
  // destination chat's stale metadata mirror and the pre-import world would be resurrected —
  // the exact clobber the ordinal exists to prevent. Fresh allocation (never the exported
  // value: a foreign chat's counter space) keeps ordinal order aligned with the import's
  // own forward createdAt stamps.
  {
    const chat = await createCarriedMirrorChat("ordinal import floor", {
      gameExperienceId: EXPERIENCE_ID,
      [PACKAGE_KEY]: { world: "stale-cache" },
      metadataWriteOrdinals: { [PACKAGE_KEY]: 60 },
    });
    const imported = await importState(chat.id, {
      rows: [
        // The forged writeOrdinal must be ignored — same policy as the exported createdAt.
        { messageId: "campaign-a", swipeIndex: 0, state: { step: 1 }, writeOrdinal: 999 },
        { messageId: "campaign-b", swipeIndex: 0, state: { step: 2 } },
      ],
    });
    assert.equal(imported.statusCode, 200, imported.body);

    const stored = (await engineStore.listForChat(chat.id, `experience:${EXPERIENCE_ID}`)).filter((row) =>
      row.messageId.startsWith("imported:campaign-"),
    );
    assert.equal(stored.length, 2, "both rows imported under synthetic anchors");
    assert.deepEqual(
      stored.map((row) => row.writeOrdinal),
      [61, 62],
      "imported rows draw fresh ordinals above the carried mirror, in array order, never the forged value",
    );

    const read = await getState(chat.id);
    assert.equal(
      read.json().writeOrdinal,
      62,
      "the newest imported row wins the boot comparison against the mirror at 60",
    );
  }

  console.log("experience-state-ordinal regression passed");
} finally {
  for (const chatId of createdChatIds) {
    await engineStore.deleteForChat(chatId).catch(() => undefined);
    await chats.remove(chatId).catch(() => undefined);
  }
  for (const presetId of createdPresetIds) {
    await presets.remove(presetId).catch(() => undefined);
  }
  await app.close();
  await closeDB();
}
