import type { StorageGateway } from "../capabilities/storage";
import type { LorebookEntry, LorebookEntryTimingState, LorebookMatchingSource } from "../contracts/types/lorebook";
import { LIMITS } from "../contracts/constants/defaults";
import {
  applyTokenBudgetWithSkipped,
  processActivatedEntries,
  type BudgetSkippedActivatedEntry,
  type LorebookContentResolver,
} from "../generation-core/lorebooks/prompt-injector";
import {
  resolveGameLorebookScopeExclusions,
  type LorebookScopeExclusions,
} from "../generation-core/lorebooks/game-lorebook-scope";
import {
  lorebookAppliesToContext as lorebookAppliesToActiveScopeContext,
  resolveActiveLorebookScopeReason,
  type ActiveLorebookScopeReason,
} from "../generation-core/lorebooks/active-lorebook-scope";
import {
  recursiveScan,
  scanForActivatedEntries,
  updateTimingStatesForScan,
  type ActivatedEntry,
  type EntryTimingState,
  type ScanMessage,
  type ScanOptions,
} from "../generation-core/lorebooks/keyword-scanner";
import {
  boolish,
  hiddenFromAi,
  isRecord,
  parseRecord,
  readNumber,
  readString,
  stringArray,
  type JsonRecord,
} from "./runtime-records";

export interface LorebookActivationCharacterContext {
  id: string;
  name: string;
  description: string;
  personality?: string;
  scenario?: string;
  tags: string[];
}

export interface LorebookActivationPersonaContext {
  name: string;
  description: string;
  personality?: string;
  backstory?: string;
  appearance?: string;
  scenario?: string;
  tags: string[];
}

export interface BudgetSkippedLorebookEntry {
  id: string;
  name: string;
  lorebookId: string;
  lorebookName: string;
  matchedKeys: string[];
  estimatedTokens: number;
  lorebookBudget: number;
  lorebookUsedTokens: number;
  chatBudget: number;
  chatUsedTokens: number;
  blockedBy: "lorebook" | "chat" | "both";
}

export interface LorebookSemanticScanStatus {
  state: "not_applicable" | "missing_embedding_source" | "empty_query" | "ready" | "unavailable" | "failed";
  vectorizedEntryCount: number;
}

interface LorebookEmbeddingSource {
  embed(texts: string[]): Promise<number[][] | null>;
}

interface LoadedLorebookBudgetSkippedEntry {
  activatedEntry: ActivatedEntry;
  lorebookName: string;
  lorebookBudget: number;
  lorebookUsedTokens: number;
  estimatedTokens: number;
}

interface ScannedLorebookEntries {
  activatedEntries: ActivatedEntry[];
  budgetSkippedEntries: LoadedLorebookBudgetSkippedEntry[];
  entriesForTiming: LorebookEntry[];
}

interface LoadedActivatedLore {
  activatedEntries: ActivatedEntry[];
  budgetSkippedEntries: LoadedLorebookBudgetSkippedEntry[];
  entriesForTiming: LorebookEntry[];
  previousTimingStates: Map<string, EntryTimingState>;
  lorebookNamesById: Map<string, string>;
  currentMessageIndex: number;
  activeLorebookReasons: ActiveLorebookScopeReason[];
  scopeExclusions: LorebookScopeExclusions;
  semanticStatus: LorebookSemanticScanStatus;
  previousEntryStateOverrides: Map<string, LorebookEntryStateOverride>;
}

export interface ActiveLorebookScannerInput {
  storage: StorageGateway;
  chat: JsonRecord;
  characters: LorebookActivationCharacterContext[];
  persona: LorebookActivationPersonaContext | null;
  storedMessages: JsonRecord[];
  request?: JsonRecord;
  latestUserInput?: string;
  generationTriggers?: string[];
  embeddingSource?: LorebookEmbeddingSource | null;
  ignoreTiming?: boolean;
  contentResolver?: LorebookContentResolver;
}

export interface ActiveLorebookScannerResult {
  activatedEntries: ActivatedEntry[];
  processedLore: ReturnType<typeof processActivatedEntries>;
  entriesForTiming: LorebookEntry[];
  previousTimingStates: Map<string, EntryTimingState>;
  nextTimingStates: Map<string, EntryTimingState>;
  lorebookTimingStates: Record<string, LorebookEntryTimingState> | null;
  lorebookEntryStateOverrides: Record<string, { ephemeral?: number | null; enabled?: boolean }> | null;
  budgetSkippedLorebookEntries: BudgetSkippedLorebookEntry[];
  lorebookNamesById: Map<string, string>;
  currentMessageIndex: number;
  activeLorebookReasons: ActiveLorebookScopeReason[];
  scopeExclusions: LorebookScopeExclusions;
  semanticStatus: LorebookSemanticScanStatus;
}

interface LorebookEntryStateOverride {
  ephemeral?: number | null;
  enabled?: boolean;
}

const MAX_LOREBOOK_RECURSION_DEPTH = 10;

function nonNegativeInteger(value: unknown, fallback = 0): number {
  return Math.max(0, Math.floor(readNumber(value, fallback)));
}

function stringRecord(value: unknown): Record<string, string> {
  const record = parseRecord(value);
  return Object.fromEntries(
    Object.entries(record)
      .filter((entry): entry is [string, string | number | boolean] =>
        ["string", "number", "boolean"].includes(typeof entry[1]),
      )
      .map(([key, entry]) => [key, String(entry)]),
  );
}

function normalizeRole(value: unknown): "system" | "user" | "assistant" {
  const role = readString(value, "system").toLowerCase();
  return role === "user" || role === "assistant" ? role : "system";
}

function normalizeLorebookEntry(entry: JsonRecord): LorebookEntry {
  return {
    id: readString(entry.id),
    lorebookId: readString(entry.lorebookId),
    name: readString(entry.name) || "Entry",
    content: readString(entry.content),
    description: readString(entry.description),
    keys: stringArray(entry.keys),
    secondaryKeys: stringArray(entry.secondaryKeys),
    selective: boolish(entry.selective, false),
    selectiveLogic: readString(entry.selectiveLogic, "and") as LorebookEntry["selectiveLogic"],
    constant: boolish(entry.constant, false),
    enabled: boolish(entry.enabled, true),
    position: readNumber(entry.position, 0),
    role: normalizeRole(entry.role) as LorebookEntry["role"],
    depth: readNumber(entry.depth, 0),
    order: readNumber(entry.order ?? entry.sortOrder, 0),
    probability: entry.probability == null ? null : readNumber(entry.probability, 100),
    useRegex: boolish(entry.useRegex, false),
    matchWholeWords: boolish(entry.matchWholeWords, false),
    caseSensitive: boolish(entry.caseSensitive, false),
    ephemeral: entry.ephemeral == null ? null : readNumber(entry.ephemeral, 0),
    group: readString(entry.group),
    groupWeight: entry.groupWeight == null ? null : readNumber(entry.groupWeight, 100),
    folderId: readString(entry.folderId) || null,
    locked: boolish(entry.locked, false),
    preventRecursion: boolish(entry.preventRecursion, false),
    tag: readString(entry.tag),
    relationships: stringRecord(entry.relationships),
    dynamicState: parseRecord(entry.dynamicState),
    scanDepth: entry.scanDepth == null ? null : readNumber(entry.scanDepth, 0),
    sticky: entry.sticky == null ? null : readNumber(entry.sticky, 0),
    cooldown: entry.cooldown == null ? null : readNumber(entry.cooldown, 0),
    delay: entry.delay == null ? null : readNumber(entry.delay, 0),
    activationConditions: Array.isArray(entry.activationConditions) ? entry.activationConditions : [],
    schedule: isRecord(entry.schedule) ? (entry.schedule as unknown as LorebookEntry["schedule"]) : null,
    excludeFromVectorization: boolish(entry.excludeFromVectorization, false),
    embedding: Array.isArray(entry.embedding)
      ? entry.embedding.filter((item): item is number => typeof item === "number")
      : null,
    additionalMatchingSources: stringArray(
      entry.additionalMatchingSources,
    ) as LorebookEntry["additionalMatchingSources"],
    characterFilterMode: readString(entry.characterFilterMode, "any") as LorebookEntry["characterFilterMode"],
    characterFilterIds: stringArray(entry.characterFilterIds),
    characterTagFilterMode: readString(entry.characterTagFilterMode, "any") as LorebookEntry["characterTagFilterMode"],
    characterTagFilters: stringArray(entry.characterTagFilters),
    generationTriggerFilterMode: readString(
      entry.generationTriggerFilterMode,
      "any",
    ) as LorebookEntry["generationTriggerFilterMode"],
    generationTriggerFilters: stringArray(entry.generationTriggerFilters),
    createdAt: readString(entry.createdAt),
    updatedAt: readString(entry.updatedAt),
  };
}

export function lorebookAppliesToContext(
  lorebook: JsonRecord,
  chat: JsonRecord,
  characters: LorebookActivationCharacterContext[],
  persona: LorebookActivationPersonaContext | null,
): boolean {
  return lorebookAppliesToActiveScopeContext(lorebook, { chat, characters, persona });
}

function joinMatchingSourceParts(parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
}

function buildAdditionalMatchingSourceText(
  characters: LorebookActivationCharacterContext[],
  persona: LorebookActivationPersonaContext | null,
): Partial<Record<LorebookMatchingSource, string>> {
  return {
    character_name: joinMatchingSourceParts(characters.map((character) => character.name)),
    character_description: joinMatchingSourceParts(characters.map((character) => character.description)),
    character_personality: joinMatchingSourceParts(characters.map((character) => character.personality)),
    character_scenario: joinMatchingSourceParts(characters.map((character) => character.scenario)),
    character_tags: joinMatchingSourceParts(characters.flatMap((character) => character.tags)),
    persona_description: persona?.description ?? "",
    persona_tags: joinMatchingSourceParts(persona?.tags ?? []),
  };
}

function resolveLorebookTokenBudget(chat: JsonRecord, request: JsonRecord): number {
  const meta = parseRecord(chat.metadata);
  return nonNegativeInteger(
    request.lorebookTokenBudget,
    readNumber(meta.lorebookTokenBudget, LIMITS.DEFAULT_LOREBOOK_TOKEN_BUDGET),
  );
}

function resolveLorebookRecursionDepth(lorebook: JsonRecord): number {
  return Math.min(MAX_LOREBOOK_RECURSION_DEPTH, Math.max(1, nonNegativeInteger(lorebook.maxRecursionDepth, 3)));
}

function normalizeLorebookTimingState(value: unknown): EntryTimingState | null {
  if (!isRecord(value)) return null;
  const stickyCount = readNumber(value.stickyCount, Number.NaN);
  const cooldownRemaining = readNumber(value.cooldownRemaining, Number.NaN);
  const delayRemaining = readNumber(value.delayRemaining, Number.NaN);
  if (![stickyCount, cooldownRemaining, delayRemaining].every(Number.isFinite)) return null;
  const lastActivatedAt =
    value.lastActivatedAt === null || value.lastActivatedAt === undefined
      ? null
      : readNumber(value.lastActivatedAt, Number.NaN);
  if (lastActivatedAt !== null && !Number.isFinite(lastActivatedAt)) return null;
  return {
    lastActivatedAt: lastActivatedAt === null ? null : Math.max(0, Math.trunc(lastActivatedAt)),
    stickyCount: Math.max(0, Math.trunc(stickyCount)),
    cooldownRemaining: Math.max(0, Math.trunc(cooldownRemaining)),
    delayRemaining: Math.max(0, Math.trunc(delayRemaining)),
  };
}

function normalizeLorebookEntryStateOverride(value: unknown): LorebookEntryStateOverride | null {
  if (!isRecord(value)) return null;
  const state: LorebookEntryStateOverride = {};
  if (typeof value.enabled === "boolean") state.enabled = value.enabled;
  if (value.ephemeral === null) {
    state.ephemeral = null;
  } else if (value.ephemeral !== undefined) {
    const ephemeral = readNumber(value.ephemeral, Number.NaN);
    if (Number.isFinite(ephemeral)) state.ephemeral = Math.max(0, Math.trunc(ephemeral));
  }
  return Object.keys(state).length > 0 ? state : null;
}

function lorebookEntryStateOverrideMap(value: unknown): Map<string, LorebookEntryStateOverride> {
  const states = new Map<string, LorebookEntryStateOverride>();
  for (const [entryId, state] of Object.entries(parseRecord(value))) {
    const normalizedId = entryId.trim();
    const normalizedState = normalizeLorebookEntryStateOverride(state);
    if (normalizedId && normalizedState) states.set(normalizedId, normalizedState);
  }
  return states;
}

function entryWithChatState(entry: LorebookEntry, overrides: Map<string, LorebookEntryStateOverride>): LorebookEntry {
  const override = overrides.get(entry.id);
  if (!override) return entry;
  const ephemeral = override.ephemeral === undefined ? entry.ephemeral : override.ephemeral;
  return {
    ...entry,
    enabled: entry.enabled && override.enabled !== false && !(typeof ephemeral === "number" && ephemeral <= 0),
    ephemeral,
  };
}

function serializeLorebookEntryStateOverrides(
  states: Map<string, LorebookEntryStateOverride>,
): Record<string, LorebookEntryStateOverride> {
  return Object.fromEntries(
    [...states.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([entryId, state]) => [
        entryId,
        {
          ...(state.ephemeral !== undefined ? { ephemeral: state.ephemeral } : {}),
          ...(state.enabled !== undefined ? { enabled: state.enabled } : {}),
        },
      ]),
  );
}

function lorebookEntryStateOverridesChanged(
  previous: Map<string, LorebookEntryStateOverride>,
  next: Map<string, LorebookEntryStateOverride>,
): boolean {
  if (previous.size !== next.size) return true;
  for (const [entryId, previousState] of previous) {
    const nextState = next.get(entryId);
    if (!nextState) return true;
    if (previousState.ephemeral !== nextState.ephemeral || previousState.enabled !== nextState.enabled) return true;
  }
  return false;
}

function updateEntryStateOverridesForScan(
  entries: LorebookEntry[],
  activatedEntries: ActivatedEntry[],
  previousStates: Map<string, LorebookEntryStateOverride>,
): Map<string, LorebookEntryStateOverride> {
  const nextStates = new Map(previousStates);
  const activatedIds = new Set(activatedEntries.filter((entry) => !entry.sticky).map((entry) => entry.entry.id));

  for (const entry of entries) {
    if (entry.ephemeral === null) continue;
    const previous = nextStates.get(entry.id);
    const remaining = previous?.ephemeral === undefined ? entry.ephemeral : previous.ephemeral;
    if (typeof remaining !== "number") continue;
    const nextRemaining = activatedIds.has(entry.id) ? Math.max(0, remaining - 1) : Math.max(0, remaining);
    nextStates.set(entry.id, {
      ...previous,
      ephemeral: nextRemaining,
      enabled: nextRemaining > 0,
    });
  }

  return nextStates;
}

function lorebookTimingStateMap(value: unknown): Map<string, EntryTimingState> {
  const states = new Map<string, EntryTimingState>();
  for (const [entryId, state] of Object.entries(parseRecord(value))) {
    const normalizedId = entryId.trim();
    const normalizedState = normalizeLorebookTimingState(state);
    if (normalizedId && normalizedState) states.set(normalizedId, normalizedState);
  }
  return states;
}

function serializeLorebookTimingStates(
  states: Map<string, EntryTimingState>,
): Record<string, LorebookEntryTimingState> {
  return Object.fromEntries(
    [...states.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([entryId, state]) => [
        entryId,
        {
          lastActivatedAt: state.lastActivatedAt,
          stickyCount: state.stickyCount,
          cooldownRemaining: state.cooldownRemaining,
          delayRemaining: state.delayRemaining,
        },
      ]),
  );
}

function lorebookTimingStatesChanged(
  previous: Map<string, EntryTimingState>,
  next: Map<string, EntryTimingState>,
): boolean {
  if (previous.size !== next.size) return true;
  for (const [entryId, previousState] of previous) {
    const nextState = next.get(entryId);
    if (!nextState) return true;
    if (
      previousState.lastActivatedAt !== nextState.lastActivatedAt ||
      previousState.stickyCount !== nextState.stickyCount ||
      previousState.cooldownRemaining !== nextState.cooldownRemaining ||
      previousState.delayRemaining !== nextState.delayRemaining
    ) {
      return true;
    }
  }
  return false;
}

async function loadLorebookEntriesForActivation(
  storage: StorageGateway,
  lorebook: JsonRecord,
): Promise<LorebookEntry[]> {
  const id = readString(lorebook.id);
  if (!id) return [];
  const [rows, folders] = await Promise.all([
    storage.listLorebookEntries<JsonRecord>(id),
    storage.list<JsonRecord>("lorebook-folders", { filters: { lorebookId: id } }),
  ]);
  return normalizeLorebookEntriesForActivation(lorebook, rows, folders);
}

function normalizeLorebookEntriesForActivation(
  lorebook: JsonRecord,
  rows: JsonRecord[],
  folders: JsonRecord[],
): LorebookEntry[] {
  const disabledFolderIds = new Set(
    folders
      .filter((folder) => !boolish(folder.enabled, true))
      .map((folder) => readString(folder.id))
      .filter(Boolean),
  );
  const defaultScanDepth = nonNegativeInteger(lorebook.scanDepth, 0);
  const excludeFromVectorization = boolish(lorebook.excludeFromVectorization, false);
  return rows
    .map((row) => normalizeLorebookEntry(excludeFromVectorization ? { ...row, excludeFromVectorization: true } : row))
    .map((entry) => ({
      ...entry,
      scanDepth: entry.scanDepth == null ? defaultScanDepth : entry.scanDepth,
    }))
    .filter((entry) => entry.enabled && entry.content.trim())
    .filter((entry) => !entry.folderId || !disabledFolderIds.has(entry.folderId));
}

export async function loadLorebookEntriesForActivationBatch(
  storage: StorageGateway,
  lorebooks: JsonRecord[],
): Promise<Map<string, LorebookEntry[]>> {
  const lorebooksById = new Map(
    lorebooks
      .map((book) => [readString(book.id), book] as const)
      .filter((entry): entry is readonly [string, JsonRecord] => Boolean(entry[0])),
  );
  const lorebookIds = [...lorebooksById.keys()];
  if (lorebookIds.length === 0) return new Map();

  if (!storage.listLorebookEntriesByLorebookIds) {
    return new Map(
      await Promise.all(
        lorebookIds.map(
          async (id) => [id, await loadLorebookEntriesForActivation(storage, lorebooksById.get(id) ?? {})] as const,
        ),
      ),
    );
  }

  const lorebookIdSet = new Set(lorebookIds);
  const [rows, folders] = await Promise.all([
    storage.listLorebookEntriesByLorebookIds<JsonRecord>(lorebookIds),
    storage.list<JsonRecord>("lorebook-folders"),
  ]);

  const rowsByLorebookId = new Map<string, JsonRecord[]>();
  for (const row of rows) {
    const lorebookId = readString(row.lorebookId);
    if (!lorebookIdSet.has(lorebookId)) continue;
    const bucket = rowsByLorebookId.get(lorebookId) ?? [];
    bucket.push(row);
    rowsByLorebookId.set(lorebookId, bucket);
  }

  const foldersByLorebookId = new Map<string, JsonRecord[]>();
  for (const folder of folders) {
    const lorebookId = readString(folder.lorebookId);
    if (!lorebookIdSet.has(lorebookId)) continue;
    const bucket = foldersByLorebookId.get(lorebookId) ?? [];
    bucket.push(folder);
    foldersByLorebookId.set(lorebookId, bucket);
  }

  return new Map(
    lorebookIds.map((id) => [
      id,
      normalizeLorebookEntriesForActivation(
        lorebooksById.get(id) ?? {},
        rowsByLorebookId.get(id) ?? [],
        foldersByLorebookId.get(id) ?? [],
      ),
    ]),
  );
}

function scanLorebookEntries(
  messages: ScanMessage[],
  entries: LorebookEntry[],
  lorebook: JsonRecord,
  options: ScanOptions,
  contentResolver?: LorebookContentResolver,
): ScannedLorebookEntries {
  const activated = boolish(lorebook.recursiveScanning, false)
    ? recursiveScan(messages, entries, options, resolveLorebookRecursionDepth(lorebook))
    : scanForActivatedEntries(messages, entries, options);
  const lorebookId = readString(lorebook.id);
  const lorebookName = readString(lorebook.name, lorebookId || "Lorebook");
  const lorebookBudget = nonNegativeInteger(lorebook.tokenBudget, 0);
  const budgeted = applyTokenBudgetWithSkipped(activated, lorebookBudget, contentResolver);
  return {
    activatedEntries: budgeted.includedEntries,
    budgetSkippedEntries: budgeted.skippedEntries.map((skipped) => ({
      activatedEntry: skipped.activatedEntry,
      lorebookName,
      lorebookBudget,
      lorebookUsedTokens: skipped.usedTokensBefore,
      estimatedTokens: skipped.estimatedTokens,
    })),
    entriesForTiming: entries,
  };
}

function semanticQueryText(messages: ScanMessage[], latestUserInput: string | undefined): string {
  const latest = latestUserInput?.trim();
  if (latest) return latest;
  return messages
    .slice(-10)
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n\n");
}

function countSemanticCandidateEntries(entries: LorebookEntry[]): number {
  return entries.filter(
    (entry) =>
      !entry.constant &&
      !entry.excludeFromVectorization &&
      Array.isArray(entry.embedding) &&
      entry.embedding.some((value) => Number.isFinite(value)),
  ).length;
}

async function resolveSemanticChatEmbedding(
  messages: ScanMessage[],
  latestUserInput: string | undefined,
  embeddingSource: LorebookEmbeddingSource | null | undefined,
  vectorizedEntryCount: number,
): Promise<{ chatEmbedding: number[] | null; status: LorebookSemanticScanStatus }> {
  if (vectorizedEntryCount === 0) {
    return { chatEmbedding: null, status: { state: "not_applicable", vectorizedEntryCount } };
  }
  if (!embeddingSource) {
    return { chatEmbedding: null, status: { state: "missing_embedding_source", vectorizedEntryCount } };
  }
  const query = semanticQueryText(messages, latestUserInput);
  if (!query) {
    return { chatEmbedding: null, status: { state: "empty_query", vectorizedEntryCount } };
  }
  try {
    const sourceEmbedding = await embeddingSource.embed([query]);
    const vector = sourceEmbedding?.[0]?.filter((value): value is number => Number.isFinite(value));
    if (!vector?.length) {
      return { chatEmbedding: null, status: { state: "unavailable", vectorizedEntryCount } };
    }
    return { chatEmbedding: vector, status: { state: "ready", vectorizedEntryCount } };
  } catch {
    return { chatEmbedding: null, status: { state: "failed", vectorizedEntryCount } };
  }
}

async function loadActivatedLore(input: ActiveLorebookScannerInput): Promise<LoadedActivatedLore> {
  const meta = parseRecord(input.chat.metadata);
  const scopeExclusions = resolveGameLorebookScopeExclusions(readString(input.chat.mode || input.chat.chatMode), meta);
  const scopedLorebooks = (await input.storage.list<JsonRecord>("lorebooks"))
    .map((book) => ({
      book,
      reason: resolveActiveLorebookScopeReason(book, {
        chat: input.chat,
        characters: input.characters,
        persona: input.persona,
        scopeExclusions,
      }),
    }))
    .filter((entry): entry is { book: JsonRecord; reason: ActiveLorebookScopeReason } => !!entry.reason);
  const lorebooks = scopedLorebooks.map((entry) => entry.book);
  const activeLorebookReasons = scopedLorebooks.map((entry) => entry.reason);
  const activeCharacterIds = input.characters.map((character) => character.id);
  const activeCharacterTags = input.characters.flatMap((character) => character.tags);
  const gameState = parseRecord(input.chat.gameState ?? meta.gameState);
  const previousTimingStates = lorebookTimingStateMap(meta.entryTimingStates);
  const previousEntryStateOverrides = lorebookEntryStateOverrideMap(meta.entryStateOverrides);
  const messages = input.storedMessages
    .filter((message) => !hiddenFromAi(message))
    .map((message) => ({
      role: readString(message.role, "user"),
      content: readString(message.content),
    }));
  const generationTriggers =
    input.generationTriggers ?? ["chat", readString(input.chat.mode || input.chat.chatMode)].filter(Boolean);
  const lorebookNamesById = new Map(
    lorebooks.map((book) => {
      const id = readString(book.id);
      return [id, readString(book.name, id || "Lorebook")] as const;
    }),
  );
  const entriesForActivationByBookId = await loadLorebookEntriesForActivationBatch(input.storage, lorebooks);
  const entriesByBook = lorebooks.map((book) => {
    const id = readString(book.id);
    return {
      book,
      entries: (entriesForActivationByBookId.get(id) ?? []).map((entry) =>
        entryWithChatState(entry, previousEntryStateOverrides),
      ),
    };
  });
  const vectorizedEntryCount = entriesByBook.reduce(
    (sum, item) => sum + countSemanticCandidateEntries(item.entries),
    0,
  );
  const semantic = await resolveSemanticChatEmbedding(
    messages,
    input.latestUserInput,
    input.embeddingSource,
    vectorizedEntryCount,
  );
  const options: ScanOptions = {
    activeCharacterIds,
    activeCharacterTags,
    generationTriggers,
    gameState,
    timingStates: previousTimingStates,
    currentMessageIndex: messages.length,
    additionalMatchingSourceText: buildAdditionalMatchingSourceText(input.characters, input.persona),
    chatEmbedding: semantic.chatEmbedding,
    ignoreTiming: input.ignoreTiming,
  };
  const scanned = entriesByBook.map(({ book, entries }) =>
    scanLorebookEntries(messages, entries, book, options, input.contentResolver),
  );
  return {
    activatedEntries: scanned
      .flatMap((result) => result.activatedEntries)
      .sort((a, b) => a.injectionOrder - b.injectionOrder),
    budgetSkippedEntries: scanned.flatMap((result) => result.budgetSkippedEntries),
    entriesForTiming: scanned.flatMap((result) => result.entriesForTiming),
    previousTimingStates,
    previousEntryStateOverrides,
    lorebookNamesById,
    currentMessageIndex: messages.length,
    activeLorebookReasons,
    scopeExclusions,
    semanticStatus: semantic.status,
  };
}

function lorebookBudgetSkippedLoreForEvent(
  skipped: LoadedLorebookBudgetSkippedEntry,
  chatBudget: number,
): BudgetSkippedLorebookEntry {
  const entry = skipped.activatedEntry.entry;
  return {
    id: entry.id,
    name: entry.name,
    lorebookId: entry.lorebookId,
    lorebookName: skipped.lorebookName,
    matchedKeys: skipped.activatedEntry.matchedKeys,
    estimatedTokens: skipped.estimatedTokens,
    lorebookBudget: skipped.lorebookBudget,
    lorebookUsedTokens: skipped.lorebookUsedTokens,
    chatBudget,
    chatUsedTokens: 0,
    blockedBy: "lorebook",
  };
}

function budgetSkippedLoreForEvent(
  skipped: BudgetSkippedActivatedEntry,
  lorebookNamesById: Map<string, string>,
  chatBudget: number,
): BudgetSkippedLorebookEntry {
  const entry = skipped.activatedEntry.entry;
  return {
    id: entry.id,
    name: entry.name,
    lorebookId: entry.lorebookId,
    lorebookName: lorebookNamesById.get(entry.lorebookId) ?? entry.lorebookId,
    matchedKeys: skipped.activatedEntry.matchedKeys,
    estimatedTokens: skipped.estimatedTokens,
    lorebookBudget: 0,
    lorebookUsedTokens: 0,
    chatBudget,
    chatUsedTokens: skipped.usedTokensBefore,
    blockedBy: "chat",
  };
}

export function lorebookActivatedEntryForEvent(entry: ActivatedEntry) {
  return {
    id: entry.entry.id,
    lorebookId: entry.entry.lorebookId,
    name: entry.entry.name,
    content: entry.entry.content,
    tag: entry.matchedKeys.join(", "),
    matchedKeys: entry.matchedKeys,
    order: entry.entry.order,
    constant: entry.entry.constant,
  };
}

export async function scanActiveLorebooks(input: ActiveLorebookScannerInput): Promise<ActiveLorebookScannerResult> {
  const loadedLore = await loadActivatedLore(input);
  const lorebookTokenBudget = resolveLorebookTokenBudget(input.chat, input.request ?? {});
  const processedLore = processActivatedEntries(
    loadedLore.activatedEntries,
    lorebookTokenBudget,
    input.contentResolver,
  );
  const nextTimingStates = updateTimingStatesForScan(
    loadedLore.entriesForTiming,
    processedLore.includedEntries,
    loadedLore.previousTimingStates,
    loadedLore.currentMessageIndex,
  );
  const lorebookTimingStates = lorebookTimingStatesChanged(loadedLore.previousTimingStates, nextTimingStates)
    ? serializeLorebookTimingStates(nextTimingStates)
    : null;
  const nextEntryStateOverrides = updateEntryStateOverridesForScan(
    loadedLore.entriesForTiming,
    processedLore.includedEntries,
    loadedLore.previousEntryStateOverrides,
  );
  const lorebookEntryStateOverrides = lorebookEntryStateOverridesChanged(
    loadedLore.previousEntryStateOverrides,
    nextEntryStateOverrides,
  )
    ? serializeLorebookEntryStateOverrides(nextEntryStateOverrides)
    : null;
  const budgetSkippedLorebookEntries = [
    ...loadedLore.budgetSkippedEntries.map((entry) => lorebookBudgetSkippedLoreForEvent(entry, lorebookTokenBudget)),
    ...processedLore.skippedEntries.map((entry) =>
      budgetSkippedLoreForEvent(entry, loadedLore.lorebookNamesById, lorebookTokenBudget),
    ),
  ];
  return {
    activatedEntries: loadedLore.activatedEntries,
    processedLore,
    entriesForTiming: loadedLore.entriesForTiming,
    previousTimingStates: loadedLore.previousTimingStates,
    nextTimingStates,
    lorebookTimingStates,
    lorebookEntryStateOverrides,
    budgetSkippedLorebookEntries,
    lorebookNamesById: loadedLore.lorebookNamesById,
    currentMessageIndex: loadedLore.currentMessageIndex,
    activeLorebookReasons: loadedLore.activeLorebookReasons,
    scopeExclusions: loadedLore.scopeExclusions,
    semanticStatus: loadedLore.semanticStatus,
  };
}
