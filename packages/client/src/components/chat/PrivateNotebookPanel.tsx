import { createPortal } from "react-dom";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  PRIVATE_NOTEBOOK_MAX_CONTENT_CHARS,
  type PrivateNotebookDocument,
  type PrivateNotebookTarget,
} from "@marinara-engine/shared";
import { AlertTriangle, Check, Loader2, NotebookPen, RotateCcw, Save, ShieldCheck, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  getPrivateNotebookConflictDocument,
  getPrivateNotebookTargetKey,
  usePrivateNotebook,
  useUpdatePrivateNotebook,
} from "../../hooks/use-private-notebook";
import { cn } from "../../lib/utils";
import {
  NEUTRAL_PANEL_CLOSE_BUTTON,
  NEUTRAL_PANEL_SCROLL_AREA,
  NEUTRAL_PANEL_SHELL,
  NEUTRAL_PANEL_SUBTITLE,
  NEUTRAL_PANEL_TITLE,
} from "../ui/neutral-surface-styles";
import {
  announceChatToolbarAction,
  getChatFloatingPanelDesktopRight,
  getChatToolbarButtonClass,
  type ChatToolbarFloatingPanelAnchor,
} from "./ChatToolbarControls";

type SaveStatus = "saved" | "unsaved" | "saving" | "error" | "conflict";

type NotebookDraft = {
  target: PrivateNotebookTarget;
  content: string;
  savedContent: string;
  revision: number;
  status: SaveStatus;
  conflictDocument: PrivateNotebookDocument | null;
};

export type PrivateNotebookPanelHandle = {
  requestClose: () => Promise<boolean>;
};

type PrivateNotebookPanelProps = {
  open: boolean;
  chatId: string;
  mode: string;
  anchor: ChatToolbarFloatingPanelAnchor;
  opener: HTMLElement | null;
  characterNames: Readonly<Record<string, string>>;
  onClose: () => void;
};

type ExplicitSave = {
  content: string;
  expectedRevision: number;
};

const EMPTY_CHARACTER_IDS: string[] = [];

function useMobileViewport() {
  const [mobile, setMobile] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(max-width: 767px)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return mobile;
}

function getPanelStyle(anchor: ChatToolbarFloatingPanelAnchor, mobile: boolean): CSSProperties {
  const top = anchor?.top ?? 56;
  if (mobile) {
    return {
      top,
      right: `${anchor?.right ?? 8}px`,
      width: "min(28rem, calc(100vw - 4.75rem))",
      height: `min(38rem, calc(100dvh - ${top + 8}px))`,
    };
  }

  return {
    top,
    right: getChatFloatingPanelDesktopRight(anchor),
    width: "min(30rem, calc(100vw - 2rem))",
    height: `min(38rem, calc(100dvh - ${top + 12}px))`,
  };
}

function findDocument(documents: PrivateNotebookDocument[], key: string): PrivateNotebookDocument | null {
  return documents.find((document) => getPrivateNotebookTargetKey(document.target) === key) ?? null;
}

export function PrivateNotebookToolbarButton({
  open,
  compact = false,
  buttonClassName,
  iconSize = "0.875rem",
  onClick,
}: {
  open: boolean;
  compact?: boolean;
  buttonClassName?: string;
  iconSize?: number | string;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  const { t } = useTranslation();
  const label = t("privateNotebook.toolbarLabel");

  return (
    <button
      type="button"
      data-chat-help="private-notebook"
      data-chat-toolbar-panel-action="notebook"
      onClick={(event) => {
        announceChatToolbarAction("notebook");
        onClick(event);
      }}
      className={buttonClassName ?? getChatToolbarButtonClass({ compact, open })}
      title={label}
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
    >
      <NotebookPen size={iconSize} />
    </button>
  );
}

export const PrivateNotebookPanel = forwardRef<PrivateNotebookPanelHandle, PrivateNotebookPanelProps>(
  function PrivateNotebookPanel({ open, chatId, mode, anchor, opener, characterNames, onClose }, ref) {
    const { t } = useTranslation();
    const mobile = useMobileViewport();
    const panelRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const retryButtonRef = useRef<HTMLButtonElement>(null);
    const editorRef = useRef<HTMLTextAreaElement>(null);
    const initialFocusAppliedRef = useRef(false);
    const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
    const closeRequestRef = useRef<Promise<boolean> | null>(null);
    const draftsRef = useRef<Record<string, NotebookDraft>>({});
    const [drafts, setDrafts] = useState<Record<string, NotebookDraft>>({});
    const [selectedScope, setSelectedScope] = useState<PrivateNotebookTarget["scope"]>("chat");
    const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
    const [transitionPending, setTransitionPending] = useState(false);
    const [resolutionError, setResolutionError] = useState(false);
    const notebook = usePrivateNotebook(chatId, open);
    const updateNotebook = useUpdatePrivateNotebook();

    const replaceDrafts = useCallback((next: Record<string, NotebookDraft>) => {
      draftsRef.current = next;
      setDrafts(next);
    }, []);

    const updateDraft = useCallback((key: string, update: (current: NotebookDraft) => NotebookDraft) => {
      const current = draftsRef.current[key];
      if (!current) return;
      const next = { ...draftsRef.current, [key]: update(current) };
      draftsRef.current = next;
      setDrafts(next);
    }, []);

    useEffect(() => {
      const context = notebook.data;
      if (!context) return;

      const current = draftsRef.current;
      const next = { ...current };
      let changed = false;
      for (const document of context.documents) {
        const key = getPrivateNotebookTargetKey(document.target);
        const existing = current[key];
        if (
          existing?.content !== undefined &&
          (existing.content !== existing.savedContent || existing.status === "saving")
        ) {
          continue;
        }
        if (
          existing &&
          existing.content === document.content &&
          existing.revision === document.revision &&
          existing.status === "saved"
        ) {
          continue;
        }
        next[key] = {
          target: document.target,
          content: document.content,
          savedContent: document.content,
          revision: document.revision,
          status: "saved",
          conflictDocument: null,
        };
        changed = true;
      }
      if (changed) replaceDrafts(next);

      if (!selectedCharacterId && context.characterIds[0]) setSelectedCharacterId(context.characterIds[0]);
      const familyAvailable = context.documents.some((document) => document.target.scope === "branch-family");
      if (selectedScope === "branch-family" && !familyAvailable) setSelectedScope("chat");
      if (selectedScope === "character" && context.characterIds.length === 0) setSelectedScope("chat");
    }, [notebook.data, replaceDrafts, selectedCharacterId, selectedScope]);

    const characterIds = notebook.data?.characterIds ?? EMPTY_CHARACTER_IDS;
    const familyAvailable =
      notebook.data?.documents.some((document) => document.target.scope === "branch-family") ?? false;
    const selectedTarget = useMemo<PrivateNotebookTarget | null>(() => {
      if (selectedScope === "character") {
        const characterId =
          selectedCharacterId && characterIds.includes(selectedCharacterId)
            ? selectedCharacterId
            : (characterIds[0] ?? null);
        return characterId ? { scope: "character", characterId } : null;
      }
      if (selectedScope === "branch-family" && !familyAvailable) return null;
      return { scope: selectedScope } as PrivateNotebookTarget;
    }, [characterIds, familyAvailable, selectedCharacterId, selectedScope]);
    const selectedKey = selectedTarget ? getPrivateNotebookTargetKey(selectedTarget) : null;
    const activeDraft = selectedKey ? drafts[selectedKey] : undefined;

    const queueSave = useCallback(
      (key: string, explicit?: ExplicitSave) => {
        const run = async (): Promise<boolean> => {
          const draft = draftsRef.current[key];
          if (!draft) return true;
          if (!explicit && draft.content === draft.savedContent) return true;
          if (!explicit && draft.conflictDocument) return false;

          const content = explicit?.content ?? draft.content;
          const expectedRevision = explicit?.expectedRevision ?? draft.revision;
          updateDraft(key, (current) => ({ ...current, status: "saving" }));
          try {
            const saved = await updateNotebook.mutateAsync({
              chatId,
              input: { target: draft.target, content, expectedRevision },
            });
            updateDraft(key, (current) => {
              const stillDirty = current.content !== saved.content;
              return {
                ...current,
                savedContent: saved.content,
                revision: saved.revision,
                status: stillDirty ? "unsaved" : "saved",
                conflictDocument: null,
              };
            });
            setResolutionError(false);
            return true;
          } catch (error) {
            const conflictDocument = getPrivateNotebookConflictDocument(error);
            updateDraft(key, (current) => ({
              ...current,
              status: conflictDocument || current.conflictDocument ? "conflict" : "error",
              conflictDocument: conflictDocument ?? current.conflictDocument,
            }));
            return false;
          }
        };

        const queued = saveQueueRef.current.then(run, run);
        saveQueueRef.current = queued.catch(() => false);
        return queued;
      },
      [chatId, updateDraft, updateNotebook],
    );

    const flushKey = useCallback(
      async (key: string | null): Promise<boolean> => {
        if (!key) return true;
        while (true) {
          const current = draftsRef.current[key];
          if (!current || current.content === current.savedContent) return true;
          if (current.conflictDocument) return false;
          if (!(await queueSave(key))) return false;
        }
      },
      [queueSave],
    );

    const flushAll = useCallback(async (): Promise<boolean> => {
      for (const key of Object.keys(draftsRef.current)) {
        if (!(await flushKey(key))) return false;
      }
      return true;
    }, [flushKey]);

    const restoreOpenerFocus = useCallback(() => {
      if (!opener?.isConnected) return;
      window.requestAnimationFrame(() => {
        if (opener.isConnected) opener.focus({ preventScroll: true });
      });
    }, [opener]);

    const requestClose = useCallback((): Promise<boolean> => {
      if (closeRequestRef.current) return closeRequestRef.current;
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      setTransitionPending(true);
      const request = flushAll()
        .then((saved) => {
          if (saved) {
            onClose();
            restoreOpenerFocus();
          } else {
            setTransitionPending(false);
          }
          return saved;
        })
        .finally(() => {
          closeRequestRef.current = null;
        });
      closeRequestRef.current = request;
      return request;
    }, [flushAll, onClose, restoreOpenerFocus]);

    useImperativeHandle(ref, () => ({ requestClose }), [requestClose]);

    useEffect(() => {
      if (!open) return;
      const handlePointerDown = (event: MouseEvent) => {
        const target = event.target as Node;
        const element = target instanceof Element ? target : target.parentElement;
        if (panelRef.current?.contains(target)) return;
        if (element?.closest('[data-chat-toolbar-panel-action="notebook"]')) return;
        void requestClose();
      };
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") void requestClose();
      };
      document.addEventListener("mousedown", handlePointerDown);
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("mousedown", handlePointerDown);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [open, requestClose]);

    useEffect(() => {
      if (!open) {
        initialFocusAppliedRef.current = false;
        return;
      }
      if (initialFocusAppliedRef.current) return;

      const target = activeDraft
        ? editorRef.current
        : notebook.isError
          ? retryButtonRef.current
          : closeButtonRef.current;
      if (!target) return;

      const frame = window.requestAnimationFrame(() => {
        if (panelRef.current?.contains(document.activeElement)) {
          initialFocusAppliedRef.current = true;
          return;
        }
        target.focus({ preventScroll: true });
        initialFocusAppliedRef.current = true;
      });
      return () => window.cancelAnimationFrame(frame);
    }, [activeDraft, notebook.isError, open]);

    useEffect(() => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (
        !open ||
        !selectedKey ||
        !activeDraft ||
        activeDraft.content === activeDraft.savedContent ||
        activeDraft.status !== "unsaved"
      ) {
        return;
      }
      autosaveTimerRef.current = setTimeout(() => void queueSave(selectedKey), 800);
      return () => {
        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      };
    }, [activeDraft, open, queueSave, selectedKey]);

    const switchSelection = useCallback(
      async (nextScope: PrivateNotebookTarget["scope"], nextCharacterId: string | null) => {
        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        setTransitionPending(true);
        const saved = await flushKey(selectedKey);
        if (saved) {
          setSelectedScope(nextScope);
          setSelectedCharacterId(nextCharacterId);
          setResolutionError(false);
        }
        setTransitionPending(false);
      },
      [flushKey, selectedKey],
    );

    const handleReloadSaved = useCallback(async () => {
      if (!selectedKey) return;
      setTransitionPending(true);
      setResolutionError(false);
      const refreshed = await notebook.refetch();
      const document = refreshed.data ? findDocument(refreshed.data.documents, selectedKey) : null;
      if (refreshed.isError || !document) {
        setResolutionError(true);
        setTransitionPending(false);
        return;
      }
      updateDraft(selectedKey, () => ({
        target: document.target,
        content: document.content,
        savedContent: document.content,
        revision: document.revision,
        status: "saved",
        conflictDocument: null,
      }));
      setTransitionPending(false);
    }, [notebook, selectedKey, updateDraft]);

    const handleSaveMine = useCallback(async () => {
      if (!selectedKey) return;
      const mine = draftsRef.current[selectedKey]?.content;
      if (mine === undefined) return;
      setTransitionPending(true);
      setResolutionError(false);
      const refreshed = await notebook.refetch();
      const document = refreshed.data ? findDocument(refreshed.data.documents, selectedKey) : null;
      if (
        refreshed.isError ||
        !document ||
        !(await queueSave(selectedKey, { content: mine, expectedRevision: document.revision }))
      ) {
        setResolutionError(true);
      }
      setTransitionPending(false);
    }, [notebook, queueSave, selectedKey]);

    if (!open || typeof document === "undefined") return null;

    const status = activeDraft?.status ?? "saved";
    const statusLabel = t(`privateNotebook.status.${status}`);
    const scopeLabel =
      selectedScope === "branch-family"
        ? t(mode === "game" ? "privateNotebook.scope.campaign" : "privateNotebook.scope.allBranches")
        : t(`privateNotebook.scope.${selectedScope}`);
    const panel = (
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="private-notebook-title"
        data-chat-floating-panel
        data-component="PrivateNotebookPanel"
        className={cn(NEUTRAL_PANEL_SHELL, "fixed z-[9999] flex min-h-0 flex-col overflow-hidden")}
        style={getPanelStyle(anchor, mobile)}
      >
        <div className="flex items-start gap-3 border-b border-[var(--marinara-chat-chrome-panel-divider)] px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div id="private-notebook-title" className={NEUTRAL_PANEL_TITLE}>
              <NotebookPen size="0.875rem" className="shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
              {t("privateNotebook.title")}
            </div>
            <div className={NEUTRAL_PANEL_SUBTITLE}>{t("privateNotebook.subtitle")}</div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => void requestClose()}
            disabled={transitionPending}
            className={cn(NEUTRAL_PANEL_CLOSE_BUTTON, "flex h-11 w-11 shrink-0 items-center justify-center p-0")}
            aria-label={t("privateNotebook.close")}
          >
            {transitionPending ? <Loader2 size="1rem" className="animate-spin" /> : <X size="1rem" />}
          </button>
        </div>

        <div className={cn(NEUTRAL_PANEL_SCROLL_AREA, "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3")}>
          <div className="flex items-start gap-2 rounded-lg bg-[var(--marinara-chat-chrome-highlight-bg)] px-3 py-2.5 text-xs leading-relaxed text-[var(--marinara-chat-chrome-panel-text)] ring-1 ring-[var(--marinara-chat-chrome-panel-border)]">
            <ShieldCheck size="1rem" className="mt-0.5 shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
            <span>{t("privateNotebook.privacyDisclosure")}</span>
          </div>

          {notebook.isPending ? (
            <div className="space-y-3" aria-label={t("privateNotebook.loading")}>
              <div className="h-11 animate-pulse rounded-lg bg-[var(--marinara-chat-chrome-highlight-bg)]" />
              <div className="h-48 animate-pulse rounded-lg bg-[var(--marinara-chat-chrome-highlight-bg)]" />
            </div>
          ) : notebook.isError ? (
            <div className="flex flex-col items-start gap-3 rounded-lg bg-[var(--marinara-chat-chrome-highlight-bg)] p-3 ring-1 ring-[var(--marinara-chat-chrome-panel-border)]">
              <div className="flex items-start gap-2 text-xs text-[var(--marinara-chat-chrome-panel-text)]">
                <AlertTriangle size="1rem" className="shrink-0 text-[var(--destructive)]" />
                <span>{t("privateNotebook.loadError")}</span>
              </div>
              <button
                ref={retryButtonRef}
                type="button"
                onClick={() => void notebook.refetch()}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--marinara-chat-chrome-highlight-bg-hover)] px-3 text-xs font-semibold text-[var(--marinara-chat-chrome-highlight-text)] ring-1 ring-[var(--marinara-chat-chrome-panel-border)] transition-colors hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
              >
                <RotateCcw size="0.875rem" />
                {t("privateNotebook.retry")}
              </button>
            </div>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex min-w-0 flex-col gap-1 text-[0.6875rem] font-semibold text-[var(--marinara-chat-chrome-panel-muted)]">
                  {t("privateNotebook.scope.label")}
                  <select
                    value={selectedScope}
                    onChange={(event) => {
                      const nextScope = event.target.value as PrivateNotebookTarget["scope"];
                      const nextCharacterId =
                        nextScope === "character" ? (selectedCharacterId ?? characterIds[0]!) : null;
                      void switchSelection(nextScope, nextCharacterId);
                    }}
                    disabled={transitionPending}
                    className="min-h-11 min-w-0 rounded-lg border border-[var(--marinara-chat-chrome-input-border)] bg-[var(--marinara-chat-chrome-input-bg)] px-3 text-sm text-[var(--marinara-chat-chrome-input-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] disabled:opacity-50"
                  >
                    <option value="global">{t("privateNotebook.scope.global")}</option>
                    {characterIds.length > 0 && (
                      <option value="character">{t("privateNotebook.scope.character")}</option>
                    )}
                    <option value="chat">{t("privateNotebook.scope.chat")}</option>
                    {familyAvailable && (
                      <option value="branch-family">
                        {mode === "game" ? t("privateNotebook.scope.campaign") : t("privateNotebook.scope.allBranches")}
                      </option>
                    )}
                  </select>
                </label>

                {selectedScope === "character" && (
                  <label className="flex min-w-0 flex-col gap-1 text-[0.6875rem] font-semibold text-[var(--marinara-chat-chrome-panel-muted)]">
                    {t("privateNotebook.character.label")}
                    <select
                      value={selectedCharacterId ?? characterIds[0] ?? ""}
                      onChange={(event) => void switchSelection("character", event.target.value)}
                      disabled={transitionPending}
                      className="min-h-11 min-w-0 rounded-lg border border-[var(--marinara-chat-chrome-input-border)] bg-[var(--marinara-chat-chrome-input-bg)] px-3 text-sm text-[var(--marinara-chat-chrome-input-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] disabled:opacity-50"
                    >
                      {characterIds.map((characterId, index) => (
                        <option key={characterId} value={characterId}>
                          {characterNames[characterId] ||
                            t("privateNotebook.character.fallback", { number: index + 1 })}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <div className="flex min-h-5 items-center justify-between gap-3 text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                <span className="min-w-0 truncate">{scopeLabel}</span>
                <span className="flex shrink-0 items-center gap-1.5" aria-live="polite">
                  {status === "saving" && <Loader2 size="0.75rem" className="animate-spin" />}
                  {status === "saved" && <Check size="0.75rem" />}
                  {(status === "error" || status === "conflict") && <AlertTriangle size="0.75rem" />}
                  {statusLabel}
                </span>
              </div>

              {activeDraft?.conflictDocument && (
                <div className="rounded-lg bg-[var(--marinara-chat-chrome-highlight-bg)] p-3 ring-1 ring-[var(--marinara-chat-chrome-panel-border)]">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size="1rem" className="mt-0.5 shrink-0 text-[var(--destructive)]" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                        {t("privateNotebook.conflict.title")}
                      </div>
                      <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
                        {t("privateNotebook.conflict.body")}
                      </p>
                    </div>
                  </div>
                  {resolutionError && (
                    <p className="mt-2 text-[0.6875rem] text-[var(--destructive)]">
                      {t("privateNotebook.conflict.resolveError")}
                    </p>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void handleReloadSaved()}
                      disabled={transitionPending}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-[var(--marinara-chat-chrome-highlight-bg-hover)] px-3 text-xs font-semibold text-[var(--marinara-chat-chrome-panel-text)] ring-1 ring-[var(--marinara-chat-chrome-panel-border)] transition-colors hover:text-[var(--marinara-chat-chrome-highlight-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] disabled:opacity-50"
                    >
                      <RotateCcw size="0.8125rem" />
                      {t("privateNotebook.conflict.reloadSaved")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveMine()}
                      disabled={transitionPending}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] disabled:opacity-50"
                    >
                      {transitionPending ? (
                        <Loader2 size="0.8125rem" className="animate-spin" />
                      ) : (
                        <Save size="0.8125rem" />
                      )}
                      {t("privateNotebook.conflict.saveMine")}
                    </button>
                  </div>
                </div>
              )}

              {status === "error" && !activeDraft?.conflictDocument && (
                <p className="text-[0.6875rem] text-[var(--destructive)]" role="alert">
                  {t("privateNotebook.saveError")}
                </p>
              )}

              <label className="flex min-h-0 flex-1 flex-col gap-1 text-[0.6875rem] font-semibold text-[var(--marinara-chat-chrome-panel-muted)]">
                {t("privateNotebook.editor.label")}
                <textarea
                  ref={editorRef}
                  value={activeDraft?.content ?? ""}
                  onChange={(event) => {
                    if (!selectedKey) return;
                    const content = event.target.value;
                    updateDraft(selectedKey, (current) => ({
                      ...current,
                      content,
                      status: current.conflictDocument
                        ? "conflict"
                        : content === current.savedContent
                          ? "saved"
                          : "unsaved",
                    }));
                  }}
                  maxLength={PRIVATE_NOTEBOOK_MAX_CONTENT_CHARS}
                  placeholder={t("privateNotebook.editor.placeholder")}
                  aria-describedby="private-notebook-character-count"
                  disabled={!activeDraft || transitionPending}
                  spellCheck
                  className="min-h-52 flex-1 resize-none rounded-lg border border-[var(--marinara-chat-chrome-input-border)] bg-[var(--marinara-chat-chrome-input-bg)] px-3 py-2.5 font-mono text-sm leading-relaxed text-[var(--marinara-chat-chrome-input-text)] outline-none placeholder:text-[var(--marinara-chat-chrome-input-placeholder)] focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] disabled:opacity-50"
                />
              </label>
              <div
                id="private-notebook-character-count"
                className="text-right text-[0.625rem] tabular-nums text-[var(--marinara-chat-chrome-panel-muted)]"
              >
                {t("privateNotebook.characterCount", {
                  count: activeDraft?.content.length ?? 0,
                  limit: PRIVATE_NOTEBOOK_MAX_CONTENT_CHARS,
                })}
              </div>
            </>
          )}
        </div>
      </section>
    );

    return createPortal(panel, document.body);
  },
);
