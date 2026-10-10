/**
 * Pure helpers for the omnibar aside answer: a small LRU+TTL cache so retyping
 * the same query does not pay for another call, and a light markdown strip
 * for the screen-reader announcement of an answer.
 */

/**
 * Default idle delay before the aside calls a model.
 *
 * A knob, not a constant (R23): too short spends a call on an ordinary typing
 * pause, too long makes the feature feel absent, and the right value depends on
 * how fast the user types and how slow their model is. The omnibar settings
 * offer these choices.
 */
export const OMNIBAR_ASIDE_DELAY_MS = 3_000;
/** The aside setting that follows Mari's connection, so a change there is picked up without touching the setting. */
export const MARI_QUICK_CONNECTION = "mari";
export const OMNIBAR_ASIDE_DELAY_CHOICES_MS = [1_000, 2_000, 3_000, 5_000] as const;

export interface OmnibarAsideCacheEntry {
  answer: string;
  tier: "local" | "remote";
  /** The docs pages the answer was grounded on, so a repeat question still names them. */
  sources?: readonly { path: string; heading: string }[];
}

const DEFAULT_MAX_ENTRIES = 20;
const DEFAULT_TTL_MS = 5 * 60_000;

interface StoredEntry extends OmnibarAsideCacheEntry {
  expiresAt: number;
}

export class OmnibarAsideAnswerCache {
  private readonly entries = new Map<string, StoredEntry>();

  constructor(
    private readonly maxEntries = DEFAULT_MAX_ENTRIES,
    private readonly ttlMs = DEFAULT_TTL_MS,
  ) {}

  private key(connectionId: string | null | undefined, query: string): string {
    return `${connectionId ?? ""}\u0000${query}`;
  }

  get(connectionId: string | null | undefined, query: string): OmnibarAsideCacheEntry | undefined {
    const key = this.key(connectionId, query);
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // Re-insert to mark it most-recently-used; Map iteration order is insertion order.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return { answer: entry.answer, tier: entry.tier, ...(entry.sources ? { sources: entry.sources } : {}) };
  }

  set(connectionId: string | null | undefined, query: string, value: OmnibarAsideCacheEntry): void {
    const key = this.key(connectionId, query);
    this.entries.delete(key);
    this.entries.set(key, { ...value, expiresAt: Date.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) break;
      this.entries.delete(oldestKey);
    }
  }
}

/** Shared across the app's one omnibar instance; small and short-lived by design. */
export const omnibarAsideAnswerCache = new OmnibarAsideAnswerCache();

/** Undoes the common markdown an answer should not have used (R plain-text instruction). */
export function stripStrayMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "");
}

/** Browser key Mari's connection was saved under before it moved into the UI store. Read once, by the v103 migration. */
const LEGACY_MARI_CONNECTION_STORAGE_KEY = "marinara:home-professor-mari-connection-id";

export function readLegacyMariConnectionId(): string | null {
  try {
    return localStorage.getItem(LEGACY_MARI_CONNECTION_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * The connection Mari answers with: the one her window uses (`chosenId`, when it still exists), else the
 * agents default, then the default, then the first, the order the server uses for a new Mari chat.
 */
export function marisConnectionFor<T extends { id: string; isDefault: boolean; defaultForAgents: boolean }>(
  connections: readonly T[],
  chosenId?: string | null,
): T | null {
  return (
    connections.find((c) => chosenId && c.id === chosenId) ??
    connections.find((c) => c.defaultForAgents) ??
    connections.find((c) => c.isDefault) ??
    connections[0] ??
    null
  );
}
