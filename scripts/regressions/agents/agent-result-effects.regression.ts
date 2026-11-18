// Agent result effects shared by normal generation and the retry-agents route (#9508).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AGENT_RESULT_TYPE_VALUES, type AgentResult } from "../../../packages/shared/src/index.js";
import type {
  AgentResultEffectDeps,
  TrackerSnapshotRow,
} from "../../../packages/server/src/services/generation/agent-result-effects/index.js";
import { runNamedCases } from "../fixtures/named-cases.js";

// The tracker effects write a real game-state snapshot and the chat's journal, so they run against a throwaway data dir.
const directory = mkdtempSync(join(tmpdir(), "marinara-agent-result-effects-"));
process.env.DATA_DIR = directory;

const { AGENT_RESULT_EFFECT_COVERAGE, SHARED_AGENT_RESULT_EFFECT_TYPES, applyAgentResultEffect } =
  await import("../../../packages/server/src/services/generation/agent-result-effects/index.js");
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
  options: { fail?: boolean; chatId?: string; canEditTrackers?: boolean } = {},
) {
  const writes: Write[] = [];
  const patches: Array<Record<string, unknown>> = [];
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
    },
    trackers: {
      db,
      canEditTrackers: () => options.canEditTrackers ?? true,
      loadSnapshot: async () =>
        (await gameStates.getByChatAndMessage(chatId, "msg-1", 0)) as unknown as TrackerSnapshotRow | null,
      emitGameStatePatch: (patch) => patches.push(patch),
    },
    ...overrides,
  };
  return { deps, writes, patches };
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
        const characterTracker = result({ type: "character_tracker_update", data: { presentCharacters: [] } });
        assert.equal(await applyAgentResultEffect(characterTracker, deps), false);
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
