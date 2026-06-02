// ──────────────────────────────────────────────
// Summary Popover — View / edit / generate chat summary
// Shown via the scroll icon in the chat header bar.
// ──────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  useBulkSetMessagesHiddenFromAI,
  useChat,
  useGenerateSummary,
  useUpdateChatMetadata,
} from "../../../../catalog/chats/index";
import {
  AlertTriangle,
  Check,
  Copy,
  Info,
  Loader2,
  PenLine,
  Plus,
  Save,
  ScrollText,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { cn, generateClientId } from "../../../../../shared/lib/utils";
import { useUIStore } from "../../../../../shared/stores/ui.store";
import {
  appendChatSummaryEntryToMetadata,
  compileChatSummaryEntries,
  estimateChatSummaryTokens,
  normalizeChatSummaryMetadata,
} from "../../../../../engine/shared/text/chat-summary-entries";
import type { ChatSummaryEntry, ChatSummaryPromptTemplate } from "../../../../../engine/contracts/types/chat";
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
const SUMMARY_TOKEN_WARNING_THRESHOLD = 1800;

function clampSummaryCount(value: number) {
  return Math.max(MIN_SUMMARY_MESSAGES, Math.min(MAX_SUMMARY_MESSAGES, Math.round(value)));
}

function parsePositiveInteger(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    const rounded = Math.round(tokens / 100) / 10;
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}k`;
  }
  return String(tokens);
}

function summaryEntryMetaLine(entry: ChatSummaryEntry): string {
  const details: string[] = [];
  if (entry.sourceMode === "range" && entry.rangeStartIndex && entry.rangeEndIndex) {
    details.push(`Messages ${entry.rangeStartIndex}-${entry.rangeEndIndex}`);
  } else if (entry.sourceMode === "last" && entry.messageCount) {
    details.push(`${entry.messageCount} ${entry.messageCount === 1 ? "message" : "messages"}`);
  } else if (entry.sourceMode === "agent") {
    details.push("Agent");
  }
  details.push(`~${formatTokenCount(entry.tokenEstimate)} tokens`);
  return details.join(" | ");
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
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [draft, setDraft] = useState(summary ?? "");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateNameDraft, setTemplateNameDraft] = useState("");
  const [templatePromptDraft, setTemplatePromptDraft] = useState("");
  const summaryPopoverSettings = useUIStore((s) => s.summaryPopoverSettings);
  const setSummaryPopoverSettings = useUIStore((s) => s.setSummaryPopoverSettings);
  const chatQuery = useChat(chatId);
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
  }, [
    summaryPopoverSettings.rangeEnd,
    summaryPopoverSettings.rangeStart,
    summaryPopoverSettings.sourceMode,
    totalMessageCount,
  ]);

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
  const chatMetadata = useMemo<Record<string, unknown>>(
    () => (chatQuery.data?.metadata && typeof chatQuery.data.metadata === "object" ? chatQuery.data.metadata : {}),
    [chatQuery.data?.metadata],
  );
  const promptTemplates = useMemo<ChatSummaryPromptTemplate[]>(
    () =>
      Array.isArray(chatMetadata.summaryPromptTemplates)
        ? chatMetadata.summaryPromptTemplates.filter((template: unknown): template is ChatSummaryPromptTemplate => {
            if (!template || typeof template !== "object" || Array.isArray(template)) return false;
            const record = template as Record<string, unknown>;
            return (
              typeof record.id === "string" &&
              record.id.trim().length > 0 &&
              typeof record.name === "string" &&
              record.name.trim().length > 0 &&
              typeof record.prompt === "string" &&
              record.prompt.trim().length > 0
            );
          })
        : [],
    [chatMetadata],
  );
  const activeSummaryPromptTemplateId =
    typeof chatMetadata.activeSummaryPromptTemplateId === "string" ? chatMetadata.activeSummaryPromptTemplateId : "";
  const summaryEntries = useMemo(() => normalizeChatSummaryMetadata(chatMetadata).entries, [chatMetadata]);
  const enabledTokenEstimate = useMemo(
    () => summaryEntries.reduce((total, entry) => (entry.enabled ? total + entry.tokenEstimate : total), 0),
    [summaryEntries],
  );
  const disabledEntryCount = useMemo(() => summaryEntries.filter((entry) => !entry.enabled).length, [summaryEntries]);
  const tokenWarning = enabledTokenEstimate > SUMMARY_TOKEN_WARNING_THRESHOLD;
  const hasTemplateDraft = templateNameDraft.trim().length > 0 && templatePromptDraft.trim().length > 0;

  const resetTemplateDraft = useCallback(() => {
    setEditingTemplateId(null);
    setTemplateNameDraft("");
    setTemplatePromptDraft("");
  }, []);

  const persistPromptTemplates = useCallback(
    (templates: ChatSummaryPromptTemplate[], activeId: string | null) => {
      updateMeta.mutate({
        id: chatId,
        summaryPromptTemplates: templates,
        activeSummaryPromptTemplateId: activeId,
      });
    },
    [chatId, updateMeta],
  );

  const startNewPromptTemplate = useCallback(() => {
    resetTemplateDraft();
    setTemplateEditorOpen(true);
  }, [resetTemplateDraft]);

  const startEditPromptTemplate = useCallback((template: ChatSummaryPromptTemplate) => {
    setEditingTemplateId(template.id);
    setTemplateNameDraft(template.name);
    setTemplatePromptDraft(template.prompt);
    setTemplateEditorOpen(true);
  }, []);

  const duplicatePromptTemplate = useCallback(
    (template: ChatSummaryPromptTemplate) => {
      const nextTemplate = {
        id: generateClientId(),
        name: `${template.name} Copy`,
        prompt: template.prompt,
      };
      persistPromptTemplates([...promptTemplates, nextTemplate], nextTemplate.id);
      startEditPromptTemplate(nextTemplate);
    },
    [persistPromptTemplates, promptTemplates, startEditPromptTemplate],
  );

  const savePromptTemplate = useCallback(() => {
    const name = templateNameDraft.trim();
    const prompt = templatePromptDraft.trim();
    if (!name || !prompt) {
      setErrorText("Summary prompt templates need a name and prompt.");
      return;
    }
    const id = editingTemplateId ?? generateClientId();
    const nextTemplate = { id, name, prompt };
    const nextTemplates = editingTemplateId
      ? promptTemplates.map((template) => (template.id === editingTemplateId ? nextTemplate : template))
      : [...promptTemplates, nextTemplate];
    persistPromptTemplates(nextTemplates, id);
    resetTemplateDraft();
    setTemplateEditorOpen(false);
    setErrorText(null);
  }, [
    editingTemplateId,
    persistPromptTemplates,
    promptTemplates,
    resetTemplateDraft,
    templateNameDraft,
    templatePromptDraft,
  ]);

  const deletePromptTemplate = useCallback(
    (templateId: string) => {
      const nextTemplates = promptTemplates.filter((template) => template.id !== templateId);
      const nextActiveId = activeSummaryPromptTemplateId === templateId ? null : activeSummaryPromptTemplateId || null;
      persistPromptTemplates(nextTemplates, nextActiveId);
      if (editingTemplateId === templateId) {
        resetTemplateDraft();
        setTemplateEditorOpen(false);
      }
    },
    [activeSummaryPromptTemplateId, editingTemplateId, persistPromptTemplates, promptTemplates, resetTemplateDraft],
  );

  const maybeHideSummarizedMessages = useCallback(
    (messageIds: string[]) => {
      if (!summaryPopoverSettings.hideSummarizedMessages || messageIds.length === 0) return;
      bulkSetMessagesHiddenFromAI.mutate({ messageIds, hidden: true });
    },
    [bulkSetMessagesHiddenFromAI, summaryPopoverSettings.hideSummarizedMessages],
  );

  const handleGenerate = useCallback(() => {
    setErrorText(null);
    setEditingEntryId(null);
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
        {
          chatId,
          contextSize: normalizedLastSize,
          rangeStartIndex: rangeLow,
          rangeEndIndex: rangeHigh,
          promptTemplateId: activeSummaryPromptTemplateId || null,
        },
        {
          onSuccess: (data) => {
            setDraft(data.summary);
            setEditingEntryId(null);
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
      { chatId, contextSize: normalizedLastSize, promptTemplateId: activeSummaryPromptTemplateId || null },
      {
        onSuccess: (data) => {
          setDraft(data.summary);
          setEditingEntryId(null);
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
    activeSummaryPromptTemplateId,
    summaryPopoverSettings.sourceMode,
    totalMessageCount,
  ]);

  const patchSummaryEntries = useCallback(
    (entries: ChatSummaryEntry[]) => {
      updateMeta.mutate({ id: chatId, summary: compileChatSummaryEntries(entries), summaryEntries: entries });
    },
    [chatId, updateMeta],
  );

  const handleSave = useCallback(() => {
    const content = draft.trim();
    if (editingEntryId) {
      const now = new Date().toISOString();
      const nextEntries = content
        ? summaryEntries.map((entry) =>
            entry.id === editingEntryId
              ? { ...entry, content, tokenEstimate: estimateChatSummaryTokens(content), updatedAt: now }
              : entry,
          )
        : summaryEntries.filter((entry) => entry.id !== editingEntryId);
      patchSummaryEntries(nextEntries);
      setEditingEntryId(null);
      setEditing(false);
      return;
    }
    if (!content) {
      updateMeta.mutate({ id: chatId, summary: null, summaryEntries: [] });
      setEditing(false);
      return;
    }
    const appended = appendChatSummaryEntryToMetadata(chatMetadata, {
      content,
      origin: "manual",
      sourceMode: "last",
      title: "Manual summary",
    });
    updateMeta.mutate({ id: chatId, summary: appended.summary, summaryEntries: appended.entries });
    setEditingEntryId(null);
    setEditing(false);
  }, [chatId, chatMetadata, draft, editingEntryId, patchSummaryEntries, summaryEntries, updateMeta]);

  const toggleEntry = useCallback(
    (entryId: string) => {
      patchSummaryEntries(
        summaryEntries.map((entry) =>
          entry.id === entryId ? { ...entry, enabled: !entry.enabled, updatedAt: new Date().toISOString() } : entry,
        ),
      );
    },
    [patchSummaryEntries, summaryEntries],
  );

  const deleteEntry = useCallback(
    (entryId: string) => {
      patchSummaryEntries(summaryEntries.filter((entry) => entry.id !== entryId));
    },
    [patchSummaryEntries, summaryEntries],
  );

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
              <label className="block space-y-1">
                <span className="flex items-center justify-between gap-2 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                  Prompt
                  <button
                    type="button"
                    onClick={startNewPromptTemplate}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.625rem] text-[var(--foreground)] hover:bg-[var(--accent)]"
                    title="Create summary prompt template"
                  >
                    <Plus size="0.625rem" />
                    New
                  </button>
                </span>
                <div className="flex gap-1.5">
                  <select
                    value={activeSummaryPromptTemplateId}
                    onChange={(e) => persistPromptTemplates(promptTemplates, e.target.value || null)}
                    className="min-w-0 flex-1 rounded-md bg-[var(--secondary)] px-2 py-1 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  >
                    <option value="">Default chat-summary prompt</option>
                    {promptTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  {activeSummaryPromptTemplateId && (
                    <button
                      type="button"
                      onClick={() => {
                        const template = promptTemplates.find((item) => item.id === activeSummaryPromptTemplateId);
                        if (template) startEditPromptTemplate(template);
                      }}
                      aria-label="Edit selected prompt template"
                      className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                      title="Edit selected prompt template"
                    >
                      <PenLine size="0.75rem" />
                    </button>
                  )}
                </div>
              </label>
              {(promptTemplates.length > 0 || templateEditorOpen) && (
                <div className="space-y-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/40 p-2">
                  {promptTemplates.map((template) => (
                    <div key={template.id} className="flex items-center gap-1 rounded-md px-1 py-1">
                      <button
                        type="button"
                        onClick={() => persistPromptTemplates(promptTemplates, template.id)}
                        className="min-w-0 flex-1 text-left"
                        title={`Use ${template.name}`}
                      >
                        <span className="block truncate text-[0.6875rem] font-semibold text-[var(--foreground)]/90">
                          {template.name}
                        </span>
                        <span className="block truncate text-[0.5625rem] text-[var(--muted-foreground)]">
                          {template.prompt}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicatePromptTemplate(template)}
                        aria-label={`Duplicate prompt template ${template.name}`}
                        className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                        title="Duplicate prompt template"
                      >
                        <Copy size="0.625rem" />
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditPromptTemplate(template)}
                        aria-label={`Edit prompt template ${template.name}`}
                        className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                        title="Edit prompt template"
                      >
                        <PenLine size="0.625rem" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePromptTemplate(template.id)}
                        aria-label={`Delete prompt template ${template.name}`}
                        className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                        title="Delete prompt template"
                      >
                        <Trash2 size="0.625rem" />
                      </button>
                    </div>
                  ))}
                  {templateEditorOpen && (
                    <div className="space-y-1.5 border-t border-[var(--border)] pt-2">
                      <input
                        value={templateNameDraft}
                        onChange={(e) => setTemplateNameDraft(e.target.value)}
                        className="w-full rounded-md bg-[var(--card)] px-2 py-1 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                        placeholder="Template name"
                      />
                      <textarea
                        value={templatePromptDraft}
                        onChange={(e) => setTemplatePromptDraft(e.target.value)}
                        rows={4}
                        className="max-h-36 min-h-20 w-full resize-y rounded-md bg-[var(--card)] p-2 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                        placeholder="Write a summary prompt template..."
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            resetTemplateDraft();
                            setTemplateEditorOpen(false);
                          }}
                          className="rounded-md px-2 py-1 text-[0.625rem] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={savePromptTemplate}
                          disabled={!hasTemplateDraft || updateMeta.isPending}
                          className="inline-flex items-center gap-1 rounded-md bg-[var(--secondary)] px-2 py-1 text-[0.625rem] font-semibold text-[var(--foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Save size="0.625rem" />
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
          {summaryEntries.length > 0 && (
            <div
              className={cn(
                "mb-2 flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-[0.6875rem]",
                tokenWarning
                  ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                  : "border-[var(--border)] bg-[var(--secondary)]/50 text-[var(--muted-foreground)]",
              )}
            >
              <span>
                {summaryEntries.length} summary {summaryEntries.length === 1 ? "entry" : "entries"}
                {disabledEntryCount > 0 ? `, ${disabledEntryCount} disabled` : ""}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
                {tokenWarning && <AlertTriangle size="0.6875rem" />}~{formatTokenCount(enabledTokenEstimate)} tokens
              </span>
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
                    setEditingEntryId(null);
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
              {summaryEntries.length > 0 && (
                <div className="mb-2 space-y-1.5">
                  {summaryEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/50 px-2 py-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleEntry(entry.id)}
                          className={cn(
                            "h-3 w-3 rounded-sm border",
                            entry.enabled
                              ? "border-amber-400 bg-amber-400"
                              : "border-[var(--muted-foreground)] bg-transparent",
                          )}
                          title={entry.enabled ? "Disable summary entry" : "Enable summary entry"}
                          aria-label={entry.enabled ? "Disable summary entry" : "Enable summary entry"}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setDraft(entry.content);
                            setEditingEntryId(entry.id);
                            setEditing(true);
                          }}
                          className={cn(
                            "min-w-0 flex-1 text-left hover:underline",
                            entry.enabled ? "text-[var(--foreground)]/85" : "text-[var(--muted-foreground)]",
                          )}
                          title="Edit summary entry"
                        >
                          <span className="block truncate text-[0.6875rem] font-medium">{entry.title}</span>
                          <span className="block truncate text-[0.5625rem] text-[var(--muted-foreground)]">
                            {summaryEntryMetaLine(entry)}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEntry(entry.id)}
                          className="rounded p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                          title="Delete summary entry"
                          aria-label="Delete summary entry"
                        >
                          <X size="0.6875rem" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
