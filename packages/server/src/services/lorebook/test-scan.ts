// ──────────────────────────────────────────────
// Lorebook: Test Scan
// Answers "which entries of this lorebook would fire on this text, and why"
// by running the real scanner (scanForActivatedEntries / recursiveScan), so
// the editor's test tool cannot drift from generation. Timing state is
// ignored and chance rolls always succeed; entries whose keys matched but
// that a gate held back are reported separately with the reason.
// ──────────────────────────────────────────────
import {
  LIMITS,
  collectEffectivelyDisabledFolderIds,
  testPrimaryKeys,
  testSecondaryKeys,
  type Lorebook,
  type LorebookActivationSource,
  type LorebookEntry,
  type LorebookFolder,
} from "@marinara-engine/shared";
import { applyLorebookDefaults } from "./index.js";
import {
  lorebookEntryPassesContextFilters,
  recursiveScan,
  scanForActivatedEntries,
  type ActivatedEntry,
  type ScanMessage,
  type ScanOptions,
} from "./keyword-scanner.js";
import { vmRegexExecutor } from "./regex-timeout.js";

export type LorebookTestBlockReason =
  | "secondary_keys"
  | "filters"
  | "conditions"
  | "group"
  | "probability"
  | "recursion_only"
  | "folder_disabled"
  // F2: the entry matched and would have fired, but the last real generation's token budget left
  // it out. Set by the `testscan` handler (mari-db.service.ts), never by the scanner itself.
  | "budget";

export interface LorebookTestActivatedEntry {
  entryId: string;
  name: string;
  matchedKeys: string[];
  activationSources: LorebookActivationSource[];
  /** Entries whose content contains a key of this recursively activated entry. */
  triggeredBy: string[];
  /** Set when the entry fires only by chance (probability below 100). */
  probability: number | null;
}

export interface LorebookTestBlockedEntry {
  entryId: string;
  name: string;
  matchedKeys: string[];
  reason: LorebookTestBlockReason;
  /** Only set for `reason: "budget"`, from the last real generation's lorebook scan. */
  estimatedTokens?: number;
  lorebookBudget?: number;
  lorebookUsedTokens?: number;
}

export interface LorebookTestScanResult {
  activated: LorebookTestActivatedEntry[];
  blocked: LorebookTestBlockedEntry[];
  recursive: boolean;
  scannedMessages: number;
}

export interface LorebookTestScanInput {
  lorebook: Pick<Lorebook, "id" | "scanDepth" | "recursiveScanning" | "maxRecursionDepth">;
  entries: LorebookEntry[];
  folders?: Pick<LorebookFolder, "id" | "parentFolderId" | "enabled">[];
  messages: ScanMessage[];
  activeCharacterIds?: string[];
  activeCharacterTags?: string[];
  generationTriggers?: string[];
}

function matchOptions(entry: LorebookEntry) {
  return {
    useRegex: entry.useRegex,
    matchWholeWords: entry.matchWholeWords,
    caseSensitive: entry.caseSensitive,
    regexExecutor: vmRegexExecutor,
  };
}

function normalizedProbability(entry: LorebookEntry): number | null {
  const value = typeof entry.probability === "number" ? entry.probability : null;
  if (value === null || !Number.isFinite(value) || value >= 100) return null;
  return Math.max(0, value);
}

export function runLorebookTestScan(input: LorebookTestScanInput): LorebookTestScanResult {
  const disabledFolderIds = collectEffectivelyDisabledFolderIds(input.folders ?? []);
  const inDisabledFolder = (entry: LorebookEntry) => !!entry.folderId && disabledFolderIds.has(entry.folderId);
  const entries = applyLorebookDefaults(
    input.entries.filter((entry) => !inDisabledFolder(entry)),
    new Map([[input.lorebook.id, input.lorebook]]),
  );
  const generationTriggers = input.generationTriggers?.length ? input.generationTriggers : ["chat"];
  const options: ScanOptions = {
    scanDepth: LIMITS.LOREBOOK_DEFAULT_SCAN_DEPTH,
    activeCharacterIds: input.activeCharacterIds ?? [],
    activeCharacterTags: input.activeCharacterTags ?? [],
    generationTriggers,
    ignoreTiming: true,
    // Chance rolls always succeed; the result flags chance-based entries instead.
    random: () => 0,
  };
  const recursive = input.lorebook.recursiveScanning === true;
  const activated: ActivatedEntry[] = recursive
    ? recursiveScan(input.messages, entries, options, Math.max(1, input.lorebook.maxRecursionDepth ?? 3))
    : scanForActivatedEntries(input.messages, entries, options);

  const activatedIds = new Set(activated.map((item) => item.entry.id));
  const recursionSources = activated.filter(
    (item) => !item.entry.preventRecursion && !item.activationSources.includes("recursive"),
  );

  const activatedResult = activated.map((item): LorebookTestActivatedEntry => {
    const triggeredBy = item.activationSources.includes("recursive")
      ? activated
          .filter(
            (source) =>
              source.entry.id !== item.entry.id &&
              !source.entry.preventRecursion &&
              testPrimaryKeys(item.entry.keys, source.entry.content, matchOptions(item.entry)).matched,
          )
          .map((source) => source.entry.id)
      : [];
    return {
      entryId: item.entry.id,
      name: item.entry.name,
      matchedKeys: item.matchedKeys,
      activationSources: item.activationSources,
      triggeredBy,
      probability: normalizedProbability(item.entry),
    };
  });

  // Keys that matched but did not activate: report the first gate that held the entry back.
  // Each entry is checked against the window the scanner gave it: its own scan
  // depth (defaulted from the lorebook), 0 for the whole history, else the default.
  const windowTextByDepth = new Map<number, string>();
  const windowTextFor = (depth: number) => {
    let text = windowTextByDepth.get(depth);
    if (text === undefined) {
      const scanned = depth > 0 ? input.messages.slice(-depth) : input.messages;
      text = scanned.map((message) => message.content).join("\n");
      windowTextByDepth.set(depth, text);
    }
    return text;
  };
  const defaultedById = new Map(entries.map((entry) => [entry.id, entry]));
  const recursionText = recursive ? recursionSources.map((item) => item.entry.content).join("\n") : "";
  const groupsWon = new Set(activated.map((item) => item.entry.group).filter(Boolean));
  const blocked: LorebookTestBlockedEntry[] = [];
  for (const rawEntry of input.entries) {
    const entry = defaultedById.get(rawEntry.id) ?? rawEntry;
    if (activatedIds.has(entry.id) || !entry.enabled || entry.constant) continue;
    const depth =
      typeof entry.scanDepth === "number" && entry.scanDepth >= 0
        ? entry.scanDepth
        : LIMITS.LOREBOOK_DEFAULT_SCAN_DEPTH;
    const text = windowTextFor(depth);
    const options = matchOptions(entry);
    let { matched, matchedKeys } = testPrimaryKeys(entry.keys, text, options);
    let recursionMatch = false;
    if (!matched && recursionText) {
      ({ matched, matchedKeys } = testPrimaryKeys(entry.keys, recursionText, options));
      recursionMatch = matched;
    }
    if (!matched) continue;
    let reason: LorebookTestBlockReason;
    if (inDisabledFolder(entry)) reason = "folder_disabled";
    else if (entry.delayUntilRecursion && !recursionMatch) reason = "recursion_only";
    else if (
      entry.selective &&
      entry.secondaryKeys.length > 0 &&
      !testSecondaryKeys(entry.secondaryKeys, recursionMatch ? recursionText : text, entry.selectiveLogic, options)
    )
      reason = "secondary_keys";
    else if (
      !lorebookEntryPassesContextFilters(entry, {
        activeCharacterIds: input.activeCharacterIds,
        activeCharacterTags: input.activeCharacterTags,
        generationTriggers,
      })
    )
      reason = "filters";
    else if (normalizedProbability(entry) === 0) reason = "probability";
    else if (entry.group && groupsWon.has(entry.group)) reason = "group";
    else reason = "conditions";
    blocked.push({ entryId: entry.id, name: entry.name, matchedKeys, reason });
  }

  return {
    activated: activatedResult,
    blocked,
    recursive,
    scannedMessages: input.messages.length,
  };
}
