// ──────────────────────────────────────────────
// Service: Character Commands
// ──────────────────────────────────────────────
// Parses hidden commands from character messages in Conversation mode.
// Commands are embedded by the LLM in the response and stripped before
// the message is shown to the user.
//
// Supported commands:
// - [schedule_update: status="online", activity="free time"]
// - [cross_post: target="group"] or [cross_post: target="CharName"]
// - [selfie], [selfie: context="description of the selfie"], [selfie: "description"], or [selfie: description]
// - [memory: target="CharName", summary="description of the memory"]
// - [scene: scenario="...", background="...", plan="..."] (initiate a mini-roleplay scene)
// - [call] or [call: reason="..."] (ring the user for an audio call; Conversation mode)
// - [uno] (start a game of UNO at the table; Conversation mode)
// - [chess] (start a one-on-one chess game against the user; Conversation mode)
// - [poker] (start a game of Texas Hold'em poker at the table; Conversation mode)
// - [eightball] (start a one-on-one 8-ball pool game against the user; Conversation mode)
// - [tic_tac_toe] (start a one-on-one tic-tac-toe game against the user; Conversation mode)
// - [rock_paper_scissors] (start a one-on-one rock-paper-scissors match against the user; Conversation mode)
// - [spotify: title="Song title", artist="Artist"] (play a song on the user's active Spotify player)
// - [youtube: query="Song title Artist"] (play a song on the user's active YouTube player)
// - [react: emoji="😂"] or [react: emoji=":custom_name:"] (react to the user's latest message; Conversation mode)
//   with optional `to "Character Name"` suffix to react to that character's most recent part instead
// - [haptic: action="vibrate", intensity=0.5, duration=3] (haptic device feedback)
// - <influence>text</influence> (OOC influence for connected roleplay, one-shot)
// - <note>text</note> (durable note for connected roleplay, persists until cleared)
// - [dm: character="CharName", message="text"] (Roleplay-only: open a direct-message conversation)
//
// Assistant commands (Professor Mari):
// - [create_persona: name="...", description="...", personality="...", appearance="...", about_me="..."]
// - [create_character: name="...", description="...", personality="...", first_message="...", scenario="...", backstory="...", appearance="...", about_me="...", mes_example="...", creator_notes="...", system_prompt="...", post_history_instructions="...", creator="...", character_version="...", tags="tag1, tag2", alternate_greetings="hello || hi", talkativeness=0.5, fav=true, world="...", depth_prompt="...", depth_prompt_depth=4, depth_prompt_role="system"]
// - [update_character: name="...", description="...", personality="...", first_message="...", scenario="...", backstory="...", appearance="...", about_me="...", mes_example="...", creator_notes="...", system_prompt="...", post_history_instructions="...", creator="...", character_version="...", tags="tag1, tag2", alternate_greetings="hello || hi", talkativeness=0.5, fav=true, world="...", depth_prompt="...", depth_prompt_depth=4, depth_prompt_role="system"]
// - [update_persona: name="...", description="...", personality="...", appearance="...", scenario="...", backstory="...", about_me="..."]
// - <create_lorebook>{"name":"...","description":"...","category":"...","tags":["..."],"entries":[{"name":"...","content":"...","keys":["..."],"tag":"..."}]}</create_lorebook>
// - <update_lorebook>{"name":"Existing","description":"...","entries":[{"name":"Entry","content":"refined content","keys":["..."]}]}</update_lorebook>
// - <create_preset>{"name":"...","description":"...","sections":[{"name":"...","content":"...","role":"system"}],"choiceBlocks":[{"variableName":"...","question":"...","options":[{"label":"...","value":"..."}]}]}</create_preset>
// - <suggestions>[{"label":"...","prompt":"...","entity":"characters"}]</suggestions>
// - [create_chat: character="...", mode="conversation|roleplay"]
// - [navigate: panel="...", tab="..."]
// - [fetch: type="character|persona|lorebook|chat|preset", name="..."]

import { normalizeTextForMatch, stripLeadingMessageTimestamps } from "@marinara-engine/shared";

import { stripConversationPromptTimestamps } from "./transcript-sanitize.js";
import {
  parseCapabilityConversationCommands,
  stripCapabilityConversationCommands,
} from "../capability-packages/capability-command-registry.service.js";

export interface ScheduleUpdateCommand {
  type: "schedule_update";
  status?: "online" | "idle" | "dnd" | "offline";
  activity?: string;
  duration?: string;
}

export interface CrossPostCommand {
  type: "cross_post";
  /** "group" to post in a group chat, or a character/chat name for DM */
  target: string;
}

export interface SelfieCommand {
  type: "selfie";
  /** Optional context hint from the character about the selfie */
  context?: string;
}

export interface MemoryCommand {
  type: "memory";
  /** Target character name */
  target: string;
  /** Short description of the memory */
  summary: string;
}

export interface SceneCommand {
  type: "scene";
  /** Description of the scene/scenario the character wants to play out */
  scenario: string;
  /** Optional background suggestion */
  background?: string;
  /** Optional plot plan / outline for how the scene unfolds */
  plan?: string;
}

export interface CallCommand {
  /** Ring the user for a Conversation-mode audio call. Param-less or optional reason/greeting. */
  type: "call";
  reason?: string;
  /** Optional first thing to say after the user answers. */
  greeting?: string;
}

export interface UnoCommand {
  /** Start a game of UNO at the table. Param-less; the system deals + runs the game. */
  type: "uno";
}

export interface ChessCommand {
  /** Start a one-on-one chess game against the user. Param-less; the system sets up + runs the board. */
  type: "chess";
}

export interface PokerCommand {
  /** Start a game of Texas Hold'em poker at the table. Param-less; the system seats + runs the game. */
  type: "poker";
}

export interface EightballCommand {
  /** Start a one-on-one 8-ball pool game against the user. Param-less; the system racks + runs the table. */
  type: "eightball";
}

export interface TicTacToeCommand {
  /** Start a one-on-one tic-tac-toe game against the user. Param-less; the system sets up + runs the board. */
  type: "tic_tac_toe";
}

export interface RockPaperScissorsCommand {
  /** Start a one-on-one rock-paper-scissors match against the user. Param-less; the system sets up + runs the match. */
  type: "rock_paper_scissors";
}

export interface CapabilityConversationCommand {
  type: "capability";
  commandType: string;
}

export interface InfluenceCommand {
  type: "influence";
  /** The OOC influence text to inject into the connected roleplay */
  content: string;
}

export interface NoteCommand {
  type: "note";
  /** The durable note text to persist in the connected roleplay's prompt until cleared */
  content: string;
}

export interface DirectMessageCommand {
  type: "dm";
  /** Target character name or ID */
  character: string;
  /** Text the character sends in the generated conversation DM */
  message: string;
  /** Original command text, used to strip or visible-fallback individual commands. */
  raw?: string;
  /** Resolved by the generation route once the target is verified as a real character card. */
  resolvedCharacterId?: string;
  resolvedCharacterName?: string;
}

export interface HapticCommand {
  type: "haptic";
  /** Device action */
  action: "vibrate" | "oscillate" | "rotate" | "position" | "stop";
  /** Intensity / speed (0.0-1.0) */
  intensity?: number;
  /** Duration in seconds */
  duration?: number;
}

export interface SpotifyCommand {
  type: "spotify";
  /** Exact song title to play */
  title: string;
  /** Artist name to disambiguate the track */
  artist: string;
}

export interface YouTubeCommand {
  type: "youtube";
  /** YouTube search query to resolve on the client player */
  query: string;
}

export interface ReactCommand {
  type: "react";
  /** The reaction token: a unicode emoji (e.g. "😂") or a custom-emoji ref `:name:`. */
  emoji: string;
  /**
   * Optional target character name (`[react: 😂 to "Name"]`): react to that
   * character's most recent part instead of the user's latest message. Resolved
   * against chat characters at execution time; unresolvable names fall back to
   * the default user-message target.
   */
  targetCharacter?: string;
}

// ── Assistant commands (Professor Mari) ──

export interface CreatePersonaCommand {
  type: "create_persona";
  name: string;
  description?: string;
  personality?: string;
  appearance?: string;
  aboutMe?: string;
}

export interface CreateCharacterCommand {
  type: "create_character";
  name: string;
  description?: string;
  personality?: string;
  firstMessage?: string;
  scenario?: string;
  backstory?: string;
  appearance?: string;
  aboutMe?: string;
  mesExample?: string;
  creatorNotes?: string;
  systemPrompt?: string;
  postHistoryInstructions?: string;
  creator?: string;
  characterVersion?: string;
  tags?: string[];
  alternateGreetings?: string[];
  talkativeness?: number;
  fav?: boolean;
  world?: string;
  depthPrompt?: string;
  depthPromptDepth?: number;
  depthPromptRole?: "system" | "user" | "assistant";
}

export interface UpdateCharacterCommand {
  type: "update_character";
  name: string;
  description?: string;
  personality?: string;
  firstMessage?: string;
  scenario?: string;
  backstory?: string;
  appearance?: string;
  aboutMe?: string;
  mesExample?: string;
  creatorNotes?: string;
  systemPrompt?: string;
  postHistoryInstructions?: string;
  creator?: string;
  characterVersion?: string;
  tags?: string[];
  alternateGreetings?: string[];
  talkativeness?: number;
  fav?: boolean;
  world?: string;
  depthPrompt?: string;
  depthPromptDepth?: number;
  depthPromptRole?: "system" | "user" | "assistant";
}

export interface UpdatePersonaCommand {
  type: "update_persona";
  name: string;
  description?: string;
  personality?: string;
  appearance?: string;
  scenario?: string;
  backstory?: string;
  aboutMe?: string;
}

export interface CreateLorebookEntryCommand {
  name: string;
  content?: string;
  description?: string;
  keys?: string[];
  secondaryKeys?: string[];
  tag?: string;
  constant?: boolean;
  selective?: boolean;
}

export interface UpdateLorebookEntryCommand extends CreateLorebookEntryCommand {
  /** Existing entry name to match when renaming or disambiguating. Defaults to name. */
  matchName?: string;
}

export interface CreateLorebookCommand {
  type: "create_lorebook";
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  entries?: CreateLorebookEntryCommand[];
}

export interface UpdateLorebookCommand {
  type: "update_lorebook";
  /** Existing lorebook name to update. */
  name: string;
  /** Optional new display name for the lorebook. */
  newName?: string;
  description?: string;
  category?: string;
  tags?: string[];
  entries?: UpdateLorebookEntryCommand[];
}

export interface CreatePresetSectionCommand {
  name: string;
  content?: string;
  identifier?: string;
  role?: "system" | "user" | "assistant";
  enabled?: boolean;
  groupName?: string;
  injectionPosition?: "ordered" | "depth";
  injectionDepth?: number;
  injectionOrder?: number;
  forbidOverrides?: boolean;
}

export interface CreatePresetGroupCommand {
  name: string;
  parentGroupName?: string;
  order?: number;
  enabled?: boolean;
}

export interface CreatePresetChoiceOptionCommand {
  id?: string;
  label: string;
  value: string;
}

export interface CreatePresetChoiceBlockCommand {
  variableName: string;
  question: string;
  options: CreatePresetChoiceOptionCommand[];
  multiSelect?: boolean;
  separator?: string;
  randomPick?: boolean;
  displayMode?: "auto" | "buttons" | "listbox";
  optionSort?: "manual" | "alphabetical";
}

export interface CreatePresetCommand {
  type: "create_preset";
  name: string;
  description?: string;
  wrapFormat?: "xml" | "markdown" | "none";
  author?: string;
  groups?: CreatePresetGroupCommand[];
  sections?: CreatePresetSectionCommand[];
  choiceBlocks?: CreatePresetChoiceBlockCommand[];
}

export interface CreateChatCommand {
  type: "create_chat";
  character: string;
  mode?: "conversation" | "roleplay";
}

export interface NavigateCommand {
  type: "navigate";
  panel: string;
  tab?: string;
}

export interface FetchCommand {
  type: "fetch";
  /** What kind of item to fetch */
  fetchType: "character" | "persona" | "lorebook" | "chat" | "preset";
  /** Name of the item to retrieve */
  name: string;
}

export interface SuggestionsCommand {
  type: "suggestions";
  suggestions: unknown;
}

export interface PlanCommand {
  type: "plan";
  plan: unknown;
}

export type AssistantCommand =
  | CreatePersonaCommand
  | CreateCharacterCommand
  | UpdateCharacterCommand
  | UpdatePersonaCommand
  | CreateLorebookCommand
  | UpdateLorebookCommand
  | CreatePresetCommand
  | CreateChatCommand
  | NavigateCommand
  | FetchCommand
  | SuggestionsCommand
  | PlanCommand;

export type CharacterCommand =
  | ScheduleUpdateCommand
  | CrossPostCommand
  | SelfieCommand
  | MemoryCommand
  | SceneCommand
  | CallCommand
  | UnoCommand
  | ChessCommand
  | PokerCommand
  | EightballCommand
  | TicTacToeCommand
  | RockPaperScissorsCommand
  | CapabilityConversationCommand
  | InfluenceCommand
  | NoteCommand
  | DirectMessageCommand
  | HapticCommand
  | SpotifyCommand
  | YouTubeCommand
  | ReactCommand
  | AssistantCommand;

// Param block matcher: any char that isn't `"` or `]`, OR a complete
// double-quoted string (with `\"`-style escapes). Lets a `]` inside a
// quoted parameter value (e.g. `description="Status: [VIP]"`) sit inside
// the command instead of terminating it early. The inner alternative
// excludes `\\` so backslash is only consumed by the escape branch —
// otherwise an escape-heavy value can trigger catastrophic backtracking.
const QUOTED_PARAM_BLOCK = '(?:[^"\\]]|"(?:\\\\.|[^"\\\\])*")*';

/** Regex patterns for each command type */
const SCHEDULE_UPDATE_RE = new RegExp(`\\[schedule_update:\\s*(${QUOTED_PARAM_BLOCK})\\]`, "gi");
const CROSS_POST_RE = /\[cross_post:\s*target="([^"]+)"\]/gi;
const SELFIE_RE = /\[selfie(?::\s*(?:context="([^"]*)"|"([^"]*)"|([^\]\r\n"]+)))?\]/gi;
const MEMORY_RE = /\[memory:\s*target="([^"]+)"\s*,\s*summary="([^"]+)"\]/gi;
const SCENE_RE = new RegExp(`\\[scene:\\s*(${QUOTED_PARAM_BLOCK})\\]`, "gi");
const CALL_RE = new RegExp(`\\[call(?::\\s*(${QUOTED_PARAM_BLOCK}))?\\]`, "gi");
const HAPTIC_RE = new RegExp(`\\[haptic:\\s*(${QUOTED_PARAM_BLOCK})\\]`, "gi");
const SPOTIFY_RE = new RegExp(`\\[spotify:\\s*(${QUOTED_PARAM_BLOCK})\\]`, "gi");
const YOUTUBE_RE = new RegExp(`\\[youtube:\\s*(${QUOTED_PARAM_BLOCK})\\]`, "gi");
// React with an emoji. Accepts [react: emoji="😂"], [react: "😂"], or [react: 😂]
// — and likewise for a custom emoji ref :name:. An optional trailing
// `to "Character Name"` (quotes optional) aims the reaction at that character's
// most recent part instead of the user's latest message.
// Deliberately a single-quantifier capture of the whole bracket body: a
// suffix-aware regex with overlapping whitespace quantifiers is super-linear on
// degenerate inputs (ReDoS), so the short captured body is split
// deterministically in parseReactBody instead.
const REACT_RE = /\[react:([^\]\r\n]+)\]/gi;

/** Split a `[react: ...]` body into its emoji token + optional `to "Name"` target. */
function parseReactBody(body: string): { emoji: string; targetCharacter?: string } | null {
  const trimmed = body.trim();
  // Tolerate spaces around '=' — a common model malformation of the advertised
  // emoji="…" syntax.
  const keyForm = trimmed.match(/^emoji\s*=\s*"/i);
  let emoji: string;
  let rest: string;
  let quotedForm = false;
  if (keyForm) {
    quotedForm = true;
    const close = trimmed.indexOf('"', keyForm[0].length);
    if (close === -1) return null;
    emoji = trimmed.slice(keyForm[0].length, close).trim();
    rest = trimmed.slice(close + 1);
  } else if (trimmed.startsWith('"')) {
    quotedForm = true;
    const close = trimmed.indexOf('"', 1);
    if (close === -1) return null;
    emoji = trimmed.slice(1, close).trim();
    rest = trimmed.slice(close + 1);
  } else {
    const ws = trimmed.search(/\s/);
    emoji = ws === -1 ? trimmed : trimmed.slice(0, ws);
    rest = ws === -1 ? "" : trimmed.slice(ws);
  }
  if (!emoji || /^to$/i.test(emoji)) return null;
  const suffix = rest.trim();
  if (suffix) {
    const toMatch = suffix.match(/^to\s+(.+)$/i);
    if (toMatch) {
      let target = toMatch[1]!.trim();
      if (target.startsWith('"')) {
        // Take the quoted name, tolerating junk after (or a missing) closing quote.
        const close = target.indexOf('"', 1);
        target = (close > 0 ? target.slice(1, close) : target.slice(1)).trim();
      }
      return target ? { emoji, targetCharacter: target } : { emoji };
    }
    // No recognizable target marker after a bare token — keep the old grammar's
    // behavior where the whole body was the (possibly junk) emoji token. Bodies
    // containing quotes were unreachable under the old grammar (prose asides
    // like `[react: she said "hi"]`) — reject them rather than minting a junk
    // text chip.
    if (!quotedForm) return trimmed.includes('"') ? null : { emoji: trimmed };
  }
  return emoji.includes('"') ? null : { emoji };
}
const DIRECT_MESSAGE_RE = new RegExp(`\\[dm:\\s*(${QUOTED_PARAM_BLOCK})\\]`, "gi");
const INFLUENCE_RE = /<influence>([\s\S]*?)<\/influence>/gi;
const NOTE_RE = /<note>([\s\S]*?)<\/note>/gi;
const INFLUENCE_BRACKET_RE = new RegExp(`\\[influence:\\s*(${QUOTED_PARAM_BLOCK})\\]`, "gi");
const NOTE_BRACKET_RE = new RegExp(`\\[note:\\s*(${QUOTED_PARAM_BLOCK})\\]`, "gi");

// Assistant command regexes
const CREATE_PERSONA_RE = new RegExp(`\\[create_persona:\\s*(${QUOTED_PARAM_BLOCK})\\]`, "gi");
const CREATE_CHARACTER_RE = new RegExp(`\\[create_character:\\s*(${QUOTED_PARAM_BLOCK})\\]`, "gi");
const UPDATE_CHARACTER_RE = new RegExp(`\\[update_character:\\s*(${QUOTED_PARAM_BLOCK})\\]`, "gi");
const UPDATE_PERSONA_RE = new RegExp(`\\[update_persona:\\s*(${QUOTED_PARAM_BLOCK})\\]`, "gi");
const CREATE_LOREBOOK_RE = new RegExp(`\\[create_lorebook:\\s*(${QUOTED_PARAM_BLOCK})\\]`, "gi");
const CREATE_LOREBOOK_BLOCK_RE = /<create_lorebook>([\s\S]*?)<\/create_lorebook>/gi;
const UPDATE_LOREBOOK_BLOCK_RE = /<update_lorebook>([\s\S]*?)<\/update_lorebook>/gi;
const CREATE_PRESET_BLOCK_RE = /<create_preset>([\s\S]*?)<\/create_preset>/gi;
const SUGGESTIONS_BLOCK_RE = /<suggestions>([\s\S]*?)<\/suggestions>/gi;
const PLAN_BLOCK_RE = /<plan>([\s\S]*?)<\/plan>/gi;
const CREATE_CHAT_RE = new RegExp(`\\[create_chat:\\s*(${QUOTED_PARAM_BLOCK})\\]`, "gi");
const NAVIGATE_RE = new RegExp(`\\[navigate:\\s*(${QUOTED_PARAM_BLOCK})\\]`, "gi");
const FETCH_RE = new RegExp(`\\[fetch:\\s*(${QUOTED_PARAM_BLOCK})\\]`, "gi");

function decodeQuotedParamValue(value: string): string {
  return value.replace(/\\(["\\nrt])/g, (_match, escaped: string) => {
    switch (escaped) {
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      default:
        return escaped;
    }
  });
}

const QUOTE_PAIRS: Record<string, string> = {
  '"': '"',
  "\u201c": "\u201d",
  "\u201d": "\u201d",
  "\u2018": "\u2019",
  "\u2019": "\u2019",
};

function parseQuotedParam(params: string, key: string, allowEmpty = false): string | undefined {
  const match = params.match(new RegExp(`${key}\\s*=\\s*(["\u201c\u201d\u2018\u2019])`));
  if (!match || match.index === undefined) return undefined;

  const openingQuote = match[1] ?? '"';
  const closingQuote = QUOTE_PAIRS[openingQuote] ?? openingQuote;
  let rawValue = "";
  let index = match.index + match[0].length;

  while (index < params.length) {
    const char = params[index] ?? "";
    const nextChar = params[index + 1];

    if (char === "\\" && nextChar !== undefined) {
      rawValue += char + nextChar;
      index += 2;
      continue;
    }

    const remainder = params.slice(index + 1).trimStart();
    if (
      char === closingQuote &&
      (remainder.length === 0 || remainder.startsWith(",") || /^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(remainder))
    ) {
      break;
    }

    rawValue += char;
    index += 1;
  }

  if (index >= params.length) return undefined;

  const value = decodeQuotedParamValue(rawValue);
  if (!allowEmpty && value.length === 0) return undefined;
  return value;
}

function parseCommandTextParam(params: string, keys: string[]): string {
  for (const key of keys) {
    const value = parseQuotedParam(params, key);
    if (value !== undefined) return value;
  }
  return params
    .trim()
    .replace(/^["“”‘’]\s*/, "")
    .replace(/\s*["“”‘’]$/, "")
    .trim();
}

function parseStringList(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  if (value.trim().length === 0) return [];
  const delimiter = value.includes("||") ? "||" : ",";
  return value
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBooleanParam(params: string, key: string): boolean | undefined {
  const match = params.match(new RegExp(`${key}=(true|false)`, "i"));
  if (!match) return undefined;
  return match[1]?.toLowerCase() === "true";
}

function parseUnknownStringList(raw: unknown): string[] | undefined {
  if (Array.isArray(raw)) {
    const values = raw.map((value) => String(value).trim()).filter(Boolean);
    return values.length ? values : undefined;
  }
  if (typeof raw !== "string") return undefined;
  const values = parseStringList(raw);
  return values && values.length ? values : undefined;
}

function parseLorebookEntriesParam(raw: string): CreateLorebookEntryCommand[] | undefined {
  const entries = raw
    .split(/\s*\|\|\s*/)
    .map((chunk): CreateLorebookEntryCommand | null => {
      const [name, keys, content, description] = chunk.split(/\s*\|\s*/);
      const entryName = name?.trim();
      if (!entryName) return null;
      return {
        name: entryName,
        keys: parseUnknownStringList(keys),
        content: content?.trim() || "",
        description: description?.trim() || undefined,
      } satisfies CreateLorebookEntryCommand;
    })
    .filter((entry): entry is CreateLorebookEntryCommand => entry !== null);
  return entries.length ? entries : undefined;
}

function stripJsonFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseJsonValue(raw: string): unknown | null {
  try {
    return JSON.parse(stripJsonFence(raw)) as unknown;
  } catch {
    return null;
  }
}

/**
 * Suggestion-chip payloads come from free-form model output, which commonly drifts from
 * strict JSON (trailing commas, single-quoted strings, smart quotes from a "helpful"
 * autocorrect). A single stray comma would otherwise silently drop the whole chip set with
 * no visible symptom other than "Mari said she had suggestions but none appeared" - so this
 * repairs the common near-miss cases before giving up.
 */
function parseLenientJsonValue(raw: string): unknown | null {
  const direct = parseJsonValue(raw);
  if (direct !== null) return direct;
  const repaired = raw
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/,\s*([\]}])/g, "$1")
    .replace(/'([^'\\]*)'/g, (_match, inner: string) => `"${inner.replace(/"/g, '\\"')}"`);
  return parseJsonValue(repaired);
}

function findBracketJsonCommandBlocks(content: string, commandName: string): string[] {
  const blocks: string[] = [];
  const marker = `[${commandName}:`;
  let cursor = 0;
  while (cursor < content.length) {
    const start = content.toLowerCase().indexOf(marker, cursor);
    if (start === -1) break;
    let index = start + marker.length;
    while (/\s/.test(content[index] ?? "")) index += 1;
    const opening = content[index];
    const closing = opening === "[" ? "]" : opening === "{" ? "}" : null;
    if (!closing) {
      cursor = start + marker.length;
      continue;
    }
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (; index < content.length; index += 1) {
      const char = content[index] ?? "";
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === opening) depth += 1;
      else if (char === closing) {
        depth -= 1;
        if (depth === 0 && content[index + 1] === "]") {
          blocks.push(content.slice(start + marker.length, index + 1).trim());
          cursor = index + 2;
          break;
        }
      }
    }
    if (index >= content.length) cursor = start + marker.length;
  }
  return blocks;
}

function stripBracketJsonCommandBlocks(content: string, commandName: string): string {
  const marker = `[${commandName}:`;
  let result = "";
  let cursor = 0;
  while (cursor < content.length) {
    const start = content.toLowerCase().indexOf(marker, cursor);
    if (start === -1) break;
    let index = start + marker.length;
    while (/\s/.test(content[index] ?? "")) index += 1;
    const opening = content[index];
    const closing = opening === "[" ? "]" : opening === "{" ? "}" : null;
    if (!closing) {
      cursor = start + marker.length;
      continue;
    }
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;
    for (; index < content.length; index += 1) {
      const char = content[index] ?? "";
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === opening) depth += 1;
      else if (char === closing) {
        depth -= 1;
        if (depth === 0 && content[index + 1] === "]") {
          end = index + 2;
          break;
        }
      }
    }
    if (end === -1) {
      cursor = start + marker.length;
      continue;
    }
    result += content.slice(cursor, start);
    cursor = end;
  }
  return result + content.slice(cursor);
}

function parseLorebookBlock(raw: string): CreateLorebookCommand | null {
  try {
    const parsed = JSON.parse(stripJsonFence(raw)) as Record<string, unknown>;
    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
    if (!name) return null;

    const rawEntries = Array.isArray(parsed.entries) ? parsed.entries : [];
    const entries = rawEntries
      .map((entry): CreateLorebookEntryCommand | null => {
        if (!entry || typeof entry !== "object") return null;
        const data = entry as Record<string, unknown>;
        const entryName = typeof data.name === "string" ? data.name.trim() : "";
        if (!entryName) return null;
        return {
          name: entryName,
          content: typeof data.content === "string" ? data.content : "",
          description: typeof data.description === "string" ? data.description : undefined,
          keys: parseUnknownStringList(data.keys),
          secondaryKeys: parseUnknownStringList(data.secondaryKeys),
          tag: typeof data.tag === "string" ? data.tag : undefined,
          constant: typeof data.constant === "boolean" ? data.constant : undefined,
          selective: typeof data.selective === "boolean" ? data.selective : undefined,
        } satisfies CreateLorebookEntryCommand;
      })
      .filter((entry): entry is CreateLorebookEntryCommand => entry !== null);

    return {
      type: "create_lorebook",
      name,
      description: typeof parsed.description === "string" ? parsed.description : undefined,
      category: typeof parsed.category === "string" ? parsed.category : undefined,
      tags: parseUnknownStringList(parsed.tags),
      entries: entries.length ? entries : undefined,
    };
  } catch {
    return null;
  }
}

function parseUpdateLorebookBlock(raw: string): UpdateLorebookCommand | null {
  try {
    const parsed = JSON.parse(stripJsonFence(raw)) as Record<string, unknown>;
    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
    if (!name) return null;

    const rawEntries = Array.isArray(parsed.entries) ? parsed.entries : [];
    const entries = rawEntries
      .map((entry): UpdateLorebookEntryCommand | null => {
        if (!entry || typeof entry !== "object") return null;
        const data = entry as Record<string, unknown>;
        const nestedEntry = data.entry && typeof data.entry === "object" ? (data.entry as Record<string, unknown>) : {};
        const entryName =
          typeof data.name === "string"
            ? data.name.trim()
            : typeof nestedEntry.name === "string"
              ? nestedEntry.name.trim()
              : "";
        if (!entryName) return null;
        return {
          name: entryName,
          matchName: typeof data.matchName === "string" ? data.matchName.trim() : undefined,
          content:
            typeof data.content === "string"
              ? data.content
              : typeof nestedEntry.content === "string"
                ? nestedEntry.content
                : undefined,
          description:
            typeof data.description === "string"
              ? data.description
              : typeof nestedEntry.description === "string"
                ? nestedEntry.description
                : undefined,
          keys: parseUnknownStringList(data.keys ?? nestedEntry.keys),
          secondaryKeys: parseUnknownStringList(data.secondaryKeys ?? nestedEntry.secondaryKeys),
          tag:
            typeof data.tag === "string" ? data.tag : typeof nestedEntry.tag === "string" ? nestedEntry.tag : undefined,
          constant:
            typeof data.constant === "boolean"
              ? data.constant
              : typeof nestedEntry.constant === "boolean"
                ? nestedEntry.constant
                : undefined,
          selective:
            typeof data.selective === "boolean"
              ? data.selective
              : typeof nestedEntry.selective === "boolean"
                ? nestedEntry.selective
                : undefined,
        } satisfies UpdateLorebookEntryCommand;
      })
      .filter((entry): entry is UpdateLorebookEntryCommand => entry !== null);

    return {
      type: "update_lorebook",
      name,
      newName: typeof parsed.newName === "string" ? parsed.newName.trim() : undefined,
      description: typeof parsed.description === "string" ? parsed.description : undefined,
      category: typeof parsed.category === "string" ? parsed.category : undefined,
      tags: parseUnknownStringList(parsed.tags),
      entries: entries.length ? entries : undefined,
    };
  } catch {
    return null;
  }
}

function parsePresetRole(raw: unknown): CreatePresetSectionCommand["role"] | undefined {
  if (raw !== "system" && raw !== "user" && raw !== "assistant") return undefined;
  return raw;
}

function parsePresetWrapFormat(raw: unknown): CreatePresetCommand["wrapFormat"] | undefined {
  if (raw !== "xml" && raw !== "markdown" && raw !== "none") return undefined;
  return raw;
}

function parsePresetInjectionPosition(raw: unknown): CreatePresetSectionCommand["injectionPosition"] | undefined {
  if (raw !== "ordered" && raw !== "depth") return undefined;
  return raw;
}

function parseOptionalInteger(raw: unknown): number | undefined {
  if (typeof raw !== "number") return undefined;
  if (!Number.isSafeInteger(raw)) return undefined;
  if (raw < 0) return undefined;
  return raw;
}

function parseCreatePresetBlock(raw: string): CreatePresetCommand | null {
  try {
    const parsed = JSON.parse(stripJsonFence(raw)) as Record<string, unknown>;
    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
    if (!name) return null;

    const rawGroups = Array.isArray(parsed.groups) ? parsed.groups : [];
    const groups = rawGroups
      .map((group): CreatePresetGroupCommand | null => {
        if (!group || typeof group !== "object") return null;
        const data = group as Record<string, unknown>;
        const groupName = typeof data.name === "string" ? data.name.trim() : "";
        if (!groupName) return null;
        return {
          name: groupName,
          parentGroupName: typeof data.parentGroupName === "string" ? data.parentGroupName.trim() : undefined,
          order: parseOptionalInteger(data.order),
          enabled: typeof data.enabled === "boolean" ? data.enabled : undefined,
        };
      })
      .filter((group): group is CreatePresetGroupCommand => group !== null);

    const rawSections = Array.isArray(parsed.sections) ? parsed.sections : [];
    const sections = rawSections
      .map((section): CreatePresetSectionCommand | null => {
        if (!section || typeof section !== "object") return null;
        const data = section as Record<string, unknown>;
        const sectionName = typeof data.name === "string" ? data.name.trim() : "";
        if (!sectionName) return null;
        return {
          name: sectionName,
          content: typeof data.content === "string" ? data.content : "",
          identifier: typeof data.identifier === "string" ? data.identifier.trim() : undefined,
          role: parsePresetRole(data.role),
          enabled: typeof data.enabled === "boolean" ? data.enabled : undefined,
          groupName:
            typeof data.groupName === "string"
              ? data.groupName.trim()
              : typeof data.group === "string"
                ? data.group.trim()
                : undefined,
          injectionPosition: parsePresetInjectionPosition(data.injectionPosition),
          injectionDepth: parseOptionalInteger(data.injectionDepth),
          injectionOrder: parseOptionalInteger(data.injectionOrder),
          forbidOverrides: typeof data.forbidOverrides === "boolean" ? data.forbidOverrides : undefined,
        } satisfies CreatePresetSectionCommand;
      })
      .filter((section): section is CreatePresetSectionCommand => section !== null);

    const rawChoiceBlocks = Array.isArray(parsed.choiceBlocks)
      ? parsed.choiceBlocks
      : Array.isArray(parsed.choices)
        ? parsed.choices
        : [];
    const choiceBlocks = rawChoiceBlocks
      .map((choiceBlock): CreatePresetChoiceBlockCommand | null => {
        if (!choiceBlock || typeof choiceBlock !== "object") return null;
        const data = choiceBlock as Record<string, unknown>;
        const variableName =
          typeof data.variableName === "string"
            ? data.variableName.trim()
            : typeof data.variable === "string"
              ? data.variable.trim()
              : typeof data.name === "string"
                ? data.name.trim()
                : typeof data.key === "string"
                  ? data.key.trim()
                  : "";
        const question =
          typeof data.question === "string"
            ? data.question.trim()
            : typeof data.prompt === "string"
              ? data.prompt.trim()
              : typeof data.label === "string"
                ? data.label.trim()
                : "";
        const rawOptions = Array.isArray(data.options)
          ? data.options
          : Array.isArray(data.choices)
            ? data.choices
            : Array.isArray(data.values)
              ? data.values
              : [];
        const options = rawOptions
          .map((option): CreatePresetChoiceOptionCommand | null => {
            if (typeof option === "string" || typeof option === "number" || typeof option === "boolean") {
              const text = String(option).trim();
              return text ? { label: text, value: text } : null;
            }
            if (!option || typeof option !== "object") return null;
            const optionData = option as Record<string, unknown>;
            const label =
              typeof optionData.label === "string"
                ? optionData.label.trim()
                : typeof optionData.value === "string"
                  ? optionData.value.trim()
                  : "";
            const value =
              typeof optionData.value === "string"
                ? optionData.value
                : typeof optionData.label === "string"
                  ? optionData.label
                  : "";
            if (!label || !value) return null;
            return {
              id: typeof optionData.id === "string" ? optionData.id.trim() : undefined,
              label,
              value,
            };
          })
          .filter((option): option is CreatePresetChoiceOptionCommand => option !== null);
        if (!variableName || !question || options.length === 0) return null;
        return {
          variableName,
          question,
          options,
          multiSelect: typeof data.multiSelect === "boolean" ? data.multiSelect : undefined,
          separator: typeof data.separator === "string" ? data.separator : undefined,
          randomPick: typeof data.randomPick === "boolean" ? data.randomPick : undefined,
          displayMode:
            data.displayMode === "auto" || data.displayMode === "buttons" || data.displayMode === "listbox"
              ? data.displayMode
              : undefined,
          optionSort:
            data.optionSort === "manual" || data.optionSort === "alphabetical" ? data.optionSort : undefined,
        };
      })
      .filter((choiceBlock): choiceBlock is CreatePresetChoiceBlockCommand => choiceBlock !== null);

    return {
      type: "create_preset",
      name,
      description: typeof parsed.description === "string" ? parsed.description : undefined,
      wrapFormat: parsePresetWrapFormat(parsed.wrapFormat),
      author: typeof parsed.author === "string" ? parsed.author : undefined,
      groups: groups.length ? groups : undefined,
      sections: sections.length ? sections : undefined,
      choiceBlocks: choiceBlocks.length ? choiceBlocks : undefined,
    };
  } catch {
    return null;
  }
}

function parseNumberParam(params: string, key: string): number | undefined {
  const match = params.match(new RegExp(`${key}=(-?[0-9]+(?:\.[0-9]+)?)`, "i"));
  if (!match) return undefined;
  const value = Number.parseFloat(match[1] ?? "");
  return Number.isFinite(value) ? value : undefined;
}

function applyCommonCharacterFields(
  cmd: CreateCharacterCommand | UpdateCharacterCommand,
  params: string,
  options: { allowEmptyStrings: boolean },
) {
  const readText = (key: string) => parseQuotedParam(params, key, options.allowEmptyStrings);
  const assignText = <K extends keyof CreateCharacterCommand & keyof UpdateCharacterCommand>(
    key: K,
    paramName: string,
  ) => {
    const value = readText(paramName);
    if (value !== undefined) {
      cmd[key] = value as CreateCharacterCommand[K] & UpdateCharacterCommand[K];
    }
  };

  assignText("description", "description");
  assignText("personality", "personality");
  assignText("firstMessage", "first_message");
  assignText("scenario", "scenario");
  assignText("backstory", "backstory");
  assignText("appearance", "appearance");
  assignText("aboutMe", "about_me");
  assignText("mesExample", "mes_example");
  assignText("creatorNotes", "creator_notes");
  assignText("systemPrompt", "system_prompt");
  assignText("postHistoryInstructions", "post_history_instructions");
  assignText("creator", "creator");
  assignText("characterVersion", "character_version");
  assignText("world", "world");
  assignText("depthPrompt", "depth_prompt");

  const tags = parseStringList(readText("tags"));
  if (tags !== undefined) cmd.tags = tags;

  const alternateGreetings = parseStringList(readText("alternate_greetings"));
  if (alternateGreetings !== undefined) cmd.alternateGreetings = alternateGreetings;

  const talkativeness = parseNumberParam(params, "talkativeness");
  if (talkativeness !== undefined) {
    cmd.talkativeness = Math.max(0, Math.min(1, talkativeness));
  }

  const fav = parseBooleanParam(params, "fav");
  if (fav !== undefined) cmd.fav = fav;

  const depthPromptDepth = parseNumberParam(params, "depth_prompt_depth");
  if (depthPromptDepth !== undefined) {
    cmd.depthPromptDepth = Math.max(0, Math.floor(depthPromptDepth));
  }

  const depthPromptRole = readText("depth_prompt_role");
  if (depthPromptRole === "system" || depthPromptRole === "user" || depthPromptRole === "assistant") {
    cmd.depthPromptRole = depthPromptRole;
  }
}
/**
 * Parse all character commands from a message and return the cleaned message
 * with commands stripped out.
 */
export function parseCharacterCommands(content: string): {
  cleanContent: string;
  commands: CharacterCommand[];
} {
  const commands: CharacterCommand[] = [];

  // Parse schedule_update commands
  for (const match of content.matchAll(SCHEDULE_UPDATE_RE)) {
    const params = match[1]!;
    const cmd: ScheduleUpdateCommand = { type: "schedule_update" };

    const statusMatch = params.match(/status="([^"]+)"/);
    if (statusMatch) {
      const s = statusMatch[1]!.toLowerCase();
      if (["online", "idle", "dnd", "offline"].includes(s)) {
        cmd.status = s as ScheduleUpdateCommand["status"];
      }
    }

    const activityMatch = params.match(/activity="([^"]+)"/);
    if (activityMatch) cmd.activity = activityMatch[1]!;

    const durationMatch = params.match(/duration="([^"]+)"/);
    if (durationMatch) cmd.duration = durationMatch[1]!;

    commands.push(cmd);
  }

  // Parse cross_post commands
  for (const match of content.matchAll(CROSS_POST_RE)) {
    commands.push({ type: "cross_post", target: match[1]! });
  }

  // Parse selfie commands
  for (const match of content.matchAll(SELFIE_RE)) {
    const context = (match[1] ?? match[2] ?? match[3])?.trim();
    commands.push({ type: "selfie", context: context || undefined });
  }

  // Parse memory commands
  for (const match of content.matchAll(MEMORY_RE)) {
    commands.push({ type: "memory", target: match[1]!, summary: match[2]! });
  }

  // Parse scene commands
  for (const match of content.matchAll(SCENE_RE)) {
    const params = match[1]!;
    const cmd: SceneCommand = { type: "scene", scenario: "" };

    const scenarioMatch = params.match(/scenario="([^"]+)"/);
    if (scenarioMatch) cmd.scenario = scenarioMatch[1]!;

    const bgMatch = params.match(/background="([^"]+)"/);
    if (bgMatch) cmd.background = bgMatch[1]!;

    const planMatch = params.match(/plan="([^"]+)"/);
    if (planMatch) cmd.plan = planMatch[1]!;

    // Only add if we got a scenario
    if (cmd.scenario) commands.push(cmd);
  }

  // Parse call command — ring the user for an audio call. Only one per message.
  for (const match of content.matchAll(CALL_RE)) {
    const params = match[1] ?? "";
    const reason = parseQuotedParam(params, "reason");
    const greeting = parseQuotedParam(params, "greeting") ?? parseQuotedParam(params, "message");
    const legacyReason = reason || greeting ? "" : params.replace(/^"|"$/g, "").trim();
    commands.push({
      type: "call",
      reason: reason || legacyReason || undefined,
      greeting: greeting || undefined,
    });
    break;
  }

  commands.push(...parseCapabilityConversationCommands(content));

  // Parse influence commands (<influence>text</influence>)
  for (const match of content.matchAll(INFLUENCE_RE)) {
    const text = stripConversationPromptTimestamps(match[1]!.trim());
    if (text) commands.push({ type: "influence", content: text });
  }

  // Backward compatibility for older prompts that described this as [influence: summary="..."].
  for (const match of content.matchAll(INFLUENCE_BRACKET_RE)) {
    const text = stripConversationPromptTimestamps(parseCommandTextParam(match[1]!, ["summary", "text", "content"]));
    if (text) commands.push({ type: "influence", content: text });
  }

  // Parse note commands (<note>text</note>)
  for (const match of content.matchAll(NOTE_RE)) {
    const text = stripConversationPromptTimestamps(match[1]!.trim());
    if (text) commands.push({ type: "note", content: text });
  }

  // Backward compatibility for older prompts that described this as [note: text="..."].
  for (const match of content.matchAll(NOTE_BRACKET_RE)) {
    const text = stripConversationPromptTimestamps(parseCommandTextParam(match[1]!, ["text", "summary", "content"]));
    if (text) commands.push({ type: "note", content: text });
  }

  // Parse haptic commands
  for (const match of content.matchAll(HAPTIC_RE)) {
    const params = match[1]!;
    const cmd: HapticCommand = { type: "haptic", action: "vibrate" };
    const actionMatch = params.match(/action="([^"]+)"/);
    if (actionMatch) {
      const a = actionMatch[1]!.toLowerCase();
      if (["vibrate", "oscillate", "rotate", "position", "stop"].includes(a)) {
        cmd.action = a as HapticCommand["action"];
      }
    }
    const intensityMatch = params.match(/intensity=([0-9.]+)/);
    if (intensityMatch) {
      const v = parseFloat(intensityMatch[1]!);
      if (Number.isFinite(v)) cmd.intensity = Math.max(0, Math.min(1, v));
    }
    const durationMatch = params.match(/duration=([0-9.]+)/);
    if (durationMatch) {
      const v = parseFloat(durationMatch[1]!);
      if (Number.isFinite(v)) cmd.duration = Math.max(0, v);
    }
    commands.push(cmd);
  }

  // Parse Spotify song commands
  for (const match of content.matchAll(SPOTIFY_RE)) {
    const params = match[1]!;
    const title = parseQuotedParam(params, "title");
    const artist = parseQuotedParam(params, "artist");
    if (title && artist) {
      commands.push({ type: "spotify", title, artist });
    }
  }

  // Parse YouTube song commands
  for (const match of content.matchAll(YOUTUBE_RE)) {
    const params = match[1]!;
    const query =
      parseQuotedParam(params, "query") ??
      [parseQuotedParam(params, "title"), parseQuotedParam(params, "artist")].filter(Boolean).join(" ");
    if (query) {
      commands.push({ type: "youtube", query });
    }
  }

  // Parse reaction commands — react with an emoji to the user's latest message,
  // or to a specific character's most recent part via the `to "Name"` suffix.
  for (const match of content.matchAll(REACT_RE)) {
    const parsed = parseReactBody(match[1]!);
    if (parsed) commands.push({ type: "react", ...parsed });
  }

  // Parse assistant commands (Professor Mari)
  for (const match of content.matchAll(CREATE_PERSONA_RE)) {
    const params = match[1]!;
    const cmd: CreatePersonaCommand = { type: "create_persona", name: "" };
    const name = parseQuotedParam(params, "name");
    if (name) cmd.name = name;
    const description = parseQuotedParam(params, "description");
    if (description) cmd.description = description;
    const personality = parseQuotedParam(params, "personality");
    if (personality) cmd.personality = personality;
    const appearance = parseQuotedParam(params, "appearance");
    if (appearance) cmd.appearance = appearance;
    const aboutMe = parseQuotedParam(params, "about_me");
    if (aboutMe) cmd.aboutMe = aboutMe;
    if (cmd.name) commands.push(cmd);
  }

  for (const match of content.matchAll(CREATE_CHARACTER_RE)) {
    const params = match[1]!;
    const cmd: CreateCharacterCommand = { type: "create_character", name: "" };
    const name = parseQuotedParam(params, "name");
    if (name) cmd.name = name;
    applyCommonCharacterFields(cmd, params, { allowEmptyStrings: false });
    if (cmd.name) commands.push(cmd);
  }

  for (const match of content.matchAll(UPDATE_CHARACTER_RE)) {
    const params = match[1]!;
    const cmd: UpdateCharacterCommand = { type: "update_character", name: "" };
    const name = parseQuotedParam(params, "name");
    if (name) cmd.name = name;
    applyCommonCharacterFields(cmd, params, { allowEmptyStrings: true });
    if (cmd.name) commands.push(cmd);
  }

  for (const match of content.matchAll(UPDATE_PERSONA_RE)) {
    const params = match[1]!;
    const cmd: UpdatePersonaCommand = { type: "update_persona", name: "" };
    const name = parseQuotedParam(params, "name");
    if (name) cmd.name = name;
    const description = parseQuotedParam(params, "description", true);
    if (description !== undefined) cmd.description = description;
    const personality = parseQuotedParam(params, "personality", true);
    if (personality !== undefined) cmd.personality = personality;
    const appearance = parseQuotedParam(params, "appearance", true);
    if (appearance !== undefined) cmd.appearance = appearance;
    const scenario = parseQuotedParam(params, "scenario", true);
    if (scenario !== undefined) cmd.scenario = scenario;
    const backstory = parseQuotedParam(params, "backstory", true);
    if (backstory !== undefined) cmd.backstory = backstory;
    const aboutMe = parseQuotedParam(params, "about_me", true);
    if (aboutMe !== undefined) cmd.aboutMe = aboutMe;
    if (cmd.name) commands.push(cmd);
  }

  for (const match of content.matchAll(CREATE_LOREBOOK_BLOCK_RE)) {
    const cmd = parseLorebookBlock(match[1] ?? "");
    if (cmd) commands.push(cmd);
  }

  for (const match of content.matchAll(UPDATE_LOREBOOK_BLOCK_RE)) {
    const cmd = parseUpdateLorebookBlock(match[1] ?? "");
    if (cmd) commands.push(cmd);
  }

  for (const match of content.matchAll(CREATE_PRESET_BLOCK_RE)) {
    const cmd = parseCreatePresetBlock(match[1] ?? "");
    if (cmd) commands.push(cmd);
  }

  for (const match of content.matchAll(SUGGESTIONS_BLOCK_RE)) {
    const suggestions = parseLenientJsonValue(match[1] ?? "");
    if (suggestions !== null) commands.push({ type: "suggestions", suggestions });
  }

  for (const suggestionsBlock of findBracketJsonCommandBlocks(content, "suggestions")) {
    const suggestions = parseLenientJsonValue(suggestionsBlock);
    if (suggestions !== null) commands.push({ type: "suggestions", suggestions });
  }

  for (const match of content.matchAll(PLAN_BLOCK_RE)) {
    const plan = parseLenientJsonValue(match[1] ?? "");
    if (plan !== null) commands.push({ type: "plan", plan });
  }

  for (const planBlock of findBracketJsonCommandBlocks(content, "plan")) {
    const plan = parseLenientJsonValue(planBlock);
    if (plan !== null) commands.push({ type: "plan", plan });
  }

  for (const match of content.matchAll(CREATE_LOREBOOK_RE)) {
    const params = match[1]!;
    const name = parseQuotedParam(params, "name");
    if (!name) continue;
    const entriesParam = parseQuotedParam(params, "entries");
    commands.push({
      type: "create_lorebook",
      name,
      description: parseQuotedParam(params, "description"),
      category: parseQuotedParam(params, "category"),
      tags: parseStringList(parseQuotedParam(params, "tags")),
      entries: entriesParam ? parseLorebookEntriesParam(entriesParam) : undefined,
    });
  }

  for (const match of content.matchAll(CREATE_CHAT_RE)) {
    const params = match[1]!;
    const cmd: CreateChatCommand = { type: "create_chat", character: "" };
    const charMatch = params.match(/character="([^"]+)"/);
    if (charMatch) cmd.character = charMatch[1]!;
    const modeMatch = params.match(/mode="([^"]+)"/);
    if (modeMatch && (modeMatch[1] === "conversation" || modeMatch[1] === "roleplay")) {
      cmd.mode = modeMatch[1];
    }
    if (cmd.character) commands.push(cmd);
  }

  for (const match of content.matchAll(NAVIGATE_RE)) {
    const params = match[1]!;
    const cmd: NavigateCommand = { type: "navigate", panel: "" };
    const panelMatch = params.match(/panel="([^"]+)"/);
    if (panelMatch) cmd.panel = panelMatch[1]!;
    const tabMatch = params.match(/tab="([^"]+)"/);
    if (tabMatch) cmd.tab = tabMatch[1]!;
    if (cmd.panel) commands.push(cmd);
  }

  for (const match of content.matchAll(FETCH_RE)) {
    const params = match[1]!;
    const cmd: FetchCommand = { type: "fetch", fetchType: "character", name: "" };
    const typeMatch = params.match(/type="([^"]+)"/);
    if (typeMatch) {
      const t = typeMatch[1]!.toLowerCase();
      if (["character", "persona", "lorebook", "chat", "preset"].includes(t)) {
        cmd.fetchType = t as FetchCommand["fetchType"];
      }
    }
    const nameMatch = params.match(/name="([^"]+)"/);
    if (nameMatch) cmd.name = nameMatch[1]!;
    if (cmd.name) commands.push(cmd);
  }

  // Strip all commands from the visible content
  let cleanContent = stripCapabilityConversationCommands(content)
    .replace(SCHEDULE_UPDATE_RE, "")
    .replace(CROSS_POST_RE, "")
    .replace(SELFIE_RE, "")
    .replace(MEMORY_RE, "")
    .replace(SCENE_RE, "")
    .replace(CALL_RE, "")
    .replace(HAPTIC_RE, "")
    .replace(SPOTIFY_RE, "")
    .replace(YOUTUBE_RE, "")
    // Only strip react tags that actually parse into a command — bodies
    // parseReactBody rejects (junk prose with quotes, unterminated quotes)
    // stay visible, matching the old stricter grammar's behavior.
    .replace(REACT_RE, (match, reactBody: string) => (parseReactBody(reactBody) ? "" : match))
    .replace(INFLUENCE_RE, "")
    .replace(NOTE_RE, "")
    .replace(INFLUENCE_BRACKET_RE, "")
    .replace(NOTE_BRACKET_RE, "")
    .replace(CREATE_PERSONA_RE, "")
    .replace(CREATE_CHARACTER_RE, "")
    .replace(UPDATE_CHARACTER_RE, "")
    .replace(UPDATE_PERSONA_RE, "")
    .replace(CREATE_LOREBOOK_BLOCK_RE, "")
    .replace(UPDATE_LOREBOOK_BLOCK_RE, "")
    .replace(CREATE_PRESET_BLOCK_RE, "")
    .replace(SUGGESTIONS_BLOCK_RE, "")
    .replace(PLAN_BLOCK_RE, "")
    .replace(CREATE_LOREBOOK_RE, "")
    .replace(CREATE_CHAT_RE, "")
    .replace(NAVIGATE_RE, "")
    .replace(FETCH_RE, "")
    .replace(/\n{3,}/g, "\n\n") // collapse excessive newlines left by removals
    .trim();
  cleanContent = stripBracketJsonCommandBlocks(cleanContent, "suggestions").replace(/\n{3,}/g, "\n\n").trim();
  cleanContent = stripBracketJsonCommandBlocks(cleanContent, "plan").replace(/\n{3,}/g, "\n\n").trim();

  return { cleanContent, commands };
}

/**
 * Parse character commands from a merged group response, attributing each command
 * to the character whose `Name:` line-prefixed segment it appears in.
 *
 * Conversation-mode group chats use "merged" generation: a single response carries
 * multiple characters' turns, each introduced by a `CharacterName: ` line prefix
 * (the same format the client splits on for display — see parseNamePrefixFormat).
 * The base parseCharacterCommands() attributes every command to one character, so a
 * command emitted by, say, the third character (e.g. `[selfie]`) is wrongly executed
 * for the first. This segments the response the same way and matches each parsed
 * command back to its segment so it is attributed to its actual speaker.
 *
 * The authoritative command list and cleaned content come from a single whole-response
 * parse, so no command is dropped or reordered even if one spans a name boundary;
 * only the attribution is layered on. Commands with no matching segment fall back
 * to `fallbackCharacterId`. Text ABOVE the first recognised name prefix is credited
 * to the first named section's speaker (models park reply-opening commands like a
 * `[react:]` header there, and crediting the generation-primary character instead
 * deterministically mis-attributed every such command to the chat's first
 * character — #3220); with no named sections at all it falls back as before.
 */
export function parseCharacterCommandsBySpeaker(
  content: string,
  knownCharacters: ReadonlyArray<{ id: string; name: string }>,
  fallbackCharacterId: string | null,
): { commands: CharacterCommand[]; commandCharacterIds: (string | null)[]; cleanContent: string } {
  const base = parseCharacterCommands(content);

  const nameToId = new Map<string, string>();
  for (const character of knownCharacters) {
    const key = normalizeTextForMatch(character.name);
    if (key && !nameToId.has(key)) nameToId.set(key, character.id);
  }

  // Segment the response by leading "Name: " line prefixes, mirroring the client's
  // parseNamePrefixFormat so server-side attribution matches the rendered split.
  // Segment the timestamp-stripped shape — the client strips leaked [HH:MM]
  // tokens before rendering, so a line like "[12:01] Alice: hey" is Alice's
  // section on screen and must be Alice's for attribution too. (Attribution
  // only: commands and cleanContent still come from the raw whole-response
  // parse above, and the strip never touches [command:] tokens.)
  const attributionContent = stripLeadingMessageTimestamps(content);
  const segments: Array<{ characterId: string | null; text: string; leading?: boolean }> = [];
  let currentId: string | null = fallbackCharacterId;
  let inLeadingRegion = true;
  let currentLines: string[] = [];
  const flush = () => {
    if (currentLines.length > 0) {
      segments.push({
        characterId: currentId,
        text: currentLines.join("\n"),
        ...(inLeadingRegion ? { leading: true } : {}),
      });
    }
    currentLines = [];
  };
  for (const line of attributionContent.split("\n")) {
    const colonIdx = line.indexOf(": ");
    if (colonIdx > 0) {
      const mappedId = nameToId.get(normalizeTextForMatch(line.slice(0, colonIdx)));
      if (mappedId) {
        flush();
        inLeadingRegion = false;
        currentId = mappedId;
        currentLines = [line.slice(colonIdx + 2)];
        continue;
      }
    }
    currentLines.push(line);
  }
  flush();

  // Credit the leading region (above the first name prefix) to the speaker whose
  // section it opens, not the generation-primary character.
  const firstNamed = segments.find((segment) => !segment.leading);
  if (firstNamed) {
    for (const segment of segments) {
      if (segment.leading) segment.characterId = firstNamed.characterId;
    }
  }

  // Build a per-command attribution queue keyed by command shape, consumed in
  // segment order so duplicate commands attribute left-to-right.
  const attributionQueue = new Map<string, (string | null)[]>();
  for (const segment of segments) {
    for (const command of parseCharacterCommands(segment.text).commands) {
      const key = JSON.stringify(command);
      const queue = attributionQueue.get(key) ?? [];
      queue.push(segment.characterId);
      attributionQueue.set(key, queue);
    }
  }

  const commandCharacterIds = base.commands.map((command) => {
    const queue = attributionQueue.get(JSON.stringify(command));
    const matched = queue?.shift();
    return matched === undefined ? fallbackCharacterId : matched;
  });

  return { commands: base.commands, commandCharacterIds, cleanContent: base.cleanContent };
}

/** Parse Roleplay-only direct-message commands without enabling the wider Conversation command set. */
export function parseDirectMessageCommands(content: string): {
  cleanContent: string;
  commands: DirectMessageCommand[];
} {
  const commands: DirectMessageCommand[] = [];

  for (const match of content.matchAll(DIRECT_MESSAGE_RE)) {
    const params = match[1]!;
    const character = parseQuotedParam(params, "character");
    const message = parseQuotedParam(params, "message");
    const cleanMessage = message ? stripConversationPromptTimestamps(message.trim()) : "";
    if (character && cleanMessage) {
      commands.push({ type: "dm", character, message: cleanMessage, raw: match[0] });
    }
  }

  const cleanContent = content
    .replace(DIRECT_MESSAGE_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { cleanContent, commands };
}

/**
 * Parse a duration string like "2h", "30m", "1h30m" into minutes.
 * Returns null if unparseable.
 */
export function parseDuration(duration: string): number | null {
  const hourMatch = duration.match(/(\d+)\s*h/i);
  const minMatch = duration.match(/(\d+)\s*m/i);

  let total = 0;
  if (hourMatch) total += parseInt(hourMatch[1]!) * 60;
  if (minMatch) total += parseInt(minMatch[1]!);

  return total > 0 ? total : null;
}
