/**
 * The empty omnibar (slice 78): one "Now" row from state the app already has, three
 * "Try" examples until each kind of use has happened once, and a Continue strip.
 * Pure helpers plus the one local store the Try rows need; no hooks.
 */
import type { OmnibarTranslate } from "./omnibar-entity-rows";
import type { OmnibarResult } from "./omnibar-search";

export type OmnibarTryKind = "search" | "command" | "mari";
export type OmnibarNowKind = "review" | "fix" | "check" | "working" | "finished" | "setup";

export interface OmnibarTryState {
  /** When each kind was first used; a used kind's Try row never comes back. */
  used: Partial<Record<OmnibarTryKind, number>>;
  /** Omnibar opens while any Try row was showing. */
  opens: number;
}

export const OMNIBAR_TRY_STORAGE_KEY = "marinara:omnibar:try:v1";
/** After this many opens the Try group stops showing, used or not: a hint, never a nag. */
export const OMNIBAR_TRY_MAX_OPENS = 15;
const TRY_KINDS: readonly OmnibarTryKind[] = ["search", "command", "mari"];

interface TryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): TryStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function normalizeOmnibarTryState(value: unknown): OmnibarTryState {
  const source = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const usedSource =
    source.used && typeof source.used === "object" && !Array.isArray(source.used)
      ? (source.used as Record<string, unknown>)
      : {};
  const used: OmnibarTryState["used"] = {};
  for (const kind of TRY_KINDS) {
    const at = usedSource[kind];
    if (typeof at === "number" && Number.isFinite(at) && at >= 0) used[kind] = at;
  }
  const opens = typeof source.opens === "number" && Number.isFinite(source.opens) ? Math.max(0, source.opens) : 0;
  return { used, opens: Math.floor(opens) };
}

export function readOmnibarTryState(storage: TryStorage | null = browserStorage()): OmnibarTryState {
  try {
    return normalizeOmnibarTryState(JSON.parse(storage?.getItem(OMNIBAR_TRY_STORAGE_KEY) ?? "null"));
  } catch {
    return normalizeOmnibarTryState(null);
  }
}

function writeOmnibarTryState(state: OmnibarTryState, storage: TryStorage | null = browserStorage()) {
  try {
    storage?.setItem(OMNIBAR_TRY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full quota: the rows just stay a little longer.
  }
}

/** Records the first use of a kind; later uses change nothing. */
export function markOmnibarTryUsed(
  kind: OmnibarTryKind,
  now = Date.now(),
  storage: TryStorage | null = browserStorage(),
): OmnibarTryState {
  const state = readOmnibarTryState(storage);
  if (state.used[kind] !== undefined) return state;
  const next = { ...state, used: { ...state.used, [kind]: now } };
  writeOmnibarTryState(next, storage);
  return next;
}

/** Counts one open toward the stop rule. Call once per open, only while Try rows show. */
export function countOmnibarTryOpen(storage: TryStorage | null = browserStorage()): OmnibarTryState {
  const state = readOmnibarTryState(storage);
  const next = { ...state, opens: state.opens + 1 };
  writeOmnibarTryState(next, storage);
  return next;
}

/** The Try kinds still to show, in their fixed order: search, command, Mari. */
export function visibleOmnibarTryKinds(
  state: OmnibarTryState,
  { enabled, mariEnabled }: { enabled: boolean; mariEnabled: boolean },
): OmnibarTryKind[] {
  if (!enabled || state.opens >= OMNIBAR_TRY_MAX_OPENS) return [];
  return TRY_KINDS.filter((kind) => state.used[kind] === undefined && (kind !== "mari" || mariEnabled));
}

export interface OmnibarTryExamples {
  search: string;
  command: string;
  mari: string;
}

/** One example row per kind. Picking one only writes the example into the field (refine-query); nothing runs. */
export function buildOmnibarTryResults(
  kinds: readonly OmnibarTryKind[],
  examples: OmnibarTryExamples,
  t: OmnibarTranslate,
): OmnibarResult[] {
  const titles: Record<OmnibarTryKind, string> = {
    search: t("commandCenter.try.search", "Search by name"),
    command: t("commandCenter.try.command", "Change a setting"),
    mari: t("commandCenter.try.mari", "Ask Prof. Mari a question"),
  };
  return kinds.map((kind) => ({
    id: `try:${kind}`,
    title: titles[kind],
    description: t("commandCenter.try.example", "Try “{{example}}”", { example: examples[kind] }),
    category: kind === "mari" ? "professor" : kind === "command" ? "settings" : "navigation",
    group: "try",
    score: 0,
    kind: "action",
    icon: kind === "mari" ? "professor" : kind === "command" ? "settings" : "command",
    action: { kind: "refine-query" as const, query: examples[kind] },
  }));
}

/**
 * The one row that needs the user now, first match wins: Mari waiting on a review, a
 * failed request, a cut-off reply, Mari working, Mari finished, then no model at all.
 * Every candidate is a row the omnibar already builds, so picking it runs the same thing.
 */
export function pickOmnibarNowResult({
  mariRow,
  pendingApprovals,
  mariActive,
  mariFinished,
  fixRow,
  checkupRow,
  setupRow,
}: {
  /** The existing "continue with Mari" row; it already reads approvals, working and finished. */
  mariRow: OmnibarResult | null;
  pendingApprovals: number;
  mariActive: boolean;
  mariFinished: boolean;
  fixRow: OmnibarResult | null;
  checkupRow: OmnibarResult | null;
  setupRow: OmnibarResult | null;
}): OmnibarResult | null {
  const candidates: [OmnibarNowKind, OmnibarResult | null][] = [
    ["review", pendingApprovals > 0 ? mariRow : null],
    ["fix", fixRow],
    ["check", checkupRow],
    ["working", mariActive ? mariRow : null],
    ["finished", mariFinished ? mariRow : null],
    ["setup", setupRow],
  ];
  const hit = candidates.find(([, row]) => row);
  return hit ? { ...hit[1]!, now: hit[0] } : null;
}

type Timestamped = { id: string; createdAt?: unknown; updatedAt?: unknown };

/**
 * The record the user edited last (the caller passes characters, personas, lorebooks). A record
 * only counts once it changed after it was created, so a fresh import or a built-in
 * default never shows up as "edited".
 */
export function lastEditedRecordId(lists: readonly [string, readonly unknown[] | undefined][]): string | null {
  let best: { id: string; at: number } | null = null;
  for (const [kind, list] of lists) {
    for (const value of list ?? []) {
      const row = value as Timestamped;
      if (!row || typeof row.id !== "string" || typeof row.updatedAt !== "string") continue;
      const updated = Date.parse(row.updatedAt);
      const created = typeof row.createdAt === "string" ? Date.parse(row.createdAt) : Number.NaN;
      if (!Number.isFinite(updated) || !(updated - created > 1000)) continue;
      if (!best || updated > best.at) best = { id: `${kind}:${row.id}`, at: updated };
    }
  }
  return best?.id ?? null;
}

const COMMAND_ACTIONS = new Set<NonNullable<OmnibarResult["action"]>["kind"]>([
  "slash",
  "add-to-chat",
  "detach-from-chat",
  "open-chat-tool",
  "start-chat",
  "start-character-chat",
  "create-named",
  "personal-extension",
]);

/** Whether a typed pick did something (a command) rather than found something (a search). */
export function isOmnibarCommandPick(result: Pick<OmnibarResult, "action" | "control" | "chooseValue">): boolean {
  return Boolean(result.control || result.chooseValue || (result.action && COMMAND_ACTIONS.has(result.action.kind)));
}
