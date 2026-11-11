// ──────────────────────────────────────────────
// Importer: SillyTavern Prompt Preset
// ──────────────────────────────────────────────
import type { DB } from "../../db/connection.js";
import type { MarkerConfig } from "@marinara-engine/shared";
import { createPromptsStorage } from "../storage/prompts.storage.js";
import type { PromptVariableGroup } from "@marinara-engine/shared";
import { withImportTags, type ImportTagOptions } from "@marinara-engine/shared";
import type { TimestampOverrides } from "./import-timestamps.js";
import { createRegexScriptsStorage } from "../storage/regex-scripts.storage.js";
import { convertStRegexScripts } from "./st-character.importer.js";
import { logger } from "../../lib/logger.js";

/** Friendly display names for consolidated markers. */
const MARKER_DISPLAY_NAMES: Partial<Record<string, string>> = {
  character: "Character Info",
  lorebook: "World Info",
  persona: "Persona",
  chat_history: "Chat History",
  dialogue_examples: "Chat Examples",
  chat_summary: "Chat Summary",
  agent_data: "Agent Data",
};
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

/**
 * Import a SillyTavern prompt preset JSON.
 * Parses the prompt array and variable toggle groups. Generation parameters
 * are connection/chat-owned settings and are intentionally ignored.
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

  // Create the preset
  const created = await storage.create(
    {
      // Its own name and no description: where it came from is a tag ("Imported", "ST").
      name: guessPresetName(raw, fileName),
      description: "",
      ...(options?.importTags ? { tags: withImportTags([], options.source ?? "st", options.importTags) } : {}),
      variableGroups,
      variableValues: {},
      parameters: {},
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

  // Track which consolidated marker types have already been emitted so we
  // don't create duplicates (e.g. worldInfoBefore + worldInfoAfter → one lorebook).
  const emittedMarkerTypes = new Set<string>();

  for (const entry of sortedPrompts) {
    // Skip bracket entries that are just XML open/close tags (now handled by groups)
    const isBracket = /^[┌└┎┖⌈⌊⌜⌞]/.test(entry.name);
    if (isBracket && !entry.content?.trim()) continue;

    // Map ST marker identifiers to our marker types
    const mappedMarkerConfig = entry.marker ? mapSTMarkerConfig(entry.identifier) : null;

    // Deduplicate consolidated markers — if we already emitted a marker of
    // this type, skip the duplicate (e.g. second world-info or character marker).
    if (mappedMarkerConfig) {
      const key = mappedMarkerConfig.type;
      if (emittedMarkerTypes.has(key)) continue;
      emittedMarkerTypes.add(key);
    }

    // Map ST role to our role
    let role: "system" | "user" | "assistant" = "system";
    if (entry.role === "user") role = "user";
    if (entry.role === "assistant") role = "assistant";

    // Determine injection position
    const entryOrderIndex = orderMap.get(entry.identifier)?.index ?? Number.MAX_SAFE_INTEGER;
    const isPostHistoryEntry =
      entryOrderIndex > chatHistoryIndex &&
      /(?:jailbreak|post[_-]?history|posthistory)/i.test(`${entry.identifier} ${entry.name}`);
    if (isPostHistoryEntry) role = "user";
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
  }

  // Explicitly set the section order and injection orders to match prompt_order.
  // This ensures correct ordering regardless of createSection append behavior.
  if (createdSectionIds.length > 0) {
    await storage.reorderSections(created.id, createdSectionIds);
  }

  const regexImported = await importPresetRegexScripts(raw, created.id, db);

  return {
    success: true,
    presetId: created.id,
    sectionsImported: sectionsCreated,
    variableGroups: variableGroups.length,
    regexImported,
  };
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
 * ST splits character info into separate Description / Personality / Scenario markers
 * and world info into Before / After — we consolidate each into a single marker.
 */
function mapSTMarkerConfig(identifier: string): MarkerConfig | null {
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
    case "worldInfoAfter":
      return { type: "lorebook" };
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
