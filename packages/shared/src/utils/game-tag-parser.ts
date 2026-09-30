// ──────────────────────────────────────────────
// Game: GM Tag Parser
//
// Extracts [music:], [sfx:], [bg:], [ambient:],
// [choices:], [qte:], [reputation:], [state:],
// [direction:], [widget:], and other command tags
// from GM narration output.
// Returns clean content + extracted commands.
// ──────────────────────────────────────────────

import { parseSkillCheckTagBody, readGmTagAttributes, type SkillCheckTag } from "./skill-check-tag.js";
import {
  stripUnknownBracketTags,
  stripBalancedTag,
  stripMapUpdateTag,
  stripDanglingTagClosers,
  stripEngineResultBlocks,
} from "./game-narration-text.js";
import { stripGameBranchDelimiters } from "./dice-branch.js";
import { stripSheetCommandTags } from "./sheet-command-tag.js";
import { readResolvedInventoryTagBody, type ResolvedInventoryTag } from "./inventory-command-tag.js";
import type { DirectionCommand, DirectionEffect, WidgetUpdate } from "../types/game.js";

// The check-tag reader lives in shared so the server reads a GM tag exactly the
// way this parser does — including the d20 audit that decides whether the GM's
// own numbers are trustworthy.
export type { SkillCheckTag };
export { stripGmTagsKeepReadables } from "./game-narration-text.js";

export interface CombatEncounterTag {
  enemies: Array<{
    name: string;
    level: number;
    hp: number;
    attack: number;
    defense: number;
    speed: number;
    /** Element the enemy attacks with (for elemental reaction chains) */
    element?: string;
  }>;
  /**
   * Names of allies who should join the player side. `undefined` means the GM
   * used the legacy format, so the engine falls back to the configured party.
   * `null` means the GM explicitly requested no extra allies.
   */
  allies?: string[] | null;
}

export interface ElementAttackTag {
  /** Element used in the attack (e.g. "pyro", "ice", "lightning") */
  element: string;
  /** Target combatant name */
  target: string;
}

/** One item of an `[inventory:]` tag as the server resolved it. The server applies every tag when it
 *  saves the reply; the client only announces what the resolved tags say. */
export type InventoryTag = ResolvedInventoryTag;

export interface SegmentInventoryUpdate {
  segment: number;
  update: InventoryTag;
}

export interface PartyChangeTag {
  characterName: string;
  change: "add" | "remove";
}

export interface ReadableTag {
  type: "note" | "book";
  content: string;
}

export interface CombatStatusTag {
  target: string;
  effect: string;
  stat?: "attack" | "defense" | "speed" | "hp";
  modifier?: number;
  turns?: number;
}

export interface ParsedGmTags {
  /** Content with all command tags stripped. */
  cleanContent: string;
  /** Music tag to play, e.g. "music:combat:fantasy:intense:epic-battle" */
  music: string | null;
  /** One-shot SFX tags */
  sfx: string[];
  /** Background image tag */
  background: string | null;
  /** Ambient loop tag */
  ambient: string | null;
  /** Choices for player (VN-style cards) */
  choices: string[] | null;
  /** QTE actions + timer */
  qte: { actions: string[]; timer: number } | null;
  /** State transition command */
  stateChange: string | null;
  /** NPC reputation changes */
  reputationActions: Array<{ npcName: string; action: string }>;
  /** Combat encounter with enemy data */
  combatEncounter: CombatEncounterTag | null;
  /** Cinematic direction commands */
  directions: DirectionCommand[];
  /** Widget update commands */
  widgetUpdates: WidgetUpdate[];
  /** Skill check requests */
  skillChecks: SkillCheckTag[];
  /** Elemental attack triggers */
  elementAttacks: ElementAttackTag[];
  /** Combat-only status effect commands */
  combatStatuses: CombatStatusTag[];
  /** Inventory add/remove commands */
  inventoryUpdates: InventoryTag[];
  /** Characters joining or leaving the party */
  partyChanges: PartyChangeTag[];
  /** Note or book content for reading display */
  readables: ReadableTag[];
}

function parseQteMatch(match: { actions: string; timer: string }): { actions: string[]; timer: number } | null {
  const actions = match.actions
    .split("|")
    .map((action) => action.trim().replace(/^["']|["']$/g, ""))
    .filter((action) => action.length > 0);
  const timer = parseInt(match.timer, 10);
  return actions.length > 0 && !isNaN(timer) ? { actions, timer } : null;
}

/** Keep the legacy QTE grammar without retrying its body at every whitespace split or opener. */
function findQteTag(text: string) {
  const timers = [...text.matchAll(/,\s*timer:\s*(\d+)s?\]/gi)];
  const lineBreaks = [...text.matchAll(/[\r\n\u2028\u2029]/g)];
  let timerIndex = 0;
  let lineIndex = 0;
  for (const open of text.matchAll(/\[qte:/gi)) {
    const bodyStart = open.index + open[0].length;
    while (timers[timerIndex] && timers[timerIndex]!.index <= bodyStart) timerIndex++;
    const timer = timers[timerIndex];
    if (!timer) return null;
    // The legacy body is dot-matched: only its leading whitespace may contain line breaks.
    let firstText = bodyStart;
    while (firstText < timer.index && /\s/.test(text[firstText]!)) firstText++;
    while (lineBreaks[lineIndex] && lineBreaks[lineIndex]!.index < firstText) lineIndex++;
    if (lineBreaks[lineIndex] && lineBreaks[lineIndex]!.index < timer.index) continue;
    if (firstText === timer.index && /[\r\n\u2028\u2029]/.test(text[timer.index - 1]!)) continue;
    const actions = text.slice(bodyStart, timer.index);
    return { index: open.index, tag: text.slice(open.index, timer.index + timer[0].length), actions, timer: timer[1]! };
  }
  return null;
}

function parseTagAttributes(body: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const attribute of readGmTagAttributes(body)) {
    const key = attribute.key.trim().toLowerCase();
    const rawValue = attribute.rawValue.trim();
    if (!key || !rawValue) continue;
    values.set(key, rawValue.replace(/^['"]|['"]$/g, ""));
  }
  return values;
}

function parseCombatAllies(raw: string | undefined): string[] | null | undefined {
  if (raw == null) return undefined;
  const trimmed = raw.trim();
  if (!trimmed || /^(?:null|none|no\s+allies|solo)$/i.test(trimmed)) return null;

  const allies = trimmed
    .split(/[|,]/)
    .map((entry) => entry.trim().replace(/^["']|["']$/g, ""))
    .filter((entry) => entry && !/^(?:null|none|no\s+allies|solo)$/i.test(entry));

  return allies.length > 0 ? allies : null;
}

function parseCombatEncounter(body: string): CombatEncounterTag | null {
  const attributes = parseTagAttributes(body);
  const raw = attributes.get("enemies") ?? body;
  const enemyEntries = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const enemies: CombatEncounterTag["enemies"] = [];

  for (const entry of enemyEntries) {
    const parts = entry.split(":").map((part) => part.trim());
    if (parts.length >= 6) {
      enemies.push({
        name: parts[0]!,
        level: parseInt(parts[1]!, 10) || 1,
        hp: parseInt(parts[2]!, 10) || 30,
        attack: parseInt(parts[3]!, 10) || 8,
        defense: parseInt(parts[4]!, 10) || 5,
        speed: parseInt(parts[5]!, 10) || 5,
        element: parts[6] || undefined,
      });
    } else {
      const name = parts[0]!;
      const level = parts.length >= 2 ? parseInt(parts[1]!, 10) || 1 : 3;
      enemies.push({
        name,
        level,
        hp: 20 + level * 8,
        attack: 5 + level * 2,
        defense: 3 + level,
        speed: 3 + level,
      });
    }
  }

  if (enemies.length === 0) return null;

  const allies = parseCombatAllies(attributes.get("allies"));
  return allies === undefined ? { enemies } : { enemies, allies };
}

function splitQuotedParams(text: string): string[] {
  const parts: string[] = [];
  let current = "";
  let activeQuote: '"' | "'" | null = null;
  let escaped = false;

  for (const char of text) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }

    if ((char === '"' || char === "'") && (!activeQuote || activeQuote === char)) {
      activeQuote = activeQuote === char ? null : char;
      current += char;
      continue;
    }

    if (char === "," && !activeQuote) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

const VALID_COMBAT_STATUS_STATS = new Set<CombatStatusTag["stat"]>(["attack", "defense", "speed", "hp"]);

function parseCombatStatusTagBody(body: string): CombatStatusTag | null {
  const fields = new Map<string, string>();

  for (const part of splitQuotedParams(body)) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = part.slice(0, separatorIndex).trim().toLowerCase();
    const value = part
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^(["'])|(["'])$/g, "");
    if (!key || !value) continue;
    fields.set(key, value);
  }

  const target = fields.get("target")?.trim();
  const effect = (fields.get("effect") ?? fields.get("name"))?.trim();
  if (!target || !effect) return null;

  const rawStat = fields.get("stat")?.trim().toLowerCase();
  const stat =
    rawStat && VALID_COMBAT_STATUS_STATS.has(rawStat as CombatStatusTag["stat"])
      ? (rawStat as CombatStatusTag["stat"])
      : undefined;

  const modifierValue = fields.get("modifier");
  const parsedModifier = modifierValue != null ? Number(modifierValue) : undefined;
  const modifier = parsedModifier != null && Number.isFinite(parsedModifier) ? Math.trunc(parsedModifier) : undefined;

  const turnsValue = fields.get("turns") ?? fields.get("duration");
  const parsedTurns = turnsValue != null ? Number(turnsValue) : undefined;
  const turns =
    parsedTurns != null && Number.isFinite(parsedTurns) && parsedTurns > 0 ? Math.trunc(parsedTurns) : undefined;

  return {
    target,
    effect,
    stat,
    modifier,
    turns,
  };
}

/**
 * Extract all occurrences of a balanced bracket tag and return their inner
 * content (the part after the colon, trimmed).  Also returns the text with
 * all matched tags removed.  Handles nested `[]` inside the tag body.
 */
function extractBalancedTags(text: string, tagPrefix: string): { contents: string[]; remaining: string } {
  const lower = tagPrefix.toLowerCase();
  const prefixLen = tagPrefix.length;
  const contents: string[] = [];
  let remaining = text;
  let searchFrom = 0;
  while (true) {
    const idx = remaining.toLowerCase().indexOf(lower, searchFrom);
    if (idx === -1) break;
    let depth = 0;
    let end = -1;
    for (let i = idx; i < remaining.length; i++) {
      if (remaining[i] === "[") depth++;
      else if (remaining[i] === "]") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) {
      searchFrom = idx + 1;
      continue;
    }
    // inner = everything between "[tagPrefix:" and the balanced "]"
    const inner = remaining.slice(idx + prefixLen, end).trim();
    contents.push(inner);
    remaining = remaining.slice(0, idx) + remaining.slice(end + 1);
  }
  return { contents, remaining };
}

function parsePartyCharacterName(body: string): string {
  const quoted = /(?:character|name)\s*=\s*"([^"]+)"/i.exec(body);
  const unquoted = quoted ? null : /(?:character|name)\s*=\s*([^,\]]+)/i.exec(body);
  const rawName = quoted?.[1] ?? unquoted?.[1] ?? body;
  return rawName
    .replace(/\s+change\s*=\s*"?(?:add|remove)"?.*$/i, "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function parsePartyChangeTagBody(body: string, fallbackChange?: "add" | "remove"): PartyChangeTag | null {
  const changeMatch = /change\s*=\s*"?(add|remove)"?/i.exec(body);
  const change = (changeMatch?.[1]?.toLowerCase() as "add" | "remove" | undefined) ?? fallbackChange;
  if (!change) return null;
  const characterName = parsePartyCharacterName(body);
  return characterName ? { characterName, change } : null;
}

/** Match a legacy flat-tag body with one forward scan, including malformed input. */
function extractFlatTags(text: string, prefix: RegExp, firstOnly = false, allowEmpty = false) {
  const contents: string[] = [];
  const matches: Array<{ index: number; tag: string; body: string }> = [];
  const chunks: string[] = [];
  let from = 0;
  for (const tag of text.matchAll(prefix)) {
    const start = tag.index;
    if (start < from) continue;
    const bodyStart = start + tag[0].length;
    const end = text.indexOf("]", bodyStart);
    if (end === -1) break;
    if (end > bodyStart || allowEmpty) {
      const body = text.slice(bodyStart, end);
      contents.push(body.trim());
      matches.push({ index: start, tag: text.slice(start, end + 1), body });
      chunks.push(text.slice(from, start));
      from = end + 1;
      if (firstOnly) break;
    }
  }
  chunks.push(text.slice(from));
  return { contents, matches, remaining: chunks.join("") };
}

/**
 * Best-effort mapping of inventory tags to narration segment indices so item
 * gains/losses can land when the relevant beat is shown instead of at turn start.
 * Segment numbering mirrors GameNarration's parsing model closely enough for timing.
 */
export function parseSegmentInventoryUpdates(content: string): SegmentInventoryUpdate[] {
  let source = stripEngineResultBlocks(content);
  source = extractFlatTags(source, /\[music:/gi).remaining;
  source = extractFlatTags(source, /\[sfx:/gi).remaining;
  source = extractFlatTags(source, /\[bg:/gi).remaining;
  source = extractFlatTags(source, /\[ambient:/gi).remaining;
  source = extractFlatTags(source, /\[qte:/gi).remaining;
  source = extractFlatTags(source, /\[state:/gi).remaining;
  source = extractFlatTags(source, /\[reputation:/gi).remaining;
  source = extractFlatTags(source, /\[combat:/gi).remaining;
  source = extractFlatTags(source, /\[direction:/gi).remaining;
  source = extractFlatTags(source, /\[widget:/gi).remaining;
  source = source.replace(/\[dialogue:\s*npc="[^"]*"\]/gi, "");
  source = extractFlatTags(source, /\[session_end:/gi, false, true).remaining;
  source = extractFlatTags(source, /\[skill_check:/gi).remaining;
  source = extractFlatTags(source, /\[status:/gi).remaining;
  source = extractFlatTags(source, /\[element_attack:/gi).remaining;
  source = extractFlatTags(source, /\[party_change:/gi).remaining;
  source = extractFlatTags(source, /\[party_add:/gi).remaining;
  source = source.replace(/\[party-turn\]/gi, "");
  source = source.replace(/\[party-chat\]/gi, "");
  source = extractFlatTags(source, /\[dice:/gi).remaining;

  source = stripSheetCommandTags(source);
  source = stripMapUpdateTag(source);
  source = stripBalancedTag(source, "[choices:");

  const readableContents: Array<{ type: "note" | "book"; content: string }> = [];
  for (const tag of ["[Note:", "[Book:"] as const) {
    const rType = tag === "[Note:" ? "note" : "book";
    let searchFrom = 0;
    while (true) {
      const idx = source.toLowerCase().indexOf(tag.toLowerCase(), searchFrom);
      if (idx === -1) break;
      let depth = 0;
      let end = -1;
      for (let i = idx; i < source.length; i++) {
        if (source[i] === "[") depth++;
        else if (source[i] === "]") {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end === -1) {
        searchFrom = idx + 1;
        continue;
      }
      const inner = source.slice(idx + tag.length, end).trim();
      const placeholderIdx = readableContents.length;
      readableContents.push({ type: rType, content: inner });
      const placeholder = `__READABLE_${placeholderIdx}__`;
      source = source.slice(0, idx) + placeholder + source.slice(end + 1);
      searchFrom = idx + placeholder.length;
    }
  }

  const readablePlaceholderRe = /^__READABLE_(\d+)__$/;
  const narrationRegex = /^\s*Narration\s*:\s*(.+)$/i;
  const legacyDialogueRegex = /^\s*Dialogue\s*\[([^\]]+)\]\s*(?:\[([^\]]+)\])?\s*:\s*(.+)$/i;
  const compactDialogueRegex = /^\s*\[([^\]]+)\]\s*(?:\[([^\]]+)\])?\s*:\s*(.+)$/;
  const partyLineRegex =
    /^\s*\[([^\]]+)\]\s*\[(main|side|extra|action|thought|whisper(?::([^\]]+))?)\]\s*(?:\[([^\]]+)\])?\s*:\s*(.+)$/i;

  const updatesBySegment = new Map<number, InventoryTag[]>();
  const pendingForNextSegment: InventoryTag[] = [];
  let segmentCount = 0;
  let fallbackActive = false;

  const assignToSegment = (segment: number, update: InventoryTag) => {
    const existing = updatesBySegment.get(segment) ?? [];
    existing.push(update);
    updatesBySegment.set(segment, existing);
  };

  const queueUpdates = (updates: InventoryTag[], preferredSegment: number | null) => {
    if (updates.length === 0) return;
    if (preferredSegment != null && preferredSegment >= 0) {
      for (const update of updates) assignToSegment(preferredSegment, update);
      return;
    }
    pendingForNextSegment.push(...updates);
  };

  const claimPendingForSegment = (segment: number) => {
    if (pendingForNextSegment.length === 0) return;
    for (const update of pendingForNextSegment.splice(0, pendingForNextSegment.length)) {
      assignToSegment(segment, update);
    }
  };

  const lines = source.split(/\r?\n/);
  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) {
      if (fallbackActive) {
        segmentCount += 1;
        fallbackActive = false;
      }
      continue;
    }

    const inventoryUpdates: InventoryTag[] = [];
    const inventoryTags = extractFlatTags(line, /\[inventory:/gi);
    for (const { body } of inventoryTags.matches) {
      const update = readResolvedInventoryTagBody(body);
      if (update) inventoryUpdates.push(update);
    }
    line = inventoryTags.remaining.trim();

    if (!line) {
      const targetSegment = fallbackActive ? segmentCount : segmentCount > 0 ? segmentCount - 1 : null;
      queueUpdates(inventoryUpdates, targetSegment);
      continue;
    }

    const isStandaloneSegment =
      readablePlaceholderRe.test(line) ||
      partyLineRegex.test(line) ||
      narrationRegex.test(line) ||
      legacyDialogueRegex.test(line) ||
      compactDialogueRegex.test(line);

    if (isStandaloneSegment) {
      if (fallbackActive) {
        segmentCount += 1;
        fallbackActive = false;
      }
      claimPendingForSegment(segmentCount);
      for (const update of inventoryUpdates) assignToSegment(segmentCount, update);
      segmentCount += 1;
      continue;
    }

    claimPendingForSegment(segmentCount);
    for (const update of inventoryUpdates) assignToSegment(segmentCount, update);
    fallbackActive = true;
  }

  const trailingSegment = fallbackActive ? segmentCount : segmentCount > 0 ? segmentCount - 1 : 0;
  if (pendingForNextSegment.length > 0) {
    for (const update of pendingForNextSegment) assignToSegment(trailingSegment, update);
  }

  return Array.from(updatesBySegment.entries())
    .sort((a, b) => a[0] - b[0])
    .flatMap(([segment, updates]) => updates.map((update) => ({ segment, update })));
}

/** Extract all command tags from GM narration and return clean content. */
export function parseGmTags(content: string): ParsedGmTags {
  let text = content;
  const result: ParsedGmTags = {
    cleanContent: "",
    music: null,
    sfx: [],
    background: null,
    ambient: null,
    choices: null,
    qte: null,
    stateChange: null,
    reputationActions: [],
    combatEncounter: null,
    directions: [],
    widgetUpdates: [],
    skillChecks: [],
    elementAttacks: [],
    combatStatuses: [],
    inventoryUpdates: [],
    partyChanges: [],
    readables: [],
  };

  // [music: tag]
  const music = extractFlatTags(text, /\[music:/gi, true);
  result.music = music.contents[0] ?? null;
  text = music.remaining;

  // [sfx: tag] — can appear multiple times
  const sfx = extractFlatTags(text, /\[sfx:/gi);
  result.sfx = sfx.contents;
  text = sfx.remaining;

  // [bg: tag]
  const background = extractFlatTags(text, /\[bg:/gi, true);
  result.background = background.contents[0] ?? null;
  text = background.remaining;

  // [ambient: tag]
  const ambient = extractFlatTags(text, /\[ambient:/gi, true);
  result.ambient = ambient.contents[0] ?? null;
  text = ambient.remaining;

  const qteTerminalMatch = findQteTag(text);
  const combatTerminalMatch = extractFlatTags(text, /\[combat:/gi, true).matches[0];
  const terminalCandidates: Array<{ index: number; tag: string }> = [];
  if (qteTerminalMatch?.index !== undefined && parseQteMatch(qteTerminalMatch)) {
    terminalCandidates.push({ index: qteTerminalMatch.index, tag: qteTerminalMatch.tag });
  }
  if (combatTerminalMatch?.index !== undefined && parseCombatEncounter(combatTerminalMatch.body)) {
    terminalCandidates.push({ index: combatTerminalMatch.index, tag: combatTerminalMatch.tag });
  }
  const terminalTag = terminalCandidates.sort((a, b) => a.index - b.index)[0];
  if (terminalTag) {
    text = `${text.slice(0, terminalTag.index)}${terminalTag.tag}`;
  }

  // [choices: "A" | "B" | "C"] — use balanced bracket extraction for content with ]
  {
    const { contents, remaining } = extractBalancedTags(text, "[choices:");
    if (contents.length > 0) {
      const raw = contents[0]!;
      const choices = raw
        .split("|")
        .map((c) => c.trim().replace(/^["']|["']$/g, ""))
        .filter((c) => c.length > 0);
      if (choices.length > 0) result.choices = choices;
    }
    text = remaining;
  }

  // [qte: action1 | action2, timer: 5s]
  const qteMatch = findQteTag(text);
  if (qteMatch) {
    const parsedQte = parseQteMatch(qteMatch);
    if (parsedQte) {
      result.qte = parsedQte;
      text = text.slice(0, qteMatch.index).trimEnd();
    } else {
      text = text.replace(qteMatch.tag, "");
    }
  }

  // [state: exploration|dialogue|combat|travel_rest]
  const stateMatch = text.match(/\[state:\s*(exploration|dialogue|combat|travel_rest)\]/i);
  if (stateMatch) {
    if (!result.qte) result.stateChange = stateMatch[1]!.trim();
    text = text.replace(stateMatch[0], "");
  }

  // [reputation: npc="Name" action="helped"] — can appear multiple times
  const repRegex = /\[reputation:\s*npc="([^"]+)"\s*action="([^"]+)"\]/gi;
  let repMatch: RegExpExecArray | null;
  while ((repMatch = repRegex.exec(text)) !== null) {
    result.reputationActions.push({
      npcName: repMatch[1]!.trim(),
      action: repMatch[2]!.trim(),
    });
  }
  text = text.replace(/\[reputation:\s*npc="[^"]+"\s*action="[^"]+"\]/gi, "");

  // The Engine resolves every sheet command and rewrites it with the outcome it actually
  // applied, so the bookkeeping is never narration.
  text = stripSheetCommandTags(text);

  // [combat: enemies="Goblin:5:40:8:5:6, Skeleton:3:25:6:3:4" allies="Dottore, Nasira"]
  // Format: Name:Level:HP:ATK:DEF:SPD — comma separated for multiple enemies
  // Simplified format: [combat: enemies="Goblin, Skeleton"] (auto-generates stats from level)
  const combatTags = extractFlatTags(text, /\[combat:/gi, true);
  const combatMatch = combatTags.matches[0];
  if (combatMatch) {
    const encounter = parseCombatEncounter(combatMatch.body);
    if (encounter && !result.qte) {
      result.combatEncounter = encounter;
      result.stateChange = "combat";
    }
    text = combatTags.remaining;
  }

  // [direction: effect, param: value, ...] — cinematic commands (can appear multiple times)
  const VALID_DIRECTIONS = new Set([
    "fade_from_black",
    "fade_to_black",
    "flash",
    "screen_shake",
    "blur",
    "vignette",
    "letterbox",
    "color_grade",
    "focus",
    "pulse",
    "slow_zoom",
    "impact_zoom",
    "tilt",
    "desaturate",
    "chromatic_aberration",
    "film_grain",
    "rain_streaks",
    "spotlight",
  ]) as Set<string>;
  const directions = extractFlatTags(text, /\[direction:/gi);
  for (const { body } of directions.matches) {
    const comma = body.indexOf(",");
    const effect = (comma < 0 ? body : body.slice(0, comma)).trim();
    if (!VALID_DIRECTIONS.has(effect)) continue;
    const cmd: DirectionCommand = { effect: effect as DirectionEffect };
    if (comma >= 0) {
      const paramStr = body.slice(comma + 1);
      const pairs = paramStr.split(",").map((p) => p.trim());
      const extraParams: Record<string, string> = {};
      for (const pair of pairs) {
        const [k, v] = pair.split(":").map((s) => s.trim());
        if (!k || !v) continue;
        if (k === "duration") {
          const parsed = parseFloat(v);
          cmd.duration = isNaN(parsed) ? 1 : parsed;
        } else if (k === "intensity") {
          const parsed = parseFloat(v);
          cmd.intensity = Math.max(0, Math.min(1, isNaN(parsed) ? 0.5 : parsed));
        } else if (k === "target" && (v === "background" || v === "content" || v === "all")) cmd.target = v;
        else extraParams[k] = v;
      }
      if (Object.keys(extraParams).length > 0) cmd.params = extraParams;
    }
    result.directions.push(cmd);
  }
  text = directions.remaining;

  // [widget: id, key: value, ...] — widget update commands (can appear multiple times)
  const widgets = extractFlatTags(text, /\[widget:/gi);
  for (const { body } of widgets.matches) {
    const comma = body.indexOf(",");
    if (comma === 0) continue;
    const widgetId = (comma < 0 ? body : body.slice(0, comma)).trim();
    const changes: WidgetUpdate["changes"] = {};
    if (comma >= 0) {
      const pairs = splitQuotedParams(body.slice(comma + 1));
      for (const pair of pairs) {
        const colonIdx = pair.indexOf(":");
        if (colonIdx < 0) continue;
        const k = pair.slice(0, colonIdx).trim();
        const v = pair.slice(colonIdx + 1).trim();
        const stripped = v.replace(/^["']|["']$/g, "");
        if (k === "value") {
          const parsed = parseFloat(stripped);
          changes.value = isNaN(parsed) ? stripped : parsed;
        } else if (k === "stat") changes.statName = stripped;
        else if (k === "add") changes.add = stripped;
        else if (k === "remove") changes.remove = stripped;
        else if (k === "count") {
          const parsed = parseInt(stripped, 10);
          changes.count = isNaN(parsed) ? 0 : parsed;
        } else if (k === "running") changes.running = stripped === "true";
        else if (k === "seconds") {
          const parsed = parseInt(stripped, 10);
          changes.seconds = isNaN(parsed) ? 0 : parsed;
        }
      }
    }
    result.widgetUpdates.push({ widgetId, changes });
  }
  text = widgets.remaining;

  // Also strip other existing tags that the UI handles separately.
  // [map_update: ...] is persisted in message history, but canonical map
  // changes are applied on the backend.
  text = stripMapUpdateTag(text);
  // [dialogue: npc="..."]
  text = text.replace(/\[dialogue:\s*npc="[^"]*"\]/gi, "");
  // [session_end: ...]
  text = extractFlatTags(text, /\[session_end:/gi, false, true).remaining;

  // [skill_check: ...] — supports resolved same-turn rolls and tolerates older unresolved requests
  const skillTags = extractFlatTags(text, /\[skill_check:/gi);
  for (const { body } of skillTags.matches) {
    const parsed = parseSkillCheckTagBody(body);
    if (parsed) result.skillChecks.push(parsed);
  }
  text = skillTags.remaining;

  // [element_attack: element="pyro" target="Goblin"] — can appear multiple times
  const elemRegex = /\[element_attack:\s*element="([^"]+)"\s*target="([^"]+)"\]/gi;
  let elemMatch: RegExpExecArray | null;
  while ((elemMatch = elemRegex.exec(text)) !== null) {
    result.elementAttacks.push({
      element: elemMatch[1]!.trim().toLowerCase(),
      target: elemMatch[2]!.trim(),
    });
  }
  text = extractFlatTags(text, /\[element_attack:/gi).remaining;

  // [status: target="Goblin" effect="Poison" turns=3 stat="hp" modifier=-6]
  const statusTags = extractFlatTags(text, /\[status:/gi);
  for (const { body } of statusTags.matches) {
    const parsed = parseCombatStatusTagBody(body);
    if (parsed) result.combatStatuses.push(parsed);
  }
  text = statusTags.remaining;

  // [inventory: ...] — only the tags the server already applied and answered (one per item,
  // with result=). What the Game Master may write is read on the server, in
  // `parseInventoryTagBody` (shared), and a tag it never answered changed nothing.
  const invBlockTags = extractFlatTags(text, /\[inventory:/gi);
  for (const { body } of invBlockTags.matches) {
    const parsed = readResolvedInventoryTagBody(body);
    if (parsed) result.inventoryUpdates.push(parsed);
  }
  text = invBlockTags.remaining;

  // [party_change: character="Name" change="add | remove"] — can appear multiple times
  const partyChangeTags = extractFlatTags(text, /\[party_change:/gi);
  for (const { body } of partyChangeTags.matches) {
    const parsed = parsePartyChangeTagBody(body);
    if (parsed) result.partyChanges.push(parsed);
  }
  text = partyChangeTags.remaining;

  // [party_add: character="Name"] — legacy alias for party_change add
  const partyAddTags = extractFlatTags(text, /\[party_add:/gi);
  for (const { body } of partyAddTags.matches) {
    const parsed = parsePartyChangeTagBody(body, "add");
    if (parsed) result.partyChanges.push(parsed);
  }
  text = partyAddTags.remaining;

  // [Note: content] or [Book: content] — readable documents (balanced brackets)
  {
    const { contents: noteContents, remaining: afterNotes } = extractBalancedTags(text, "[Note:");
    text = afterNotes;
    for (const c of noteContents) {
      if (c) result.readables.push({ type: "note", content: c });
    }
    const { contents: bookContents, remaining: afterBooks } = extractBalancedTags(text, "[Book:");
    text = afterBooks;
    for (const c of bookContents) {
      if (c) result.readables.push({ type: "book", content: c });
    }
  }

  // [dice: ...] — informational dice results
  text = extractFlatTags(text, /\[dice:/gi).remaining;

  // Catch-all: strip any remaining [tag: ...] brackets the model may invent.
  // Quote-aware bracket-balanced walk so JSON content like `[x: {"y":[1]}]`
  // is removed entirely instead of stopping at the first inner `]`.
  text = stripUnknownBracketTags(text);

  text = stripDanglingTagClosers(text);

  result.cleanContent = text.trim();
  return result;
}

/** Strip all GM command tags from text, returning clean display content. */
export function stripGmTags(content: string): string {
  let text = stripEngineResultBlocks(content);
  text = extractFlatTags(text, /\[music:/gi).remaining;
  text = extractFlatTags(text, /\[sfx:/gi).remaining;
  text = extractFlatTags(text, /\[bg:/gi).remaining;
  text = extractFlatTags(text, /\[ambient:/gi).remaining;
  text = extractFlatTags(text, /\[qte:/gi).remaining;
  text = extractFlatTags(text, /\[state:/gi).remaining;
  text = extractFlatTags(text, /\[reputation:/gi).remaining;
  text = extractFlatTags(text, /\[combat:/gi).remaining;
  text = extractFlatTags(text, /\[direction:/gi).remaining;
  text = extractFlatTags(text, /\[widget:/gi).remaining;
  text = text.replace(/\[dialogue:\s*npc="[^"]*"\]/gi, "");
  text = extractFlatTags(text, /\[session_end:/gi, false, true).remaining;
  text = extractFlatTags(text, /\[skill_check:/gi).remaining;
  text = extractFlatTags(text, /\[status:/gi).remaining;
  text = extractFlatTags(text, /\[element_attack:/gi).remaining;
  text = extractFlatTags(text, /\[inventory:/gi).remaining;
  text = extractFlatTags(text, /\[party_change:/gi).remaining;
  text = extractFlatTags(text, /\[party_add:/gi).remaining;
  text = text.replace(/\[party-turn\]/gi, "");
  text = text.replace(/\[party-chat\]/gi, "");
  text = extractFlatTags(text, /\[dice:/gi).remaining;
  // The one-request dice branch delimiters. Three of the four are unreachable by
  // everything below: `stripUnknownBracketTags` and the `[\w+:` catch-all both require a
  // `:` after the name, and `[on success]` has a space before its `]` while `[/branch]`
  // is not a `[name:` head at all. The prose between them is kept — a block only reaches
  // this stripper when the engine's chance pass never ran for it, and deleting narration
  // the player already read would be the worse failure.
  // The Engine resolves every sheet command and rewrites it with the outcome it actually
  // applied, so the bookkeeping is never narration.
  text = stripSheetCommandTags(text);
  text = stripGameBranchDelimiters(text);
  // Quote-aware catch-all for any remaining [tag: ...] the model may invent
  text = stripUnknownBracketTags(text);
  // Balanced bracket stripping for tags whose content may contain nested []
  text = stripMapUpdateTag(text);
  text = stripBalancedTag(text, "[choices:");
  text = stripBalancedTag(text, "[Note:");
  text = stripBalancedTag(text, "[Book:");
  // Catch-all: strip any remaining [tag: ...] brackets the model may invent
  text = extractFlatTags(text, /\[\w+:/g, false, true).remaining;
  text = stripDanglingTagClosers(text);
  return text.trim();
}

const GAME_NARRATION_EFFECT_PREFIX_RE =
  /\{(?:shake|shout|whisper|glow|pulse|wave|flicker|drip|bounce|tremble|glitch|expand):/gi;
const ALLOWED_STANDALONE_NARRATION_HTML_TAG_RE = /^\/?(?:strong|em|br|span)(?:\s|$)/i;

/** Preserve model-authored `<CORE: SEALED>`-style readouts as literal narration. */
export function escapeStandaloneGameNarrationAngleLines(content: string): string {
  return content.replace(
    /^([ \t]*)<([^<>\r\n]+)>([ \t]*)$/gm,
    (match, leading: string, inner: string, trailing: string) => {
      if (ALLOWED_STANDALONE_NARRATION_HTML_TAG_RE.test(inner.trim())) return match;
      return `${leading}&lt;${inner.replace(/&/g, "&amp;")}&gt;${trailing}`;
    },
  );
}

/** True when a prepared narration segment will display at least one character. */
export function hasVisibleGameNarrationText(content: string): boolean {
  let from = 0;
  for (const match of content.matchAll(GAME_NARRATION_EFFECT_PREFIX_RE)) {
    if (match.index < from) continue;
    if (content.slice(from, match.index).trim()) return true;
    const bodyStart = match.index + match[0].length;
    const end = content.indexOf("}", bodyStart);
    // Empty or unclosed tags were not matched by the legacy expression and stay visible.
    if (end <= bodyStart) return true;
    if (content.slice(bodyStart, end).trim()) return true;
    from = end + 1;
  }
  return content.slice(from).trim().length > 0;
}

/** A combat-start message arrives before the rendered game state catches up. */
export function resolveMessageWeatherAction(state: string, content: string): "travel" | "explore" | "turn" | null {
  const tags = parseGmTags(content);
  if (state === "combat" || tags.stateChange === "combat" || tags.combatEncounter) return null;
  return state === "travel_rest" ? "travel" : state === "exploration" ? "explore" : "turn";
}
