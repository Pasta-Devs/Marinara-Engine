import type { StorageGateway } from "../capabilities/storage";
import type { LorebookEntry, LorebookEntryTimingState, LorebookMatchingSource } from "../contracts/types/lorebook";
import { LIMITS } from "../contracts/constants/defaults";
import { processActivatedEntries, type LorebookContentResolver } from "../generation-core/lorebooks/prompt-injector";
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

interface LorebookEmbeddingRequest {
  connectionId?: string | null;
  model?: string | null;
}

interface LorebookEmbeddingSource {
  embed(texts: string[], request?: LorebookEmbeddingRequest): Promise<number[][] | null>;
}

type LorebookEmbeddingRequestSelection =
  | { type: "default" }
  | { type: "target"; request: LorebookEmbeddingRequest }
  | { type: "ambiguous" };

interface ActiveLorebookBudgetMetadata {
  lorebookName: string;
  lorebookBudget: number;
  recursiveScanning: boolean;
}

interface LoadedActivatedLore {
  activatedEntries: ActivatedEntry[];
  budgetSkippedEntries: BudgetSkippedLorebookEntry[];
  entriesForTiming: LorebookEntry[];
  previousTimingStates: Map<string, EntryTimingState>;
  lorebookNamesById: Map<string, string>;
  currentMessageIndex: number;
  activeLorebookReasons: ActiveLorebookScopeReason[];
  scopeExclusions: LorebookScopeExclusions;
  semanticStatus: LorebookSemanticScanStatus;
  previousEntryStateOverrides: Map<string, LorebookEntryStateOverride>;
}

export interface ActiveLorebookIncludedPositions {
  worldInfoBefore?: boolean;
  worldInfoAfter?: boolean;
  depth?: boolean;
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
  includedPositions?: ActiveLorebookIncludedPositions;
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

interface LorebookBudgetSelectionState {
  selected: ActivatedEntry[];
  selectedIds: Set<string>;
  perLorebookTokens: Map<string, number>;
  exhaustedLorebookIds: Set<string>;
  totalTokens: number;
  chatBudgetExhausted: boolean;
}

interface LorebookResolvedCandidatePass {
  entries: ActivatedEntry[];
  restoreVariables: Array<() => void>;
}

type BudgetedLorebookEntrySelection =
  | { selected: true; entry: ActivatedEntry }
  | { selected: false; skipped?: BudgetSkippedLorebookEntry };

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
    embeddingModel: readString(entry.embeddingModel).trim() || null,
    embeddingConnectionId: readString(entry.embeddingConnectionId).trim() || null,
    embeddingUpdatedAt: readString(entry.embeddingUpdatedAt).trim() || null,
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

function lorebookEntryIncludedByPosition(entry: LorebookEntry, positions?: ActiveLorebookIncludedPositions): boolean {
  if (!positions) return true;
  if (entry.position <= 0) return positions.worldInfoBefore === true;
  if (entry.position === 1) return positions.worldInfoAfter === true;
  return positions.depth !== false;
}

function lorebookBudgetSelectionOrder(a: ActivatedEntry, b: ActivatedEntry): number {
  if (a.entry.constant && !b.entry.constant) return -1;
  if (!a.entry.constant && b.entry.constant) return 1;
  if (a.matchedLatestUserMessage && !b.matchedLatestUserMessage) return -1;
  if (!a.matchedLatestUserMessage && b.matchedLatestUserMessage) return 1;
  return a.injectionOrder - b.injectionOrder;
}

function lorebookInjectionOrder(a: ActivatedEntry, b: ActivatedEntry): number {
  return a.injectionOrder - b.injectionOrder;
}

function estimateLorebookTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

function createLorebookBudgetSelectionState(): LorebookBudgetSelectionState {
  return {
    selected: [],
    selectedIds: new Set(),
    perLorebookTokens: new Map(),
    exhaustedLorebookIds: new Set(),
    totalTokens: 0,
    chatBudgetExhausted: false,
  };
}

function cloneLorebookBudgetSelectionState(state: LorebookBudgetSelectionState): LorebookBudgetSelectionState {
  return {
    selected: [...state.selected],
    selectedIds: new Set(state.selectedIds),
    perLorebookTokens: new Map(state.perLorebookTokens),
    exhaustedLorebookIds: new Set(state.exhaustedLorebookIds),
    totalTokens: state.totalTokens,
    chatBudgetExhausted: state.chatBudgetExhausted,
  };
}

function applyLorebookBudgetSelectionState(
  target: LorebookBudgetSelectionState,
  source: LorebookBudgetSelectionState,
): void {
  target.selected = source.selected;
  target.selectedIds = source.selectedIds;
  target.perLorebookTokens = source.perLorebookTokens;
  target.exhaustedLorebookIds = source.exhaustedLorebookIds;
  target.totalTokens = source.totalTokens;
  target.chatBudgetExhausted = source.chatBudgetExhausted;
}

function activatedEntryWithResolvedContent(
  activatedEntry: ActivatedEntry,
  contentResolver?: LorebookContentResolver,
): ActivatedEntry {
  if (!contentResolver) return activatedEntry;
  const rawContent = activatedEntry.rawContent ?? activatedEntry.entry.content;
  const resolvedContent = contentResolver.resolve(rawContent);
  return {
    ...activatedEntry,
    rawContent,
    entry: {
      ...activatedEntry.entry,
      content: resolvedContent,
    },
  };
}

function resolveLorebookCandidatePass(
  candidates: ActivatedEntry[],
  contentResolver?: LorebookContentResolver,
): LorebookResolvedCandidatePass {
  const entries: ActivatedEntry[] = [];
  const restoreVariables: Array<() => void> = [];

  for (const candidate of [...candidates].sort(lorebookInjectionOrder)) {
    const restore = contentResolver?.snapshotVariables?.();
    const resolvedCandidate = activatedEntryWithResolvedContent(candidate, contentResolver);
    if (restore) restoreVariables.push(restore);
    entries.push(resolvedCandidate);
  }

  return { entries, restoreVariables };
}

function rollbackLorebookCandidatePass(pass: LorebookResolvedCandidatePass): void {
  for (const restore of [...pass.restoreVariables].reverse()) {
    restore();
  }
}

function sameActivatedEntrySet(a: ActivatedEntry[], b: ActivatedEntry[]): boolean {
  if (a.length !== b.length) return false;
  const bIds = new Set(b.map((entry) => entry.entry.id));
  return a.every((entry) => bIds.has(entry.entry.id));
}

function recordBudgetSelectionPass(
  skippedById: Map<string, BudgetSkippedLorebookEntry>,
  selectedEntries: ActivatedEntry[],
  skippedEntries: BudgetSkippedLorebookEntry[],
): void {
  for (const selected of selectedEntries) {
    skippedById.delete(selected.entry.id);
  }
  for (const skipped of skippedEntries) {
    skippedById.set(skipped.id, skipped);
  }
}

function applySkippedBudgetExhaustion(
  state: LorebookBudgetSelectionState,
  skippedEntries: Iterable<BudgetSkippedLorebookEntry>,
): void {
  for (const skipped of skippedEntries) {
    if (skipped.blockedBy === "lorebook" || skipped.blockedBy === "both") {
      state.exhaustedLorebookIds.add(skipped.lorebookId);
    }
    if (skipped.blockedBy === "chat" || skipped.blockedBy === "both") {
      state.chatBudgetExhausted = true;
    }
  }
}

function sortedBudgetSkippedEntries(
  skippedById: ReadonlyMap<string, BudgetSkippedLorebookEntry>,
): BudgetSkippedLorebookEntry[] {
  return [...skippedById.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function budgetSkipReason(exceedsLorebookBudget: boolean, exceedsChatBudget: boolean): "lorebook" | "chat" | "both" {
  if (exceedsLorebookBudget && exceedsChatBudget) return "both";
  if (exceedsLorebookBudget) return "lorebook";
  return "chat";
}

function trySelectBudgetedLorebookEntry(
  candidate: ActivatedEntry,
  state: LorebookBudgetSelectionState,
  lorebooksById: ReadonlyMap<string, ActiveLorebookBudgetMetadata>,
  chatBudget: number,
  maxEntries: number,
): BudgetedLorebookEntrySelection {
  if (state.selectedIds.has(candidate.entry.id)) return { selected: false };
  if (maxEntries > 0 && state.selected.length >= maxEntries) return { selected: false };

  const entryTokens = estimateLorebookTokens(candidate.entry.content);
  const lorebookMeta = lorebooksById.get(candidate.entry.lorebookId);
  const lorebookBudget = lorebookMeta?.lorebookBudget ?? 0;
  const lorebookUsedTokens = state.perLorebookTokens.get(candidate.entry.lorebookId) ?? 0;
  const exceedsLorebookBudget =
    state.exhaustedLorebookIds.has(candidate.entry.lorebookId) ||
    (lorebookBudget > 0 && lorebookUsedTokens + entryTokens > lorebookBudget);
  const exceedsChatBudget =
    state.chatBudgetExhausted || (chatBudget > 0 && state.totalTokens + entryTokens > chatBudget);

  if (exceedsLorebookBudget || exceedsChatBudget) {
    if (exceedsLorebookBudget) state.exhaustedLorebookIds.add(candidate.entry.lorebookId);
    if (exceedsChatBudget) state.chatBudgetExhausted = true;
    return {
      selected: false,
      skipped: {
        id: candidate.entry.id,
        name: candidate.entry.name,
        lorebookId: candidate.entry.lorebookId,
        lorebookName: lorebookMeta?.lorebookName ?? candidate.entry.lorebookId,
        matchedKeys: candidate.matchedKeys,
        estimatedTokens: entryTokens,
        lorebookBudget,
        lorebookUsedTokens,
        chatBudget,
        chatUsedTokens: state.totalTokens,
        blockedBy: budgetSkipReason(exceedsLorebookBudget, exceedsChatBudget),
      },
    };
  }

  state.selected.push(candidate);
  state.selectedIds.add(candidate.entry.id);
  state.perLorebookTokens.set(candidate.entry.lorebookId, lorebookUsedTokens + entryTokens);
  state.totalTokens += entryTokens;

  return { selected: true, entry: candidate };
}

function selectBudgetedLorebookEntries(
  candidates: ActivatedEntry[],
  state: LorebookBudgetSelectionState,
  lorebooksById: ReadonlyMap<string, ActiveLorebookBudgetMetadata>,
  chatBudget: number,
  maxEntries: number,
  contentResolver?: LorebookContentResolver,
): { selectedFromCandidates: ActivatedEntry[]; budgetSkippedEntries: BudgetSkippedLorebookEntry[] } {
  if (candidates.length === 0) return { selectedFromCandidates: [], budgetSkippedEntries: [] };

  let pool = candidates;
  const skippedById = new Map<string, BudgetSkippedLorebookEntry>();
  const maxPasses = Math.max(1, candidates.length + 1);

  for (let passIndex = 0; passIndex < maxPasses; passIndex += 1) {
    const pass = resolveLorebookCandidatePass(pool, contentResolver);
    const nextState = cloneLorebookBudgetSelectionState(state);
    const selectedFromCandidates: ActivatedEntry[] = [];
    const skippedFromCandidates: BudgetSkippedLorebookEntry[] = [];

    for (const candidate of [...pass.entries].sort(lorebookBudgetSelectionOrder)) {
      const selected = trySelectBudgetedLorebookEntry(candidate, nextState, lorebooksById, chatBudget, maxEntries);
      if (selected.selected) {
        selectedFromCandidates.push(selected.entry);
      } else if (selected.skipped) {
        skippedFromCandidates.push(selected.skipped);
      }
    }

    selectedFromCandidates.sort(lorebookInjectionOrder);
    recordBudgetSelectionPass(skippedById, selectedFromCandidates, skippedFromCandidates);

    if (sameActivatedEntrySet(pool, selectedFromCandidates)) {
      applySkippedBudgetExhaustion(nextState, skippedById.values());
      applyLorebookBudgetSelectionState(state, nextState);
      return {
        selectedFromCandidates,
        budgetSkippedEntries: sortedBudgetSkippedEntries(skippedById),
      };
    }

    rollbackLorebookCandidatePass(pass);
    pool = selectedFromCandidates;
  }

  applySkippedBudgetExhaustion(state, skippedById.values());
  return {
    selectedFromCandidates: [],
    budgetSkippedEntries: sortedBudgetSkippedEntries(skippedById),
  };
}

async function scanActiveLorebookEntrySet(
  messages: ScanMessage[],
  entries: LorebookEntry[],
  lorebooksById: ReadonlyMap<string, ActiveLorebookBudgetMetadata>,
  options: ScanOptions,
  recursionDepth: number,
  chatBudget: number,
  maxEntries: number,
  contentResolver?: LorebookContentResolver,
): Promise<{ activatedEntries: ActivatedEntry[]; budgetSkippedEntries: BudgetSkippedLorebookEntry[] }> {
  const state = createLorebookBudgetSelectionState();
  const processedIds = new Set<string>();
  const budgetSkippedEntries: BudgetSkippedLorebookEntry[] = [];
  let frontier = await scanForActivatedEntries(messages, entries, options);

  for (let depth = 0; frontier.length > 0; depth += 1) {
    const candidates = frontier.filter(
      (candidate) => !processedIds.has(candidate.entry.id) && !state.selectedIds.has(candidate.entry.id),
    );
    for (const candidate of candidates) {
      processedIds.add(candidate.entry.id);
    }

    const selectedBatch = selectBudgetedLorebookEntries(
      candidates,
      state,
      lorebooksById,
      chatBudget,
      maxEntries,
      contentResolver,
    );
    budgetSkippedEntries.push(...selectedBatch.budgetSkippedEntries);

    const recursiveContent = selectedBatch.selectedFromCandidates
      .filter((selected) => !selected.entry.preventRecursion)
      .map((selected) => selected.entry.content)
      .join("\n");

    if (depth >= recursionDepth) break;
    if (maxEntries > 0 && state.selected.length >= maxEntries) break;
    if (!recursiveContent) break;

    const remaining = entries.filter((entry) => !processedIds.has(entry.id) && !state.selectedIds.has(entry.id));
    if (remaining.length === 0) break;

    frontier = await scanForActivatedEntries([{ role: "system", content: recursiveContent }], remaining, options);
  }

  return {
    activatedEntries: state.selected.sort(lorebookInjectionOrder),
    budgetSkippedEntries,
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

function lorebookEntryHasEmbedding(entry: LorebookEntry): boolean {
  return (
    !entry.constant &&
    !entry.excludeFromVectorization &&
    Array.isArray(entry.embedding) &&
    entry.embedding.some((value) => Number.isFinite(value))
  );
}

function vectorEmbeddingRequest(entries: LorebookEntry[]): LorebookEmbeddingRequestSelection {
  const requests = entries.filter(lorebookEntryHasEmbedding).map((entry) => ({
    connectionId: readString(entry.embeddingConnectionId).trim() || null,
    model: readString(entry.embeddingModel).trim() || null,
  }));
  if (requests.length === 0) return { type: "default" };
  const unique = new Set(requests.map((request) => `${request.connectionId ?? ""}\0${request.model ?? ""}`));
  if (unique.size !== 1) return { type: "ambiguous" };
  const [request] = requests;
  if (!request || (!request.connectionId && !request.model)) return { type: "default" };
  return { type: "target", request };
}

async function resolveSemanticChatEmbedding(
  messages: ScanMessage[],
  latestUserInput: string | undefined,
  embeddingSource: LorebookEmbeddingSource | null | undefined,
  vectorizedEntryCount: number,
  embeddingRequest: LorebookEmbeddingRequestSelection,
): Promise<{ chatEmbedding: number[] | null; status: LorebookSemanticScanStatus }> {
  if (vectorizedEntryCount === 0) {
    return { chatEmbedding: null, status: { state: "not_applicable", vectorizedEntryCount } };
  }
  if (!embeddingSource) {
    return { chatEmbedding: null, status: { state: "missing_embedding_source", vectorizedEntryCount } };
  }
  if (embeddingRequest.type === "ambiguous") {
    return { chatEmbedding: null, status: { state: "unavailable", vectorizedEntryCount } };
  }
  const query = semanticQueryText(messages, latestUserInput);
  if (!query) {
    return { chatEmbedding: null, status: { state: "empty_query", vectorizedEntryCount } };
  }
  try {
    const sourceEmbedding = await embeddingSource.embed(
      [query],
      embeddingRequest.type === "target" ? embeddingRequest.request : undefined,
    );
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
  const rawGameState = input.chat.gameState ?? meta.gameState;
  const gameState = rawGameState == null ? null : parseRecord(rawGameState);
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
  const lorebooksById = new Map(
    lorebooks.map((book) => {
      const id = readString(book.id);
      return [
        id,
        {
          lorebookName: readString(book.name, id || "Lorebook"),
          lorebookBudget: nonNegativeInteger(book.tokenBudget, 0),
          recursiveScanning: boolish(book.recursiveScanning, false),
        },
      ] as const;
    }),
  );
  const entriesForActivationByBookId = await loadLorebookEntriesForActivationBatch(input.storage, lorebooks);
  const entriesByBook = lorebooks.map((book) => {
    const id = readString(book.id);
    return {
      book,
      entries: (entriesForActivationByBookId.get(id) ?? [])
        .map((entry) => entryWithChatState(entry, previousEntryStateOverrides))
        .filter((entry) => lorebookEntryIncludedByPosition(entry, input.includedPositions)),
    };
  });
  const vectorizedEntryCount = entriesByBook.reduce(
    (sum, item) => sum + countSemanticCandidateEntries(item.entries),
    0,
  );
  const embeddingRequest = vectorEmbeddingRequest(entriesByBook.flatMap((item) => item.entries));
  const semantic = await resolveSemanticChatEmbedding(
    messages,
    input.latestUserInput,
    input.embeddingSource,
    vectorizedEntryCount,
    embeddingRequest,
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
  const anyRecursive = lorebooks.some((book) => boolish(book.recursiveScanning, false));
  const maxRecursionDepth = lorebooks.reduce(
    (maxDepth, book) =>
      boolish(book.recursiveScanning, false) ? Math.max(maxDepth, resolveLorebookRecursionDepth(book)) : maxDepth,
    1,
  );
  const scanned = await scanActiveLorebookEntrySet(
    messages,
    entriesByBook.flatMap((item) => item.entries),
    lorebooksById,
    options,
    anyRecursive ? maxRecursionDepth : -1,
    resolveLorebookTokenBudget(input.chat, input.request ?? {}),
    LIMITS.MAX_LOREBOOK_ENTRIES,
    input.contentResolver,
  );
  return {
    activatedEntries: scanned.activatedEntries,
    budgetSkippedEntries: scanned.budgetSkippedEntries,
    entriesForTiming: entriesByBook.flatMap((result) => result.entries),
    previousTimingStates,
    previousEntryStateOverrides,
    lorebookNamesById,
    currentMessageIndex: messages.length,
    activeLorebookReasons,
    scopeExclusions,
    semanticStatus: semantic.status,
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
  const processedLore = processActivatedEntries(loadedLore.activatedEntries, 0, undefined, LIMITS.MAX_LOREBOOK_ENTRIES);
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
  return {
    activatedEntries: loadedLore.activatedEntries,
    processedLore,
    entriesForTiming: loadedLore.entriesForTiming,
    previousTimingStates: loadedLore.previousTimingStates,
    nextTimingStates,
    lorebookTimingStates,
    lorebookEntryStateOverrides,
    budgetSkippedLorebookEntries: loadedLore.budgetSkippedEntries,
    lorebookNamesById: loadedLore.lorebookNamesById,
    currentMessageIndex: loadedLore.currentMessageIndex,
    activeLorebookReasons: loadedLore.activeLorebookReasons,
    scopeExclusions: loadedLore.scopeExclusions,
    semanticStatus: loadedLore.semanticStatus,
  };
}
