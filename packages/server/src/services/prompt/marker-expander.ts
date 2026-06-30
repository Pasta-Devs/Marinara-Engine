// ──────────────────────────────────────────────
// Marker Expander — Resolves special marker
// sections into actual content at assembly time.
// ──────────────────────────────────────────────
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { formatRpgStatsForPrompt, resolveMacros, stripMacroComments } from "@marinara-engine/shared";
import type {
  CharacterMacroProfile,
  MarkerConfig,
  ChatMLMessage,
  CharacterData,
  WrapFormat,
  RPGStatsConfig,
  LorebookEntryTimingState,
  MacroContext,
} from "@marinara-engine/shared";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createAgentsStorage } from "../storage/agents.storage.js";
import { processLorebooks, type LorebookFinalContentResolver, type LorebookScanResult } from "../lorebook/index.js";
import { wrapContent } from "./format-engine.js";
import { sanitizePromptLeaf } from "./prompt-escaping.js";
import { agentRuns } from "../../db/schema/index.js";
import { eq, and, desc } from "drizzle-orm";

/** Context required for expanding markers. */
export interface MarkerContext {
  db: DB;
  chatId: string;
  characterIds: string[];
  personaId?: string | null;
  personaName: string;
  personaDescription: string;
  personaFields?: {
    personality?: string;
    scenario?: string;
    backstory?: string;
    appearance?: string;
  };
  /** Raw personaStats JSON (for rpgStats injection) */
  personaStats?: any;
  chatMessages: ChatMLMessage[];
  /** Optional scan-only messages for lorebook matching. */
  lorebookScanMessages?: ChatMLMessage[];
  chatSummary: string | null;
  wrapFormat: WrapFormat;
  /** When false, agent_data markers expand to empty strings */
  enableAgents: boolean;
  /** Per-chat list of active agent type IDs (empty = no active agents, marker expansion suppressed) */
  activeAgentIds: string[];
  /** Per-chat list of manually activated lorebook IDs from chat settings */
  activeLorebookIds: string[];
  /** Lorebook IDs that should be excluded even if otherwise scoped to the chat. */
  excludedLorebookIds?: string[];
  /** Source agent IDs whose generated lorebooks should be excluded from scanning. */
  excludedLorebookSourceAgentIds?: string[];
  /** When true, lorebook markers expand to empty content without scanning global or scoped lorebooks. */
  disableLorebooks?: boolean;
  /** Pre-computed embedding of the chat context for semantic lorebook matching. */
  chatEmbedding?: number[] | null;
  /** Per-lorebook pre-computed embeddings for semantic lorebook matching. */
  semanticEmbeddingsByLorebookId?: ReadonlyMap<string, number[] | null>;
  /** Per-chat ephemeral state overrides for lorebook entries (from chat metadata). */
  entryStateOverrides?: Record<string, { ephemeral?: number | null; enabled?: boolean }>;
  /** Per-chat sticky/cooldown/delay timing state for lorebook entries. */
  entryTimingStates?: Record<string, LorebookEntryTimingState>;
  /** Global lorebook token budget for this chat/generation. */
  lorebookTokenBudget?: number;
  /** Current game state for lorebook conditions and schedules. */
  gameState?: Record<string, unknown> | null;
  /** Generation trigger labels used by per-entry lorebook include/exclude filters. */
  generationTriggers?: string[];
  /** Preview/debug expansion: lorebook markers should not consume timing or ephemeral state. */
  previewOnly?: boolean;
  /** Resolves prompt macros for final included lorebook entries. May apply macro side effects. */
  resolveLorebookContent?: LorebookFinalContentResolver;
  /** Standard prompt macro context used before escaping marker leaf text. */
  macroCtx: MacroContext;
  /** Collector for lorebook depth entries — populated during expansion, consumed by the assembler. */
  lorebookDepthEntries?: Array<{ content: string; role: "system" | "user" | "assistant"; depth: number }>;
  /** Collector for updated entry state overrides after ephemeral processing — saved to chat metadata by caller. */
  updatedEntryStateOverrides?: Record<string, { ephemeral?: number | null; enabled?: boolean }>;
  /** Collector for updated sticky/cooldown/delay timing state — saved to chat metadata by caller. */
  updatedEntryTimingStates?: Record<string, LorebookEntryTimingState>;
  /** Cached lorebook scan for all lorebook marker sections in this prompt build. */
  lorebookScanResult?: LorebookScanResult;
  /** True once cached lorebook state/depth side effects have been applied to this marker context. */
  lorebookScanResultApplied?: boolean;
  /** When set, replaces all individual character scenario fields with this shared group scenario. */
  groupScenarioOverrideText?: string | null;
}

/** Expanded marker result. */
export interface ExpandedMarker {
  /** Content to be inserted as the section body */
  content: string;
  /** If the marker produces multiple messages (e.g. chat_history), they go here */
  messages?: ChatMLMessage[];
}

function cardPromptText(value: unknown): string {
  return typeof value === "string" ? stripMacroComments(value).trim() : "";
}

function resolveSanitizedPromptLeaf(value: string, ctx: MarkerContext, macroCtx: MacroContext = ctx.macroCtx): string {
  return sanitizePromptLeaf(resolveMacros(value, macroCtx), ctx.wrapFormat);
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
    const profile = characterMacroProfileFromData(data);
    const characterMacroContext = macroContextForCharacterProfile(ctx.macroCtx, profile);

    const fields = config.characterFields ?? [
      "description",
      "personality",
      "scenario",
      "backstory",
      "appearance",
      "system_prompt",
    ];

    const charParts: string[] = [];
    for (const field of fields) {
      if (field === "name") continue; // Name is used as the parent tag, not a child field
      if (field === "post_history_instructions") continue; // Injected after chat history by the assembler.
      // Skip per-character scenario when a group scenario override is active
      if (field === "scenario" && ctx.groupScenarioOverrideText) continue;
      const value = cardPromptText(getCharacterField(data, field));
      if (value) {
        charParts.push(
          wrapContent(resolveSanitizedPromptLeaf(value, ctx, characterMacroContext), field, ctx.wrapFormat, 2),
        );
      }
    }

    // Auto-include RPG attributes if enabled and not already in fields
    if (!fields.includes("stats") && !fields.includes("rpg_attributes")) {
      const statsText = formatRpgStatsForPrompt(data.extensions?.rpgStats as RPGStatsConfig | undefined);
      if (statsText) {
        charParts.push(
          wrapContent(resolveSanitizedPromptLeaf(statsText, ctx), "rpg_attributes", ctx.wrapFormat, 2),
        );
      }
    }

    // Always wrap in a character-name parent tag
    const charBlock = charParts.filter(Boolean).join("\n");
    if (charBlock) {
      parts.push(wrapContent(charBlock, data.name, ctx.wrapFormat, 1));
    }
  }

  // Append group scenario override (replaces individual character scenarios)
  const groupScenarioOverrideText = cardPromptText(ctx.groupScenarioOverrideText);
  if (groupScenarioOverrideText) {
    parts.push(
      wrapContent(resolveSanitizedPromptLeaf(groupScenarioOverrideText, ctx), "scenario", ctx.wrapFormat, 1),
    );
  }

  return { content: parts.join("\n") };
}

function macroContextForCharacterProfile(base: MacroContext, profile: CharacterMacroProfile): MacroContext {
  return {
    ...base,
    char: profile.name,
    characterFields: {
      description: profile.description,
      personality: profile.personality,
      backstory: profile.backstory,
      appearance: profile.appearance,
      scenario: profile.scenario,
      example: profile.example,
      systemPrompt: profile.systemPrompt,
      postHistoryInstructions: profile.postHistoryInstructions,
    },
  };
}

function characterMacroProfileFromData(data: CharacterData): CharacterMacroProfile {
  return {
    name: data.name ?? "Character",
    description: data.description ?? "",
    personality: data.personality ?? "",
    backstory: data.extensions?.backstory ?? "",
    appearance: data.extensions?.appearance ?? "",
    scenario: data.scenario ?? "",
    example: data.mes_example ?? "",
    systemPrompt: data.system_prompt ?? "",
    postHistoryInstructions: data.post_history_instructions ?? "",
  };
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
    case "mes_example":
    case "example_dialogue":
      return data.mes_example;
    case "backstory":
      return data.extensions?.backstory ?? "";
    case "appearance":
      return data.extensions?.appearance ?? "";
    case "stats":
      return formatRpgStatsForPrompt(data.extensions?.rpgStats as RPGStatsConfig | undefined);
    default:
      return "";
  }
}

// ── Persona ────────────────────────────────────

async function expandPersona(_config: MarkerConfig, ctx: MarkerContext): Promise<ExpandedMarker> {
  const parts: string[] = [];
  const pName = ctx.personaName || "User";

  const personaDescription = cardPromptText(ctx.personaDescription);
  const personaPersonality = cardPromptText(ctx.personaFields?.personality);
  const personaBackstory = cardPromptText(ctx.personaFields?.backstory);
  const personaAppearance = cardPromptText(ctx.personaFields?.appearance);
  const personaScenario = cardPromptText(ctx.personaFields?.scenario);

  if (personaDescription) {
    parts.push(
      wrapContent(resolveSanitizedPromptLeaf(personaDescription, ctx), "description", ctx.wrapFormat, 2),
    );
  }
  if (personaPersonality) {
    parts.push(
      wrapContent(resolveSanitizedPromptLeaf(personaPersonality, ctx), "personality", ctx.wrapFormat, 2),
    );
  }
  if (personaBackstory) {
    parts.push(wrapContent(resolveSanitizedPromptLeaf(personaBackstory, ctx), "backstory", ctx.wrapFormat, 2));
  }
  if (personaAppearance) {
    parts.push(wrapContent(resolveSanitizedPromptLeaf(personaAppearance, ctx), "appearance", ctx.wrapFormat, 2));
  }
  if (personaScenario) {
    parts.push(wrapContent(resolveSanitizedPromptLeaf(personaScenario, ctx), "scenario", ctx.wrapFormat, 2));
  }

  // Include RPG attributes if enabled
  if (ctx.personaStats?.rpgStats?.enabled) {
    const rpg = ctx.personaStats.rpgStats as RPGStatsConfig;
    const statsText = formatRpgStatsForPrompt(rpg);
    if (statsText) {
      parts.push(wrapContent(resolveSanitizedPromptLeaf(statsText, ctx), "rpg_attributes", ctx.wrapFormat, 2));
    }
  }

  if (parts.length === 0) return { content: "" };

  return {
    content: wrapContent(parts.join("\n"), pName, ctx.wrapFormat, 1),
  };
}

// ── Lorebook / World Info ──────────────────────

async function expandLorebook(config: MarkerConfig, ctx: MarkerContext): Promise<ExpandedMarker> {
  if (ctx.disableLorebooks === true) return { content: "" };

  const result =
    ctx.lorebookScanResult ??
    (ctx.lorebookScanResult = await processLorebooks(
      ctx.db,
      ctx.lorebookScanMessages ?? ctx.chatMessages,
      ctx.gameState ?? null,
      {
        chatId: ctx.chatId,
        characterIds: ctx.characterIds,
        personaId: ctx.personaId ?? null,
        activeLorebookIds: ctx.activeLorebookIds,
        excludedLorebookIds: ctx.excludedLorebookIds,
        excludedSourceAgentIds: ctx.excludedLorebookSourceAgentIds,
        tokenBudget: ctx.lorebookTokenBudget,
        chatEmbedding: ctx.chatEmbedding ?? null,
        semanticEmbeddingsByLorebookId: ctx.semanticEmbeddingsByLorebookId,
        entryStateOverrides: ctx.entryStateOverrides,
        entryTimingStates: ctx.entryTimingStates,
        generationTriggers: ctx.generationTriggers ?? ["chat"],
        previewOnly: ctx.previewOnly === true,
        resolveContent: ctx.resolveLorebookContent,
      },
    ));

  if (ctx.lorebookScanResultApplied !== true) {
    ctx.lorebookScanResultApplied = true;

    // Collect updated per-chat entry state overrides for the caller to persist.
    if (result.updatedEntryStateOverrides) {
      ctx.updatedEntryStateOverrides = result.updatedEntryStateOverrides;
      ctx.entryStateOverrides = result.updatedEntryStateOverrides;
    }
    if (result.updatedEntryTimingStates !== undefined) {
      ctx.updatedEntryTimingStates = result.updatedEntryTimingStates;
      ctx.entryTimingStates = result.updatedEntryTimingStates;
    }

    // Collect depth entries for the assembler to inject later.
    if (result.depthEntries.length > 0) {
      ctx.lorebookDepthEntries ??= [];
      for (const de of result.depthEntries) {
        ctx.lorebookDepthEntries.push({
          content: sanitizePromptLeaf(de.content, ctx.wrapFormat),
          role: de.role,
          depth: de.depth,
        });
      }
    }
  }

  switch (config.type) {
    case "world_info_before":
      return { content: sanitizePromptLeaf(result.worldInfoBefore, ctx.wrapFormat) };
    case "world_info_after":
      return { content: sanitizePromptLeaf(result.worldInfoAfter, ctx.wrapFormat) };
    case "lorebook":
    default: {
      // Combined lorebook — all world info
      const combined = [result.worldInfoBefore, result.worldInfoAfter].filter(Boolean).join("\n\n");
      return { content: sanitizePromptLeaf(combined, ctx.wrapFormat) };
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

  messages = messages.map((message) => {
    const resolved = resolveMacros(message.content, ctx.macroCtx);
    return {
      ...message,
      content: ctx.wrapFormat === "none" ? resolved : sanitizePromptLeaf(resolved, ctx.wrapFormat),
    };
  });

  // Add chat_history / last_message wrapping based on format
  if (messages.length > 0 && ctx.wrapFormat !== "none") {
    // Everything before the final chat turn is "chat history"; the final turn gets
    // "last_message" wrapping, regardless of whether it is user or assistant.
    const lastMessageIdx = messages.length - 1;
    const historyEnd = lastMessageIdx;

    if (ctx.wrapFormat === "xml") {
      if (historyEnd > 0) {
        messages[0] = { ...messages[0]!, content: `<chat_history>\n${messages[0]!.content}` };
        messages[historyEnd - 1] = {
          ...messages[historyEnd - 1]!,
          content: `${messages[historyEnd - 1]!.content}\n</chat_history>`,
        };
      }
      messages[lastMessageIdx] = {
        ...messages[lastMessageIdx]!,
        content: `<last_message>\n${messages[lastMessageIdx]!.content}\n</last_message>`,
      };
    } else if (ctx.wrapFormat === "markdown") {
      if (historyEnd > 0) {
        messages[0] = { ...messages[0]!, content: `## Chat History\n${messages[0]!.content}` };
      }
      messages[lastMessageIdx] = {
        ...messages[lastMessageIdx]!,
        content: `## Last Message\n${messages[lastMessageIdx]!.content}`,
      };
    }
  }

  // Chat history is special — it returns multiple messages to be inserted directly,
  // not a single content block. The assembler handles this.
  return { content: "", messages: messages.map((message) => ({ ...message, contextKind: "history" as const })) };
}

// ── Dialogue Examples ──────────────────────────

async function expandDialogueExamples(_config: MarkerConfig, ctx: MarkerContext): Promise<ExpandedMarker> {
  const charStorage = createCharactersStorage(ctx.db);
  const parts: string[] = [];

  for (const charId of ctx.characterIds) {
    const row = await charStorage.getById(charId);
    if (!row) continue;
    const data = JSON.parse(row.data) as CharacterData;

    const example = cardPromptText(data.mes_example);
    if (example) {
      parts.push(
        resolveSanitizedPromptLeaf(
          example,
          ctx,
          macroContextForCharacterProfile(ctx.macroCtx, characterMacroProfileFromData(data)),
        ),
      );
    }
  }

  return { content: parts.join("\n\n") };
}

// ── Chat Summary ───────────────────────────────

function expandChatSummary(ctx: MarkerContext): ExpandedMarker {
  return { content: resolveSanitizedPromptLeaf(ctx.chatSummary ?? "", ctx) };
}

// ── Agent Data ─────────────────────────────────

async function expandAgentData(config: MarkerConfig, ctx: MarkerContext): Promise<ExpandedMarker> {
  if (!ctx.enableAgents) return { content: "" };
  const agentType = config.agentType;
  if (!agentType) return { content: "" };

  // Tracker agent types are now always injected directly by the generation
  // route (as a single formatted system message) regardless of preset
  // configuration. Skip them here to avoid duplicate data.
  const AUTO_INJECTED_TRACKERS = new Set([
    "world-state",
    "quest",
    "character-tracker",
    "persona-stats",
    "custom-tracker",
  ]);
  if (AUTO_INJECTED_TRACKERS.has(agentType)) return { content: "" };

  // Generation only runs agents explicitly added to the chat. If none are active,
  // prompt sections must not keep replaying the last saved output forever.
  if (ctx.activeAgentIds.length === 0 || !ctx.activeAgentIds.includes(agentType)) {
    return { content: "" };
  }

  // Generic: find latest successful agent run for this chat
  const agentsStorage = createAgentsStorage(ctx.db);
  const agentConfig = await agentsStorage.getByType(agentType);
  if (!agentConfig) return { content: "" };

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

  let resultData: unknown;
  try {
    resultData = JSON.parse(run.resultData);
  } catch (err) {
    logger.warn(
      err,
      "[prompt] Skipping malformed agent result data for %s in chat %s",
      agentType,
      ctx.chatId,
    );
    return { content: "" };
  }

  // Format result data as readable text
  return { content: sanitizePromptLeaf(formatAgentResult(resultData), ctx.wrapFormat) };
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
