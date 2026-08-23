// #5102 regression: host-owned experience-state routes over game_engine_state.
//
// A game-surface Experience (capability package owning a Game mode world) cannot reach
// game_engine_state through the turn-game runner, and its sanctioned route registrar is
// privileged-only — so its world state used to live in chat metadata, which no engine
// seam rewinds. These routes give the chat's stamped Experience scoped access to the
// real table so swipes, branches, and checkpoint restores rewind the world like they
// rewind a turn-game.
//
// Pinned behaviors:
//   1. PUT/GET round-trip anchored to the latest visible assistant message.
//   2. Chats without a stamped gameExperienceId are refused (409) on both verbs.
//   3. Namespace isolation: experience reads are scoped to "experience:<id>" — turn-game
//      rows in the same chat are invisible to them, and vice versa via scoped reads.
//   4. Anchor rewind: after a newer save on a newer message, a reader whose visible
//      anchor is the older message sees the older save.
//   5. The "" live anchor is used before any assistant message exists.
//   6. Oversized state is rejected (422) without writing a row.
//   7. Same-anchor saves replace (one row per anchor); cross-anchor saves accumulate,
//      and getLatestAtOrBefore (the LEGACY pre-engineStateData restore fallback) recovers
//      older saves across anchors; pruning keeps only the newest N anchors.
//   8. The stamp is only honored on game-mode chats (a metadata-patched Conversation
//      chat cannot opt into the namespace).
//   9. A missing chat is a clean 404.
//  10. A newer experience save never shadows an active turn-game from the runner.
//  11. Turn-game resign wipes turn-game rows but never experience rows.
//  12. Checkpoint restore recovers the capture-time world even after the same anchor is
//      rewritten post-checkpoint (the ordering that invalidated the createdAt re-lookup).
//  13. A row whose stored value is unreadable (unparseable text, or a non-string column)
//      returns exists:true / state:null / stateUnparseable:true PLUS the raw text (capped,
//      flagged when truncated); healthy rows carry none of the three keys.
//  14. DELETE wipes only the chat's experience namespace — a foreign-namespace row in the
//      same chat survives — and reports the number of rows it removed (#5405).
//  15. Export → delete → import round-trips a campaign: same states, same anchors, same
//      order, and the restored campaign reads back through the normal GET (#5405).
//  16. Import bounds: over the row cap or over the per-row state cap is a clean 422 with
//      nothing written, including when one bad row rides along with good ones (#5405).
//  17. Import recency: rows are re-stamped with strictly increasing createdAt in array
//      order, so the newest imported row wins fallback reads even against a pre-existing
//      row that was newer than the import (the store resolves a createdAt tie to the
//      FIRST-inserted row, which is pinned here too) (#5405).
//  18. Import stamps FORWARD of everything already in the namespace, so the post-import
//      prune can never delete the import's own rows, and the response counts survivors
//      rather than intentions (#5405).
//  19. Cross-chat safety: an anchor that is not a message of the destination chat is stored
//      under a synthetic "imported:" id, so the SOURCE chat's message deletions cannot reach
//      it through the store's chatId-agnostic messageId cascade (#5405).
//  20. Duplicate anchors inside one batch are a clean 422 naming both indices instead of a
//      silent collapse; the same messageId at a different swipeIndex stays legal (#5405).
//  21. Unreadable rows: export emits the single-row GET's stateUnparseable/rawState/
//      rawStateTruncated shape (typeof-guarded, so a null state COLUMN is not laundered),
//      and import restores an untruncated rawState VERBATIM while skipping truncated
//      captures (#5405).
//  22. The PUT stamps strictly past the namespace's newest row, so a save always wins the
//      recency read and no two saves can tie (#5405).
//  23. Export/import share a dedicated rate-limit class; the per-turn GET/PUT save does not
//      fall into it (#5405).
//  24. The checkpoint-restore legacy fallback (empty/absent capture) stamps createdAt past the
//      namespace's newest like every other writer in the family, so a future-stamped burst
//      cannot shadow the freshly restored world (#5418).
import assert from "node:assert/strict";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
// Shared must come from the built dist so the echo engine registers into the SAME module
// instance the runner reads (see game-checkpoint-engine-state.regression.ts).
import { registerTurnGameEngine, type AnyTurnGameEngine } from "../../packages/shared/dist/index.js";
import { eq } from "../../packages/server/src/db/file-query.js";
import { gameEngineState } from "../../packages/server/src/db/schema/index.js";
import { rateLimitHook, resetRateLimitBucketsForTests } from "../../packages/server/src/middleware/rate-limit.js";
import { gameRoutes } from "../../packages/server/src/routes/game.routes.js";
import { createCheckpointService } from "../../packages/server/src/services/game/checkpoint.service.js";
import { createChatsStorage } from "../../packages/server/src/services/storage/chats.storage.js";
import { createGameEngineStateStorage } from "../../packages/server/src/services/storage/game-engine-state.storage.js";
import { createGameStateStorage } from "../../packages/server/src/services/storage/game-state.storage.js";
import {
  getTurnGameView,
  resignTurnGame,
} from "../../packages/server/src/services/turn-games/turn-game-runner.service.js";

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const db = await getDB();
const chats = createChatsStorage(db);
const engineStore = createGameEngineStateStorage(db);
const stateStore = createGameStateStorage(db);
const checkpointSvc = createCheckpointService(db);
const createdChatIds: string[] = [];

// Echo turn-game engine so getTurnGameView resolves rows of this type (case: an
// experience save must not shadow an active turn-game).
const ECHO_GAME = "experience-state-echo";
const echoEngine = {
  gameType: ECHO_GAME,
  schemaVersion: 1,
  minPlayers: 1,
  maxPlayers: 8,
  publicView: (state: unknown) => state,
  isTerminal: () => ({ done: false }),
} as unknown as AnyTurnGameEngine;
const unregisterEngine = registerTurnGameEngine(echoEngine);

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const app = Fastify();
app.decorate("db", db);
await app.register(gameRoutes, { prefix: "/api/game" });

const EXPERIENCE_ID = "experience-state-test";
const GAME_TYPE = `experience:${EXPERIENCE_ID}`;

async function createExperienceChat(name: string) {
  const chat = await chats.create({ name, mode: "game", characterIds: [] });
  assert.ok(chat);
  createdChatIds.push(chat.id);
  await chats.patchMetadata(chat.id, () => ({ gameExperienceId: EXPERIENCE_ID }));
  return chat;
}

const putState = (chatId: string, payload: unknown) =>
  app.inject({ method: "PUT", url: `/api/game/${chatId}/experience-state`, payload: payload as object });
const getState = (chatId: string) => app.inject({ method: "GET", url: `/api/game/${chatId}/experience-state` });
const deleteState = (chatId: string) => app.inject({ method: "DELETE", url: `/api/game/${chatId}/experience-state` });
const exportState = (chatId: string) =>
  app.inject({ method: "GET", url: `/api/game/${chatId}/experience-state/export` });
const importState = (chatId: string, payload: unknown) =>
  app.inject({ method: "POST", url: `/api/game/${chatId}/experience-state/import`, payload: payload as object });

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

try {
  // ── 1. Round-trip on the visible anchor ──
  {
    const chat = await createExperienceChat("experience round trip");
    const m1 = await addAssistantMessage(chat.id, "turn 1");

    const put = await putState(chat.id, { state: { zone: "village", x: 5 } });
    assert.equal(put.statusCode, 200, put.body);
    assert.equal(put.json().anchor.messageId, m1.id, "save anchors to the visible assistant message");

    const get = await getState(chat.id);
    assert.equal(get.statusCode, 200, get.body);
    const body = get.json();
    assert.deepEqual(body.state, { zone: "village", x: 5 }, "GET returns the stored state parsed");
    assert.equal(body.anchor.messageId, m1.id);
    assert.equal(body.anchorMatched, true, "the visible anchor's own save reports anchorMatched");
    assert.equal(body.committed, true, "experience saves default to committed");

    const empty = await getState((await createExperienceChat("experience empty")).id);
    assert.equal(empty.statusCode, 200);
    assert.equal(empty.json().state, null, "a chat with no save yet reads as state:null, not an error");
  }

  // ── 2. Chats without a stamped Experience are refused ──
  {
    const chat = await chats.create({ name: "no experience", mode: "game", characterIds: [] });
    assert.ok(chat);
    createdChatIds.push(chat.id);
    const get = await getState(chat.id);
    assert.equal(get.statusCode, 409, "GET refuses a chat without gameExperienceId");
    const put = await putState(chat.id, { state: { nope: true } });
    assert.equal(put.statusCode, 409, "PUT refuses a chat without gameExperienceId");
    assert.equal(await engineStore.getLatest(chat.id), null, "the refused PUT wrote nothing");

    // The same gate covers the save-management verbs (#5405).
    assert.equal((await deleteState(chat.id)).statusCode, 409, "DELETE refuses a chat without gameExperienceId");
    assert.equal((await exportState(chat.id)).statusCode, 409, "export refuses a chat without gameExperienceId");
    const importRes = await importState(chat.id, {
      rows: [{ messageId: "", swipeIndex: 0, state: { nope: true } }],
    });
    assert.equal(importRes.statusCode, 409, "import refuses a chat without gameExperienceId");
    assert.equal(await engineStore.getLatest(chat.id), null, "the refused import wrote nothing");
  }

  // ── 3. Namespace isolation from turn-game rows ──
  {
    const chat = await createExperienceChat("experience isolation");
    const m1 = await addAssistantMessage(chat.id, "turn 1");
    await engineStore.create({
      chatId: chat.id,
      messageId: m1.id,
      swipeIndex: 0,
      gameType: "uno",
      schemaVersion: 1,
      state: JSON.stringify({ turnGame: true }),
      committed: true,
    });

    const get = await getState(chat.id);
    assert.equal(get.json().state, null, "experience reads never surface turn-game rows");

    await putState(chat.id, { state: { world: 1 } });
    const unscoped = await engineStore.getForGeneration(chat.id, {
      visibleAnchor: { messageId: m1.id, swipeIndex: 0 },
    });
    assert.ok(unscoped, "un-scoped reads still see a row");
    // Same anchor holds one row per gameType writer; the scoped reads stay disjoint.
    const scopedTurnGame = await engineStore.getForGeneration(chat.id, {
      visibleAnchor: { messageId: m1.id, swipeIndex: 0 },
      gameType: "uno",
    });
    assert.equal(JSON.parse(scopedTurnGame!.state).turnGame, true, "turn-game rows survive experience saves");
    const scopedExperience = await engineStore.getForGeneration(chat.id, {
      visibleAnchor: { messageId: m1.id, swipeIndex: 0 },
      gameType: GAME_TYPE,
    });
    assert.deepEqual(JSON.parse(scopedExperience!.state), { world: 1 });
  }

  // ── 4. Anchor rewind ──
  {
    const chat = await createExperienceChat("experience rewind");
    const m1 = await addAssistantMessage(chat.id, "turn 1");
    await putState(chat.id, { state: { turn: 1 } });
    await tick(8);
    await addAssistantMessage(chat.id, "turn 2");
    await putState(chat.id, { state: { turn: 2 } });

    const latest = await getState(chat.id);
    assert.deepEqual(latest.json().state, { turn: 2 }, "the newest anchor reads the newest save");

    const rewound = await engineStore.getForGeneration(chat.id, {
      visibleAnchor: { messageId: m1.id, swipeIndex: 0 },
      gameType: GAME_TYPE,
    });
    assert.deepEqual(JSON.parse(rewound!.state), { turn: 1 }, "an older visible anchor reads its own save");
  }

  // ── 5. Live anchor before the first assistant message ──
  {
    const chat = await createExperienceChat("experience live anchor");
    const put = await putState(chat.id, { state: { fresh: true } });
    assert.equal(put.statusCode, 200, put.body);
    assert.equal(put.json().anchor.messageId, "", 'pre-narration saves use the "" live anchor');
    const get = await getState(chat.id);
    assert.deepEqual(get.json().state, { fresh: true });
  }

  // ── 6. Oversized state is rejected without a write ──
  {
    const chat = await createExperienceChat("experience bound");
    const put = await putState(chat.id, { state: { blob: "x".repeat(263_000) } });
    assert.equal(put.statusCode, 422, "oversized state is rejected");
    assert.equal(await engineStore.getLatest(chat.id, GAME_TYPE), null, "the rejected PUT wrote nothing");
  }

  // ── 7. One row per anchor; cross-anchor history feeds checkpoint re-lookup ──
  {
    const chat = await createExperienceChat("experience anchors");
    await addAssistantMessage(chat.id, "turn 1");
    await putState(chat.id, { state: { save: "a" } });
    await tick(8);
    await putState(chat.id, { state: { save: "b" } });
    const afterRewrites = await db.select().from(gameEngineState).where(eq(gameEngineState.chatId, chat.id));
    assert.equal(afterRewrites.length, 1, "same-anchor saves replace instead of accumulating");

    const checkpointTs = afterRewrites[0]!.createdAt;
    await tick(8);
    await addAssistantMessage(chat.id, "turn 2");
    await putState(chat.id, { state: { save: "c" } });

    const atCheckpoint = await engineStore.getLatestAtOrBefore(chat.id, checkpointTs);
    assert.deepEqual(
      JSON.parse(atCheckpoint!.state),
      { save: "b" },
      "the legacy pre-engineStateData restore fallback recovers older saves across anchors",
    );

    await engineStore.pruneToNewestAnchors(chat.id, GAME_TYPE, 1);
    const pruned = await db.select().from(gameEngineState).where(eq(gameEngineState.chatId, chat.id));
    assert.equal(pruned.length, 1, "pruning keeps only the newest N anchors");
    assert.deepEqual(JSON.parse(pruned[0]!.state), { save: "c" }, "pruning keeps the newest save");
  }

  // ── 8. Mode gate: a stamped non-game chat is refused ──
  {
    const chat = await chats.create({ name: "stamped conversation", mode: "conversation", characterIds: [] });
    assert.ok(chat);
    createdChatIds.push(chat.id);
    await chats.patchMetadata(chat.id, () => ({ gameExperienceId: EXPERIENCE_ID }));
    assert.equal((await getState(chat.id)).statusCode, 409, "GET refuses a stamped non-game chat");
    assert.equal((await putState(chat.id, { state: { x: 1 } })).statusCode, 409, "PUT refuses a stamped non-game chat");
    assert.equal((await deleteState(chat.id)).statusCode, 409, "DELETE refuses a stamped non-game chat");
    assert.equal((await exportState(chat.id)).statusCode, 409, "export refuses a stamped non-game chat");
    assert.equal((await importState(chat.id, { rows: [] })).statusCode, 409, "import refuses a stamped non-game chat");
  }

  // ── 8b. A malformed stamp is refused — it must never reach the gameType namespace ──
  // A newline-bearing id could otherwise slip past the turn-game excludePrefix scope
  // (regex ^...$ without dotall cannot match across the newline).
  {
    const chat = await chats.create({ name: "malformed stamp", mode: "game", characterIds: [] });
    assert.ok(chat);
    createdChatIds.push(chat.id);
    await chats.patchMetadata(chat.id, () => ({ gameExperienceId: "evil\nexperience" }));
    assert.equal((await getState(chat.id)).statusCode, 409, "GET refuses a malformed gameExperienceId");
    assert.equal(
      (await putState(chat.id, { state: { x: 1 } })).statusCode,
      409,
      "PUT refuses a malformed gameExperienceId",
    );
  }

  // ── 9. Missing chat → 404, not 500 ──
  {
    const get = await getState("experience-state-missing-chat");
    assert.equal(get.statusCode, 404, "GET on a deleted chat is a clean 404 so packages can stop saving");
    assert.equal((await deleteState("experience-state-missing-chat")).statusCode, 404, "DELETE on a deleted chat 404s");
    assert.equal((await exportState("experience-state-missing-chat")).statusCode, 404, "export on a deleted chat 404s");
    assert.equal(
      (await importState("experience-state-missing-chat", { rows: [] })).statusCode,
      404,
      "import on a deleted chat 404s",
    );
  }

  // ── 10. An experience save must not shadow an active turn-game ──
  {
    const chat = await createExperienceChat("experience vs turn-game visibility");
    const m1 = await addAssistantMessage(chat.id, "turn 1");
    await engineStore.create({
      chatId: chat.id,
      messageId: m1.id,
      swipeIndex: 0,
      gameType: ECHO_GAME,
      schemaVersion: 1,
      state: JSON.stringify({ marker: "turn-game-live" }),
      committed: true,
    });
    assert.equal(
      ((await getTurnGameView(db, chat.id)) as { marker?: string } | null)?.marker,
      "turn-game-live",
      "sanity: the turn-game is visible before any experience save",
    );
    await tick(8);
    const put = await putState(chat.id, { state: { world: "newer-than-turn-game" } });
    assert.equal(put.statusCode, 200, put.body);
    assert.equal(
      ((await getTurnGameView(db, chat.id)) as { marker?: string } | null)?.marker,
      "turn-game-live",
      "a newer experience row does not hide the active turn-game from the runner",
    );
  }

  // ── 11. Turn-game resign/start wipes never touch experience rows ──
  {
    const chat = await createExperienceChat("experience resign survival");
    const m1 = await addAssistantMessage(chat.id, "turn 1");
    await putState(chat.id, { state: { precious: true } });
    await engineStore.create({
      chatId: chat.id,
      messageId: m1.id,
      swipeIndex: 0,
      gameType: ECHO_GAME,
      schemaVersion: 1,
      state: JSON.stringify({ marker: "doomed" }),
      committed: true,
    });
    await resignTurnGame(db, chat.id);
    assert.equal(await engineStore.getLatest(chat.id, ECHO_GAME), null, "resign still wipes turn-game rows");
    const survivor = await getState(chat.id);
    assert.deepEqual(survivor.json().state, { precious: true }, "resign leaves the experience save intact");
  }

  // ── 12. Checkpoint restore recovers the CAPTURED world, not a stale or later one ──
  // The killer ordering: save W1 → checkpoint → save W2 on the SAME anchor. The
  // pre-capture createdAt re-lookup found nothing at-or-before the checkpoint
  // (the only row's timestamp moved forward) or stepped back a whole anchor.
  {
    const chat = await createExperienceChat("experience checkpoint restore");
    const m0 = await addAssistantMessage(chat.id, "turn 0");
    await putState(chat.id, { state: { world: "W0-old-turn" } });
    await tick(8);
    const m1 = await addAssistantMessage(chat.id, "turn 1");
    await putState(chat.id, { state: { world: "W1-at-checkpoint" } });
    assert.ok(m0 && m1);

    await stateStore.create({
      chatId: chat.id,
      messageId: m1.id,
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
    const cpId = await checkpointSvc.create({
      chatId: chat.id,
      snapshotId: snapshot.id,
      spatialSnapshotId: null,
      messageId: m1.id,
      label: "experience cp",
      triggerType: "manual",
    });
    await tick(8);

    // Post-checkpoint: overwrite the SAME anchor, then confirm restore rewinds to W1.
    await putState(chat.id, { state: { world: "W2-after-checkpoint" } });
    const res = await app.inject({
      method: "POST",
      url: "/api/game/checkpoint/load",
      payload: { chatId: chat.id, checkpointId: cpId },
    });
    assert.equal(res.statusCode, 200, `checkpoint load should succeed: ${res.statusCode} ${res.body}`);

    const restored = await getState(chat.id);
    assert.deepEqual(
      restored.json().state,
      { world: "W1-at-checkpoint" },
      "restore recovers the checkpoint-time world even after a same-anchor rewrite",
    );
  }

  // ── 13. A row whose stored text will not parse hands the raw bytes back (#5407) ──
  // The client's repair for a corrupt row is a replacing PUT, which destroys the evidence,
  // and `state: null` on its own is indistinguishable from a legitimately stored null — so
  // the unparseable text rides along on the failure path only, letting a package quarantine
  // it first. Corruption is written straight through the storage layer here because the PUT
  // can only ever store JSON.stringify output.
  {
    const chat = await createExperienceChat("experience corrupt row");
    const m1 = await addAssistantMessage(chat.id, "turn 1");
    const CORRUPT = '{"zone":"village","x":5';
    await engineStore.create({
      chatId: chat.id,
      messageId: m1.id,
      swipeIndex: 0,
      gameType: GAME_TYPE,
      schemaVersion: 1,
      state: CORRUPT,
      committed: true,
    });

    const get = await getState(chat.id);
    assert.equal(get.statusCode, 200, "a corrupt row is still a 200, not a 500");
    const body = get.json();
    assert.equal(body.exists, true, "a corrupt row still reports exists:true");
    assert.equal(body.state, null, "unparseable state still reads as null");
    assert.equal(body.stateUnparseable, true, "the corruption signal is an always-truthy boolean");
    assert.equal(body.rawState, CORRUPT, "a corrupt row hands back its raw stored text verbatim");
    assert.equal(body.rawStateTruncated, false, "stored text within the ceiling is returned whole");

    // Healthy rows must not carry the keys at all — their presence IS the corruption signal.
    const healthy = await createExperienceChat("experience healthy row");
    await addAssistantMessage(healthy.id, "turn 1");
    await putState(healthy.id, { state: { fine: true } });
    const healthyBody = (await getState(healthy.id)).json();
    assert.deepEqual(healthyBody.state, { fine: true });
    assert.ok(!("rawState" in healthyBody), "a healthy row carries no rawState key");
    assert.ok(!("rawStateTruncated" in healthyBody), "a healthy row carries no rawStateTruncated key");
    assert.ok(!("stateUnparseable" in healthyBody), "a healthy row carries no stateUnparseable key");

    // The catch must never re-assume the type it exists to distrust: a NON-STRING state
    // column (a hand-repaired shard holding a real object, or a missing key reading back
    // as null through the store's default path) is corruption too — a 200 with a STRING
    // rawState, never a 500 and never a silent state:null that masquerades as legitimate.
    const objectRow = await createExperienceChat("experience object-state row");
    const m3 = await addAssistantMessage(objectRow.id, "turn 1");
    await engineStore.create({
      chatId: objectRow.id,
      messageId: m3.id,
      swipeIndex: 0,
      gameType: GAME_TYPE,
      schemaVersion: 1,
      state: { zone: "village", x: 5 } as unknown as string,
      committed: true,
    });
    const objectGet = await getState(objectRow.id);
    assert.equal(objectGet.statusCode, 200, "a non-string state column is a 200, not a 500");
    const objectBody = objectGet.json();
    assert.equal(objectBody.stateUnparseable, true, "a non-string state column reports corruption");
    assert.equal(typeof objectBody.rawState, "string", "rawState is a string under every on-disk shape");
    assert.deepEqual(
      JSON.parse(objectBody.rawState),
      { zone: "village", x: 5 },
      "the object round-trips as its JSON text",
    );

    const nullRow = await createExperienceChat("experience null-state row");
    const m4 = await addAssistantMessage(nullRow.id, "turn 1");
    await engineStore.create({
      chatId: nullRow.id,
      messageId: m4.id,
      swipeIndex: 0,
      gameType: GAME_TYPE,
      schemaVersion: 1,
      state: null as unknown as string,
      committed: true,
    });
    const nullColBody = (await getState(nullRow.id)).json();
    assert.equal(nullColBody.stateUnparseable, true, "a null state COLUMN is corruption, not a stored null");
    assert.equal(nullColBody.rawState, "null", "and its rawState is the stringified column");

    // An empty-string stored state is unparseable and its rawState is falsy — which is
    // exactly why the discriminator is stateUnparseable, not truthiness of rawState.
    const emptyRow = await createExperienceChat("experience empty-state row");
    const m5 = await addAssistantMessage(emptyRow.id, "turn 1");
    await engineStore.create({
      chatId: emptyRow.id,
      messageId: m5.id,
      swipeIndex: 0,
      gameType: GAME_TYPE,
      schemaVersion: 1,
      state: "",
      committed: true,
    });
    const emptyBody = (await getState(emptyRow.id)).json();
    assert.equal(emptyBody.stateUnparseable, true, "an empty-string row reports corruption");
    assert.equal(emptyBody.rawState, "", "with its (falsy) raw text intact");

    // ...which is what makes a legitimately stored null distinguishable from corruption.
    const storedNull = await createExperienceChat("experience stored null");
    await addAssistantMessage(storedNull.id, "turn 1");
    await putState(storedNull.id, { state: null });
    const storedNullBody = (await getState(storedNull.id)).json();
    assert.equal(storedNullBody.state, null);
    assert.ok(!("rawState" in storedNullBody), "a legitimately stored null is not reported as corrupt");

    // On-disk damage is not bounded by the PUT's ceiling, so the response is: the raw text
    // is capped at MAX_EXPERIENCE_STATE_CHARS (262_144) and flagged rather than inflating it.
    const oversize = await createExperienceChat("experience corrupt oversize");
    const m2 = await addAssistantMessage(oversize.id, "turn 1");
    const HUGE = `{"blob":"${"x".repeat(300_000)}`; // unterminated → unparseable
    await engineStore.create({
      chatId: oversize.id,
      messageId: m2.id,
      swipeIndex: 0,
      gameType: GAME_TYPE,
      schemaVersion: 1,
      state: HUGE,
      committed: true,
    });
    const oversizeBody = (await getState(oversize.id)).json();
    assert.equal(oversizeBody.state, null);
    assert.equal(oversizeBody.rawStateTruncated, true, "an oversize corrupt row is flagged as truncated");
    assert.equal(oversizeBody.rawState.length, 262_144, "the raw text is capped at MAX_EXPERIENCE_STATE_CHARS");
    assert.ok(HUGE.startsWith(oversizeBody.rawState), "the truncated text is a prefix of the stored text");
  }

  // ── 14. DELETE wipes only the experience namespace, and counts what it removed ──
  {
    const chat = await createExperienceChat("experience delete scope");
    const m1 = await addAssistantMessage(chat.id, "turn 1");
    await putState(chat.id, { state: { save: 1 } });
    await tick(8);
    await addAssistantMessage(chat.id, "turn 2");
    await putState(chat.id, { state: { save: 2 } });
    // A foreign writer's row in the same chat, at an anchor an experience row also holds.
    await engineStore.create({
      chatId: chat.id,
      messageId: m1.id,
      swipeIndex: 0,
      gameType: "uno",
      schemaVersion: 1,
      state: JSON.stringify({ turnGame: true }),
      committed: true,
    });

    const removed = await deleteState(chat.id);
    assert.equal(removed.statusCode, 200, removed.body);
    assert.deepEqual(removed.json(), { ok: true, deleted: 2 }, "DELETE reports the rows it removed");

    assert.equal(await engineStore.getLatest(chat.id, GAME_TYPE), null, "the experience namespace is empty");
    const foreign = await engineStore.getLatest(chat.id, "uno");
    assert.ok(foreign, "a foreign-namespace row in the same chat survives the delete");
    assert.deepEqual(JSON.parse(foreign.state), { turnGame: true });

    assert.deepEqual((await exportState(chat.id)).json(), { rows: [] }, "export of an emptied namespace is []");
    const afterDelete = await getState(chat.id);
    assert.equal(afterDelete.statusCode, 200, "reads after a delete are a clean empty save, not an error");
    assert.equal(afterDelete.json().state, null);

    const again = await deleteState(chat.id);
    assert.deepEqual(again.json(), { ok: true, deleted: 0 }, "deleting an already-empty namespace is a no-op 0");
  }

  // ── 15. Export → delete → import round-trips a campaign ──
  {
    const chat = await createExperienceChat("experience export round trip");
    const anchors: string[] = [];
    // No wall-clock spacing between the saves on purpose: the PUT stamps each row strictly
    // past the namespace's newest (case 22), so "oldest write first" holds by construction
    // rather than by hoping three saves land in three different milliseconds.
    for (const turn of [1, 2, 3]) {
      const message = await addAssistantMessage(chat.id, `turn ${turn}`);
      anchors.push(message.id);
      await putState(chat.id, { state: { turn, note: `save ${turn}` }, schemaVersion: 7 });
    }

    const exported = await exportState(chat.id);
    assert.equal(exported.statusCode, 200, exported.body);
    const rows = exported.json().rows as {
      messageId: string;
      swipeIndex: number;
      state: { turn: number };
      schemaVersion: number;
      committed: boolean;
      createdAt: string;
    }[];
    assert.equal(rows.length, 3, "export returns every row of the namespace");
    assert.deepEqual(
      rows.map((row) => row.state.turn),
      [1, 2, 3],
      "export is ordered oldest write first",
    );
    assert.deepEqual(
      rows.map((row) => row.messageId),
      anchors,
      "export carries each row's own anchor",
    );
    assert.equal(rows[0]!.schemaVersion, 7, "export carries schemaVersion");
    assert.equal(rows[0]!.committed, true, "export carries the committed flag");

    assert.equal((await deleteState(chat.id)).json().deleted, 3);
    const restored = await importState(chat.id, { rows });
    assert.equal(restored.statusCode, 200, restored.body);
    assert.deepEqual(
      restored.json(),
      { ok: true, imported: 3, retained: 3, pruned: 0, skipped: 0 },
      "the import response reports what survived, not what was attempted",
    );

    // createdAt is deliberately re-stamped on import (see the route comment), so the
    // round-trip is compared on everything else — state, anchors, order, metadata.
    const strip = (row: (typeof rows)[number]) => ({
      messageId: row.messageId,
      swipeIndex: row.swipeIndex,
      state: row.state,
      schemaVersion: row.schemaVersion,
      committed: row.committed,
    });
    const reExported = (await exportState(chat.id)).json().rows as typeof rows;
    assert.deepEqual(reExported.map(strip), rows.map(strip), "import reproduces the exported campaign");

    const read = await getState(chat.id);
    assert.deepEqual(read.json().state, { turn: 3, note: "save 3" }, "the visible anchor reads its restored save");
    assert.equal(read.json().anchorMatched, true, "anchors survived the round trip");
    assert.equal(read.json().schemaVersion, 7);

    // A re-import over a live campaign replaces same-anchor rows rather than duplicating —
    // and reports pruned: 0, because replacing the row at an incoming anchor is the intended
    // write, not a cap eviction (the counter once mistook these replacements for prunes).
    const reImported = await importState(chat.id, { rows });
    assert.equal(reImported.statusCode, 200, reImported.body);
    assert.deepEqual(
      reImported.json(),
      { ok: true, imported: 3, retained: 3, pruned: 0, skipped: 0 },
      "same-anchor replacements are not reported as pruned",
    );
    assert.equal(
      (await exportState(chat.id)).json().rows.length,
      3,
      "re-importing the same anchors does not duplicate",
    );
  }

  // ── 16. Import bounds: over-cap and oversized rows are refused whole ──
  {
    const chat = await createExperienceChat("experience import bounds");
    const trivial = (index: number) => ({ messageId: `anchor-${index}`, swipeIndex: 0, state: { index } });

    const overCap = await importState(chat.id, { rows: Array.from({ length: 101 }, (_, i) => trivial(i)) });
    assert.equal(overCap.statusCode, 422, "an import over the anchor cap is refused");
    assert.equal(await engineStore.getLatest(chat.id, GAME_TYPE), null, "the over-cap import wrote nothing");

    const atCap = await importState(chat.id, { rows: Array.from({ length: 100 }, (_, i) => trivial(i)) });
    assert.equal(atCap.statusCode, 200, `an import exactly at the cap is accepted: ${atCap.body}`);
    assert.equal((await exportState(chat.id)).json().rows.length, 100);
    await deleteState(chat.id);

    // One oversized row poisons the whole batch — the good row before it must not land.
    const oversized = await importState(chat.id, {
      rows: [trivial(0), { messageId: "anchor-big", swipeIndex: 0, state: { blob: "x".repeat(263_000) } }],
    });
    assert.equal(oversized.statusCode, 422, "an oversized row is refused");
    assert.equal(await engineStore.getLatest(chat.id, GAME_TYPE), null, "a batch with a bad row is refused whole");

    // A value JSON.stringify cannot represent is the same clean refusal, not a 500.
    const unserializable = await importState(chat.id, {
      rows: [{ messageId: "anchor-fn", swipeIndex: 0, state: undefined }],
    });
    assert.equal(unserializable.statusCode, 422, "a non-serializable state is refused");
    assert.equal(await engineStore.getLatest(chat.id, GAME_TYPE), null, "the refused import wrote nothing");
  }

  // ── 17. Import recency: monotonic re-stamping, and the tie rule it defends against ──
  {
    // 16a. Pin the store fact the import has to work around: createdAt is the only recency
    // key the reads order by, and a desc(createdAt) read of a tied group returns its
    // FIRST-inserted row (the store's sort is stable over in-memory insertion order — the
    // same assumption latestPerGameType documents; after a shard reload ties re-sort by row
    // id instead). Under neither regime does the newest write reliably win a tie, which is
    // why the import re-stamps instead of letting a same-millisecond batch fall to now().
    const tied = await createExperienceChat("experience createdAt tie");
    const tiedAt = new Date().toISOString();
    for (const marker of ["first-inserted", "second-inserted"]) {
      await engineStore.create({
        chatId: tied.id,
        messageId: `tie-${marker}`,
        swipeIndex: 0,
        gameType: GAME_TYPE,
        schemaVersion: 1,
        state: JSON.stringify({ marker }),
        committed: true,
        createdAt: tiedAt,
      });
    }
    assert.equal(
      JSON.parse((await engineStore.getLatest(tied.id, GAME_TYPE))!.state).marker,
      "first-inserted",
      "a createdAt tie resolves to the FIRST-inserted row — why import cannot rely on now()",
    );

    // 16b. An import must therefore re-stamp monotonically, and beat whatever is already
    // in the namespace: here a pre-existing row stamped a minute into the future. Without
    // the guard the whole import lands behind it and fallback reads keep returning the
    // stale save.
    const chat = await createExperienceChat("experience import recency");
    await engineStore.create({
      chatId: chat.id,
      messageId: "pre-existing-anchor",
      swipeIndex: 0,
      gameType: GAME_TYPE,
      schemaVersion: 1,
      state: JSON.stringify({ marker: "stale-but-newest" }),
      committed: true,
      createdAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const imported = await importState(chat.id, {
      rows: [
        { messageId: "campaign-a", swipeIndex: 0, state: { step: "oldest" } },
        { messageId: "campaign-b", swipeIndex: 0, state: { step: "middle" } },
        { messageId: "campaign-c", swipeIndex: 0, state: { step: "newest" } },
      ],
    });
    assert.equal(imported.statusCode, 200, imported.body);

    // The chat has no messages, so the GET has no visible anchor and falls back to the
    // latest committed row — which must be the last row of the imported array.
    const read = await getState(chat.id);
    assert.deepEqual(read.json().state, { step: "newest" }, "the newest imported row wins fallback reads");

    const stored = await engineStore.listForChat(chat.id, GAME_TYPE);
    // "imported:" because none of these anchors is a message of this chat — see case 19.
    const campaign = stored.filter((row) => row.messageId.startsWith("imported:campaign-"));
    assert.deepEqual(
      campaign.map((row) => JSON.parse(row.state).step),
      ["oldest", "middle", "newest"],
      "imported rows keep their array order as their stored recency order",
    );
    for (let i = 1; i < campaign.length; i += 1) {
      assert.ok(
        campaign[i]!.createdAt > campaign[i - 1]!.createdAt,
        "import stamps a strictly increasing createdAt per row",
      );
    }

    // Anchors that do not exist as messages in this chat are still imported (under the
    // synthetic id case 19 pins) and still serve through the fallback path.
    assert.equal(campaign.length, 3, "rows anchored to messages this chat never had are still imported");
  }

  // ── 18. Import stamps FORWARD, so its own rows cannot be pruned away ──
  // The data-loss shape: stamping backwards from the base put the batch's earliest rows
  // BEHIND a recent pre-existing row, and the post-import prune — which keeps the newest
  // anchors — then deleted the import's oldest saves while the response still claimed them.
  {
    const chat = await createExperienceChat("experience import forward stamping");
    const seeded = await putState(chat.id, { state: { seeded: true } });
    assert.equal(seeded.statusCode, 200, seeded.body);
    const before = (await engineStore.listForChat(chat.id, GAME_TYPE))[0]!;

    const backup = Array.from({ length: 100 }, (_, index) => ({
      messageId: `backup-${String(index).padStart(3, "0")}`,
      swipeIndex: 0,
      state: { index },
    }));
    const res = await importState(chat.id, { rows: backup });
    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual(
      res.json(),
      { ok: true, imported: 100, retained: 100, pruned: 1, skipped: 0 },
      "a full-cap import keeps every row it wrote and reports the pre-existing row it evicted",
    );

    const stored = await engineStore.listForChat(chat.id, GAME_TYPE);
    const importedAnchors = new Set(stored.map((row) => row.messageId));
    for (const row of backup) {
      assert.ok(
        importedAnchors.has(`imported:${row.messageId}`),
        `${row.messageId} survived the post-import prune (the backwards stamp lost the oldest rows)`,
      );
    }
    for (const row of stored) {
      assert.ok(
        row.createdAt > before.createdAt,
        "every imported row is stamped strictly after the pre-existing save it landed on top of",
      );
    }
    // 101 rows into a 100-anchor cap: the pre-existing save is the one that goes, never the
    // import's own oldest row.
    assert.equal(stored.length, 100, "the cap prunes the oldest row in the namespace");
  }

  // ── 19. An imported anchor cannot be destroyed by the SOURCE chat's message deletions ──
  // The store's messages -> game_engine_state cascade matches messageId GLOBALLY (it is
  // never scoped by chatId), so a campaign replayed into another chat would otherwise be
  // silently wiped when the original chat's message was deleted.
  {
    const source = await createExperienceChat("experience cascade source");
    const sourceMessage = await addAssistantMessage(source.id, "turn 1");
    await putState(source.id, { state: { campaign: "portable" } });
    const exported = (await exportState(source.id)).json().rows as { messageId: string }[];
    assert.equal(exported.length, 1);
    assert.equal(exported[0]!.messageId, sourceMessage.id, "the export carries the source chat's real anchor");

    const destination = await createExperienceChat("experience cascade destination");
    const res = await importState(destination.id, { rows: exported });
    assert.equal(res.statusCode, 200, res.body);

    const planted = await engineStore.listForChat(destination.id, GAME_TYPE);
    assert.equal(planted.length, 1);
    assert.equal(
      planted[0]!.messageId,
      `imported:${sourceMessage.id}`,
      "an anchor that is not a message of THIS chat is stored under a synthetic, uncascadable id",
    );

    await chats.removeMessage(sourceMessage.id);
    assert.equal(
      await engineStore.getLatest(source.id, GAME_TYPE),
      null,
      "sanity: the cascade really does fire and wipes the source chat's own row",
    );

    const survivors = await engineStore.listForChat(destination.id, GAME_TYPE);
    assert.equal(survivors.length, 1, "the imported campaign survives the source chat's message deletion");
    assert.deepEqual(
      (await getState(destination.id)).json().state,
      { campaign: "portable" },
      "and it still reads back through the GET's fallback path",
    );
  }

  // ── 20. Duplicate anchors in one batch are refused, not silently collapsed ──
  {
    const chat = await createExperienceChat("experience import duplicates");
    const duplicate = await importState(chat.id, {
      rows: [
        { messageId: "anchor-x", swipeIndex: 0, state: { keep: "first" } },
        { messageId: "anchor-y", swipeIndex: 0, state: { other: true } },
        { messageId: "anchor-x", swipeIndex: 0, state: { keep: "second" } },
      ],
    });
    assert.equal(duplicate.statusCode, 422, duplicate.body);
    assert.match(
      duplicate.json().error,
      /rows\[2\] and rows\[0\]/,
      "the refusal names both offending indices so a package can fix its payload",
    );
    assert.equal(await engineStore.getLatest(chat.id, GAME_TYPE), null, "the duplicate batch wrote nothing");

    // The same messageId at a different swipeIndex is a DISTINCT anchor and stays legal.
    const swipes = await importState(chat.id, {
      rows: [
        { messageId: "anchor-x", swipeIndex: 0, state: { swipe: 0 } },
        { messageId: "anchor-x", swipeIndex: 1, state: { swipe: 1 } },
      ],
    });
    assert.equal(swipes.statusCode, 200, swipes.body);
    assert.deepEqual(swipes.json(), { ok: true, imported: 2, retained: 2, pruned: 0, skipped: 0 });
  }

  // ── 21. An unreadable row round-trips through export/import via rawState ──
  // The export is the last copy a player may ever have, so a row whose stored bytes will
  // not parse carries the same stateUnparseable/rawState/rawStateTruncated shape the
  // single-row GET emits — and the import restores an untruncated rawState VERBATIM,
  // neither laundering the null into a legitimate save nor dropping the bytes.
  {
    const chat = await createExperienceChat("experience unreadable export");
    const RAW = "{not json";
    await engineStore.create({
      chatId: chat.id,
      messageId: "corrupt-anchor",
      swipeIndex: 0,
      gameType: GAME_TYPE,
      schemaVersion: 1,
      state: RAW,
      committed: true,
    });
    // A null state COLUMN is the trap the typeof guard exists for: JSON.parse(null)
    // coerces and returns null WITHOUT throwing, so a bare try/catch would export it
    // as a legitimate stored null on the one verb meant to be the backup.
    await engineStore.create({
      chatId: chat.id,
      messageId: "null-column-anchor",
      swipeIndex: 0,
      gameType: GAME_TYPE,
      schemaVersion: 1,
      state: null as unknown as string,
      committed: true,
    });

    const exported = (await exportState(chat.id)).json().rows as {
      messageId: string;
      state: unknown;
      stateUnparseable?: boolean;
      rawState?: string;
      rawStateTruncated?: boolean;
    }[];
    assert.equal(exported.length, 2);
    const flagged = exported.find((row) => row.messageId === "corrupt-anchor")!;
    assert.equal(flagged.stateUnparseable, true, "export flags a row whose stored state does not parse");
    assert.equal(flagged.state, null, "and still exports state:null so the anchor is visible");
    assert.equal(flagged.rawState, RAW, "with the stored text riding along verbatim");
    assert.equal(flagged.rawStateTruncated, false, "text within the ceiling is carried whole");
    const nullCol = exported.find((row) => row.messageId === "null-column-anchor")!;
    assert.equal(nullCol.stateUnparseable, true, "a null state COLUMN is flagged, not laundered");
    assert.equal(nullCol.rawState, "null", "as its stringified column text");

    // The restore: an untruncated flagged row lands verbatim and still reads as unparseable
    // afterward — a faithful backup restores what was there, evidence intact.
    const fresh = await createExperienceChat("experience unreadable import");
    const restored = await importState(fresh.id, { rows: [flagged] });
    assert.equal(restored.statusCode, 200, restored.body);
    assert.deepEqual(
      restored.json(),
      { ok: true, imported: 1, retained: 1, pruned: 0, skipped: 0 },
      "an untruncated unreadable row is restored, not skipped",
    );
    const roundTrip = (await getState(fresh.id)).json();
    assert.equal(roundTrip.stateUnparseable, true, "the restored row still reads as unparseable");
    assert.equal(roundTrip.rawState, RAW, "with byte-identical raw text");

    // A truncated capture is missing bytes and cannot be restored faithfully: skipped and
    // counted, never stored short — while healthy rows in the same batch still land.
    const truncTarget = await createExperienceChat("experience truncated import");
    const skippedRes = await importState(truncTarget.id, {
      rows: [
        {
          messageId: "trunc-anchor",
          swipeIndex: 0,
          state: null,
          stateUnparseable: true,
          rawState: "{cut off",
          rawStateTruncated: true,
        },
        { messageId: "healthy-anchor", swipeIndex: 0, state: { ok: true } },
      ],
    });
    assert.equal(skippedRes.statusCode, 200, skippedRes.body);
    assert.deepEqual(
      skippedRes.json(),
      { ok: true, imported: 1, retained: 1, pruned: 0, skipped: 1 },
      "a truncated capture is skipped while healthy rows still land",
    );
    assert.deepEqual((await getState(truncTarget.id)).json().state, { ok: true });
  }

  // ── 22. The PUT stamps strictly past the namespace's newest row ──
  // createdAt is the only recency key the reads order by, and neither tie-break the store can
  // apply returns the newest write (first-inserted in-process, lowest row id after a shard
  // reload), so two saves inside one millisecond would make recency arbitrary. The guard is
  // pinned deterministically with a row stamped AHEAD of the wall clock — the same shape a
  // tie takes, without racing the clock.
  {
    const chat = await createExperienceChat("experience save monotonic");
    await engineStore.create({
      chatId: chat.id,
      messageId: "ahead-of-clock",
      swipeIndex: 0,
      gameType: GAME_TYPE,
      schemaVersion: 1,
      state: JSON.stringify({ marker: "stale-but-newest" }),
      committed: true,
      createdAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const put = await putState(chat.id, { state: { marker: "the-actual-newest" } });
    assert.equal(put.statusCode, 200, put.body);
    assert.deepEqual(
      (await getState(chat.id)).json().state,
      { marker: "the-actual-newest" },
      "a fresh save always wins the recency read, even against a row stamped into the future",
    );

    // And a tight save loop produces no ties at all, which is what makes the export's
    // "oldest write first" ordering meaningful rather than incidental.
    const loop = await createExperienceChat("experience save monotonic loop");
    for (let turn = 0; turn < 16; turn += 1) {
      await addAssistantMessage(loop.id, `turn ${turn}`);
      assert.equal((await putState(loop.id, { state: { turn } })).statusCode, 200);
    }
    const saves = await engineStore.listForChat(loop.id, GAME_TYPE);
    assert.equal(saves.length, 16, "each anchor kept its own save");
    for (let i = 1; i < saves.length; i += 1) {
      assert.ok(saves[i]!.createdAt > saves[i - 1]!.createdAt, "16 tight saves produce 16 distinct timestamps");
    }
    assert.deepEqual(
      ((await exportState(loop.id)).json().rows as { state: { turn: number } }[]).map((row) => row.state.turn),
      Array.from({ length: 16 }, (_, turn) => turn),
      "so the export's oldest-write-first ordering is exact",
    );
  }

  // ── 23. Export/import sit in their own rate-limit class ──
  // Both serialize or rewrite the chat's whole namespace (up to ~100 x 256K), so a package
  // loop must hit a dedicated wall rather than the 600/min default. The hook runs on a
  // separate Fastify instance so its buckets never throttle the functional cases above, and
  // an unstamped chat 409s before any storage work, so burning the budget costs nothing.
  {
    resetRateLimitBucketsForTests();
    const limited = Fastify();
    limited.decorate("db", db);
    limited.addHook("onRequest", rateLimitHook);
    await limited.register(gameRoutes, { prefix: "/api/game" });
    try {
      const unstamped = await chats.create({ name: "experience transfer rate limit", mode: "game", characterIds: [] });
      assert.ok(unstamped);
      createdChatIds.push(unstamped.id);

      const exportUrl = `/api/game/${unstamped.id}/experience-state/export`;
      let firstLimited = -1;
      for (let call = 1; call <= 21; call += 1) {
        const res = await limited.inject({ method: "GET", url: exportUrl });
        if (res.statusCode === 429) {
          firstLimited = call;
          break;
        }
        assert.equal(res.statusCode, 409, `pre-limit call ${call} hits the stamp gate, not the wall`);
      }
      assert.equal(firstLimited, 21, "the dedicated 20/min transfer wall engages on the 21st call");

      const importRes = await limited.inject({
        method: "POST",
        url: `/api/game/${unstamped.id}/experience-state/import`,
        payload: { rows: [] },
      });
      assert.equal(importRes.statusCode, 429, "export and import share one transfer bucket");

      const save = await limited.inject({ method: "GET", url: `/api/game/${unstamped.id}/experience-state` });
      assert.equal(save.statusCode, 409, "the per-turn save verbs stay in the generous default class");
    } finally {
      await limited.close();
      resetRateLimitBucketsForTests();
    }
  }

  // ── 24. The legacy restore fallback stamps like every other writer (#5418) ──
  // stampBase = max(now, newest + 1), so a stamped burst legitimately runs AHEAD of the
  // clock (a full import lands up to ~99 ms in the future). The legacy fallback was the
  // family's last unstamped writer: its bare now() could land inside that window and sort
  // the freshly restored world BEHIND the rows it supersedes — flipping getLatest, the
  // anchor-cap prune, and the next checkpoint's capture lookup to a world the player just
  // restored away from. The future-stamped row here is that window, pinned deterministically.
  {
    const chat = await createExperienceChat("experience legacy restore stamp");
    const m1 = await addAssistantMessage(chat.id, "turn 1");

    // Checkpoint FIRST, while the chat has no engine rows: the capture is empty, which is
    // exactly the pre-#5102 shape that sends the restore down the createdAt re-lookup.
    await stateStore.create({
      chatId: chat.id,
      messageId: m1.id,
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
    const cpId = await checkpointSvc.create({
      chatId: chat.id,
      snapshotId: snapshot.id,
      spatialSnapshotId: null,
      messageId: m1.id,
      label: "legacy stamp cp",
      triggerType: "manual",
    });

    // The row the fallback's at-or-before lookup will find (backdated behind the checkpoint)...
    await engineStore.create({
      chatId: chat.id,
      messageId: "legacy-anchor",
      swipeIndex: 0,
      gameType: GAME_TYPE,
      schemaVersion: 1,
      state: JSON.stringify({ world: "W-legacy" }),
      committed: true,
      createdAt: new Date(Date.now() - 60_000).toISOString(),
    });
    // ...and the future-stamped row that IS the burst window an unstamped now() lands inside.
    const futureStamp = new Date(Date.now() + 60_000).toISOString();
    await engineStore.create({
      chatId: chat.id,
      messageId: "ahead-of-clock",
      swipeIndex: 0,
      gameType: GAME_TYPE,
      schemaVersion: 1,
      state: JSON.stringify({ world: "W-future" }),
      committed: true,
      createdAt: futureStamp,
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/game/checkpoint/load",
      payload: { chatId: chat.id, checkpointId: cpId },
    });
    assert.equal(res.statusCode, 200, `checkpoint load should succeed: ${res.statusCode} ${res.body}`);

    const newest = await engineStore.getLatest(chat.id, GAME_TYPE);
    assert.ok(newest);
    assert.deepEqual(
      JSON.parse(newest.state),
      { world: "W-legacy" },
      "the legacy-restored world is the namespace's newest, not shadowed by a future-stamped row",
    );
    assert.ok(
      newest.createdAt > futureStamp,
      "the fallback stamps strictly past the namespace's newest like every other writer",
    );
  }

  console.log("experience-state regression passed");
} finally {
  for (const chatId of createdChatIds) {
    await engineStore.deleteForChat(chatId).catch(() => undefined);
    await chats.remove(chatId).catch(() => undefined);
  }
  unregisterEngine();
  await app.close();
  await closeDB();
}
