// Canary over every agent-facing copy of the tracker state (#9745): a marker sits in every internal
// field of every source (the current row, the rows attached to past turns, the Character Tracker's
// history), and no request, Illustrator prompt or Knowledge Router query may contain it.
import assert from "node:assert/strict";
import { characterTrackerLockKey, type AgentContext } from "../../../packages/shared/src/index.js";
import { executeAgent, executeAgentBatch } from "../../../packages/server/src/services/agents/agent-executor.js";
import { buildManualIllustratorPromptMessages } from "../../../packages/server/src/services/generation/illustrator-manual-prompt-generation.js";
import { buildKnowledgeRouterQuery } from "../../../packages/server/src/services/agents/knowledge-router.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import {
  makeCapturingProvider,
  makeRegressionAgentConfig,
  makeRegressionAgentContext,
} from "../fixtures/prompt-helpers.js";
import "../fixtures/regression-agent-definitions.js";

const CANARY = "CANARY_INTERNAL";
/** Internal key names that may never appear, even when their value cannot carry the marker. */
const INTERNAL_KEYS = [
  "avatarPath",
  "avatarCrop",
  "portraitFocusX",
  "portraitFocusY",
  "portraitZoom",
  "idAliases",
  "manualOverrides",
  "hiddenTrackerFields",
  "rulesetLive",
  "rulesetClocks",
  "swipeIndex",
  "chatId",
  "messageId",
  "createdAt",
];

const hiddenMoodKey = characterTrackerLockKey({ characterId: "npc-mira", name: "Mira" }, 0, "mood");

function canaryRow(label: string) {
  return {
    id: `${CANARY}-id-${label}`,
    chatId: `${CANARY}-chat`,
    messageId: `${CANARY}-message`,
    swipeIndex: 3,
    committed: true,
    createdAt: `${CANARY}-created`,
    manualOverrides: { mood: `${CANARY}-override` },
    hiddenTrackerFields: { [hiddenMoodKey]: true },
    rulesetLive: { note: `${CANARY}-ruleset` },
    rulesetClocks: [{ name: `${CANARY}-clock` }],
    canaryTopLevel: `${CANARY}-top`,
    date: `Day 3 ${label}`,
    time: "Dusk",
    location: "North Gate",
    weather: "Rain",
    temperature: "Cold",
    worldCustomFields: [{ name: "Threat", value: "WORLD_VALUE", icon: "flame" }],
    recentEvents: ["The gate closed."],
    presentCharacters: [
      {
        characterId: "npc-mira",
        name: "Mira",
        mood: `${CANARY}-hidden-mood`,
        outfit: "CHARACTER_VALUE",
        avatarPath: `/api/avatars/${CANARY}.png`,
        avatarCrop: { srcX: 0.1, srcY: 0.1, srcWidth: 0.5, srcHeight: 0.5 },
        portraitFocusX: 40,
        portraitFocusY: 20,
        portraitZoom: 1.5,
        idAliases: [`${CANARY}-alias`],
        canaryRowField: `${CANARY}-row`,
      },
    ],
    personaStats: [{ name: "Energy", value: 5, max: 10, color: "#0f0" }],
    playerStats: {
      status: "PERSONA_VALUE",
      activeQuests: [{ name: "QUEST_VALUE", currentStage: 0, stages: [], completed: false }],
      customTrackerFields: [{ name: "Reputation", value: "CUSTOM_VALUE" }],
      inventoryTrackerInventory: [{ name: "INVENTORY_VALUE", quantity: 1 }],
      canaryPlayerStat: `${CANARY}-player`,
    },
    fieldLocks: { [`${hiddenMoodKey}`]: true, "world.Threat": true },
  };
}

function canaryContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return makeRegressionAgentContext({
    gameState: canaryRow("now") as any,
    characterTrackerHistory: [
      {
        characterId: "npc-tobin",
        name: "Old Tobin",
        mood: "grumpy",
        avatarPath: `/api/avatars/${CANARY}-tobin.png`,
        idAliases: [`${CANARY}-tobin-alias`],
      },
    ] as any,
    recentMessages: [
      { role: "user", content: "We wait at the gate." },
      { role: "assistant", content: "Mira keeps watch.", gameState: canaryRow("then") as any },
      { role: "user", content: "And then?" },
    ],
    memory: { _lastCyoaChoices: [{ label: "A", text: "CYOA_LAST_CHOICE" }] },
    ...overrides,
  });
}

function assertNoCanary(text: string, where: string) {
  assert.doesNotMatch(text, new RegExp(CANARY, "u"), `${where} leaks a marked internal value`);
  for (const key of INTERNAL_KEYS) {
    assert.doesNotMatch(text, new RegExp(`"${key}"`, "u"), `${where} leaks the internal key ${key}`);
  }
}

function requestText(calls: any[][]): string {
  return calls[0]!.map((message) => message.content).join("\n");
}

function tracker(type: string, resultType: string) {
  return makeRegressionAgentConfig({ type, name: type, settings: { resultType } });
}

function customAgent(type: string, settings: Record<string, unknown>) {
  return makeRegressionAgentConfig({
    type,
    name: type,
    isCustomAgent: true,
    settings: {
      resultType: "context_injection",
      contextSources: { chatHistory: true, trackerData: true },
      ...settings,
    },
  });
}

/** The JSON inside the first <tag> block of a request. */
function blockJson(text: string, tag: string): Record<string, any> {
  const match = new RegExp(`<${tag}[^>]*>\\n(?:[^\\n{]*\\n)?(\\{.*\\})\\n</${tag}>`, "u").exec(text);
  assert.ok(match, `missing <${tag}>`);
  return JSON.parse(match[1]!);
}

const BUILT_IN_TRACKERS: Array<[string, string, string]> = [
  ["world-state", "world_state", "WORLD_VALUE"],
  ["character-tracker", "character_tracker_update", "CHARACTER_VALUE"],
  ["persona-stats", "persona_stats_update", "PERSONA_VALUE"],
  ["quest", "quest_update", "QUEST_VALUE"],
  ["custom-tracker", "custom_tracker_update", "CUSTOM_VALUE"],
  ["inventory-tracker", "inventory_tracker_update", "INVENTORY_VALUE"],
];

const cases: RegressionCase[] = [
  {
    name: "no built-in tracker request carries a marked internal, in any block",
    async run() {
      for (const [type, resultType, ownValue] of BUILT_IN_TRACKERS) {
        const capture = makeCapturingProvider(`{}`);
        await executeAgent(tracker(type, resultType) as any, canaryContext(), capture.provider as any, "m");
        const text = requestText(capture.calls);
        assert.match(text, /<current_game_state>/u, `${type}: current state present`);
        assert.match(text, /<committed_tracker_state>/u, `${type}: history copy present`);
        assert.match(text, new RegExp(ownValue, "u"), `${type}: own section present`);
        if (type === "character-tracker") assert.match(text, /<character_tracker_history>[\s\S]*Old Tobin/u);
        assertNoCanary(text, type);
      }
    },
  },
  {
    name: "a mixed batch sends the union, labels each agent's keys and leaks nothing",
    async run() {
      const capture = makeCapturingProvider(`{}`);
      await executeAgentBatch(
        [
          tracker("character-tracker", "character_tracker_update"),
          customAgent("scene-reader", { trackerDataSections: ["scene"] }),
          tracker("background", "background_change"),
        ] as any,
        canaryContext(),
        capture.provider as any,
        "m",
      );
      const text = requestText(capture.calls);
      assertNoCanary(text, "mixed batch");
      assert.match(text, /Your tracker data in <current_game_state>: date, time, location, weather, temperature\./u);
      assert.match(
        text,
        /Your tracker data in <current_game_state>: date, time, location, weather, temperature, presentCharacters\./u,
      );
      // background has All sections, so the union includes the world and persona.
      assert.match(text, /WORLD_VALUE/u);
      assert.doesNotMatch(text, /QUEST_VALUE/u);
    },
  },
  {
    name: "a custom agent's picked sections shrink the current state and the history copies",
    async run() {
      const capture = makeCapturingProvider(`{}`);
      await executeAgent(
        customAgent("scene-only", { trackerDataSections: ["scene"] }) as any,
        canaryContext(),
        capture.provider as any,
        "m",
      );
      const text = requestText(capture.calls);
      assert.deepEqual(Object.keys(blockJson(text, "current_game_state")).sort(), [
        "date",
        "location",
        "temperature",
        "time",
        "weather",
      ]);
      assert.deepEqual(Object.keys(blockJson(text, "committed_tracker_state")), ["scene"]);
      assertNoCanary(text, "scene-only");

      const quests = makeCapturingProvider(`{}`);
      await executeAgent(
        customAgent("quest-reader", { trackerDataSections: ["quests"] }) as any,
        canaryContext(),
        quests.provider as any,
        "m",
      );
      const questText = requestText(quests.calls);
      assert.deepEqual(blockJson(questText, "current_game_state").playerStats.activeQuests[0].name, "QUEST_VALUE");
      assert.equal(blockJson(questText, "committed_tracker_state").playerStats.activeQuests[0].name, "QUEST_VALUE");
      assert.doesNotMatch(questText, /"date"/u);

      // No pick means All sections, exactly as before #9745 (no quests).
      const all = makeCapturingProvider(`{}`);
      await executeAgent(customAgent("all-reader", {}) as any, canaryContext(), all.provider as any, "m");
      const allState = blockJson(requestText(all.calls), "current_game_state");
      assert.equal(allState.worldCustomFields[0].value, "WORLD_VALUE");
      assert.equal("activeQuests" in allState.playerStats, false);
    },
  },
  {
    name: "an agent with Tracker Data off does not widen its batch",
    async run() {
      const capture = makeCapturingProvider(`{}`);
      await executeAgentBatch(
        [
          tracker("character-tracker", "character_tracker_update"),
          customAgent("no-tracker", { contextSources: { chatHistory: true, trackerData: false } }),
        ] as any,
        canaryContext(),
        capture.provider as any,
        "m",
      );
      const state = blockJson(requestText(capture.calls), "current_game_state");
      assert.deepEqual(Object.keys(state).sort(), [
        "date",
        "location",
        "presentCharacters",
        "temperature",
        "time",
        "weather",
      ]);
    },
  },
  {
    name: "previous CYOA choices reach only the CYOA agent, and never as an empty block",
    async run() {
      const trackerCapture = makeCapturingProvider(`{}`);
      await executeAgent(
        tracker("character-tracker", "character_tracker_update") as any,
        canaryContext(),
        trackerCapture.provider as any,
        "m",
      );
      assert.doesNotMatch(requestText(trackerCapture.calls), /previous_cyoa_choices/u);

      const cyoa = tracker("cyoa", "cyoa_choices");
      const cyoaCapture = makeCapturingProvider(`{}`);
      await executeAgent(cyoa as any, canaryContext(), cyoaCapture.provider as any, "m");
      assert.match(requestText(cyoaCapture.calls), /<previous_cyoa_choices>[\s\S]*CYOA_LAST_CHOICE/u);

      const emptyCapture = makeCapturingProvider(`{}`);
      await executeAgent(
        cyoa as any,
        canaryContext({ memory: { _lastCyoaChoices: [] } }),
        emptyCapture.provider as any,
        "m",
      );
      assert.doesNotMatch(requestText(emptyCapture.calls), /previous_cyoa_choices/u);
    },
  },
  {
    name: "the manual Illustrator prompt gets the compacted state and follows Tracker Data",
    async run() {
      const text = buildManualIllustratorPromptMessages({ context: canaryContext(), contextSize: 5 })
        .map((message) => (typeof message.content === "string" ? message.content : JSON.stringify(message.content)))
        .join("\n");
      assert.match(text, /<current_tracker_state>[\s\S]*CHARACTER_VALUE[\s\S]*<\/current_tracker_state>/u);
      assertNoCanary(text, "manual Illustrator");

      const off = buildManualIllustratorPromptMessages({
        context: canaryContext(),
        contextSize: 5,
        contextSources: {
          chatHistory: true,
          characters: true,
          persona: true,
          activatedLorebookEntries: false,
          chatSummary: false,
          authorNotes: false,
          trackerData: false,
          recalledMemories: false,
          previousOutput: false,
          charactersPublicFace: false,
          personaPublicFace: false,
        },
      })
        .map((message) => String(message.content))
        .join("\n");
      assert.doesNotMatch(off, /<current_tracker_state>/u);
    },
  },
  {
    name: "the Knowledge Router query carries the scene but no internals",
    async run() {
      const query = buildKnowledgeRouterQuery(canaryContext());
      assert.match(query, /North Gate/u);
      assert.match(query, /QUEST_VALUE/u);
      assertNoCanary(query, "Knowledge Router query");
    },
  },
];

await runNamedCases(cases);
