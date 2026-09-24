// ──────────────────────────────────────────────
// Command palette: registry, fuzzy ranking, recents (DOM-free core)
// ──────────────────────────────────────────────
// Other features add palette actions with registerCommand():
//
//   const unregister = registerCommand({
//     id: "my-feature.do-thing",
//     title: "Do the thing",
//     keywords: ["thing"],
//     run: () => doThing(),
//   });
//
// Call the returned function (e.g. from a React effect cleanup) to remove it.

export type PaletteSection = "actions" | "chats" | "characters" | "personas" | "lorebooks" | "presets" | "settings";

export interface PaletteCommand {
  /** Stable, unique id. Also the key for "recent" ordering. */
  id: string;
  title: string;
  /** Secondary text shown under/after the title and searched with lower weight. */
  subtitle?: string;
  /** Extra search terms that are never displayed. */
  keywords?: readonly string[];
  section?: PaletteSection;
  /** Shortcut hint shown on the right, e.g. "Ctrl+K" or "?". */
  shortcut?: string;
  /** Hidden when this returns false (evaluated each time the palette opens). */
  when?: () => boolean;
  run: () => void | Promise<void>;
}

const registry = new Map<string, PaletteCommand>();
const listeners = new Set<() => void>();
let snapshot: readonly PaletteCommand[] = [];

function emit() {
  snapshot = [...registry.values()];
  for (const listener of listeners) listener();
}

/** Registers (or replaces) a palette action. Returns an unregister function. */
export function registerCommand(command: PaletteCommand): () => void {
  registry.set(command.id, command);
  emit();
  return () => {
    if (registry.get(command.id) !== command) return;
    registry.delete(command.id);
    emit();
  };
}

export function listRegisteredCommands(): readonly PaletteCommand[] {
  return snapshot;
}

/** useSyncExternalStore-compatible subscription. */
export function subscribeToCommands(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Commands whose `when` allows them right now. A `when` that throws hides its
 * command instead of breaking the whole palette.
 */
export function filterVisibleCommands<T extends Pick<PaletteCommand, "when">>(commands: readonly T[]): T[] {
  return commands.filter((command) => {
    try {
      return command.when ? command.when() : true;
    } catch {
      return false;
    }
  });
}

// ── Entity sources ──

/** Settings tabs the palette can jump to. The ids match the Settings panel's tab ids. */
export const PALETTE_SETTINGS_TABS = [
  { id: "general", labelKey: "settings.tabs.general.label" },
  { id: "appearance", labelKey: "settings.tabs.appearance.label" },
  { id: "generations", labelKey: "settings.tabs.generations.label" },
  { id: "addons", labelKey: "settings.tabs.addons.label" },
  { id: "import", labelKey: "settings.tabs.imports.label" },
  { id: "advanced", labelKey: "settings.tabs.advanced.label" },
] as const;

/**
 * Whether a chat gets its own palette entry. The conversation that backs a
 * game is part of that game and is hidden from the chat list too, so it is
 * skipped here as well.
 */
export function isPaletteListedChat(chat: { mode: string; metadata?: unknown }): boolean {
  if (chat.mode !== "conversation") return true;
  const metadata = chat.metadata as { gameId?: unknown } | null | undefined;
  return !metadata?.gameId;
}

// ── Fuzzy scoring ──

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

// One query is scored against every command (thousands with a big library),
// so its word-start pattern is compiled once, not once per command.
let cachedWordStart: { query: string; pattern: RegExp } | null = null;

function wordStartPattern(normalizedQuery: string): RegExp {
  if (cachedWordStart?.query !== normalizedQuery) {
    const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    cachedWordStart = { query: normalizedQuery, pattern: new RegExp(`(^|[\\s\\-_/.:(])${escaped}`, "u") };
  }
  return cachedWordStart.pattern;
}

/**
 * Scores how well `query` matches `text` (higher is better, null = no match).
 * Prefers exact > prefix > word-start > substring > in-order subsequence, and
 * rewards consecutive and word-boundary characters in the subsequence case.
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = normalize(query.trim());
  if (!q) return 0;
  const t = normalize(text);
  if (!t) return null;
  if (t === q) return 1000;
  if (t.startsWith(q)) return 900 - Math.min(t.length - q.length, 100);
  const wordIndex = t.search(wordStartPattern(q));
  if (wordIndex >= 0) return 800 - Math.min(wordIndex, 100);
  const index = t.indexOf(q);
  if (index >= 0) return 700 - Math.min(index, 100);

  let score = 0;
  let textIndex = 0;
  let previousMatch = -2;
  for (const char of q) {
    if (char === " ") continue;
    const found = t.indexOf(char, textIndex);
    if (found === -1) return null;
    const atWordStart = found === 0 || /[\s\-_/.:(]/u.test(t[found - 1]!);
    score += found === previousMatch + 1 ? 12 : atWordStart ? 9 : 2;
    previousMatch = found;
    textIndex = found + 1;
  }
  // Subsequence matches always rank below any substring match.
  return Math.min(600, score * 10 - Math.min(t.length, 100));
}

export function scoreCommand(command: Pick<PaletteCommand, "title" | "subtitle" | "keywords">, query: string) {
  let best = fuzzyScore(query, command.title);
  const subtitle = command.subtitle ? fuzzyScore(query, command.subtitle) : null;
  if (subtitle != null) best = Math.max(best ?? -Infinity, subtitle - 150);
  for (const keyword of command.keywords ?? []) {
    const keywordScore = fuzzyScore(query, keyword);
    if (keywordScore != null) best = Math.max(best ?? -Infinity, keywordScore - 100);
  }
  return best;
}

/**
 * Ranks commands for a query. With an empty query, recent items come first
 * (most recent first) followed by `emptyQueryFallback` entries (actions), so
 * the palette opens on something useful instead of every chat.
 * With a query, a recent item gets a small boost so it wins near-ties.
 */
export function rankCommands<T extends PaletteCommand>(
  commands: readonly T[],
  query: string,
  recentIds: readonly string[],
  options: { limit?: number; emptyQueryFallback?: (command: T) => boolean } = {},
): T[] {
  const limit = options.limit ?? 50;
  const recentRank = new Map(recentIds.map((id, index) => [id, index]));
  if (!query.trim()) {
    const recent = commands
      .filter((command) => recentRank.has(command.id))
      .sort((left, right) => recentRank.get(left.id)! - recentRank.get(right.id)!);
    const fallback = options.emptyQueryFallback
      ? commands.filter((command) => !recentRank.has(command.id) && options.emptyQueryFallback!(command))
      : [];
    return [...recent, ...fallback].slice(0, limit);
  }
  const scored: Array<{ command: T; score: number; order: number }> = [];
  commands.forEach((command, order) => {
    const score = scoreCommand(command, query);
    if (score == null) return;
    const recency = recentRank.get(command.id);
    scored.push({ command, score: score + (recency == null ? 0 : Math.max(5, 40 - recency * 2)), order });
  });
  scored.sort((left, right) => right.score - left.score || left.order - right.order);
  return scored.slice(0, limit).map((entry) => entry.command);
}

// ── Recents ──

export const PALETTE_RECENTS_STORAGE_KEY = "marinara-command-palette-recents";
export const PALETTE_RECENTS_LIMIT = 12;

export function pushRecent(recentIds: readonly string[], id: string, limit = PALETTE_RECENTS_LIMIT): string[] {
  return [id, ...recentIds.filter((entry) => entry !== id)].slice(0, limit);
}

export function parseRecents(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string").slice(0, PALETTE_RECENTS_LIMIT)
      : [];
  } catch {
    return [];
  }
}

// ── Keyboard helpers ──

interface KeyLike {
  key: string;
  code?: string;
  repeat?: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/**
 * Ctrl+K on Windows/Linux, Cmd+K on macOS (either modifier is accepted).
 * On non-Latin layouts (Hebrew, Cyrillic, ...) `key` is the local letter, so
 * the physical K key is matched through `code` instead, like browser shortcuts.
 * Held-down repeats are ignored so the palette does not flicker open and shut.
 */
export function isPaletteShortcut(event: KeyLike): boolean {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.repeat) return false;
  const key = event.key.toLowerCase();
  if (key === "k") return true;
  return !/^[a-z]$/u.test(key) && event.code === "KeyK";
}

/**
 * Whether Ctrl/Cmd+K may toggle the palette while `openOverlays` `Modal`s are
 * open. The app shows one dialog at a time and palette commands open their own
 * dialogs, so the palette never opens over another dialog; it may only close
 * itself when it is the one open.
 */
export function canTogglePaletteFromShortcut(openOverlays: number, paletteOpen: boolean): boolean {
  return openOverlays <= (paletteOpen ? 1 : 0);
}

/** "?" with no command modifiers (Shift is how most layouts type it). */
export function isShortcutsHelpKey(event: KeyLike): boolean {
  return event.key === "?" && !event.ctrlKey && !event.metaKey && !event.altKey;
}

interface TargetLike {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
  closest?: (selector: string) => unknown;
}

/** True when keystrokes on `target` are text entry and must not trigger single-key shortcuts. */
export function isTypingTarget(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const element = target as TargetLike;
  const tag = element.tagName?.toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (element.getAttribute?.("type") ?? "text").toLowerCase();
    return !["button", "checkbox", "radio", "range", "reset", "submit", "color", "file", "image"].includes(type);
  }
  if (element.isContentEditable) return true;
  return !!element.closest?.('[contenteditable=""], [contenteditable="true"], [role="textbox"]');
}

export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform;
  return /mac|iphone|ipad|ipod/iu.test(platform ?? "");
}

/** Display text for one key, resolving "Mod" to Ctrl, or to the Command key on Apple devices. */
export function formatShortcutKey(key: string, apple = isApplePlatform()): string {
  if (key === "Mod") return apple ? "⌘" : "Ctrl";
  return key;
}
