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
import assert from "node:assert/strict";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
// Shared must come from the built dist so the echo engine registers into the SAME module
// instance the runner reads (see game-checkpoint-engine-state.regression.ts).
import { registerTurnGameEngine, type AnyTurnGameEngine } from "../../packages/shared/dist/index.js";
import { eq } from "../../packages/server/src/db/file-query.js";
import { gameEngineState } from "../../packages/server/src/db/schema/index.js";
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
