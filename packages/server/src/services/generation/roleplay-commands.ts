import { currentRoomGeneration } from "../multiplayer/generation-policy.js";
import {
  isRoleplayCommandEnabled,
  isRoleplayCommandAllowed,
  getRoleplayPrivateCommands,
  getRoleplayCommandActivity,
  getRoleplayWhispers,
  getRoleplayDocuments,
  getRoleplayCommandContentOffset,
  ROLEPLAY_COMMAND_KEYS,
  normalizeChatSummaryEntries,
  readMessagePrivateNote,
  readMessagePrivateNoteRecipientId,
  type RoleplayCommandKey,
  type RoleplayCommand,
  type RoleplayCommandActivity,
  type RoleplayWhisperRecipient,
  type WrapFormat,
} from "@marinara-engine/shared";
import { parseQuotedParam } from "../conversation/character-commands.js";
import { wrapContent } from "../prompt/format-engine.js";
import { normalizeCharacterLookupName } from "../game/name-normalization.js";
import { parseExtra } from "./prompt-attachments.js";
import {
  dropPromptHistoryMessages,
  WHISPER_ONLY_PLACEHOLDER,
  type GenerationPromptMessage,
} from "./prompt-message-scope.js";

export type { RoleplayCommand } from "@marinara-engine/shared";

const COMMAND_NAMES = [...ROLEPLAY_COMMAND_KEYS, "dismiss_notes", "dismiss_memory"];
const COMMAND_START = new RegExp(`\\[(${COMMAND_NAMES.join("|")})(?=\\s|:|\\]|$)\\s*:?\\s*`, "giu");
const PREFIXES = COMMAND_NAMES.map((name) => `[${name}`);
const MAX_COMMAND_LENGTH = 32_000;

export function roleplayCommandKey(command: RoleplayCommand): RoleplayCommandKey {
  if (command.type === "dismiss_notes") return "notes";
  if (command.type === "dismiss_memory") return "memory";
  return command.type;
}

/** A quote-aware scanner: a note or document may itself contain brackets and newlines. */
function commandEnd(text: string, start: number): number {
  let quote = "";
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const char = text[i]!;
    if (quote) {
      if (char === "\\") i++;
      else if (char === quote) quote = "";
    } else if (char === '"' || char === "“") {
      quote = char === "“" ? "”" : char;
    } else if (char === "[") depth++;
    else if (char === "]" && --depth === 0) return i + 1;
  }
  return -1;
}

function readCommand(type: string, body: string): RoleplayCommand | null {
  const field = (key: string, limit: number) => {
    const value = parseQuotedParam(body, key)?.trim() ?? "";
    return value.length <= limit ? value : "";
  };
  const content = field("content", type === "notes" ? 8_000 : type === "memory" ? 1_000 : 16_000);
  switch (type) {
    case "notes":
      return content ? { type, content } : null;
    case "dismiss_notes":
      return { type };
    case "memory": {
      const id = field("id", 80);
      return id && content ? { type, id, content } : null;
    }
    case "dismiss_memory": {
      const id = field("id", 80);
      return id ? { type, id } : null;
    }
    case "illustrate": {
      const subject = field("subject", 4_000);
      const characters = field("characters", 2_000)
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
      return subject ? { type, subject, ...(characters.length ? { characters } : {}) } : null;
    }
    case "document": {
      const title = field("title", 200);
      return title && content ? { type, title, content, documentType: field("kind", 60) || "document" } : null;
    }
    case "sound": {
      const description = field("description", 1_000);
      return description ? { type, description } : null;
    }
    case "music": {
      const mood = field("mood", 1_000);
      return mood ? { type, mood } : null;
    }
    case "roll": {
      const notation = field("notation", 80) || field("dice", 80);
      const character = field("character", 200);
      const attribute = field("attribute", 100);
      const numbers: { modifier?: number; dc?: number } = {};
      for (const key of ["modifier", "dc"] as const) {
        const raw = parseQuotedParam(body, key, true);
        if (raw === undefined) continue;
        if (!/^[+-]?\d+$/u.test(raw.trim()) || !Number.isSafeInteger(Number(raw))) return null;
        numbers[key] = Number(raw);
      }
      return notation
        ? {
            type,
            notation,
            reason: field("reason", 500),
            ...(character ? { character } : {}),
            ...(attribute ? { attribute } : {}),
            ...numbers,
          }
        : null;
    }
    case "combat":
      return { type };
    case "interrupt": {
      const part = field("part", 8_000);
      return part ? { type, part } : null;
    }
    case "whisper": {
      const character = field("character", 200);
      const text = field("text", 16_000);
      return character && text ? { type, character, text } : null;
    }
    default:
      return null;
  }
}

function parseCommands(
  text: string,
  userPrivateOnly = false,
): {
  content: string;
  commands: RoleplayCommand[];
  activity: RoleplayCommandActivity[];
  invalid: number;
  roll?: { command: Extract<RoleplayCommand, { type: "roll" }>; start: number; end: number };
  /** Where each command was in `content`, kept apart so only whispers save a place. */
  positions: Map<RoleplayCommandActivity, number>;
} {
  const commands: RoleplayCommand[] = [];
  const activity: RoleplayCommandActivity[] = [];
  const positions = new Map<RoleplayCommandActivity, number>();
  let content = "";
  let cursor = 0;
  let invalid = 0;
  const recordInvalid = (type: string, raw: string) => {
    invalid++;
    if (!userPrivateOnly) return;
    const previous = activity.find((item) => item.error === "roleplay.commands.errors.invalidPrivate");
    if (previous) previous.raw += `\n${raw}`;
    else
      activity.push({
        command: type === "whisper" ? { type: "whisper", character: "", text: "" } : { type: "notes", content: "" },
        raw,
        error: "roleplay.commands.errors.invalidPrivate",
      });
  };
  let roll: { command: Extract<RoleplayCommand, { type: "roll" }>; start: number; end: number } | undefined;
  const starts = userPrivateOnly ? /\[(whisper|notes)(?=\s|:|\]|$)\s*:?\s*/giu : new RegExp(COMMAND_START);
  let match: RegExpExecArray | null;
  while ((match = starts.exec(text))) {
    // DMs retain their existing resolver and visible fallback for invalid targets.
    if (match[1]!.toLowerCase() === "dm") continue;
    content += text.slice(cursor, match.index);
    const end = commandEnd(text, match.index);
    if (end < 0) {
      recordInvalid(match[1]!.toLowerCase(), text.slice(match.index));
      cursor = text.length;
      break;
    }
    const body = text.slice(match.index + match[0].length, end - 1);
    const command = end - match.index <= MAX_COMMAND_LENGTH ? readCommand(match[1]!.toLowerCase(), body) : null;
    if (command && commands.length < 24) {
      commands.push(command);
      const item = {
        command,
        raw: text.slice(match.index, end),
        ...(command.type === "whisper" ? { contentOffset: content.length } : {}),
      };
      activity.push(item);
      positions.set(item, content.length);
      if (command.type === "roll" && !roll) roll = { command, start: match.index, end };
    } else recordInvalid(match[1]!.toLowerCase(), text.slice(match.index, end));
    cursor = end;
    starts.lastIndex = end;
  }
  content += text.slice(cursor);
  const lastBracket = content.lastIndexOf("[");
  const suffix = content.slice(lastBracket).toLowerCase();
  if (
    !userPrivateOnly &&
    lastBracket >= 0 &&
    suffix !== "[" &&
    PREFIXES.some((prefix) => prefix !== "[dm" && prefix.startsWith(suffix))
  ) {
    recordInvalid("[whisper".startsWith(suffix) ? "whisper" : "notes", content.slice(lastBracket));
    content = content.slice(0, lastBracket);
  }
  return { content, commands, activity, invalid, roll, positions };
}

export function parseRoleplayCommands(text: string) {
  return parseCommands(text);
}

/** User-authored private tags are never public, including disabled, malformed, or unfinished ones. */
export function parseRoleplayUserCommands(text: string) {
  return parseCommands(text, true);
}

/**
 * Preserve per-swipe activities; new user tags can only write notes or whisper to a current character, or, with
 * `persona` (a character's or narrator's message being edited), to the persona as that message's own whispers can.
 */
export function prepareUserRoleplayCommands(args: {
  content: string;
  extra: Record<string, unknown>;
  metadata: Record<string, unknown>;
  characters: readonly { id: string; name: string }[];
  persona?: { id: string; name: string };
}): { content: string; extra: Record<string, unknown> } {
  const parsed = parseRoleplayUserCommands(args.content);
  if (!parsed.activity.length) return { content: parsed.content, extra: args.extra };
  for (const activity of parsed.activity) {
    if (activity.error) continue;
    if (!isRoleplayCommandEnabled(args.metadata, roleplayCommandKey(activity.command))) {
      activity.error = "roleplay.commands.errors.disabled";
    } else if (activity.command.type === "whisper") {
      const recipientName = normalizeCharacterLookupName(activity.command.character);
      const matches = args.characters.filter(
        (character) => normalizeCharacterLookupName(character.name) === recipientName,
      );
      const recipient = args.persona
        ? resolveRoleplayWhisperRecipient(activity.command.character, args.characters, args.persona)
        : matches.length === 1
          ? ({ id: matches[0]!.id, kind: "character" } as const)
          : null;
      if (recipient) activity.whisperRecipient = recipient;
      else activity.error = "roleplay.commands.errors.whisperRecipient";
    }
    if (activity.command.type === "whisper") {
      const offset = activity.contentOffset ?? parsed.content.length;
      activity.contentAnchor =
        offset === 0 ? parsed.content.slice(0, 80) : parsed.content.slice(Math.max(0, offset - 80), offset);
    }
  }
  return {
    content: parsed.content,
    extra: {
      ...args.extra,
      roleplayCommandActivity: [...getRoleplayCommandActivity(args.extra), ...parsed.activity],
      roleplayPrivateCommands: null,
      roleplayDocuments: null,
    },
  };
}

/** Hold possible prefixes across chunks so private command text never flashes in the chat. */
export class RoleplayCommandStreamFilter {
  private pending = "";
  private dropping = false;
  rollRequested = false;
  constructor(private stopAtRoll = false) {}

  push(chunk: string): string {
    if (this.dropping) return "";
    this.pending += chunk;
    let visible = "";
    while (this.pending) {
      const match = new RegExp(COMMAND_START).exec(this.pending);
      if (match) {
        visible += this.pending.slice(0, match.index);
        this.pending = this.pending.slice(match.index);
        const end = commandEnd(this.pending, 0);
        if (end < 0) {
          if (this.pending.length > MAX_COMMAND_LENGTH) {
            this.dropping = true;
            this.pending = "";
          }
          return visible;
        }
        this.pending = this.pending.slice(end);
        if (this.stopAtRoll && match[1]!.toLowerCase() === "roll") {
          this.rollRequested = true;
          this.dropping = true;
          this.pending = "";
          return visible;
        }
      } else {
        const lastBracket = this.pending.lastIndexOf("[");
        const suffix = this.pending.slice(lastBracket).toLowerCase();
        const keep =
          lastBracket >= 0 &&
          PREFIXES.some(
            (prefix) =>
              prefix.startsWith(suffix) || (suffix.startsWith(prefix) && /^\s*$/.test(suffix.slice(prefix.length))),
          );
        if (keep) {
          visible += this.pending.slice(0, lastBracket);
          this.pending = this.pending.slice(lastBracket);
        } else {
          visible += this.pending;
          this.pending = "";
        }
        break;
      }
    }
    return visible;
  }

  flush(): string {
    // An incomplete reserved command is private too.
    const visible = this.pending === "[" ? "[" : "";
    this.pending = "";
    return visible;
  }
}

const USER_NOTES_OWNER = Symbol("user personal notes");

type PersonalState = { notes: string; reminders: Map<string, string> };
type HistoryMessage = { id?: unknown; role?: unknown; characterId?: unknown; content?: unknown; extra?: unknown };

export function resolveRoleplayWhisperRecipient(
  name: string,
  characters: readonly { id: string; name: string }[],
  persona: { id: string; name: string },
): RoleplayWhisperRecipient | null {
  const room = currentRoomGeneration();
  const personas = room
    ? room.participants.map((participant) => ({ id: participant.id, name: participant.persona.name }))
    : [persona];
  const participants = [
    ...characters
      .filter((character) => !personas.some((person) => person.id === character.id))
      .map((character) => ({ ...character, kind: "character" as const })),
    ...personas.map((person) => ({ ...person, kind: "persona" as const })),
  ];
  const matches = participants.filter(
    (participant) => normalizeCharacterLookupName(participant.name) === normalizeCharacterLookupName(name),
  );
  const match = matches.length === 1 ? matches[0] : undefined;
  return match ? { id: match.id, kind: match.kind } : null;
}

/**
 * Messages hidden from this character through its own hide list that still carry a whisper to it.
 * A whisper always reaches its recipient; hiding from everyone still removes it (#7191).
 */
export function roleplayHiddenWhisperMessageIds(
  history: readonly HistoryMessage[],
  characterId: string | null,
): Set<string> {
  const ids = new Set<string>();
  if (!characterId) return ids;
  for (const message of history) {
    const extra = parseExtra(message.extra);
    if (
      typeof message.id === "string" &&
      (message.role === "assistant" || message.role === "user") &&
      extra.hiddenFromAI !== true &&
      Array.isArray(extra.hiddenFromAICharacterIds) &&
      extra.hiddenFromAICharacterIds.includes(characterId) &&
      getRoleplayWhispers(extra).some(({ recipient }) => recipient.kind === "character" && recipient.id === characterId)
    )
      ids.add(message.id);
  }
  return ids;
}

/** A message's visible text, without private tags the user may have typed into it. */
function visibleBody(message: HistoryMessage): string {
  const content = typeof message.content === "string" ? message.content : "";
  return message.role === "user" ? parseRoleplayUserCommands(content).content : content;
}

/**
 * Messages that hold only a whisper, with no text or attachment. Advanced Memory keeps no empty message,
 * so it adds these to its window separately (see selectAdvancedMemoryWhisperOnlyIds).
 */
export function roleplayWhisperOnlyMessageIds(history: readonly HistoryMessage[]): Set<string> {
  const ids = new Set<string>();
  for (const message of history) {
    const extra = parseExtra(message.extra);
    if (
      typeof message.id === "string" &&
      (message.role === "assistant" || message.role === "user") &&
      extra.hiddenFromAI !== true &&
      extra.commandOnly !== true &&
      !visibleBody(message).trim() &&
      !(Array.isArray(extra.attachments) && extra.attachments.length > 0) &&
      !getRoleplayDocuments(extra).length &&
      getRoleplayWhispers(extra).length > 0
    )
      ids.add(message.id);
  }
  return ids;
}

/** The latest user turn's text for macros and searches. A turn that is only a whisper has none to share. */
export function latestRoleplayUserInput(
  messages: readonly { role: string; content: string }[],
  history: readonly HistoryMessage[],
): string | undefined {
  const message = [...messages].reverse().find((candidate) => candidate.role === "user");
  const id = (message as { id?: unknown } | undefined)?.id;
  return typeof id === "string" && roleplayWhisperOnlyMessageIds(history.filter((source) => source.id === id)).has(id)
    ? ""
    : message?.content;
}

type RoleplayWhisper = ReturnType<typeof getRoleplayWhispers>[number];

/**
 * Where each whisper goes in `text`, a prompt body built from `source`, earliest first. History wrappers shift
 * saved offsets, so the unchanged source body comes first, then edit anchors. A stand-in's body, like a
 * whisper-only message's, is its placeholder, and its whispers follow the placeholder, since their saved offsets
 * point into text the prompt does not show.
 */
function placeRoleplayWhispers(
  text: string,
  source: HistoryMessage,
  whispers: readonly RoleplayWhisper[],
  standIn: boolean,
): Array<RoleplayWhisper & { offset: number }> {
  const placeholder = standIn || !visibleBody(source).trim();
  const sourceText = placeholder ? WHISPER_ONLY_PLACEHOLDER : typeof source.content === "string" ? source.content : "";
  const sourceStart = sourceText ? text.indexOf(sourceText) : -1;
  const hasSource = sourceStart >= 0 && sourceStart === text.lastIndexOf(sourceText);
  return whispers
    .map((whisper) => ({
      ...whisper,
      offset: placeholder
        ? hasSource
          ? sourceStart + sourceText.length
          : text.length
        : (hasSource ? sourceStart : 0) +
          getRoleplayCommandContentOffset(hasSource ? sourceText : text, whisper.activity),
    }))
    .sort((a, b) => a.offset - b.offset || a.index - b.index);
}

/** Insert secrets at their saved positions in the final viewer's retained history, after copying shared prompts. */
export function appendRoleplayWhispers(
  prompt: GenerationPromptMessage[],
  history: readonly HistoryMessage[],
  viewer: RoleplayWhisperRecipient | null,
  narratorId: string | null,
): boolean {
  const sources = new Map(history.map((message) => [message.id, message]));
  // A whisper-only stand-in delivers only the viewer's own whispers, never the narrator's view.
  const whispersFor = (message: GenerationPromptMessage) => {
    const source = sources.get(message.whisperSourceId ?? message.id);
    if (!viewer || (source?.role !== "assistant" && source?.role !== "user")) return [];
    return getRoleplayWhispers(parseExtra(source.extra)).filter(
      ({ recipient }) =>
        (!message.whisperSourceId && viewer.kind === "character" && viewer.id === narratorId) ||
        (viewer.kind === recipient.kind && viewer.id === recipient.id),
    );
  };
  // A message that is only a whisper is not there at all for anyone it does not reach, unless the user shared
  // a private note on it with them.
  const whisperOnly = roleplayWhisperOnlyMessageIds(history);
  dropPromptHistoryMessages(
    prompt,
    (message) =>
      !!message.id &&
      whisperOnly.has(message.id) &&
      !whispersFor(message).length &&
      !(
        viewer?.kind === "character" && readMessagePrivateNoteRecipientId(sources.get(message.id)?.extra) === viewer.id
      ),
  );
  let added = false;
  for (const message of prompt) {
    if (message.contextKind !== "history") continue;
    const source = sources.get(message.whisperSourceId ?? message.id);
    const whispers = whispersFor(message);
    if (!source || !whispers.length) continue;
    const positioned = placeRoleplayWhispers(message.content, source, whispers, !!message.whisperSourceId);
    for (const { command, offset } of positioned.reverse()) {
      const fragment = `\n\n[Private whisper to ${command.character} (known only to this recipient and the appointed narrator)]\n${command.text}\n[End of private whisper]\n\n`;
      message.content = message.content.slice(0, offset) + fragment + message.content.slice(offset);
    }
    added = true;
  }
  return added;
}

/**
 * Agents read every live whisper in Roleplay (#7430), but not in a multiplayer room: there every human
 * participant sees agent output, and a whisper to one of them must stay theirs. Room generation runs inside
 * currentRoomGeneration(). For agent runs started outside it, any room data that is not an ended room, including
 * data that can't be read, counts as a room.
 */
export function roleplayAgentsSeeWhispers(chatMode: unknown, metadata: Record<string, unknown>): boolean {
  const room = metadata.multiplayer;
  return (
    chatMode === "roleplay" &&
    !currentRoomGeneration() &&
    (room === undefined || room === null || parseExtra(room).status === "ended")
  );
}

/**
 * Where a command sits in the saved `reply`, from `prefix`, the reply text before it when parsed: after the prefix,
 * else after its longest ending (80 to 12 characters) found exactly once, since cleanup such as a stripped
 * "Name:" can change the start. Null when neither is found.
 */
export function placeAfterPrefix(reply: string, prefix: string): number | null {
  const start = reply.indexOf(prefix);
  if (start >= 0) return start + prefix.length;
  for (let length = Math.min(80, prefix.length); length >= 12; length--) {
    const anchor = prefix.slice(-length);
    const found = reply.indexOf(anchor);
    if (found >= 0 && found === reply.lastIndexOf(anchor)) return found + length;
  }
  return null;
}

/**
 * Give each command of a reply split at scene breaks to the part its text was in, so a whisper or document keeps
 * that part's audience. `parts` say where each starts in the whole reply and `placeOf` where a command was in it.
 * Saved inline places move into their part. A command with no place goes to the last part, and so does an
 * interruption, which is committed with the last part.
 */
export function placeRoleplayActivityInParts(
  parts: readonly { content: string; start: number }[],
  activity: readonly RoleplayCommandActivity[],
  placeOf: (item: RoleplayCommandActivity) => number | null,
): RoleplayCommandActivity[][] {
  const placed = parts.map((): RoleplayCommandActivity[] => []);
  for (const item of activity) {
    const offset = item.command.type === "interrupt" ? null : placeOf(item);
    let index = parts.length - 1;
    if (offset !== null) {
      index = 0;
      while (index + 1 < parts.length && parts[index + 1]!.start < offset) index++;
    }
    const part = parts[index]!;
    if (typeof item.contentOffset !== "number") {
      placed[index]!.push(item);
      continue;
    }
    const contentOffset = Math.min(Math.max(0, item.contentOffset - part.start), part.content.length);
    placed[index]!.push({
      ...item,
      contentOffset,
      contentAnchor:
        contentOffset === 0
          ? part.content.slice(0, 80)
          : part.content.slice(Math.max(0, contentOffset - 80), contentOffset),
    });
  }
  return placed;
}

/**
 * A message as agents read it: `text`, the agent-facing body built from `source`, with each live whisper at its
 * saved place, marked as private with its recipient's name from `names`. A whisper-only message, or a `standIn`,
 * reads as its whispers alone. `names` is null where agents do not read whispers (see roleplayAgentsSeeWhispers).
 * `limit` cuts the text and each whisper to that many characters on their own, so a long whisper cannot crowd the
 * text out; a whisper whose place is cut off follows the cut text. A message with no whispers comes back uncut.
 * Character responders never get this text; their whispers come from appendRoleplayWhispers.
 */
export function roleplayAgentText(
  text: string,
  source: HistoryMessage | null | undefined,
  names: ReadonlyMap<string, string> | null,
  standIn = false,
  limit = Infinity,
): string {
  if (!names || (source?.role !== "user" && source?.role !== "assistant")) return text;
  const whispers = getRoleplayWhispers(parseExtra(source.extra));
  if (!whispers.length) return text;
  let result = text;
  let positioned: Array<RoleplayWhisper & { offset: number }>;
  if (standIn || !visibleBody(source).trim()) {
    // The placeholder only stands in for these whispers, so they take its place: the first one, since the
    // message's body comes before any document text, or the end when the text has none.
    const start = text.indexOf(WHISPER_ONLY_PLACEHOLDER);
    if (start >= 0) result = text.slice(0, start) + text.slice(start + WHISPER_ONLY_PLACEHOLDER.length);
    positioned = whispers.map((whisper) => ({ ...whisper, offset: start >= 0 ? start : text.length }));
  } else positioned = placeRoleplayWhispers(text, source, whispers, false);
  result = result.slice(0, limit);
  const end = result.length;
  for (const { command, recipient, offset } of positioned.reverse()) {
    const before = result.slice(0, Math.min(offset, end));
    const after = result.slice(Math.min(offset, end));
    const whisper = `[Private whisper to ${names.get(recipient.id) ?? command.character}: ${command.text.slice(0, limit)}]`;
    result = `${before}${/\S$/u.test(before) ? " " : ""}${whisper}${/^\S/u.test(after) ? " " : ""}${after}`;
  }
  return result;
}

/**
 * The text a continue just added to `source`, as agents read it: only the whispers written with it, the ones after
 * the message's `earlier` activity records, each at its saved place. They are placed in the whole message, since
 * their saved places point into it, and the earlier text is then cut off.
 */
export function roleplayAgentContinuation(
  continuation: string,
  source: HistoryMessage | null | undefined,
  earlier: number,
  names: ReadonlyMap<string, string> | null,
): string {
  if (!names || !source) return continuation;
  const extra = parseExtra(source.extra);
  const added = {
    ...source,
    extra: { ...extra, roleplayCommandActivity: getRoleplayCommandActivity(extra).slice(earlier) },
  };
  const body = typeof source.content === "string" ? source.content : "";
  const start = continuation.trim() ? body.lastIndexOf(continuation.trim()) : -1;
  const whole = start >= 0 ? roleplayAgentText(body, added, names) : "";
  return start >= 0 && whole.startsWith(body.slice(0, start))
    ? whole.slice(start).trim()
    : roleplayAgentText(continuation, added, names);
}

/** Agents' copy of a prompt, each history message read as roleplayAgentText. The prompt itself is unchanged. */
export function roleplayAgentPrompt<T extends GenerationPromptMessage>(
  prompt: T[],
  history: readonly HistoryMessage[],
  names: ReadonlyMap<string, string> | null,
): T[] {
  if (!names) return prompt;
  const sources = new Map(history.map((message) => [message.id, message]));
  return prompt.map((message) => {
    if (message.contextKind !== "history") return message;
    const source = sources.get(message.whisperSourceId ?? message.id);
    const content = roleplayAgentText(message.content, source, names, !!message.whisperSourceId);
    return content === message.content ? message : { ...message, content };
  });
}

/** Attach a message's private note for the one character the user shared it with. */
export function appendRoleplayMessageNotes(
  prompt: Array<{ id?: string | null; contextKind?: string; content: string }>,
  history: readonly HistoryMessage[],
  viewer: RoleplayWhisperRecipient | null,
): boolean {
  if (viewer?.kind !== "character") return false;
  const sources = new Map(history.map((message) => [message.id, message]));
  let added = false;
  for (const message of prompt) {
    if (!message.id || message.contextKind !== "history") continue;
    const source = sources.get(message.id);
    const note = readMessagePrivateNote(source?.extra);
    if (!note || readMessagePrivateNoteRecipientId(source?.extra) !== viewer.id) continue;
    message.content += `\n\n[The user's private note on this message, shown only to you]\n${note}\n[End of private note]`;
    added = true;
  }
  return added;
}

export function readRoleplayPersonalState(
  messages: readonly HistoryMessage[],
  audienceCharacterId?: string,
  summaryHiddenIds: ReadonlySet<string> = new Set(),
): Map<string | symbol, PersonalState> {
  const states = new Map<string | symbol, PersonalState>();
  for (const message of messages) {
    let extra = message.extra;
    if (typeof extra === "string") {
      try {
        extra = JSON.parse(extra);
      } catch {
        continue;
      }
    }
    if (!extra || typeof extra !== "object") continue;
    const metadata = extra as Record<string, unknown>;
    // Summarizing old narration must not erase outstanding private intentions.
    if (metadata.hiddenFromAI === true && !(typeof message.id === "string" && summaryHiddenIds.has(message.id)))
      continue;
    if (
      audienceCharacterId &&
      Array.isArray(metadata.conversationStartForCharacterIds) &&
      metadata.conversationStartForCharacterIds.includes(audienceCharacterId)
    )
      states.clear();
    if (
      audienceCharacterId &&
      Array.isArray(metadata.hiddenFromAICharacterIds) &&
      metadata.hiddenFromAICharacterIds.includes(audienceCharacterId)
    )
      continue;
    const owner = message.role === "user" ? USER_NOTES_OWNER : message.characterId;
    if (
      (message.role !== "assistant" && message.role !== "user") ||
      (typeof owner !== "string" && owner !== USER_NOTES_OWNER)
    )
      continue;
    const commands = getRoleplayPrivateCommands(metadata).filter(
      (command) => message.role !== "user" || command.type === "notes" || command.type === "dismiss_notes",
    );
    if (message.role === "user" && !commands.length) continue;
    const state = states.get(owner) ?? { notes: "", reminders: new Map<string, string>() };
    for (const command of commands) {
      if (!command || typeof command !== "object") continue;
      if (command.type === "notes" && typeof command.content === "string" && command.content.length <= 8_000)
        state.notes = command.content;
      if (command.type === "dismiss_notes") state.notes = "";
      if (
        command.type === "memory" &&
        typeof command.id === "string" &&
        command.id.length <= 80 &&
        typeof command.content === "string" &&
        command.content.length <= 1_000
      ) {
        state.reminders.set(command.id, command.content);
        if (state.reminders.size > 3) state.reminders.delete(state.reminders.keys().next().value!);
      }
      if (command.type === "dismiss_memory" && typeof command.id === "string") state.reminders.delete(command.id);
    }
    states.set(owner, state);
  }
  return states;
}

export function buildRoleplayPersonalContext(args: {
  messages: readonly HistoryMessage[];
  metadata: Record<string, unknown>;
  characters: readonly { id: string; name: string }[];
  characterId: string | null;
  individual: boolean;
  format: WrapFormat;
}): string {
  if (!args.characterId || (args.characters.length > 1 && !args.individual)) return "";
  const inactive = new Set(Array.isArray(args.metadata.inactiveCharacterIds) ? args.metadata.inactiveCharacterIds : []);
  const activeCharacters = args.characters.filter((character) => !inactive.has(character.id));
  const narrator =
    args.individual && activeCharacters.some((character) => character.id === args.metadata.roleplayCommandNarratorId)
      ? args.metadata.roleplayCommandNarratorId
      : null;
  const summaryHiddenIds = new Set(
    normalizeChatSummaryEntries(args.metadata.summaryEntries).flatMap((entry) => entry.hiddenMessageIds ?? []),
  );
  const states = readRoleplayPersonalState(args.messages, args.characterId, summaryHiddenIds);
  const blocks: string[] = [];
  for (const character of activeCharacters) {
    if (character.id !== args.characterId && args.characterId !== narrator) continue;
    const state = states.get(character.id);
    if (!state) continue;
    const lines: string[] = [];
    if (isRoleplayCommandEnabled(args.metadata, "notes") && state.notes) lines.push(state.notes);
    if (isRoleplayCommandEnabled(args.metadata, "memory") && state.reminders.size)
      lines.push(
        "Pending reminders:\n" + [...state.reminders].map(([id, content]) => `- ${id}: ${content}`).join("\n"),
      );
    if (!lines.length) continue;
    const name = `${character.name}'s Personal Notes`;
    blocks.push(
      args.format === "none"
        ? `${name}:\n${lines.join("\n\n")}`
        : args.format === "markdown"
          ? `### ${name}\n${lines.join("\n\n")}`
          : wrapContent(lines.join("\n\n"), name, args.format, 1),
    );
  }
  const userNotes = states.get(USER_NOTES_OWNER)?.notes;
  if (args.characterId === narrator && isRoleplayCommandEnabled(args.metadata, "notes") && userNotes) {
    const name = "User's Personal Notes";
    blocks.push(
      args.format === "none"
        ? `${name}:\n${userNotes}`
        : args.format === "markdown"
          ? `### ${name}\n${userNotes}`
          : wrapContent(userNotes, name, args.format, 1),
    );
  }
  if (!blocks.length) return "";
  return [
    "Private character state, do not reveal those notes to the reader or treat them as knowledge other characters posses." +
      (args.characterId === narrator
        ? " You are the selected narrator. Use those intentions to create plausible opportunities, obstacles, and consequences. Do not guarantee success, control the players' choices, or expose secrets without in-world discovery. Only change your own notes and reminders."
        : ""),
    ...blocks,
  ].join("\n\n");
}

export function buildRoleplayCommandsReminder(args: {
  metadata: Record<string, unknown>;
  privateAvailable: boolean;
  availableAgentIds: ReadonlySet<string>;
  format: WrapFormat;
  characterNames: string[];
  characterId?: string | null;
  interruptAvailable?: boolean;
}): string {
  const lines: string[] = [];
  const enabled = (key: RoleplayCommandKey) => isRoleplayCommandAllowed(args.metadata, key, args.characterId);
  if (enabled("illustrate") && args.availableAgentIds.has("illustrator"))
    lines.push(
      '- [illustrate: subject="the moment, object, or interaction to depict" characters="names of involved characters, separated by commas"] requests an image using this chat\'s Illustrator settings and the named characters\' avatars. Use it to surprise the user or capture an important moment.' +
        (args.metadata.roleplayIllustrateInline === true
          ? " The image appears exactly where you write the command, so place it where the picture belongs: at the start, between paragraphs, or at the end."
          : ""),
    );
  if (enabled("document"))
    lines.push(
      '- [document: kind="note|letter|journal|report|poster|terminal" title="title" content="full text"] creates an in-world document. Supply plain text only; the Engine applies the built-in style for that kind. Do not generate HTML or CSS or repeat the document contents in narration.',
    );
  if (enabled("sound")) lines.push('- [sound: description="a brief sound effect"] plays a sound cue. Use sparingly.');
  if (enabled("music") && args.availableAgentIds.has("spotify"))
    lines.push(
      '- [music: mood="scene mood and musical direction"] asks Music DJ to change the soundtrack when the scene calls for it.',
    );
  if (args.privateAvailable && enabled("notes"))
    lines.push(
      '- [notes: content="brief private state and plans"] keeps private state that should guide future turns: reasoning decisions you want to pass to future turns, unspoken thoughts, changed attitudes, secrets, and pending plans. Do not recap scenes or repeat chat history. To edit existing notes, send their full updated contents to replace the previous ones. Keep only still-relevant details in 1–3 short bullets, under 80 words total. Notes are available to you and the narrator alone. [dismiss_notes] clears them when no longer needed.',
    );
  if (args.privateAvailable && enabled("memory"))
    lines.push(
      '- [memory: id="short-stable-id" content="what to revisit and when"] adds or updates a reminder, available to you and narrator alone. Keep it short; only up to three reminders can exist at the same time; if you create more, the oldest one will be removed. [dismiss_memory: id="id"] removes it when fulfilled or no longer relevant.',
    );
  if (args.privateAvailable && enabled("whisper"))
    lines.push(
      '- [whisper: character="name" text="text hidden from anyone but the specified character"] Hides a part of the message and makes it available only to a selected character. No one else will be able to access it, except for the appointed narrator. This can be used to whisper secrets, show visions, etc. Name exactly one chat character or the user\'s persona. Put the command where the secret belongs in the message, and do not repeat its text in public narration. The text may span several lines and quote dialogue as is, for example text=""I love you."".',
    );
  if (enabled("roll"))
    lines.push(
      '- [roll: character="participant name" notation="1d20" attribute="Strength" modifier="+2" dc="15" reason="action being attempted"] requests a real roll; use roll_dice with the same fields when available. You may target any chat participant, including the user\'s persona by name. Attribute is optional; the engine adds the assigned attribute modifier, so do not add it yourself. Optional modifier adds a situational bonus/penalty once; optional dc sets the total needed to succeed. Keep DCs and modifiers in command/tool fields, not narration. Stop after the command and wait for the result before narrating the outcome. Never invent results or reroll an action.',
    );
  if (enabled("combat") && args.availableAgentIds.has("combat"))
    lines.push("- [combat] asks the Combat agent to start an encounter when the scene turns to combat.");
  if (args.interruptAvailable === true && enabled("interrupt"))
    lines.push(
      '- [interrupt: part="at least three words quoted verbatim through the interruption point"] cuts off only the latest user or other-character message at that point, either dialogue or action. Use only when your character can plausibly intervene with the abilities and freedom they currently have, example: you interrupt a spiraling monologue by hushing someone. Continue from the cut; the removed continuation has not happened.',
    );
  if (enabled("dm"))
    lines.push(
      `- [dm: character="${args.characterNames.map((name) => name.replace(/"/g, "'")).join(" | ")}" message="short text"] sends the user an in-world direct message from a listed character. Use an appropriate phone, letter or terminal; do not repeat the message in narration.`,
    );
  if (!lines.length) return "";
  const body = [
    'Optional, user-hidden commands you may include in your response, if appropriate. Put text values in double quotes; escape embedded quotes as \\" and newlines as \\n. You may issue one, many, or no commands.',
    ...lines,
  ].join("\n");
  return args.format === "none" ? `Commands:\n${body}` : wrapContent(body, "Commands", args.format);
}

export function appendRoleplayPromptTail(
  messages: Array<{ role: string; content: string; contextKind?: string }>,
  personal: string,
  commands: string,
  format: WrapFormat,
): void {
  if (!personal && !commands) return;
  if (personal) {
    // Trackers are an earlier injection, not necessarily the last user message.
    // Personal notes and reminders are added only here, after the agents' copy of the prompt was made:
    // agents read whispers (#7430), never these.
    const contextPattern = format === "markdown" ? /^#{1,2}[ \t]*Context[ \t]*$/mu : /^Context:[ \t]*$/mu;
    const contextMessage = [...messages].reverse().find((candidate) => {
      if (candidate.role !== "user" || candidate.contextKind === "history") return false;
      if (format !== "xml") return contextPattern.test(candidate.content);
      const start = candidate.content.indexOf("<context>");
      return start >= 0 && candidate.content.indexOf("</context>", start + "<context>".length) >= 0;
    });
    if (contextMessage) {
      if (format === "xml") {
        const end = contextMessage.content.indexOf(
          "</context>",
          contextMessage.content.indexOf("<context>") + "<context>".length,
        );
        contextMessage.content = `${contextMessage.content.slice(0, end)}${personal}\n${contextMessage.content.slice(end)}`;
      } else contextMessage.content += `\n\n${personal}`;
      personal = "";
    } else
      personal =
        format === "xml"
          ? `<context>\n${personal}\n</context>`
          : format === "markdown"
            ? `# Context\n${personal}`
            : `Context:\n${personal}`;
  }
  const tail = [personal, commands].filter(Boolean).join("\n\n");
  if (!tail) return;
  let index = messages.length - 1;
  while (index >= 0 && messages[index]!.role !== "user") index--;
  if (index < 0 || messages[index]!.contextKind === "history") {
    // Live instructions must survive history filtering. Keep an explicit
    // assistant prefill last, but never attach these instructions to history.
    index = messages.length;
    const last = messages.at(-1);
    if (last?.role === "assistant" && last.contextKind !== "history") index--;
    messages.splice(index, 0, { role: "user", content: "", contextKind: "injection" });
  }
  messages[index]!.content += `\n\n${tail}`;
}
