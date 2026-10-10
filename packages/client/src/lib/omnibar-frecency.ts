/**
 * Local frecency for the omnibar (O2): which results you actually run, per
 * surface, kept only in `localStorage` — nothing here ever leaves the device.
 * One (resultId, surface, timestamp) tuple per activation, capped, scored with
 * a half-life decay so frequency and recency both matter, neither alone.
 */
import type { OmnibarSurface } from "./omnibar-search";

export interface OmnibarFrecencyEntry {
  resultId: string;
  surface: OmnibarSurface;
  timestamp: number;
}

export const OMNIBAR_FRECENCY_STORAGE_KEY = "marinara:omnibar:frecency:v1";
const MAX_FRECENCY_ENTRIES = 300;
const MAX_RESULT_ID_LENGTH = 256;
const KNOWN_SURFACES = new Set<OmnibarSurface>(["home", "chat", "editor", "settings", "library", "game"]);
/** Each use's weight halves every week: a row used often last month and one used once an hour ago can both win. */
const FRECENCY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;
const FRECENCY_BOOST_SCALE = 6;
/**
 * Caps the nudge well under the lowest exact-name-match tier (300+, see
 * `scoreText` in omnibar-search.ts): frecency can break a tie or lift a weak
 * fuzzy hit, but 15 points can never cross a gap that size.
 */
export const FRECENCY_BOOST_CAP = 15;
/** Her row's position is a fixed rule (O2), never a ranking outcome: never recorded, scored, or bucketed by use. */
export const FRECENCY_EXCLUDED_RESULT_IDS: ReadonlySet<string> = new Set(["ask-professor-mari"]);

interface FrecencyStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getBrowserStorage(): FrecencyStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeEntry(value: unknown): OmnibarFrecencyEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const resultId = typeof source.resultId === "string" ? source.resultId.trim().slice(0, MAX_RESULT_ID_LENGTH) : "";
  const surface = KNOWN_SURFACES.has(source.surface as OmnibarSurface) ? (source.surface as OmnibarSurface) : null;
  const timestamp =
    typeof source.timestamp === "number" && Number.isFinite(source.timestamp) && source.timestamp >= 0
      ? Math.floor(source.timestamp)
      : null;
  if (!resultId || !surface || timestamp === null || FRECENCY_EXCLUDED_RESULT_IDS.has(resultId)) return null;
  return { resultId, surface, timestamp };
}

/** Oldest-evicted cap at {@link MAX_FRECENCY_ENTRIES}; exported so the regression can pin the eviction order. */
export function normalizeOmnibarFrecencyEntries(value: unknown): OmnibarFrecencyEntry[] {
  const list = Array.isArray(value) ? value : [];
  return list
    .map(normalizeEntry)
    .filter((entry): entry is OmnibarFrecencyEntry => entry !== null)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-MAX_FRECENCY_ENTRIES);
}

export function readOmnibarFrecencyEntries(
  storage: FrecencyStorage | null = getBrowserStorage(),
): OmnibarFrecencyEntry[] {
  if (!storage) return [];
  try {
    return normalizeOmnibarFrecencyEntries(JSON.parse(storage.getItem(OMNIBAR_FRECENCY_STORAGE_KEY) ?? "null"));
  } catch {
    return [];
  }
}

function writeOmnibarFrecencyEntries(
  entries: readonly OmnibarFrecencyEntry[],
  storage: FrecencyStorage | null = getBrowserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(OMNIBAR_FRECENCY_STORAGE_KEY, JSON.stringify(normalizeOmnibarFrecencyEntries(entries)));
    return true;
  } catch {
    return false;
  }
}

/** Records one activation. A no-op for Mari's row (O2: never recorded). Returns the updated list to store in state. */
export function recordOmnibarFrecencyUse(
  resultId: string,
  surface: OmnibarSurface,
  now = Date.now(),
  storage: FrecencyStorage | null = getBrowserStorage(),
): OmnibarFrecencyEntry[] {
  if (FRECENCY_EXCLUDED_RESULT_IDS.has(resultId)) return readOmnibarFrecencyEntries(storage);
  const next = normalizeOmnibarFrecencyEntries([
    ...readOmnibarFrecencyEntries(storage),
    { resultId, surface, timestamp: now },
  ]);
  writeOmnibarFrecencyEntries(next, storage);
  return next;
}

/** The "Clear search history" control: forgets every recorded use, on this device only. */
export function clearOmnibarFrecencyHistory(storage: FrecencyStorage | null = getBrowserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(OMNIBAR_FRECENCY_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function decayWeight(ageMs: number): number {
  return Math.pow(2, -Math.max(0, ageMs) / FRECENCY_HALF_LIFE_MS);
}

/**
 * Classic frecency: sums a decaying weight per past use of this result on this
 * surface. Ten uses a month ago and one use an hour ago can each come out
 * ahead — frequency and recency both feed the same number.
 */
export function frecencyScore(
  entries: readonly OmnibarFrecencyEntry[],
  resultId: string,
  surface: OmnibarSurface,
  now = Date.now(),
): number {
  if (FRECENCY_EXCLUDED_RESULT_IDS.has(resultId)) return 0;
  let score = 0;
  for (const entry of entries) {
    if (entry.resultId !== resultId || entry.surface !== surface) continue;
    score += decayWeight(now - entry.timestamp);
  }
  return score;
}

/**
 * A bounded nudge for the search ranking, not a replacement for it — see
 * {@link FRECENCY_BOOST_CAP}. Always 0 for Mari's row.
 */
export function frecencyBoost(
  entries: readonly OmnibarFrecencyEntry[],
  resultId: string,
  surface: OmnibarSurface,
  now = Date.now(),
): number {
  if (FRECENCY_EXCLUDED_RESULT_IDS.has(resultId)) return 0;
  return Math.min(FRECENCY_BOOST_CAP, frecencyScore(entries, resultId, surface, now) * FRECENCY_BOOST_SCALE);
}

/** The most frecent result ids on one surface, highest first, for the empty-state deck. */
export function topFrecentResultIds(
  entries: readonly OmnibarFrecencyEntry[],
  surface: OmnibarSurface,
  now = Date.now(),
  limit = 5,
): string[] {
  const scoreById = new Map<string, number>();
  for (const entry of entries) {
    if (entry.surface !== surface || FRECENCY_EXCLUDED_RESULT_IDS.has(entry.resultId)) continue;
    scoreById.set(entry.resultId, (scoreById.get(entry.resultId) ?? 0) + decayWeight(now - entry.timestamp));
  }
  return [...scoreById.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}
