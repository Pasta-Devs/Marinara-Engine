// ──────────────────────────────────────────────
// Prompt Macro Context Helpers
// ──────────────────────────────────────────────
// Shared helpers for routes that assemble prompts outside the preset
// assembler. Keeps card macros and depth prompts consistent everywhere.
// ──────────────────────────────────────────────

import {
  attachConditionalLineBreaks,
  CHARACTER_REFERENCE_ID_PATTERN,
  DEFERRED_RELOCATION_CONDITIONAL_TOKEN_RE,
  hasDeferredRelocationConditionals,
  parseDeferredConditionalPayload,
  selectConditionalPayloadBranch,
  CHAT_VARIABLE_STORED_NAME_RE,
  MAX_CHAT_VARIABLES,
  PERSONA_REFERENCE_ID_PATTERN,
  formatRpgStatsForPrompt,
  markReaderVersions,
  resolveMacros,
  scopeCharacterSummary,
  stripMacroComments,
  usesLorebookIncludes,
  type CharacterMacroProfile,
  type CharacterData,
  type LorebookIncludeSource,
  type MacroContext,
  type RPGStatsConfig,
  type ResolveMacroOptions,
  type WrapFormat,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { loadLorebookIncludes, processLorebooks, type LorebookScanResult } from "../lorebook/index.js";
import { createCharactersStorage, type PersonaStorageRow } from "../storage/characters.storage.js";
import { createLorebooksStorage } from "../storage/lorebooks.storage.js";
import { createChatsStorage, parseCharacterIds } from "../storage/chats.storage.js";
import { createGameStateStorage } from "../storage/game-state.storage.js";
import { wrapContent } from "./format-engine.js";
import { sanitizePromptLeaf } from "./prompt-escaping.js";
import { logger } from "../../lib/logger.js";

type PersonaFields = NonNullable<MacroContext["personaFields"]>;

export interface BuildPromptMacroContextInput {
  db: DB;
  characterIds: string[];
  /** Full active roster when characterIds is narrowed to one generation target. */
  groupCharacterIds?: string[];
  personaName: string;
  personaPhoneticName?: string;
  personaDescription?: string;
  personaFields?: PersonaFields;
  variables?: Record<string, string>;
  localVariables?: Record<string, string>;
  groupScenarioOverrideText?: string | null;
  lastInput?: string;
  chatId?: string;
  model?: string;
  reasoning?: string;
  lastGenerationType?: string;
  idleDuration?: string;
  timeZone?: string;
  /** The generation's selected snapshot; explicit null means there is no scene clock. */
  worldState?: MacroContext["worldState"];
  /** Extra prompt templates that may contain macros outside card/persona fields. */
  macroSources?: readonly string[];
  /**
   * Name the `{{<card ID>}}` macros found in these sources. For prompts the preset
   * assembler does not build: it names them itself, as it pulls their cards in (#6956).
   */
  nameCharacterReferences?: boolean;
}

export interface CharacterMacroData {
  names: string[];
  phoneticNames: string[];
  profiles: NonNullable<MacroContext["characterProfiles"]>;
  profilesById: Map<string, CharacterMacroProfile>;
  /** Cards that exist but cannot be read: they have no profile here, yet still reply. */
  unreadableIds: Set<string>;
  primaryFields?: NonNullable<MacroContext["characterFields"]>;
}

export type PromptMacroMessage = {
  id?: string | null;
  content: string;
  characterId?: string | null;
};

export type PromptMacroActivityMessage = {
  id?: string | null;
  role?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

export interface MacroResolutionTransaction {
  content: string;
  commit: () => void;
  rollback: () => void;
}

export const MAX_REFERENCED_CHARACTERS = 8;
export const MAX_REFERENCED_PERSONAS = 8;
const MAX_REFERENCED_FIELD_CHARS = 8_000;
const MAX_REFERENCED_LOREBOOK_CHARS = 8_000;

export function normalizeChatMacroVariables(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries: Array<[string, string]> = [];
  for (const [name, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!CHAT_VARIABLE_STORED_NAME_RE.test(name) || typeof entry !== "string") continue;
    entries.push([name, entry]);
    if (entries.length >= MAX_CHAT_VARIABLES) break;
  }
  return Object.fromEntries(entries);
}

/** Persist generation writes only while the saved value still matches its starting snapshot. */
export function mergeGeneratedChatMacroVariables(
  current: unknown,
  previous: Record<string, string>,
  generated: Record<string, string>,
): Record<string, string> {
  const merged = normalizeChatMacroVariables(current);
  for (const [name, value] of Object.entries(generated)) {
    const before = Object.hasOwn(previous, name) ? previous[name] : undefined;
    const saved = Object.hasOwn(merged, name) ? merged[name] : undefined;
    // A newer editor change (including removal/rename) wins over this request.
    if (value !== before && saved === before) {
      Object.defineProperty(merged, name, { value, enumerable: true, writable: true, configurable: true });
    }
  }
  // A regeneration starts by undoing its reply, which removes what that reply created.
  for (const [name, before] of Object.entries(previous)) {
    if (!Object.hasOwn(generated, name) && Object.hasOwn(merged, name) && merged[name] === before) delete merged[name];
  }
  return normalizeChatMacroVariables(merged);
}

/**
 * Names a preset defines through its stored variable values.
 *
 * Only the names matter to callers that need to know which names a preset owns
 * before the assembler has resolved their values.
 */
export function parsePresetVariableNames(rawVariableValues: unknown): string[] {
  if (typeof rawVariableValues !== "string" || !rawVariableValues.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(rawVariableValues);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    return Object.keys(parsed as Record<string, unknown>);
  } catch {
    return [];
  }
}

/**
 * Evaluate `{{#if}}` blocks that were deferred because a preset owned their
 * operand, now that the assembler has merged the real values in.
 *
 * Deferral keeps a conditional from being decided off the chat's value while the
 * preset's is still pending; this is the other half of it. Uses the same token
 * as the conversation relocation deferral, which never overlaps: preset
 * variables do not apply in Conversation mode. Mutates the messages in place.
 */
export function decodeDeferredPresetConditionals(messages: Array<{ content: string }>, macroCtx: MacroContext): void {
  for (const message of messages) {
    if (!hasDeferredRelocationConditionals(message.content)) continue;
    message.content = message.content.replace(DEFERRED_RELOCATION_CONDITIONAL_TOKEN_RE, (_match, encoded: string) => {
      const payload = parseDeferredConditionalPayload(encoded);
      if (!payload) {
        logger.error("[prompt] Malformed deferred preset conditional token; dropping block");
        return "";
      }
      const selected = selectConditionalPayloadBranch(payload, macroCtx, { trimResult: false });
      return resolveMacros(selected, macroCtx, { trimResult: false });
    });
  }
}

/** Clone mutable macro maps for preview-only resolution that must discard variable writes. */
export function cloneMacroContextForPreview(macroCtx: MacroContext): MacroContext {
  return {
    ...macroCtx,
    variables: { ...macroCtx.variables },
    localVariables: { ...macroCtx.localVariables },
  };
}

/** Apply counts discovered while scanning lorebook content before resolving its macros. */
export function setLorebookEntryCounts(
  macroCtx: MacroContext,
  counts: Readonly<Record<string, number>> | undefined,
): void {
  macroCtx.lorebookEntryCounts = counts ? { ...counts } : {};
}

/** Resolve macros while discarding variable writes made by preview and scan-only paths. */
export function resolveMacrosForPreview(
  template: string,
  macroCtx: MacroContext,
  options?: ResolveMacroOptions,
): string {
  return resolveMacros(template, cloneMacroContextForPreview(macroCtx), options);
}

export function extractCharacterReferenceIds(sources: readonly string[], limit = MAX_REFERENCED_CHARACTERS): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    for (const match of source.matchAll(CHARACTER_REFERENCE_ID_PATTERN)) {
      const id = match[1]!;
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      if (ids.length >= limit) return ids;
    }
  }
  return ids;
}

export function extractPersonaReferenceIds(sources: readonly string[], excludeIds?: ReadonlySet<string>): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    for (const match of source.matchAll(PERSONA_REFERENCE_ID_PATTERN)) {
      const id = match[1]!;
      if (seen.has(id)) continue;
      seen.add(id);
      if (excludeIds?.has(id)) continue;
      ids.push(id);
      if (ids.length >= MAX_REFERENCED_PERSONAS) return ids;
    }
  }
  return ids;
}

function referencedCharacterSourceFields(data: CharacterData): string[] {
  const depthPrompt = data.extensions?.depth_prompt?.prompt;
  const convoBehavior = data.extensions?.convoBehavior?.instruction;
  return [
    data.description,
    data.personality,
    data.scenario,
    data.creator_notes,
    data.system_prompt,
    data.post_history_instructions,
    data.extensions?.backstory,
    data.extensions?.appearance,
    depthPrompt,
    data.extensions?.aboutMe,
    convoBehavior,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
}

function referencedCharacterProfile(data: CharacterData): CharacterMacroProfile {
  return {
    name: data.name || "Character",
    phoneticName: data.extensions?.phoneticName ?? "",
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

function clipReferencedText(value: string, limit: number): string {
  return value.length <= limit ? value : value.slice(0, limit);
}

function referencedLorebookBlock(lorebookScan: LorebookScanResult | null, wrapFormat: WrapFormat): string[] {
  const content = clipReferencedText(
    (lorebookScan?.activatedEntries ?? [])
      .map((entry) => entry.content.trim())
      .filter(Boolean)
      .join("\n\n"),
    MAX_REFERENCED_LOREBOOK_CHARS,
  );
  return content
    ? [wrapContent(sanitizePromptLeaf(content, wrapFormat), "attached_lorebook_context", wrapFormat, 2)]
    : [];
}

function resolveReferencedField(value: string, macroCtx: MacroContext, wrapFormat: WrapFormat): string {
  const resolved = resolveMacrosForPreview(
    clipReferencedText(stripMacroComments(value), MAX_REFERENCED_FIELD_CHARS),
    macroCtx,
    { trimResult: false },
  ).trim();
  return resolved ? sanitizePromptLeaf(resolved, wrapFormat) : "";
}

function buildReferencedCharacterFields(
  id: string,
  data: CharacterData,
  macroCtx: MacroContext,
  wrapFormat: WrapFormat,
  lorebookScan: LorebookScanResult | null,
): string {
  const scopedContext = scopePromptMacroContextToCharacter(macroCtx, referencedCharacterProfile(data));
  const stats = formatRpgStatsForPrompt(data.extensions?.rpgStats as RPGStatsConfig | undefined);
  const trackerDefaults = Array.isArray(data.extensions?.trackerCustomFieldDefaults)
    ? data.extensions.trackerCustomFieldDefaults
        .filter((field) => field?.name?.trim() && field?.value?.trim())
        .map((field) => `${field.name}: ${field.value}`)
        .join("\n")
    : "";
  const convoBehavior = data.extensions?.convoBehavior?.instruction ?? "";
  const fields = [
    { label: "character_id", value: id },
    { label: "name", value: data.name },
    { label: "description", value: data.description },
    { label: "personality", value: data.personality },
    { label: "backstory", value: data.extensions?.backstory },
    { label: "appearance", value: data.extensions?.appearance },
    { label: "scenario", value: data.scenario },
    { label: "example_dialogue", value: data.mes_example },
    { label: "creator", value: data.creator },
    { label: "character_version", value: data.character_version },
    { label: "creator_notes", value: data.creator_notes },
    { label: "system_prompt", value: data.system_prompt },
    { label: "post_history_instructions", value: data.post_history_instructions },
    { label: "depth_prompt", value: data.extensions?.depth_prompt?.prompt },
    { label: "about_me", value: data.extensions?.aboutMe },
    { label: "conversation_behavior", value: convoBehavior },
    { label: "tags", value: data.tags?.join(", ") },
    { label: "rpg_attributes", value: stats },
    { label: "tracker_defaults", value: trackerDefaults },
  ].flatMap(({ label, value }) => {
    if (typeof value !== "string" || !value.trim()) return [];
    const content = resolveReferencedField(value, scopedContext, wrapFormat);
    return content ? [wrapContent(content, label, wrapFormat, 2)] : [];
  });

  fields.push(...referencedLorebookBlock(lorebookScan, wrapFormat));

  return wrapContent(fields.join("\n"), "referenced_character", wrapFormat, 1);
}

function referencedPersonaMacroContext(macroCtx: MacroContext, persona: PersonaStorageRow): MacroContext {
  return {
    ...macroCtx,
    user: persona.name || "User",
    userPhonetic: persona.phoneticName || persona.name || "User",
    personaFields: {
      phoneticName: persona.phoneticName ?? "",
      description: persona.description ?? "",
      personality: persona.personality ?? "",
      backstory: persona.backstory ?? "",
      appearance: persona.appearance ?? "",
      scenario: persona.scenario ?? "",
      example: persona.mes_example ?? "",
    },
  };
}

function buildReferencedPersonaFields(
  id: string,
  persona: PersonaStorageRow,
  macroCtx: MacroContext,
  wrapFormat: WrapFormat,
  lorebookScan: LorebookScanResult | null,
): string {
  const scopedContext = referencedPersonaMacroContext(macroCtx, persona);
  const fields = [
    { label: "persona_id", value: id },
    { label: "name", value: persona.name },
    { label: "description", value: persona.description },
    { label: "personality", value: persona.personality },
    { label: "backstory", value: persona.backstory },
    { label: "appearance", value: persona.appearance },
    { label: "scenario", value: persona.scenario },
    { label: "example_dialogue", value: persona.mes_example },
    { label: "creator", value: persona.creator },
    { label: "persona_version", value: persona.personaVersion },
    { label: "creator_notes", value: persona.creatorNotes },
    { label: "about_me", value: persona.aboutMe },
  ].flatMap(({ label, value }) => {
    if (typeof value !== "string" || !value.trim()) return [];
    const content = resolveReferencedField(value, scopedContext, wrapFormat);
    return content ? [wrapContent(content, label, wrapFormat, 2)] : [];
  });

  fields.push(...referencedLorebookBlock(lorebookScan, wrapFormat));

  return wrapContent(fields.join("\n"), "referenced_persona", wrapFormat, 1);
}

export async function buildReferencedPersonaContext(input: {
  db: DB;
  activePersonaId?: string | null;
  sources: readonly string[];
  chatMessages: Array<{ role: string; content: string }>;
  macroCtx: MacroContext;
  wrapFormat: WrapFormat;
  chatId: string;
  gameState?: Record<string, unknown> | null;
  generationTriggers?: string[];
  includeLorebooks?: boolean;
  excludedLorebookIds?: string[];
  excludedLorebookSourceAgentIds?: string[];
  knownPersonaIds?: string[];
  maxReferences?: number;
}): Promise<{ content: string; references: Record<string, string> }> {
  const characters = createCharactersStorage(input.db);
  const sources = [...input.sources, ...input.chatMessages.map((message) => message.content)];

  const knownPersonaIds = new Set(input.knownPersonaIds ?? []);
  const candidateIds = extractPersonaReferenceIds(sources, knownPersonaIds).slice(
    0,
    Math.max(0, input.maxReferences ?? MAX_REFERENCED_PERSONAS),
  );
  const referencedIds = candidateIds.filter((id) => id !== input.activePersonaId);
  const referencedRows = await Promise.all(referencedIds.map((id) => characters.getPersona(id, input.chatId)));
  const referenced = referencedIds.flatMap((id, index) => {
    const persona = referencedRows[index];
    return persona ? [{ id, persona }] : [];
  });
  const references = Object.fromEntries([
    ...(input.activePersonaId && candidateIds.includes(input.activePersonaId)
      ? [[input.activePersonaId, input.macroCtx.user] as const]
      : []),
    ...referenced.map(({ id, persona }) => [id, persona.name || "User"] as const),
  ]);
  if (referenced.length === 0) return { content: "", references };

  const macroCtx = {
    ...input.macroCtx,
    personaReferences: {
      ...(input.macroCtx.personaReferences ?? {}),
      ...references,
    },
  };
  const lorebooks = createLorebooksStorage(input.db);
  if (referenced.some(({ persona }) => /\{\{\s*lorebooksize::/iu.test(JSON.stringify(persona) ?? ""))) {
    try {
      setLorebookEntryCounts(macroCtx, await lorebooks.countAllEntriesByLorebook());
    } catch (err) {
      logger.warn(err, "Failed to load lorebook entry counts for referenced personas; using empty counts");
      setLorebookEntryCounts(macroCtx, undefined);
    }
  }
  const allLorebooks = (await lorebooks.list()) as unknown as Array<{
    id: string;
    personaId?: string | null;
    personaIds?: string[];
  }>;
  const excludedByRequest = new Set(input.excludedLorebookIds ?? []);
  const scanMessages = input.chatMessages.map((message) => ({
    ...message,
    content: resolveMacrosForPreview(message.content, macroCtx, { trimResult: false }),
  }));
  const blocks: string[] = [];

  for (const { id, persona } of referenced) {
    const attachedIds = new Set(
      allLorebooks.filter((book) => book.personaId === id || book.personaIds?.includes(id)).map((book) => book.id),
    );
    const excludedLorebookIds = allLorebooks
      .filter((book) => !attachedIds.has(book.id) || excludedByRequest.has(book.id))
      .map((book) => book.id);
    const scopedContext = referencedPersonaMacroContext(macroCtx, persona);
    const lorebookScan =
      input.includeLorebooks !== false && attachedIds.size > 0
        ? await processLorebooks(input.db, scanMessages, input.gameState, {
            chatId: input.chatId,
            characterIds: [],
            personaId: id,
            activeLorebookIds: [],
            excludedLorebookIds,
            excludedSourceAgentIds: input.excludedLorebookSourceAgentIds,
            previewOnly: true,
            generationTriggers: input.generationTriggers,
            resolveContent: (value, lorebookEntryCounts) => {
              setLorebookEntryCounts(scopedContext, lorebookEntryCounts);
              return resolveMacrosForPreview(value, scopedContext);
            },
          })
        : null;
    blocks.push(buildReferencedPersonaFields(id, persona, macroCtx, input.wrapFormat, lorebookScan));
  }

  return {
    content: wrapContent(blocks.join("\n"), "referenced_personas", input.wrapFormat),
    references,
  };
}

export async function buildReferencedCharacterContext(input: {
  db: DB;
  activeCharacterIds: string[];
  sources: readonly string[];
  chatMessages: Array<{ role: string; content: string }>;
  macroCtx: MacroContext;
  wrapFormat: WrapFormat;
  chatId: string;
  gameState?: Record<string, unknown> | null;
  generationTriggers?: string[];
  includeLorebooks?: boolean;
  excludedLorebookIds?: string[];
  excludedLorebookSourceAgentIds?: string[];
  maxReferences?: number;
  /** Only the names: no card text and no lorebook scan. */
  namesOnly?: boolean;
}): Promise<{ content: string; references: Record<string, string> }> {
  const characters = createCharactersStorage(input.db);
  const activeIds = new Set(input.activeCharacterIds);
  const sources = [...input.sources, ...input.chatMessages.map((message) => message.content)];

  const activeNames = new Map<string, string>();
  const activeRows = await Promise.all([...activeIds].map((id) => characters.getById(id, input.chatId)));
  [...activeIds].forEach((id, index) => {
    const data = parseCharacterData(activeRows[index]?.data);
    if (!data) return;
    activeNames.set(id, data.name || "Character");
    sources.push(...referencedCharacterSourceFields(data));
  });

  // Every referenced ID gets a name in every mode; the cap only limits which cards are added (#6956).
  const mentionedIds = extractCharacterReferenceIds(sources, Infinity);
  const outsideIds = mentionedIds.filter((id) => !activeIds.has(id));
  const outsideRows = await Promise.all(outsideIds.map((id) => characters.getById(id, input.chatId)));
  const outside = outsideIds.flatMap((id, index) => {
    const data = parseCharacterData(outsideRows[index]?.data);
    return data ? [{ id, data }] : [];
  });
  const cardLimit = input.namesOnly ? 0 : Math.max(0, input.maxReferences ?? MAX_REFERENCED_CHARACTERS);
  const referenced = outside.slice(0, cardLimit);
  // A character already in the chat still resolves to its name; its card is
  // already in the prompt, so it gets no second copy below (#6924).
  const references = Object.fromEntries([
    ...mentionedIds.flatMap((id) => (activeNames.has(id) ? [[id, activeNames.get(id)!] as const] : [])),
    ...outside.map(({ id, data }) => [id, data.name || "Character"] as const),
  ]);
  if (referenced.length === 0 || input.namesOnly) return { content: "", references };

  const macroCtx = { ...input.macroCtx, characterReferences: { ...Object.fromEntries(activeNames), ...references } };
  const lorebooks = createLorebooksStorage(input.db);
  if (referenced.some(({ data }) => /\{\{\s*lorebooksize::/iu.test(JSON.stringify(data) ?? ""))) {
    try {
      setLorebookEntryCounts(macroCtx, await lorebooks.countAllEntriesByLorebook());
    } catch (err) {
      logger.warn(err, "Failed to load lorebook entry counts for referenced characters; using empty counts");
      setLorebookEntryCounts(macroCtx, undefined);
    }
  }
  const allLorebooks = (await lorebooks.list()) as unknown as Array<{
    id: string;
    characterId?: string | null;
    characterIds?: string[];
  }>;
  const excludedByRequest = new Set(input.excludedLorebookIds ?? []);
  const scanMessages = input.chatMessages.map((message) => ({
    ...message,
    content: resolveMacrosForPreview(message.content, macroCtx, { trimResult: false }),
  }));
  const blocks: string[] = [];

  for (const { id, data } of referenced) {
    const attachedIds = new Set(
      allLorebooks.filter((book) => book.characterId === id || book.characterIds?.includes(id)).map((book) => book.id),
    );
    const excludedLorebookIds = allLorebooks
      .filter((book) => !attachedIds.has(book.id) || excludedByRequest.has(book.id))
      .map((book) => book.id);
    const scopedContext = scopePromptMacroContextToCharacter(macroCtx, referencedCharacterProfile(data));
    const lorebookScan =
      input.includeLorebooks !== false && attachedIds.size > 0
        ? await processLorebooks(input.db, scanMessages, input.gameState, {
            chatId: input.chatId,
            characterIds: [id],
            activeLorebookIds: [],
            excludedLorebookIds,
            excludedSourceAgentIds: input.excludedLorebookSourceAgentIds,
            previewOnly: true,
            generationTriggers: input.generationTriggers,
            resolveContent: (value, lorebookEntryCounts) => {
              setLorebookEntryCounts(scopedContext, lorebookEntryCounts);
              return resolveMacrosForPreview(value, scopedContext);
            },
          })
        : null;
    blocks.push(buildReferencedCharacterFields(id, data, macroCtx, input.wrapFormat, lorebookScan));
  }

  return {
    content: wrapContent(blocks.join("\n"), "referenced_characters", input.wrapFormat),
    references,
  };
}

export function resolveMacrosWithVariableSnapshot(
  template: string,
  macroCtx: MacroContext,
  options?: ResolveMacroOptions,
): MacroResolutionTransaction {
  const before = { ...macroCtx.variables };
  const localBefore = { ...macroCtx.localVariables };
  const content = resolveMacros(template, macroCtx, options);
  let settled = false;

  const rollback = () => {
    if (settled) return;
    macroCtx.variables = before;
    const localVariables = (macroCtx.localVariables ??= {});
    for (const key of Object.keys(localVariables)) delete localVariables[key];
    Object.assign(localVariables, localBefore);
    settled = true;
  };

  const commit = () => {
    settled = true;
  };

  return { content, commit, rollback };
}

function timestampToMillis(value: string | Date | null | undefined): number | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function formatDurationPart(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

export function formatPromptIdleDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (totalSeconds < 60) return formatDurationPart(totalSeconds, "second");

  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return formatDurationPart(totalMinutes, "minute");

  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (totalHours < 24) {
    return minutes > 0
      ? `${formatDurationPart(totalHours, "hour")} ${formatDurationPart(minutes, "minute")}`
      : formatDurationPart(totalHours, "hour");
  }

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours > 0
    ? `${formatDurationPart(days, "day")} ${formatDurationPart(hours, "hour")}`
    : formatDurationPart(days, "day");
}

export function resolvePromptIdleDuration(
  messages: readonly PromptMacroActivityMessage[],
  options: { excludeMessageId?: string | null; now?: Date } = {},
): string {
  const excludeMessageId = options.excludeMessageId?.trim() || null;
  let latestTimestamp: number | null = null;

  for (const message of messages) {
    if (excludeMessageId && message.id === excludeMessageId) continue;
    const createdAt = timestampToMillis(message.createdAt);
    const updatedAt = timestampToMillis(message.updatedAt);
    const timestamp =
      createdAt !== null && updatedAt !== null ? Math.max(createdAt, updatedAt) : (createdAt ?? updatedAt);
    if (timestamp === null) continue;
    if (latestTimestamp === null || timestamp > latestTimestamp) latestTimestamp = timestamp;
  }

  if (latestTimestamp === null) return formatPromptIdleDuration(0);
  return formatPromptIdleDuration((options.now ?? new Date()).getTime() - latestTimestamp);
}

export function resolvePromptLastGenerationType(input: {
  autonomous?: unknown;
  attachments?: unknown;
  generationGuide?: unknown;
  generationGuideSource?: unknown;
  impersonate?: unknown;
  regenerateMessageId?: unknown;
  turnGameBots?: unknown;
  userMessage?: unknown;
}): string {
  if (input.impersonate === true) return "impersonate";
  if (typeof input.regenerateMessageId === "string" && input.regenerateMessageId.trim()) return "regenerate";
  if (input.turnGameBots === true) return "turn_game";
  if (input.autonomous === true) return "autonomous";
  if (typeof input.generationGuide === "string" && input.generationGuide.trim()) {
    const source =
      typeof input.generationGuideSource === "string" && input.generationGuideSource.trim()
        ? input.generationGuideSource.trim()
        : "guided";
    return source === "narrator" ? "guided" : source;
  }

  const hasUserMessage = typeof input.userMessage === "string" && input.userMessage.trim().length > 0;
  const hasAttachments = Array.isArray(input.attachments) && input.attachments.length > 0;
  return hasUserMessage || hasAttachments ? "normal" : "continue";
}

export type PromptDepthEntry = {
  content: string;
  role: "system" | "user" | "assistant";
  depth: number;
};

function parseCharacterData(raw: unknown): CharacterData | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as CharacterData;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as CharacterData;
  return null;
}

export async function resolveCharacterMacroData(
  db: DB,
  characterIds: string[],
  chatId?: string,
): Promise<CharacterMacroData> {
  if (characterIds.length === 0)
    return { names: [], phoneticNames: [], profiles: [], profilesById: new Map(), unreadableIds: new Set() };

  const chars = createCharactersStorage(db);
  const names: string[] = [];
  const phoneticNames: string[] = [];
  const profiles: CharacterMacroData["profiles"] = [];
  const profilesById = new Map<string, CharacterMacroProfile>();
  const unreadableIds = new Set<string>();
  let primaryFields: CharacterMacroData["primaryFields"] | undefined;

  for (const id of characterIds) {
    const row = await chars.getById(id, chatId);
    const data = parseCharacterData(row?.data);
    if (!data) {
      if (row) unreadableIds.add(id);
      continue;
    }

    if (data.name) names.push(data.name);
    const phoneticName =
      typeof data.extensions?.phoneticName === "string" && data.extensions.phoneticName.trim()
        ? data.extensions.phoneticName.trim()
        : "";
    phoneticNames.push(phoneticName || data.name || "Character");

    const description = data.description ?? "";
    const profile = {
      name: data.name ?? "Character",
      phoneticName,
      description,
      personality: data.personality ?? "",
      backstory: data.extensions?.backstory ?? "",
      appearance: data.extensions?.appearance ?? "",
      scenario: data.scenario ?? "",
      example: data.mes_example ?? "",
      systemPrompt: data.system_prompt ?? "",
      postHistoryInstructions: data.post_history_instructions ?? "",
    };

    profiles.push(profile);
    profilesById.set(id, profile);

    if (!primaryFields) {
      primaryFields = {
        phoneticName: profile.phoneticName,
        description: profile.description,
        personality: profile.personality,
        backstory: profile.backstory,
        appearance: profile.appearance,
        scenario: profile.scenario,
        example: profile.example,
        systemPrompt: profile.systemPrompt,
        postHistoryInstructions: profile.postHistoryInstructions,
      };
    }
  }

  return { names, phoneticNames, profiles, profilesById, unreadableIds, primaryFields };
}

/** What `{{include::...}}` reads (#6912), loaded only when one of `sources` uses it. */
export async function loadLorebookIncludesFor(
  db: DB,
  chatId: string | undefined,
  sources: readonly string[],
): Promise<LorebookIncludeSource | undefined> {
  if (!sources.some(usesLorebookIncludes)) return undefined;
  try {
    return await loadLorebookIncludes(db, chatId);
  } catch (err) {
    logger.warn(err, "Failed to load lorebooks for include macros; leaving them as written");
    return undefined;
  }
}

export async function buildPromptMacroContext(input: BuildPromptMacroContextInput): Promise<MacroContext> {
  const characterMacroData = await resolveCharacterMacroData(input.db, input.characterIds, input.chatId);
  const groupCharacterMacroData = input.groupCharacterIds
    ? await resolveCharacterMacroData(input.db, input.groupCharacterIds, input.chatId)
    : characterMacroData;
  const chat = input.chatId && input.db ? await createChatsStorage(input.db).getById(input.chatId) : null;
  // Only the names cross into the full roster: inactive profiles must not enter
  // grouped card expansion, reference discovery, or lorebook macro sources.
  // Game callers supply the party scope, including legacy sessions whose chat row was not mirrored.
  const rosterIds =
    chat?.mode === "game"
      ? (input.groupCharacterIds ?? input.characterIds)
      : chat?.characterIds !== undefined
        ? parseCharacterIds(chat.characterIds)
        : input.characterIds;
  const rosterNames =
    rosterIds.length === input.characterIds.length && rosterIds.every((id, index) => id === input.characterIds[index])
      ? characterMacroData.names
      : (await resolveCharacterMacroData(input.db, rosterIds, input.chatId)).names;
  const variables = input.variables ?? {};

  let lorebookEntryCounts: Record<string, number> = {};
  const macroSources = [
    ...(input.macroSources ?? []),
    ...Object.values(variables),
    ...Object.values(input.personaFields ?? {}),
    ...characterMacroData.profiles.flatMap((profile) => Object.values(profile)),
    ...groupCharacterMacroData.profiles.flatMap((profile) => Object.values(profile)),
    input.personaDescription ?? "",
    input.groupScenarioOverrideText ?? "",
    input.lastInput ?? "",
  ];
  if (macroSources.some((source) => /\{\{\s*lorebooksize::/iu.test(source))) {
    try {
      lorebookEntryCounts = await createLorebooksStorage(input.db).countAllEntriesByLorebook();
    } catch (err) {
      logger.warn(err, "Failed to load lorebook entry counts; using empty counts");
      // If the count fails, continue with empty counts — {{lorebooksize::ID}} resolves to 0.
    }
  }
  const lorebookIncludes = await loadLorebookIncludesFor(input.db, input.chatId, macroSources);

  const macroCtx: MacroContext = {
    user: input.personaName || "User",
    userPhonetic: input.personaPhoneticName || input.personaFields?.phoneticName || input.personaName || "User",
    char: characterMacroData.names[0] || "Character",
    charPhonetic: characterMacroData.phoneticNames[0] || characterMacroData.names[0] || "Character",
    characters: rosterNames,
    groupCharacters: groupCharacterMacroData.names,
    characterProfiles: characterMacroData.profiles,
    variables,
    localVariables: input.localVariables,
    lastInput: input.lastInput,
    chatId: input.chatId,
    model: input.model,
    reasoning: input.reasoning,
    lastGenerationType: input.lastGenerationType,
    idleDuration: input.idleDuration,
    timeZone: input.timeZone,
    worldState:
      input.worldState !== undefined
        ? input.worldState
        : input.chatId && input.db
          ? await createGameStateStorage(input.db).getForGeneration(input.chatId)
          : null,
    lorebookEntryCounts,
    ...(lorebookIncludes ? { lorebookIncludes } : {}),
    characterFields: {
      ...(characterMacroData.primaryFields ?? {}),
      ...(input.groupScenarioOverrideText ? { scenario: input.groupScenarioOverrideText } : {}),
    },
    personaFields: {
      description: input.personaDescription ?? "",
      ...(input.personaFields ?? {}),
    },
  };
  if (input.nameCharacterReferences) {
    macroCtx.characterReferences = (
      await buildReferencedCharacterContext({
        db: input.db,
        activeCharacterIds: input.groupCharacterIds ?? input.characterIds,
        sources: macroSources,
        chatMessages: [],
        macroCtx,
        wrapFormat: "none",
        chatId: input.chatId ?? "",
        namesOnly: true,
      })
    ).references;
  }
  return macroCtx;
}

function characterFieldsFromProfile(profile: CharacterMacroProfile): NonNullable<MacroContext["characterFields"]> {
  return {
    phoneticName: profile.phoneticName ?? "",
    description: profile.description ?? "",
    personality: profile.personality ?? "",
    backstory: profile.backstory ?? "",
    appearance: profile.appearance ?? "",
    scenario: profile.scenario ?? "",
    example: profile.example ?? "",
    systemPrompt: profile.systemPrompt ?? "",
    postHistoryInstructions: profile.postHistoryInstructions ?? "",
  };
}

/**
 * Scope otherwise shared prompt macros to the character whose provider request
 * is about to run. This is used by the final prompt pass so late injections
 * resolve {{char}} and card-field macros against the actual responder.
 */
export function scopePromptMacroContextToCharacter(
  macroCtx: MacroContext,
  profile: CharacterMacroProfile,
): MacroContext {
  return {
    ...macroCtx,
    char: profile.name,
    charPhonetic: profile.phoneticName || profile.name,
    characterFields: characterFieldsFromProfile(profile),
  };
}

/**
 * Resolve the Chat Summary. A merged group reply may voice any of `readers` (#7252), so a section that
 * depends on the character is resolved for each reader who gets it and marked with who knows it, as
 * Advanced Memory does. Text outside every condition resolves once, as before, `{{char}}` included.
 * Sections no reader gets, such as narrator-only ones, are left out.
 */
export function resolveChatSummaryMacros(
  summary: string,
  macroCtx: MacroContext,
  options?: ResolveMacroOptions,
  readers?: readonly CharacterMacroProfile[],
): string {
  // A section for someone who is not replying leaves no empty line: its line breaks go with it.
  summary = attachConditionalLineBreaks(summary);
  // ponytail: splitting a group block (`[` … `]`) at a condition would undo its per-character repeat, so a
  // summary with one keeps the single reading. Expand group blocks before scoping if that ever matters.
  if (!readers?.length || /^[ \t]*\[[ \t]*\r?$/mu.test(summary)) return resolveMacros(summary, macroCtx, options);
  const profiles = new Map(readers.map((profile) => [profile.name, profile]));
  const partOptions = { ...options, trimResult: false };
  // A top-level part with a condition is one scoping kept whole, such as a name mixed with a variable.
  const resolved = scopeCharacterSummary(summary, [...profiles.keys()], 0, (part, known, depth) =>
    depth === 0 && !/\{\{\s*#if\b/iu.test(part)
      ? resolveMacros(part, macroCtx, partOptions)
      : markReaderVersions(known, profiles.size, (name) =>
          resolveMacros(part, scopePromptMacroContextToCharacter(macroCtx, profiles.get(name)!), partOptions),
        ),
  );
  return options?.trimResult === false ? resolved : resolved.trim();
}

function macroContextForMessage(
  message: PromptMacroMessage,
  macroCtx: MacroContext,
  profilesById?: ReadonlyMap<string, CharacterMacroProfile>,
): MacroContext {
  const profile = message.characterId ? profilesById?.get(message.characterId) : undefined;
  if (!profile) return macroCtx;
  return scopePromptMacroContextToCharacter(macroCtx, profile);
}

export function resolvePromptMessageMacros<T extends PromptMacroMessage>(
  messages: T[],
  macroCtx: MacroContext,
  profilesById?: ReadonlyMap<string, CharacterMacroProfile>,
  options: ResolveMacroOptions = { trimResult: false },
): T[] {
  return messages.map((message) => {
    if (!message.content.includes("{{")) return message;

    const messageMacroCtx = macroContextForMessage(message, macroCtx, profilesById);
    const content = resolveMacros(
      message.content,
      {
        ...messageMacroCtx,
        variables: { ...messageMacroCtx.variables },
      },
      {
        trimResult: false,
        ...options,
        randomSeed: message.id ? `${message.id}:${message.content}` : options.randomSeed,
      },
    );
    return content === message.content ? message : { ...message, content };
  });
}

function normalizeDepthPrompt(
  value: unknown,
): { prompt: string; depth: number; role: PromptDepthEntry["role"] } | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const prompt = typeof raw.prompt === "string" ? raw.prompt.trim() : "";
  if (!prompt) return null;

  const rawDepth = Number(raw.depth ?? 4);
  const depth = Number.isFinite(rawDepth) ? Math.max(0, Math.floor(rawDepth)) : 4;
  const role = raw.role === "user" || raw.role === "assistant" || raw.role === "system" ? raw.role : "system";

  return { prompt, depth, role };
}

export async function collectCharacterDepthPromptEntries(
  db: DB,
  characterIds: string[],
  macroCtx: MacroContext,
): Promise<PromptDepthEntry[]> {
  if (characterIds.length === 0) return [];

  const chars = createCharactersStorage(db);
  const entries: PromptDepthEntry[] = [];

  for (const id of characterIds) {
    const row = await chars.getById(id, macroCtx.chatId);
    const data = parseCharacterData(row?.data);
    const depthPrompt = normalizeDepthPrompt(data?.extensions?.depth_prompt);
    if (!depthPrompt) continue;

    const content = resolveMacros(depthPrompt.prompt, {
      ...macroCtx,
      char: data?.name ?? macroCtx.char,
      charPhonetic: data?.extensions?.phoneticName ?? macroCtx.charPhonetic,
      characterFields: {
        phoneticName: data?.extensions?.phoneticName ?? "",
        description: data?.description ?? "",
        personality: data?.personality ?? "",
        backstory: data?.extensions?.backstory ?? "",
        appearance: data?.extensions?.appearance ?? "",
        scenario: data?.scenario ?? "",
        example: data?.mes_example ?? "",
        systemPrompt: data?.system_prompt ?? "",
        postHistoryInstructions: data?.post_history_instructions ?? "",
      },
    });

    if (content.trim()) {
      entries.push({ content, role: depthPrompt.role, depth: depthPrompt.depth });
    }
  }

  return entries;
}

export async function collectCharacterPostHistoryEntries(
  db: DB,
  characterIds: string[],
  macroCtx: MacroContext,
  wrapFormat: WrapFormat,
  onResolved?: (characterId: string, content: string) => void,
): Promise<PromptDepthEntry[]> {
  if (characterIds.length === 0) return [];

  const chars = createCharactersStorage(db);
  const entries: PromptDepthEntry[] = [];
  const multiCharacter = characterIds.length > 1;

  for (const id of characterIds) {
    const row = await chars.getById(id, macroCtx.chatId);
    const data = parseCharacterData(row?.data);
    const raw = stripMacroComments(data?.post_history_instructions ?? "").trim();
    if (!data || !raw) continue;

    const content = resolveMacros(raw, {
      ...macroCtx,
      char: data.name ?? macroCtx.char,
      charPhonetic: data.extensions?.phoneticName ?? macroCtx.charPhonetic,
      characterFields: {
        phoneticName: data.extensions?.phoneticName ?? "",
        description: data.description ?? "",
        personality: data.personality ?? "",
        backstory: data.extensions?.backstory ?? "",
        appearance: data.extensions?.appearance ?? "",
        scenario: data.scenario ?? "",
        example: data.mes_example ?? "",
        systemPrompt: data.system_prompt ?? "",
        postHistoryInstructions: data.post_history_instructions ?? "",
      },
    }).trim();

    onResolved?.(id, content);
    if (content) {
      const label = multiCharacter
        ? `${data.name ?? "Character"} post-history instructions`
        : "post-history instructions";
      entries.push({
        content: wrapContent(sanitizePromptLeaf(content, wrapFormat), label, wrapFormat),
        role: "user",
        depth: 0,
      });
    }
  }

  return entries;
}

export async function collectCharacterAdvancedPromptEntries(
  db: DB,
  characterIds: string[],
  macroCtx: MacroContext,
  wrapFormat: WrapFormat,
  onPostHistoryResolved?: (characterId: string, content: string) => void,
): Promise<PromptDepthEntry[]> {
  const [depthEntries, postHistoryEntries] = await Promise.all([
    collectCharacterDepthPromptEntries(db, characterIds, macroCtx),
    collectCharacterPostHistoryEntries(db, characterIds, macroCtx, wrapFormat, onPostHistoryResolved),
  ]);
  return [...depthEntries, ...postHistoryEntries];
}

export function resolveCharacterAdvancedPromptIds(
  characterIds: string[],
  chatMode: string,
  chatMetadata: Record<string, unknown>,
): string[] {
  const resolved = new Set(characterIds.filter((id) => id && !id.startsWith("npc:")));
  if (chatMode !== "game") return [...resolved];

  const partyIds = Array.isArray(chatMetadata.gamePartyCharacterIds) ? chatMetadata.gamePartyCharacterIds : [];
  for (const id of partyIds) {
    if (typeof id === "string" && id && !id.startsWith("npc:")) resolved.add(id);
  }
  const gmCharacterId = chatMetadata.gameGmCharacterId;
  if (typeof gmCharacterId === "string" && gmCharacterId) resolved.add(gmCharacterId);
  return [...resolved];
}
