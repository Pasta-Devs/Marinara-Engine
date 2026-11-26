// ── Tracker state in agent prompts (#9555, #9745) ──
// Every agent-facing copy of the tracker state is built here, from one compaction and one row
// allowlist: <current_game_state>, the per-turn <committed_tracker_state> summaries, the Character
// Tracker's <character_tracker_history>, the manual Illustrator's <current_tracker_state> and the
// Knowledge Router's search query. Before #9745 each was built in its own place and two of them sent
// the raw stored row (ids, avatar paths, crops, manual overrides, ruleset internals).
//
// The JSON shape and key names stay as stored: tracker package prompts name paths such as
// `playerStats.customTrackerFields`, so keys may be filtered but never renamed.
import {
  AGENT_TRACKER_DATA_SECTIONS,
  characterTrackerLockKey,
  compactQuestProgressForContext,
  getAgentContextSources,
  getAgentTrackerDataSections,
  isTrackerFieldHidden,
  normalizeTrackerHiddenFields,
  type AgentTrackerDataSection,
  type PresentCharacter,
  type TrackerHiddenFields,
} from "@marinara-engine/shared";
import { isRecord } from "../../utils/large-json.js";

/** The user-facing sections plus `legacyPlayer`, Game Mode's old player sheet, which only "All sections" sends. */
export type GameStateContextSection = AgentTrackerDataSection | "legacyPlayer";
export type TrackerContextSections = ReadonlySet<GameStateContextSection>;

const GAME_STATE_TOP_LEVEL_SECTIONS: Record<string, GameStateContextSection> = {
  date: "scene",
  time: "scene",
  location: "scene",
  weather: "scene",
  temperature: "scene",
  worldCustomFields: "world",
  recentEvents: "world",
  presentCharacters: "characters",
  personaStats: "persona",
};

const PLAYER_STATS_SECTIONS: Record<string, GameStateContextSection> = {
  status: "persona",
  activeQuests: "quests",
  customTrackerFields: "customFields",
  inventoryTrackerCurrencies: "inventory",
  inventoryTrackerEquipped: "inventory",
  inventoryTrackerInventory: "inventory",
  stats: "legacyPlayer",
  attributes: "legacyPlayer",
  skills: "legacyPlayer",
  inventory: "legacyPlayer",
};

/** Lock key roots per section; a key matches its root exactly or as `<root>.…`. */
const SECTION_LOCK_ROOTS: Record<GameStateContextSection, readonly string[]> = {
  scene: [],
  world: ["world"],
  characters: ["characters"],
  persona: ["persona"],
  quests: ["quests"],
  customFields: ["player.custom"],
  inventory: ["player.inventoryTracker"],
  legacyPlayer: ["player.inventory"],
};

/** Each built-in tracker sees its own section and the scene line (date, time, location, weather, temperature). */
const TRACKER_CONTEXT_SECTIONS: Record<string, readonly GameStateContextSection[]> = {
  "world-state": ["scene", "world"],
  "character-tracker": ["scene", "characters"],
  "persona-stats": ["scene", "persona"],
  quest: ["scene", "quests"],
  "custom-tracker": ["scene", "customFields"],
  "inventory-tracker": ["scene", "inventory"],
};

/** "All sections": every other agent sees everything but quest progress (unchanged since #9559). */
const ALL_SECTIONS_CONTEXT: readonly GameStateContextSection[] = [
  "scene",
  "world",
  "characters",
  "persona",
  "customFields",
  "inventory",
  "legacyPlayer",
];

/** Everything, quests included: for consumers that are not an agent prompt (the Knowledge Router query). */
export const EVERY_TRACKER_CONTEXT_SECTION: TrackerContextSections = new Set<GameStateContextSection>([
  ...AGENT_TRACKER_DATA_SECTIONS,
  "legacyPlayer",
]);

export function isBuiltInTrackerAgentType(type: string): boolean {
  return Object.hasOwn(TRACKER_CONTEXT_SECTIONS, type);
}

function sectionsForType(type: string): readonly GameStateContextSection[] {
  return Object.hasOwn(TRACKER_CONTEXT_SECTIONS, type) ? TRACKER_CONTEXT_SECTIONS[type]! : ALL_SECTIONS_CONTEXT;
}

/** Sections by agent type alone (built-in map, else All sections); for callers without agent settings. */
export function trackerSectionsForAgentTypes(agentTypes: readonly string[]): TrackerContextSections {
  const sections = new Set<GameStateContextSection>();
  for (const type of agentTypes) for (const section of sectionsForType(type)) sections.add(section);
  return sections;
}

export interface TrackerContextAgent {
  type: string;
  isCustomAgent?: boolean;
  settings: unknown;
}

/**
 * One agent's sections: empty when its Tracker Data source is off; a built-in tracker's fixed map;
 * otherwise the sections it picked, or All sections.
 */
export function resolveAgentTrackerSections(agent: TrackerContextAgent): TrackerContextSections {
  if (!getAgentContextSources(agent).trackerData) return new Set();
  if (isBuiltInTrackerAgentType(agent.type)) return new Set(TRACKER_CONTEXT_SECTIONS[agent.type]);
  const picked = getAgentTrackerDataSections(agent.settings);
  return new Set(picked ?? ALL_SECTIONS_CONTEXT);
}

/** A batch sends one block, so it carries the union of its members' sections. */
export function trackerSectionsForAgents(agents: readonly TrackerContextAgent[]): TrackerContextSections {
  const sections = new Set<GameStateContextSection>();
  for (const agent of agents) for (const section of resolveAgentTrackerSections(agent)) sections.add(section);
  return sections;
}

function toSections(scope: TrackerContextSections | readonly string[]): TrackerContextSections {
  return Array.isArray(scope) ? trackerSectionsForAgentTypes(scope) : (scope as TrackerContextSections);
}

/**
 * The character-row fields an agent may read. An allowlist, so a field added to the row for the
 * server or the UI (avatar path, crop, portrait framing, id aliases) stays out until listed here.
 */
const CHARACTER_ROW_CONTEXT_FIELDS = [
  "characterId",
  "name",
  "emoji",
  "mood",
  "action",
  "appearance",
  "outfit",
  "thoughts",
  "customFields",
  "stats",
] as const;

function allowlistCharacterRowsForContext(presentCharacters: unknown): unknown {
  if (!Array.isArray(presentCharacters)) return presentCharacters;
  return presentCharacters.filter(isRecord).map((character) => {
    const row: Record<string, unknown> = {};
    for (const field of CHARACTER_ROW_CONTEXT_FIELDS) {
      if (character[field] !== undefined) row[field] = character[field];
    }
    return row;
  });
}

function filterPlayerStatsForContext(
  playerStats: unknown,
  sections: TrackerContextSections,
): Record<string, unknown> | undefined {
  if (!isRecord(playerStats)) return undefined;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(playerStats)) {
    const section = PLAYER_STATS_SECTIONS[key];
    if (!section || !sections.has(section)) continue;
    next[key] = key === "activeQuests" ? compactQuestProgressForContext(value) : value;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function filterFieldLocksForContext(
  fieldLocks: unknown,
  sections: TrackerContextSections,
): Record<string, unknown> | undefined {
  if (!isRecord(fieldLocks)) return undefined;
  const roots = [...sections].flatMap((section) => SECTION_LOCK_ROOTS[section]);
  const next = Object.fromEntries(
    Object.entries(fieldLocks).filter(([key]) => roots.some((root) => key === root || key.startsWith(`${root}.`))),
  );
  return Object.keys(next).length > 0 ? next : undefined;
}

const HIDEABLE_CHARACTER_TRACKER_FIELDS = ["mood", "appearance", "outfit", "thoughts"] as const;

function compactPresentCharactersForHiddenFields(
  presentCharacters: unknown,
  hiddenFields: TrackerHiddenFields,
): unknown {
  if (!Array.isArray(presentCharacters) || Object.keys(hiddenFields).length === 0) return presentCharacters;

  let changed = false;
  const compacted = presentCharacters.map((character, index) => {
    if (!isRecord(character)) return character;
    let next: Record<string, unknown> | null = null;

    for (const field of HIDEABLE_CHARACTER_TRACKER_FIELDS) {
      const key = characterTrackerLockKey(character as Pick<PresentCharacter, "characterId" | "name">, index, field);
      if (field in character && isTrackerFieldHidden(hiddenFields, key)) {
        next ??= { ...character };
        delete next[field];
        changed = true;
      }
    }

    return next ?? character;
  });

  return changed ? compacted : presentCharacters;
}

function omitHiddenFieldLocksForContext(fieldLocks: unknown, hiddenFields: TrackerHiddenFields): unknown {
  if (!isRecord(fieldLocks) || Object.keys(hiddenFields).length === 0) return fieldLocks;

  let changed = false;
  const nextEntries = Object.entries(fieldLocks).filter(([key]) => {
    const keep = !isTrackerFieldHidden(hiddenFields, key);
    if (!keep) changed = true;
    return keep;
  });

  return changed ? Object.fromEntries(nextEntries) : fieldLocks;
}

/**
 * The tracker row as an agent may read it: only the given sections, hidden fields removed, and no
 * row metadata (ids, swipe, timestamps, manual overrides), hidden-field bookkeeping, Game Mode
 * ruleset state or unmapped key. `scope` is a resolved section set, or agent types (built-in map).
 */
export function compactGameStateForAgentContext(
  gameState: unknown,
  scope: TrackerContextSections | readonly string[],
): unknown {
  if (!isRecord(gameState)) {
    return gameState;
  }

  const sections = toSections(scope);
  const hiddenFields = normalizeTrackerHiddenFields(gameState.hiddenTrackerFields);

  const next: Record<string, unknown> = {};
  for (const [key, section] of Object.entries(GAME_STATE_TOP_LEVEL_SECTIONS)) {
    if (!sections.has(section) || gameState[key] === undefined) continue;
    next[key] = gameState[key];
  }
  if (next.presentCharacters !== undefined) {
    // Hidden fields first: their lock keys need the full row's characterId and name.
    next.presentCharacters = allowlistCharacterRowsForContext(
      compactPresentCharactersForHiddenFields(next.presentCharacters, hiddenFields),
    );
  }
  const playerStats = filterPlayerStatsForContext(gameState.playerStats, sections);
  if (playerStats) next.playerStats = playerStats;
  const fieldLocks = filterFieldLocksForContext(
    omitHiddenFieldLocksForContext(gameState.fieldLocks, hiddenFields),
    sections,
  );
  if (fieldLocks) next.fieldLocks = fieldLocks;
  return next;
}

/** `<current_game_state>` JSON, or null when the sections leave nothing to send. */
export function buildCurrentGameStateJson(gameState: unknown, sections: TrackerContextSections): string | null {
  if (!isRecord(gameState) || sections.size === 0) return null;
  const compacted = compactGameStateForAgentContext(gameState, sections);
  if (!isRecord(compacted) || Object.keys(compacted).length === 0) return null;
  return JSON.stringify(compacted);
}

/**
 * The per-turn `<committed_tracker_state>` summary: the same compaction, in the nested `scene`
 * shape history has always used. Null when nothing is left.
 */
export function buildCommittedTrackerSummary(
  gameState: unknown,
  sections: TrackerContextSections,
): Record<string, unknown> | null {
  if (!isRecord(gameState) || sections.size === 0) return null;
  const gs = compactGameStateForAgentContext(gameState, sections) as Record<string, unknown>;
  const summary: Record<string, unknown> = {};
  const scene: Record<string, unknown> = {};
  for (const key of ["date", "time", "location", "weather", "temperature"] as const) {
    if (gs[key]) scene[key] = gs[key];
  }
  if (Object.keys(scene).length > 0) summary.scene = scene;
  if (Array.isArray(gs.presentCharacters) && gs.presentCharacters.length)
    summary.presentCharacters = gs.presentCharacters;
  if (Array.isArray(gs.recentEvents) && gs.recentEvents.length) summary.recentEvents = gs.recentEvents;
  if (gs.playerStats) summary.playerStats = gs.playerStats;
  if (Array.isArray(gs.personaStats) && gs.personaStats.length) summary.personaStats = gs.personaStats;
  return Object.keys(summary).length > 0 ? summary : null;
}

/** `<character_tracker_history>` rows: the same row allowlist, with the current row's hidden fields applied. */
export function compactCharacterTrackerHistoryForContext(history: unknown, currentGameState: unknown): unknown {
  const hiddenFields = normalizeTrackerHiddenFields(
    isRecord(currentGameState) ? currentGameState.hiddenTrackerFields : undefined,
  );
  return allowlistCharacterRowsForContext(compactPresentCharactersForHiddenFields(history, hiddenFields));
}

const SECTION_KEY_PATHS: Record<GameStateContextSection, readonly string[]> = {
  scene: ["date", "time", "location", "weather", "temperature"],
  world: ["worldCustomFields", "recentEvents"],
  characters: ["presentCharacters"],
  persona: ["personaStats", "playerStats.status"],
  quests: ["playerStats.activeQuests"],
  customFields: ["playerStats.customTrackerFields"],
  inventory: [
    "playerStats.inventoryTrackerCurrencies",
    "playerStats.inventoryTrackerEquipped",
    "playerStats.inventoryTrackerInventory",
  ],
  legacyPlayer: ["playerStats.stats", "playerStats.attributes", "playerStats.skills", "playerStats.inventory"],
};

/**
 * One line for an `<agent_task>` in a batch, naming the keys of the shared `<current_game_state>`
 * that belong to this agent. The block is shared (one model call reads everything); the line only
 * says which part is whose.
 */
export function buildAgentTrackerKeysLine(agent: TrackerContextAgent): string | null {
  const sections = resolveAgentTrackerSections(agent);
  if (sections.size === 0) return null;
  // Game Mode's legacy player sheet rides along with All sections but is not worth naming.
  const paths = AGENT_TRACKER_DATA_SECTIONS.filter((s) => sections.has(s)).flatMap((s) => SECTION_KEY_PATHS[s]);
  return `Your tracker data in <current_game_state>: ${paths.join(", ")}.`;
}
