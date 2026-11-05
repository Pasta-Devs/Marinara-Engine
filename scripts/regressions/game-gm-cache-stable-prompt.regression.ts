import assert from "node:assert/strict";
import {
  buildGmFormatReminder,
  buildGmSceneState,
  buildGmSystemPrompt,
} from "../../packages/server/src/services/game/gm-prompts.js";

// A long Game session resent its whole history every turn at full price. Providers only reuse
// a cached prompt up to its first changed byte, and the GM system prompt sits before the history,
// so a weather shift, a morale change, a map move or an NPC note rewrote the start of the prompt
// and missed the cache for everything after it. The changing state now rides the turn reminder,
// after the history. These checks pin that the system prompt stays byte-identical while the
// state changes, and that the state still reaches the model between the history and the format.

type SystemContext = Parameters<typeof buildGmSystemPrompt>[0];
type ReminderContext = Parameters<typeof buildGmFormatReminder>[0];

const map = {
  name: "Saltmere",
  description: "A rain-soaked port town",
  type: "node",
  nodes: [
    { id: "docks", label: "The Docks", description: "Wet planks", discovered: true, x: 0, y: 0 },
    { id: "lighthouse", label: "Old Lighthouse", description: "Dark tower", discovered: true, x: 1, y: 0 },
    { id: "market", label: "Fish Market", description: "Stalls", discovered: true, x: 2, y: 0 },
  ],
  edges: [
    { from: "docks", to: "lighthouse" },
    { from: "docks", to: "market" },
  ],
  partyPosition: "docks",
};

const base = {
  gameActiveState: "exploration",
  storyArc: "The harbourmaster sells smuggled relics.",
  plotTwists: ["The lighthouse keeper is the buyer."],
  map,
  npcs: [
    {
      id: "mira",
      name: "Mira",
      emoji: "",
      description: "a fence",
      location: "The Docks",
      reputation: 10,
      notes: ["owes the party 20 gold"],
    },
  ],
  sessionSummaries: [],
  sessionNumber: 2,
  partyNames: ["Ari"],
  partyCards: [{ name: "Ari", card: "Name: Ari\nDescription: a ranger" }],
  playerName: "Pat",
  playerCard: "Name: Pat",
  gmCharacterCard: null,
  difficulty: "normal",
  combatStyle: "tactical",
  genre: "fantasy",
  setting: "original",
  tone: "balanced",
  rating: "sfw",
  weatherContext: "Current weather: clear, 15°C",
  perceptionHints: "<passive_perception>\n• The player hears gulls\n</passive_perception>",
  moraleContext: "<party_morale>\nMorale: steady (50/100)\n</party_morale>",
  playerNotes: "Mira knows something.",
  playerMoved: true,
  turnNumber: 4,
} as unknown as SystemContext;

const changed = {
  ...base,
  gameActiveState: "combat",
  weatherContext: "Current weather: heavy rain, 9°C",
  perceptionHints: "<passive_perception>\n• The player smells smoke\n</passive_perception>",
  moraleContext: "<party_morale>\nMorale: low (20/100)\n</party_morale>",
  playerNotes: "Mira lied about the ledger.",
  playerMoved: false,
  turnNumber: 5,
  map: { ...map, partyPosition: "lighthouse" },
  npcs: [
    {
      ...base.npcs[0]!,
      location: "Old Lighthouse",
      reputation: -20,
      notes: ["owes the party 20 gold", "fled the guard"],
    },
  ],
  tacticalBattlefieldContext: "Board: lighthouse stairs, 6x8",
  encounterHint: "Two smugglers wait on the stairs.",
  combatResults: "Ari hits for 7.",
} as unknown as SystemContext;

// The system prompt does not move when the scene does.
assert.equal(
  buildGmSystemPrompt(changed),
  buildGmSystemPrompt(base),
  "weather, perception, morale, notes, map, NPCs and the tactical board must not change the system prompt",
);
const system = buildGmSystemPrompt(changed);
for (const tag of [
  "<weather_update>",
  "<passive_perception>",
  "<party_morale>",
  "<player_notes>",
  "<map_state>",
  "<tracked_npcs>",
  "<tactical_battlefield>",
  "<encounter_triggered>",
  "<combat_results>",
]) {
  assert.ok(!system.includes(tag), `${tag} must not be in the system prompt`);
}
// What does not change turn to turn stays where it was.
assert.match(system, /<story_arc_secret>/);
assert.match(system, /<plot_twists_secret>/);
assert.match(system, /<party>/);

// The state still reaches the model, after <current_state> and before the format instructions.
const state = buildGmSceneState(changed);
for (const text of [
  "heavy rain, 9°C",
  "The player smells smoke",
  "Morale: low (20/100)",
  "Mira lied about the ledger.",
  "Current: Old Lighthouse",
  "fled the guard",
  "Board: lighthouse stairs, 6x8",
  "Two smugglers wait on the stairs.",
  "Ari hits for 7.",
]) {
  assert.ok(state.includes(text), `scene state must carry "${text}"`);
}
const reminder = buildGmFormatReminder({
  hasSceneModel: false,
  turnNumber: 5,
  gameActiveState: "combat",
  sessionNumber: 2,
  map: changed.map,
  sceneState: state,
} as ReminderContext);
const currentAt = reminder.indexOf("</current_state>");
const stateAt = reminder.indexOf("<weather_update>");
const formatAt = reminder.indexOf("<output_format>");
assert.ok(currentAt >= 0 && stateAt > currentAt, "the scene state follows <current_state>");
assert.ok(formatAt > stateAt, "the scene state comes before the format instructions");
assert.ok(reminder.includes("<tracked_npcs>") && reminder.includes("<map_state>"));

// The map's discovered places are listed on a move and left out otherwise, as before.
assert.match(buildGmSceneState(base), /Discovered: /);
assert.doesNotMatch(buildGmSceneState({ ...base, playerMoved: false, turnNumber: 5 }), /Discovered: /);

// No state, no empty lines: a reminder without scene state is byte-identical to one built before.
assert.equal(
  buildGmFormatReminder({ hasSceneModel: false, turnNumber: 1, sceneState: "" } as ReminderContext),
  buildGmFormatReminder({ hasSceneModel: false, turnNumber: 1 } as ReminderContext),
);

console.log("game-gm-cache-stable-prompt regression passed");
