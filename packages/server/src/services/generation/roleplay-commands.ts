import {
  isRoleplayCommandEnabled,
  isRoleplayCommandAllowed,
  getRoleplayPrivateCommands,
  ROLEPLAY_COMMAND_KEYS,
  normalizeChatSummaryEntries,
  type RoleplayCommandKey,
  type RoleplayCommand,
  type RoleplayCommandActivity,
  type WrapFormat,
} from "@marinara-engine/shared";
import { parseQuotedParam } from "../conversation/character-commands.js";
import { wrapContent } from "../prompt/format-engine.js";

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
      return notation
        ? {
            type,
            notation,
            reason: field("reason", 500),
            ...(character ? { character } : {}),
            ...(attribute ? { attribute } : {}),
          }
        : null;
    }
    case "combat":
      return { type };
    default:
      return null;
  }
}

export function parseRoleplayCommands(text: string): {
  content: string;
  commands: RoleplayCommand[];
  activity: RoleplayCommandActivity[];
  invalid: number;
  roll?: { command: Extract<RoleplayCommand, { type: "roll" }>; start: number; end: number };
} {
  const commands: RoleplayCommand[] = [];
  const activity: RoleplayCommandActivity[] = [];
  let content = "";
  let cursor = 0;
  let invalid = 0;
  let roll: { command: Extract<RoleplayCommand, { type: "roll" }>; start: number; end: number } | undefined;
  const starts = new RegExp(COMMAND_START);
  let match: RegExpExecArray | null;
  while ((match = starts.exec(text))) {
    // DMs retain their existing resolver and visible fallback for invalid targets.
    if (match[1]!.toLowerCase() === "dm") continue;
    content += text.slice(cursor, match.index);
    const end = commandEnd(text, match.index);
    if (end < 0) {
      invalid++;
      cursor = text.length;
      break;
    }
    const body = text.slice(match.index + match[0].length, end - 1);
    const command = end - match.index <= MAX_COMMAND_LENGTH ? readCommand(match[1]!.toLowerCase(), body) : null;
    if (command && commands.length < 24) {
      commands.push(command);
      activity.push({ command, raw: text.slice(match.index, end) });
      if (command.type === "roll" && !roll) roll = { command, start: match.index, end };
    } else invalid++;
    cursor = end;
    starts.lastIndex = end;
  }
  content += text.slice(cursor);
  const lastBracket = content.lastIndexOf("[");
  const suffix = content.slice(lastBracket).toLowerCase();
  if (lastBracket >= 0 && suffix !== "[" && PREFIXES.some((prefix) => prefix !== "[dm" && prefix.startsWith(suffix))) {
    content = content.slice(0, lastBracket);
    invalid++;
  }
  return { content, commands, activity, invalid, roll };
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

type PersonalState = { notes: string; reminders: Map<string, string> };
type HistoryMessage = { id?: unknown; role?: unknown; characterId?: unknown; extra?: unknown };

export function readRoleplayPersonalState(
  messages: readonly HistoryMessage[],
  audienceCharacterId?: string,
  summaryHiddenIds: ReadonlySet<string> = new Set(),
): Map<string, PersonalState> {
  const states = new Map<string, PersonalState>();
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
    if (message.role !== "assistant" || typeof message.characterId !== "string") continue;
    const commands = getRoleplayPrivateCommands(metadata);
    const state = states.get(message.characterId) ?? { notes: "", reminders: new Map<string, string>() };
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
    states.set(message.characterId, state);
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
  const narrator =
    args.individual && args.characters.some((character) => character.id === args.metadata.roleplayCommandNarratorId)
      ? args.metadata.roleplayCommandNarratorId
      : null;
  const summaryHiddenIds = new Set(
    normalizeChatSummaryEntries(args.metadata.summaryEntries).flatMap((entry) => entry.hiddenMessageIds ?? []),
  );
  const states = readRoleplayPersonalState(args.messages, args.characterId, summaryHiddenIds);
  const blocks: string[] = [];
  for (const character of args.characters) {
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
}): string {
  const lines: string[] = [];
  const enabled = (key: RoleplayCommandKey) => isRoleplayCommandAllowed(args.metadata, key, args.characterId);
  if (enabled("illustrate") && args.availableAgentIds.has("illustrator"))
    lines.push(
      '- [illustrate: subject="the moment, object, or interaction to depict" characters="names of involved characters, separated by commas"] requests an image using this chat\'s Illustrator settings and the named characters\' avatars. Use it to surprise the user or capture an important moment.',
    );
  if (enabled("document"))
    lines.push(
      '- [document: kind="letter|journal|report|poster|terminal" title="title" content="full text"] creates an in-world document. Do not repeat its contents in narration.',
    );
  if (enabled("sound")) lines.push('- [sound: description="a brief sound effect"] plays a sound cue. Use sparingly.');
  if (enabled("music") && args.availableAgentIds.has("spotify"))
    lines.push(
      '- [music: mood="scene mood and musical direction"] asks Music DJ to change the soundtrack when the scene calls for it.',
    );
  if (args.privateAvailable && enabled("notes"))
    lines.push(
      '- [notes: content="your current personal notes"] replaces your notes about motives, secrets, beliefs, lies and plans. Preserve relevant details and keep it short; these notes are available to you and narrator alone. [dismiss_notes] clears your notes when they\'re no longer needed or relevant.',
    );
  if (args.privateAvailable && enabled("memory"))
    lines.push(
      '- [memory: id="short-stable-id" content="what to revisit and when"] adds or updates a reminder, available to you and narrator alone. Keep it short; only up to three reminders can exist at the same time; if you create more, the oldest one will be removed. [dismiss_memory: id="id"] removes it when fulfilled or no longer relevant.',
    );
  if (enabled("roll"))
    lines.push(
      '- [roll: character="character name" notation="1d20" attribute="Strength" reason="action and success rule"] requests a real roll; use roll_dice with the same fields when available. Attribute is optional; the engine adds the assigned attribute modifier, so do not add it yourself. Set the stakes first, stop after the command, and wait for the result before narrating the outcome. Never invent results or reroll an action.',
    );
  if (enabled("combat") && args.availableAgentIds.has("combat"))
    lines.push("- [combat] asks the Combat agent to start an encounter when the scene turns to combat.");
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
  let index = messages.length - 1;
  while (index >= 0 && messages[index]!.role !== "user") index--;
  if (index < 0) {
    messages.push({ role: "user", content: "" });
    index = messages.length - 1;
  }
  const message = messages[index]!;
  if (personal) {
    // Trackers are an earlier injection, not necessarily the last user message.
    // Add private state only here, after the shared agent prompt has been copied.
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
    } else
      message.content += `\n\n${format === "xml" ? `<context>\n${personal}\n</context>` : format === "markdown" ? `# Context\n${personal}` : `Context:\n${personal}`}`;
  }
  if (commands) message.content += `\n\n${commands}`;
}
