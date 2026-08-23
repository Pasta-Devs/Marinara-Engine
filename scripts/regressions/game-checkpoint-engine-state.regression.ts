// #5077 regression: game checkpoints must restore the turn-game engine state (game_engine_state),
// not just the story + spatial snapshots. Loading a checkpoint used to rewind the narration and the
// map while an active turn-game (UNO/Chess/Poker/8-ball, and any future capability-package per-message
// game state) kept its post-checkpoint state.
//
// Two parts:
//   1) getLatestAtOrBefore(chatId, ts) selects the latest engine snapshot at/before a timestamp. The
//      engine state's own (message, swipe) anchor is INDEPENDENT of the game/spatial snapshot anchors
//      a checkpoint captures, so createdAt (set once, never mutated) is the reliable checkpoint-time
//      key.
//   2) End-to-end: after POST /game/checkpoint/load, getTurnGameView shows the checkpoint-time engine
//      state, not the post-checkpoint one. This exercises BOTH the restore-side clone and the
//      resolveTurnGameAnchor `checkpoint_restore` rule (without which the cloned row would stay
//      invisible behind the last real assistant message, so the restore write would be inert).
//
// The turn-game <-> checkpoint overlap is not reachable through normal play today (turn-games are
// conversation-mode only; checkpoints are game-mode), so the state is constructed directly. A tiny
// echo engine is registered so getTurnGameView has a valid engine and a trivially-comparable view.
import assert from "node:assert/strict";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
// Import from the built dist (not src): the server runner resolves `@marinara-engine/shared` to
// dist/index.js via the package `exports`, and the turn-game engine registry is module-level state, so
// registering here must target the SAME module instance the runner reads or getTurnGameEngine won't
// see the echo engine.
import { registerTurnGameEngine, type AnyTurnGameEngine } from "../../packages/shared/dist/index.js";
import { gameRoutes } from "../../packages/server/src/routes/game.routes.js";
import { createChatsStorage } from "../../packages/server/src/services/storage/chats.storage.js";
import { createGameStateStorage } from "../../packages/server/src/services/storage/game-state.storage.js";
import { createGameEngineStateStorage } from "../../packages/server/src/services/storage/game-engine-state.storage.js";
import { createCheckpointService } from "../../packages/server/src/services/game/checkpoint.service.js";
import { getTurnGameView } from "../../packages/server/src/services/turn-games/turn-game-runner.service.js";

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const db = await getDB();
const chats = createChatsStorage(db);
const createdChatIds: string[] = [];
const engineStore = createGameEngineStateStorage(db);
const stateStore = createGameStateStorage(db);
const checkpointSvc = createCheckpointService(db);

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Minimal turn-game engine whose public view is just the parsed state, so we can assert on it
// directly. Only gameType + publicView are exercised by getTurnGameView / loadGame.
const ECHO_GAME = "checkpoint-restore-test";
const echoEngine = {
  gameType: ECHO_GAME,
  schemaVersion: 1,
  minPlayers: 1,
  maxPlayers: 8,
  publicView: (state: unknown) => state,
  isTerminal: () => ({ done: false }),
} as unknown as AnyTurnGameEngine;
const unregisterEngine = registerTurnGameEngine(echoEngine);

const mkEngineState = (chatId: string, messageId: string, marker: string) =>
  engineStore.create({
    chatId,
    messageId,
    swipeIndex: 0,
    gameType: ECHO_GAME,
    schemaVersion: 1,
    state: JSON.stringify({ marker }),
    committed: true,
  });

const app = Fastify();
app.decorate("db", db);
await app.register(gameRoutes, { prefix: "/api/game" });

try {
  // ── Part 1: getLatestAtOrBefore selects the checkpoint-time snapshot ──
  {
    const chat = await chats.create({ name: "engine ts key", mode: "game", characterIds: [] });
    assert.ok(chat);
    createdChatIds.push(chat.id);
    await mkEngineState(chat.id, "m1", "first");
    await tick(8);
    const midTs = (await engineStore.getLatest(chat.id))!.createdAt;
    await tick(8);
    await mkEngineState(chat.id, "m2", "second");
    await tick(8);
    await mkEngineState(chat.id, "m3", "third");

    const atOrBefore = await engineStore.getLatestAtOrBefore(chat.id, midTs);
    assert.ok(atOrBefore, "getLatestAtOrBefore returns a row at/before the reference timestamp");
    assert.equal(
      JSON.parse(atOrBefore.state).marker,
      "first",
      "getLatestAtOrBefore returns the latest snapshot at/before the reference timestamp, not a newer one",
    );
  }

  // ── Part 2: end-to-end restore rewinds the engine state ──
  {
    const chat = await chats.create({ name: "checkpoint engine restore", mode: "game", characterIds: [] });
    assert.ok(chat);
    createdChatIds.push(chat.id);

    // M1 assistant message + a game_state_snapshot at M1 (what the checkpoint captures) + the
    // checkpoint-time engine state.
    const m1 = await chats.createMessage({
      chatId: chat.id,
      role: "assistant",
      characterId: null,
      content: "turn 1",
    } as Parameters<typeof chats.createMessage>[0]);
    assert.ok(m1);
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
    await mkEngineState(chat.id, m1.id, "checkpoint");
    await tick(8);

    const snapshot = await stateStore.getLatest(chat.id);
    assert.ok(snapshot);
    const cpId = await checkpointSvc.create({
      chatId: chat.id,
      snapshotId: snapshot.id,
      spatialSnapshotId: null,
      messageId: snapshot.messageId,
      label: "test cp",
      triggerType: "manual",
      location: null,
      gameState: null,
      weather: null,
      timeOfDay: null,
      turnNumber: null,
    });
    await tick(8);

    // Post-checkpoint: a newer assistant message + a newer engine state.
    const m2 = await chats.createMessage({
      chatId: chat.id,
      role: "assistant",
      characterId: null,
      content: "turn 2",
    } as Parameters<typeof chats.createMessage>[0]);
    assert.ok(m2);
    await mkEngineState(chat.id, m2.id, "post");

    const beforeView = (await getTurnGameView(db, chat.id)) as { marker?: string } | null;
    assert.equal(beforeView?.marker, "post", "before restore, the turn-game shows the post-checkpoint state");

    const res = await app.inject({
      method: "POST",
      url: "/api/game/checkpoint/load",
      payload: { chatId: chat.id, checkpointId: cpId },
    });
    assert.equal(res.statusCode, 200, `checkpoint load should succeed: ${res.statusCode} ${res.body}`);
    const restoreMsgId = (JSON.parse(res.body) as { messageId: string }).messageId;

    // The checkpoint-time engine state was cloned onto the restore anchor.
    const clonedAtRestore = await engineStore.getByChatAndMessage(chat.id, restoreMsgId, 0);
    assert.ok(clonedAtRestore, "the restore cloned a turn-game engine row onto the restore anchor");
    assert.equal(
      JSON.parse(clonedAtRestore.state).marker,
      "checkpoint",
      "the checkpoint-time engine state is cloned onto the restore anchor",
    );

    // ...and it is what the game now shows (resolveTurnGameAnchor honours the checkpoint_restore
    // system message, so the cloned row is the visible one instead of the post-checkpoint state).
    const afterView = (await getTurnGameView(db, chat.id)) as { marker?: string } | null;
    assert.equal(
      afterView?.marker,
      "checkpoint",
      "after restore, the turn-game rewinds to the checkpoint-time state",
    );
  }

  console.log("Game checkpoint engine-state regression checks passed.");
} finally {
  // Don't leave seeded chats behind across repeated runs (cascades to their snapshots + engine state).
  for (const id of createdChatIds) await chats.remove(id).catch(() => {});
  unregisterEngine();
  await app.close();
  await closeDB();
}
