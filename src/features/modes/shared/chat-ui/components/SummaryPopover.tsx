// ──────────────────────────────────────────────
// Summary Popover — View / edit / generate chat summary
// Shown via the scroll icon in the chat header bar.
// ──────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useBulkSetMessagesHiddenFromAI, useGenerateSummary, useUpdateChatMetadata } from "../../../../catalog/chats/index";
import { Check, Info, Loader2, Save, ScrollText, Settings2, Sparkles, X } from "lucide-react";
import { cn } from "../../../../../shared/lib/utils";
import { useUIStore } from "../../../../../shared/stores/ui.store";
import type { SummaryPopoverSourceMode } from "../../../../../shared/stores/ui.store";

interface SummaryPopoverProps {
  chatId: string;
  summary: string | null;
  contextSize: number;
  totalMessageCount: number;
  onContextSizeChange: (size: number) => void;
  onClose: () => void;
}

const MIN_SUMMARY_MESSAGES = 5;
const MAX_SUMMARY_MESSAGES = 200;

function clampSummaryCount(value: number) {
  return Math.max(MIN_SUMMARY_MESSAGES, Math.min(MAX_SUMMARY_MESSAGES, Math.round(value)));
}

function parsePositiveInteger(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function SummaryPopover({
  chatId,
  summary,
  contextSize,
  totalMessageCount,
  onContextSizeChange,
  onClose,
}: SummaryPopoverProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(summary ?? "");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const summaryPopoverSettings = useUIStore((s) => s.summaryPopoverSettings);
  const setSummaryPopoverSettings = useUIStore((s) => s.setSummaryPopoverSettings);
  const persistedContextSize = clampSummaryCount(summaryPopoverSettings.contextSize ?? contextSize ?? 50);
  const [localSize, setLocalSize] = useState(String(persistedContextSize));
  const [rangeStart, setRangeStart] = useState(String(summaryPopoverSettings.rangeStart ?? 1));
  const [rangeEnd, setRangeEnd] = useState(String(summaryPopoverSettings.rangeEnd ?? Math.max(1, totalMessageCount)));
  const sizeInputFocused = useRef(false);
  const generateSummary = useGenerateSummary();
  const bulkSetMessagesHiddenFromAI = useBulkSetMessagesHiddenFromAI(chatId);
  const updateMeta = useUpdateChatMetadata();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const updateSourceMode = useCallback(
    (sourceMode: SummaryPopoverSourceMode) => {
      setSummaryPopoverSettings({ sourceMode });
      setErrorText(null);
    },
    [setSummaryPopoverSettings],
  );

  const persistContextSize = useCallback(
    (size: number) => {
      const clamped = clampSummaryCount(size);
      setLocalSize(String(clamped));
      setSummaryPopoverSettings({ contextSize: clamped });
      onContextSizeChange(clamped);
    },
    [onContextSizeChange, setSummaryPopoverSettings],
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const raf = requestAnimationFrame(() => {
      document.addEventListener("mousedown", handler);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    setDraft(summary ?? "");
  }, [summary]);

  useEffect(() => {
    if (!sizeInputFocused.current) {
      setLocalSize(String(persistedContextSize));
    }
  }, [persistedContextSize]);

  useEffect(() => {
    if (summaryPopoverSettings.sourceMode !== "range") return;
    const fallbackEnd = Math.max(1, totalMessageCount);
    setRangeStart(String(summaryPopoverSettings.rangeStart ?? 1));
    setRangeEnd(String(summaryPopoverSettings.rangeEnd ?? fallbackEnd));
  }, [summaryPopoverSettings.rangeEnd, summaryPopoverSettings.rangeStart, summaryPopoverSettings.sourceMode, totalMessageCount]);

  useEffect(() => {
    if (editing) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [editing]);

  const normalizedLastSize = clampSummaryCount(parsePositiveInteger(localSize) ?? persistedContextSize);
  const normalizedRangeStart = Math.max(1, Math.min(totalMessageCount || 1, parsePositiveInteger(rangeStart) ?? 1));
  const normalizedRangeEnd = Math.max(
    1,
    Math.min(totalMessageCount || 1, parsePositiveInteger(rangeEnd) ?? (totalMessageCount || 1)),
  );
  const rangeLow = Math.min(normalizedRangeStart, normalizedRangeEnd);
  const rangeHigh = Math.max(normalizedRangeStart, normalizedRangeEnd);
  const selectedRangeCount = totalMessageCount > 0 ? rangeHigh - rangeLow + 1 : 0;
  const rangeTooLarge = selectedRangeCount > MAX_SUMMARY_MESSAGES;
  const sourceSummary =
    summaryPopoverSettings.sourceMode === "range"
      ? totalMessageCount > 0
        ? `Messages ${rangeLow}-${rangeHigh} of ${totalMessageCount}`
        : "No messages yet"
      : totalMessageCount > 0
        ? `Last ${Math.min(normalizedLastSize, totalMessageCount)} of ${totalMessageCount} messages`
        : "No messages yet";

  const maybeHideSummarizedMessages = useCallback(
    (messageIds: string[]) => {
      if (!summaryPopoverSettings.hideSummarizedMessages || messageIds.length === 0) return;
      bulkSetMessagesHiddenFromAI.mutate({ messageIds, hidden: true });
    },
    [bulkSetMessagesHiddenFromAI, summaryPopoverSettings.hideSummarizedMessages],
  );

  const handleGenerate = useCallback(() => {
    setErrorText(null);
    if (summaryPopoverSettings.sourceMode === "range") {
      if (totalMessageCount === 0) {
        setErrorText("No messages available for summary generation.");
        return;
      }
      if (rangeTooLarge) {
        setErrorText(`Choose ${MAX_SUMMARY_MESSAGES} messages or fewer.`);
        return;
      }
      setSummaryPopoverSettings({ rangeStart: rangeLow, rangeEnd: rangeHigh });
      generateSummary.mutate(
        { chatId, contextSize: normalizedLastSize, rangeStartIndex: rangeLow, rangeEndIndex: rangeHigh },
        {
          onSuccess: (data) => {
            setDraft(data.summary);
            setEditing(false);
            maybeHideSummarizedMessages(data.messageIds);
          },
          onError: (error) => setErrorText(error instanceof Error ? error.message : "Could not generate summary."),
        },
      );
      return;
    }

    persistContextSize(normalizedLastSize);
    generateSummary.mutate(
      { chatId, contextSize: normalizedLastSize },
      {
        onSuccess: (data) => {
          setDraft(data.summary);
          setEditing(false);
          maybeHideSummarizedMessages(data.messageIds);
        },
        onError: (error) => setErrorText(error instanceof Error ? error.message : "Could not generate summary."),
      },
    );
  }, [
    chatId,
    generateSummary,
    maybeHideSummarizedMessages,
    normalizedLastSize,
    persistContextSize,
    rangeHigh,
    rangeLow,
    rangeTooLarge,
    setSummaryPopoverSettings,
    summaryPopoverSettings.sourceMode,
    totalMessageCount,
  ]);

  const handleSave = useCallback(() => {
    updateMeta.mutate({ id: chatId, summary: draft || null });
    setEditing(false);
  }, [chatId, draft, updateMeta]);

  const isGenerating = generateSummary.isPending;
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const content = (
    <div
      ref={panelRef}
      onMouseDown={(e) => e.stopPropagation()}
      className={cn(
        isMobile
          ? "fixed inset-0 z-[9999] flex items-center justify-center p-4 max-md:pt-[max(1rem,env(safe-area-inset-top))]"
          : "absolute right-0 top-full z-[100] mt-1",
      )}
    >
      {isMobile && <div className="absolute inset-0 bg-black/30" onClick={onClose} />}
      <div
        className={cn(
          "rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl shadow-black/40",
          isMobile ? "relative max-h-[calc(100dvh-4rem)] w-full max-w-sm overflow-y-auto" : "w-96",
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <ScrollText size="0.8125rem" className="text-amber-400" />
            Chat Summary
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSettingsOpen((open) => !open)}
              className={cn(
                "rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                settingsOpen && "bg-[var(--accent)] text-[var(--foreground)]",
              )}
              title="Summary settings"
            >
              <Settings2 size="0.75rem" />
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className={cn(
                "flex items-center gap-1 rounded-lg px-2 py-1 text-[0.625rem] font-medium transition-all",
                isGenerating
                  ? "cursor-wait text-amber-300/60"
                  : "text-amber-300 hover:bg-amber-400/15 hover:text-amber-200",
              )}
              title="Generate summary with AI"
            >
              {isGenerating ? <Loader2 size="0.6875rem" className="animate-spin" /> : <Sparkles size="0.6875rem" />}
              {isGenerating ? "Generating..." : "Generate"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            >
              <X size="0.75rem" />
            </button>
          </div>
        </div>

        {settingsOpen && (
          <div className="space-y-3 border-b border-[var(--border)] px-3 py-3">
            <div className="grid grid-cols-2 rounded-lg bg-[var(--secondary)] p-0.5 text-[0.6875rem] font-medium">
              {(["last", "range"] as SummaryPopoverSourceMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => updateSourceMode(mode)}
                  className={cn(
                    "rounded-md px-2 py-1 transition-colors",
                    summaryPopoverSettings.sourceMode === mode
                      ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                  )}
                >
                  {mode === "last" ? "Last" : "Range"}
                </button>
              ))}
            </div>

            {summaryPopoverSettings.sourceMode === "last" ? (
              <label className="block space-y-1">
                <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Messages</span>
                <input
                  type="number"
                  min={MIN_SUMMARY_MESSAGES}
                  max={MAX_SUMMARY_MESSAGES}
                  value={localSize}
                  onFocus={() => {
                    sizeInputFocused.current = true;
                  }}
                  onChange={(e) => setLocalSize(e.target.value)}
                  onBlur={() => {
                    sizeInputFocused.current = false;
                    persistContextSize(parsePositiveInteger(localSize) ?? 50);
                  }}
                  className="w-full rounded-md bg-[var(--secondary)] px-2 py-1 text-xs tabular-nums ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </label>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1">
                    <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Start</span>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, totalMessageCount)}
                      value={rangeStart}
                      onChange={(e) => setRangeStart(e.target.value)}
                      onBlur={() => setSummaryPopoverSettings({ rangeStart: normalizedRangeStart })}
                      className="w-full rounded-md bg-[var(--secondary)] px-2 py-1 text-xs tabular-nums ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">End</span>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, totalMessageCount)}
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(e.target.value)}
                      onBlur={() => setSummaryPopoverSettings({ rangeEnd: normalizedRangeEnd })}
                      className="w-full rounded-md bg-[var(--secondary)] px-2 py-1 text-xs tabular-nums ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    />
                  </label>
                </div>
                {rangeTooLarge && (
                  <p className="text-[0.625rem] leading-snug text-[var(--destructive)]">
                    Choose {MAX_SUMMARY_MESSAGES} messages or fewer.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[0.6875rem] text-[var(--foreground)]/80">
                <input
                  type="checkbox"
                  checked={summaryPopoverSettings.hideSummarizedMessages}
                  onChange={(e) => setSummaryPopoverSettings({ hideSummarizedMessages: e.target.checked })}
                  className="h-3.5 w-3.5 accent-amber-400"
                />
                Hide summarized messages from AI
              </label>
              <label className="flex items-center gap-2 text-[0.6875rem] text-[var(--foreground)]/80">
                <input
                  type="checkbox"
                  checked={summaryPopoverSettings.collapseHiddenMessages}
                  onChange={(e) => setSummaryPopoverSettings({ collapseHiddenMessages: e.target.checked })}
                  className="h-3.5 w-3.5 accent-amber-400"
                />
                Collapse hidden messages
              </label>
            </div>

            <p className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">{sourceSummary}</p>
          </div>
        )}

        <div className="max-h-72 overflow-y-auto p-3">
          {errorText && (
            <div className="mb-2 rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-2 py-1.5 text-[0.6875rem] text-[var(--destructive)]">
              {errorText}
            </div>
          )}
          {bulkSetMessagesHiddenFromAI.isSuccess && summaryPopoverSettings.hideSummarizedMessages && (
            <div className="mb-2 flex items-center gap-1.5 rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-1.5 text-[0.6875rem] text-amber-300">
              <Check size="0.6875rem" />
              Summarized messages hidden from AI.
            </div>
          )}
          {editing ? (
            <div className="space-y-2">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={6}
                className="max-h-48 w-full resize-y rounded-lg bg-[var(--secondary)] p-2.5 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                placeholder="Write or paste a summary of this chat..."
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(summary ?? "");
                    setEditing(false);
                  }}
                  className="rounded-lg px-2.5 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={updateMeta.isPending}
                  className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-1 text-[0.625rem] font-medium text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98] disabled:opacity-50"
                >
                  <Save size="0.625rem" />
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div>
              {draft ? (
                <div
                  className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-[var(--accent)]"
                  onClick={() => setEditing(true)}
                  title="Click to edit"
                >
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--foreground)]/80">{draft}</p>
                </div>
              ) : (
                <div
                  className="cursor-pointer rounded-lg p-4 transition-colors hover:bg-[var(--accent)]"
                  onClick={() => setEditing(true)}
                >
                  <p className="text-center text-xs italic text-[var(--muted-foreground)]">
                    No summary yet. Click to write one, or press Generate.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--border)] px-3 py-2">
          <p className="flex items-start gap-1.5 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            <Info size="0.6875rem" className="mt-0.5 shrink-0 text-amber-400/70" />
            <span>
              Manual summaries append to rolling summary entries. Hidden messages are excluded from generated summaries.
            </span>
          </p>
        </div>
      </div>
    </div>
  );

  return isMobile ? createPortal(content, document.body) : content;
}
