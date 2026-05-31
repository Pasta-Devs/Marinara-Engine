import type { StorageGateway } from "../capabilities/storage";
import type { LorebookEntry, LorebookEntryTimingState, LorebookMatchingSource } from "../contracts/types/lorebook";
import { LIMITS } from "../contracts/constants/defaults";
import {
  applyTokenBudgetWithSkipped,
  processActivatedEntries,
  type BudgetSkippedActivatedEntry,
} from "../generation-core/lorebooks/prompt-injector";
import {
  resolveGameLorebookScopeExclusions,
  type LorebookScopeExclusions,
} from "../generation-core/lorebooks/game-lorebook-scope";
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

type ActiveLorebookScopeReasonType = "global" | "character" | "persona" | "chat" | "selected";

interface ActiveLorebookScopeReason {
  lorebookId: string;
  lorebookName: string;
  reason: ActiveLorebookScopeReasonType;
  matchedIds: string[];
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
}

export interface ActiveLorebookScannerInput {
  storage: StorageGateway;
  chat: JsonRecord;
  characters: LorebookActivationCharacterContext[];
  persona: LorebookActivationPersonaContext | null;
  storedMessages: JsonRecord[];
  request?: JsonRecord;
  latestUserInput?: string;
  embeddingSource?: LorebookEmbeddingSource | null;
  ignoreTiming?: boolean;
}

export interface ActiveLorebookScannerResult {
  activatedEntries: ActivatedEntry[];
  processedLore: ReturnType<typeof processActivatedEntries>;
  entriesForTiming: LorebookEntry[];
  previousTimingStates: Map<string, EntryTimingState>;
  nextTimingStates: Map<string, EntryTimingState>;
  lorebookTimingStates: Record<string, LorebookEntryTimingState> | null;
  budgetSkippedLorebookEntries: BudgetSkippedLorebookEntry[];
  lorebookNamesById: Map<string, string>;
  currentMessageIndex: number;
  activeLorebookReasons: ActiveLorebookScopeReason[];
  scopeExclusions: LorebookScopeExclusions;
  semanticStatus: LorebookSemanticScanStatus;
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

function resolveActiveLorebookScopeReason(
  lorebook: JsonRecord,
  chat: JsonRecord,
  characters: LorebookActivationCharacterContext[],
  persona: LorebookActivationPersonaContext | null,
  scopeExclusions: LorebookScopeExclusions = resolveGameLorebookScopeExclusions(
    readString(chat.mode || chat.chatMode),
    parseRecord(chat.metadata),
  ),
): ActiveLorebookScopeReason | null {
  if (!boolish(lorebook.enabled, true)) return null;
  const lorebookId = readString(lorebook.id);
  const lorebookName = readString(lorebook.name, lorebookId || "Lorebook");
  if (scopeExclusions.excludedLorebookIds.includes(lorebookId)) return null;
  if (scopeExclusions.excludedSourceAgentIds.includes(readString(lorebook.sourceAgentId))) return null;
  if (boolish(lorebook.isGlobal ?? lorebook.global, false)) {
    return { lorebookId, lorebookName, reason: "global", matchedIds: [] };
  }

  const activeIds = new Set(characters.map((character) => character.id));
  const lorebookCharacterIds = stringArray(lorebook.characterIds);
  const matchedCharacterIds = [
    ...lorebookCharacterIds.filter((id) => activeIds.has(id)),
    readString(lorebook.characterId),
  ].filter((id, index, ids) => id && activeIds.has(id) && ids.indexOf(id) === index);
  if (matchedCharacterIds.length > 0) {
    return { lorebookId, lorebookName, reason: "character", matchedIds: matchedCharacterIds };
  }

  const personaId = readString(chat.personaId);
  if (persona && personaId) {
    const personaIds = stringArray(lorebook.personaIds);
    if (personaIds.includes(personaId) || readString(lorebook.personaId) === personaId) {
      return { lorebookId, lorebookName, reason: "persona", matchedIds: [personaId] };
    }
  }

  const chatId = readString(chat.id).trim();
  const chatScopedId = readString(lorebook.chatId).trim();
  if (chatScopedId && chatScopedId === chatId) {
    return { lorebookId, lorebookName, reason: "chat", matchedIds: [chatId] };
  }

  const meta = parseRecord(chat.metadata);
  if (stringArray(meta.activeLorebookIds ?? chat.activeLorebookIds).includes(lorebookId)) {
    return { lorebookId, lorebookName, reason: "selected", matchedIds: [lorebookId] };
  }

  return null;
}

export function lorebookAppliesToContext(
  lorebook: JsonRecord,
  chat: JsonRecord,
  characters: LorebookActivationCharacterContext[],
  persona: LorebookActivationPersonaContext | null,
): boolean {
  return !!resolveActiveLorebookScopeReason(lorebook, chat, characters, persona);
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

export async function loadLorebookEntriesForActivation(
  storage: StorageGateway,
  lorebook: JsonRecord,
): Promise<LorebookEntry[]> {
  const id = readString(lorebook.id);
  if (!id) return [];
  const [rows, folders] = await Promise.all([
    storage.listLorebookEntries<JsonRecord>(id),
    storage.list<JsonRecord>("lorebook-folders", { filters: { lorebookId: id } }),
  ]);
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

function scanLorebookEntries(
  messages: ScanMessage[],
  entries: LorebookEntry[],
  lorebook: JsonRecord,
  options: ScanOptions,
): ScannedLorebookEntries {
  const activated = boolish(lorebook.recursiveScanning, false)
    ? recursiveScan(messages, entries, options, resolveLorebookRecursionDepth(lorebook))
    : scanForActivatedEntries(messages, entries, options);
  const lorebookId = readString(lorebook.id);
  const lorebookName = readString(lorebook.name, lorebookId || "Lorebook");
  const lorebookBudget = nonNegativeInteger(lorebook.tokenBudget, 0);
  const budgeted = applyTokenBudgetWithSkipped(activated, lorebookBudget);
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
      reason: resolveActiveLorebookScopeReason(book, input.chat, input.characters, input.persona, scopeExclusions),
    }))
    .filter((entry): entry is { book: JsonRecord; reason: ActiveLorebookScopeReason } => !!entry.reason);
  const lorebooks = scopedLorebooks.map((entry) => entry.book);
  const activeLorebookReasons = scopedLorebooks.map((entry) => entry.reason);
  const activeCharacterIds = input.characters.map((character) => character.id);
  const activeCharacterTags = input.characters.flatMap((character) => character.tags);
  const gameState = parseRecord(input.chat.gameState ?? meta.gameState);
  const previousTimingStates = lorebookTimingStateMap(meta.entryTimingStates);
  const messages = input.storedMessages
    .filter((message) => !hiddenFromAi(message))
    .map((message) => ({
      role: readString(message.role, "user"),
      content: readString(message.content),
    }));
  const generationTriggers = ["chat", readString(input.chat.mode || input.chat.chatMode)].filter(Boolean);
  const lorebookNamesById = new Map(
    lorebooks.map((book) => {
      const id = readString(book.id);
      return [id, readString(book.name, id || "Lorebook")] as const;
    }),
  );
  const entriesByBook = await Promise.all(
    lorebooks.map(async (book) => ({ book, entries: await loadLorebookEntriesForActivation(input.storage, book) })),
  );
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
  const scanned = entriesByBook.map(({ book, entries }) => scanLorebookEntries(messages, entries, book, options));
  return {
    activatedEntries: scanned
      .flatMap((result) => result.activatedEntries)
      .sort((a, b) => a.injectionOrder - b.injectionOrder),
    budgetSkippedEntries: scanned.flatMap((result) => result.budgetSkippedEntries),
    entriesForTiming: scanned.flatMap((result) => result.entriesForTiming),
    previousTimingStates,
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
  const processedLore = processActivatedEntries(loadedLore.activatedEntries, lorebookTokenBudget);
  const nextTimingStates = updateTimingStatesForScan(
    loadedLore.entriesForTiming,
    processedLore.includedEntries,
    loadedLore.previousTimingStates,
    loadedLore.currentMessageIndex,
  );
  const lorebookTimingStates = lorebookTimingStatesChanged(loadedLore.previousTimingStates, nextTimingStates)
    ? serializeLorebookTimingStates(nextTimingStates)
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
    budgetSkippedLorebookEntries,
    lorebookNamesById: loadedLore.lorebookNamesById,
    currentMessageIndex: loadedLore.currentMessageIndex,
    activeLorebookReasons: loadedLore.activeLorebookReasons,
    scopeExclusions: loadedLore.scopeExclusions,
    semanticStatus: loadedLore.semanticStatus,
  };
}
