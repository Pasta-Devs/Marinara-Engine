// ──────────────────────────────────────────────
// Agent Suite — view and edit everything the agents in the
// active chat have stored (memory, tracker state, custom
// outputs), manually or via AI-assisted selection rewrites.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Paperclip,
  RotateCcw,
  Save,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import type { Chat, GameState } from "@marinara-engine/shared";
import {
  useAgentMemory,
  useAgentSuiteRewrite,
  useCustomAgentRuns,
  useUpdateAgentMemory,
  useUpdateAgentRunData,
  agentKeys,
  type AgentRunRow,
} from "../../hooks/use-agents";
import { useCharacters } from "../../hooks/use-characters";
import { useConnections } from "../../hooks/use-connections";
import { useEntriesAcrossLorebooks, useLorebooks } from "../../hooks/use-lorebooks";
import { api } from "../../lib/api-client";
import { showConfirmDialog } from "../../lib/app-dialogs";
import {
  deriveActiveLorebookViews,
  getChatActiveLorebookIds,
  getChatExcludedLorebookIds,
} from "../../lib/chat-lorebooks";
import { getChatCharacterIds } from "../../lib/chat-macros";
import { filterLanguageGenerationConnections } from "../../lib/connection-filters";
import { AGENT_SUITE_TRACKER_SLICES } from "../../lib/agent-suite-tracker-slices";
import { cn } from "../../lib/utils";
import { useAgentStore } from "../../stores/agent.store";
import { useChatStore } from "../../stores/chat.store";
import { useGameStateStore } from "../../stores/game-state.store";
import { Modal } from "../ui/Modal";
import { useTranslation as useUiTranslation } from "react-i18next";

export interface AgentSuiteAgent {
  id: string;
  name: string;
  description: string;
  category: string;
  builtIn: boolean;
}

interface AgentSuiteModalProps {
  chat: Chat;
  open: boolean;
  onClose: () => void;
  onCloseGuardChange?: (guard: (() => Promise<boolean>) | null) => void;
  agents: AgentSuiteAgent[];
}

type ConnectionOption = {
  id: string;
  name: string;
  model?: string | null;
  provider?: string | null;
  defaultForAgents?: boolean | string | null;
};

const MAX_REWRITE_SELECTION_CHARS = 50000;
const MAX_REWRITE_DOCUMENT_CHARS = 100000;
const MAX_CONTEXT_SECTION_CHARS = 20000;
const MAX_CONTEXT_TOTAL_CHARS = 100000;
const MAX_CONTEXT_SECTIONS = 20;
const CONTEXT_TRUNCATION_MARKER = "\n…[truncated for length]";

/** A selectable grounding source for AI rewrites (character card, lorebook entry). */
type ContextSource = {
  key: string;
  group: string;
  /** Short name shown in the picker (the group header carries the rest). */
  display: string;
  /** Full label sent to the model. */
  label: string;
  content: string;
};

function clampContextContent(content: string): string {
  if (content.length <= MAX_CONTEXT_SECTION_CHARS) return content;
  // Strip a lone trailing high surrogate so the cut never splits an emoji
  // (same guard as tool-executor.ts / chat-summary-entries.ts truncation).
  const head = content
    .slice(0, MAX_CONTEXT_SECTION_CHARS - CONTEXT_TRUNCATION_MARKER.length)
    .replace(/[\uD800-\uDBFF]$/, "");
  return head + CONTEXT_TRUNCATION_MARKER;
}

const MAX_CONTEXT_LABEL_CHARS = 200;

function clampContextLabel(label: string): string {
  if (label.length <= MAX_CONTEXT_LABEL_CHARS) return label;
  return `${label.slice(0, MAX_CONTEXT_LABEL_CHARS - 1).replace(/[\uD800-\uDBFF]$/, "")}…`;
}

const CATEGORY_LABELS: Record<string, string> = {
  writer: "Writer",
  tracker: "Tracker",
  misc: "Misc",
  custom: "Custom",
};

function serializeValue(value: unknown, mode: "text" | "json"): string {
  if (mode === "text") return typeof value === "string" ? value : String(value ?? "");
  return JSON.stringify(value ?? null, null, 2);
}

function formatRunTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Editable data block with AI-assisted selection rewrite ──

interface DataBlockProps {
  blockId: string;
  label: string;
  description?: string;
  mode: "text" | "json";
  value: string;
  onSave: (draft: string) => Promise<void>;
  onDirtyChange: (blockId: string, dirty: boolean) => void;
  disabled: boolean;
  agentName: string;
  connectionOptions: ConnectionOption[];
  rewriteConnectionId: string;
  onRewriteConnectionChange: (id: string) => void;
  contextPicker: ReactNode;
  contextCount: number;
  contextOverLimit: boolean;
  buildContextSections: () => Array<{ label: string; content: string }>;
}

function DataBlock({
  blockId,
  label,
  description,
  mode,
  value,
  onSave,
  onDirtyChange,
  disabled,
  agentName,
  connectionOptions,
  rewriteConnectionId,
  onRewriteConnectionChange,
  contextPicker,
  contextCount,
  contextOverLimit,
  buildContextSections,
}: DataBlockProps) {
  const { t: localizeUi } = useUiTranslation();
  const rewrite = useAgentSuiteRewrite();

  // draft === null means pristine: the textarea mirrors the server value and
  // silently follows refetches. Any edit detaches it until Save or Reset.
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [selection, setSelection] = useState<{ start: number; end: number; sourceText: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentText = draft ?? value;
  const isDirty = draft !== null && draft !== value;
  const busy = saving || rewrite.isPending;

  // Report dirty state so the modal can guard close/agent-switch transitions.
  useEffect(() => {
    onDirtyChange(blockId, isDirty);
    return () => onDirtyChange(blockId, false);
  }, [blockId, isDirty, onDirtyChange]);

  const captureSelection = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    setSelection(
      el.selectionStart !== el.selectionEnd
        ? { start: el.selectionStart, end: el.selectionEnd, sourceText: currentText }
        : null,
    );
  }, [currentText]);

  const handleSave = useCallback(async () => {
    if (!isDirty || busy) return;
    if (mode === "json") {
      try {
        JSON.parse(currentText);
      } catch (err) {
        setError(err instanceof Error ? `Invalid JSON: ${err.message}` : "Invalid JSON");
        return;
      }
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(currentText);
      setDraft(null);
      setSelection(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [busy, currentText, isDirty, mode, onSave]);

  const handleRewrite = useCallback(async () => {
    if (busy || !instruction.trim() || !rewriteConnectionId) return;
    const text = currentText;
    const clamped =
      selection && selection.sourceText === text && selection.start < selection.end && selection.end <= text.length
        ? { start: selection.start, end: selection.end }
        : null;
    const selectedText = clamped ? text.slice(clamped.start, clamped.end) : text;
    if (!selectedText.trim()) {
      setError("There is no text to rewrite");
      return;
    }
    if (selectedText.length > MAX_REWRITE_SELECTION_CHARS) {
      setError(`Selection too large for AI rewrite (max ${MAX_REWRITE_SELECTION_CHARS.toLocaleString()} characters)`);
      return;
    }
    if (contextOverLimit) {
      setError(
        `Attached context is too large (max ${MAX_CONTEXT_SECTIONS} sources / ${MAX_CONTEXT_TOTAL_CHARS.toLocaleString()} characters) — deselect some sources`,
      );
      return;
    }
    setError(null);
    try {
      const contextSections = buildContextSections();
      const result = await rewrite.mutateAsync({
        connectionId: rewriteConnectionId,
        instruction: instruction.trim(),
        selectedText,
        documentText: clamped && text.length <= MAX_REWRITE_DOCUMENT_CHARS ? text : undefined,
        agentName,
        dataLabel: label,
        contextSections: contextSections.length > 0 ? contextSections : undefined,
      });
      const next = clamped
        ? text.slice(0, clamped.start) + result.rewrittenText + text.slice(clamped.end)
        : result.rewrittenText;
      setDraft(next);
      setSelection(null);
      toast.success(localizeUi("ui.chat.datablock.aiRewriteAppliedToTheDraftReviewAndSave"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI rewrite failed");
    }
  }, [
    agentName,
    buildContextSections,
    busy,
    contextOverLimit,
    currentText,
    instruction,
    label,
    rewrite,
    rewriteConnectionId,
    selection,
    localizeUi,
  ]);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/35 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="text-[0.6875rem] font-semibold">{label}</span>
            <span className="rounded bg-[var(--secondary)]/55 px-1 py-0.5 text-[0.5rem] uppercase tracking-wide text-[var(--muted-foreground)]">
              {mode === "json"
                ? localizeUi("ui.agents.tooleditor.json")
                : localizeUi("ui.chat.chatbranchselector.text")}
            </span>
            {isDirty && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]"
                title={localizeUi("ui.chat.datablock.unsavedChanges")}
              />
            )}
          </div>
          {description && <p className="text-[0.625rem] text-[var(--muted-foreground)]">{description}</p>}
        </div>
        <button
          type="button"
          onClick={() => {
            setAiOpen((open) => !open);
            setError(null);
          }}
          disabled={disabled}
          className={cn(
            "inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[0.625rem] font-medium ring-1 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50",
            aiOpen
              ? "bg-[var(--primary)]/10 text-[var(--primary)] ring-[var(--primary)]/30"
              : "bg-[var(--secondary)] text-[var(--foreground)] ring-[var(--border)] hover:bg-[var(--accent)]",
          )}
          title={localizeUi("ui.chat.datablock.rewriteASelectionOrAllOfThisTextWith")}
        >
          <Wand2 size="0.6875rem" />
          {localizeUi("ui.chat.datablock.aiEdit")}
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={currentText}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
          setSelection(null);
        }}
        onSelect={captureSelection}
        disabled={disabled || busy}
        rows={Math.min(14, Math.max(3, currentText.split("\n").length))}
        spellCheck={false}
        className="mt-2 w-full resize-y rounded-md border border-[var(--input)] bg-[var(--secondary)]/45 px-2 py-1.5 font-mono text-[0.625rem] leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)] disabled:opacity-60"
      />

      {aiOpen && (
        <div
          className="mt-2 space-y-2 rounded-md border border-[var(--primary)]/25 bg-[var(--primary)]/5 p-2"
          onKeyDown={(event) => {
            // Habitual Escape should close the AI panel, not the whole modal.
            if (event.key === "Escape") {
              event.stopPropagation();
              setAiOpen(false);
            }
          }}
        >
          <p className="text-[0.625rem] text-[var(--muted-foreground)]">
            {selection && selection.start < selection.end
              ? localizeUi("ui.chat.datablock.rewritingTheSelectedValue1Characters", {
                  value1: selection.end - selection.start,
                })
              : localizeUi("ui.chat.datablock.noTextSelectedTheWholeBlockWillBeRewritten")}
          </p>
          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            rows={2}
            maxLength={4000}
            placeholder={localizeUi("ui.chat.datablock.howShouldThisTextChangeEGFixThe")}
            spellCheck={false}
            className="w-full resize-y rounded-md border border-[var(--input)] bg-[var(--background)]/60 px-2 py-1.5 text-[0.625rem] leading-relaxed text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
          />
          <button
            type="button"
            onClick={() => setContextOpen((open) => !open)}
            className="inline-flex min-h-7 items-center gap-1 rounded-md border border-[var(--border)]/70 bg-[var(--secondary)]/45 px-2 py-1 text-[0.625rem] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
            title={localizeUi("ui.chat.datablock.attachCharacterCardsOrLorebookEntriesSoTheModel")}
          >
            <Paperclip size="0.6875rem" />
            {localizeUi("ui.chat.datablock.addContext")}
            {contextCount > 0 && (
              <span className="rounded-full bg-[var(--primary)]/15 px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--primary)]">
                {contextCount}
              </span>
            )}
            <ChevronDown size="0.625rem" className={cn("transition-transform", contextOpen && "rotate-180")} />
          </button>
          {contextOpen && contextPicker}
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={rewriteConnectionId}
              onChange={(event) => onRewriteConnectionChange(event.target.value)}
              className="min-w-0 flex-1 rounded-md bg-[var(--secondary)] px-2 py-1.5 text-[0.625rem] outline-none ring-1 ring-[var(--border)] transition-shadow focus:ring-[var(--primary)]/40"
            >
              {connectionOptions.length === 0 && (
                <option value="">{localizeUi("ui.chat.datablock.noConnectionsAvailable")}</option>
              )}
              {connectionOptions.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.name}
                  {conn.model ? localizeUi("ui.chat.datablock.value1", { value1: conn.model }) : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleRewrite}
              disabled={disabled || rewrite.isPending || !instruction.trim() || !rewriteConnectionId}
              className="inline-flex min-h-7 items-center gap-1 rounded-md bg-[var(--primary)] px-2.5 py-1 text-[0.625rem] font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {rewrite.isPending ? <Loader2 size="0.6875rem" className="animate-spin" /> : <Wand2 size="0.6875rem" />}
              {rewrite.isPending ? localizeUi("ui.chat.datablock.rewriting") : localizeUi("ui.chat.datablock.rewrite")}
            </button>
          </div>
        </div>
      )}

      {error && <div className="mt-1.5 text-[0.5625rem] text-[var(--destructive)]">{error}</div>}

      <div className="mt-2 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => {
            setDraft(null);
            setError(null);
            setSelection(null);
          }}
          disabled={!isDirty || busy}
          className="inline-flex min-h-7 items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[0.625rem] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw size="0.625rem" />
          {localizeUi("ui.characters.charactercliptrimmodal.reset")}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || !isDirty || busy}
          className="inline-flex min-h-7 items-center gap-1 rounded-md bg-[var(--primary)] px-2.5 py-1 text-[0.625rem] font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 size="0.625rem" className="animate-spin" /> : <Save size="0.625rem" />}
          {saving ? localizeUi("ui.noodle.stageprofileform.saving") : localizeUi("ui.noodle.noodlehome.save")}
        </button>
      </div>
    </div>
  );
}

// ── Modal ──

export function AgentSuiteModal({ chat, open, onClose, onCloseGuardChange, agents }: AgentSuiteModalProps) {
  const { t: localizeUi } = useUiTranslation();
  const qc = useQueryClient();

  // 1. Zustand selectors
  const isAgentProcessing = useAgentStore((s) => s.processingChatIds.includes(chat.id));

  // Agent selection — local state the queries below take as input.
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const effectiveAgentId =
    selectedAgentId && agents.some((a) => a.id === selectedAgentId) ? selectedAgentId : (agents[0]?.id ?? null);
  const selectedAgent = agents.find((a) => a.id === effectiveAgentId) ?? null;
  const isTrackerAgent = !!selectedAgent && !!AGENT_SUITE_TRACKER_SLICES[selectedAgent.id];

  // 2. React Query hooks
  const { data: connections } = useConnections();
  const memoryQuery = useAgentMemory(effectiveAgentId, chat.id, open);
  const updateMemory = useUpdateAgentMemory();
  const gameStateKey = useMemo(() => ["agent-suite", "game-state", chat.id] as const, [chat.id]);
  const gameStateQuery = useQuery({
    queryKey: gameStateKey,
    queryFn: () => api.get<GameState | null>(`/chats/${chat.id}/game-state`),
    enabled: open && isTrackerAgent,
    staleTime: 15_000,
  });
  const customRunsQuery = useCustomAgentRuns(chat.id, open && selectedAgent?.category === "custom");
  const updateRunData = useUpdateAgentRunData();

  // Context sources for AI rewrites: the chat's character cards + entries of
  // its pinned lorebooks. Queries are gated on the modal being open.
  const activeLorebookIds = useMemo(() => getChatActiveLorebookIds({ metadata: chat.metadata }), [chat.metadata]);
  const excludedLorebookIds = useMemo(() => getChatExcludedLorebookIds({ metadata: chat.metadata }), [chat.metadata]);
  // chat.characterIds arrives as a JSON string from the API despite the shared type.
  const chatCharacterIds = useMemo(() => getChatCharacterIds({ characterIds: chat.characterIds }), [chat.characterIds]);
  // includeBuiltIn matches the drawer's query so built-ins (Professor Mari)
  // resolve and the already-cached list is reused instead of refetched.
  const { data: allCharacters, isLoading: charactersLoading } = useCharacters({ enabled: open, includeBuiltIn: true });
  const { data: allLorebooks } = useLorebooks();
  // Mirror the drawer's active-lorebook derivation: pinned + global + chat-scoped
  // + character-linked + persona-linked, minus explicit exclusions.
  const contextLorebooks = useMemo<Array<{ id: string; name: string }>>(() => {
    return deriveActiveLorebookViews({
      activeLorebookIds,
      chat,
      dropExcluded: true,
      excludedLorebookIds,
      lorebooks: allLorebooks ?? [],
    }).map((lorebook) => ({ id: lorebook.id, name: lorebook.name }));
  }, [activeLorebookIds, allLorebooks, chat, excludedLorebookIds]);
  const contextLorebookIds = useMemo(() => contextLorebooks.map((lorebook) => lorebook.id), [contextLorebooks]);
  const {
    entries: lorebookEntries,
    isLoading: entriesLoading,
    isError: entriesError,
  } = useEntriesAcrossLorebooks(open ? contextLorebookIds : []);
  const contextSourcesLoading = charactersLoading || entriesLoading;

  // 3. Local state
  const [rewriteConnectionId, setRewriteConnectionId] = useState("");
  const [spoilersRevealed, setSpoilersRevealed] = useState(false);
  const [contextSelection, setContextSelection] = useState<Set<string>>(() => new Set());
  const dirtyBlocksRef = useRef<Set<string>>(new Set());
  const closingRef = useRef(false);
  const wasProcessingRef = useRef(isAgentProcessing);

  // Agents finishing a run may have rewritten memory and tracker state on the
  // server; refetch so pristine blocks show the fresh values instead of
  // letting a later save silently clobber agent-written data.
  useEffect(() => {
    if (wasProcessingRef.current && !isAgentProcessing && open) {
      void qc.invalidateQueries({ queryKey: ["agent-memory"] });
      void qc.invalidateQueries({ queryKey: gameStateKey });
    }
    wasProcessingRef.current = isAgentProcessing;
  }, [gameStateKey, isAgentProcessing, open, qc]);

  // 4. Memos and callbacks
  const connectionOptions = useMemo(() => {
    return filterLanguageGenerationConnections((connections ?? []) as ConnectionOption[]);
  }, [connections]);

  const effectiveRewriteConnectionId = useMemo(() => {
    if (rewriteConnectionId && connectionOptions.some((c) => c.id === rewriteConnectionId)) {
      return rewriteConnectionId;
    }
    const agentDefault = connectionOptions.find((c) => c.defaultForAgents === true || c.defaultForAgents === "true");
    const chatConnection = connectionOptions.find((c) => c.id === chat.connectionId);
    return (agentDefault ?? chatConnection ?? connectionOptions[0])?.id ?? "";
  }, [chat.connectionId, connectionOptions, rewriteConnectionId]);

  const handleBlockDirtyChange = useCallback((blockId: string, dirty: boolean) => {
    if (dirty) dirtyBlocksRef.current.add(blockId);
    else dirtyBlocksRef.current.delete(blockId);
  }, []);

  const confirmDiscardDrafts = useCallback(async () => {
    if (dirtyBlocksRef.current.size === 0) return true;
    const ok = await showConfirmDialog({
      title: localizeUi("ui.chat.agentsuitemodal.discardUnsavedChanges"),
      message: localizeUi("ui.chat.agentsuitemodal.youHaveUnsavedEditsInTheAgentSuiteDiscard"),
      confirmLabel: localizeUi("ui.agents.agenteditor.discard"),
      cancelLabel: "Keep Editing",
      tone: "destructive",
    });
    if (ok) dirtyBlocksRef.current.clear();
    return ok;
  }, [localizeUi]);

  useEffect(() => {
    if (!onCloseGuardChange) return;
    onCloseGuardChange(open ? confirmDiscardDrafts : null);
    return () => onCloseGuardChange(null);
  }, [confirmDiscardDrafts, onCloseGuardChange, open]);

  const guardedClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    void (async () => {
      try {
        if (await confirmDiscardDrafts()) onClose();
      } finally {
        closingRef.current = false;
      }
    })();
  }, [confirmDiscardDrafts, onClose]);

  const selectAgent = useCallback(
    (agentId: string) => {
      if (agentId === effectiveAgentId) return;
      void (async () => {
        if (!(await confirmDiscardDrafts())) return;
        setSelectedAgentId(agentId);
        setSpoilersRevealed(false);
      })();
    },
    [confirmDiscardDrafts, effectiveAgentId],
  );

  const contextSources = useMemo<ContextSource[]>(() => {
    const sources: ContextSource[] = [];
    const charactersById = new Map(
      ((allCharacters ?? []) as Array<{ id: string; data: unknown }>).map((row) => [row.id, row]),
    );
    for (const characterId of chatCharacterIds) {
      const row = charactersById.get(characterId);
      if (!row) continue;
      let data: Record<string, unknown>;
      try {
        data = (typeof row.data === "string" ? JSON.parse(row.data) : row.data) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (!data || typeof data !== "object") continue;
      const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Unnamed character";
      const parts: string[] = [];
      for (const [field, fieldLabel] of [
        ["description", "Description"],
        ["personality", "Personality"],
        ["scenario", "Scenario"],
      ] as const) {
        const value = data[field];
        if (typeof value === "string" && value.trim()) parts.push(`${fieldLabel}:\n${value.trim()}`);
      }
      if (parts.length === 0) continue;
      sources.push({
        key: `char:${characterId}`,
        group: "Characters",
        display: name,
        label: clampContextLabel(`Character card — ${name}`),
        content: clampContextContent(`Name: ${name}\n\n${parts.join("\n\n")}`),
      });
    }
    const lorebookNames = new Map(contextLorebooks.map((lorebook) => [lorebook.id, lorebook.name]));
    for (const entry of lorebookEntries ?? []) {
      if (!entry.content?.trim()) continue;
      const lorebookName = lorebookNames.get(entry.lorebookId) ?? "Lorebook";
      const entryName = entry.name?.trim() || "Untitled entry";
      sources.push({
        key: `lore:${entry.id}`,
        group: `Lorebook — ${lorebookName}`,
        display: entryName,
        label: clampContextLabel(`Lorebook "${lorebookName}" — ${entryName}`),
        content: clampContextContent(entry.content.trim()),
      });
    }
    return sources;
  }, [allCharacters, chatCharacterIds, contextLorebooks, lorebookEntries]);

  const groupedContextSources = useMemo(() => {
    const groups = new Map<string, ContextSource[]>();
    for (const source of contextSources) {
      const list = groups.get(source.group);
      if (list) list.push(source);
      else groups.set(source.group, [source]);
    }
    return Array.from(groups.entries());
  }, [contextSources]);

  const selectedContextSources = useMemo(
    () => contextSources.filter((source) => contextSelection.has(source.key)),
    [contextSelection, contextSources],
  );
  const contextTotalChars = useMemo(
    () => selectedContextSources.reduce((total, source) => total + source.content.length, 0),
    [selectedContextSources],
  );
  const contextOverLimit =
    selectedContextSources.length > MAX_CONTEXT_SECTIONS || contextTotalChars > MAX_CONTEXT_TOTAL_CHARS;

  const toggleContextSource = useCallback((key: string) => {
    setContextSelection((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const buildContextSections = useCallback(
    () => selectedContextSources.map(({ label, content }) => ({ label, content })),
    [selectedContextSources],
  );

  const refreshGameState = useCallback(async () => {
    // Land any queued HUD tracker edits first so the snapshot includes them.
    let hudInSync = true;
    const flushPatch = useGameStateStore.getState().flushPatch;
    if (flushPatch) {
      try {
        await flushPatch();
      } catch {
        hudInSync = false; // edits were requeued — don't clobber optimistic HUD state
      }
    }
    const fresh = await api.get<GameState | null>(`/chats/${chat.id}/game-state`);
    qc.setQueryData(gameStateKey, fresh);
    // Keep the live tracker HUD in sync when this chat is on screen.
    if (hudInSync && useChatStore.getState().activeChatId === chat.id) {
      useGameStateStore.getState().setGameState(fresh ?? null);
    }
  }, [chat.id, gameStateKey, qc]);

  const saveMemoryKey = useCallback(
    async (agentType: string, key: string, mode: "text" | "json", draftText: string) => {
      let parsed: unknown;
      if (mode === "json") {
        parsed = JSON.parse(draftText);
      } else {
        // The server stores strings raw and JSON.parses on read, so a text
        // draft that happens to decode as JSON ("123", "true", '{"a":1}')
        // would change type on the next read. Pre-encode exactly those drafts
        // as JSON string literals to keep them strings round-trip.
        parsed = draftText;
        try {
          JSON.parse(draftText);
          parsed = JSON.stringify(draftText);
        } catch {
          /* not JSON-parsable — stored raw and read back verbatim */
        }
      }
      await updateMemory.mutateAsync({ agentType, chatId: chat.id, patch: { [key]: parsed } });
    },
    [chat.id, updateMemory],
  );

  const saveTrackerSlice = useCallback(
    async (agentId: string, draftText: string) => {
      const slice = AGENT_SUITE_TRACKER_SLICES[agentId];
      if (!slice) throw new Error("No tracker snapshot to update");
      // Flush queued HUD edits, then build the patch from a fresh snapshot so
      // the whole-playerStats write can't revert concurrent agent or HUD
      // updates made after the modal fetched its display copy.
      await useGameStateStore.getState().flushPatch?.();
      const snapshot = await api.get<GameState | null>(`/chats/${chat.id}/game-state`);
      if (!snapshot) throw new Error("No tracker snapshot to update");
      qc.setQueryData(gameStateKey, snapshot);
      const patch = slice.buildPatch(snapshot, JSON.parse(draftText));
      if ("error" in patch && typeof patch.error === "string") throw new Error(patch.error);
      // Target the exact row the snapshot came from, like use-game-state-patcher.
      await api.patch(`/chats/${chat.id}/game-state`, {
        ...patch,
        manual: true,
        ...(snapshot.messageId ? { messageId: snapshot.messageId } : {}),
        ...(snapshot.messageId && Number.isInteger(snapshot.swipeIndex) && snapshot.swipeIndex >= 0
          ? { swipeIndex: snapshot.swipeIndex }
          : {}),
      });
      await refreshGameState();
    },
    [chat.id, gameStateKey, qc, refreshGameState],
  );

  const clearAgentMemory = useCallback(async () => {
    if (!selectedAgent) return;
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.chat.agentsuitemodal.clearAgentMemory"),
      message: localizeUi("ui.chat.agentsuitemodal.deleteEverythingValue1RemembersAboutThisChatThisCannot", {
        value1: selectedAgent.name,
      }),
      confirmLabel: localizeUi("ui.chat.agentsuitemodal.clearMemory_0d31fa2"),
      cancelLabel: "Cancel",
      tone: "destructive",
    });
    if (!confirmed) return;
    try {
      await api.delete(`/agents/memory/${selectedAgent.id}/${chat.id}`);
      qc.invalidateQueries({ queryKey: agentKeys.memory(selectedAgent.id, chat.id) });
      toast.success(localizeUi("ui.chat.agentsuitemodal.value1MemoryCleared", { value1: selectedAgent.name }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : localizeUi("ui.chat.agentsuitemodal.failedToClearMemory"));
    }
  }, [chat.id, qc, selectedAgent, localizeUi]);

  const memoryEntries = useMemo(() => {
    const memory = memoryQuery.data?.memory ?? {};
    return Object.entries(memory).map(([key, value]) => ({
      key,
      mode: (typeof value === "string" ? "text" : "json") as "text" | "json",
      serialized: serializeValue(value, typeof value === "string" ? "text" : "json"),
    }));
  }, [memoryQuery.data?.memory]);

  const customRuns = useMemo(() => {
    if (!selectedAgent || selectedAgent.category !== "custom") return [];
    return ((customRunsQuery.data ?? []) as AgentRunRow[])
      .filter((run) => run.agentType === selectedAgent.id)
      .slice(0, 5);
  }, [customRunsQuery.data, selectedAgent]);

  const hideSpoilers = selectedAgent?.id === "director" && !spoilersRevealed && memoryEntries.length > 0;
  const trackerSlice = selectedAgent ? AGENT_SUITE_TRACKER_SLICES[selectedAgent.id] : undefined;

  const contextPicker: ReactNode = (
    <div className="space-y-1.5 rounded-md border border-[var(--border)] bg-[var(--background)]/40 p-2">
      <p className="text-[0.5625rem] text-[var(--muted-foreground)]">
        {localizeUi("ui.chat.agentsuitemodal.attachedSourcesGroundTheRewriteTheSelectionAppliesTo")}
      </p>
      {contextSourcesLoading ? (
        <p className="py-1 text-center text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.agentsuitemodal.loadingContextSources")}
        </p>
      ) : contextSources.length === 0 ? (
        <p
          className={cn(
            "py-1 text-center text-[0.625rem]",
            entriesError ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]",
          )}
        >
          {entriesError
            ? localizeUi("ui.chat.agentsuitemodal.couldnTLoadLorebookEntriesCloseAndReopenThe")
            : localizeUi("ui.chat.agentsuitemodal.noContextSourcesAvailableThisChatHasNoCharacter")}
        </p>
      ) : (
        <>
          {entriesError && (
            <p className="text-[0.5625rem] text-[var(--destructive)]">
              {localizeUi("ui.chat.agentsuitemodal.couldnTLoadLorebookEntriesShowingCharacterCardsOnly")}
            </p>
          )}
          {groupedContextSources.map(([group, sources]) => (
            <div key={group}>
              <p className="mb-0.5 text-[0.5625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                {group}
              </p>
              <div className="max-h-32 space-y-0.5 overflow-y-auto">
                {sources.map((source) => (
                  <label
                    key={source.key}
                    className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-[0.625rem] transition-colors hover:bg-[var(--accent)]/40"
                  >
                    <input
                      type="checkbox"
                      checked={contextSelection.has(source.key)}
                      onChange={() => toggleContextSource(source.key)}
                      className="h-3 w-3 shrink-0 accent-[var(--primary)]"
                    />
                    <span className="min-w-0 flex-1 truncate">{source.display}</span>
                    <span className="shrink-0 text-[0.5rem] text-[var(--muted-foreground)]">
                      ~{Math.ceil(source.content.length / 4).toLocaleString()}{" "}
                      {localizeUi("ui.agents.agenteditor.tokens")}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
      {selectedContextSources.length > 0 && (
        <p
          className={cn(
            "text-[0.5625rem]",
            contextOverLimit ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]",
          )}
        >
          {selectedContextSources.length} {localizeUi("ui.chat.agentsuitemodal.source")}
          {selectedContextSources.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s")}{" "}
          {localizeUi("ui.chat.agentsuitemodal.attached")}
          {Math.ceil(contextTotalChars / 4).toLocaleString()} {localizeUi("ui.agents.agenteditor.tokens")}
          {contextOverLimit &&
            ` — too large (max ${MAX_CONTEXT_SECTIONS} sources / ${MAX_CONTEXT_TOTAL_CHARS.toLocaleString()} characters), deselect some sources`}
        </p>
      )}
    </div>
  );

  // 5. Render
  return (
    <Modal
      open={open}
      onClose={guardedClose}
      title={localizeUi("ui.chat.agentsuitemodal.agentSuite")}
      width="max-w-3xl"
      chatFloatingPanel
    >
      {agents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-6 text-center text-[0.6875rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.agentsuitemodal.noAgentsAreActiveInThisChatAddAgents")}
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Agent picker — dropdown on mobile, rail on desktop */}
          <div className="shrink-0 sm:w-44">
            <select
              value={effectiveAgentId ?? ""}
              onChange={(event) => selectAgent(event.target.value)}
              className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-[var(--border)] transition-shadow focus:ring-[var(--primary)]/40 sm:hidden"
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
            <div className="hidden flex-col gap-1 sm:flex">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => selectAgent(agent.id)}
                  className={cn(
                    "flex w-full flex-col rounded-lg px-2.5 py-2 text-left transition-all",
                    agent.id === effectiveAgentId
                      ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                      : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                  )}
                >
                  <span className="truncate text-[0.6875rem] font-medium">{agent.name}</span>
                  <span className="text-[0.5625rem] uppercase tracking-wide text-[var(--muted-foreground)]">
                    {CATEGORY_LABELS[agent.category] ?? agent.category}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Selected agent detail */}
          <div className="min-w-0 flex-1 space-y-3">
            {selectedAgent && (
              <>
                <div className="flex items-start gap-2">
                  <Bot size="0.875rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-semibold">{selectedAgent.name}</h3>
                    <p className="text-[0.625rem] text-[var(--muted-foreground)]">{selectedAgent.description}</p>
                  </div>
                </div>

                {isAgentProcessing && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-amber-400/10 px-2.5 py-2 text-[0.625rem] text-amber-400/90 ring-1 ring-amber-400/30">
                    <AlertTriangle size="0.75rem" className="shrink-0" />
                    {localizeUi("ui.chat.agentsuitemodal.agentsAreCurrentlyRunningForThisChatSavingIs")}
                  </div>
                )}

                {/* Stored memory */}
                <section className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">
                      {localizeUi("ui.chat.agentsuitemodal.storedMemory")}
                    </h4>
                    <div className="flex items-center gap-1.5">
                      {selectedAgent.id === "director" && memoryEntries.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSpoilersRevealed((v) => !v)}
                          className="inline-flex min-h-7 items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[0.625rem] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
                        >
                          {spoilersRevealed ? <EyeOff size="0.625rem" /> : <Eye size="0.625rem" />}
                          {spoilersRevealed
                            ? localizeUi("ui.agents.secretplotpanel.hideSpoilers")
                            : localizeUi("ui.chat.agentsuitemodal.revealSpoilers")}
                        </button>
                      )}
                      {memoryEntries.length > 0 && (
                        <button
                          type="button"
                          onClick={clearAgentMemory}
                          disabled={isAgentProcessing}
                          className="inline-flex min-h-7 items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[0.625rem] text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 size="0.625rem" />
                          {localizeUi("ui.chat.agentsuitemodal.clearMemory")}
                        </button>
                      )}
                    </div>
                  </div>
                  {memoryQuery.isLoading && (
                    <p className="py-2 text-center text-[0.625rem] text-[var(--muted-foreground)]">
                      {localizeUi("ui.chat.agentsuitemodal.loadingStoredMemory")}
                    </p>
                  )}
                  {memoryQuery.isError && (
                    <p className="rounded-md border border-[var(--destructive)]/25 bg-[var(--destructive)]/10 px-2 py-1.5 text-center text-[0.625rem] text-[var(--destructive)]">
                      {localizeUi("ui.chat.agentsuitemodal.couldNotLoadThisAgentSMemory")}
                    </p>
                  )}
                  {!memoryQuery.isLoading && !memoryQuery.isError && memoryEntries.length === 0 && (
                    <p className="rounded-md border border-dashed border-[var(--border)] px-2 py-2 text-center text-[0.625rem] text-[var(--muted-foreground)]">
                      {localizeUi("ui.chat.agentsuitemodal.noStoredMemoryForThisAgentInThisChat")}
                    </p>
                  )}
                  {hideSpoilers ? (
                    <p className="rounded-md border border-dashed border-[var(--border)] px-2 py-2 text-center text-[0.625rem] text-[var(--muted-foreground)]">
                      {localizeUi("ui.chat.agentsuitemodal.containsHiddenNarrativeSpoilersUseRevealSpoilersToView")}
                    </p>
                  ) : (
                    memoryEntries.map((entry) => (
                      <DataBlock
                        key={`${selectedAgent.id}:memory:${entry.key}`}
                        blockId={`${selectedAgent.id}:memory:${entry.key}`}
                        label={entry.key}
                        mode={entry.mode}
                        value={entry.serialized}
                        onSave={(draftText) => saveMemoryKey(selectedAgent.id, entry.key, entry.mode, draftText)}
                        onDirtyChange={handleBlockDirtyChange}
                        disabled={isAgentProcessing}
                        agentName={selectedAgent.name}
                        connectionOptions={connectionOptions}
                        rewriteConnectionId={effectiveRewriteConnectionId}
                        onRewriteConnectionChange={setRewriteConnectionId}
                        contextPicker={contextPicker}
                        contextCount={selectedContextSources.length}
                        contextOverLimit={contextOverLimit}
                        buildContextSections={buildContextSections}
                      />
                    ))
                  )}
                </section>

                {/* Tracker slice */}
                {trackerSlice && (
                  <section className="space-y-2">
                    <h4 className="text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">
                      {localizeUi("ui.chat.agentsuitemodal.trackerData")}
                    </h4>
                    {gameStateQuery.isLoading && (
                      <p className="py-2 text-center text-[0.625rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.chat.agentsuitemodal.loadingTrackerData")}
                      </p>
                    )}
                    {gameStateQuery.isError && (
                      <p className="rounded-md border border-[var(--destructive)]/25 bg-[var(--destructive)]/10 px-2 py-1.5 text-center text-[0.625rem] text-[var(--destructive)]">
                        {localizeUi("ui.chat.agentsuitemodal.couldNotLoadTrackerData")}
                      </p>
                    )}
                    {!gameStateQuery.isLoading && !gameStateQuery.isError && !gameStateQuery.data && (
                      <p className="rounded-md border border-dashed border-[var(--border)] px-2 py-2 text-center text-[0.625rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.chat.agentsuitemodal.noTrackerDataRecordedForThisChatYet")}
                      </p>
                    )}
                    {gameStateQuery.data && (
                      <>
                        <DataBlock
                          key={`${selectedAgent.id}:tracker`}
                          blockId={`${selectedAgent.id}:tracker`}
                          label={trackerSlice.label}
                          description={trackerSlice.description}
                          mode="json"
                          value={serializeValue(trackerSlice.getValue(gameStateQuery.data), "json")}
                          onSave={(draftText) => saveTrackerSlice(selectedAgent.id, draftText)}
                          onDirtyChange={handleBlockDirtyChange}
                          disabled={isAgentProcessing}
                          agentName={selectedAgent.name}
                          connectionOptions={connectionOptions}
                          rewriteConnectionId={effectiveRewriteConnectionId}
                          onRewriteConnectionChange={setRewriteConnectionId}
                          contextPicker={contextPicker}
                          contextCount={selectedContextSources.length}
                          contextOverLimit={contextOverLimit}
                          buildContextSections={buildContextSections}
                        />
                        {selectedAgent.id === "world-state" && (gameStateQuery.data.recentEvents?.length ?? 0) > 0 && (
                          <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/35 p-2.5">
                            <span className="text-[0.6875rem] font-semibold">
                              {localizeUi("ui.chat.agentsuitemodal.recentEvents")}
                            </span>
                            <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                              {localizeUi("ui.chat.agentsuitemodal.maintainedByTheAgentAndRewrittenOnEachRun")}
                            </p>
                            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[0.625rem] text-[var(--muted-foreground)]">
                              {gameStateQuery.data.recentEvents.map((event, index) => (
                                <li key={index}>{event}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                )}

                {/* Custom agent outputs */}
                {selectedAgent.category === "custom" && (
                  <section className="space-y-2">
                    <h4 className="text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">
                      {localizeUi("ui.chat.agentsuitemodal.recentOutputs")}
                    </h4>
                    {customRunsQuery.isLoading && (
                      <p className="py-2 text-center text-[0.625rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.chat.agentsuitemodal.loadingOutputs")}
                      </p>
                    )}
                    {!customRunsQuery.isLoading && customRuns.length === 0 && (
                      <p className="rounded-md border border-dashed border-[var(--border)] px-2 py-2 text-center text-[0.625rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.chat.agentsuitemodal.noStoredOutputsFromThisAgentInThisChat")}
                      </p>
                    )}
                    {customRuns.map((run) => {
                      const mode: "text" | "json" = typeof run.resultData === "string" ? "text" : "json";
                      return (
                        <DataBlock
                          key={run.id}
                          blockId={run.id}
                          label={run.resultType.replace(/_/g, " ")}
                          description={formatRunTimestamp(run.createdAt)}
                          mode={mode}
                          value={serializeValue(run.resultData, mode)}
                          onSave={async (draftText) => {
                            const parsed: unknown = mode === "json" ? JSON.parse(draftText) : draftText;
                            await updateRunData.mutateAsync({ id: run.id, chatId: run.chatId, resultData: parsed });
                          }}
                          onDirtyChange={handleBlockDirtyChange}
                          disabled={isAgentProcessing}
                          agentName={selectedAgent.name}
                          connectionOptions={connectionOptions}
                          rewriteConnectionId={effectiveRewriteConnectionId}
                          onRewriteConnectionChange={setRewriteConnectionId}
                          contextPicker={contextPicker}
                          contextCount={selectedContextSources.length}
                          contextOverLimit={contextOverLimit}
                          buildContextSections={buildContextSections}
                        />
                      );
                    })}
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
