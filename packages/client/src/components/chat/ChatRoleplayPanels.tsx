import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Loader2,
  MapPin,
  PenLine,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  AUTHOR_NOTES_DEFAULT_DEPTH,
  migrateLegacyAuthorNotes,
  readAuthorNoteEntries,
  type AuthorNoteEntry,
} from "@marinara-engine/shared";
import { useUpdateChatMetadata } from "../../hooks/use-chats";
import { type BudgetSkippedLorebookEntry, useActiveLorebookEntries } from "../../hooks/use-lorebooks";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import {
  ROLEPLAY_POPOVER_CLOSE_BUTTON,
  ROLEPLAY_POPOVER_CLOSE_ICON_SIZE,
  ROLEPLAY_POPOVER_SUBTITLE,
  ROLEPLAY_POPOVER_TITLE,
} from "./roleplay-popover-styles";

type LorebookEntryStatus = "normal" | "constant" | "selective";

const LOREBOOK_ENTRY_STATUS_STYLE: Record<
  LorebookEntryStatus,
  { label: string; dot: string; row: string; badge: string }
> = {
  normal: {
    label: "NORMAL",
    dot: "bg-emerald-400",
    row: "border border-emerald-400/20 bg-emerald-400/10 hover:bg-emerald-400/15",
    badge: "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/20",
  },
  constant: {
    label: "CONST",
    dot: "bg-yellow-300",
    row: "border border-yellow-300/25 bg-yellow-300/10 hover:bg-yellow-300/15",
    badge: "bg-yellow-300/15 text-yellow-200 ring-1 ring-yellow-300/20",
  },
  selective: {
    label: "SELECT",
    dot: "bg-red-400",
    row: "border border-red-400/25 bg-red-400/10 hover:bg-red-400/15",
    badge: "bg-red-400/15 text-red-200 ring-1 ring-red-400/20",
  },
};

function getLorebookEntryStatus(entry: { constant?: boolean; selective?: boolean }): LorebookEntryStatus {
  if (entry.constant) return "constant";
  if (entry.selective) return "selective";
  return "normal";
}

function parseSemanticScore(matchedKeys: string[]): number | null {
  const semanticKey = matchedKeys.find((key) => key.startsWith("[semantic:"));
  if (!semanticKey) return null;
  const parsed = Number(semanticKey.match(/^\[semantic:([0-9.]+)\]$/)?.[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatSemanticScore(score: number | null | undefined) {
  return typeof score === "number" && Number.isFinite(score) ? score.toFixed(3) : null;
}

function ActiveLorebookEntryRow({
  entry,
}: {
  entry: {
    name: string;
    keys: string[];
    content: string;
    constant: boolean;
    selective: boolean;
    order: number;
    lorebookId: string;
    lorebookName: string;
    activationSources: Array<"current_location" | "keyword" | "semantic" | "constant" | "sticky" | "recursive">;
    matchedKeys?: string[];
    matchType?: "keyword" | "semantic" | "constant" | "sticky";
    semanticScore?: number;
  };
}) {
  const [expanded, setExpanded] = useState(false);
  const status = getLorebookEntryStatus(entry);
  const statusStyle = LOREBOOK_ENTRY_STATUS_STYLE[status];
  const matchedKeys = entry.matchedKeys ?? [];
  const semanticScore = entry.semanticScore ?? parseSemanticScore(matchedKeys);
  const semanticScoreLabel = formatSemanticScore(semanticScore);
  const isSemanticMatch = entry.matchType === "semantic" || semanticScore !== null;
  const visibleMatchedKeys = matchedKeys.filter((key) => !key.startsWith("[semantic:"));
  const isCurrentLocation = entry.activationSources.includes("current_location");

  return (
    <div
      className={cn(
        "cursor-pointer rounded-lg p-2 text-xs transition-colors",
        isSemanticMatch ? "border border-cyan-300/25 bg-cyan-400/10 hover:bg-cyan-400/15" : statusStyle.row,
      )}
      onClick={() => setExpanded((prev) => !prev)}
    >
      <div className="flex items-center gap-2">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", isSemanticMatch ? "bg-cyan-300" : statusStyle.dot)} />
        <span className="truncate font-medium text-[var(--foreground)]/80">{entry.name}</span>
        <span className={cn("shrink-0 rounded px-1 py-0.5 text-[0.5rem] font-semibold", statusStyle.badge)}>
          {statusStyle.label}
        </span>
        {isSemanticMatch && (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[0.5rem] font-semibold text-cyan-100 ring-1 ring-cyan-300/25">
            <Sparkles size="0.55rem" />
            Vector{semanticScoreLabel ? ` ${semanticScoreLabel}` : ""}
          </span>
        )}
        {isCurrentLocation && (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-sky-400/15 px-1 py-0.5 text-[0.5rem] font-semibold text-sky-200 ring-1 ring-sky-400/25">
            <MapPin size="0.55rem" /> Location
          </span>
        )}
        <span className="ml-auto shrink-0 text-[0.625rem] text-[var(--muted-foreground)]">#{entry.order}</span>
        <button
          type="button"
          className="min-h-8 shrink-0 rounded px-1.5 text-[0.625rem] text-[var(--muted-foreground)] hover:bg-white/10 hover:text-[var(--foreground)]"
          onClick={(event) => {
            event.stopPropagation();
            useUIStore.getState().openLorebookDetail(entry.lorebookId);
          }}
          aria-label={`Open ${entry.name} in ${entry.lorebookName}`}
        >
          Open
        </button>
      </div>
      <p className="mt-0.5 truncate text-[0.625rem] text-[var(--muted-foreground)]">
        {entry.lorebookName} · {entry.activationSources.map((source) => source.replaceAll("_", " ")).join(", ")}
      </p>
      {entry.keys.length > 0 && (
        <p className="mt-0.5 truncate text-[0.625rem] text-[var(--muted-foreground)]">
          Keys: {entry.keys.slice(0, 5).join(", ")}
          {entry.keys.length > 5 && ` +${entry.keys.length - 5}`}
        </p>
      )}
      {visibleMatchedKeys.length > 0 && (
        <p className="mt-0.5 truncate text-[0.625rem] text-[var(--muted-foreground)]">
          Matched: {visibleMatchedKeys.slice(0, 5).join(", ")}
          {visibleMatchedKeys.length > 5 && ` +${visibleMatchedKeys.length - 5}`}
        </p>
      )}
      {isSemanticMatch && (
        <p className="mt-0.5 truncate text-[0.625rem] text-cyan-100/75">
          Semantic vector match{semanticScoreLabel ? `: ${semanticScoreLabel}` : ""}
        </p>
      )}
      {expanded && (
        <p className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap border-t border-[var(--border)] pt-1.5 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
          {entry.content || "(empty)"}
        </p>
      )}
    </div>
  );
}

function formatBudgetName(blockedBy: BudgetSkippedLorebookEntry["blockedBy"]) {
  if (blockedBy === "lorebook") return "lorebook budget";
  if (blockedBy === "chat") return "chat budget";
  if (blockedBy === "location") return "current-location context cap";
  return "lorebook and chat budgets";
}

function formatBudgetCap(entry: BudgetSkippedLorebookEntry) {
  if (entry.blockedBy === "lorebook") {
    return `${entry.lorebookUsedTokens.toLocaleString()} / ${entry.lorebookBudget.toLocaleString()}`;
  }
  if (entry.blockedBy === "chat") {
    return `${entry.chatUsedTokens.toLocaleString()} / ${entry.chatBudget.toLocaleString()}`;
  }
  if (entry.blockedBy === "location") {
    return `${entry.chatUsedTokens.toLocaleString()} tokens used before the location cap`;
  }
  const lorebookPart = `${entry.lorebookUsedTokens.toLocaleString()} / ${entry.lorebookBudget.toLocaleString()} lorebook`;
  const chatPart = `${entry.chatUsedTokens.toLocaleString()} / ${entry.chatBudget.toLocaleString()} chat`;
  return `${lorebookPart}, ${chatPart}`;
}

function BudgetSkippedEntryRow({ entry }: { entry: BudgetSkippedLorebookEntry }) {
  const [expanded, setExpanded] = useState(false);
  const semanticScore = entry.semanticScore ?? parseSemanticScore(entry.matchedKeys);
  const semanticScoreLabel = formatSemanticScore(semanticScore);
  const isSemanticMatch = entry.matchType === "semantic" || semanticScore !== null;

  return (
    <button
      type="button"
      className="w-full rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-left text-xs transition-colors hover:bg-amber-500/15"
      onClick={() => setExpanded((prev) => !prev)}
    >
      <div className="flex items-center gap-1.5">
        {expanded ? <ChevronDown size="0.75rem" /> : <ChevronRight size="0.75rem" />}
        <span className="min-w-0 flex-1 truncate font-medium text-amber-200">{entry.name}</span>
        {isSemanticMatch && (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[0.5rem] font-semibold text-cyan-100 ring-1 ring-cyan-300/25">
            <Sparkles size="0.55rem" />
            Vector{semanticScoreLabel ? ` ${semanticScoreLabel}` : ""}
          </span>
        )}
        <span className="shrink-0 text-[0.625rem] text-amber-200/70">~{entry.estimatedTokens.toLocaleString()}</span>
      </div>
      <p className="mt-0.5 truncate pl-5 text-[0.625rem] text-amber-100/70">
        {entry.lorebookName} blocked by {formatBudgetName(entry.blockedBy)}
      </p>
      <p className="mt-0.5 truncate pl-5 text-[0.625rem] text-amber-100/60">
        Sources: {entry.activationSources.map((source) => source.replaceAll("_", " ")).join(", ")}
      </p>
      {expanded && (
        <div className="mt-1.5 space-y-1 border-t border-amber-500/20 pt-1.5 pl-5 text-[0.625rem] leading-relaxed text-amber-50/75">
          <p>Matched: {entry.matchedKeys.length > 0 ? entry.matchedKeys.slice(0, 5).join(", ") : "No key recorded"}</p>
          {isSemanticMatch && <p>Semantic vector score: {semanticScoreLabel ?? "matched"}</p>}
          <p>Entry estimate: ~{entry.estimatedTokens.toLocaleString()} tokens</p>
          <p>Budget used before entry: {formatBudgetCap(entry)}</p>
        </div>
      )}
    </button>
  );
}

function BudgetSkippedEntriesNotice({ entries }: { entries: BudgetSkippedLorebookEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  if (entries.length === 0) return null;

  return (
    <div className="mb-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-2 text-xs text-amber-50/85">
      <button
        type="button"
        className="flex w-full items-start gap-2 text-left"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <AlertTriangle size="0.875rem" className="mt-0.5 shrink-0 text-amber-300" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-amber-100">
            {entries.length} matching lore {entries.length === 1 ? "entry was" : "entries were"} skipped by token budget
          </span>
          <span className="mt-0.5 block text-[0.625rem] leading-relaxed text-amber-50/65">
            Expand for budget details. Knowledge Retrieval or Knowledge Router may fit large lorebooks better than
            simply raising caps.
          </span>
        </span>
        {expanded ? <ChevronDown size="0.75rem" /> : <ChevronRight size="0.75rem" />}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {entries.map((entry) => (
            <BudgetSkippedEntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ActiveLorebookEntriesPanel({
  chatId,
  onClose,
}: {
  chatId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useActiveLorebookEntries(chatId, true);
  const entries = data?.entries ?? [];
  const skippedEntries = data?.budgetSkippedEntries ?? [];
  const currentLocationEntries = entries.filter((entry) => entry.activationSources.includes("current_location"));
  const otherEntries = entries.filter((entry) => !entry.activationSources.includes("current_location"));

  return (
    <>
      <h3 className={cn(ROLEPLAY_POPOVER_TITLE, "mb-2")}>
        <BookOpen size="0.75rem" />
        Active Context
        <button
          type="button"
          onClick={onClose}
          aria-label="Close active context"
          className={cn(ROLEPLAY_POPOVER_CLOSE_BUTTON, "ml-auto -my-1")}
        >
          <X size={ROLEPLAY_POPOVER_CLOSE_ICON_SIZE} />
        </button>
      </h3>
      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-[var(--muted-foreground)]">
          <Loader2 size="0.75rem" className="animate-spin" />
          Scanning entries...
        </div>
      ) : entries.length === 0 ? (
        <>
          <BudgetSkippedEntriesNotice entries={skippedEntries} />
          <p className="py-3 text-center text-xs text-[var(--muted-foreground)]">No active entries for this chat</p>
        </>
      ) : (
        <>
          <p className="mb-2 text-[0.625rem] text-[var(--muted-foreground)]">
            {entries.length} active • ~{(data?.totalTokens ?? 0).toLocaleString()} tokens
          </p>
          <BudgetSkippedEntriesNotice entries={skippedEntries} />
          {currentLocationEntries.length > 0 && (
            <section aria-label="Current location lore">
              <h4 className="mb-1.5 flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-wide text-sky-200">
                <MapPin size="0.6875rem" /> Current location
              </h4>
              <div className="space-y-1.5">
                {currentLocationEntries.map((entry) => (
                  <ActiveLorebookEntryRow key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          )}
          {otherEntries.length > 0 && (
            <section className={cn(currentLocationEntries.length > 0 && "mt-3")} aria-label="Other active lore">
              {currentLocationEntries.length > 0 && (
                <h4 className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  Other active lore
                </h4>
              )}
              <div className="space-y-1.5">
                {otherEntries.map((entry) => (
                  <ActiveLorebookEntryRow key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

/**
 * Entries for display. A chat that predates the entries feature still holds a
 * single `authorNotes` string; it is split for display only, and not written
 * back until the user actually edits something.
 */
function initialAuthorNoteEntries(chatMeta: Record<string, any>): AuthorNoteEntry[] {
  const stored = readAuthorNoteEntries(chatMeta);
  if (stored !== null) return stored;
  return migrateLegacyAuthorNotes((chatMeta.authorNotes as string) ?? "", () => crypto.randomUUID());
}

function authorNoteEntriesEqual(a: AuthorNoteEntry[], b: AuthorNoteEntry[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((entry, i) => entry.id === b[i].id && entry.content === b[i].content && entry.enabled === b[i].enabled);
}

export function AuthorNotesPanel({
  chatId,
  chatMeta,
  onClose,
}: {
  chatId: string;
  chatMeta: Record<string, any>;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<AuthorNoteEntry[]>(() => initialAuthorNoteEntries(chatMeta));
  const [depthStr, setDepthStr] = useState(String((chatMeta.authorNotesDepth as number) ?? AUTHOR_NOTES_DEFAULT_DEPTH));
  const updateMeta = useUpdateChatMetadata();

  const initialBaseline = {
    entries: initialAuthorNoteEntries(chatMeta),
    depth: (chatMeta.authorNotesDepth as number) ?? AUTHOR_NOTES_DEFAULT_DEPTH,
  };
  const latestByChatRef = useRef(
    new Map<string, { entries: AuthorNoteEntry[]; depthStr: string }>([[chatId, { entries, depthStr }]]),
  );
  latestByChatRef.current.set(chatId, { entries, depthStr });
  const baselineByChatRef = useRef(
    new Map<string, { entries: AuthorNoteEntry[]; depth: number }>([[chatId, initialBaseline]]),
  );
  const mutateRef = useRef(updateMeta.mutate);
  mutateRef.current = updateMeta.mutate;

  const storedEntriesKey = JSON.stringify(chatMeta.authorNoteEntries ?? null);
  useEffect(() => {
    const nextBaseline = {
      entries: initialAuthorNoteEntries(chatMeta),
      depth: (chatMeta.authorNotesDepth as number) ?? AUTHOR_NOTES_DEFAULT_DEPTH,
    };
    setEntries(nextBaseline.entries);
    setDepthStr(String(nextBaseline.depth));
    baselineByChatRef.current.set(chatId, nextBaseline);
    latestByChatRef.current.set(chatId, { entries: nextBaseline.entries, depthStr: String(nextBaseline.depth) });
    // `chatMeta` is a fresh object each render; key off the stored values instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, storedEntriesKey, chatMeta.authorNotes, chatMeta.authorNotesDepth]);

  // Outside-click closes the popover via mousedown, which unmounts the
  // textarea before its onBlur (the only save trigger) can fire. Flush
  // the pending edit from the unmount cleanup so typed content survives.
  useEffect(() => {
    const capturedChatId = chatId;
    const latestByChat = latestByChatRef.current;
    const baselineByChat = baselineByChatRef.current;
    const snapshot = latestByChat.get(capturedChatId) ?? { entries: [], depthStr: String(AUTHOR_NOTES_DEFAULT_DEPTH) };
    const baselineSnapshot = baselineByChat.get(capturedChatId) ?? { entries: [], depth: AUTHOR_NOTES_DEFAULT_DEPTH };
    return () => {
      const { entries: e, depthStr: d } = latestByChat.get(capturedChatId) ?? snapshot;
      const nextDepth = Math.max(0, parseInt(d, 10) || 0);
      const base = baselineByChat.get(capturedChatId) ?? baselineSnapshot;
      if (!authorNoteEntriesEqual(e, base.entries) || nextDepth !== base.depth) {
        // Clearing `authorNotes` completes the migration: once the entries
        // array exists it is the only source of truth, so a lingering legacy
        // string would just be dead data.
        mutateRef.current({ id: capturedChatId, authorNotes: "", authorNoteEntries: e, authorNotesDepth: nextDepth });
      }
      latestByChat.delete(capturedChatId);
      baselineByChat.delete(capturedChatId);
    };
  }, [chatId]);

  const depth = parseInt(depthStr, 10) || 0;
  const persist = (nextEntries: AuthorNoteEntry[], nextDepth = depth) => {
    updateMeta.mutate({ id: chatId, authorNotes: "", authorNoteEntries: nextEntries, authorNotesDepth: nextDepth });
  };

  const commitEntries = (nextEntries: AuthorNoteEntry[]) => {
    setEntries(nextEntries);
    persist(nextEntries);
  };

  const updateEntry = (id: string, patch: Partial<AuthorNoteEntry>) =>
    entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry));

  const moveEntry = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= entries.length) return;
    const next = [...entries];
    [next[index], next[target]] = [next[target], next[index]];
    commitEntries(next);
  };

  const enabledCount = entries.filter((entry) => entry.enabled && entry.content.trim()).length;

  return (
    <>
      <h3 className={cn(ROLEPLAY_POPOVER_TITLE, "mb-2")}>
        <PenLine size="0.75rem" />
        Author's Notes
        <button
          type="button"
          onClick={onClose}
          aria-label="Close author's notes"
          className={cn(ROLEPLAY_POPOVER_CLOSE_BUTTON, "ml-auto -my-1")}
        >
          <X size={ROLEPLAY_POPOVER_CLOSE_ICON_SIZE} />
        </button>
      </h3>
      <p className={cn(ROLEPLAY_POPOVER_SUBTITLE, "mb-2")}>
        {entries.length === 0
          ? "Add notes to inject into the prompt at the chosen depth every generation."
          : `${enabledCount} of ${entries.length} ${entries.length === 1 ? "note" : "notes"} injected at the chosen depth every generation.`}
      </p>

      <div className="flex flex-col gap-1.5">
        {entries.map((entry, index) => (
          <div
            key={entry.id}
            className={cn(
              "rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-1.5 transition-opacity",
              !entry.enabled && "opacity-50",
            )}
          >
            <div className="mb-1 flex items-center gap-1">
              <button
                type="button"
                role="switch"
                aria-checked={entry.enabled}
                aria-label={entry.enabled ? "Disable this note" : "Enable this note"}
                onClick={() => commitEntries(updateEntry(entry.id, { enabled: !entry.enabled }))}
                className={cn(
                  "relative h-3.5 w-6 shrink-0 rounded-full transition-colors",
                  entry.enabled ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/30",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform",
                    entry.enabled ? "translate-x-3" : "translate-x-0.5",
                  )}
                />
              </button>
              <span className="text-[0.5625rem] text-[var(--muted-foreground)]">#{index + 1}</span>
              <div className="ml-auto flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => moveEntry(index, -1)}
                  disabled={index === 0}
                  aria-label="Move note up"
                  className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronUp size="0.75rem" />
                </button>
                <button
                  type="button"
                  onClick={() => moveEntry(index, 1)}
                  disabled={index === entries.length - 1}
                  aria-label="Move note down"
                  className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronDown size="0.75rem" />
                </button>
                <button
                  type="button"
                  onClick={() => commitEntries(entries.filter((candidate) => candidate.id !== entry.id))}
                  aria-label="Delete this note"
                  className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:text-red-400"
                >
                  <Trash2 size="0.75rem" />
                </button>
              </div>
            </div>
            <textarea
              value={entry.content}
              onChange={(e) => setEntries(updateEntry(entry.id, { content: e.target.value }))}
              onBlur={() => persist(entries)}
              placeholder="e.g. Keep the tone dark and suspenseful."
              className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:ring-2 focus:ring-[var(--ring)]"
              rows={2}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => commitEntries([...entries, { id: crypto.randomUUID(), content: "", enabled: true }])}
        className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border)] px-2 py-1.5 text-[0.625rem] text-[var(--muted-foreground)] transition-colors hover:border-[var(--ring)] hover:text-[var(--foreground)]"
      >
        <Plus size="0.75rem" />
        Add note
      </button>

      <div className="mt-2 flex items-center gap-2">
        <span className="shrink-0 text-[0.625rem] text-[var(--muted-foreground)]">Injection Depth</span>
        <input
          type="text"
          inputMode="numeric"
          value={depthStr}
          onChange={(e) => setDepthStr(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={() => {
            const nextDepth = Math.max(0, parseInt(depthStr, 10) || 0);
            setDepthStr(String(nextDepth));
            persist(entries, nextDepth);
          }}
          className="w-14 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-0.5 text-center text-[0.625rem] text-[var(--foreground)] outline-none transition-colors [appearance:textfield] focus:ring-2 focus:ring-[var(--ring)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
      <p className="mt-1 text-[0.5625rem] text-[var(--muted-foreground)]/60">
        Depth 0 = after the latest message, 4 = four messages from the end.
      </p>
    </>
  );
}
