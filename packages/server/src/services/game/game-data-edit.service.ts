// ──────────────────────────────────────────────
// Game data edits (#7743): checks a State Editor hand edit of the game's own
// chat-metadata keys before it is written. Each allow-listed key has its own
// check; names can't change, because cards, NPCs, the party, live sheets and
// bags all find each other by name.
// ──────────────────────────────────────────────
import { isDeepStrictEqual } from "node:util";
import {
  normalizeCharacterLookupName,
  readRulesetSheetEnvelope,
  type GameDataEditableKey,
  type GameDataEditIssue,
  type GameDataEditRequest,
  type RulesetDefinition,
} from "@marinara-engine/shared";
import { buildPartyNpcId } from "../generation/game-party-utils.js";

/** The largest value one key may save: generous for real games, small enough to refuse a paste accident. */
export const GAME_DATA_EDIT_MAX_BYTES = 256 * 1024;

const NAME_MAX = 200;
const TEXT_MAX = 20_000;
const SHORT_TEXT_MAX = 2_000;
const LIST_MAX = 200;
const PLAYER_NOTES_MAX = 10_000;

const JOURNAL_ENTRY_TYPES = new Set(["location", "npc", "combat", "quest", "item", "event", "note"]);
const QUEST_STATUSES = new Set(["active", "completed", "failed"]);
const SUMMARY_TEXT_FIELDS = ["summary", "resumePoint", "partyDynamics", "partyState"] as const;
const SUMMARY_LIST_FIELDS = ["keyDiscoveries", "characterMoments", "littleDetails", "npcUpdates"] as const;

type UnknownRecord = Record<string, unknown>;

/** Thrown inside a check to refuse the key; caught once per key. */
class Refusal extends Error {
  constructor(readonly issue: Omit<GameDataEditIssue, "key">) {
    super(issue.reason);
  }
}

const refuse = (issue: Omit<GameDataEditIssue, "key">): never => {
  throw new Refusal(issue);
};

const isRecord = (value: unknown): value is UnknownRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function record(value: unknown, path: string): UnknownRecord {
  return isRecord(value) ? value : refuse({ reason: "shape", path });
}

function list(value: unknown, path: string, max = LIST_MAX): unknown[] {
  if (!Array.isArray(value)) return refuse({ reason: "shape", path });
  if (value.length > max) refuse({ reason: "tooLong", path, max });
  return value;
}

function text(value: unknown, path: string, max = TEXT_MAX): string {
  if (typeof value !== "string") return refuse({ reason: "shape", path });
  if (value.length > max) refuse({ reason: "tooLong", path, max });
  return value;
}

/** An optional text field: absent stays absent, anything else must be text. */
function optionalText(value: unknown, path: string, max = TEXT_MAX): string | undefined {
  return value === undefined ? undefined : text(value, path, max);
}

function textList(value: unknown, path: string, itemMax = SHORT_TEXT_MAX): string[] {
  return list(value, path).map((item, index) => text(item, `${path}.${index}`, itemMax));
}

function name(value: unknown, path: string): string {
  const named = text(value, path, NAME_MAX);
  if (!named.trim()) refuse({ reason: "shape", path });
  return named;
}

const lookupName = (value: unknown) => (typeof value === "string" ? normalizeCharacterLookupName(value) : "");

/** The same names, in any order: a rename and an added or removed entry refused apart. */
function requireSameNames(next: string[], current: string[], path: string) {
  const sorted = (names: string[]) => names.map(lookupName).sort();
  const [left, right] = [sorted(next), sorted(current)];
  if (isDeepStrictEqual(left, right)) return;
  if (left.length !== right.length) refuse({ reason: "partyChanged", path });
  const renamed = next.find((item) => !right.includes(lookupName(item)));
  refuse({ reason: "rename", path, ...(renamed ? { name: renamed } : {}) });
}

const currentList = (value: unknown): UnknownRecord[] => (Array.isArray(value) ? value.filter(isRecord) : []);

/** Same value once both have been through JSON, so `undefined` and a missing key read as null. */
export function sameGameDataValue(left: unknown, right: unknown): boolean {
  const plain = (value: unknown) => (value === undefined ? null : JSON.parse(JSON.stringify(value)));
  return isDeepStrictEqual(plain(left), plain(right));
}

interface CheckContext {
  current: unknown;
  /** The party's member ids: an NPC who joined it is `npc:<name>` there and found in gameNpcs by name. */
  partyIds: readonly unknown[];
  /** The game's ruleset, when it has one that loads: party card sheets are read through it. */
  ruleset: RulesetDefinition | null;
}

function checkCharacterCards(value: unknown, { current, ruleset }: CheckContext): unknown {
  const cards = list(value, "").map((card, index) => ({ ...record(card, String(index)) }));
  const names = cards.map((card, index) => name(card.name, `${index}.name`));
  const before = currentList(current);
  requireSameNames(
    names,
    before.map((card) => String(card.name ?? "")),
    "",
  );
  return cards.map((card, index) => {
    for (const field of ["shortDescription", "class"] as const) optionalText(card[field], `${index}.${field}`);
    for (const field of ["abilities", "strengths", "weaknesses"] as const) {
      if (card[field] !== undefined) textList(card[field], `${index}.${field}`);
    }
    if (card.extra !== undefined) {
      const extra = record(card.extra, `${index}.extra`);
      for (const [field, item] of Object.entries(extra)) text(item, `${index}.extra.${field}`);
    }
    // A sheet left as it was needs no ruleset to stay; a changed one is read through it.
    const was = before.find((item) => lookupName(item.name) === lookupName(card.name))?.rulesetSheet;
    if (card.rulesetSheet == null) {
      // Without its sheet a character starts over from a blank one on the next turn.
      if (was != null) refuse({ reason: "sheetRemoved", path: `${index}.rulesetSheet`, name: names[index] });
      return card;
    }
    if (sameGameDataValue(card.rulesetSheet, was)) return card;
    if (!ruleset) return refuse({ reason: "noRuleset", path: `${index}.rulesetSheet`, name: names[index] });
    const envelope = readRulesetSheetEnvelope(ruleset, card.rulesetSheet);
    if (!envelope) return refuse({ reason: "sheet", path: `${index}.rulesetSheet`, name: names[index] });
    return { ...card, rulesetSheet: envelope };
  });
}

function checkNpcs(value: unknown, { current, partyIds }: CheckContext): unknown {
  const before = currentList(current);
  const seen = new Set<string>();
  const npcs = list(value, "", 1_000).map((item, index) => {
    const npc = { ...record(item, String(index)) };
    const id = text(npc.id, `${index}.id`, NAME_MAX);
    if (!id.trim()) refuse({ reason: "shape", path: `${index}.id` });
    if (seen.has(id)) refuse({ reason: "duplicateId", path: `${index}.id` });
    seen.add(id);
    const npcName = name(npc.name, `${index}.name`);
    // Reputation, avatars and journal lines find an NPC by id or by name, so neither may move.
    const sameId = before.find((was) => was.id === id);
    if (sameId && lookupName(sameId.name) !== lookupName(npcName)) {
      refuse({ reason: "rename", path: `${index}.name`, name: String(sameId.name ?? npcName) });
    }
    if (!sameId && before.some((was) => lookupName(was.name) === lookupName(npcName))) {
      refuse({ reason: "idChanged", path: `${index}.id`, name: npcName });
    }
    for (const field of ["emoji", "description", "location"] as const) {
      npc[field] = optionalText(npc[field], `${index}.${field}`) ?? "";
    }
    npc.notes = npc.notes === undefined ? [] : textList(npc.notes, `${index}.notes`);
    const reputation = npc.reputation ?? 0;
    if (typeof reputation !== "number" || !Number.isFinite(reputation)) {
      refuse({ reason: "shape", path: `${index}.reputation` });
    }
    npc.reputation = Math.round(Math.min(100, Math.max(-100, reputation as number)));
    return npc;
  });
  // An NPC who joined the party stays: the party finds them here by name.
  const gone = before.find(
    (was) => !seen.has(String(was.id)) && partyIds.includes(buildPartyNpcId(String(was.name ?? ""))),
  );
  if (gone) refuse({ reason: "partyChanged", path: "", name: String(gone.name) });
  return npcs;
}

function checkJournal(value: unknown): unknown {
  const journal = { ...record(value, "") };
  journal.entries = list(journal.entries ?? [], "entries", 5_000).map((item, index) => {
    const entry = record(item, `entries.${index}`);
    if (typeof entry.type !== "string" || !JOURNAL_ENTRY_TYPES.has(entry.type)) {
      refuse({ reason: "shape", path: `entries.${index}.type` });
    }
    text(entry.title, `entries.${index}.title`, SHORT_TEXT_MAX);
    text(entry.content, `entries.${index}.content`);
    return entry;
  });
  journal.quests = list(journal.quests ?? [], "quests", 1_000).map((item, index) => {
    const quest = record(item, `quests.${index}`);
    text(quest.id, `quests.${index}.id`, NAME_MAX);
    name(quest.name, `quests.${index}.name`);
    if (typeof quest.status !== "string" || !QUEST_STATUSES.has(quest.status)) {
      refuse({ reason: "shape", path: `quests.${index}.status` });
    }
    text(quest.description ?? "", `quests.${index}.description`);
    if (quest.objectives !== undefined) textList(quest.objectives, `quests.${index}.objectives`);
    return quest;
  });
  journal.locations = textList(journal.locations ?? [], "locations");
  journal.npcLog = list(journal.npcLog ?? [], "npcLog", 1_000).map((item, index) => {
    const line = record(item, `npcLog.${index}`);
    text(line.npcName, `npcLog.${index}.npcName`, NAME_MAX);
    textList(line.interactions ?? [], `npcLog.${index}.interactions`);
    return line;
  });
  journal.inventoryLog = list(journal.inventoryLog ?? [], "inventoryLog", 5_000).map((item, index) =>
    record(item, `inventoryLog.${index}`),
  );
  return journal;
}

function checkPartyArcs(value: unknown, { current }: CheckContext): unknown {
  const arcs = list(value, "").map((item, index) => ({ ...record(item, String(index)) }));
  const names = arcs.map((arc, index) => name(arc.name, `${index}.name`));
  requireSameNames(
    names,
    currentList(current).map((arc) => String(arc.name ?? "")),
    "",
  );
  return arcs.map((arc, index) => {
    text(arc.arc, `${index}.arc`, SHORT_TEXT_MAX);
    text(arc.goal ?? "", `${index}.goal`, SHORT_TEXT_MAX);
    optionalText(arc.resolution, `${index}.resolution`, SHORT_TEXT_MAX);
    if (arc.completed !== undefined && typeof arc.completed !== "boolean") {
      refuse({ reason: "shape", path: `${index}.completed` });
    }
    return arc;
  });
}

/** Only the words of a summary change: its number, time and stats snapshot stay as the session left them. */
function checkSessionSummaries(value: unknown, { current }: CheckContext): unknown {
  const before = currentList(current);
  const summaries = list(value, "", 1_000).map((item, index) => ({ ...record(item, String(index)) }));
  if (summaries.length !== before.length) refuse({ reason: "sessionsChanged", path: "" });
  return summaries.map((summary, index) => {
    const was = before[index]!;
    const words = [...SUMMARY_TEXT_FIELDS, ...SUMMARY_LIST_FIELDS, "nextSessionRequest"];
    const rest = (entry: UnknownRecord) =>
      Object.fromEntries(Object.entries(entry).filter(([field]) => !words.includes(field)));
    if (!sameGameDataValue(rest(summary), rest(was))) refuse({ reason: "sessionsChanged", path: String(index) });
    for (const field of SUMMARY_TEXT_FIELDS) text(summary[field] ?? "", `${index}.${field}`);
    if (!String(summary.summary ?? "").trim()) refuse({ reason: "emptySummary", path: `${index}.summary` });
    for (const field of SUMMARY_LIST_FIELDS) textList(summary[field] ?? [], `${index}.${field}`);
    if (summary.nextSessionRequest != null) text(summary.nextSessionRequest, `${index}.nextSessionRequest`);
    return summary;
  });
}

const CHECKS: Record<GameDataEditableKey, (value: unknown, context: CheckContext) => unknown> = {
  gameCharacterCards: checkCharacterCards,
  gameNpcs: checkNpcs,
  gameJournal: checkJournal,
  gamePlayerNotes: (value) => text(value, "", PLAYER_NOTES_MAX),
  gameWorldOverview: (value) => text(value, ""),
  // The story arc is cleared (null) between campaigns, so clearing it by hand is fine too.
  gameStoryArc: (value) => (value === null ? null : text(value, "")),
  gamePlotTwists: (value) => textList(value, "", SHORT_TEXT_MAX),
  gamePartyArcs: checkPartyArcs,
  gamePreviousSessionSummaries: checkSessionSummaries,
};

/**
 * The metadata patch a set of hand edits makes, checked against `fresh` (the metadata as it is
 * inside the write queue). Any key changed since the editor opened it refuses the whole save as
 * stale, so nothing lands half-checked; otherwise every key is checked and any refusal refuses all.
 */
export function buildGameDataEditPatch(
  fresh: UnknownRecord,
  edits: GameDataEditRequest["edits"],
  ruleset: RulesetDefinition | null,
): { patch: UnknownRecord } | { issues: GameDataEditIssue[] } {
  const stale = edits
    .filter((edit) => !sameGameDataValue(edit.expected, fresh[edit.key]))
    .map((edit): GameDataEditIssue => ({ key: edit.key, reason: "stale" }));
  if (stale.length > 0) return { issues: stale };

  const patch: UnknownRecord = {};
  const issues: GameDataEditIssue[] = [];
  for (const edit of edits) {
    try {
      if (new TextEncoder().encode(JSON.stringify(edit.value ?? null)).length > GAME_DATA_EDIT_MAX_BYTES) {
        refuse({ reason: "tooLarge", max: GAME_DATA_EDIT_MAX_BYTES });
      }
      const partyIds = Array.isArray(fresh.gamePartyCharacterIds) ? fresh.gamePartyCharacterIds : [];
      patch[edit.key] = CHECKS[edit.key](edit.value, { current: fresh[edit.key], partyIds, ruleset });
    } catch (error) {
      if (!(error instanceof Refusal)) throw error;
      issues.push({ key: edit.key, ...error.issue });
    }
  }
  return issues.length > 0 ? { issues } : { patch };
}
