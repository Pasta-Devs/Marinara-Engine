// Agent result effects shared by normal generation and the retry-agents route (#9508).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AGENT_RESULT_TYPE_VALUES, type AgentResult } from "../../../packages/shared/src/index.js";
import type {
  AgentResultEffectDeps,
  TrackerSnapshotRow,
  WorldStateTarget,
} from "../../../packages/server/src/services/generation/agent-result-effects/index.js";
import { runNamedCases } from "../fixtures/named-cases.js";

// The tracker effects write a real game-state snapshot and the chat's journal, so they run against a throwaway data dir.
const directory = mkdtempSync(join(tmpdir(), "marinara-agent-result-effects-"));
process.env.DATA_DIR = directory;

const {
  AGENT_RESULT_EFFECT_COVERAGE,
  CHARACTER_TRACKER_STEPS,
  SHARED_AGENT_RESULT_EFFECT_TYPES,
  applyAgentResultEffect,
} = await import("../../../packages/server/src/services/generation/agent-result-effects/index.js");
const { createFileNativeDB } = await import("../../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createGameStateStorage } = await import("../../../packages/server/src/services/storage/game-state.storage.js");

const db = await createFileNativeDB();
const chatsStore = createChatsStorage(db);
const gameStates = createGameStateStorage(db);

type Write = { id: string; swipeIndex: number; partial: Record<string, unknown> };

/** A chat with one tracker snapshot for msg-1 swipe 0, which the tracker port hands to the effects. */
async function trackerChat() {
  const chat = await chatsStore.create({ name: "Tracker effects", mode: "roleplay", characterIds: [] });
  assert(chat);
  await gameStates.create({
    chatId: chat.id,
    messageId: "msg-1",
    swipeIndex: 0,
    date: null,
    time: null,
    location: null,
    weather: null,
    temperature: null,
    presentCharacters: [],
    recentEvents: [],
    playerStats: null,
    personaStats: null,
  });
  const snapshot = async () => (await gameStates.getByChatAndMessage(chat.id, "msg-1", 0)) as TrackerSnapshotRow;
  const journal = async () => {
    const fresh = await chatsStore.getById(chat.id);
    const meta = typeof fresh?.metadata === "string" ? JSON.parse(fresh.metadata) : (fresh?.metadata ?? {});
    return meta.gameJournal as
      { quests: unknown[]; entries: Array<{ type: string }>; inventoryLog: Array<{ item: string }> } | undefined;
  };
  return { chatId: chat.id, snapshot, journal };
}

function fakeDeps(
  overrides: Partial<AgentResultEffectDeps> = {},
  options: {
    fail?: boolean;
    chatId?: string;
    canEditTrackers?: boolean;
    portraitSettings?: Record<string, unknown> | null;
    drawPortrait?: (name: string) => Promise<string>;
    world?: Partial<WorldStateTarget>;
  } = {},
) {
  const writes: Write[] = [];
  const patches: Array<Record<string, unknown>> = [];
  const portraitCalls: string[] = [];
  const mapUpdates: unknown[] = [];
  const metadataWrites = { count: 0 };
  let backgroundSaved: (characters: Array<Record<string, unknown>>) => void = () => {};
  const backgroundSave = new Promise<Array<Record<string, unknown>>>((resolve) => (backgroundSaved = resolve));
  const chatId = options.chatId ?? "chat-1";
  const deps: AgentResultEffectDeps = {
    origin: "generate",
    chatId,
    messageId: "msg-1",
    swipeIndex: 2,
    chats: {
      updateMessageExtraForSwipe: async (id: string, swipeIndex: number, partial: Record<string, unknown>) => {
        if (options.fail) throw new Error("disk full");
        writes.push({ id, swipeIndex, partial });
        return null as never;
      },
      patchMetadata: (id, patch, patchOptions) => {
        metadataWrites.count += 1;
        return chatsStore.patchMetadata(id, patch, patchOptions);
      },
    },
    trackers: {
      db,
      canEditTrackers: () => options.canEditTrackers ?? true,
      loadSnapshot: async () =>
        (await gameStates.getByChatAndMessage(chatId, "msg-1", 0)) as unknown as TrackerSnapshotRow | null,
      emitGameStatePatch: (patch) => patches.push(patch),
      characters: {
        cards: [{ id: "card-alice", name: "Alice", avatarPath: "/api/avatars/alice.png" }] as never,
        history: [],
        gameNpcs: [],
        settings: options.portraitSettings ?? null,
        loadBaseline: async () =>
          (await gameStates.getByChatAndMessage(chatId, "msg-1", 0)) as unknown as TrackerSnapshotRow | null,
        save: (presentCharacters) => gameStates.updateByMessage("msg-1", 0, chatId, { presentCharacters } as never),
        loadForBackgroundSave: async () =>
          (await gameStates.getByChatAndMessage(chatId, "msg-1", 0)) as unknown as TrackerSnapshotRow | null,
        saveInBackground: async (presentCharacters) => {
          await gameStates.updateByMessage("msg-1", 0, chatId, { presentCharacters } as never);
          backgroundSaved(presentCharacters);
        },
        drawPortrait: async (character) => {
          portraitCalls.push(character.name);
          return options.drawPortrait
            ? options.drawPortrait(character.name)
            : `/api/avatars/npc/${chatId}/${character.name}.png`;
        },
      },
      // Retry's shape by default: patch this row with the agent's fields only.
      world: {
        loadPrevious: async () =>
          (await gameStates.getByChatAndMessage(chatId, "msg-1", 0)) as unknown as TrackerSnapshotRow | null,
        resolveAuthoritativeLocation: async () => null,
        patchScope: "sent",
        save: async (fields) => {
          if (Object.keys(fields).length > 0) await gameStates.updateByMessage("msg-1", 0, chatId, fields as never);
        },
        chatMeta: {},
        mapOwnedBySpatial: false,
        emitGameMapUpdate: (map) => mapUpdates.push(map),
        ...options.world,
      },
    },
    ...overrides,
  };
  return { deps, writes, patches, portraitCalls, backgroundSave, mapUpdates, metadataWrites };
}

/** A chat whose msg-1 row holds the given world fields (and locks), for the World State cases. */
async function worldChat(fields: Record<string, string>, fieldLocks?: Record<string, boolean>) {
  const tracker = await trackerChat();
  await gameStates.updateByMessage("msg-1", 0, tracker.chatId, {
    ...fields,
    ...(fieldLocks ? { fieldLocks } : {}),
  } as never);
  const row = async () => (await tracker.snapshot()) as Record<string, unknown>;
  const metadata = async () => {
    const fresh = await chatsStore.getById(tracker.chatId);
    return (typeof fresh?.metadata === "string" ? JSON.parse(fresh.metadata) : (fresh?.metadata ?? {})) as Record<
      string,
      unknown
    >;
  };
  const locationEntries = async () =>
    ((await tracker.journal())?.entries ?? [])
      .filter((entry) => entry.type === "location")
      .map((entry) => (entry as { title?: string }).title);
  return { ...tracker, row, metadata, locationEntries };
}

function worldResult(data: Record<string, unknown>): AgentResult {
  return result({ agentId: "agent-world", agentType: "world-state", type: "game_state_update", data });
}

/** A node map with the party at `at`. */
function nodeMap(at: string, discovered: string[] = ["harbor"]) {
  return {
    id: "map-1",
    type: "node" as const,
    name: "Coast",
    nodes: [
      { id: "harbor", label: "Harbor", discovered: discovered.includes("harbor") },
      { id: "market", label: "Market", discovered: discovered.includes("market") },
      { id: "tower", label: "Tower", discovered: discovered.includes("tower") },
    ],
    edges: [],
    partyPosition: at,
  };
}

function result(overrides: Partial<AgentResult> = {}): AgentResult {
  return {
    agentId: "agent-cyoa",
    agentType: "cyoa",
    type: "cyoa_choices",
    data: { choices: [{ label: "A", text: "Open the door" }] },
    tokensUsed: 0,
    durationMs: 0,
    success: true,
    error: null,
    ...overrides,
  };
}

const questResult = result({
  agentId: "agent-quest",
  agentType: "quest",
  type: "quest_update",
  data: {
    updates: [
      {
        questName: "Find the brass key",
        action: "create",
        description: "The cellar door is locked.",
        objectives: [{ text: "Search the study", completed: false }],
      },
    ],
  },
});
const inventoryResult = result({
  agentId: "agent-inventory",
  agentType: "inventory-tracker",
  type: "inventory_tracker_update",
  data: { inventory: [{ name: "Rope", qty: 1 }] },
});

const characterResult = result({
  agentId: "agent-characters",
  agentType: "character-tracker",
  type: "character_tracker_update",
  data: {
    presentCharacters: [
      { name: "Alice", appearance: "silver hair", mood: "calm" },
      { name: "Mira", appearance: "red cloak", mood: "wary" },
      { name: "Ghost", mood: "unseen" },
    ],
  },
});
const portraitsOn = { autoGenerateAvatars: true, imageConnectionId: "conn-image" };
const presentCharactersOf = async (tracker: Awaited<ReturnType<typeof trackerChat>>) => {
  const raw = (await tracker.snapshot()).presentCharacters;
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as Array<Record<string, unknown>>;
};

const playerStatsOf = (snapshot: TrackerSnapshotRow) =>
  typeof snapshot.playerStats === "string" ? JSON.parse(snapshot.playerStats) : snapshot.playerStats;

try {
  await runNamedCases([
    {
      name: "every result type says whether its effect is shared, and every shared type has a handler",
      run: () => {
        assert.deepEqual(Object.keys(AGENT_RESULT_EFFECT_COVERAGE).sort(), [...AGENT_RESULT_TYPE_VALUES].sort());
        const sharedInTable = AGENT_RESULT_TYPE_VALUES.filter(
          (type) => AGENT_RESULT_EFFECT_COVERAGE[type] === "shared",
        );
        assert.deepEqual([...SHARED_AGENT_RESULT_EFFECT_TYPES].sort(), sharedInTable.sort());
      },
    },
    {
      name: "CYOA choices are saved on the message's swipe, the same way from generate and from retry",
      run: async () => {
        for (const origin of ["generate", "retry"] as const) {
          const { deps, writes } = fakeDeps({ origin, signal: new AbortController().signal });
          assert.equal(await applyAgentResultEffect(result(), deps), true);
          assert.deepEqual(writes, [
            { id: "msg-1", swipeIndex: 2, partial: { cyoaChoices: [{ label: "A", text: "Open the door" }] } },
          ]);
        }
      },
    },
    {
      name: "failed results, empty choices and a missing message write nothing",
      run: async () => {
        const { deps, writes } = fakeDeps();
        assert.equal(await applyAgentResultEffect(result({ success: false }), deps), false);
        assert.equal(await applyAgentResultEffect(result({ data: null }), deps), false);
        assert.equal(await applyAgentResultEffect(result({ data: { choices: [] } }), deps), true);
        const noMessage = fakeDeps({ messageId: null });
        assert.equal(await applyAgentResultEffect(result(), noMessage.deps), true);
        assert.deepEqual([...writes, ...noMessage.writes], []);
      },
    },
    {
      name: "types that are not shared yet are left to the route",
      run: async () => {
        const { deps, writes, patches } = fakeDeps();
        const sprite = result({ type: "sprite_change", data: { expressions: [] } });
        assert.equal(await applyAgentResultEffect(sprite, deps), false);
        assert.deepEqual([writes, patches], [[], []]);
      },
    },
    {
      name: "a cancelled retry stops before writing and passes the abort on",
      run: async () => {
        const controller = new AbortController();
        controller.abort();
        const { deps, writes } = fakeDeps({ origin: "retry", signal: controller.signal });
        await assert.rejects(applyAgentResultEffect(result(), deps), { name: "AbortError" });
        assert.deepEqual(writes, []);

        const tracker = await trackerChat();
        const cancelled = fakeDeps({ origin: "retry", signal: controller.signal }, { chatId: tracker.chatId });
        await assert.rejects(applyAgentResultEffect(questResult, cancelled.deps), { name: "AbortError" });
        assert.equal((await tracker.snapshot()).playerStats, null);
        assert.deepEqual(cancelled.patches, []);
      },
    },
    {
      name: "a storage failure is logged, not thrown, so the other results still apply",
      run: async () => {
        const { deps } = fakeDeps({}, { fail: true });
        assert.equal(await applyAgentResultEffect(result(), deps), true);
      },
    },
    {
      name: "quests land on the snapshot and in the journal the same way from generate and from retry",
      run: async () => {
        for (const origin of ["generate", "retry"] as const) {
          const tracker = await trackerChat();
          const { deps, patches } = fakeDeps({ origin }, { chatId: tracker.chatId });
          assert.equal(await applyAgentResultEffect(questResult, deps), true);
          const quests = playerStatsOf(await tracker.snapshot()).activeQuests;
          assert.deepEqual(
            quests.map((quest: { name: string }) => quest.name),
            ["Find the brass key"],
            origin,
          );
          assert.equal(patches.length, 1, origin);
          assert.equal((await tracker.journal())?.quests.length, 1, origin);
        }
      },
    },
    {
      name: "re-running the quest and inventory agents on the same reply adds no second journal entry",
      run: async () => {
        const tracker = await trackerChat();
        for (const origin of ["generate", "retry"] as const) {
          const { deps } = fakeDeps({ origin }, { chatId: tracker.chatId });
          await applyAgentResultEffect(questResult, deps);
          await applyAgentResultEffect(inventoryResult, deps);
        }
        const journal = await tracker.journal();
        assert.equal(journal?.quests.length, 1);
        assert.equal(journal?.entries.filter((entry) => entry.type === "quest").length, 1);
        assert.deepEqual(
          journal?.inventoryLog.map((entry) => entry.item),
          ["Rope"],
        );
      },
    },
    {
      name: "persona stats, inventory and custom tracker fields are written to the message's snapshot",
      run: async () => {
        const tracker = await trackerChat();
        const { deps, patches } = fakeDeps({ origin: "retry" }, { chatId: tracker.chatId });
        await applyAgentResultEffect(
          result({
            type: "persona_stats_update",
            data: { stats: [{ name: "Energy", value: 40, max: 100, color: "#22c55e" }], status: "Tired" },
          }),
          deps,
        );
        await applyAgentResultEffect(inventoryResult, deps);
        await applyAgentResultEffect(
          result({ type: "custom_tracker_update", data: { fields: [{ name: "Clue", value: "north gate" }] } }),
          deps,
        );
        const snapshot = await tracker.snapshot();
        const personaStats =
          typeof snapshot.personaStats === "string" ? JSON.parse(snapshot.personaStats) : snapshot.personaStats;
        assert.equal(personaStats[0].name, "Energy");
        const playerStats = playerStatsOf(snapshot);
        assert.equal(playerStats.status, "Tired");
        assert.deepEqual(
          playerStats.inventoryTrackerInventory.map((item: { name: string }) => item.name),
          ["Rope"],
        );
        assert.deepEqual(playerStats.customTrackerFields, [{ name: "Clue", value: "north gate" }]);
        assert.equal(patches.length, 3);
      },
    },
    {
      name: "the character list is saved the same way from generate and retry, and a card keeps its card avatar",
      run: async () => {
        for (const origin of ["generate", "retry"] as const) {
          const tracker = await trackerChat();
          const { deps, patches } = fakeDeps({ origin }, { chatId: tracker.chatId });
          assert.equal(await applyAgentResultEffect(characterResult, deps), true);
          const saved = await presentCharactersOf(tracker);
          assert.deepEqual(
            saved.map((character) => character.name),
            ["Alice", "Mira", "Ghost"],
            origin,
          );
          assert.equal(saved[0]!.avatarPath, "/api/avatars/alice.png", origin);
          assert.equal(patches.length, 1, origin);
        }
      },
    },
    {
      name: "a snapshot whose stored character list is not a list still takes the new characters",
      run: async () => {
        const tracker = await trackerChat();
        await gameStates.updateByMessage("msg-1", 0, tracker.chatId, { presentCharacters: { damaged: true } } as never);
        const { deps, patches } = fakeDeps({ origin: "retry" }, { chatId: tracker.chatId });
        await applyAgentResultEffect(characterResult, deps);
        assert.deepEqual(
          (await presentCharactersOf(tracker)).map((character) => character.name),
          ["Alice", "Mira", "Ghost"],
        );
        assert.equal(patches.length, 1);

        const unparseable = await trackerChat();
        const run = fakeDeps({ origin: "retry" }, { chatId: unparseable.chatId });
        run.deps.trackers.characters.loadBaseline = async () => ({ id: "row-x", presentCharacters: "[{ not json" });
        await applyAgentResultEffect(characterResult, run.deps);
        assert.deepEqual(
          (await presentCharactersOf(unparseable)).map((character) => character.name),
          ["Alice", "Mira", "Ghost"],
        );
      },
    },
    {
      name: "re-running the character tracker writes each new NPC to the journal once and never a card character",
      run: async () => {
        const tracker = await trackerChat();
        for (const origin of ["generate", "retry", "retry"] as const) {
          await applyAgentResultEffect(characterResult, fakeDeps({ origin }, { chatId: tracker.chatId }).deps);
        }
        const journal = (await tracker.journal()) as unknown as { npcLog: Array<{ npcName: string }> };
        assert.deepEqual(journal.npcLog.map((entry) => entry.npcName).sort(), ["Ghost", "Mira"]);
      },
    },
    {
      name: "missing NPC portraits are drawn in the background and saved, never for a card or an NPC with no looks",
      run: async () => {
        const tracker = await trackerChat();
        const run = fakeDeps({ origin: "retry" }, { chatId: tracker.chatId, portraitSettings: portraitsOn });
        await applyAgentResultEffect(characterResult, run.deps);
        const savedInBackground = await run.backgroundSave;
        assert.deepEqual(run.portraitCalls, ["Mira"]);
        const miraPortrait = `/api/avatars/npc/${tracker.chatId}/Mira.png`;
        assert.equal(savedInBackground.find((character) => character.name === "Mira")?.avatarPath, miraPortrait);
        const stored = await presentCharactersOf(tracker);
        assert.equal(stored.find((character) => character.name === "Mira")?.avatarPath, miraPortrait);
        assert.equal(run.patches.length, 2, "the list, then the list with the portrait");
      },
    },
    {
      name: "no portrait is drawn with the setting off, after a cancel, or while the same NPC is still being drawn",
      run: async () => {
        const off = fakeDeps({}, { chatId: (await trackerChat()).chatId });
        await applyAgentResultEffect(characterResult, off.deps);
        assert.deepEqual(off.portraitCalls, []);

        const controller = new AbortController();
        controller.abort();
        const cancelled = fakeDeps(
          { origin: "retry", signal: controller.signal },
          { chatId: (await trackerChat()).chatId, portraitSettings: portraitsOn },
        );
        await assert.rejects(applyAgentResultEffect(characterResult, cancelled.deps), { name: "AbortError" });
        assert.deepEqual(cancelled.portraitCalls, []);

        const tracker = await trackerChat();
        let finishDrawing: () => void = () => {};
        const drawing = new Promise<void>((resolve) => (finishDrawing = resolve));
        const slow = fakeDeps(
          { origin: "retry" },
          {
            chatId: tracker.chatId,
            portraitSettings: portraitsOn,
            drawPortrait: async (name) => {
              await drawing;
              return `/slow/${name}.png`;
            },
          },
        );
        await applyAgentResultEffect(characterResult, slow.deps);
        const second = fakeDeps({ origin: "retry" }, { chatId: tracker.chatId, portraitSettings: portraitsOn });
        await applyAgentResultEffect(characterResult, second.deps);
        assert.deepEqual([slow.portraitCalls, second.portraitCalls], [["Mira"], []]);
        finishDrawing();
        await slow.backgroundSave;
      },
    },
    {
      name: "the per-route step switches turn an extra off for that route only",
      run: async () => {
        const saved = { ...CHARACTER_TRACKER_STEPS.retry };
        CHARACTER_TRACKER_STEPS.retry = { ...saved, drawPortraits: false, journal: false };
        try {
          const tracker = await trackerChat();
          const retry = fakeDeps({ origin: "retry" }, { chatId: tracker.chatId, portraitSettings: portraitsOn });
          await applyAgentResultEffect(characterResult, retry.deps);
          assert.deepEqual(retry.portraitCalls, []);
          assert.equal(await tracker.journal(), undefined);
          const generate = fakeDeps({ origin: "generate" }, { chatId: tracker.chatId, portraitSettings: portraitsOn });
          await applyAgentResultEffect(characterResult, generate.deps);
          assert.deepEqual(generate.portraitCalls, ["Mira"]);
          await generate.backgroundSave;
        } finally {
          CHARACTER_TRACKER_STEPS.retry = saved;
        }
      },
    },
    {
      name: "World State from generate: every field, missing ones from the previous row, saved and sent to the HUD",
      run: async () => {
        const tracker = await worldChat({ location: "Harbor", weather: "rain", time: "dawn" });
        const saved: Array<{ fields: Record<string, unknown>; recentEvents: unknown }> = [];
        const run = fakeDeps(
          {},
          {
            chatId: tracker.chatId,
            world: {
              patchScope: "full",
              save: async (fields, context) => {
                saved.push({ fields, recentEvents: context.recentEvents });
              },
            },
          },
        );
        await applyAgentResultEffect(
          worldResult({ date: "Day 2", location: "Market", recentEvents: ["Bought bread"] }),
          run.deps,
        );
        const expected = {
          date: "Day 2",
          time: "dawn",
          location: "Market",
          weather: "rain",
          temperature: null,
          worldCustomFields: [],
        };
        assert.deepEqual(saved, [{ fields: expected, recentEvents: ["Bought bread"] }]);
        const { worldCustomFields: _notSent, ...hud } = expected;
        assert.deepEqual(run.patches, [hud]);
        assert.deepEqual(await tracker.locationEntries(), ["Discovered: Market"]);
      },
    },
    {
      name: "World State from retry: only the agent's fields are patched and sent; an empty value clears nothing",
      run: async () => {
        const tracker = await worldChat({ location: "Harbor", weather: "rain", time: "dawn" });
        const run = fakeDeps({ origin: "retry" }, { chatId: tracker.chatId });
        await applyAgentResultEffect(worldResult({ time: "noon", weather: "", date: 3 }), run.deps);
        const row = await tracker.row();
        assert.deepEqual([row.time, row.weather, row.date, row.location], ["noon", "rain", "3", "Harbor"]);
        assert.deepEqual(run.patches, [{ time: "noon", date: "3" }]);
        assert.deepEqual(await tracker.locationEntries(), []);
      },
    },
    {
      name: "World State keeps a locked field, and a retry journals a new location once, never the same one",
      run: async () => {
        const tracker = await worldChat({ location: "Harbor", weather: "rain" }, { "world.weather": true });
        const run = fakeDeps({ origin: "retry" }, { chatId: tracker.chatId });
        await applyAgentResultEffect(worldResult({ weather: "sun", location: "Harbor" }), run.deps);
        assert.equal((await tracker.row()).weather, "rain");
        assert.deepEqual(await tracker.locationEntries(), []);
        await applyAgentResultEffect(worldResult({ location: "Market" }), run.deps);
        await applyAgentResultEffect(worldResult({ location: "Market" }), run.deps);
        assert.deepEqual(await tracker.locationEntries(), ["Discovered: Market"]);
        // No game map in this chat, so the party-marker sync never touches the chat's metadata.
        assert.equal(run.metadataWrites.count, 0);
      },
    },
    {
      name: "the spatial map's place wins over the agent's location, and its party marker is left alone",
      run: async () => {
        const tracker = await worldChat({ location: "Keep > Hall" });
        const chatMeta = { gameMap: nodeMap("harbor") };
        const run = fakeDeps(
          { origin: "retry" },
          {
            chatId: tracker.chatId,
            world: {
              resolveAuthoritativeLocation: async () => "Keep > Hall",
              chatMeta,
              mapOwnedBySpatial: true,
            },
          },
        );
        await applyAgentResultEffect(worldResult({ location: "Market" }), run.deps);
        assert.equal((await tracker.row()).location, "Keep > Hall");
        assert.deepEqual(run.patches, [{ location: "Keep > Hall" }]);
        assert.deepEqual([run.mapUpdates, chatMeta.gameMap.partyPosition], [[], "harbor"]);
      },
    },
    {
      name: "moving the party marker re-reads the chat's metadata, so it keeps a change made meanwhile",
      run: async () => {
        const tracker = await worldChat({ location: "Harbor" });
        // The route's copy is stale: since it was read, the game was started and the Tower was discovered.
        const chatMeta: Record<string, unknown> = { gameMap: nodeMap("harbor") };
        await chatsStore.updateMetadata(tracker.chatId, {
          gameMap: nodeMap("harbor", ["harbor", "tower"]),
          gameSessionStatus: "active",
        });
        const run = fakeDeps({ origin: "retry" }, { chatId: tracker.chatId, world: { chatMeta } });
        await applyAgentResultEffect(worldResult({ location: "Market" }), run.deps);
        const stored = await tracker.metadata();
        assert.equal(stored.gameSessionStatus, "active");
        const storedMap = stored.gameMap as {
          partyPosition: string;
          nodes: Array<{ id: string; discovered: boolean }>;
        };
        assert.equal(storedMap.partyPosition, "market");
        assert.deepEqual(
          storedMap.nodes.filter((node) => node.discovered).map((node) => node.id),
          ["harbor", "market", "tower"],
        );
        assert.equal((chatMeta.gameMap as { partyPosition: string }).partyPosition, "market");
        assert.equal(run.mapUpdates.length, 1);
        assert.equal(run.metadataWrites.count, 1);
        // Back at the Market again: the marker is already there, so nothing is written.
        await applyAgentResultEffect(worldResult({ location: "Market" }), run.deps);
        assert.deepEqual([run.metadataWrites.count, run.mapUpdates.length], [1, 1]);
        assert.deepEqual(await tracker.locationEntries(), ["Discovered: Market"]);
      },
    },
    {
      name: "World State skips combat results, and a cancelled retry stops before saving",
      run: async () => {
        const tracker = await worldChat({ location: "Harbor" });
        const run = fakeDeps({ origin: "retry" }, { chatId: tracker.chatId });
        await applyAgentResultEffect({ ...worldResult({ location: "Arena" }), agentType: "combat" }, run.deps);
        assert.deepEqual([(await tracker.row()).location, run.patches], ["Harbor", []]);

        const controller = new AbortController();
        const cancelled = fakeDeps(
          { origin: "retry", signal: controller.signal },
          {
            chatId: tracker.chatId,
            world: {
              resolveAuthoritativeLocation: async () => {
                controller.abort();
                return null;
              },
            },
          },
        );
        await assert.rejects(applyAgentResultEffect(worldResult({ location: "Market" }), cancelled.deps), {
          name: "AbortError",
        });
        assert.deepEqual([(await tracker.row()).location, cancelled.patches], ["Harbor", []]);
      },
    },
    {
      name: "a custom agent without the edit-trackers capability changes nothing",
      run: async () => {
        const tracker = await trackerChat();
        const { deps, patches } = fakeDeps({}, { chatId: tracker.chatId, canEditTrackers: false });
        assert.equal(await applyAgentResultEffect(questResult, deps), true);
        assert.equal((await tracker.snapshot()).playerStats, null);
        assert.deepEqual(patches, []);
        assert.equal(await tracker.journal(), undefined);
      },
    },
  ]);
} finally {
  await db._fileStore.close();
  rmSync(directory, { recursive: true, force: true });
}
