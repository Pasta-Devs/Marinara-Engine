// ──────────────────────────────────────────────
// Lorebook Editor — Full-page detail view
// Replaces the chat area when editing a lorebook.
// Tabs: Overview, Entries
//
// Entries use compact inline rows with an expandable drawer (see
// LorebookEntryRow). The previous "click an entry → navigate to a sub-view"
// flow has been replaced so users can edit row-level params without leaving
// the list. Inspired by SillyTavern's World Info layout.
// ──────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  useLorebook,
  useLorebooks,
  useUpdateLorebook,
  useLorebookEntries,
  useCreateLorebookEntry,
  useDeleteLorebook,
  useReorderLorebookEntries,
  useLorebookFolders,
  useCreateLorebookFolder,
  useReorderLorebookFolders,
  useTransferLorebookEntries,
  useBulkUnvectorizeLorebookEntries,
} from "../../hooks/use-lorebooks";
import { useCharacterSummaries, useCharacterSummariesByIds } from "../../../characters/index";
import { usePersonaSummaries } from "../../../personas/index";
import { showConfirmDialog } from "../../../../../shared/lib/app-dialogs";
import { useUIStore } from "../../../../../shared/stores/ui.store";
import { useChatStore } from "../../../../../shared/stores/chat.store";
import { exportApi } from "../../../../../shared/api/export-api";
import type { Lorebook, LorebookEntry, LorebookFolder } from "../../../../../engine/contracts/types/lorebook";
import { testPrimaryKeys, testSecondaryKeys } from "../../../../../engine/shared/regex/lorebook-keyword-matching";
import { LorebookEditorHeader } from "./LorebookEditorHeader";
import { LorebookEditorTabs, type LorebookEditorTabId } from "./LorebookEditorTabs";
import { LorebookEntriesTab } from "./LorebookEntriesTab";
import { type EntrySortKey } from "./LorebookEntriesToolbar";
import { LorebookOverviewTab } from "./LorebookOverviewTab";
import { LorebookUnsavedWarning } from "./LorebookUnsavedWarning";
import { estimateTokens } from "../shared/LorebookFormFields";
import { ExportFormatDialog, type ExportFormatChoice } from "../../../../../shared/components/ui/ExportFormatDialog";
import { useLorebookEditorDragDrop } from "./use-lorebook-editor-drag-drop";
import { useLorebookEntrySelection } from "./use-lorebook-entry-selection";
import { useLorebookOverviewForm } from "./use-lorebook-overview-form";

// ──────────────────────────────────────────────
// Folder collapse state lives in localStorage — purely a UI preference, not
// worth a native storage write on every toggle. Keyed per-lorebook so collapse
// state is independent across books.
// ──────────────────────────────────────────────
const FOLDER_COLLAPSE_KEY_PREFIX = "lorebook-folder-collapsed:";

function readCollapsedFolderIds(lorebookId: string | null): Set<string> {
  if (!lorebookId || typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(`${FOLDER_COLLAPSE_KEY_PREFIX}${lorebookId}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed.filter((id): id is string => typeof id === "string"));
    return new Set();
  } catch {
    return new Set();
  }
}

function writeCollapsedFolderIds(lorebookId: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${FOLDER_COLLAPSE_KEY_PREFIX}${lorebookId}`, JSON.stringify(Array.from(ids)));
  } catch {
    /* localStorage unavailable / quota exceeded — silently degrade */
  }
}

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (value === "") {
      setDebounced("");
      return;
    }
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [delayMs, value]);
  return debounced;
}

export function LorebookEditor() {
  const lorebookId = useUIStore((s) => s.lorebookDetailId);
  const closeDetail = useUIStore((s) => s.closeLorebookDetail);
  const activeChat = useChatStore((s) => s.activeChat);
  const { data: rawLorebook, isLoading, isError } = useLorebook(lorebookId);
  const { data: rawLorebooks } = useLorebooks();
  const { data: rawEntries } = useLorebookEntries(lorebookId);
  const { data: rawFolders } = useLorebookFolders(lorebookId);
  const { data: rawPersonas } = usePersonaSummaries();
  const updateLorebook = useUpdateLorebook();
  const deleteLorebook = useDeleteLorebook();
  const createEntry = useCreateLorebookEntry();
  const reorderEntries = useReorderLorebookEntries();
  const createFolder = useCreateLorebookFolder();
  const reorderFolders = useReorderLorebookFolders();
  const transferEntries = useTransferLorebookEntries();
  const unvectorizeEntries = useBulkUnvectorizeLorebookEntries();

  const lorebook = rawLorebook as Lorebook | undefined;
  const lorebooks = useMemo(() => (rawLorebooks ?? []) as Lorebook[], [rawLorebooks]);
  const entries = useMemo(() => (rawEntries ?? []) as LorebookEntry[], [rawEntries]);
  const folders = useMemo(() => (rawFolders ?? []) as LorebookFolder[], [rawFolders]);
  const personas = useMemo(() => {
    if (!rawPersonas) return [] as Array<{ id: string; name: string; comment?: string | null }>;
    return rawPersonas.map((p) => ({
      id: p.id,
      name: p.name || "Unknown",
      comment: p.comment ?? null,
    }));
  }, [rawPersonas]);
  const activeChatLorebookIds = useMemo(() => {
    if (!activeChat?.metadata) return [] as string[];
    try {
      const meta =
        typeof activeChat.metadata === "string"
          ? JSON.parse(activeChat.metadata)
          : (activeChat.metadata as Record<string, unknown>);
      return Array.isArray(meta.activeLorebookIds) ? meta.activeLorebookIds.map(String) : [];
    } catch {
      return [];
    }
  }, [activeChat?.metadata]);

  const [activeTab, setActiveTab] = useState<LorebookEditorTabId>("overview");
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const setEditorDirty = useUIStore((s) => s.setEditorDirty);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [entrySearch, setEntrySearch] = useState("");
  const [entrySort, setEntrySort] = useState<EntrySortKey>("order");
  // Keyword-test panel state. The panel is collapsed by default so it doesn't
  // crowd the editor for users who don't need it. We debounce the text input
  // so each keystroke doesn't re-run match computation against potentially
  // hundreds of entries on every press.
  const [keywordPreviewOpen, setKeywordPreviewOpen] = useState(false);
  const [keywordPreviewText, setKeywordPreviewText] = useState("");
  const [keywordPreviewDebounced, setKeywordPreviewDebounced] = useState("");
  useEffect(() => {
    const handle = window.setTimeout(() => setKeywordPreviewDebounced(keywordPreviewText), 150);
    return () => window.clearTimeout(handle);
  }, [keywordPreviewText]);
  // ── Folder UI state ──
  // Collapse state: persisted in localStorage, keyed per-lorebook. Loaded
  // synchronously on mount so the initial render reflects the user's prior
  // preference instead of a flash-of-everything-expanded.
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(() => readCollapsedFolderIds(lorebookId));
  // When the user opens a different lorebook, reload its collapse state.
  useEffect(() => {
    setCollapsedFolderIds(readCollapsedFolderIds(lorebookId));
  }, [lorebookId]);
  const toggleFolderCollapsed = useCallback(
    (folderId: string) => {
      if (!lorebookId) return;
      setCollapsedFolderIds((prev) => {
        const next = new Set<string>(prev);
        if (next.has(folderId)) next.delete(folderId);
        else next.add(folderId);
        writeCollapsedFolderIds(lorebookId, next);
        return next;
      });
    },
    [lorebookId],
  );

  const {
    lorebookDirty,
    setLorebookDirty,
    saving,
    formName,
    formDescription,
    formCategory,
    formEnabled,
    formIsGlobal,
    formExcludeFromVectorization,
    formScanDepth,
    formTokenBudget,
    formRecursive,
    formMaxRecursionDepth,
    formCharacterIds,
    formPersonaIds,
    formTags,
    newTag,
    characterLinkSearch,
    personaLinkSearch,
    characterLinkPickerOpen,
    personaLinkPickerOpen,
    setFormName,
    setFormDescription,
    setFormCategory,
    setFormEnabled,
    setFormIsGlobal,
    setFormExcludeFromVectorization,
    setFormScanDepth,
    setFormTokenBudget,
    setFormRecursive,
    setFormMaxRecursionDepth,
    setFormCharacterIds,
    setFormPersonaIds,
    setFormTags,
    setNewTag,
    setCharacterLinkSearch,
    setPersonaLinkSearch,
    setCharacterLinkPickerOpen,
    setPersonaLinkPickerOpen,
    markLorebookDirty,
    handleSaveLorebook,
  } = useLorebookOverviewForm({
    lorebook,
    lorebookId,
    onUpdateLorebook: updateLorebook.mutateAsync,
  });
  useEffect(() => {
    setEditorDirty(lorebookDirty);
  }, [lorebookDirty, setEditorDirty]);

  const debouncedCharacterLinkSearch = useDebouncedValue(characterLinkSearch, 180);

  const { data: linkedRawCharacters } = useCharacterSummariesByIds(formCharacterIds, formCharacterIds.length > 0);
  const shouldLoadAllCharacters = characterLinkPickerOpen || activeTab === "entries";
  const {
    data: allRawCharacters,
    isFetching: allRawCharactersFetching,
    isError: allRawCharactersError,
  } = useCharacterSummaries(
    shouldLoadAllCharacters,
    characterLinkPickerOpen ? debouncedCharacterLinkSearch : undefined,
  );
  const rawCharacters = useMemo(() => {
    const byId = new Map<string, NonNullable<typeof linkedRawCharacters>[number]>();
    for (const character of linkedRawCharacters ?? []) byId.set(character.id, character);
    for (const character of allRawCharacters ?? []) byId.set(character.id, character);
    return Array.from(byId.values());
  }, [allRawCharacters, linkedRawCharacters]);
  const characters = useMemo(() => {
    return rawCharacters.map((c) => {
      const parsed = c.data ?? {};
      const tags = Array.isArray(parsed?.tags) ? parsed.tags.map(String).filter(Boolean) : [];
      const name = typeof parsed?.name === "string" ? parsed.name : "Unknown";
      const searchText = [
        c.id,
        name,
        c.comment,
        typeof parsed?.creator === "string" ? parsed.creator : null,
        typeof parsed?.creator_notes === "string" ? parsed.creator_notes : null,
        typeof parsed?.character_version === "string" ? parsed.character_version : null,
        ...tags,
      ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
      return { id: c.id, name, tags, searchText };
    });
  }, [rawCharacters]);
  const characterTags = useMemo(
    () => Array.from(new Set(characters.flatMap((character) => character.tags))).sort((a, b) => a.localeCompare(b)),
    [characters],
  );

  const characterNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const character of characters) map.set(character.id, character.name);
    return map;
  }, [characters]);
  const personaNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const persona of personas)
      map.set(persona.id, persona.comment ? `${persona.name} - ${persona.comment}` : persona.name);
    return map;
  }, [personas]);

  const scopeSummary = useMemo(() => {
    if (!formEnabled) return null;
    if (formIsGlobal) return { text: "Global" };
    if (lorebookId && activeChatLorebookIds.includes(lorebookId)) return { text: "Attached to this chat" };
    if (formCharacterIds.length > 0 || formPersonaIds.length > 0) {
      return {
        characters:
          formCharacterIds.length > 0
            ? {
                label: `${formCharacterIds.length} Character${formCharacterIds.length === 1 ? "" : "s"}:`,
                names: formCharacterIds.map((id) => characterNameById.get(id) ?? id).join(", "),
              }
            : null,
        personas:
          formPersonaIds.length > 0
            ? {
                label: `${formPersonaIds.length} Persona${formPersonaIds.length === 1 ? "" : "s"}:`,
                names: formPersonaIds.map((id) => personaNameById.get(id) ?? id).join(", "),
              }
            : null,
      };
    }
    return { text: "Not active anywhere yet" };
  }, [
    activeChatLorebookIds,
    characterNameById,
    formCharacterIds,
    formEnabled,
    formIsGlobal,
    formPersonaIds,
    lorebookId,
    personaNameById,
  ]);

  // Filtered + sorted entries (flat list — used when search is active or
  // a non-Order sort is selected, both of which suppress folder grouping).
  const filteredEntries = useMemo(() => {
    let result = entries;
    if (entrySearch) {
      const q = entrySearch.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.keys.some((k) => k.toLowerCase().includes(q)) ||
          e.content.toLowerCase().includes(q),
      );
    }
    switch (entrySort) {
      case "name-asc":
        return [...result].sort((a, b) => a.name.localeCompare(b.name));
      case "name-desc":
        return [...result].sort((a, b) => b.name.localeCompare(a.name));
      case "tokens":
        return [...result].sort((a, b) => estimateTokens(b.content) - estimateTokens(a.content));
      case "keys":
        return [...result].sort((a, b) => b.keys.length - a.keys.length);
      case "newest":
        return [...result].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
      case "oldest":
        return [...result].sort((a, b) => (a.updatedAt ?? "").localeCompare(b.updatedAt ?? ""));
      case "order":
      default:
        return [...result].sort((a, b) => a.order - b.order);
    }
  }, [entries, entrySearch, entrySort]);

  // Folder grouping is only meaningful when the user is sorting by Order with
  // no search — any other state would put entries out of their containers
  // (e.g. "Name A→Z" interleaves entries from different folders).
  const showFolderGrouping = entrySort === "order" && entrySearch.trim().length === 0;
  /** Entries for a given container (null = root, string = folder.id), sorted by Order. */
  const entriesByContainer = useMemo(() => {
    const map = new Map<string | null, LorebookEntry[]>();
    map.set(null, []);
    for (const f of folders) map.set(f.id, []);
    for (const e of entries) {
      const key = e.folderId ?? null;
      const list = map.get(key);
      // If an entry's folderId points to a deleted folder, fall back to root.
      if (list) list.push(e);
      else map.get(null)!.push(e);
    }
    for (const list of map.values()) list.sort((a, b) => a.order - b.order);
    return map;
  }, [entries, folders]);

  const {
    canReorderEntries,
    canReorderFolders,
    draggingEntryIdx,
    entryDragReadyRef,
    entryDropIdx,
    dragSourceContainer,
    setDragSourceContainer,
    dropTargetContainer,
    draggingFolderIdx,
    folderDragReadyRef,
    folderDropIdx,
    entryListRef,
    resetEntryDragState,
    resetFolderDragState,
    handleEntryDragStart,
    handleEntryDragOver,
    handleFolderHeaderDragOver,
    handleFolderBodyDragOver,
    handleRootListDragOver,
    commitEntryDrop,
    handleFolderDragStart,
    handleFolderDragOverHeader,
    commitFolderDrop,
  } = useLorebookEditorDragDrop({
    lorebookId,
    entries,
    folders,
    entriesByContainer,
    showFolderGrouping,
    reorderEntriesPending: reorderEntries.isPending,
    reorderFoldersPending: reorderFolders.isPending,
    onReorderEntries: reorderEntries.mutateAsync,
    onReorderFolders: reorderFolders.mutate,
  });

  // Keyword-test verdicts: for each entry, would the debounced preview text
  // activate it? Honors useRegex / matchWholeWords / caseSensitive /
  // secondaryKeys + selectiveLogic / enabled / constant. Skips runtime gates
  // that have no meaning outside a live chat (timing, probability, character
  // filters, semantic embeddings, recursive scan, group selection).
  // Logic mirrors the original lorebook keyword scanner —
  // both sides import the same shared helpers so the preview cannot drift.
  const previewMatches = useMemo(() => {
    const result = new Map<string, "matched" | "constant">();
    const text = keywordPreviewDebounced;
    if (!text.trim()) return result;
    for (const entry of entries) {
      if (!entry.enabled) continue;
      if (entry.constant) {
        result.set(entry.id, "constant");
        continue;
      }
      const opts = {
        useRegex: entry.useRegex,
        matchWholeWords: entry.matchWholeWords,
        caseSensitive: entry.caseSensitive,
      };
      const { matched } = testPrimaryKeys(entry.keys, text, opts);
      if (!matched) continue;
      if (entry.selective && entry.secondaryKeys.length > 0) {
        if (!testSecondaryKeys(entry.secondaryKeys, text, entry.selectiveLogic, opts)) continue;
      }
      result.set(entry.id, "matched");
    }
    return result;
  }, [entries, keywordPreviewDebounced]);

  const previewActive = keywordPreviewDebounced.trim().length > 0;
  const previewMatchCount = previewMatches.size;
  const enabledEntryCount = useMemo(() => entries.filter((entry) => entry.enabled).length, [entries]);
  const {
    entrySelectionMode,
    selectedEntryIds,
    visibleEntryIds,
    transferTargetLorebooks,
    entryTransferTargetId,
    setEntryTransferTargetId,
    toggleEntrySelectionMode,
    selectAllVisibleEntries,
    clearEntrySelection,
    exitEntrySelectionMode,
    toggleEntrySelection,
    transferSelectedEntries,
    unvectorizeSelectedEntries,
  } = useLorebookEntrySelection({
    lorebookId,
    lorebooks,
    entries,
    filteredEntries,
    showFolderGrouping,
    collapsedFolderIds,
    onTransferEntries: transferEntries.mutateAsync,
    onUnvectorizeEntries: unvectorizeEntries.mutateAsync,
  });

  // Toggle the inline drawer for an entry. Single-expand keeps the page
  // tidy; users can collapse the open one and click another to jump.
  const toggleEntryExpanded = useCallback((entryId: string) => {
    setExpandedEntryId((current) => (current === entryId ? null : entryId));
  }, []);

  const handleAddFolder = useCallback(async () => {
    if (!lorebookId) return;
    await createFolder.mutateAsync({ lorebookId, name: "New Folder", enabled: true });
  }, [lorebookId, createFolder]);

  const handleAddEntry = useCallback(async () => {
    if (!lorebookId) return;
    const result = await createEntry.mutateAsync({
      lorebookId,
      name: "New Entry",
      content: "",
      keys: [],
    });
    if (result && typeof result === "object" && "id" in result) {
      // Auto-expand the new entry's drawer so the user can fill it in.
      setExpandedEntryId((result as LorebookEntry).id);
      setActiveTab("entries");
    }
  }, [lorebookId, createEntry]);

  const handleClose = useCallback(() => {
    if (lorebookDirty) {
      setShowUnsavedWarning(true);
    } else {
      closeDetail();
    }
  }, [lorebookDirty, closeDetail]);

  // If the editor is opened with a `lorebookId` that no longer resolves on
  // native storage (a stale pointer carried over from another Marinara
  // instance's character export, or one that survived an auto-import that
  // errored), the loading branch — `isLoading || !lorebook` — would render
  // a shimmer forever. Detect the 404 explicitly and bail back to the
  // previous view with a toast so the user is not stranded.
  useEffect(() => {
    if (!lorebookId) return;
    if (isError) {
      toast.error("Lorebook not found — it may have been deleted");
      closeDetail();
    }
  }, [lorebookId, isError, closeDetail]);

  const handleDelete = useCallback(async () => {
    if (!lorebookId) return;
    if (
      !(await showConfirmDialog({
        title: "Delete Lorebook",
        message: "Delete this lorebook? All entries will be lost.",
        confirmLabel: "Delete",
        tone: "destructive",
      }))
    ) {
      return;
    }
    try {
      await deleteLorebook.mutateAsync(lorebookId);
      closeDetail();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete lorebook.");
    }
  }, [lorebookId, deleteLorebook, closeDetail]);

  const handleExportLorebook = useCallback(
    async (format: ExportFormatChoice) => {
      if (!lorebookId) return;
      try {
        const payload = await exportApi.lorebook(lorebookId, format);
        exportApi.triggerDownload(payload);
        setExportDialogOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to export lorebook.");
      }
    },
    [lorebookId],
  );

  // ── Loading ──
  if (isLoading || !lorebook) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="shimmer h-8 w-48 rounded-xl" />
      </div>
    );
  }

  // ── Main editor ──
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ExportFormatDialog
        open={exportDialogOpen}
        title="Export Lorebook"
        description="Native keeps Marinara folders and entry fields. Compatible exports a folderless World Info JSON for other roleplay tools."
        onClose={() => setExportDialogOpen(false)}
        onSelect={(format: ExportFormatChoice) => void handleExportLorebook(format)}
      />

      {showUnsavedWarning && (
        <LorebookUnsavedWarning
          onKeepEditing={() => setShowUnsavedWarning(false)}
          onDiscardAndClose={() => {
            setShowUnsavedWarning(false);
            setLorebookDirty(false);
            closeDetail();
          }}
          onSaveAndClose={() => {
            void (async () => {
              await handleSaveLorebook();
              setShowUnsavedWarning(false);
              closeDetail();
            })();
          }}
        />
      )}

      <LorebookEditorHeader
        name={lorebook.name}
        category={lorebook.category}
        entryCount={entries.length}
        dirty={lorebookDirty}
        saving={saving}
        onClose={handleClose}
        onSave={handleSaveLorebook}
        onExport={() => setExportDialogOpen(true)}
        onDelete={handleDelete}
      />

      {/* Body: Side-tabs + Content */}
      <div className="flex flex-1 overflow-hidden @max-5xl:flex-col">
        <LorebookEditorTabs activeTab={activeTab} entriesCount={entries.length} onChange={setActiveTab} />

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 @max-5xl:p-4">
          <div className="mx-auto max-w-3xl">
            {activeTab === "overview" && (
              <LorebookOverviewTab
                lorebookId={lorebookId!}
                entries={entries}
                persistedExcludeFromVectorization={lorebook.excludeFromVectorization}
                name={formName}
                description={formDescription}
                tags={formTags}
                newTag={newTag}
                category={formCategory}
                enabled={formEnabled}
                global={formIsGlobal}
                excludeFromVectorization={formExcludeFromVectorization}
                scanDepth={formScanDepth}
                tokenBudget={formTokenBudget}
                recursive={formRecursive}
                maxRecursionDepth={formMaxRecursionDepth}
                characterIds={formCharacterIds}
                personaIds={formPersonaIds}
                characters={characters}
                personas={personas}
                scopeSummary={scopeSummary}
                characterLinkSearch={characterLinkSearch}
                debouncedCharacterLinkSearch={debouncedCharacterLinkSearch}
                personaLinkSearch={personaLinkSearch}
                characterLinkPickerOpen={characterLinkPickerOpen}
                personaLinkPickerOpen={personaLinkPickerOpen}
                allRawCharactersFetching={allRawCharactersFetching}
                allRawCharactersError={allRawCharactersError}
                onNameChange={setFormName}
                onDescriptionChange={setFormDescription}
                onTagsChange={setFormTags}
                onNewTagChange={setNewTag}
                onCategoryChange={setFormCategory}
                onEnabledChange={setFormEnabled}
                onGlobalChange={setFormIsGlobal}
                onExcludeFromVectorizationChange={setFormExcludeFromVectorization}
                onScanDepthChange={setFormScanDepth}
                onTokenBudgetChange={setFormTokenBudget}
                onRecursiveChange={setFormRecursive}
                onMaxRecursionDepthChange={setFormMaxRecursionDepth}
                onCharacterIdsChange={setFormCharacterIds}
                onPersonaIdsChange={setFormPersonaIds}
                onCharacterLinkSearchChange={setCharacterLinkSearch}
                onPersonaLinkSearchChange={setPersonaLinkSearch}
                onCharacterLinkPickerOpenChange={setCharacterLinkPickerOpen}
                onPersonaLinkPickerOpenChange={setPersonaLinkPickerOpen}
                onDirty={markLorebookDirty}
              />
            )}
            {activeTab === "entries" && (
              <LorebookEntriesTab
                lorebookId={lorebookId}
                entries={entries}
                folders={folders}
                filteredEntries={filteredEntries}
                entriesByContainer={entriesByContainer}
                characters={characters}
                characterTags={characterTags}
                entrySearch={entrySearch}
                entrySort={entrySort}
                keywordPreviewOpen={keywordPreviewOpen}
                keywordPreviewText={keywordPreviewText}
                previewActive={previewActive}
                previewMatchCount={previewMatchCount}
                enabledEntryCount={enabledEntryCount}
                entrySelectionMode={entrySelectionMode}
                selectedEntryIds={selectedEntryIds}
                visibleEntryIds={visibleEntryIds}
                transferTargetLorebooks={transferTargetLorebooks}
                entryTransferTargetId={entryTransferTargetId}
                transferPending={transferEntries.isPending}
                unvectorizePending={unvectorizeEntries.isPending}
                showFolderGrouping={showFolderGrouping}
                canReorderEntries={canReorderEntries}
                canReorderFolders={canReorderFolders}
                collapsedFolderIds={collapsedFolderIds}
                draggingFolderIdx={draggingFolderIdx}
                folderDropIdx={folderDropIdx}
                draggingEntryIdx={draggingEntryIdx}
                entryDropIdx={entryDropIdx}
                dragSourceContainer={dragSourceContainer}
                dropTargetContainer={dropTargetContainer}
                expandedEntryId={expandedEntryId}
                previewMatches={previewMatches}
                entryListRef={entryListRef}
                entryDragReadyRef={entryDragReadyRef}
                folderDragReadyRef={folderDragReadyRef}
                onEntrySearchChange={setEntrySearch}
                onEntrySortChange={setEntrySort}
                onToggleSelectionMode={toggleEntrySelectionMode}
                onSelectAllVisible={selectAllVisibleEntries}
                onClearSelection={clearEntrySelection}
                onTransferTargetChange={setEntryTransferTargetId}
                onTransferEntries={(mode) => void transferSelectedEntries(mode)}
                onUnvectorizeSelectedEntries={() => void unvectorizeSelectedEntries()}
                onExitSelectionMode={exitEntrySelectionMode}
                onAddFolder={handleAddFolder}
                onAddEntry={handleAddEntry}
                onKeywordPreviewOpenChange={setKeywordPreviewOpen}
                onKeywordPreviewTextChange={setKeywordPreviewText}
                onToggleFolderCollapsed={toggleFolderCollapsed}
                onSetDragSourceContainer={setDragSourceContainer}
                onFolderDragStart={handleFolderDragStart}
                onFolderHeaderDragOver={handleFolderHeaderDragOver}
                onFolderDragOverHeader={handleFolderDragOverHeader}
                onCommitEntryDrop={commitEntryDrop}
                onCommitFolderDrop={commitFolderDrop}
                onResetFolderDragState={resetFolderDragState}
                onResetEntryDragState={resetEntryDragState}
                onFolderBodyDragOver={handleFolderBodyDragOver}
                onRootListDragOver={handleRootListDragOver}
                onEntryDragStart={handleEntryDragStart}
                onEntryDragOver={handleEntryDragOver}
                onToggleEntryExpanded={toggleEntryExpanded}
                onToggleEntrySelection={toggleEntrySelection}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
