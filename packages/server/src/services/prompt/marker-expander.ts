// ──────────────────────────────────────────────
// Marker Expander — Resolves special marker
// sections into actual content at assembly time.
// ──────────────────────────────────────────────
import type { DB } from "../../db/connection.js";
import type { MarkerConfig, ChatMLMessage, CharacterData, WrapFormat, RPGStatsConfig } from "@marinara-engine/shared";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createAgentsStorage } from "../storage/agents.storage.js";
import { processLorebooks } from "../lorebook/index.js";
import { wrapContent } from "./format-engine.js";
import { agentRuns } from "../../db/schema/index.js";
import { gameStateSnapshots } from "../../db/schema/index.js";
import { eq, and, desc } from "drizzle-orm";

/** Context required for expanding markers. */
export interface MarkerContext {
  db: DB;
  chatId: string;
  characterIds: string[];
  personaName: string;
  personaDescription: string;
  personaFields?: {
    personality?: string;
    scenario?: string;
    backstory?: string;
    appearance?: string;
  };
  chatMessages: ChatMLMessage[];
  chatSummary: string | null;
  wrapFormat: WrapFormat;
  /** When false, agent_data markers expand to empty strings */
  enableAgents: boolean;
  /** Per-chat list of active agent type IDs (empty = use global enabled state) */
  activeAgentIds: string[];
  /** Per-chat list of manually activated lorebook IDs from chat settings */
  activeLorebookIds: string[];
  /** Pre-computed embedding of the chat context for semantic lorebook matching. */
  chatEmbedding?: number[] | null;
}

/** Expanded marker result. */
export interface ExpandedMarker {
  /** Content to be inserted as the section body */
  content: string;
  /** If the marker produces multiple messages (e.g. chat_history), they go here */
  messages?: ChatMLMessage[];
}

/**
 * Expand a marker section into actual content based on its type and config.
 */
export async function expandMarker(config: MarkerConfig, ctx: MarkerContext): Promise<ExpandedMarker> {
  switch (config.type) {
    case "character":
      return expandCharacter(config, ctx);
    case "persona":
      return expandPersona(config, ctx);
    case "lorebook":
    case "world_info_before":
    case "world_info_after":
      return expandLorebook(config, ctx);
    case "chat_history":
      return expandChatHistory(config, ctx);
    case "chat_summary":
      return expandChatSummary(ctx);
    case "dialogue_examples":
      return expandDialogueExamples(config, ctx);
    case "agent_data":
      return expandAgentData(config, ctx);
    default:
      return { content: "" };
  }
}

// ── Character ──────────────────────────────────

async function expandCharacter(config: MarkerConfig, ctx: MarkerContext): Promise<ExpandedMarker> {
  const charStorage = createCharactersStorage(ctx.db);
  const parts: string[] = [];

  for (const charId of ctx.characterIds) {
    const row = await charStorage.getById(charId);
    if (!row) continue;
    const data = JSON.parse(row.data) as CharacterData;

    const fields = config.characterFields ?? ["description", "personality", "scenario"];

    const charParts: string[] = [];
    for (const field of fields) {
      if (field === "name") continue; // Name is used as the parent tag, not a child field
      const value = getCharacterField(data, field);
      if (value) {
        charParts.push(wrapContent(value, field, ctx.wrapFormat, 2));
      }
    }

    // Auto-include stats if rpgStats is enabled and not already in fields
    if (!fields.includes("stats")) {
      const statsText = formatRPGStats(data.extensions?.rpgStats as RPGStatsConfig | undefined);
      if (statsText) {
        charParts.push(wrapContent(statsText, "stats", ctx.wrapFormat, 2));
      }
    }

    // Always wrap in a character-name parent tag
    const charBlock = charParts.filter(Boolean).join("\n");
    if (charBlock) {
      parts.push(wrapContent(charBlock, data.name, ctx.wrapFormat, 1));
    }
  }

  return { content: parts.join("\n") };
}

function getCharacterField(data: CharacterData, field: string): string {
  switch (field) {
    case "name":
      return data.name;
    case "description":
      return data.description;
    case "personality":
      return data.personality;
    case "scenario":
      return data.scenario;
    case "first_mes":
      return data.first_mes;
    case "system_prompt":
      return data.system_prompt;
    case "post_history_instructions":
      return data.post_history_instructions;
    case "creator_notes":
      return data.creator_notes;
    case "backstory":
      return data.extensions?.backstory ?? "";
    case "appearance":
      return data.extensions?.appearance ?? "";
    case "stats":
      return formatRPGStats(data.extensions?.rpgStats as RPGStatsConfig | undefined);
    default:
      return "";
  }
}

/** Format RPG stats into a readable block. */
function formatRPGStats(rpgStats: RPGStatsConfig | undefined): string {
  if (!rpgStats?.enabled) return "";
  const lines: string[] = [];
  lines.push(`HP: ${rpgStats.hp.value}/${rpgStats.hp.max}`);
  lines.push(`MP: ${rpgStats.mp.value}/${rpgStats.mp.max}`);
  if (rpgStats.attributes.length > 0) {
    lines.push(rpgStats.attributes.map((a) => `${a.name}: ${a.value}/${a.max}`).join(", "));
  }
  return lines.join("\n");
}

// ── Persona ────────────────────────────────────

async function expandPersona(_config: MarkerConfig, ctx: MarkerContext): Promise<ExpandedMarker> {
  const parts: string[] = [];
  const pName = ctx.personaName || "User";

  if (ctx.personaDescription) {
    parts.push(wrapContent(ctx.personaDescription, "description", ctx.wrapFormat, 2));
  }
  if (ctx.personaFields?.personality) {
    parts.push(wrapContent(ctx.personaFields.personality, "personality", ctx.wrapFormat, 2));
  }
  if (ctx.personaFields?.backstory) {
    parts.push(wrapContent(ctx.personaFields.backstory, "backstory", ctx.wrapFormat, 2));
  }
  if (ctx.personaFields?.appearance) {
    parts.push(wrapContent(ctx.personaFields.appearance, "appearance", ctx.wrapFormat, 2));
  }
  if (ctx.personaFields?.scenario) {
    parts.push(wrapContent(ctx.personaFields.scenario, "scenario", ctx.wrapFormat, 2));
  }

  if (parts.length === 0) return { content: "" };

  return {
    content: wrapContent(parts.join("\n"), pName, ctx.wrapFormat, 1),
  };
}

// ── Lorebook / World Info ──────────────────────

async function expandLorebook(config: MarkerConfig, ctx: MarkerContext): Promise<ExpandedMarker> {
  const result = await processLorebooks(ctx.db, ctx.chatMessages, null, {
    chatId: ctx.chatId,
    characterIds: ctx.characterIds,
    activeLorebookIds: ctx.activeLorebookIds,
    chatEmbedding: ctx.chatEmbedding ?? null,
  });

  switch (config.type) {
    case "world_info_before":
      return { content: result.worldInfoBefore };
    case "world_info_after":
      return { content: result.worldInfoAfter };
    case "lorebook":
    default: {
      // Combined lorebook — all world info
      const combined = [result.worldInfoBefore, result.worldInfoAfter].filter(Boolean).join("\n\n");
      return { content: combined };
    }
  }
}

// ── Chat History ───────────────────────────────

async function expandChatHistory(config: MarkerConfig, ctx: MarkerContext): Promise<ExpandedMarker> {
  const opts = config.chatHistoryOptions ?? {};
  let messages = [...ctx.chatMessages];

  // Filter system messages if configured
  if (opts.includeSystemMessages === false) {
    messages = messages.filter((m) => m.role !== "system");
  }

  // Limit messages if configured
  if (opts.maxMessages && opts.maxMessages > 0) {
    messages = messages.slice(-opts.maxMessages);
  }

  // Add chat_history / last_message wrapping based on format
  if (messages.length > 0 && ctx.wrapFormat !== "none") {
    // Find the last user message index — this becomes <last_message>
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.role === "user") {
        lastUserIdx = i;
        break;
      }
    }

    // Everything before the last user message is "chat history",
    // the last user message gets "last_message" wrapping
    const historyEnd = lastUserIdx >= 0 ? lastUserIdx : messages.length;

    if (ctx.wrapFormat === "xml") {
      if (historyEnd > 0) {
        messages[0] = { ...messages[0]!, content: `<chat_history>\n${messages[0]!.content}` };
        messages[historyEnd - 1] = {
          ...messages[historyEnd - 1]!,
          content: `${messages[historyEnd - 1]!.content}\n</chat_history>`,
        };
      }
      if (lastUserIdx >= 0) {
        messages[lastUserIdx] = {
          ...messages[lastUserIdx]!,
          content: `<last_message>\n${messages[lastUserIdx]!.content}\n</last_message>`,
        };
      }
    } else if (ctx.wrapFormat === "markdown") {
      if (historyEnd > 0) {
        messages[0] = { ...messages[0]!, content: `## Chat History\n${messages[0]!.content}` };
      }
      if (lastUserIdx >= 0) {
        messages[lastUserIdx] = {
          ...messages[lastUserIdx]!,
          content: `## Last Message\n${messages[lastUserIdx]!.content}`,
        };
      }
    }
  }

  // Chat history is special — it returns multiple messages to be inserted directly,
  // not a single content block. The assembler handles this.
  return { content: "", messages };
}

// ── Dialogue Examples ──────────────────────────

async function expandDialogueExamples(_config: MarkerConfig, ctx: MarkerContext): Promise<ExpandedMarker> {
  const charStorage = createCharactersStorage(ctx.db);
  const parts: string[] = [];

  for (const charId of ctx.characterIds) {
    const row = await charStorage.getById(charId);
    if (!row) continue;
    const data = JSON.parse(row.data) as CharacterData;

    if (data.mes_example) {
      parts.push(data.mes_example);
    }
  }

  return { content: parts.join("\n\n") };
}

// ── Chat Summary ───────────────────────────────

function expandChatSummary(ctx: MarkerContext): ExpandedMarker {
  return { content: ctx.chatSummary ?? "" };
}

// ── Agent Data ─────────────────────────────────

async function expandAgentData(config: MarkerConfig, ctx: MarkerContext): Promise<ExpandedMarker> {
  if (!ctx.enableAgents) return { content: "" };
  const agentType = config.agentType;
  if (!agentType) return { content: "" };

  // Per-chat active agent filter: if a per-chat list is set, only include agents in that list
  if (ctx.activeAgentIds.length > 0 && !ctx.activeAgentIds.includes(agentType)) {
    return { content: "" };
  }

  // Special case: world-state uses game_state_snapshots for richer structured data
  if (agentType === "world-state") {
    const wsStorage = createAgentsStorage(ctx.db);
    const wsConfig = await wsStorage.getByType("world-state");
    if (wsConfig && wsConfig.enabled !== "true") return { content: "" };
    return expandWorldStateAgent(ctx);
  }

  // Generic: find latest successful agent run for this chat
  const agentsStorage = createAgentsStorage(ctx.db);
  const agentConfig = await agentsStorage.getByType(agentType);
  if (!agentConfig) return { content: "" };
  if (agentConfig.enabled !== "true") return { content: "" };

  const latestRuns = await ctx.db
    .select()
    .from(agentRuns)
    .where(
      and(eq(agentRuns.agentConfigId, agentConfig.id), eq(agentRuns.chatId, ctx.chatId), eq(agentRuns.success, "true")),
    )
    .orderBy(desc(agentRuns.createdAt))
    .limit(1);

  const run = latestRuns[0];
  if (!run) return { content: "" };

  const resultData = JSON.parse(run.resultData);
  // Format result data as readable text
  return { content: formatAgentResult(resultData) };
}

async function expandWorldStateAgent(ctx: MarkerContext): Promise<ExpandedMarker> {
  // Prefer committed game state — uncommitted snapshots from swipes/regens
  // are normally skipped so the prompt stays clean between swipes.
  const committedRows = await ctx.db
    .select()
    .from(gameStateSnapshots)
    .where(and(eq(gameStateSnapshots.chatId, ctx.chatId), eq(gameStateSnapshots.committed, 1)))
    .orderBy(desc(gameStateSnapshots.createdAt))
    .limit(1);

  let snap = committedRows[0];

  // Fallback: if no committed snapshot exists yet (e.g. first agent run),
  // use the latest snapshot regardless of committed status so world state
  // data isn't silently dropped until the next user message.
  if (!snap) {
    const anyRows = await ctx.db
      .select()
      .from(gameStateSnapshots)
      .where(eq(gameStateSnapshots.chatId, ctx.chatId))
      .orderBy(desc(gameStateSnapshots.createdAt))
      .limit(1);
    snap = anyRows[0];
  }

  if (!snap) return { content: "" };

  const parts: string[] = [];
  if (snap.date) parts.push(`Date: ${snap.date}`);
  if (snap.time) parts.push(`Time: ${snap.time}`);
  if (snap.location) parts.push(`Location: ${snap.location}`);
  if (snap.weather) parts.push(`Weather: ${snap.weather}`);
  if (snap.temperature) parts.push(`Temperature: ${snap.temperature}`);

  const presentChars = JSON.parse(snap.presentCharacters);
  if (Array.isArray(presentChars) && presentChars.length > 0) {
    const charLines = presentChars.map((c: any) => {
      if (typeof c === "string") return `- ${c}`;
      const details: string[] = [];
      if (c.mood) details.push(`mood: ${c.mood}`);
      if (c.appearance) details.push(`appearance: ${c.appearance}`);
      if (c.outfit) details.push(`outfit: ${c.outfit}`);
      if (c.thoughts) details.push(`thoughts: ${c.thoughts}`);
      if (Array.isArray(c.stats) && c.stats.length > 0) {
        const statStr = c.stats.map((s: any) => `${s.name}: ${s.value}${s.max ? `/${s.max}` : ""}`).join(", ");
        details.push(`stats: ${statStr}`);
      }
      const detailStr = details.length > 0 ? ` (${details.join("; ")})` : "";
      return `- ${c.emoji ?? ""} ${c.name ?? c}${detailStr}`;
    });
    parts.push(`Present Characters:\n${charLines.join("\n")}`);
  }

  // Persona stats (needs/condition bars)
  if (snap.personaStats) {
    const psBars = typeof snap.personaStats === "string" ? JSON.parse(snap.personaStats) : snap.personaStats;
    if (Array.isArray(psBars) && psBars.length > 0) {
      const barLines = psBars.map((b: any) => `- ${b.name}: ${b.value}/${b.max}`);
      parts.push(`Persona Stats:\n${barLines.join("\n")}`);
    }
  }

  if (snap.playerStats) {
    const stats = typeof snap.playerStats === "string" ? JSON.parse(snap.playerStats) : snap.playerStats;
    const statParts: string[] = [];
    if (stats.status) statParts.push(`Status: ${stats.status}`);
    if (Array.isArray(stats.activeQuests) && stats.activeQuests.length > 0) {
      const questLines = stats.activeQuests.map((q: any) => {
        const objectives = Array.isArray(q.objectives)
          ? q.objectives.map((o: any) => `  ${o.completed ? "[x]" : "[ ]"} ${o.text}`).join("\n")
          : "";
        return `- ${q.name}${q.completed ? " (completed)" : ""}${objectives ? "\n" + objectives : ""}`;
      });
      statParts.push(`Active Quests:\n${questLines.join("\n")}`);
    }
    if (Array.isArray(stats.inventory) && stats.inventory.length > 0) {
      const invLines = stats.inventory.map(
        (item: any) =>
          `- ${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ""}${item.description ? ` — ${item.description}` : ""}`,
      );
      statParts.push(`Inventory:\n${invLines.join("\n")}`);
    }
    if (Array.isArray(stats.stats) && stats.stats.length > 0) {
      const statLines = stats.stats.map((s: any) => `- ${s.name}: ${s.value}${s.max ? `/${s.max}` : ""}`);
      statParts.push(`Stats:\n${statLines.join("\n")}`);
    }
    if (statParts.length > 0) parts.push(statParts.join("\n"));
  }

  return { content: parts.join("\n") };
}

function formatAgentResult(data: unknown): string {
  if (typeof data === "string") return data;
  if (data == null) return "";
  if (typeof data === "object") {
    // For objects, produce a readable key-value format
    const entries = Object.entries(data as Record<string, unknown>);
    return entries
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => {
        const label = k
          .replace(/([A-Z])/g, " $1")
          .replace(/[_-]/g, " ")
          .trim();
        const capitalLabel = label.charAt(0).toUpperCase() + label.slice(1);
        if (Array.isArray(v)) {
          return `${capitalLabel}:\n${v.map((item) => `- ${typeof item === "string" ? item : JSON.stringify(item)}`).join("\n")}`;
        }
        if (typeof v === "object") return `${capitalLabel}: ${JSON.stringify(v)}`;
        return `${capitalLabel}: ${v}`;
      })
      .join("\n");
  }
  return String(data);
}
