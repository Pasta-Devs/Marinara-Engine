// ──────────────────────────────────────────────
// Lorebook: Keyword Scanner
// Scans chat messages against lorebook entry keys
// and returns activated entries respecting all
// matching rules (regex, whole-word, case, selective).
// ──────────────────────────────────────────────
import type {
  ActivationCondition,
  LorebookActivationSource,
  LorebookEntry,
  LorebookFilterMode,
  LorebookMatchingSource,
  LorebookSchedule,
} from "@marinara-engine/shared";
import { LIMITS, testPrimaryKeys, testSecondaryKeys } from "@marinara-engine/shared";
import { calibrateLorebookSimilarity } from "./embeddings.js";
import { vmRegexExecutor } from "./regex-timeout.js";

/** Compute cosine similarity between two vectors. Returns 0 for empty/mismatched vectors. */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    magA += a[i]! * a[i]!;
    magB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/** Minimal message shape needed for scanning. */
export interface ScanMessage {
  role: string;
  content: string;
}

/** Result of scanning: an activated entry plus metadata. */
export interface ActivatedEntry {
  entry: LorebookEntry;
  /** Original stored content when entry.content has been macro-expanded for scanning or budgeting. */
  rawContent?: string;
  /** Which key(s) matched */
  matchedKeys: string[];
  /** Every mechanism that activated this entry in this generation. */
  activationSources: LorebookActivationSource[];
  /** True when keyword or semantic activation reflects the current user context. */
  matchedCurrentContext?: boolean;
  /** Priority order for injection */
  injectionOrder: number;
  /** True when sticky state kept this entry active without a fresh keyword match */
  sticky?: boolean;
}

/** Runtime state for timing (sticky/cooldown/delay). */
export interface EntryTimingState {
  /** Message index when this entry was last activated */
  lastActivatedAt: number | null;
  /** How many consecutive messages it's been active (for sticky) */
  stickyCount: number;
  /** Messages since last activation (for cooldown) */
  cooldownRemaining: number;
  /** Delay messages remaining before first activation */
  delayRemaining: number;
}

type LorebookFilterValueContext = {
  activeCharacterIds: Set<string>;
  activeCharacterTags: Set<string>;
  generationTriggers: Set<string>;
};

/** Game state fields used for condition evaluation. */
export interface GameStateForScanning {
  location?: string | null;
  time?: string | null;
  date?: string | null;
  weather?: string | null;
  temperature?: string | null;
  presentCharacters?: Array<{ name: string; characterId: string }>;
  [key: string]: unknown;
}

/**
 * Evaluate activation conditions against game state.
 */
export function evaluateConditions(conditions: ActivationCondition[], gameState: GameStateForScanning | null): boolean {
  if (conditions.length === 0) return true;
  if (!gameState) return true; // No game state = conditions pass (permissive)

  for (const condition of conditions) {
    const fieldValue = String(gameState[condition.field] ?? "");

    switch (condition.operator) {
      case "equals":
        if (fieldValue.toLowerCase() !== condition.value.toLowerCase()) return false;
        break;
      case "not_equals":
        if (fieldValue.toLowerCase() === condition.value.toLowerCase()) return false;
        break;
      case "contains":
        if (!fieldValue.toLowerCase().includes(condition.value.toLowerCase())) return false;
        break;
      case "not_contains":
        if (fieldValue.toLowerCase().includes(condition.value.toLowerCase())) return false;
        break;
      case "gt": {
        const actual = Number.parseFloat(fieldValue);
        const expected = Number.parseFloat(condition.value);
        if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
        if (actual <= expected) return false;
        break;
      }
      case "lt": {
        const actual = Number.parseFloat(fieldValue);
        const expected = Number.parseFloat(condition.value);
        if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
        if (actual >= expected) return false;
        break;
      }
    }
  }

  return true;
}

/**
 * Evaluate schedule conditions against game state.
 */
function evaluateSchedule(schedule: LorebookSchedule | null, gameState: GameStateForScanning | null): boolean {
  if (!schedule) return true;
  if (!gameState) return true;

  // Check active times
  if (schedule.activeTimes.length > 0 && gameState.time) {
    const currentTime = String(gameState.time).toLowerCase();
    const matches = schedule.activeTimes.some((t) => currentTime.includes(t.toLowerCase()));
    if (!matches) return false;
  }

  // Check active dates
  if (schedule.activeDates.length > 0 && gameState.date) {
    const currentDate = String(gameState.date).toLowerCase();
    const matches = schedule.activeDates.some((d) => currentDate.includes(d.toLowerCase()));
    if (!matches) return false;
  }

  // Check active locations
  if (schedule.activeLocations.length > 0 && gameState.location) {
    const currentLoc = String(gameState.location).toLowerCase();
    const matches = schedule.activeLocations.some((l) => currentLoc.includes(l.toLowerCase()));
    if (!matches) return false;
  }

  return true;
}

/**
 * Check timing state (sticky/cooldown/delay).
 */
function checkTiming(entry: LorebookEntry, timingState: EntryTimingState | undefined): boolean {
  if (!timingState) return !(entry.delay !== null && entry.delay > 0);

  // Delay: must wait N messages before first activation
  if (entry.delay !== null && entry.delay > 0) {
    if (timingState.delayRemaining > 0) return false;
  }

  // Cooldown: wait N messages between activations
  if (entry.cooldown !== null && entry.cooldown > 0) {
    if (timingState.cooldownRemaining > 0) return false;
  }

  return true;
}

function passesContextualActivationGate(
  entry: LorebookEntry,
  filterContext: LorebookFilterValueContext,
  gameState: GameStateForScanning | null,
): boolean {
  if (!entry.enabled) return false;
  if (!passesEntryFilters(entry, filterContext)) return false;
  if (!evaluateConditions(entry.activationConditions, gameState)) return false;
  if (!evaluateSchedule(entry.schedule, gameState)) return false;
  return true;
}

function passesActivationGate(
  entry: LorebookEntry,
  timingState: EntryTimingState | undefined,
  filterContext: LorebookFilterValueContext,
  gameState: GameStateForScanning | null,
  ignoreTiming: boolean = false,
): boolean {
  if (!passesContextualActivationGate(entry, filterContext, gameState)) return false;
  if (!ignoreTiming && !checkTiming(entry, timingState)) return false;
  return true;
}

/** Apply non-keyword activation safeguards to an explicitly selected entry. */
export function passesForcedEntryActivationGates(entry: LorebookEntry, options: ScanOptions = {}): boolean {
  const filterContext: LorebookFilterValueContext = {
    activeCharacterIds: makeValueSet(options.activeCharacterIds),
    activeCharacterTags: makeValueSet(options.activeCharacterTags),
    generationTriggers: makeValueSet(
      options.generationTriggers && options.generationTriggers.length > 0 ? options.generationTriggers : ["chat"],
    ),
  };
  if (
    !passesActivationGate(
      entry,
      options.timingStates?.get(entry.id),
      filterContext,
      options.gameState ?? null,
      options.ignoreTiming,
    )
  ) {
    return false;
  }
  const existingDecision = options.probabilityDecisions?.get(entry.id);
  if (existingDecision !== undefined) return existingDecision;
  const passes = passesProbabilityGate(entry, options.random ?? Math.random);
  options.probabilityDecisions?.set(entry.id, passes);
  return passes;
}

function normalizeProbability(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : null;
  if (parsed === null || !Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, parsed));
}

function passesProbabilityGate(entry: LorebookEntry, random: () => number): boolean {
  const probability = normalizeProbability(entry.probability);
  if (probability === null || probability >= 100) return true;
  if (probability <= 0) return false;
  return random() * 100 < probability;
}

function hasTimingConfig(entry: LorebookEntry): boolean {
  return (
    (entry.sticky !== null && entry.sticky > 0) ||
    (entry.cooldown !== null && entry.cooldown > 0) ||
    (entry.delay !== null && entry.delay > 0)
  );
}

function cloneTimingState(state: EntryTimingState): EntryTimingState {
  return {
    lastActivatedAt: state.lastActivatedAt,
    stickyCount: state.stickyCount,
    cooldownRemaining: state.cooldownRemaining,
    delayRemaining: state.delayRemaining,
  };
}

function shouldPersistTimingState(entry: LorebookEntry, state: EntryTimingState): boolean {
  if (state.stickyCount > 0 || state.cooldownRemaining > 0 || state.delayRemaining > 0) return true;
  if (entry.delay !== null && entry.delay > 0) return true;
  return false;
}

export function updateTimingStatesForScan(
  entries: LorebookEntry[],
  activatedEntries: ActivatedEntry[],
  previousStates: Map<string, EntryTimingState> = new Map(),
  currentMessageIndex: number,
): Map<string, EntryTimingState> {
  const nextStates = new Map<string, EntryTimingState>();
  const activatedById = new Map(activatedEntries.map((entry) => [entry.entry.id, entry]));

  for (const entry of entries) {
    if (!hasTimingConfig(entry)) continue;
    const previous = previousStates.get(entry.id);
    const state: EntryTimingState = previous
      ? cloneTimingState(previous)
      : {
          lastActivatedAt: null,
          stickyCount: 0,
          cooldownRemaining: 0,
          delayRemaining: entry.delay !== null && entry.delay > 0 ? entry.delay : 0,
        };

    const activated = activatedById.get(entry.id);
    if (activated && !activated.sticky) {
      state.lastActivatedAt = currentMessageIndex;
      state.stickyCount = entry.sticky !== null && entry.sticky > 0 ? entry.sticky : 0;
      state.cooldownRemaining = entry.cooldown !== null && entry.cooldown > 0 ? entry.cooldown : 0;
      state.delayRemaining = 0;
    } else {
      if (state.delayRemaining > 0) state.delayRemaining -= 1;
      if (state.stickyCount > 0) {
        state.stickyCount -= 1;
      } else if (state.cooldownRemaining > 0) {
        state.cooldownRemaining -= 1;
      }
    }

    if (shouldPersistTimingState(entry, state)) {
      nextStates.set(entry.id, state);
    }
  }

  return nextStates;
}

function normalizeFilterValue(value: string) {
  return value.trim().toLowerCase();
}

function makeValueSet(values: string[] | undefined) {
  return new Set((values ?? []).map(normalizeFilterValue).filter(Boolean));
}

function passesValueFilter(
  mode: LorebookFilterMode | undefined,
  filters: string[] | undefined,
  activeValues: Set<string>,
) {
  const normalizedMode = mode ?? "any";
  const filterValues = makeValueSet(filters);
  if (normalizedMode === "any" || filterValues.size === 0) return true;
  const hasMatch = Array.from(filterValues).some((value) => activeValues.has(value));
  return normalizedMode === "include" ? hasMatch : !hasMatch;
}

function passesEntryFilters(entry: LorebookEntry, context: LorebookFilterValueContext) {
  return (
    passesValueFilter(entry.characterFilterMode, entry.characterFilterIds, context.activeCharacterIds) &&
    passesValueFilter(entry.characterTagFilterMode, entry.characterTagFilters, context.activeCharacterTags) &&
    passesValueFilter(entry.generationTriggerFilterMode, entry.generationTriggerFilters, context.generationTriggers)
  );
}

export function lorebookEntryPassesContextFilters(
  entry: LorebookEntry,
  options: { activeCharacterIds?: string[]; activeCharacterTags?: string[]; generationTriggers?: string[] },
) {
  return passesEntryFilters(entry, {
    activeCharacterIds: makeValueSet(options.activeCharacterIds),
    activeCharacterTags: makeValueSet(options.activeCharacterTags),
    generationTriggers: makeValueSet(options.generationTriggers?.length ? options.generationTriggers : ["chat"]),
  });
}

function getAdditionalMatchingText(entry: LorebookEntry, sourceText: Partial<Record<LorebookMatchingSource, string>>) {
  if (!entry.additionalMatchingSources?.length) return "";
  return entry.additionalMatchingSources
    .map((source) => sourceText[source]?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
}

/**
 * Group-based selection: within a group, only activate entries up to weight limits.
 */
function getGroupWeight(entry: ActivatedEntry): number {
  const weight = Number(entry.entry.groupWeight ?? 100);
  return Number.isFinite(weight) && weight > 0 ? weight : 0;
}

function pickWeightedGroupEntry(entries: ActivatedEntry[], random: () => number): ActivatedEntry | null {
  if (entries.length === 0) return null;
  const totalWeight = entries.reduce((total, entry) => total + getGroupWeight(entry), 0);
  if (totalWeight <= 0) {
    return [...entries].sort((a, b) => a.entry.order - b.entry.order)[0] ?? null;
  }

  let roll = random() * totalWeight;
  for (const entry of entries) {
    roll -= getGroupWeight(entry);
    if (roll <= 0) return entry;
  }
  return entries[entries.length - 1] ?? null;
}

function applyGroupSelection(entries: ActivatedEntry[], random: () => number): ActivatedEntry[] {
  const grouped = new Map<string, ActivatedEntry[]>();
  const ungrouped: ActivatedEntry[] = [];

  for (const entry of entries) {
    const group = entry.entry.group;
    if (group) {
      const list = grouped.get(group) ?? [];
      list.push(entry);
      grouped.set(group, list);
    } else {
      ungrouped.push(entry);
    }
  }

  const result: ActivatedEntry[] = [...ungrouped];

  for (const [, groupEntries] of grouped) {
    const selected = pickWeightedGroupEntry(groupEntries, random);
    if (selected) result.push(selected);
  }

  return result;
}

export interface ScanOptions {
  /** How many messages back to scan (0 = all). */
  scanDepth?: number;
  /** Current game state for condition evaluation. */
  gameState?: GameStateForScanning | null;
  /** Timing state map (entryId → state). */
  timingStates?: Map<string, EntryTimingState>;
  /** Current message index for timing calculations. */
  currentMessageIndex?: number;
  /** Pre-computed embedding of the chat context for semantic matching fallback. */
  chatEmbedding?: number[] | null;
  /** Per-lorebook chat context embeddings for semantic matching. */
  semanticEmbeddingsByLorebookId?: ReadonlyMap<string, number[] | null>;
  /** Cosine similarity threshold for semantic matching (0-1, default 0.3). */
  semanticThreshold?: number;
  /** Unrelated-text cosine floor used to calibrate clustered embedding models. */
  semanticSimilarityBaseline?: number;
  /** Per-lorebook cosine similarity thresholds for semantic matching. */
  semanticThresholdByLorebookId?: ReadonlyMap<string, number>;
  /** Per-lorebook maximum semantic matches. */
  semanticMaxMatchesByLorebookId?: ReadonlyMap<string, number>;
  /** Active character IDs for per-entry include/exclude gates. */
  activeCharacterIds?: string[];
  /** Tags from active character cards for per-entry include/exclude gates. */
  activeCharacterTags?: string[];
  /** Generation trigger names for per-entry include/exclude gates. */
  generationTriggers?: string[];
  /** Extra source text entries may opt into scanning. */
  additionalMatchingSourceText?: Partial<Record<LorebookMatchingSource, string>>;
  /** Opening messages that should remain scannable even when recent-message depth trims them out. */
  pinnedScanMessages?: ScanMessage[];
  /** Ignore sticky/cooldown/delay runtime state for preview/debug scans. */
  ignoreTiming?: boolean;
  /** True while scanning content surfaced by a prior lorebook activation. */
  recursionPass?: boolean;
  /** Shared per-generation probability rolls, including recursive scan passes. */
  probabilityDecisions?: Map<string, boolean>;
  /** Random source for probability gates; injectable for deterministic tests. */
  random?: () => number;
}

/**
 * Main scanning function: given messages and lorebook entries,
 * returns the list of activated entries.
 */
export function scanForActivatedEntries(
  messages: ScanMessage[],
  entries: LorebookEntry[],
  options: ScanOptions = {},
): ActivatedEntry[] {
  const {
    scanDepth = 0,
    gameState = null,
    timingStates = new Map(),
    currentMessageIndex = messages.length,
    chatEmbedding = null,
    semanticEmbeddingsByLorebookId = new Map<string, number[] | null>(),
    semanticThreshold = 0.3,
    semanticSimilarityBaseline = 0,
    semanticThresholdByLorebookId = new Map<string, number>(),
    semanticMaxMatchesByLorebookId = new Map<string, number>(),
    activeCharacterIds = [],
    activeCharacterTags = [],
    generationTriggers = ["chat"],
    additionalMatchingSourceText = {},
    pinnedScanMessages = [],
    ignoreTiming = false,
    recursionPass = false,
    probabilityDecisions = new Map<string, boolean>(),
    random = Math.random,
  } = options;
  const filterContext: LorebookFilterValueContext = {
    activeCharacterIds: makeValueSet(activeCharacterIds),
    activeCharacterTags: makeValueSet(activeCharacterTags),
    generationTriggers: makeValueSet(generationTriggers.length > 0 ? generationTriggers : ["chat"]),
  };

  const pinnedScanText = pinnedScanMessages
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n");
  const appendPinnedScanText = (baseText: string, includePinned: boolean = true) => {
    if (!includePinned || !pinnedScanText) return baseText;
    return baseText ? `${baseText}\n${pinnedScanText}` : pinnedScanText;
  };

  // Build the text to scan from recent messages
  const messagesToScan = scanDepth > 0 ? messages.slice(-scanDepth) : messages;
  const combinedText = appendPinnedScanText(messagesToScan.map((m) => m.content).join("\n"));
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const latestUserText = latestUserMessage?.content ?? "";

  const activated: ActivatedEntry[] = [];
  const activatedIds = new Set<string>();
  const passesEntryProbability = (entry: LorebookEntry) => {
    const existing = probabilityDecisions.get(entry.id);
    if (existing !== undefined) return existing;
    const passes = passesProbabilityGate(entry, random);
    probabilityDecisions.set(entry.id, passes);
    return passes;
  };
  const getEntryScanText = (entry: LorebookEntry) => {
    // Per-entry scan depth:
    //   0    = explicit "scan all" (deliberate user choice) — scan full history
    //   > 0  = scan that many recent messages
    //   null = inherit the bounded global default (combinedText)
    const baseEntryScanText =
      entry.scanDepth === 0
        ? appendPinnedScanText(messages.map((m) => m.content).join("\n"), false)
        : entry.scanDepth !== null && entry.scanDepth > 0
          ? appendPinnedScanText(
              messages
                .slice(-entry.scanDepth)
                .map((m) => m.content)
                .join("\n"),
            )
          : combinedText;
    const extraMatchingText = getAdditionalMatchingText(entry, additionalMatchingSourceText);
    return extraMatchingText ? `${baseEntryScanText}\n${extraMatchingText}` : baseEntryScanText;
  };

  for (const entry of entries) {
    if (entry.delayUntilRecursion && !recursionPass) continue;
    if (entry.excludeRecursion && recursionPass) continue;

    const timingState = timingStates.get(entry.id);

    if (!ignoreTiming && timingState?.stickyCount && timingState.stickyCount > 0) {
      if (!passesContextualActivationGate(entry, filterContext, gameState)) continue;
      activated.push({
        entry,
        matchedKeys: ["[sticky]"],
        injectionOrder: entry.order,
        activationSources: ["sticky"],
        sticky: true,
      });
      activatedIds.add(entry.id);
      continue;
    }

    if (!passesActivationGate(entry, timingState, filterContext, gameState, ignoreTiming)) continue;

    // Constant entries still activate without keywords, but they obey timing,
    // context filters, activation conditions, schedule, and probability gates.
    if (entry.constant) {
      if (!passesEntryProbability(entry)) continue;
      activated.push({
        entry,
        matchedKeys: ["[constant]"],
        injectionOrder: entry.order,
        activationSources: [recursionPass ? "recursive" : "constant"],
      });
      activatedIds.add(entry.id);
      continue;
    }

    const entryScanText = getEntryScanText(entry);
    const matchOptions = {
      useRegex: entry.useRegex,
      matchWholeWords: entry.matchWholeWords,
      caseSensitive: entry.caseSensitive,
      regexExecutor: vmRegexExecutor,
    };

    // Test primary keys
    const { matched, matchedKeys } = testPrimaryKeys(entry.keys, entryScanText, matchOptions);
    if (!matched) continue;
    const matchedCurrentContext =
      latestUserText.length > 0 ? testPrimaryKeys(entry.keys, latestUserText, matchOptions).matched : false;

    // Test secondary keys (selective mode)
    if (entry.selective && entry.secondaryKeys.length > 0) {
      if (!testSecondaryKeys(entry.secondaryKeys, entryScanText, entry.selectiveLogic, matchOptions)) {
        continue;
      }
    }

    if (!passesEntryProbability(entry)) continue;

    activated.push({
      entry,
      matchedKeys,
      matchedCurrentContext,
      activationSources: [recursionPass ? "recursive" : "keyword"],
      injectionOrder: entry.order,
    });
    activatedIds.add(entry.id);
  }

  // ── Semantic matching: add vector matches that weren't already activated ──
  if (
    (chatEmbedding && chatEmbedding.length > 0) ||
    Array.from(semanticEmbeddingsByLorebookId.values()).some((embedding) => embedding && embedding.length > 0)
  ) {
    const semanticCandidates: Array<{ entry: LorebookEntry; similarity: number }> = [];

    for (const entry of entries) {
      if (!entry.enabled || entry.constant || activatedIds.has(entry.id)) continue;
      if (entry.delayUntilRecursion && !recursionPass) continue;
      if (entry.excludeRecursion && recursionPass) continue;
      if (entry.excludeFromVectorization) continue;
      if (!entry.embedding || entry.embedding.length === 0) continue;
      const queryEmbedding = semanticEmbeddingsByLorebookId.get(entry.lorebookId) ?? chatEmbedding;
      if (!queryEmbedding || queryEmbedding.length === 0) continue;
      const timingState = timingStates.get(entry.id);
      if (!passesActivationGate(entry, timingState, filterContext, gameState, ignoreTiming)) continue;

      const threshold = semanticThresholdByLorebookId.get(entry.lorebookId) ?? semanticThreshold;
      const similarity = calibrateLorebookSimilarity(
        cosineSimilarity(queryEmbedding, entry.embedding),
        semanticSimilarityBaseline,
      );
      if (similarity >= threshold) {
        const entryScanText = getEntryScanText(entry);
        const matchOptions = {
          useRegex: entry.useRegex,
          matchWholeWords: entry.matchWholeWords,
          caseSensitive: entry.caseSensitive,
          regexExecutor: vmRegexExecutor,
        };
        if (
          entry.selective &&
          entry.secondaryKeys.length > 0 &&
          !testSecondaryKeys(entry.secondaryKeys, entryScanText, entry.selectiveLogic, matchOptions)
        ) {
          continue;
        }
        if (!passesEntryProbability(entry)) continue;
        semanticCandidates.push({ entry, similarity });
      }
    }

    const semanticCountsByLorebookId = new Map<string, number>();
    for (const candidate of semanticCandidates.sort((a, b) => b.similarity - a.similarity)) {
      const lorebookId = candidate.entry.lorebookId;
      const maxMatches = semanticMaxMatchesByLorebookId.get(lorebookId) ?? LIMITS.LOREBOOK_VECTOR_MAX_RESULTS_DEFAULT;
      const selectedCount = semanticCountsByLorebookId.get(lorebookId) ?? 0;
      if (selectedCount >= maxMatches) continue;
      activated.push({
        entry: candidate.entry,
        matchedKeys: [`[semantic:${candidate.similarity.toFixed(3)}]`],
        // Semantic candidates describe the same current scan context as a key
        // matched in the latest user turn. Giving both this marker keeps the
        // budget selector neutral between keyword and vector activation.
        matchedCurrentContext: latestUserText.length > 0,
        injectionOrder: candidate.entry.order,
        activationSources: [recursionPass ? "recursive" : "semantic"],
      });
      activatedIds.add(candidate.entry.id);
      semanticCountsByLorebookId.set(lorebookId, selectedCount + 1);
    }
  }

  // Apply group selection
  const afterGroups = applyGroupSelection(activated, random);

  // Sort by injection order (lower = higher priority)
  afterGroups.sort((a, b) => a.injectionOrder - b.injectionOrder);

  return afterGroups;
}

/**
 * Recursive scanning: re-scan activated entry content for additional matches.
 */
export function recursiveScan(
  messages: ScanMessage[],
  entries: LorebookEntry[],
  options: ScanOptions = {},
  maxDepth: number = 3,
): ActivatedEntry[] {
  const probabilityDecisions = options.probabilityDecisions ?? new Map<string, boolean>();
  const scanOptions = { ...options, probabilityDecisions };
  const allActivated = scanForActivatedEntries(messages, entries, scanOptions);
  const activatedIds = new Set(allActivated.map((a) => a.entry.id));
  let newlyActivated = allActivated;

  for (let depth = 0; depth < maxDepth; depth++) {
    // Build text from newly activated entries, excluding those with preventRecursion
    const newContent = newlyActivated
      .filter((a) => !a.entry.preventRecursion)
      .map((a) => a.entry.content)
      .join("\n");

    if (!newContent) break;

    // Scan remaining entries against the content of activated entries
    const remaining = entries.filter((e) => !activatedIds.has(e.id) && !e.excludeRecursion);
    const newMessages: ScanMessage[] = [{ role: "system", content: newContent }];
    const newActivated = scanForActivatedEntries(newMessages, remaining, {
      ...scanOptions,
      pinnedScanMessages: [],
      chatEmbedding: null,
      recursionPass: true,
    });

    if (newActivated.length === 0) break;

    newlyActivated = [];
    for (const a of newActivated) {
      activatedIds.add(a.entry.id);
      allActivated.push(a);
      newlyActivated.push(a);
    }
  }

  return allActivated;
}
