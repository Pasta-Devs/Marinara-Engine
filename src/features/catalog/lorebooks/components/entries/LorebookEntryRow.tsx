// ──────────────────────────────────────────────
// Lorebook Entry Row
// Compact one-line row with inline controls + expandable drawer.
// Replaces the previous "click to navigate to entry sub-view" pattern.
// Inspired by SillyTavern's World Info card layout.
// ──────────────────────────────────────────────
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  Ban,
  ChevronDown,
  CheckCircle2,
  CheckSquare2,
  CircleDashed,
  Copy,
  GripVertical,
  Hash,
  Lock,
  MoreHorizontal,
  Regex,
  Sparkles,
  Square,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import { cn } from "../../../../../shared/lib/utils";
import { showConfirmDialog } from "../../../../../shared/lib/app-dialogs";
import { useUpdateLorebookEntry, useDeleteLorebookEntry, useDuplicateLorebookEntry } from "../../hooks/use-lorebooks";
import type { LorebookEntry, LorebookFolder } from "../../../../../engine/contracts/types/lorebook";
import { estimateTokens } from "../shared/LorebookFormFields";
import { LorebookEntryDrawer } from "./LorebookEntryDrawer";
import { CompactNumber, CompactSelect, MobileNumber, MobileSelect } from "./LorebookEntryRowControls";
import {
  type EntryStatus,
  deriveStatus,
  getNextStatus,
  STATUS_DOT_COLOR,
  STATUS_LABEL,
  statusToFlags,
} from "./lorebook-entry-row-status";

interface Props {
  entry: LorebookEntry;
  lorebookId: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  characters: Array<{ id: string; name: string; tags: string[] }>;
  characterTags: string[];
  /**
   * All folders in the parent lorebook. Used to populate the folder selector
   * on the row. May be empty — when empty, the selector is hidden because
   * "(none)" → "(none)" is meaningless.
   */
  folders: LorebookFolder[];
  // Drag-and-drop wiring (lifted in the parent because cross-row state).
  draggable: boolean;
  isDragging: boolean;
  onDragHandleMouseDown: () => void;
  onDragStart: (e: ReactDragEvent<HTMLDivElement>) => void;
  onDragOver: (e: ReactDragEvent<HTMLDivElement>) => void;
  onDrop: (e: ReactDragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelected?: () => void;
  /**
   * When the editor's "Keyword test" panel has text in it, the editor
   * computes which entries that text would activate and passes the verdict
   * down per-row. `"matched"` = the entry's keys would trigger; `"constant"`
   * = the entry activates regardless (no keys required). `undefined` = no
   * preview active. Adds a side accent + chip; does not change behavior.
   */
  previewMatch?: "matched" | "constant";
}

/** A compact lorebook-entry list row with inline-editable status / position / depth / order /
 *  probability / enable, plus an expandable drawer with the rest of the entry editor.
 */
export function LorebookEntryRow({
  entry,
  lorebookId,
  isExpanded,
  onToggleExpand,
  characters,
  characterTags,
  folders,
  draggable,
  isDragging,
  onDragHandleMouseDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  selectionMode = false,
  isSelected = false,
  onToggleSelected,
  previewMatch,
}: Props) {
  const updateEntry = useUpdateLorebookEntry();
  const deleteEntry = useDeleteLorebookEntry();
  const duplicateEntry = useDuplicateLorebookEntry();

  // ── Inline-control optimistic state ──
  // We keep a local mirror of the entry's fields so the inputs feel snappy
  // while the mutation flushes. React Query invalidation will reconcile.
  const [localEnabled, setLocalEnabled] = useState(entry.enabled);
  const [localStatus, setLocalStatus] = useState<EntryStatus>(deriveStatus(entry));
  const [localPosition, setLocalPosition] = useState(entry.position);
  const [localDepth, setLocalDepth] = useState(entry.depth);
  const [localOrder, setLocalOrder] = useState(entry.order);
  const [localProbability, setLocalProbability] = useState<number>(entry.probability ?? 100);
  const [localName, setLocalName] = useState(entry.name);
  const [localUseRegex, setLocalUseRegex] = useState(entry.useRegex ?? false);
  const [showVectorStatus, setShowVectorStatus] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);
  const mobileControlsRef = useRef<HTMLDivElement>(null);

  // Re-sync local state when the upstream entry changes (e.g. after refetch)
  // so we don't show stale values, but avoid clobbering an in-flight edit.
  const lastSyncedRef = useRef(entry);
  useEffect(() => {
    if (lastSyncedRef.current === entry) return;
    const previous = lastSyncedRef.current;
    const entryChanged = previous.id !== entry.id;
    const previousStatus = deriveStatus(previous);
    lastSyncedRef.current = entry;
    if (entryChanged || localEnabled === previous.enabled) setLocalEnabled(entry.enabled);
    if (entryChanged || localStatus === previousStatus) setLocalStatus(deriveStatus(entry));
    if (entryChanged || localPosition === previous.position) setLocalPosition(entry.position);
    if (entryChanged || localDepth === previous.depth) setLocalDepth(entry.depth);
    if (entryChanged || localOrder === previous.order) setLocalOrder(entry.order);
    if (entryChanged || localProbability === (previous.probability ?? 100)) {
      setLocalProbability(entry.probability ?? 100);
    }
    if (entryChanged || localName === previous.name) setLocalName(entry.name);
    if (entryChanged || localUseRegex === (previous.useRegex ?? false)) setLocalUseRegex(entry.useRegex ?? false);
  }, [
    entry,
    localDepth,
    localEnabled,
    localName,
    localOrder,
    localPosition,
    localProbability,
    localStatus,
    localUseRegex,
  ]);

  useEffect(() => {
    if (!showMobileControls) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!mobileControlsRef.current?.contains(event.target as Node)) {
        setShowMobileControls(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowMobileControls(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showMobileControls]);

  const patch = useCallback(
    (changes: Partial<LorebookEntry>) => {
      updateEntry.mutate({ lorebookId, entryId: entry.id, ...changes });
    },
    [lorebookId, entry.id, updateEntry],
  );

  const handleStatusChange = useCallback(
    (next: EntryStatus) => {
      setLocalStatus(next);
      patch(statusToFlags(next));
    },
    [patch],
  );

  const handleStatusCycle = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      handleStatusChange(getNextStatus(localStatus));
    },
    [handleStatusChange, localStatus],
  );

  const handleEnableToggle = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      const next = !localEnabled;
      setLocalEnabled(next);
      patch({ enabled: next });
    },
    [localEnabled, patch],
  );

  const handleUseRegexToggle = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      const next = !localUseRegex;
      setLocalUseRegex(next);
      patch({ useRegex: next });
    },
    [localUseRegex, patch],
  );

  const handleNameCommit = useCallback(() => {
    if (localName.trim() && localName !== entry.name) {
      patch({ name: localName.trim() });
    } else if (!localName.trim()) {
      // Don't allow empty names — revert.
      setLocalName(entry.name);
    }
  }, [localName, entry.name, patch]);

  const handleDelete = useCallback(
    async (e: ReactMouseEvent) => {
      e.stopPropagation();
      if (
        !(await showConfirmDialog({
          title: "Delete Entry",
          message: "Delete this lorebook entry?",
          confirmLabel: "Delete",
          tone: "destructive",
        }))
      ) {
        return;
      }
      deleteEntry.mutate({ lorebookId, entryId: entry.id });
    },
    [lorebookId, entry.id, deleteEntry],
  );

  const handleDuplicate = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      duplicateEntry.mutate({ entry });
    },
    [duplicateEntry, entry],
  );

  const showDepthInput = localPosition === 2;
  const isVectorExcluded = entry.excludeFromVectorization === true;
  const isVectorized = Array.isArray(entry.embedding) && entry.embedding.length > 0;
  const vectorStatusLabel = isVectorExcluded ? "Vector excluded" : isVectorized ? "Vectorized" : "Not vectorized";
  const vectorStatusTitle = isVectorExcluded
    ? "This entry is excluded from vectorization"
    : isVectorized
      ? "This entry has been vectorized"
      : "This entry has not been vectorized yet";

  return (
    <div
      className={cn(
        "relative rounded-xl bg-[var(--secondary)] ring-1 ring-[var(--border)] transition-all",
        isExpanded ? "ring-amber-400/40" : "hover:ring-amber-400/30",
        selectionMode && isSelected && "bg-amber-400/10 ring-amber-400/40",
        isDragging && "opacity-40",
      )}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {/* Keyword-test side accent. Absolute-positioned so it overlays the
          left edge without competing with the row's ring or border-radius. */}
      {previewMatch && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-[3px] rounded-l-xl",
            previewMatch === "matched" ? "bg-emerald-400" : "bg-amber-400",
          )}
        />
      )}

      {/* ── Compact row ── */}
      <div
        className="group flex cursor-pointer items-center gap-1 px-2 py-1.5 sm:gap-2"
        onClick={selectionMode ? onToggleSelected : onToggleExpand}
      >
        {/* Drag handle */}
        <button
          type="button"
          className={cn(
            "shrink-0 rounded p-0.5 text-[var(--muted-foreground)] transition-colors",
            draggable
              ? "cursor-grab hover:bg-[var(--accent)] hover:text-[var(--foreground)] active:cursor-grabbing"
              : "cursor-not-allowed opacity-40",
          )}
          title={draggable ? "Drag to reorder" : "Use Order sort and clear search to reorder"}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (draggable) onDragHandleMouseDown();
          }}
        >
          <GripVertical size="0.875rem" />
        </button>

        {selectionMode && (
          <button
            type="button"
            aria-label={isSelected ? "Deselect entry" : "Select entry"}
            title={isSelected ? "Deselect entry" : "Select entry"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelected?.();
            }}
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
              isSelected
                ? "bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/30"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
            )}
          >
            {isSelected ? <CheckSquare2 size="0.875rem" /> : <Square size="0.875rem" />}
          </button>
        )}

        {/* Expand chevron */}
        <button
          type="button"
          aria-label={isExpanded ? "Collapse entry" : "Expand entry"}
          className="shrink-0 rounded p-0.5 text-[var(--muted-foreground)] transition-transform hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
        >
          <ChevronDown size="0.875rem" className={cn("transition-transform", isExpanded ? "rotate-0" : "-rotate-90")} />
        </button>

        {/* Enable toggle */}
        <button
          type="button"
          aria-label={localEnabled ? "Disable entry" : "Enable entry"}
          title={localEnabled ? "Entry enabled" : "Entry disabled"}
          onClick={handleEnableToggle}
          className="shrink-0"
        >
          {localEnabled ? (
            <ToggleRight size="1.125rem" className="text-amber-400" />
          ) : (
            <ToggleLeft size="1.125rem" className="text-[var(--muted-foreground)]" />
          )}
        </button>

        {/* Regex key matching toggle */}
        <button
          type="button"
          aria-label={localUseRegex ? "Disable regex key matching" : "Enable regex key matching"}
          title={localUseRegex ? "Regex key matching enabled" : "Plain-text key matching"}
          onClick={handleUseRegexToggle}
          className={cn(
            "shrink-0 rounded p-0.5 transition-colors",
            localUseRegex
              ? "bg-orange-400/15 text-orange-300 ring-1 ring-orange-400/25"
              : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
          )}
        >
          <Regex size="0.875rem" />
        </button>

        {/* Status dot + name */}
        <button
          type="button"
          onClick={handleStatusCycle}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          title={`${STATUS_LABEL[localStatus]} entry. Tap to switch to ${STATUS_LABEL[getNextStatus(localStatus)]}.`}
          aria-label={`${STATUS_LABEL[localStatus]} entry. Tap to switch to ${STATUS_LABEL[getNextStatus(localStatus)]}.`}
        >
          <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_DOT_COLOR[localStatus])} />
        </button>
        {previewMatch && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.625rem] font-medium ring-1",
              previewMatch === "matched"
                ? "bg-emerald-400/12 text-emerald-300 ring-emerald-400/30"
                : "bg-amber-400/12 text-amber-300 ring-amber-400/30",
            )}
            title={
              previewMatch === "matched"
                ? "This entry's keys match the keyword-test text."
                : "This entry is constant and would activate regardless of text."
            }
          >
            <Sparkles size="0.625rem" />
            {previewMatch === "matched" ? "Would activate" : "Always active"}
          </span>
        )}
        <input
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={handleNameCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          onClick={(e) => e.stopPropagation()}
          placeholder="Untitled entry"
          className="min-w-[4rem] flex-1 truncate rounded bg-transparent px-1 text-sm font-medium outline-none transition-colors hover:bg-[var(--accent)]/40 focus:bg-[var(--accent)]/40 focus:ring-1 focus:ring-[var(--ring)] sm:min-w-[7rem]"
        />

        <button
          type="button"
          className={cn(
            "relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[0.625rem] ring-1 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
            isVectorExcluded
              ? "bg-rose-400/10 text-rose-400 ring-rose-400/20"
              : isVectorized
                ? "bg-emerald-400/10 text-emerald-400 ring-emerald-400/20"
                : "bg-[var(--background)]/55 text-[var(--muted-foreground)] ring-[var(--border)] hover:text-[var(--foreground)]",
          )}
          title={vectorStatusTitle}
          aria-label={vectorStatusTitle}
          onMouseEnter={() => setShowVectorStatus(true)}
          onMouseLeave={() => setShowVectorStatus(false)}
          onFocus={() => setShowVectorStatus(true)}
          onBlur={() => setShowVectorStatus(false)}
          onClick={(e) => {
            e.stopPropagation();
            setShowVectorStatus(true);
          }}
        >
          {isVectorExcluded ? (
            <Ban size="0.75rem" />
          ) : isVectorized ? (
            <CheckCircle2 size="0.75rem" />
          ) : (
            <CircleDashed size="0.75rem" />
          )}
          {showVectorStatus && (
            <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--popover)] px-2 py-1 text-[0.625rem] font-medium text-[var(--popover-foreground)] shadow-lg ring-1 ring-[var(--border)]">
              {vectorStatusLabel}
            </span>
          )}
        </button>

        <div ref={mobileControlsRef} className="relative shrink-0 md:hidden" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            aria-label="Entry quick controls"
            aria-expanded={showMobileControls}
            title="Entry quick controls"
            onClick={() => setShowMobileControls((current) => !current)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
              showMobileControls && "bg-[var(--accent)] text-[var(--foreground)]",
            )}
          >
            <MoreHorizontal size="0.875rem" />
          </button>

          {showMobileControls && (
            <div className="absolute right-0 top-full z-30 mt-1 w-64 max-w-[calc(100vw-2rem)] space-y-2 rounded-xl border border-[var(--border)] bg-[var(--popover)] p-3 text-[var(--popover-foreground)] shadow-xl">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2">
                <p className="text-[0.6875rem] font-semibold">Entry controls</p>
                <button
                  type="button"
                  onClick={() => setShowMobileControls(false)}
                  className="rounded px-1.5 py-0.5 text-[0.625rem] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                >
                  Done
                </button>
              </div>

              <MobileSelect
                label="Position"
                value={String(localPosition)}
                onChange={(v) => {
                  const n = Number(v);
                  setLocalPosition(n);
                  patch({ position: n });
                }}
                options={[
                  { value: "0", label: "Before chat" },
                  { value: "1", label: "After chat" },
                  { value: "2", label: "@ Depth" },
                ]}
              />
              {showDepthInput && (
                <MobileNumber
                  label="Depth"
                  value={localDepth}
                  onCommit={(n) => {
                    setLocalDepth(n);
                    patch({ depth: n });
                  }}
                  min={0}
                  max={9999}
                />
              )}
              <MobileNumber
                label="Order"
                value={localOrder}
                onCommit={(n) => {
                  setLocalOrder(n);
                  patch({ order: n });
                }}
              />
              <MobileNumber
                label="Probability"
                value={localProbability}
                onCommit={(n) => {
                  const clamped = Math.max(0, Math.min(100, n));
                  setLocalProbability(clamped);
                  patch({ probability: clamped === 100 ? null : clamped });
                }}
                min={0}
                max={100}
                suffix="%"
              />
              {folders.length > 0 && (
                <MobileSelect
                  label="Folder"
                  value={entry.folderId ?? ""}
                  onChange={(v) => patch({ folderId: v === "" ? null : v })}
                  options={[{ value: "", label: "(none)" }, ...folders.map((f) => ({ value: f.id, label: f.name }))]}
                />
              )}
            </div>
          )}
        </div>

        {/* Lock badge (display-only on the row; toggled inside the drawer) */}
        {entry.locked && (
          <span
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-400/15 text-sky-400 ring-1 ring-sky-400/20"
            title="Locked entry"
            aria-label="Locked entry"
          >
            <Lock size="0.75rem" />
          </span>
        )}

        {/* ── Inline editable controls cluster ── */}
        {/* Hidden on very narrow viewports to keep the row from overflowing.
            Users on mobile can expand the drawer to access them. */}
        <div className="hidden shrink-0 items-center gap-0.5 md:flex" onClick={(e) => e.stopPropagation()}>
          <CompactSelect
            value={String(localPosition)}
            onChange={(v) => {
              const n = Number(v);
              setLocalPosition(n);
              patch({ position: n });
            }}
            title="Position in the prompt: Before Chat, After Chat, or @ Depth (injected into chat history)."
            options={[
              { value: "0", label: "↑Char" },
              { value: "1", label: "↓Char" },
              { value: "2", label: "@Depth" },
            ]}
            className="w-[4.35rem]"
          />
          {showDepthInput && (
            <CompactNumber
              value={localDepth}
              onCommit={(n) => {
                setLocalDepth(n);
                patch({ depth: n });
              }}
              title="Depth (messages back from the latest) where this entry is injected."
              ariaLabel="Depth"
              prefix="d"
              min={0}
              max={9999}
            />
          )}
          <CompactNumber
            value={localOrder}
            onCommit={(n) => {
              setLocalOrder(n);
              patch({ order: n });
            }}
            title="Insertion order when multiple entries activate (lower = earlier in prompt)."
            ariaLabel="Order"
            prefix="ord"
          />
          <CompactNumber
            value={localProbability}
            onCommit={(n) => {
              const clamped = Math.max(0, Math.min(100, n));
              setLocalProbability(clamped);
              // null = always-fire is the schema default. Save 100 as null
              // for parity with how new entries are created.
              patch({ probability: clamped === 100 ? null : clamped });
            }}
            title="Trigger probability (0–100%). 100% always fires when keys match."
            ariaLabel="Trigger probability"
            prefix="p"
            suffix="%"
            min={0}
            max={100}
          />
          {folders.length > 0 && (
            <CompactSelect
              value={entry.folderId ?? ""}
              onChange={(v) => patch({ folderId: v === "" ? null : v })}
              title="Move this entry to a different folder. (none) = root level."
              options={[{ value: "", label: "(none)" }, ...folders.map((f) => ({ value: f.id, label: f.name }))]}
              className="w-[5.5rem] sm:w-[6.25rem]"
            />
          )}
        </div>

        {/* Token estimate (compact) */}
        <span
          className="hidden shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[0.625rem] text-[var(--muted-foreground)] lg:inline-flex"
          title={`~${estimateTokens(entry.content).toLocaleString()} tokens (estimated)`}
        >
          <Hash size="0.5625rem" />
          {estimateTokens(entry.content).toLocaleString()}
        </span>

        {/* Duplicate button (visible on hover, always on mobile) */}
        <button
          type="button"
          aria-label="Duplicate entry"
          title="Duplicate entry"
          onClick={handleDuplicate}
          disabled={duplicateEntry.isPending}
          className="shrink-0 rounded p-1 text-[var(--muted-foreground)] opacity-0 transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] group-hover:opacity-100 disabled:opacity-40 max-md:opacity-100"
        >
          <Copy size="0.75rem" />
        </button>

        {/* Delete button (visible on hover, always on mobile) */}
        <button
          type="button"
          aria-label="Delete entry"
          onClick={handleDelete}
          className="shrink-0 rounded p-1 opacity-0 transition-all hover:bg-[var(--destructive)]/15 group-hover:opacity-100 max-md:opacity-100"
        >
          <Trash2 size="0.75rem" className="text-[var(--destructive)]" />
        </button>
      </div>

      {/* ── Expanded drawer ── */}
      {isExpanded && (
        <LorebookEntryDrawer
          entry={entry}
          lorebookId={lorebookId}
          characters={characters}
          characterTags={characterTags}
        />
      )}
    </div>
  );
}
