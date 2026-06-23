// ──────────────────────────────────────────────
// Slash Commands — SillyTavern-style / commands
// ──────────────────────────────────────────────
import { api } from "./api-client";
import { useChatStore } from "../stores/chat.store";
import { useUIStore } from "../stores/ui.store";
import { useUnoGameStore } from "../stores/uno-game.store";
import { toast } from "sonner";
import {
  SUPPORTED_MACROS,
  buildNarratorInstructionMessage,
  normalizeTextForMatch,
  type SceneCreateResponse,
  type ScenePlanResponse,
} from "@marinara-engine/shared";

export interface SlashCommand {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  /** If true, command is executed locally and doesn't send to the LLM */
  local?: boolean;
  /** Execute the command. Returns a string result, or null if it dispatches an action elsewhere. */
  execute: (args: string, ctx: SlashCommandContext) => Promise<SlashCommandResult>;
}

export interface SlashCommandContext {
  chatId: string;
  mode?: "conversation" | "roleplay";
  /** Trigger an LLM generation (with optional user message) */
  generate: (params: {
    chatId: string;
    connectionId: string | null;
    userMessage?: string;
    generationGuide?: string;
    generationGuideSource?: "narrator" | "guide" | "game_start";
    continueMessageId?: string;
    impersonate?: boolean;
    attachments?: { type: string; data: string }[];
    impersonatePresetId?: string;
    impersonateConnectionId?: string;
    impersonateBlockAgents?: boolean;
    impersonatePromptTemplate?: string;
  }) => Promise<boolean | void>;
  /** Insert a message directly into the chat (no LLM) */
  createMessage: (data: { role: string; content: string; characterId?: string | null }) => void;
  /** Invalidate chat queries to refresh the UI */
  invalidate: () => void;
  /** Character names in the current chat */
  characterNames: string[];
  /** Characters available in the current roleplay scene */
  characters?: Array<{ id: string; name: string }>;
  /** Latest assistant message, used when /continue appends to an unfinished reply */
  latestAssistantMessageId?: string | null;
  /** Apply a manual sprite expression override */
  setSpriteExpression?: (characterId: string, expression: string) => void | Promise<void>;
}

function quoteCommandArgument(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!/[\s"\\]/u.test(trimmed)) return trimmed;
  return `"${trimmed.replace(/["\\]/g, "\\$&")}"`;
}

function formatAvailableCharacterList(characters: Array<{ id: string; name: string }>): string {
  return characters.map((character) => character.name).join(", ");
}

function buildStatusCommandHelp(characters: Array<{ id: string; name: string }>): string {
  const available = formatAvailableCharacterList(characters);
  const exampleTarget = characters[0]?.name ?? "Character Name";
  const exampleArg = quoteCommandArgument(exampleTarget) || '"Character Name"';
  return [
    "Usage: /status <online|idle|dnd|offline|clear> [character name]",
    "Examples:",
    `/status online ${exampleArg}`,
    `/status clear ${exampleArg}`,
    available ? `Available: ${available}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export interface SlashCommandResult {
  /** If true, don't send to the LLM / don't do normal send */
  handled: boolean;
  /** Optional feedback to show (ephemeral, not persisted) */
  feedback?: string;
}

// ── Dice roller ────────────────

function parseDice(notation: string): { count: number; sides: number; modifier: number } | null {
  const match = notation.match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
  if (!match) return null;
  return {
    count: parseInt(match[1] || "1", 10),
    sides: parseInt(match[2]!, 10),
    modifier: match[3] ? parseInt(match[3], 10) : 0,
  };
}

function rollDice(count: number, sides: number): number[] {
  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    results.push(Math.floor(Math.random() * sides) + 1);
  }
  return results;
}

// ── Reminder parser ────────────────

function parseReminder(input: string): { ms: number; timeStr: string; message: string } | null {
  const match = input.match(/^((?:\d+[hms])+)\s+(.+)$/is);
  if (!match) return null;

  const timeRaw = match[1]!;
  const message = match[2]!.trim();
  if (!message) return null;

  let ms = 0;
  const h = timeRaw.match(/(\d+)h/i);
  const m = timeRaw.match(/(\d+)m/i);
  const s = timeRaw.match(/(\d+)s/i);
  if (h) ms += parseInt(h[1]!, 10) * 3_600_000;
  if (m) ms += parseInt(m[1]!, 10) * 60_000;
  if (s) ms += parseInt(s[1]!, 10) * 1_000;
  if (ms === 0) return null;

  const parts: string[] = [];
  if (h) parts.push(`${h[1]}h`);
  if (m) parts.push(`${m[1]}m`);
  if (s) parts.push(`${s[1]}s`);

  return { ms, timeStr: parts.join(""), message };
}

function buildMacroHelpText(): string {
  const sections = new Map<string, string[]>();

  for (const macro of SUPPORTED_MACROS) {
    const lines = sections.get(macro.category) ?? [];
    lines.push(`${macro.syntax} - ${macro.description}`);
    sections.set(macro.category, lines);
  }

  return [
    "Supported Macros:",
    "Tip: In group chats, a bracketed block containing character macros like {{char}} and {{description}} repeats once per character.",
    'Conditional blocks: {{#if character == "Dottore"}}Dottore prompt{{else}}Fallback prompt{{/if}}',
    "Conditionals support char, character, speaker, user, preset variables, ==, !=, contains, and straight or typographic quotes.",
    ...Array.from(sections.entries()).flatMap(([category, lines], index) =>
      index === 0 ? ["", `${category}:`, ...lines] : ["", `${category}:`, ...lines],
    ),
    "",
    "Input Actions:",
    "{{prompt}} - Open the prompt preview for the current chat without sending a message",
  ].join("\n");
}

const MACRO_HELP_TEXT = buildMacroHelpText();

function buildSlashHelpText(): string {
  return ["Available Commands:", "", ...COMMANDS.map((command) => `${command.usage} - ${command.description}`)].join(
    "\n",
  );
}

function parseImpersonatePromptArg(args: string): string {
  let prompt = args.trim();
  if (!prompt) return "";

  const quote = prompt[0];
  const closeQuote = quote === "\u201c" ? "\u201d" : quote === "\u2018" ? "\u2019" : quote;
  if (quote === '"' || quote === "'" || quote === "\u201c" || quote === "\u2018") {
    prompt = prompt.slice(1);
    if (prompt.endsWith(closeQuote)) {
      prompt = prompt.slice(0, -1);
    }
  }

  return prompt.trim();
}

function parseNamedArgs(input: string): Record<string, string> {
  const values: Record<string, string> = {};
  const argPattern =
    /([A-Za-z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|\u201c([^\u201d]*)\u201d|\u2018([^\u2019]*)\u2019|([^\s]+))/g;
  let match: RegExpExecArray | null;
  while ((match = argPattern.exec(input))) {
    values[match[1]!.toLowerCase()] = (match[2] ?? match[3] ?? match[4] ?? match[5] ?? match[6] ?? "").trim();
  }
  return values;
}

function parseCommandTokens(input: string): Array<{ value: string; quoted: boolean }> {
  const tokens: Array<{ value: string; quoted: boolean }> = [];
  const tokenPattern =
    /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|\u201c([^\u201d\\]*(?:\\.[^\u201d\\]*)*)\u201d|\u2018([^\u2019\\]*(?:\\.[^\u2019\\]*)*)\u2019|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(input))) {
    const quoted = match[1] !== undefined || match[2] !== undefined || match[3] !== undefined || match[4] !== undefined;
    const raw = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5] ?? "").trim();
    if (!raw) continue;
    tokens.push({ value: raw.replace(/\\(["'\u201c\u201d\u2018\u2019\\])/g, "$1"), quoted });
  }
  return tokens;
}

function normalizeLookup(value: string): string {
  return normalizeTextForMatch(value);
}

function isAllEmoteTarget(value: string): boolean {
  const normalized = normalizeLookup(value);
  return normalized === "all" || normalized === "*";
}

function findSceneCharacter(
  characters: Array<{ id: string; name: string }>,
  name: string,
): { id: string; name: string } | null {
  const normalized = normalizeLookup(name);
  if (!normalized) return null;
  return (
    characters.find((character) => normalizeLookup(character.name) === normalized) ??
    characters.find((character) => normalizeLookup(character.name).includes(normalized)) ??
    null
  );
}

async function listSpriteExpressions(characterId: string): Promise<string[]> {
  try {
    const sprites = await api.get<Array<{ expression?: string }>>(`/sprites/${encodeURIComponent(characterId)}`);
    const expressions = sprites
      .map((sprite) => sprite.expression?.trim())
      .filter((expression): expression is string => !!expression);
    return Array.from(new Set(expressions)).sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

async function buildEmoteListFeedback(characters: Array<{ id: string; name: string }>): Promise<string> {
  const rows = await Promise.all(
    characters.map(async (character) => {
      const expressions = await listSpriteExpressions(character.id);
      return `${character.name}: ${expressions.length > 0 ? expressions.join(", ") : "no uploaded expression sprites"}`;
    }),
  );

  return [
    "Available Emotes:",
    "",
    ...rows,
    "",
    'Use /emote joy, /emote "Character" joy, or /emote "all" joy to switch expressions.',
  ].join("\n");
}

function matchSpriteExpression(expressions: string[], requested: string): string | null {
  const normalized = normalizeLookup(requested);
  if (!normalized) return null;
  return (
    expressions.find((expression) => normalizeLookup(expression) === normalized) ??
    expressions.find((expression) => normalizeLookup(expression).includes(normalized)) ??
    null
  );
}

const CONVERSATION_STATUS_VALUES = ["online", "idle", "dnd", "offline"] as const;

type ConversationStatusValue = (typeof CONVERSATION_STATUS_VALUES)[number];

function isConversationStatusValue(value: string): value is ConversationStatusValue {
  return CONVERSATION_STATUS_VALUES.includes(value as ConversationStatusValue);
}

// ── Message index parser (for /hide and /unhide) ────────────────

/**
 * Parse a message index expression into a sorted, deduplicated array of
 * 1-indexed positions. Supports: `5`, `3-8`, `2,5,9`, `2-5,8,12-14`.
 * Returns null if the expression is empty or contains invalid tokens.
 */
function parseMessageIndices(input: string): number[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const indices = new Set<number>();
  const parts = trimmed.split(",");

  for (const part of parts) {
    const segment = part.trim();
    if (!segment) continue;

    // Range: N-M
    if (segment.includes("-")) {
      const [left, right] = segment.split("-", 2);
      const start = Number.parseInt(left!.trim(), 10);
      const end = Number.parseInt(right!.trim(), 10);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < 1) return null;
      const lo = Math.min(start, end);
      const hi = Math.max(start, end);
      for (let i = lo; i <= hi; i++) indices.add(i);
    } else {
      // Single number
      const n = Number.parseInt(segment, 10);
      if (!Number.isFinite(n) || n < 1) return null;
      indices.add(n);
    }
  }

  return indices.size > 0 ? Array.from(indices).sort((a, b) => a - b) : null;
}

/** Safely read a boolean from a message's extra field. */
function isMessageHidden(msg: { extra?: unknown }): boolean {
  if (!msg.extra) return false;
  try {
    const ex = typeof msg.extra === "string" ? JSON.parse(msg.extra) : msg.extra;
    return (ex as Record<string, unknown>).hiddenFromAI === true;
  } catch {
    return false;
  }
}

// ── Command definitions ────────────────

const COMMANDS: SlashCommand[] = [
  {
    name: "roll",
    aliases: ["r", "dice"],
    description: "Roll dice (e.g. 2d6, 1d20+5)",
    usage: "/roll <notation>",
    local: true,
    async execute(args, ctx) {
      const notation = args.trim() || "1d20";
      const parsed = parseDice(notation);
      if (!parsed) return { handled: true, feedback: `Invalid dice notation: ${notation}` };
      const rolls = rollDice(parsed.count, parsed.sides);
      const sum = rolls.reduce((a, b) => a + b, 0) + parsed.modifier;
      const modStr = parsed.modifier > 0 ? `+${parsed.modifier}` : parsed.modifier < 0 ? `${parsed.modifier}` : "";
      const detail = parsed.count > 1 ? ` [${rolls.join(", ")}]${modStr}` : modStr ? ` (${rolls[0]}${modStr})` : "";
      const text = `🎲 **${notation}** → **${sum}**${detail}`;
      ctx.createMessage({ role: "narrator", content: text });
      return { handled: true };
    },
  },
  {
    name: "uno",
    description: "Start a game of UNO with the characters in this chat",
    usage: "/uno",
    local: true,
    async execute(_args, ctx) {
      if (ctx.mode === "roleplay") {
        return { handled: true, feedback: "UNO can only be played in conversation chats." };
      }
      useUnoGameStore.getState().openSetup(ctx.chatId);
      return { handled: true };
    },
  },
  {
    name: "sys",
    aliases: ["system"],
    description: "Insert a system message",
    usage: "/sys <message>",
    local: true,
    async execute(args, ctx) {
      if (!args.trim()) return { handled: true, feedback: "Usage: /sys <message text>" };
      ctx.createMessage({ role: "system", content: args.trim() });
      return { handled: true };
    },
  },
  {
    name: "guided",
    aliases: ["narrator", "narrate", "nar"],
    description: "Steer the narrative — the AI will narrate events in the direction you describe",
    usage: "/guided <direction>",
    async execute(args, ctx) {
      if (!args.trim()) return { handled: true, feedback: "Usage: /guided <direction to steer the narrative>" };
      await ctx.generate({
        chatId: ctx.chatId,
        connectionId: null,
        generationGuide: buildNarratorInstructionMessage(args),
        generationGuideSource: "narrator",
      });
      return { handled: true };
    },
  },
  {
    name: "continue",
    aliases: ["cont"],
    description: "Continue the AI response without sending a message",
    usage: "/continue",
    async execute(_args, ctx) {
      if (!ctx.latestAssistantMessageId) {
        return { handled: true, feedback: "There is no assistant message to continue." };
      }
      await ctx.generate({ chatId: ctx.chatId, connectionId: null, continueMessageId: ctx.latestAssistantMessageId });
      return { handled: true };
    },
  },
  {
    name: "as",
    aliases: ["respond"],
    description: "Generate a response as a specific character",
    usage: "/as <character name>",
    async execute(args, ctx) {
      const name = args.trim();
      if (!name) return { handled: true, feedback: "Usage: /as <character name>" };
      const match = ctx.characterNames.find((n) => normalizeLookup(n) === normalizeLookup(name));
      if (!match) {
        return {
          handled: true,
          feedback: `Character "${name}" not found. Available: ${ctx.characterNames.join(", ")}`,
        };
      }
      // Inject instruction to respond as the specific character
      await ctx.generate({
        chatId: ctx.chatId,
        connectionId: null,
        userMessage: `[Respond as ${match}]`,
      });
      return { handled: true };
    },
  },
  {
    name: "emote",
    aliases: ["emotion", "sprite"],
    description: "List or switch roleplay sprite expressions",
    usage: '/emote [expression] | /emote "Character" <expression>',
    local: true,
    async execute(args, ctx) {
      const sceneCharacters = ctx.characters ?? [];
      if (sceneCharacters.length === 0) {
        return {
          handled: true,
          feedback: "No roleplay characters are available for /emote in this chat.",
        };
      }

      const namedArgs = parseNamedArgs(args);
      let requestedName = namedArgs.name ?? namedArgs.character ?? "";
      let requestedExpression = namedArgs.expression ?? namedArgs.emotion ?? namedArgs.sprite ?? "";
      let applyToAll = false;

      if (!args.trim() || (!requestedExpression && !requestedName)) {
        const tokens = parseCommandTokens(args);
        if (tokens.length === 0) {
          return { handled: true, feedback: await buildEmoteListFeedback(sceneCharacters) };
        }

        if (tokens.length === 1) {
          const token = tokens[0]!;
          if (isAllEmoteTarget(token.value)) {
            return { handled: true, feedback: await buildEmoteListFeedback(sceneCharacters) };
          }

          const quotedTarget = token.quoted ? findSceneCharacter(sceneCharacters, token.value) : null;
          if (quotedTarget) {
            requestedName = token.value;
          } else if (sceneCharacters.length === 1) {
            requestedExpression = token.value;
          } else {
            requestedExpression = token.value;
            applyToAll = true;
          }
        } else {
          const [targetToken, ...expressionTokens] = tokens;
          requestedExpression = expressionTokens
            .map((token) => token.value)
            .join(" ")
            .trim();
          if (targetToken && isAllEmoteTarget(targetToken.value)) {
            applyToAll = true;
          } else {
            requestedName = targetToken?.value ?? "";
          }
        }
      }

      if (requestedName && isAllEmoteTarget(requestedName)) {
        requestedName = "";
        applyToAll = true;
      }

      if (applyToAll) {
        if (!requestedExpression) {
          return { handled: true, feedback: await buildEmoteListFeedback(sceneCharacters) };
        }
        if (!ctx.setSpriteExpression) {
          return {
            handled: true,
            feedback: "Sprite switching is only available in roleplay chats with sprites enabled.",
          };
        }

        const matches = await Promise.all(
          sceneCharacters.map(async (character) => {
            const availableExpressions = await listSpriteExpressions(character.id);
            return {
              character,
              expression: matchSpriteExpression(availableExpressions, requestedExpression),
            };
          }),
        );
        const missing = matches.filter((entry) => !entry.expression);
        if (missing.length > 0) {
          return {
            handled: true,
            feedback: `Expression "${requestedExpression}" is not available for all characters. Missing: ${missing
              .map((entry) => entry.character.name)
              .join(", ")}.`,
          };
        }

        for (const match of matches) {
          await ctx.setSpriteExpression(match.character.id, match.expression!);
        }
        ctx.invalidate();
        return {
          handled: true,
          feedback: `Emote updated for ${matches.length} character${matches.length === 1 ? "" : "s"} -> ${requestedExpression}`,
        };
      }

      let target = requestedName ? findSceneCharacter(sceneCharacters, requestedName) : null;
      if (!target && !requestedName && sceneCharacters.length === 1) {
        target = sceneCharacters[0]!;
      }

      if (!target) {
        return {
          handled: true,
          feedback: `Character "${requestedName || "(missing)"}" not found. Available: ${sceneCharacters
            .map((character) => character.name)
            .join(", ")}`,
        };
      }

      const availableExpressions = await listSpriteExpressions(target.id);
      if (!requestedExpression) {
        return {
          handled: true,
          feedback: [
            `Available Emotes for ${target.name}:`,
            "",
            availableExpressions.length > 0 ? availableExpressions.join(", ") : "No uploaded expression sprites.",
            "",
            `Use /emote "${target.name}" expression to switch one manually.`,
          ].join("\n"),
        };
      }

      const expression = matchSpriteExpression(availableExpressions, requestedExpression);
      if (!expression) {
        return {
          handled: true,
          feedback:
            availableExpressions.length > 0
              ? `Expression "${requestedExpression}" not found for ${target.name}. Available: ${availableExpressions.join(", ")}`
              : `No uploaded expression sprites found for ${target.name}.`,
        };
      }

      if (!ctx.setSpriteExpression) {
        return {
          handled: true,
          feedback: "Sprite switching is only available in roleplay chats with sprites enabled.",
        };
      }

      await ctx.setSpriteExpression(target.id, expression);
      ctx.invalidate();
      return { handled: true, feedback: `Emote updated: ${target.name} -> ${expression}` };
    },
  },
  {
    name: "status",
    description: "Set or clear a conversation status override",
    usage: "/status <status|clear> [character name]",
    local: true,
    async execute(args, ctx) {
      if (ctx.mode !== "conversation") {
        return { handled: true, feedback: "/status is only available in conversation mode." };
      }

      const characters = ctx.characters ?? [];
      if (characters.length === 0) {
        return { handled: true, feedback: "No character metadata found for this chat." };
      }

      const tokens = parseCommandTokens(args);
      const action = normalizeLookup(tokens[0]?.value ?? "");
      if (!action) {
        return { handled: true, feedback: buildStatusCommandHelp(characters) };
      }

      const requestedName = tokens
        .slice(1)
        .map((token) => token.value)
        .join(" ")
        .trim();

      const resolveTargetCharacter = () => {
        if (requestedName) {
          return findSceneCharacter(characters, requestedName);
        }
        if (characters.length === 1) {
          return characters[0]!;
        }
        return null;
      };

      if (action === "clear") {
        const target = resolveTargetCharacter();
        if (!target) {
          return {
            handled: true,
            feedback: requestedName
              ? `Character "${requestedName}" not found. Available: ${formatAvailableCharacterList(characters)}`
              : buildStatusCommandHelp(characters),
          };
        }

        try {
          await api.patch(`/chats/${ctx.chatId}/metadata`, {
            conversationStatusOverrides: { [target.id]: null },
          });
          ctx.invalidate();
          return { handled: true, feedback: `Cleared ${target.name}'s status override.` };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          return { handled: true, feedback: `Failed to update status: ${message}` };
        }
      }

      if (!isConversationStatusValue(action)) {
        return {
          handled: true,
          feedback: `Status must be one of: online, idle, dnd, offline, clear.\n\n${buildStatusCommandHelp(characters)}`,
        };
      }

      const target = resolveTargetCharacter();
      if (!target) {
        return {
          handled: true,
          feedback: requestedName
            ? `Character "${requestedName}" not found. Available: ${formatAvailableCharacterList(characters)}`
            : buildStatusCommandHelp(characters),
        };
      }

      try {
        await api.patch(`/chats/${ctx.chatId}/metadata`, {
          conversationStatusOverrides: {
            [target.id]: {
              status: action,
              activity: null,
              createdAt: new Date().toISOString(),
              expiresAt: null,
            },
          },
        });
        ctx.invalidate();
        return { handled: true, feedback: `Set ${target.name} to ${action}.` };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { handled: true, feedback: `Failed to update status: ${message}` };
      }
    },
  },
  {
    name: "impersonate",
    aliases: ["imp"],
    description: "Generate a response as your character ({{user}}), optionally with a direction",
    usage: "/impersonate [direction]",
    async execute(args, ctx) {
      const direction = args.trim();
      const { impersonatePresetId, impersonateConnectionId, impersonateBlockAgents, impersonatePromptTemplate } =
        useUIStore.getState();
      const trimmedPromptTemplate = impersonatePromptTemplate.trim();
      await ctx.generate({
        chatId: ctx.chatId,
        connectionId: null,
        impersonate: true,
        ...(direction ? { userMessage: direction } : {}),
        ...(impersonatePresetId ? { impersonatePresetId } : {}),
        ...(impersonateConnectionId ? { impersonateConnectionId } : {}),
        ...(impersonateBlockAgents !== undefined ? { impersonateBlockAgents } : {}),
        ...(trimmedPromptTemplate ? { impersonatePromptTemplate: trimmedPromptTemplate } : {}),
      });
      return { handled: true };
    },
  },
  {
    name: "impersonate_prompt",
    aliases: ["imp_prompt"],
    description: "Set the prompt prefix used by /impersonate in this chat",
    usage: '/impersonate_prompt <prompt|reset>  (e.g. /impersonate_prompt "You will now play as my OC:")',
    local: true,
    async execute(args, ctx) {
      const raw = args.trim();
      if (!raw) {
        return {
          handled: true,
          feedback:
            'Usage: /impersonate_prompt "You will now play as my OC:"\nUse /impersonate_prompt reset to return to the default impersonation prompt.',
        };
      }

      if (/^(reset|clear|default)$/i.test(raw)) {
        await api.patch(`/chats/${ctx.chatId}/metadata`, { impersonatePrompt: null });
        ctx.invalidate();
        return { handled: true, feedback: "Impersonate prompt reset to the default." };
      }

      const prompt = parseImpersonatePromptArg(raw);
      if (!prompt) {
        return { handled: true, feedback: "Please provide a prompt, or use /impersonate_prompt reset." };
      }

      await api.patch(`/chats/${ctx.chatId}/metadata`, { impersonatePrompt: prompt });
      ctx.invalidate();
      return { handled: true, feedback: `Impersonate prompt updated:\n${prompt}` };
    },
  },
  {
    name: "remind",
    aliases: ["reminder", "timer"],
    description: "Set a timed reminder — the AI will message you after the specified time",
    usage: "/remind <time> <message>  (e.g. /remind 30m hang up laundry)",
    local: true,
    async execute(args, ctx) {
      const parsed = parseReminder(args.trim());
      if (!parsed) {
        return {
          handled: true,
          feedback:
            "Usage: /remind <time> <message>\nExamples: /remind 30m hang up laundry, /remind 1h30m check the oven",
        };
      }

      const { ms, timeStr, message } = parsed;
      const chatId = ctx.chatId;
      const invalidate = ctx.invalidate;

      setTimeout(async () => {
        try {
          await api.post(`/chats/${chatId}/messages`, {
            role: "narrator",
            content: `⏰ **Reminder:** ${message}`,
          });
          try {
            invalidate();
          } catch {
            /* component may have unmounted */
          }
        } catch {
          /* chat may have been deleted */
        }
        toast("⏰ Reminder!", { description: message, duration: 30_000 });
      }, ms);

      return {
        handled: true,
        feedback: `⏰ Reminder set for ${timeStr} from now: "${message}"\n(Keep this tab open — the reminder lives in your browser session.)`,
      };
    },
  },
  {
    name: "random",
    aliases: ["rand", "event"],
    description: "Introduce a random event to shake up the plot",
    usage: "/random",
    async execute(_args, ctx) {
      await ctx.generate({
        chatId: ctx.chatId,
        connectionId: null,
        userMessage:
          "[Narrator instruction — do not include a reply from {{user}}. Instead: And now, something completely different. Introduce a random, unexpected event to stir up the plot. Be creative and surprising — throw a curveball that keeps things interesting!]",
      });
      return { handled: true };
    },
  },
  {
    name: "scene",
    aliases: ["rp"],
    description: "Start a roleplay scene branching from this conversation",
    usage: "/scene [description]",
    local: true,
    async execute(args, ctx) {
      const prompt = args.trim();

      // If no prompt and no messages, guide the user
      if (!prompt) {
        const msgs = await api.get<unknown[]>(`/chats/${ctx.chatId}/messages`);
        if (!msgs || msgs.length === 0) {
          return {
            handled: true,
            feedback:
              "No conversation history to base a scene on. Provide a description or chat first: /scene <description>",
          };
        }
      }

      // Step 1: Ask the LLM to plan the scene (comprehensive plan)
      const planToastId = toast.loading("Planning scene...", { icon: "🎬" });
      let planRes: ScenePlanResponse;
      try {
        planRes = await api.post<ScenePlanResponse>("/scene/plan", {
          chatId: ctx.chatId,
          prompt,
          connectionId: null,
        });
      } catch {
        toast.dismiss(planToastId);
        return { handled: true, feedback: "Failed to plan scene. Check your API connection." };
      }

      if (!planRes.plan) {
        toast.dismiss(planToastId);
        return { handled: true, feedback: planRes.error || "Scene planning returned empty result. Try again." };
      }

      // Step 2: Create the scene chat using the full plan
      toast.loading("Creating scene...", { id: planToastId, icon: "🎬" });
      try {
        const res = await api.post<SceneCreateResponse>("/scene/create", {
          originChatId: ctx.chatId,
          initiatorCharId: null, // user-initiated
          plan: planRes.plan,
          connectionId: null,
        });

        // Invalidate chats so the new scene appears + navigate to it
        ctx.invalidate();
        useChatStore.getState().setActiveChatId(res.chatId);

        // Apply background if the plan chose one
        if (res.background) {
          useUIStore.getState().setChatBackground(`/api/backgrounds/file/${encodeURIComponent(res.background)}`);
        }

        toast.success(`Scene created: ${res.chatName}`, { id: planToastId, icon: "🎬" });
        return { handled: true };
      } catch {
        toast.dismiss(planToastId);
        return { handled: true, feedback: "Failed to create scene chat." };
      }
    },
  },
  {
    name: "goto",
    aliases: ["jump", "scroll"],
    description: "Scroll to a specific message number (e.g. /goto 27)",
    usage: "/goto <number>",
    local: true,
    async execute(args, ctx) {
      const raw = args.trim();
      const n = Number.parseInt(raw, 10);
      if (!raw || !Number.isFinite(n) || n < 1 || String(n) !== raw) {
        return { handled: true, feedback: "Usage: /goto <positive message number> (e.g. /goto 27)" };
      }
      useChatStore.getState().requestGotoMessage(ctx.chatId, n);
      return { handled: true };
    },
  },
  {
    name: "help",
    description: "Show available slash commands",
    usage: "/help",
    local: true,
    async execute(_args, _ctx) {
      return { handled: true, feedback: buildSlashHelpText() };
    },
  },
  {
    name: "hide",
    description: "Hide messages from AI context (won't be sent to the LLM on future turns)",
    usage: "/hide <indices>  (e.g. /hide 5, /hide 3-8, /hide 2-5,9,12)",
    local: true,
    async execute(args, ctx) {
      const indices = parseMessageIndices(args);
      if (!indices) {
        return {
          handled: true,
          feedback: "Usage: /hide <indices> — e.g. /hide 5, /hide 3-8, /hide 2-5,9,12",
        };
      }

      const messages: Array<{ id: string; extra?: unknown }> = await api.get(`/chats/${ctx.chatId}/messages`);
      const total = messages.length;
      const max = indices[indices.length - 1]!;
      if (max > total) {
        return {
          handled: true,
          feedback: `Message ${max} doesn't exist. This chat has ${total} messages.`,
        };
      }

      // Only send IDs for messages that aren't already hidden
      const targetIds = indices
        .filter((idx) => !isMessageHidden(messages[idx - 1]!))
        .map((idx) => messages[idx - 1]!.id);

      if (targetIds.length > 0) {
        await api.patch(`/chats/${ctx.chatId}/messages/bulk-hidden`, {
          messageIds: targetIds,
          hidden: true,
        });
      }

      ctx.invalidate();
      toast.success(`Hidden ${targetIds.length} message${targetIds.length !== 1 ? "s" : ""} from AI context`);
      return { handled: true };
    },
  },
  {
    name: "unhide",
    description: "Restore previously hidden messages back into AI context",
    usage: "/unhide <indices>  (e.g. /unhide 5, /unhide 3-8, /unhide 2-5,9,12)",
    local: true,
    async execute(args, ctx) {
      const indices = parseMessageIndices(args);
      if (!indices) {
        return {
          handled: true,
          feedback: "Usage: /unhide <indices> — e.g. /unhide 5, /unhide 3-8, /unhide 2-5,9,12",
        };
      }

      const messages: Array<{ id: string; extra?: unknown }> = await api.get(`/chats/${ctx.chatId}/messages`);
      const total = messages.length;
      const max = indices[indices.length - 1]!;
      if (max > total) {
        return {
          handled: true,
          feedback: `Message ${max} doesn't exist. This chat has ${total} messages.`,
        };
      }

      // Only send IDs for messages that are currently hidden
      const targetIds = indices
        .filter((idx) => isMessageHidden(messages[idx - 1]!))
        .map((idx) => messages[idx - 1]!.id);

      if (targetIds.length > 0) {
        await api.patch(`/chats/${ctx.chatId}/messages/bulk-hidden`, {
          messageIds: targetIds,
          hidden: false,
        });
      }

      ctx.invalidate();
      toast.success(`Restored ${targetIds.length} message${targetIds.length !== 1 ? "s" : ""} to AI context`);
      return { handled: true };
    },
  },
  {
    name: "macros",
    aliases: ["macro"],
    description: "List supported prompt macros like {{user}} and {{char}}",
    usage: "/macros",
    local: true,
    async execute() {
      return { handled: true, feedback: MACRO_HELP_TEXT };
    },
  },
];

/** Find a matching command for the given input. */
export function matchSlashCommand(input: string): { command: SlashCommand; args: string } | null {
  if (!input.startsWith("/")) return null;
  const spaceIdx = input.indexOf(" ");
  const cmdName = (spaceIdx === -1 ? input.slice(1) : input.slice(1, spaceIdx)).toLowerCase();
  const args = spaceIdx === -1 ? "" : input.slice(spaceIdx + 1);

  for (const cmd of COMMANDS) {
    if (cmd.name === cmdName || cmd.aliases?.includes(cmdName)) {
      return { command: cmd, args };
    }
  }
  return null;
}

/** Get all commands that match a partial prefix (for autocomplete). */
export function getSlashCompletions(partial: string): SlashCommand[] {
  if (!partial.startsWith("/")) return [];
  const rawPrefix = partial.slice(1);
  if (rawPrefix.includes(" ")) return [];
  const prefix = rawPrefix.trim().toLowerCase();
  if (!prefix) return COMMANDS;
  return COMMANDS.filter((c) => c.name.startsWith(prefix) || c.aliases?.some((a) => a.startsWith(prefix)));
}

export { COMMANDS as SLASH_COMMANDS };
