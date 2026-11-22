// ──────────────────────────────────────────────
// Importer: SillyTavern Prompt Preset
// ──────────────────────────────────────────────
import type { DB } from "../../db/connection.js";
import type { GenerationParameters, MarkerConfig } from "@marinara-engine/shared";
import { DEFAULT_GENERATION_PARAMS, generationParametersSchema } from "@marinara-engine/shared";
import { createPromptsStorage } from "../storage/prompts.storage.js";
import type { PromptVariableGroup } from "@marinara-engine/shared";
import { withImportTags, type ImportTagOptions } from "@marinara-engine/shared";
import type { TimestampOverrides } from "./import-timestamps.js";
import { createRegexScriptsStorage } from "../storage/regex-scripts.storage.js";
import { convertStRegexScripts, countStRegexScriptsLeftOut } from "./st-character.importer.js";
import { logger } from "../../lib/logger.js";

/** Friendly display names for consolidated markers. */
const MARKER_DISPLAY_NAMES: Partial<Record<string, string>> = {
  character: "Character Info",
  lorebook: "World Info",
  world_info_before: "World Info (before)",
  world_info_after: "World Info (after)",
  persona: "Persona",
  chat_history: "Chat History",
  dialogue_examples: "Chat Examples",
  chat_summary: "Chat Summary",
  agent_data: "Agent Data",
};
/**
 * Where an imported preset sends World Info, for the import report:
 * - split: World Info (before) and (after) keep their own places;
 * - combined: the file names one spot, so before and after entries go there together;
 * - beforeOff / afterOff: one of the two is turned off in the file, so those entries aren't sent (as in SillyTavern);
 * - off: both (or the only one) are turned off.
 */
export type STPresetWorldInfo = "split" | "combined" | "beforeOff" | "afterOff" | "off";

interface STPromptEntry {
  identifier: string;
  name: string;
  system_prompt?: boolean;
  role?: string;
  content?: string;
  marker?: boolean;
  enabled?: boolean;
  injection_position?: number;
  injection_depth?: number;
  injection_order?: number;
  forbid_overrides?: boolean;
}

interface STPreset {
  prompts?: STPromptEntry[];
  prompt_order?: Array<{
    character_id: number;
    order: Array<{ identifier: string; enabled: boolean }>;
  }>;
  [key: string]: unknown;
}

/** A SillyTavern preset setting with no place in a Marinara preset, named for the import summary. */
export type STPresetLeftOut =
  | "maxTokens"
  | "maxContext"
  | "topA"
  | "repetitionPenalty"
  | "outOfRange"
  | "impersonationPrompt"
  | "continueNudge"
  | "newChatPrompts"
  | "namesBehavior"
  | "formatTemplates"
  // Post-History sent inside the last user message while Post-Processing Messages is Apply (the default).
  | "postHistoryRole";

// SillyTavern's own defaults for its utility prompts: a preset that still has them changed nothing worth naming.
const ST_UTILITY_PROMPT_DEFAULTS: Array<[string, string, STPresetLeftOut]> = [
  [
    "impersonation_prompt",
    "[Write your next reply from the point of view of {{user}}, using the chat history so far as a guideline for the writing style of {{user}}. Don't write as {{char}} or system. Don't describe actions of {{char}}.]",
    "impersonationPrompt",
  ],
  [
    "continue_nudge_prompt",
    "[Continue the following message. Do not include ANY parts of the original message. Use capitalization and punctuation as if your reply is a part of the original message: {{lastChatMessage}}]",
    "continueNudge",
  ],
  ["new_chat_prompt", "[Start a new Chat]", "newChatPrompts"],
  ["new_group_chat_prompt", "[Start a new group chat. Group members: {{group}}]", "newChatPrompts"],
  ["new_example_chat_prompt", "[Example Chat]", "newChatPrompts"],
  ["group_nudge_prompt", "[Write the next reply only as {{char}}.]", "newChatPrompts"],
];
const ST_FORMAT_DEFAULTS: Array<[string, string]> = [
  ["wi_format", "{0}"],
  ["scenario_format", "{{scenario}}"],
  ["personality_format", "{{personality}}"],
];

type ImportedSamplerKey = "temperature" | "topP" | "topK" | "minP" | "frequencyPenalty" | "presencePenalty";

// Chat-completion preset names first, then the Text Completion ("TextGen Settings") names for the same setting.
const ST_SAMPLER_KEYS: Array<[string[], ImportedSamplerKey]> = [
  [["temperature", "temp"], "temperature"],
  [["top_p"], "topP"],
  [["top_k"], "topK"],
  [["min_p"], "minP"],
  [["frequency_penalty", "freq_pen"], "frequencyPenalty"],
  [["presence_penalty", "presence_pen"], "presencePenalty"],
];

/** The first of these keys the preset has a number for. */
function firstNumber(raw: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = finiteNumber(raw[key]);
    if (value !== null) return value;
  }
  return null;
}

// SillyTavern's "auto" leaves the choice to the provider, which is what no value does here.
const ST_REASONING_EFFORT: Record<string, GenerationParameters["reasoningEffort"]> = {
  min: "low",
  low: "low",
  medium: "medium",
  high: "high",
  max: "maximum",
};

function finiteNumber(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * The sampler settings a SillyTavern chat-completion preset carries, as a Marinara preset's own parameters
 * ("Starting settings for chats using this preset"; a connection's or chat's own values still win). Values that
 * match Marinara's defaults are left out so they don't read as preset choices. Output and context size belong to
 * the connection here, and Top A and repetition penalty have no field, so those are reported instead.
 */
export function readSTPresetParameters(raw: Record<string, unknown>) {
  const parameters: Partial<GenerationParameters> = {};
  const leftOut = new Set<STPresetLeftOut>();
  for (const [stKeys, key] of ST_SAMPLER_KEYS) {
    const value = firstNumber(raw, stKeys);
    if (value === null) continue;
    const parsed = generationParametersSchema.shape[key].safeParse(value);
    if (!parsed.success) {
      leftOut.add("outOfRange");
      continue;
    }
    if (parsed.data !== DEFAULT_GENERATION_PARAMS[key]) parameters[key] = parsed.data as number;
  }
  if (typeof raw.reasoning_effort === "string") {
    const effort = ST_REASONING_EFFORT[raw.reasoning_effort.trim().toLowerCase()];
    if (effort) parameters.reasoningEffort = effort;
  }
  if (firstNumber(raw, ["openai_max_tokens", "genamt", "max_new_tokens"]) !== null) leftOut.add("maxTokens");
  if (firstNumber(raw, ["openai_max_context", "max_length"]) !== null) leftOut.add("maxContext");
  const topA = finiteNumber(raw.top_a);
  if (topA !== null && topA !== 0) leftOut.add("topA");
  const repetitionPenalty = firstNumber(raw, ["repetition_penalty", "rep_pen"]);
  if (repetitionPenalty !== null && repetitionPenalty !== 1) leftOut.add("repetitionPenalty");
  // Settings with an exact match here, kept only when they differ from Marinara's default.
  if (typeof raw.assistant_prefill === "string" && raw.assistant_prefill.trim()) {
    parameters.assistantPrefill = raw.assistant_prefill;
  }
  if (
    typeof raw.squash_system_messages === "boolean" &&
    raw.squash_system_messages !== DEFAULT_GENERATION_PARAMS.squashSystemMessages
  ) {
    parameters.squashSystemMessages = raw.squash_system_messages;
  }
  // Prompts and switches with no matching setting: named so nobody wonders where they went.
  for (const [key, stDefault, code] of ST_UTILITY_PROMPT_DEFAULTS) {
    const value = raw[key];
    if (typeof value === "string" && value.trim() && value.trim() !== stDefault) leftOut.add(code);
  }
  const namesBehavior = finiteNumber(raw.names_behavior);
  if (namesBehavior !== null && namesBehavior !== 0) leftOut.add("namesBehavior");
  if (
    ST_FORMAT_DEFAULTS.some(
      ([key, stDefault]) => typeof raw[key] === "string" && (raw[key] as string).trim() !== stDefault,
    )
  ) {
    leftOut.add("formatTemplates");
  }
  return { parameters, leftOut: [...leftOut] };
}

/**
 * Import a SillyTavern prompt preset JSON.
 * Parses the prompt array, variable toggle groups and the preset's own sampler settings (readSTPresetParameters).
 */
export async function importSTPreset(
  raw: Record<string, unknown>,
  db: DB,
  fileName?: string,
  options?: {
    timestampOverrides?: TimestampOverrides | null;
    /** The "Tag imported" / "Tag source" checkboxes. Left out, the preset gets no import tags. */
    importTags?: ImportTagOptions;
    /** The source tag; SillyTavern by default. */
    source?: string;
  },
) {
  const storage = createPromptsStorage(db);
  const preset = raw as unknown as STPreset;

  // Detect variable toggle groups from naming patterns
  const variableGroups = detectVariableGroups(preset.prompts ?? []);
  const samplers = readSTPresetParameters(raw);

  // Create the preset
  const created = await storage.create(
    {
      // Its own name and no description: where it came from is a tag ("Imported", "ST").
      name: guessPresetName(raw, fileName),
      description: "",
      ...(options?.importTags ? { tags: withImportTags([], options.source ?? "st", options.importTags) } : {}),
      variableGroups,
      variableValues: {},
      parameters: samplers.parameters,
      // SillyTavern sends its prompts as plain text, without section tags.
      wrapFormat: "none",
    },
    options?.timestampOverrides,
  );

  if (!created) return { error: "Failed to create preset" };

  // Determine the section order from prompt_order (prefer the custom 100001 ordering)
  const orderDef = preset.prompt_order?.find((o) => o.character_id === 100001) ?? preset.prompt_order?.[0];
  const orderMap = new Map(orderDef?.order?.map((o, i) => [o.identifier, { index: i, enabled: o.enabled }]) ?? []);
  const chatHistoryIndex = orderMap.get("chatHistory")?.index ?? Number.MAX_SAFE_INTEGER;

  // Import each prompt entry as a section
  const prompts = preset.prompts ?? [];
  let sectionsCreated = 0;
  let postHistoryAsUser = false;

  // Sort prompts by prompt_order so sections are created in the correct display order.
  // Prompts not listed in prompt_order are appended at the end.
  const sortedPrompts = [...prompts].sort((a, b) => {
    const idxA = orderMap.get(a.identifier)?.index ?? Number.MAX_SAFE_INTEGER;
    const idxB = orderMap.get(b.identifier)?.index ?? Number.MAX_SAFE_INTEGER;
    return idxA - idxB;
  });

  // Detect XML wrapper bracket pairs and create groups for them
  const groupIdMap = await detectAndCreateGroups(sortedPrompts, created.id, storage);

  // Track identifier → created section ID for reordering
  const createdSectionIds: string[] = [];

  // World Info (before) and (after) keep their own places when the file uses both, so entries
  // SillyTavern sends after the character still come after it. A preset that names only one
  // (older files) gets one combined World Info section, so no entries are lost.
  const worldInfoLayout = readWorldInfoLayout(prompts, orderMap.size > 0 ? orderMap : null);

  // Track which consolidated marker types have already been emitted so we
  // don't create duplicates (e.g. the character parts → one Character Info section).
  const emittedMarkerTypes = new Set<string>();

  for (const entry of sortedPrompts) {
    // Skip bracket entries that are just XML open/close tags (now handled by groups)
    const isBracket = /^[┌└┎┖⌈⌊⌜⌞]/.test(entry.name);
    if (isBracket && !entry.content?.trim()) continue;

    // Map ST marker identifiers to our marker types
    const mappedMarkerConfig = entry.marker ? mapSTMarkerConfig(entry.identifier, worldInfoLayout.split) : null;

    // Deduplicate consolidated markers — if we already emitted a marker of
    // this type, skip the duplicate (e.g. second world-info or character marker).
    if (mappedMarkerConfig) {
      const key = mappedMarkerConfig.type;
      if (emittedMarkerTypes.has(key)) continue;
      emittedMarkerTypes.add(key);
    }

    // Map ST role to our role (the file's role is kept, Post-History too; system when it names none)
    let role: "system" | "user" | "assistant" = "system";
    if (entry.role === "user") role = "user";
    if (entry.role === "assistant") role = "assistant";

    // Determine injection position
    const entryOrderIndex = orderMap.get(entry.identifier)?.index ?? Number.MAX_SAFE_INTEGER;
    const isPostHistoryEntry =
      entryOrderIndex > chatHistoryIndex &&
      /(?:jailbreak|post[_-]?history|posthistory)/i.test(`${entry.identifier} ${entry.name}`);
    const injectionPosition =
      isPostHistoryEntry || entry.injection_position === 1 ? ("depth" as const) : ("ordered" as const);

    // Check override from prompt_order
    const orderInfo = orderMap.get(entry.identifier);
    const enabled = orderInfo?.enabled ?? entry.enabled ?? true;

    // Assign to group if the entry was between bracket markers
    const groupId = isPostHistoryEntry ? null : (groupIdMap.get(entry.identifier) ?? null);

    // Use friendly names for consolidated markers
    const sectionName = mappedMarkerConfig ? (MARKER_DISPLAY_NAMES[mappedMarkerConfig.type] ?? entry.name) : entry.name;

    const section = await storage.createSection({
      presetId: created.id,
      identifier: entry.identifier,
      name: sectionName,
      content: entry.content ?? "",
      role,
      enabled,
      isMarker: !!mappedMarkerConfig,
      injectionPosition,
      injectionDepth: isPostHistoryEntry ? 0 : (entry.injection_depth ?? 0),
      injectionOrder: entry.injection_order ?? 100,
      groupId,
      markerConfig: mappedMarkerConfig,
      forbidOverrides: entry.forbid_overrides ?? false,
    });
    if (section) createdSectionIds.push(section.id);
    sectionsCreated++;
    if (isPostHistoryEntry && role === "system" && enabled && (entry.content ?? "").trim()) postHistoryAsUser = true;
  }

  // Explicitly set the section order and injection orders to match prompt_order.
  // This ensures correct ordering regardless of createSection append behavior.
  if (createdSectionIds.length > 0) {
    await storage.reorderSections(created.id, createdSectionIds);
  }

  const regexImported = await importPresetRegexScripts(raw, created.id, db);
  const presetExtensions =
    raw.extensions && typeof raw.extensions === "object" ? (raw.extensions as Record<string, unknown>) : null;
  const regexSkipped = countStRegexScriptsLeftOut(presetExtensions?.regex_scripts);

  return {
    success: true,
    presetId: created.id,
    sectionsImported: sectionsCreated,
    variableGroups: variableGroups.length,
    regexImported,
    regexSkipped,
    parametersImported: Object.keys(samplers.parameters),
    parametersLeftOut: postHistoryAsUser ? [...samplers.leftOut, "postHistoryRole" as const] : samplers.leftOut,
    worldInfo: worldInfoLayout.kind ?? undefined,
  };
}

/**
 * Which World Info markers the file really uses: listed in its prompt order (or in its prompts when it
 * has no order), and whether each is on. Both used → separate before/after sections.
 */
function readWorldInfoLayout(
  prompts: STPromptEntry[],
  orderMap: Map<string, { index: number; enabled?: boolean }> | null,
): { split: boolean; kind: STPresetWorldInfo | null } {
  const state = (identifier: string): { enabled: boolean } | null => {
    const entry = prompts.find((prompt) => prompt.identifier === identifier && prompt.marker);
    if (!entry) return null;
    if (orderMap) {
      const order = orderMap.get(identifier);
      if (!order) return null;
      return { enabled: order.enabled ?? entry.enabled ?? true };
    }
    return { enabled: entry.enabled ?? true };
  };
  const before = state("worldInfoBefore");
  const after = state("worldInfoAfter");
  if (before && after) {
    if (before.enabled && after.enabled) return { split: true, kind: "split" };
    if (before.enabled) return { split: true, kind: "afterOff" };
    if (after.enabled) return { split: true, kind: "beforeOff" };
    return { split: true, kind: "off" };
  }
  const only = before ?? after;
  if (!only) return { split: false, kind: null };
  return { split: false, kind: only.enabled ? "combined" : "off" };
}

/**
 * SillyTavern keeps a preset's own regex scripts in `extensions.regex_scripts`. They come in
 * linked to the new preset (so they only run with it and show in its folder in Regex scripts),
 * after every existing script in run order.
 */
async function importPresetRegexScripts(raw: Record<string, unknown>, presetId: string, db: DB) {
  const extensions =
    raw.extensions && typeof raw.extensions === "object" ? (raw.extensions as Record<string, unknown>) : null;
  if (!extensions || !Array.isArray(extensions.regex_scripts) || extensions.regex_scripts.length === 0) return 0;
  const regexStorage = createRegexScriptsStorage(db);
  const existing = await regexStorage.list();
  const orderBase = existing.reduce((maximum, script) => Math.max(maximum, script.order), -1) + 1;
  let created = 0;
  for (const input of convertStRegexScripts(extensions.regex_scripts, { presetIds: [presetId] }, orderBase)) {
    try {
      await regexStorage.create(input);
      created += 1;
    } catch (err) {
      logger.warn(err, "Failed to import a preset regex script");
    }
  }
  return created;
}

/**
 * Map an ST marker identifier to the correct MarkerConfig.
 * ST uses camelCase identifiers (e.g. "chatHistory", "charDescription") but the
 * marker expander expects specific types (e.g. "chat_history", "character").
 *
 * ST splits character info into separate Description / Personality / Scenario markers; we consolidate
 * them into a single marker. World Info Before / After stay separate when the file uses both
 * (`splitWorldInfo`), and fold into one combined lorebook marker otherwise.
 */
function mapSTMarkerConfig(identifier: string, splitWorldInfo = false): MarkerConfig | null {
  switch (identifier) {
    case "chatHistory":
      return { type: "chat_history" };
    case "charDescription":
    case "charPersonality":
    case "scenario":
    case "enhanceDefinitions":
      return { type: "character" };
    case "personaDescription":
      return { type: "persona" };
    case "worldInfoBefore":
      return { type: splitWorldInfo ? "world_info_before" : "lorebook" };
    case "worldInfoAfter":
      return { type: splitWorldInfo ? "world_info_after" : "lorebook" };
    case "dialogueExamples":
      return { type: "dialogue_examples" };
    default:
      // For unknown markers (main, nsfw, jailbreak, etc.), return null
      // so they're treated as regular content sections
      return null;
  }
}

/**
 * Detect variable toggle groups from ST's naming convention.
 * Patterns like "➊ Game Master", "➋ Roleplayer" with {{setvar::type::value}}
 */
function detectVariableGroups(prompts: STPromptEntry[]): PromptVariableGroup[] {
  const groups = new Map<string, PromptVariableGroup>();

  // Look for setvar patterns in content
  for (const entry of prompts) {
    if (!entry.content) continue;
    for (const [varName, varValue] of extractSetvarAssignments(entry.content)) {
      if (!groups.has(varName)) {
        groups.set(varName, {
          name: varName,
          label: varName.charAt(0).toUpperCase() + varName.slice(1),
          options: [],
        });
      }
      const group = groups.get(varName)!;
      if (!group.options.find((o) => o.value === varValue)) {
        group.options.push({ label: entry.name.replace(/^[➊➋➌➍➎➏➐➑➀➁➂➃➄➅]\s*/, ""), value: varValue });
      }
    }
  }

  return Array.from(groups.values());
}

export function extractSetvarAssignments(content: string): Array<[name: string, value: string]> {
  const assignments: Array<[string, string]> = [];
  const prefix = "{{setvar::";
  const prefixPattern = /\{\{setvar::/gi;
  let cursor = 0;

  while (cursor < content.length) {
    prefixPattern.lastIndex = cursor;
    const match = prefixPattern.exec(content);
    if (!match) break;
    const start = match.index;
    const nameStart = start + prefix.length;
    prefixPattern.lastIndex = nameStart;
    const nestedStart = prefixPattern.exec(content)?.index ?? -1;
    const separator = content.indexOf("::", nameStart);
    if (nestedStart >= 0 && (separator < 0 || nestedStart < separator)) {
      cursor = nestedStart;
      continue;
    }
    if (separator < 0) break;
    const name = content.slice(nameStart, separator);
    if (!/^\w+$/u.test(name)) {
      cursor = start + prefix.length;
      continue;
    }
    const firstClose = content.indexOf("}", separator + 2);
    if (firstClose < 0) break;
    if (nestedStart >= 0 && nestedStart < firstClose) {
      cursor = nestedStart;
      continue;
    }

    if (firstClose > separator + 2 && content[firstClose + 1] === "}") {
      assignments.push([name, content.slice(separator + 2, firstClose)]);
      cursor = firstClose + 2;
    } else {
      cursor = firstClose + 1;
    }
  }

  return assignments;
}

/**
 * Detect bracket-paired XML wrappers (┌ open / └ close) and create groups.
 * Returns a map of promptIdentifier → groupId for sections inside the pair.
 */
async function detectAndCreateGroups(
  prompts: STPromptEntry[],
  presetId: string,
  storage: ReturnType<typeof createPromptsStorage>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const openStack: Array<{ name: string; startIdx: number }> = [];

  for (let i = 0; i < prompts.length; i++) {
    const entry = prompts[i]!;
    if (/^[┌┎⌈⌜]/.test(entry.name)) {
      const groupName = entry.name.replace(/^[┌┎⌈⌜]\s*/, "").trim();
      openStack.push({ name: groupName, startIdx: i });
    } else if (/^[└┖⌊⌞]/.test(entry.name) && openStack.length > 0) {
      const open = openStack.pop()!;
      // Create a group and assign all entries between open and close
      const group = await storage.createGroup({ presetId, name: open.name });
      if (group) {
        for (let j = open.startIdx + 1; j < i; j++) {
          const inner = prompts[j]!;
          map.set(inner.identifier, group.id);
        }
      }
    }
  }

  return map;
}

function guessPresetName(raw: Record<string, unknown>, fileName?: string): string {
  if (typeof raw.name === "string" && raw.name.trim()) return raw.name;
  // Try to find a Read-Me prompt with a name embedded in a comment
  const prompts = (raw.prompts ?? []) as STPromptEntry[];
  const readme = prompts.find((p) => p.name?.includes("Read-Me") || p.name?.includes("README"));
  if (readme?.content) {
    // Match {{// PresetName ... }} comment on first line
    const commentMatch = readme.content.match(/\{\{\/\/\s*([^(\n{]+)/);
    if (commentMatch) {
      const rawName = commentMatch[1]!.trimEnd();
      let nameEnd = rawName.length;
      while (nameEnd > 0 && (rawName[nameEnd - 1] === "," || rawName[nameEnd - 1] === "!")) nameEnd--;
      const name = rawName.slice(0, nameEnd).trim();
      if (name.length > 2) return name;
    }
    // Fallback: match "name:" or "title:" or "preset:" patterns
    const nameMatch = readme.content.match(/(?:name|title|preset)[:\s]+["']?([^"'\n]+)/i);
    if (nameMatch) return nameMatch[1]!.trim();
  }
  // Use the file-derived name if provided
  if (fileName) return fileName;
  return "SillyTavern Preset";
}
