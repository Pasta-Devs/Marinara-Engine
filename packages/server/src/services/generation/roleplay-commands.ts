import {
  isRoleplayCommandEnabled,
  ROLEPLAY_COMMAND_KEYS,
  normalizeChatSummaryEntries,
  type RoleplayCommandKey,
  type RoleplayPrivateCommand,
  type WrapFormat,
} from "@marinara-engine/shared";
import { parseQuotedParam } from "../conversation/character-commands.js";
import { wrapContent } from "../prompt/format-engine.js";

export type RoleplayCommand =
  | RoleplayPrivateCommand
  | { type: "illustrate"; subject: string }
  | { type: "document"; documentType: string; title: string; content: string }
  | { type: "sound"; description: string }
  | { type: "music"; mood: string }
  | { type: "roll"; notation: string; reason: string };

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
      return subject ? { type, subject } : null;
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
      return notation ? { type, notation, reason: field("reason", 500) } : null;
    }
    default:
      return null;
  }
}

export function parseRoleplayCommands(text: string): {
  content: string;
  commands: RoleplayCommand[];
  invalid: number;
  roll?: { command: Extract<RoleplayCommand, { type: "roll" }>; start: number; end: number };
} {
  const commands: RoleplayCommand[] = [];
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
  return { content, commands, invalid, roll };
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
    const commands = (extra as Record<string, unknown>).roleplayPrivateCommands;
    if (!Array.isArray(commands)) continue;
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
        command.content.length <= 1_000 &&
        (state.reminders.has(command.id) || state.reminders.size < 20)
      )
        state.reminders.set(command.id, command.content);
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
    "Private character state. Preserve the distinction between truth, lies, deception, cover stories, beliefs, motives, secrets, and plans. Do not reveal these notes to the reader or treat them as knowledge other characters possess.",
    ...(args.characterId === narrator
      ? [
          "You are the selected narrator. Use these intentions to create plausible opportunities, obstacles, and consequences. Do not guarantee success, control the user's choices, or expose secrets without an in-world discovery. Only change your own notes and reminders.",
        ]
      : []),
    ...blocks,
  ].join("\n\n");
}

export function buildRoleplayCommandsReminder(args: {
  metadata: Record<string, unknown>;
  privateAvailable: boolean;
  availableAgentIds: ReadonlySet<string>;
  format: WrapFormat;
  characterNames: string[];
}): string {
  const lines: string[] = [];
  const enabled = (key: RoleplayCommandKey) => isRoleplayCommandEnabled(args.metadata, key);
  if (enabled("illustrate") && args.availableAgentIds.has("illustrator"))
    lines.push(
      '- [illustrate: subject="the moment, object, or interaction to depict"] requests an Illustrator image. Use sparingly for visually significant moments.',
    );
  if (enabled("document"))
    lines.push(
      '- [document: kind="letter|journal|report|poster|terminal", title="title", content="full text"] presents a readable in-world document. Do not repeat its full contents in narration.',
    );
  if (enabled("sound"))
    lines.push(
      '- [sound: description="a brief sound effect"] plays a short sound cue that fits the scene. Use sparingly.',
    );
  if (enabled("music") && args.availableAgentIds.has("spotify"))
    lines.push(
      '- [music: mood="scene mood and musical direction"] asks Music DJ to select a soundtrack through the active player. Use only when a change is warranted.',
    );
  if (args.privateAvailable && enabled("notes"))
    lines.push(
      '- [notes: content="your complete current personal notes"] replaces YOUR notes. Record motives, secrets, LIES, DECEPTIONS, the actual truth versus your false claims, cover stories, goals, plans, and pending intentions. Preserve still-relevant details when rewriting. Maximum 8000 characters. Only you and the selected narrator receive them. [dismiss_notes] clears YOUR notes when no longer needed; a scene change alone is not a reason to clear unresolved plans or lies.',
    );
  if (args.privateAvailable && enabled("memory"))
    lines.push(
      '- [memory: id="short-stable-id", content="what to revisit and when"] adds or updates YOUR private short-term reminder (up to 20 pending, 1000 characters each). It survives note rewrites. [dismiss_memory: id="id"] removes that reminder after it is fulfilled or abandoned. Only you and the selected narrator receive reminders.',
    );
  if (enabled("roll"))
    lines.push(
      '- Use the roll_dice function to request a real roll. Set the action and any difficulty or success rule BEFORE rolling. Wait for the tool result before narrating the outcome. If function calls are unavailable, emit [roll: notation="1d20+3", reason="action and success rule"] and STOP your response immediately. The engine returns the actual result and asks you to continue. Never invent a result or reroll to obtain a preferred outcome.',
    );
  if (enabled("dm"))
    lines.push(
      `- [dm: character="${args.characterNames.map((name) => name.replace(/"/g, "'")).join(" | ")}", message="short text"] sends an in-world direct message to the user through the linked Conversation or a DM thread. Use only a listed character with a card, when a phone, letter, terminal, or similar channel fits. Do not repeat the same message in narration.`,
    );
  if (!lines.length) return "";
  const body = [
    'Optional hidden commands. Use them only when they fit the scene. Commands are removed from the displayed reply. Put text values in double quotes; escape embedded quotes as \\" and newlines as \\n. You may issue several commands, but never need to issue one.',
    ...lines,
  ].join("\n\n");
  return args.format === "none" ? `Commands:\n${body}` : wrapContent(body, "Commands", args.format);
}

export function appendRoleplayPromptTail(
  messages: Array<{ role: string; content: string }>,
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
    if (format === "xml" && message.content.trimEnd().endsWith("</context>"))
      message.content = message.content.replace(/<\/context>\s*$/, `${personal}\n</context>`);
    else if (format === "markdown" && message.content.includes("# Context")) message.content += `\n\n${personal}`;
    else
      message.content += `\n\n${format === "xml" ? `<context>\n${personal}\n</context>` : format === "markdown" ? `# Context\n${personal}` : personal}`;
  }
  if (commands) message.content += `\n\n${commands}`;
}
