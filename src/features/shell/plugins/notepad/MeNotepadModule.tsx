import { X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useCharacterSummariesByIds } from "../../../catalog/characters";
import { useChat } from "../../../catalog/chats";
import { cn } from "../../../../shared/lib/utils";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { DeleteTabDialog, RestoreBackupDialog } from "./components/NotepadDialogs";
import { NotepadHeader } from "./components/NotepadHeader";
import {
  COLLAPSED_OPEN_SUPPRESS_MS,
  COLLAPSED_WIDTH,
  type BranchMode,
  type DropTarget,
  type NoteScope,
  type NotepadContext,
  type NotepadLayout,
  type NotepadMemoryState,
  type NotepadStatus,
  type NotepadTab,
  type PendingSelection,
  type StatusTone,
} from "./types";
import { constrainCollapsedLayout, constrainLayout, defaultLayout, saveLayoutState } from "./lib/layout";
import { useIsMobileLayout } from "./lib/hooks";
import { MarkdownPreview } from "./components/MarkdownPreview";
import { hasWindow, isInteractiveTarget, makeId, nowIso } from "./lib/utils";
import {
  characterName,
  clearMemoryStateShadow,
  currentCharacterIds,
  ensureActiveTab,
  ensureContextTargets,
  initialState,
  loadMemoryState,
  makeBackupPayload,
  noteEntryCount,
  noteKey,
  parseImportMemoryState,
  resolveScope,
  saveMemoryState,
  titleForScope,
  uniqueTabTitle,
  visibleTabs,
  writeMemoryStateShadow,
} from "./lib/state";
import { NotepadTabs } from "./components/NotepadTabs";
import { NotepadToolbar } from "./components/NotepadToolbar";
import { NotepadBrand, statusToneClass } from "./components/NotepadChrome";
import "./styles/notepad.css";

export function MeNotepadModule() {
  const activeChatId = useChatStore((state) => state.activeChatId);
  const activeChatFromStore = useChatStore((state) => state.activeChat);
  const chatQuery = useChat(activeChatId);
  const chat = activeChatFromStore?.id === activeChatId ? activeChatFromStore : (chatQuery.data ?? null);
  const characterIds = useMemo(() => currentCharacterIds(chat), [chat]);
  const characters = useCharacterSummariesByIds(characterIds, Boolean(activeChatId && characterIds.length));
  const characterLabels = useMemo(
    () => new Map(characters.data.map((character) => [character.id, characterName(character)])),
    [characters.data],
  );
  const context = useMemo<NotepadContext>(
    () => ({
      chatId: activeChatId,
      chat,
      characterLabels,
    }),
    [activeChatId, characterLabels, chat],
  );

  const isMobile = useIsMobileLayout();
  const [state, setState] = useState(initialState);
  const [memoryReady, setMemoryReady] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pendingDeleteTabId, setPendingDeleteTabId] = useState<string | null>(null);
  const [pendingImportState, setPendingImportState] = useState<NotepadMemoryState | null>(null);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [status, setStatus] = useState<NotepadStatus>({ message: "", tone: "muted" });
  const [memoryDirty, setMemoryDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const suppressCollapsedOpenUntilRef = useRef(0);
  const memorySaveTimerRef = useRef<number | null>(null);
  const memorySaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const memorySaveRevisionRef = useRef(0);
  const memoryReadyRef = useRef(false);
  const latestMemorySnapshotRef = useRef<NotepadMemoryState | null>(null);
  const memoryDirtyRef = useRef(false);
  const immediateMemorySaveRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    void loadMemoryState()
      .then((memory) => {
        if (cancelled) return;
        setState((current) => ({ ...current, ...memory }));
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus({
          message: error instanceof Error ? error.message : "Could not load synced notes.",
          tone: "error",
        });
      })
      .finally(() => {
        if (!cancelled) setMemoryReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const layoutSnapshot = useMemo(
    () => ({
      open: state.open,
      viewMode: state.viewMode,
      tabsCollapsed: state.tabsCollapsed,
      layout: state.layout,
      collapsedLayout: state.collapsedLayout,
    }),
    [state.collapsedLayout, state.layout, state.open, state.tabsCollapsed, state.viewMode],
  );

  useEffect(() => {
    saveLayoutState(layoutSnapshot);
  }, [layoutSnapshot]);

  const memorySnapshot = useMemo<NotepadMemoryState>(
    () => ({
      version: 1,
      activeTabId: state.activeTabId,
      tabs: state.tabs,
      notes: state.notes,
    }),
    [state.activeTabId, state.notes, state.tabs],
  );
  latestMemorySnapshotRef.current = memorySnapshot;
  memoryReadyRef.current = memoryReady;

  const queueMemorySave = useCallback((snapshot: NotepadMemoryState, revision: number) => {
    memorySaveQueueRef.current = memorySaveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (revision !== memorySaveRevisionRef.current) return;
        await saveMemoryState(snapshot);
        if (revision !== memorySaveRevisionRef.current) return;
        clearMemoryStateShadow(revision);
        memoryDirtyRef.current = false;
        if (mountedRef.current) setMemoryDirty(false);
      })
      .catch((error) => {
        memoryDirtyRef.current = true;
        if (mountedRef.current) setMemoryDirty(true);
        if (!mountedRef.current) return;
        setStatus({
          message: error instanceof Error ? error.message : "Could not sync notes.",
          tone: "error",
        });
      });
  }, []);

  const flushMemorySave = useCallback(() => {
    if (!memoryReadyRef.current) return;
    const snapshot = latestMemorySnapshotRef.current;
    if (!snapshot) return;
    if (memorySaveTimerRef.current !== null && hasWindow()) {
      window.clearTimeout(memorySaveTimerRef.current);
      memorySaveTimerRef.current = null;
    }
    queueMemorySave(snapshot, (memorySaveRevisionRef.current += 1));
  }, [queueMemorySave]);

  useLayoutEffect(() => {
    if (!memoryReady || !hasWindow()) return undefined;
    const revision = (memorySaveRevisionRef.current += 1);
    const shadowed = writeMemoryStateShadow(memorySnapshot, revision);
    memoryDirtyRef.current = true;
    setMemoryDirty(true);
    if (!shadowed) {
      setStatus({
        message: "Notes are unsaved until sync finishes.",
        tone: "error",
      });
    }
    if (memorySaveTimerRef.current !== null) {
      window.clearTimeout(memorySaveTimerRef.current);
      memorySaveTimerRef.current = null;
    }
    if (immediateMemorySaveRef.current) {
      immediateMemorySaveRef.current = false;
      queueMemorySave(memorySnapshot, revision);
      return undefined;
    }
    memorySaveTimerRef.current = window.setTimeout(() => {
      memorySaveTimerRef.current = null;
      queueMemorySave(memorySnapshot, revision);
    }, 350);
    return () => {
      if (memorySaveTimerRef.current !== null) {
        window.clearTimeout(memorySaveTimerRef.current);
        memorySaveTimerRef.current = null;
      }
    };
  }, [memoryReady, memorySnapshot, queueMemorySave]);

  const requestImmediateMemorySave = useCallback(() => {
    immediateMemorySaveRef.current = true;
  }, []);

  const handleBeforeUnload = useCallback(
    (event: BeforeUnloadEvent) => {
      flushMemorySave();
      if (!memoryDirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    },
    [flushMemorySave],
  );

  useEffect(() => {
    mountedRef.current = true;
    if (!hasWindow()) {
      return () => {
        flushMemorySave();
        mountedRef.current = false;
      };
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", flushMemorySave);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", flushMemorySave);
      flushMemorySave();
      mountedRef.current = false;
    };
  }, [flushMemorySave, handleBeforeUnload]);

  useEffect(() => {
    if (!memoryReady) return;
    setState((current) => ensureActiveTab(ensureContextTargets(current, chat), context));
  }, [chat, context, memoryReady]);

  useEffect(() => {
    if (!hasWindow()) return undefined;
    const onResize = () =>
      setState((current) => ({
        ...current,
        layout: constrainLayout(current.layout),
        collapsedLayout: constrainCollapsedLayout(current.collapsedLayout),
      }));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!pendingSelection || !textareaRef.current) return;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(pendingSelection.start, pendingSelection.end);
    setPendingSelection(null);
  }, [pendingSelection, state.notes]);

  const tabs = useMemo(() => visibleTabs(state, context), [context, state]);
  const activeTab = tabs.find((tab) => tab.id === state.activeTabId) ?? null;
  const activeScope = activeTab ? resolveScope(activeTab, context, state) : null;
  const activeNoteKey = activeTab ? noteKey(activeTab, context, state) : null;
  const currentNote = activeNoteKey ? (state.notes[activeNoteKey] ?? "") : "";
  const pendingDeleteTab = pendingDeleteTabId ? (tabs.find((tab) => tab.id === pendingDeleteTabId) ?? null) : null;
  const pendingDeleteNoteCount = noteEntryCount(pendingDeleteTab, state);
  const activeNoteEntryCount = noteEntryCount(activeTab, state);
  const notepadOpen = state.open;
  const currentLayout = state.layout;
  const currentCollapsedLayout = state.collapsedLayout;
  const rootLayout = notepadOpen ? currentLayout : currentCollapsedLayout;

  const rootStyle: CSSProperties | undefined = isMobile
    ? undefined
    : {
        left: rootLayout.x,
        top: rootLayout.y,
        right: "auto",
        bottom: "auto",
        width: notepadOpen ? currentLayout.width : COLLAPSED_WIDTH,
        height: notepadOpen ? currentLayout.height : undefined,
      };

  const setOpen = useCallback((open: boolean) => {
    setState((current) => {
      if (open) {
        return {
          ...current,
          open: true,
          layout: constrainLayout({
            ...current.layout,
            x: current.collapsedLayout.x,
            y: current.collapsedLayout.y,
          }),
        };
      }
      return {
        ...current,
        open: false,
        collapsedLayout: constrainCollapsedLayout(current.collapsedLayout),
      };
    });
    if (!open) {
      setAddMenuOpen(false);
      setActionsMenuOpen(false);
      setPendingDeleteTabId(null);
      setPendingImportState(null);
    }
  }, []);

  const showStatus = useCallback((message: string, tone: StatusTone = "muted") => {
    setStatus({ message, tone });
  }, []);

  const setCurrentNote = useCallback(
    (value: string) => {
      if (!activeTab || !activeNoteKey) return;
      const updatedAt = nowIso();
      setState((current) => ({
        ...current,
        notes: { ...current.notes, [activeNoteKey]: value },
        tabs: current.tabs.map((tab) => (tab.id === activeTab.id ? { ...tab, updatedAt } : tab)),
      }));
    },
    [activeNoteKey, activeTab],
  );

  const addTab = useCallback(
    (scope: NoteScope, branchMode: BranchMode = "branch", characterId: string | null = null) => {
      const chatTarget = context.chat;
      const timestamp = nowIso();
      const tab: NotepadTab = {
        id: makeId("tab"),
        title: uniqueTabTitle(state.tabs, titleForScope(scope, context, characterId, branchMode)),
        scope,
        branchMode: scope === "chat" ? branchMode : "branch",
        characterId: scope === "character" ? (characterId ?? currentCharacterIds(chatTarget)[0] ?? null) : null,
        chatId: scope === "chat" && branchMode === "branch" ? (chatTarget?.id ?? context.chatId) : null,
        groupId:
          scope === "chat"
            ? branchMode === "family"
              ? (chatTarget?.groupId ?? chatTarget?.id ?? context.chatId)
              : (chatTarget?.groupId ?? null)
            : null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      requestImmediateMemorySave();
      setState((current) => ({ ...current, open: true, tabs: [...current.tabs, tab], activeTabId: tab.id }));
      setAddMenuOpen(false);
      setActionsMenuOpen(false);
      setPendingDeleteTabId(null);
      showStatus(`${titleForScope(scope, context, characterId, branchMode)} tab created`, "ok");
    },
    [context, requestImmediateMemorySave, showStatus, state.tabs],
  );

  const renameActiveTab = useCallback(() => {
    if (!activeTab) return;
    setRenamingTabId(activeTab.id);
    setRenameDraft(activeTab.title);
  }, [activeTab]);

  const commitRename = useCallback(() => {
    if (!renamingTabId) return;
    const title = renameDraft.trim() || "Notes";
    const changed = title !== activeTab?.title;
    if (changed) requestImmediateMemorySave();
    setState((current) => ({
      ...current,
      tabs: current.tabs.map((tab) => (tab.id === renamingTabId ? { ...tab, title, updatedAt: nowIso() } : tab)),
    }));
    setRenamingTabId(null);
    setRenameDraft("");
    if (changed) showStatus("Renamed", "ok");
  }, [activeTab?.title, renameDraft, renamingTabId, requestImmediateMemorySave, showStatus]);

  const deleteTab = useCallback(
    (tabId: string) => {
      requestImmediateMemorySave();
      setState((current) => {
        const nextTabs = current.tabs.filter((tab) => tab.id !== tabId);
        const notes = { ...current.notes };
        for (const key of Object.keys(notes)) {
          if (key.startsWith(`${tabId}::`)) delete notes[key];
        }
        const nextState = { ...current, tabs: nextTabs, notes };
        const nextVisible = visibleTabs(nextState, context);
        return { ...nextState, activeTabId: nextVisible[0]?.id ?? nextTabs[0]?.id ?? null };
      });
      setPendingDeleteTabId(null);
      showStatus("Tab deleted", "ok");
    },
    [context, requestImmediateMemorySave, showStatus],
  );

  const exportBackup = useCallback(() => {
    const blob = new Blob([JSON.stringify(makeBackupPayload(state), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `marinara-notepad-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setActionsMenuOpen(false);
    showStatus("Backup downloaded", "ok");
  }, [showStatus, state]);

  const restoreImport = useCallback(() => {
    if (!pendingImportState) return;
    requestImmediateMemorySave();
    setState((current) => ({ ...current, ...pendingImportState }));
    setPendingImportState(null);
    showStatus("Backup restored", "ok");
  }, [pendingImportState, requestImmediateMemorySave, showStatus]);

  const handleImportFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const next = parseImportMemoryState(parsed);
        setPendingImportState(next);
        setActionsMenuOpen(false);
      } catch (error) {
        showStatus(error instanceof Error ? error.message : "Backup import failed.", "error");
      } finally {
        if (importInputRef.current) importInputRef.current.value = "";
      }
    },
    [showStatus],
  );

  const resetLayout = useCallback(() => {
    setState((current) => {
      const layout = defaultLayout();
      return { ...current, layout, collapsedLayout: constrainCollapsedLayout(layout) };
    });
    setActionsMenuOpen(false);
    showStatus("Layout reset", "ok");
  }, [showStatus]);

  const replaceSelection = useCallback(
    (build: (selected: string) => { text: string; start: number; end: number }) => {
      if (!activeTab || !textareaRef.current) return;
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = currentNote.slice(start, end);
      const replacement = build(selected);
      const nextValue = `${currentNote.slice(0, start)}${replacement.text}${currentNote.slice(end)}`;
      setCurrentNote(nextValue);
      setPendingSelection({ start: start + replacement.start, end: start + replacement.end });
    },
    [activeTab, currentNote, setCurrentNote],
  );

  const wrapSelection = useCallback(
    (prefix: string, suffix = prefix, fallback = "text") =>
      replaceSelection((selected) => {
        const inner = selected || fallback;
        return { text: `${prefix}${inner}${suffix}`, start: prefix.length, end: prefix.length + inner.length };
      }),
    [replaceSelection],
  );

  const prefixLines = useCallback(
    (prefix: string) =>
      replaceSelection((selected) => {
        const inner = selected || "item";
        const text = inner
          .split(/\r?\n/)
          .map((line) => `${prefix}${line}`)
          .join("\n");
        return { text, start: prefix.length, end: text.length };
      }),
    [replaceSelection],
  );

  const toggleChecklistLine = useCallback(
    (lineIndex: number) => {
      const lines = currentNote.split(/\r?\n/);
      const line = lines[lineIndex] ?? "";
      if (/\[( |x|X)\]/.test(line)) {
        lines[lineIndex] = line.replace(/\[( |x|X)\]/, (match) => (match.toLowerCase() === "[x]" ? "[ ]" : "[x]"));
        setCurrentNote(lines.join("\n"));
      }
    },
    [currentNote, setCurrentNote],
  );

  const moveTab = useCallback(
    (targetId: string, position: "before" | "after" = "before") => {
      if (!draggedTabId || draggedTabId === targetId) return;
      let moved = false;
      requestImmediateMemorySave();
      setState((current) => {
        const dragged = current.tabs.find((tab) => tab.id === draggedTabId);
        const target = current.tabs.find((tab) => tab.id === targetId);
        if (!dragged || !target || dragged.scope !== target.scope) return current;
        const withoutDragged = current.tabs.filter((tab) => tab.id !== draggedTabId);
        const targetIndex = withoutDragged.findIndex((tab) => tab.id === targetId);
        if (targetIndex < 0) return current;
        const insertIndex = targetIndex + (position === "after" ? 1 : 0);
        moved = true;
        return {
          ...current,
          tabs: [...withoutDragged.slice(0, insertIndex), dragged, ...withoutDragged.slice(insertIndex)],
          activeTabId: dragged.id,
        };
      });
      setDraggedTabId(null);
      setDropTarget(null);
      if (moved) showStatus("Reordered", "ok");
    },
    [draggedTabId, requestImmediateMemorySave, showStatus],
  );

  const startLayoutDrag = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      options: {
        allowInteractiveTarget?: boolean;
        constrain?: (layout: NotepadLayout) => NotepadLayout;
        onMoved?: () => void;
        target?: "layout" | "collapsedLayout";
      } = {},
    ): boolean => {
      if (event.button !== 0 || isMobile) return false;
      if (!options.allowInteractiveTarget && isInteractiveTarget(event.target)) return false;
      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      const target = options.target ?? "layout";
      const startLayout = target === "collapsedLayout" ? currentCollapsedLayout : currentLayout;
      const constrain = options.constrain ?? constrainLayout;
      let moved = false;
      const move = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        if (deltaX === 0 && deltaY === 0) return;
        if (!moved) {
          moved = true;
          options.onMoved?.();
        }
        const nextLayout = constrain({
          ...startLayout,
          x: startLayout.x + deltaX,
          y: startLayout.y + deltaY,
        });
        setState((current) =>
          target === "collapsedLayout"
            ? { ...current, collapsedLayout: nextLayout }
            : { ...current, layout: nextLayout },
        );
      };
      const stop = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) return;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
        if (moved) options.onMoved?.();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
      return true;
    },
    [currentCollapsedLayout, currentLayout, isMobile],
  );

  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!notepadOpen) return;
      if (startLayoutDrag(event)) event.preventDefault();
    },
    [notepadOpen, startLayoutDrag],
  );

  const startCollapsedDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (notepadOpen) return;
      startLayoutDrag(event, {
        allowInteractiveTarget: true,
        constrain: constrainCollapsedLayout,
        target: "collapsedLayout",
        onMoved: () => {
          suppressCollapsedOpenUntilRef.current = Date.now() + COLLAPSED_OPEN_SUPPRESS_MS;
        },
      });
    },
    [notepadOpen, startLayoutDrag],
  );

  const openFromCollapsedLauncher = useCallback(() => {
    if (Date.now() < suppressCollapsedOpenUntilRef.current) return;
    setOpen(true);
  }, [setOpen]);

  const startResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || isMobile || !state.open) return;
      event.preventDefault();
      event.stopPropagation();
      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      const startLayout = state.layout;
      const move = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        setState((current) => ({
          ...current,
          layout: constrainLayout({
            ...startLayout,
            width: startLayout.width + moveEvent.clientX - startX,
            height: startLayout.height + moveEvent.clientY - startY,
          }),
        }));
      };
      const stop = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) return;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    },
    [isMobile, state.layout, state.open],
  );

  const setTabsCollapsed = useCallback((collapsed: boolean | ((current: boolean) => boolean)) => {
    setState((current) => ({
      ...current,
      tabsCollapsed: typeof collapsed === "function" ? collapsed(current.tabsCollapsed) : collapsed,
    }));
  }, []);

  const selectTab = useCallback((tab: NotepadTab) => {
    setState((current) => ({ ...current, activeTabId: tab.id }));
    setRenamingTabId(null);
    setPendingDeleteTabId(null);
    setPendingImportState(null);
  }, []);

  const startRenameTab = useCallback((tab: NotepadTab) => {
    setState((current) => ({ ...current, activeTabId: tab.id }));
    setRenamingTabId(tab.id);
    setRenameDraft(tab.title);
  }, []);

  const toggleViewMode = useCallback(() => {
    setState((current) => ({ ...current, viewMode: current.viewMode === "preview" ? "edit" : "preview" }));
  }, []);

  const toggleActionsMenu = useCallback(() => {
    setAddMenuOpen(false);
    setActionsMenuOpen((open) => !open);
  }, []);

  const toggleAddMenu = useCallback(() => {
    setActionsMenuOpen(false);
    setAddMenuOpen((open) => !open);
  }, []);

  const requestDeleteActiveTab = useCallback(() => {
    setPendingDeleteTabId(activeTab?.id ?? null);
    setActionsMenuOpen(false);
  }, [activeTab?.id]);

  if (!activeChatId || !memoryReady) return null;

  const displayedStatus = status.message
    ? status
    : memoryDirty
      ? ({ message: "Saving notes...", tone: "muted" } satisfies NotepadStatus)
      : null;

  const groups: Array<{ scope: NoteScope; tabs: NotepadTab[] }> = [
    { scope: "global", tabs: tabs.filter((tab) => tab.scope === "global") },
    { scope: "character", tabs: tabs.filter((tab) => tab.scope === "character") },
    { scope: "chat", tabs: tabs.filter((tab) => tab.scope === "chat") },
  ];
  const canEdit = Boolean(activeTab);
  const scopeLabel = activeScope?.label ?? "No tabs";
  const placeholder = activeScope?.placeholder ?? "Create a global, character, chat, or branch-wide tab.";

  return (
    <div
      className="me-notes-root"
      style={rootStyle}
      data-core-module="me-notes"
      data-open={notepadOpen ? "true" : "false"}
    >
      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(event) => void handleImportFile(event.target.files?.[0])}
      />

      {!notepadOpen && (
        <button
          type="button"
          onClick={openFromCollapsedLauncher}
          onPointerDown={startCollapsedDrag}
          className="me-notes-collapsed-button"
          title="Open notes"
          aria-label="Open notes"
        >
          <NotepadBrand />
        </button>
      )}

      {notepadOpen && (
        <section
          aria-label="ME Notes"
          className="me-notes-panel"
          onClickCapture={(event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target?.closest("[data-notepad-menu]")) {
              setAddMenuOpen(false);
              setActionsMenuOpen(false);
            }
          }}
        >
          <NotepadHeader
            actionsMenuOpen={actionsMenuOpen}
            activeTab={activeTab}
            addMenuOpen={addMenuOpen}
            characterIds={characterIds}
            context={context}
            hasBranchWideTabOption={Boolean(chat?.groupId)}
            onAddTab={addTab}
            onExportBackup={exportBackup}
            onImportBackup={() => importInputRef.current?.click()}
            onMinimize={() => setOpen(false)}
            onRequestDeleteTab={requestDeleteActiveTab}
            onResetLayout={resetLayout}
            onStartDrag={startDrag}
            onToggleActionsMenu={toggleActionsMenu}
            onToggleAddMenu={toggleAddMenu}
          />

          <NotepadTabs
            activeTabId={state.activeTabId}
            context={context}
            draggedTabId={draggedTabId}
            dropTarget={dropTarget}
            groups={groups}
            onDragEnd={() => {
              setDraggedTabId(null);
              setDropTarget(null);
            }}
            onDragStart={setDraggedTabId}
            onMoveTab={moveTab}
            onSelectTab={selectTab}
            onSetDropTarget={setDropTarget}
            onStartRename={startRenameTab}
            onToggleCollapsed={setTabsCollapsed}
            tabsCollapsed={state.tabsCollapsed}
            tabCount={tabs.length}
          />

          <div className="shrink-0 border-b border-[var(--border)] bg-[var(--card)]/75 px-3 py-1.5">
            {renamingTabId === activeTab?.id ? (
              <input
                value={renameDraft}
                onChange={(event) => setRenameDraft(event.target.value)}
                onBlur={commitRename}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitRename();
                  if (event.key === "Escape") {
                    setRenamingTabId(null);
                    setRenameDraft("");
                  }
                }}
                maxLength={36}
                aria-label="Rename active tab"
                className="h-7 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs font-semibold outline-none focus:border-[var(--primary)]"
                autoFocus
              />
            ) : (
              <button
                type="button"
                disabled={!activeTab}
                onDoubleClick={renameActiveTab}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== "F2") return;
                  event.preventDefault();
                  renameActiveTab();
                }}
                className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md text-left text-xs font-semibold text-[var(--foreground)] disabled:cursor-default disabled:opacity-70"
                title={activeTab ? `${activeTab.title} / double-click to rename active tab` : undefined}
              >
                <span className="min-w-0 truncate">{activeTab?.title ?? "No tabs for this chat"}</span>
                <span className="flex shrink-0 items-center gap-1 text-[0.625rem] font-bold uppercase text-[var(--muted-foreground)]">
                  <span>{scopeLabel}</span>
                  {activeTab ? (
                    <span className="rounded-full bg-[var(--secondary)] px-1.5 py-px text-[0.55rem] ring-1 ring-[var(--border)]">
                      {activeNoteEntryCount}
                    </span>
                  ) : null}
                </span>
              </button>
            )}
          </div>

          <NotepadToolbar
            canEdit={canEdit}
            onPrefixLines={prefixLines}
            onToggleViewMode={toggleViewMode}
            onWrapSelection={wrapSelection}
            viewMode={state.viewMode}
          />

          {state.viewMode === "preview" ? (
            <div className="min-h-48 flex-1 overflow-y-auto bg-[var(--background)] p-3 text-sm leading-relaxed">
              <MarkdownPreview value={currentNote} onToggleChecklist={toggleChecklistLine} />
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={currentNote}
              disabled={!canEdit}
              placeholder={placeholder}
              spellCheck
              onChange={(event) => setCurrentNote(event.target.value)}
              className="min-h-48 flex-1 resize-none border-0 bg-[var(--background)] p-3 text-sm leading-relaxed text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:ring-1 focus:ring-inset focus:ring-[var(--primary)] disabled:cursor-default disabled:opacity-65"
            />
          )}

          {!isMobile && (
            <div
              title="Resize notes"
              aria-hidden="true"
              onPointerDown={startResize}
              className="me-notes-resize-handle"
            />
          )}

          {displayedStatus ? (
            <div className={cn("me-notes-status", statusToneClass(displayedStatus.tone))}>
              <span className="min-w-0 flex-1">{displayedStatus.message}</span>
              {status.message ? (
                <button
                  type="button"
                  aria-label="Dismiss status message"
                  title="Dismiss status message"
                  onClick={(event) => {
                    event.stopPropagation();
                    setStatus({ message: "", tone: "muted" });
                  }}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[var(--secondary)]/45 transition-colors hover:bg-[var(--secondary)]"
                >
                  <X size="0.75rem" />
                </button>
              ) : null}
            </div>
          ) : null}

          {pendingDeleteTab && (
            <DeleteTabDialog
              noteCount={pendingDeleteNoteCount}
              onCancel={() => setPendingDeleteTabId(null)}
              onDelete={() => deleteTab(pendingDeleteTab.id)}
              tab={pendingDeleteTab}
            />
          )}

          {pendingImportState && (
            <RestoreBackupDialog
              onCancel={() => setPendingImportState(null)}
              onRestore={restoreImport}
              pendingState={pendingImportState}
            />
          )}
        </section>
      )}
    </div>
  );
}
