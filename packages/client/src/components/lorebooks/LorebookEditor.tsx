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
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type DragEvent as ReactDragEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  useLorebook,
  useLorebooks,
  useUpdateLorebook,
  useLorebookEntries,
  useCreateLorebookEntry,
  useDeleteLorebook,
  useDeleteLorebookEntry,
  useReorderLorebookEntries,
  useLorebookFolders,
  useCreateLorebookFolder,
  useUpdateLorebookEntry,
  useBulkUpdateLorebookEntries,
  useReorderLorebookFolders,
  useUpdateLorebookFolder,
  useTransferLorebookEntries,
  lorebookKeys,
} from "../../hooks/use-lorebooks";
import { useCharacters, usePersonas } from "../../hooks/use-characters";
import { useConnections } from "../../hooks/use-connections";
import { useTouchFolderDrag } from "../../hooks/use-touch-folder-drag";
import { useSpatialContext } from "../../hooks/use-spatial-context";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { useSidecarStore } from "../../stores/sidecar.store";
import {
  ArrowLeft,
  Save,
  BookOpen,
  FileText,
  Plus,
  Trash2,
  Search,
  Settings2,
  AlertTriangle,
  ChevronDown,
  Globe,
  Users,
  UserRound,
  Drama,
  X,
  ArrowUpDown,
  Hash,
  Sparkles,
  Loader2,
  Check,
  CheckSquare2,
  Copy,
  MoveRight,
  Tag,
  Wand2,
  FlaskConical,
  FolderPlus,
  RefreshCw,
  Info,
} from "lucide-react";
import { cn, copyToClipboard } from "../../lib/utils";
import { HelpTooltip } from "../ui/HelpTooltip";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import { api } from "../../lib/api-client";
import {
  LOCAL_SIDECAR_CONNECTION_ID,
  LIMITS,
  includesTextForMatch,
  testPrimaryKeys,
  testSecondaryKeys,
  buildFolderForest,
  canReparentFolder,
  type Lorebook,
  type LorebookEntry,
  type LorebookFolder,
  type LorebookCategory,
  type BulkUpdateLorebookEntriesInput,
} from "@marinara-engine/shared";
import { LorebookEntryRow } from "./LorebookEntryRow";
import { LorebookFolderRow } from "./LorebookFolderRow";
import { ExpandableTextarea, estimateTokens } from "./LorebookFormFields";
import { ExportFormatDialog, type ExportFormatChoice } from "../ui/ExportFormatDialog";
import { EditorTabNavigation } from "../ui/EditorTabNavigation";
import { Modal } from "../ui/Modal";

// ──────────────────────────────────────────────
// Folder collapse state lives in localStorage — purely a UI preference, not
// worth a server round-trip on every toggle. Keyed per-lorebook so collapse
// state is independent across books.
// ──────────────────────────────────────────────
const FOLDER_COLLAPSE_KEY_PREFIX = "lorebook-folder-collapsed:";
const LOREBOOK_VECTORIZE_CONNECTION_STORAGE_KEY = "marinara:lorebook-vectorize-connection-id";

function closestElementFromPoint(x: number, y: number, selector: string) {
  const element = document.elementFromPoint(x, y);
  return element instanceof Element ? element.closest<HTMLElement>(selector) : null;
}

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

function appendNewTags(existingTags: string[], rawInput: string) {
  const seen = new Set(existingTags);
  const additions: string[] = [];

  for (const tag of rawInput.split(",").map((part) => part.trim())) {
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    additions.push(tag);
  }

  return additions.length > 0 ? [...existingTags, ...additions] : existingTags;
}

// ── Types ──
type LinkedResourceItem = {
  id: string;
  name: string;
  description?: string | null;
  deleted?: boolean;
};

function LinkedResourcePicker({
  label,
  help,
  emptyText,
  addLabel,
  searchPlaceholder,
  icon,
  items,
  selectedIds,
  search,
  onSearchChange,
  isOpen,
  onOpen,
  onClose,
  onAdd,
  onRemove,
}: {
  label: string;
  help: string;
  emptyText: string;
  addLabel: string;
  searchPlaceholder: string;
  icon: ReactNode;
  items: LinkedResourceItem[];
  selectedIds: string[];
  search: string;
  onSearchChange: (value: string) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const selectedItems = selectedIds.map(
    (id) =>
      items.find((item) => item.id === id) ?? {
        id,
        name: "(deleted)",
        description: id,
        deleted: true,
      },
  );
  const availableItems = items.filter(
    (item) =>
      !selectedIds.includes(item.id) &&
      [item.name, item.description ?? ""].some((value) => includesTextForMatch(value, search)),
  );

  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1 text-xs font-medium">
        {label} <HelpTooltip text={help} />
      </label>

      {selectedItems.length === 0 ? (
        <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {selectedItems.map((item) => (
            <div
              key={item.id}
              className="mari-editor-panel mari-editor-panel--soft flex items-center gap-2.5 px-3 py-2"
            >
              <span className="mari-chrome-accent-icon mari-accent-animated">{icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs">{item.name}</span>
                {item.description && (
                  <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                    {item.description}
                  </span>
                )}
              </span>
              <button
                onClick={() => onRemove(item.id)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                title={localizeUi("ui.lorebooks.linkedresourcepicker.removeValue1", { value1: item.name })}
              >
                <X size="0.6875rem" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!isOpen ? (
        <button
          onClick={onOpen}
          className="mari-editor-empty mt-2 flex w-full items-center justify-center gap-1.5 px-3 py-2 text-xs text-[var(--marinara-editor-muted)] transition-colors hover:border-[var(--marinara-editor-border-strong)] hover:text-[var(--marinara-editor-text)]"
        >
          <Plus size="0.75rem" /> {addLabel}
        </button>
      ) : (
        <div className="mari-editor-panel mt-2 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[var(--marinara-editor-divider)] px-3 py-2">
            <Search size="0.75rem" className="text-[var(--muted-foreground)]" />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--marinara-editor-muted)]"
            />
            <button
              onClick={onClose}
              className="text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              <X size="0.75rem" />
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {availableItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onAdd(item.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--marinara-editor-control-bg-hover)]"
              >
                <span className="mari-chrome-accent-icon mari-accent-animated">{icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs">{item.name}</span>
                  {item.description && (
                    <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                      {item.description}
                    </span>
                  )}
                </span>
                <Plus size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
              </button>
            ))}
            {availableItems.length === 0 && (
              <p className="px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                {items.length === selectedItems.length
                  ? localizeUi("ui.lorebooks.linkedresourcepicker.allValue1AlreadyAdded", {
                      value1: label.toLowerCase(),
                    })
                  : localizeUi("ui.lorebooks.linkedresourcepicker.noMatches")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const TABS = [
  { id: "overview", label: "Overview", icon: Settings2 },
  { id: "entries", label: "Entries", icon: FileText },
] as const;
type TabId = (typeof TABS)[number]["id"];

const CATEGORY_OPTIONS: Array<{ value: LorebookCategory; label: string; icon: typeof Globe }> = [
  { value: "world", label: "World", icon: Globe },
  { value: "character", label: "Character", icon: Users },
  { value: "npc", label: "NPC", icon: Drama },
  { value: "spellbook", label: "Spellbook", icon: Wand2 },
  { value: "uncategorized", label: "Uncategorized", icon: BookOpen },
];

type EntrySortKey = "order" | "entries" | "name-asc" | "name-desc" | "tokens" | "keys" | "newest" | "oldest";

const SORT_OPTIONS: Array<{ value: EntrySortKey; label: string }> = [
  { value: "order", label: "Order" },
  { value: "entries", label: "Entries" },
  { value: "name-asc", label: "Name A→Z" },
  { value: "name-desc", label: "Name Z→A" },
  { value: "tokens", label: "Tokens ↓" },
  { value: "keys", label: "Keys ↓" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

type BatchEntryChanges = BulkUpdateLorebookEntriesInput["changes"];

const BATCH_EDITABLE_ENTRY_FIELDS = [
  "enabled",
  "constant",
  "selective",
  "selectiveLogic",
  "probability",
  "scanDepth",
  "matchWholeWords",
  "caseSensitive",
  "useRegex",
  "characterFilterMode",
  "characterFilterIds",
  "characterTagFilterMode",
  "characterTagFilters",
  "generationTriggerFilterMode",
  "generationTriggerFilters",
  "additionalMatchingSources",
  "position",
  "outletName",
  "depth",
  "order",
  "role",
  "sticky",
  "cooldown",
  "delay",
  "ephemeral",
  "group",
  "groupWeight",
  "folderId",
  "preventRecursion",
  "excludeRecursion",
  "delayUntilRecursion",
  "excludeFromVectorization",
  "locked",
  "tag",
] as const satisfies ReadonlyArray<keyof BatchEntryChanges>;

const BATCH_EDITABLE_ENTRY_FIELD_SET = new Set<keyof LorebookEntry>(BATCH_EDITABLE_ENTRY_FIELDS);

function pickBatchEditableEntryChanges(changes: Partial<LorebookEntry>): BatchEntryChanges {
  const picked: Record<string, unknown> = {};
  for (const field of BATCH_EDITABLE_ENTRY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(changes, field)) {
      picked[field] = changes[field];
    }
  }
  return picked as BatchEntryChanges;
}

function omitBatchEditableEntryChanges(changes: Partial<LorebookEntry>): Partial<LorebookEntry> {
  const personalChanges: Partial<LorebookEntry> = {};
  for (const [field, value] of Object.entries(changes)) {
    if (!BATCH_EDITABLE_ENTRY_FIELD_SET.has(field as keyof LorebookEntry)) {
      (personalChanges as Record<string, unknown>)[field] = value;
    }
  }
  return personalChanges;
}

function entryStatusSortRank(entry: LorebookEntry): number {
  if (!entry.enabled) return 3;
  if (entry.constant) return 0;
  if (entry.selective) return 2;
  return 1;
}

export function LorebookEditor() {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const lorebookId = useUIStore((s) => s.lorebookDetailId);
  const closeDetail = useUIStore((s) => s.closeLorebookDetail);
  const activeChat = useChatStore((s) => s.activeChat);
  const activeOwnerChatId = activeChat?.mode === "roleplay" || activeChat?.mode === "game" ? activeChat.id : null;
  const spatialBacklinksQuery = useSpatialContext(activeOwnerChatId);
  const { data: rawLorebook, isLoading, isError } = useLorebook(lorebookId);
  const { data: rawLorebooks } = useLorebooks();
  const { data: rawEntries } = useLorebookEntries(lorebookId);
  const { data: rawFolders } = useLorebookFolders(lorebookId);
  const { data: rawCharacters } = useCharacters();
  const { data: rawPersonas } = usePersonas();
  const updateLorebook = useUpdateLorebook();
  const deleteLorebook = useDeleteLorebook();
  const createEntry = useCreateLorebookEntry();
  const deleteEntry = useDeleteLorebookEntry();
  const updateEntry = useUpdateLorebookEntry();
  const bulkUpdateEntries = useBulkUpdateLorebookEntries();
  const updateEntryMutationRef = useRef(updateEntry);
  const bulkUpdateEntriesMutationRef = useRef(bulkUpdateEntries);
  useEffect(() => {
    updateEntryMutationRef.current = updateEntry;
    bulkUpdateEntriesMutationRef.current = bulkUpdateEntries;
  }, [bulkUpdateEntries, updateEntry]);
  const reorderEntries = useReorderLorebookEntries();
  const createFolder = useCreateLorebookFolder();
  const updateFolder = useUpdateLorebookFolder();
  const reorderFolders = useReorderLorebookFolders();
  const transferEntries = useTransferLorebookEntries();

  const lorebook = rawLorebook as Lorebook | undefined;
  const lorebooks = useMemo(() => (rawLorebooks ?? []) as Lorebook[], [rawLorebooks]);
  const entries = useMemo(() => (rawEntries ?? []) as LorebookEntry[], [rawEntries]);
  const mapBacklinksByEntryId = useMemo(() => {
    const byEntryId = new Map<string, Array<{ chatId: string; locationId: string; locationName: string }>>();
    const definition = spatialBacklinksQuery.data?.definition;
    if (!activeOwnerChatId || !definition) return byEntryId;
    for (const location of definition.locations) {
      for (const entryId of location.lorebookEntryIds) {
        const backlinks = byEntryId.get(entryId) ?? [];
        backlinks.push({
          chatId: activeOwnerChatId,
          locationId: location.id,
          locationName: location.name || "Untitled location",
        });
        byEntryId.set(entryId, backlinks);
      }
    }
    return byEntryId;
  }, [activeOwnerChatId, spatialBacklinksQuery.data?.definition]);
  const folders = useMemo(() => (rawFolders ?? []) as LorebookFolder[], [rawFolders]);
  const characters = useMemo(() => {
    if (!rawCharacters) return [] as Array<{ id: string; name: string; tags: string[] }>;
    return (rawCharacters as Array<{ id: string; data: string | Record<string, unknown> }>).map((c) => {
      try {
        const parsed = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
        const tags = Array.isArray(parsed?.tags) ? parsed.tags.map(String).filter(Boolean) : [];
        return { id: c.id, name: parsed?.name ?? "Unknown", tags };
      } catch {
        return { id: c.id, name: "Unknown", tags: [] };
      }
    });
  }, [rawCharacters]);
  const characterTags = useMemo(
    () => Array.from(new Set(characters.flatMap((character) => character.tags))).sort((a, b) => a.localeCompare(b)),
    [characters],
  );
  const personas = useMemo<Array<{ id: string; name: string; comment?: string | null }>>(() => {
    if (!rawPersonas) return [];
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

  const [activeTab, setActiveTab] = useState<TabId>(
    () => (useUIStore.getState().lorebookDetailInitialTab as TabId | null) ?? "overview",
  );
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [lorebookDirty, setLorebookDirty] = useState(false);
  const formRevisionRef = useRef(0);
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const setEditorDirty = useUIStore((s) => s.setEditorDirty);
  useEffect(() => {
    setEditorDirty(lorebookDirty);
  }, [lorebookDirty, setEditorDirty]);
  const [saving, setSaving] = useState(false);
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
  const [draggingEntryIdx, setDraggingEntryIdx] = useState<number | null>(null);
  const [entryDragReadyIdx, setEntryDragReadyIdx] = useState<number | null>(null);
  const [entryDropIdx, setEntryDropIdx] = useState<number | null>(null);
  const [entrySelectionMode, setEntrySelectionMode] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [entryTransferTargetId, setEntryTransferTargetId] = useState("");
  const [entryTransferOperation, setEntryTransferOperation] = useState<"copy" | "move" | null>(null);
  const selectedEntryIdsRef = useRef(selectedEntryIds);
  useEffect(() => {
    selectedEntryIdsRef.current = selectedEntryIds;
  }, [selectedEntryIds]);

  // ── Folder UI state ──
  // Collapse state: persisted in localStorage, keyed per-lorebook. Loaded
  // synchronously on mount so the initial render reflects the user's prior
  // preference instead of a flash-of-everything-expanded.
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(() => readCollapsedFolderIds(lorebookId));
  // When the user opens a different lorebook, reload its collapse state.
  useEffect(() => {
    setCollapsedFolderIds(readCollapsedFolderIds(lorebookId));
    setEntrySelectionMode(false);
    setSelectedEntryIds(new Set());
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

  // Cross-container drag-and-drop state. The "container" is null for the root
  // group or a folder.id for entries inside a folder. We track the source
  // container so a drop can detect a cross-container move and update the
  // entry's folderId before reordering.
  const [dragSourceContainer, setDragSourceContainer] = useState<string | null | undefined>(undefined);
  const [dropTargetContainer, setDropTargetContainer] = useState<string | null | undefined>(undefined);
  // Folder reorder uses its own pair so it doesn't entangle with entry DnD.
  const [draggingFolderIdx, setDraggingFolderIdx] = useState<number | null>(null);
  const [folderDragReadyIdx, setFolderDragReadyIdx] = useState<number | null>(null);
  const [folderDropIdx, setFolderDropIdx] = useState<number | null>(null);
  // Drag-to-nest: the folder hovered as a nest target (the middle band of a
  // folder header), plus whether a dragged folder is over the root strip (drop
  // there un-nests to top level). Kept separate from folderDropIdx so the nest
  // ring and the reorder line never appear at the same time.
  const [folderNestTargetId, setFolderNestTargetId] = useState<string | null>(null);
  const [folderRootDropActive, setFolderRootDropActive] = useState(false);

  // ── Form state for lorebook overview ──
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState<LorebookCategory>("uncategorized");
  const [formEnabled, setFormEnabled] = useState(true);
  const [formIsGlobal, setFormIsGlobal] = useState(false);
  const [formScanDepth, setFormScanDepth] = useState(2);
  const [formTokenBudget, setFormTokenBudget] = useState(2048);
  const [formEntryLimit, setFormEntryLimit] = useState<number>(LIMITS.LOREBOOK_ENTRY_LIMIT_DEFAULT);
  const [formRecursive, setFormRecursive] = useState(false);
  const [formMaxRecursionDepth, setFormMaxRecursionDepth] = useState(3);
  const [formExcludeFromVectorization, setFormExcludeFromVectorization] = useState(false);
  const [formVectorQueryDepth, setFormVectorQueryDepth] = useState<number>(LIMITS.LOREBOOK_VECTOR_QUERY_DEPTH_DEFAULT);
  const [formVectorScoreThreshold, setFormVectorScoreThreshold] = useState<number>(
    LIMITS.LOREBOOK_VECTOR_SCORE_THRESHOLD_DEFAULT,
  );
  const [formVectorMaxResults, setFormVectorMaxResults] = useState<number>(LIMITS.LOREBOOK_VECTOR_MAX_RESULTS_DEFAULT);
  const [formCharacterIds, setFormCharacterIds] = useState<string[]>([]);
  const [formPersonaIds, setFormPersonaIds] = useState<string[]>([]);
  const [formTags, setFormTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [characterLinkSearch, setCharacterLinkSearch] = useState("");
  const [personaLinkSearch, setPersonaLinkSearch] = useState("");
  const [characterLinkPickerOpen, setCharacterLinkPickerOpen] = useState(false);
  const [personaLinkPickerOpen, setPersonaLinkPickerOpen] = useState(false);

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

  const loadedLorebookIdRef = useRef<string | null>(null);

  // Load lorebook data into form
  useEffect(() => {
    if (!lorebook) return;
    const hasSwitchedLorebooks = loadedLorebookIdRef.current !== lorebook.id;
    if (!hasSwitchedLorebooks && lorebookDirty) return;

    setFormName(lorebook.name);
    setFormDescription(lorebook.description);
    setFormCategory(lorebook.category);
    setFormEnabled(lorebook.enabled);
    setFormIsGlobal(lorebook.isGlobal ?? false);
    setFormScanDepth(lorebook.scanDepth);
    setFormTokenBudget(lorebook.tokenBudget);
    setFormEntryLimit(lorebook.entryLimit ?? LIMITS.LOREBOOK_ENTRY_LIMIT_DEFAULT);
    setFormRecursive(lorebook.recursiveScanning);
    setFormMaxRecursionDepth(lorebook.maxRecursionDepth ?? 3);
    setFormExcludeFromVectorization(lorebook.excludeFromVectorization ?? false);
    setFormVectorQueryDepth(lorebook.vectorQueryDepth ?? LIMITS.LOREBOOK_VECTOR_QUERY_DEPTH_DEFAULT);
    setFormVectorScoreThreshold(lorebook.vectorScoreThreshold ?? LIMITS.LOREBOOK_VECTOR_SCORE_THRESHOLD_DEFAULT);
    setFormVectorMaxResults(lorebook.vectorMaxResults ?? LIMITS.LOREBOOK_VECTOR_MAX_RESULTS_DEFAULT);
    const characterSource =
      Array.isArray(lorebook.characterIds) && lorebook.characterIds.length > 0
        ? lorebook.characterIds
        : lorebook.characterId
          ? [lorebook.characterId]
          : [];
    const personaSource =
      Array.isArray(lorebook.personaIds) && lorebook.personaIds.length > 0
        ? lorebook.personaIds
        : lorebook.personaId
          ? [lorebook.personaId]
          : [];
    setFormCharacterIds(Array.from(new Set(characterSource)));
    setFormPersonaIds(Array.from(new Set(personaSource)));
    setFormTags(lorebook.tags ?? []);
    setLorebookDirty(false);
    loadedLorebookIdRef.current = lorebook.id;
  }, [lorebook, lorebookDirty]);

  // Filtered + sorted entries (flat list — used when search is active or
  // a non-Order sort is selected, both of which suppress folder grouping).
  const filteredEntries = useMemo(() => {
    let result = entries;
    if (entrySearch) {
      result = result.filter(
        (e) =>
          includesTextForMatch(e.name, entrySearch) ||
          e.keys.some((key) => includesTextForMatch(key, entrySearch)) ||
          includesTextForMatch(e.content, entrySearch),
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
      case "entries":
        return [...result].sort(
          (a, b) =>
            entryStatusSortRank(a) - entryStatusSortRank(b) || a.order - b.order || a.name.localeCompare(b.name),
        );
      case "order":
      default:
        return [...result].sort((a, b) => a.order - b.order);
    }
  }, [entries, entrySearch, entrySort]);

  // Folder grouping is only meaningful when the user is sorting by Order with
  // no search — any other state would put entries out of their containers
  // (e.g. "Name A→Z" interleaves entries from different folders).
  const showFolderGrouping = entrySort === "order" && entrySearch.trim().length === 0;
  const transferTargetLorebooks = useMemo(
    () => lorebooks.filter((book) => book.id !== lorebookId).sort((a, b) => a.name.localeCompare(b.name)),
    [lorebooks, lorebookId],
  );
  const visibleEntryIds = useMemo(
    () => (showFolderGrouping ? entries : filteredEntries).map((entry) => entry.id),
    [entries, filteredEntries, showFolderGrouping],
  );

  useEffect(() => {
    if (entryTransferTargetId && transferTargetLorebooks.some((book) => book.id === entryTransferTargetId)) return;
    setEntryTransferTargetId(transferTargetLorebooks[0]?.id ?? "");
  }, [entryTransferTargetId, transferTargetLorebooks]);

  useEffect(() => {
    const validEntryIds = new Set(entries.map((entry) => entry.id));
    setSelectedEntryIds((current) => {
      const next = new Set(Array.from(current).filter((id) => validEntryIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [entries]);

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

  // Folder hierarchy: flat parentFolderId rows → sorted roots + child lists.
  const folderForest = useMemo(() => buildFolderForest(folders), [folders]);

  const canReorderEntries = showFolderGrouping && entries.length > 1 && !reorderEntries.isPending;
  const canReorderFolders = showFolderGrouping && folders.length > 1 && !reorderFolders.isPending;

  // Keyword-test verdicts: for each entry, would the debounced preview text
  // activate it? Honors useRegex / matchWholeWords / caseSensitive / selective
  // + secondaryKeys + selectiveLogic / enabled / constant. Skips runtime gates
  // that have no meaning outside a live chat (timing, probability, character
  // filters, semantic embeddings, recursive scan, group selection).
  // Logic mirrors packages/server/src/services/lorebook/keyword-scanner.ts —
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

  // ── Handlers ──
  const markLorebookDirty = useCallback(() => {
    formRevisionRef.current += 1;
    setLorebookDirty(true);
  }, []);

  const handleAddTags = useCallback(() => {
    const nextTags = appendNewTags(formTags, newTag);
    if (nextTags === formTags) return;
    setFormTags(nextTags);
    markLorebookDirty();
    setNewTag("");
  }, [formTags, markLorebookDirty, newTag]);

  const exitEntrySelectionMode = useCallback(() => {
    setEntrySelectionMode(false);
    setSelectedEntryIds(new Set());
  }, []);

  const toggleEntrySelection = useCallback((entryId: string) => {
    setSelectedEntryIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }, []);

  const openEntryTransferDialog = useCallback(
    (operation: "copy" | "move") => {
      if (selectedEntryIds.size === 0) return;
      if (transferTargetLorebooks.length === 0) {
        toast.error(t("lorebook.editor.batch.transfer.noDestination"));
        return;
      }
      setEntryTransferTargetId((current) =>
        transferTargetLorebooks.some((book) => book.id === current) ? current : transferTargetLorebooks[0]!.id,
      );
      setEntryTransferOperation(operation);
    },
    [selectedEntryIds.size, t, transferTargetLorebooks],
  );

  const handleTransferEntries = useCallback(async () => {
    const operation = entryTransferOperation;
    if (!operation || !lorebookId || !entryTransferTargetId || selectedEntryIds.size === 0) return;
    const targetLorebookName =
      transferTargetLorebooks.find((book) => book.id === entryTransferTargetId)?.name ??
      t("lorebook.editor.batch.transfer.selectedLorebook");

    try {
      const result = await transferEntries.mutateAsync({
        sourceLorebookId: lorebookId,
        targetLorebookId: entryTransferTargetId,
        entryIds: Array.from(selectedEntryIds),
        operation,
      });
      toast.success(
        t(`lorebook.editor.batch.transfer.${operation}Success`, {
          count: result.transferred,
          name: targetLorebookName,
        }),
      );
      setEntryTransferOperation(null);
      exitEntrySelectionMode();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(`lorebook.editor.batch.transfer.${operation}Failure`));
    }
  }, [
    entryTransferOperation,
    entryTransferTargetId,
    exitEntrySelectionMode,
    lorebookId,
    selectedEntryIds,
    t,
    transferEntries,
    transferTargetLorebooks,
  ]);

  const handleEntryUpdate = useCallback(
    async (entryId: string, sourceChanges: Partial<LorebookEntry>, changedFields: Partial<LorebookEntry>) => {
      if (!lorebookId) throw new Error(t("lorebook.editor.batch.updateFailure"));
      const selectedIds = selectedEntryIdsRef.current;
      const shouldBatch = selectedIds.size > 1 && selectedIds.has(entryId);
      const batchChanges = shouldBatch ? pickBatchEditableEntryChanges(changedFields) : ({} as BatchEntryChanges);

      if (!shouldBatch || Object.keys(batchChanges).length === 0) {
        await updateEntryMutationRef.current.mutateAsync({ lorebookId, entryId, ...sourceChanges });
        return;
      }

      const personalChanges = omitBatchEditableEntryChanges(sourceChanges);
      const tasks: Array<Promise<unknown>> = [
        bulkUpdateEntriesMutationRef.current.mutateAsync({
          lorebookId,
          entryIds: Array.from(selectedIds),
          changes: batchChanges,
        }),
      ];
      if (Object.keys(personalChanges).length > 0) {
        tasks.push(updateEntryMutationRef.current.mutateAsync({ lorebookId, entryId, ...personalChanges }));
      }

      try {
        await Promise.all(tasks);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("lorebook.editor.batch.updateFailure"));
        throw error;
      }
    },
    [lorebookId, t],
  );

  const handleDeleteSelectedEntries = useCallback(async () => {
    if (!lorebookId || selectedEntryIds.size === 0) return;
    const selectedIds = Array.from(selectedEntryIds);
    const count = selectedIds.length;

    if (
      !(await showConfirmDialog({
        title: localizeUi("ui.lorebooks.lorebookeditor.deleteLorebookEntries"),
        message: localizeUi("ui.lorebooks.lorebookeditor.deleteValue1SelectedValue2ThisCannotBeUndone", {
          value1: count,
          value2:
            count === 1
              ? localizeUi("ui.lorebooks.lorebookeditor.entry")
              : localizeUi("ui.lorebooks.lorebookeditor.entries_c2e311d"),
        }),
        confirmLabel: localizeUi("lorebook.editor.batch.delete"),
        tone: "destructive",
      }))
    ) {
      return;
    }

    const results = await Promise.allSettled(
      selectedIds.map((entryId) => deleteEntry.mutateAsync({ lorebookId, entryId })),
    );
    const failedIds = selectedIds.filter((_, index) => results[index]?.status === "rejected");
    const deletedCount = selectedIds.length - failedIds.length;

    if (deletedCount > 0) {
      toast.success(
        localizeUi("ui.lorebooks.lorebookeditor.deletedValue1Value2", {
          value1: deletedCount,
          value2:
            deletedCount === 1
              ? localizeUi("ui.lorebooks.lorebookeditor.entry")
              : localizeUi("ui.lorebooks.lorebookeditor.entries_c2e311d"),
        }),
      );
    }

    if (failedIds.length > 0) {
      setSelectedEntryIds(new Set(failedIds));
      toast.error(
        localizeUi("ui.lorebooks.lorebookeditor.failedToDeleteValue1Value2", {
          value1: failedIds.length,
          value2:
            failedIds.length === 1
              ? localizeUi("ui.lorebooks.lorebookeditor.entry")
              : localizeUi("ui.lorebooks.lorebookeditor.entries_c2e311d"),
        }),
      );
      return;
    }

    exitEntrySelectionMode();
  }, [deleteEntry, exitEntrySelectionMode, lorebookId, selectedEntryIds, localizeUi]);

  // Toggle the inline drawer for an entry. Single-expand keeps the page
  // tidy; users can collapse the open one and click another to jump.
  const toggleEntryExpanded = useCallback((entryId: string) => {
    setExpandedEntryId((current) => (current === entryId ? null : entryId));
  }, []);

  const entryListRef = useRef<HTMLDivElement | null>(null);

  const resetEntryDragState = useCallback(() => {
    setDraggingEntryIdx(null);
    setEntryDragReadyIdx(null);
    setEntryDropIdx(null);
    setDragSourceContainer(undefined);
    setDropTargetContainer(undefined);
  }, []);

  const resetFolderDragState = useCallback(() => {
    setDraggingFolderIdx(null);
    setFolderDragReadyIdx(null);
    setFolderDropIdx(null);
    setFolderNestTargetId(null);
    setFolderRootDropActive(false);
  }, []);

  const calcEntryDropIdx = useCallback((cardIdx: number, e: ReactDragEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    return e.clientY < midY ? cardIdx : cardIdx + 1;
  }, []);

  // Drag start on an entry inside a specific container. We capture the
  // source container so commitEntryDrop can detect a cross-container move.
  const handleEntryDragStart = useCallback(
    (containerId: string | null, idxInContainer: number, entryId: string, e: ReactDragEvent<HTMLDivElement>) => {
      if (!canReorderEntries) {
        e.preventDefault();
        return;
      }
      setDraggingEntryIdx(idxInContainer);
      setDragSourceContainer(containerId);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", entryId);
    },
    [canReorderEntries],
  );

  const handleEntryDragOver = useCallback(
    (containerId: string | null, idxInContainer: number, e: ReactDragEvent<HTMLDivElement>) => {
      if (!canReorderEntries || draggingEntryIdx === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setEntryDropIdx(calcEntryDropIdx(idxInContainer, e));
      setDropTargetContainer(containerId);
    },
    [calcEntryDropIdx, canReorderEntries, draggingEntryIdx],
  );

  // Dropping on a folder header drops the entry at the top of that folder.
  const handleFolderHeaderDragOver = useCallback(
    (folderId: string, e: ReactDragEvent<HTMLDivElement>) => {
      // If we're dragging an entry, this becomes a cross-container drop target.
      if (draggingEntryIdx !== null) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropTargetContainer(folderId);
        setEntryDropIdx(0);
      }
    },
    [draggingEntryIdx],
  );

  // Empty folder → still need to accept drops to land an entry inside.
  const handleFolderBodyDragOver = useCallback(
    (folderId: string, e: ReactDragEvent<HTMLDivElement>) => {
      if (!canReorderEntries || draggingEntryIdx === null) return;
      e.preventDefault();
      // Folder bodies nest — a sub-folder's body sits inside its parent's body —
      // so stop here instead of bubbling: the INNERMOST body under the cursor
      // claims the drop, rather than every ancestor firing and the outermost one
      // winning. Because a sub-folder's left margin belongs to its parent, sliding
      // the cursor left out of a nested body lands on the ancestor's body and
      // targets that ancestor — so the indent rails let you aim at any level.
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      setDropTargetContainer(folderId);
      // If hovering empty folder body, drop at end.
      const containerEntries = entriesByContainer.get(folderId) ?? [];
      setEntryDropIdx(containerEntries.length);
    },
    [canReorderEntries, draggingEntryIdx, entriesByContainer],
  );

  // Dragging a FOLDER over another folder's body nests it inside that folder, so
  // the large body areas become valid drop targets (not just the thin headers).
  const handleFolderBodyFolderDragOver = useCallback(
    (folderId: string, e: ReactDragEvent<HTMLDivElement>) => {
      if (!canReorderFolders || draggingFolderIdx === null) return;
      const dragged = folders[draggingFolderIdx];
      if (!dragged) return;
      // Dragging a folder down into the body of its OWN parent lifts it out —
      // "drag it past the parent, out the bottom" un-nests it to the top level.
      if (dragged.parentFolderId === folderId) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        setFolderRootDropActive(true);
        setFolderNestTargetId(null);
        setFolderDropIdx(null);
        return;
      }
      // Otherwise nest inside this folder when legal; if not, let the event bubble
      // so an ancestor body (or nothing) claims it instead of a dead "no-drop".
      if (!canReparentFolder(folders, dragged.id, folderId).ok) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      setFolderNestTargetId(folderId);
      setFolderDropIdx(null);
      setFolderRootDropActive(false);
    },
    [canReorderFolders, draggingFolderIdx, folders],
  );

  const handleRootListDragOver = useCallback(
    (e: ReactDragEvent<HTMLDivElement>) => {
      if (!canReorderEntries || draggingEntryIdx === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      const container = entryListRef.current;
      const rootEntries = entriesByContainer.get(null) ?? [];
      if (!container || rootEntries.length === 0) {
        setDropTargetContainer(null);
        setEntryDropIdx(rootEntries.length);
        return;
      }

      const firstCard = container.firstElementChild as HTMLElement | null;
      const lastCard = container.lastElementChild as HTMLElement | null;
      if (!firstCard || !lastCard) return;

      const firstRect = firstCard.getBoundingClientRect();
      if (e.clientY < firstRect.top) {
        setDropTargetContainer(null);
        setEntryDropIdx(0);
        return;
      }

      const lastRect = lastCard.getBoundingClientRect();
      if (e.clientY > lastRect.bottom) {
        setDropTargetContainer(null);
        setEntryDropIdx(rootEntries.length);
      }
    },
    [canReorderEntries, draggingEntryIdx, entriesByContainer],
  );

  const commitEntryDrop = useCallback(
    (e: ReactDragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const sourceIdx = draggingEntryIdx;
      const targetIdx = entryDropIdx;
      const sourceContainer = dragSourceContainer;
      const targetContainer = dropTargetContainer;
      resetEntryDragState();
      if (
        !lorebookId ||
        !canReorderEntries ||
        sourceIdx === null ||
        targetIdx === null ||
        sourceContainer === undefined ||
        targetContainer === undefined
      ) {
        return;
      }

      const sourceList = (entriesByContainer.get(sourceContainer) ?? []).slice();
      const moved = sourceList[sourceIdx];
      if (!moved) return;

      // Same-container reorder — preserves the existing reorder semantic.
      if (sourceContainer === targetContainer) {
        let insertAt = targetIdx;
        if (sourceIdx < insertAt) insertAt--;
        if (sourceIdx === insertAt) return;
        const ids = sourceList.map((entry) => entry.id);
        ids.splice(sourceIdx, 1);
        ids.splice(insertAt, 0, moved.id);
        reorderEntries.mutate({ lorebookId, entryIds: ids, folderId: sourceContainer });
        return;
      }

      // Cross-container move. Only update folderId — leave the entry's Order
      // untouched. The entry will slot into its sorted position in the new
      // container based on its existing Order value, and the user can change
      // Order explicitly via the inline editor if they want to reposition it.
      // (Within-container drags renumber Order because the drag *is* how you
      // change Order in that case; cross-container drags express folder
      // membership only.)
      updateEntry.mutate({ lorebookId, entryId: moved.id, folderId: targetContainer });
    },
    [
      canReorderEntries,
      draggingEntryIdx,
      dragSourceContainer,
      dropTargetContainer,
      entriesByContainer,
      entryDropIdx,
      lorebookId,
      reorderEntries,
      resetEntryDragState,
      updateEntry,
    ],
  );

  // ── Folder reorder DnD ──
  const handleFolderDragStart = useCallback(
    (idx: number, folderId: string, e: ReactDragEvent<HTMLDivElement>) => {
      if (!canReorderFolders) {
        e.preventDefault();
        return;
      }
      setDraggingFolderIdx(idx);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", folderId);
    },
    [canReorderFolders],
  );

  const handleFolderDragOverHeader = useCallback(
    (idx: number, e: ReactDragEvent<HTMLDivElement>) => {
      if (!canReorderFolders || draggingFolderIdx === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setFolderRootDropActive(false);
      const dragged = folders[draggingFolderIdx];
      const target = folders[idx];
      const rect = e.currentTarget.getBoundingClientRect();
      const offset = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.5;
      // The middle band nests the dragged folder inside this one; the top and
      // bottom bands reorder it as a sibling. Only offer the nest band when the
      // move is actually legal (canReparentFolder blocks self/descendant/cross-
      // lorebook) and the folder isn't already inside this one — otherwise the
      // whole header behaves as reorder.
      const canNest =
        !!dragged &&
        !!target &&
        dragged.parentFolderId !== target.id &&
        canReparentFolder(folders, dragged.id, target.id).ok;
      if (canNest && offset > 0.3 && offset < 0.7) {
        setFolderNestTargetId(target.id);
        setFolderDropIdx(null);
        return;
      }
      setFolderNestTargetId(null);
      const midY = rect.top + rect.height / 2;
      setFolderDropIdx(e.clientY < midY ? idx : idx + 1);
    },
    [canReorderFolders, draggingFolderIdx, folders],
  );

  const commitFolderDrop = useCallback(
    (e: ReactDragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const sourceIdx = draggingFolderIdx;
      const nestTargetId = folderNestTargetId;
      const targetIdx = folderDropIdx;
      const unnest = folderRootDropActive;
      resetFolderDragState();
      if (!lorebookId || !canReorderFolders || sourceIdx === null) return;
      const dragged = folders[sourceIdx];
      if (!dragged) return;
      // Un-nest: lift the folder back to the top level.
      if (unnest) {
        if (dragged.parentFolderId == null) return;
        updateFolder.mutate({ lorebookId, folderId: dragged.id, parentFolderId: null });
        return;
      }
      // Nest band: reparent the dragged folder under the hovered one. Re-validate
      // at drop time in case the tree shifted mid-drag.
      if (nestTargetId) {
        if (dragged.parentFolderId === nestTargetId) return;
        if (!canReparentFolder(folders, dragged.id, nestTargetId).ok) return;
        updateFolder.mutate({ lorebookId, folderId: dragged.id, parentFolderId: nestTargetId });
        return;
      }
      // Reorder band: move within the flat order (the forest re-sorts each
      // sibling group by it). Parent is unchanged.
      if (targetIdx === null) return;
      let insertAt = targetIdx;
      if (sourceIdx < insertAt) insertAt--;
      if (sourceIdx === insertAt) return;
      const ids = folders.map((f) => f.id);
      const [moved] = ids.splice(sourceIdx, 1);
      if (!moved) return;
      ids.splice(insertAt, 0, moved);
      reorderFolders.mutate({ lorebookId, folderIds: ids });
    },
    [
      canReorderFolders,
      draggingFolderIdx,
      folderNestTargetId,
      folderDropIdx,
      folderRootDropActive,
      folders,
      lorebookId,
      reorderFolders,
      updateFolder,
      resetFolderDragState,
    ],
  );

  const locateEntryForTouchDrag = useCallback(
    (entryId: string): { containerId: string | null; index: number } | null => {
      for (const [containerId, containerEntries] of entriesByContainer) {
        const index = containerEntries.findIndex((entry) => entry.id === entryId);
        if (index >= 0) return { containerId, index };
      }
      return null;
    },
    [entriesByContainer],
  );

  const commitTouchEntryDrop = useCallback(
    (entryId: string, x: number, y: number) => {
      const source = locateEntryForTouchDrag(entryId);
      resetEntryDragState();
      if (!lorebookId || !canReorderEntries || !source) return;

      let targetContainer: string | null | undefined;
      let targetIdx: number | null = null;
      const entryRow = closestElementFromPoint(x, y, "[data-lorebook-entry-row-id]");
      const targetEntryId = entryRow?.dataset.lorebookEntryRowId;

      if (targetEntryId) {
        const target = locateEntryForTouchDrag(targetEntryId);
        if (!target) return;
        const rect = entryRow.getBoundingClientRect();
        targetContainer = target.containerId;
        targetIdx = y < rect.top + rect.height / 2 ? target.index : target.index + 1;
      } else {
        const folderRow = closestElementFromPoint(x, y, "[data-lorebook-folder-row-id]");
        const folderBody = closestElementFromPoint(x, y, "[data-lorebook-folder-body-id]");
        const rootEntries = closestElementFromPoint(x, y, "[data-lorebook-entry-root]");

        if (folderRow?.dataset.lorebookFolderRowId) {
          targetContainer = folderRow.dataset.lorebookFolderRowId;
          targetIdx = 0;
        } else if (folderBody?.dataset.lorebookFolderBodyId) {
          targetContainer = folderBody.dataset.lorebookFolderBodyId;
          targetIdx = entriesByContainer.get(targetContainer)?.length ?? 0;
        } else if (rootEntries) {
          targetContainer = null;
          targetIdx = entriesByContainer.get(null)?.length ?? 0;
        }
      }

      if (targetContainer === undefined || targetIdx === null) return;

      const sourceList = (entriesByContainer.get(source.containerId) ?? []).slice();
      const moved = sourceList[source.index];
      if (!moved) return;

      if (source.containerId === targetContainer) {
        let insertAt = targetIdx;
        if (source.index < insertAt) insertAt--;
        if (source.index === insertAt) return;
        const ids = sourceList.map((entry) => entry.id);
        ids.splice(source.index, 1);
        ids.splice(insertAt, 0, moved.id);
        reorderEntries.mutate({ lorebookId, entryIds: ids, folderId: source.containerId });
        return;
      }

      updateEntry.mutate({ lorebookId, entryId: moved.id, folderId: targetContainer });
    },
    [
      canReorderEntries,
      entriesByContainer,
      locateEntryForTouchDrag,
      lorebookId,
      reorderEntries,
      resetEntryDragState,
      updateEntry,
    ],
  );

  const cancelTouchEntryDrag = useCallback(
    (_entryId: string, _wasActive: boolean) => {
      resetEntryDragState();
    },
    [resetEntryDragState],
  );

  const { startTouchDrag: startEntryTouchDrag } = useTouchFolderDrag({
    onActivate: (entryId) => {
      const source = locateEntryForTouchDrag(entryId);
      if (!source || !canReorderEntries) return;
      setDraggingEntryIdx(source.index);
      setEntryDragReadyIdx(source.index);
      setDragSourceContainer(source.containerId);
    },
    onDrop: commitTouchEntryDrop,
    onCancel: cancelTouchEntryDrag,
  });

  const handleEntryDragHandleTouchStart = useCallback(
    (entryId: string, e: ReactTouchEvent<HTMLButtonElement>, sourceElement: HTMLDivElement | null) => {
      if (!canReorderEntries) return;
      startEntryTouchDrag(e, entryId, { allowInteractiveTarget: true, sourceElement });
    },
    [canReorderEntries, startEntryTouchDrag],
  );

  const commitTouchFolderDrop = useCallback(
    (folderId: string, x: number, y: number) => {
      const sourceIdx = folders.findIndex((folder) => folder.id === folderId);
      resetFolderDragState();
      if (!lorebookId || !canReorderFolders || sourceIdx < 0) return;
      const dragged = folders[sourceIdx];
      if (!dragged) return;

      const folderRow = closestElementFromPoint(x, y, "[data-lorebook-folder-row-id]");
      const targetFolderId = folderRow?.dataset.lorebookFolderRowId;
      if (targetFolderId === dragged.id) return;
      if (targetFolderId) {
        const targetIdx = folders.findIndex((folder) => folder.id === targetFolderId);
        const target = folders[targetIdx];
        if (!target) return;

        const rect = folderRow.getBoundingClientRect();
        const offset = rect.height > 0 ? (y - rect.top) / rect.height : 0.5;
        const canNest = dragged.parentFolderId !== target.id && canReparentFolder(folders, dragged.id, target.id).ok;
        if (canNest && offset > 0.3 && offset < 0.7) {
          updateFolder.mutate({ lorebookId, folderId: dragged.id, parentFolderId: target.id });
          return;
        }

        let insertAt = y < rect.top + rect.height / 2 ? targetIdx : targetIdx + 1;
        if (sourceIdx < insertAt) insertAt--;
        if (sourceIdx === insertAt) return;
        const ids = folders.map((folder) => folder.id);
        const [moved] = ids.splice(sourceIdx, 1);
        if (!moved) return;
        ids.splice(insertAt, 0, moved);
        reorderFolders.mutate({ lorebookId, folderIds: ids });
        return;
      }

      const folderBody = closestElementFromPoint(x, y, "[data-lorebook-folder-body-id]");
      const bodyTargetId = folderBody?.dataset.lorebookFolderBodyId;
      if (bodyTargetId && bodyTargetId !== dragged.id) {
        if (dragged.parentFolderId === bodyTargetId) {
          updateFolder.mutate({ lorebookId, folderId: dragged.id, parentFolderId: null });
          return;
        }
        if (canReparentFolder(folders, dragged.id, bodyTargetId).ok) {
          updateFolder.mutate({ lorebookId, folderId: dragged.id, parentFolderId: bodyTargetId });
        }
        return;
      }

      if (
        dragged.parentFolderId != null &&
        (closestElementFromPoint(x, y, "[data-lorebook-folder-root]") ||
          closestElementFromPoint(x, y, "[data-lorebook-entry-root]"))
      ) {
        updateFolder.mutate({ lorebookId, folderId: dragged.id, parentFolderId: null });
      }
    },
    [canReorderFolders, folders, lorebookId, reorderFolders, resetFolderDragState, updateFolder],
  );

  const cancelTouchFolderDrag = useCallback(
    (_folderId: string, _wasActive: boolean) => {
      resetFolderDragState();
    },
    [resetFolderDragState],
  );

  const { startTouchDrag: startFolderTouchDrag } = useTouchFolderDrag({
    onActivate: (folderId) => {
      const idx = folders.findIndex((folder) => folder.id === folderId);
      if (idx < 0 || !canReorderFolders) return;
      setDraggingFolderIdx(idx);
      setFolderDragReadyIdx(idx);
    },
    onDrop: commitTouchFolderDrop,
    onCancel: cancelTouchFolderDrag,
  });

  const handleFolderDragHandleTouchStart = useCallback(
    (folderId: string, e: ReactTouchEvent<HTMLButtonElement>, sourceElement: HTMLDivElement | null) => {
      if (!canReorderFolders) return;
      startFolderTouchDrag(e, folderId, { allowInteractiveTarget: true, sourceElement });
    },
    [canReorderFolders, startFolderTouchDrag],
  );

  // The folder list's own padding/gaps are the un-nest drop zone: dropping a
  // nested folder there lifts it back to the top level.
  const handleFolderRootDragOver = useCallback(
    (e: ReactDragEvent<HTMLDivElement>) => {
      if (!canReorderFolders || draggingFolderIdx === null) return;
      const dragged = folders[draggingFolderIdx];
      if (!dragged || dragged.parentFolderId == null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setFolderNestTargetId(null);
      setFolderDropIdx(null);
      setFolderRootDropActive(true);
    },
    [canReorderFolders, draggingFolderIdx, folders],
  );

  const handleAddFolder = useCallback(async () => {
    if (!lorebookId) return;
    await createFolder.mutateAsync({
      lorebookId,
      name: localizeUi("ui.panels.backgroundpicker.newFolder"),
      enabled: true,
    });
  }, [lorebookId, createFolder, localizeUi]);

  const handleSaveLorebook = useCallback((): Promise<boolean> => {
    if (!lorebookId) return Promise.resolve(false);
    if (saveInFlightRef.current) return saveInFlightRef.current;
    const formRevision = formRevisionRef.current;
    setSaving(true);
    const savePromise = (async () => {
      try {
        await updateLorebook.mutateAsync({
          id: lorebookId,
          name: formName,
          description: formDescription,
          category: formCategory,
          enabled: formEnabled,
          isGlobal: formIsGlobal,
          scanDepth: formScanDepth,
          tokenBudget: formTokenBudget,
          entryLimit: formEntryLimit,
          recursiveScanning: formRecursive,
          maxRecursionDepth: formMaxRecursionDepth,
          excludeFromVectorization: formExcludeFromVectorization,
          vectorQueryDepth: formVectorQueryDepth,
          vectorScoreThreshold: formVectorScoreThreshold,
          vectorMaxResults: formVectorMaxResults,
          characterIds: formIsGlobal ? [] : formCharacterIds,
          personaIds: formIsGlobal ? [] : formPersonaIds,
          tags: formTags,
        });
        if (formRevisionRef.current !== formRevision) return false;
        setLorebookDirty(false);
        toast.success(localizeUi("ui.lorebooks.lorebookeditor.lorebookSaved"));
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : localizeUi("ui.lorebooks.lorebookeditor.failedToSaveLorebook"),
        );
        return false;
      } finally {
        setSaving(false);
        saveInFlightRef.current = null;
      }
    })();
    saveInFlightRef.current = savePromise;
    return savePromise;
  }, [
    lorebookId,
    formName,
    formDescription,
    formCategory,
    formEnabled,
    formIsGlobal,
    formScanDepth,
    formTokenBudget,
    formEntryLimit,
    formRecursive,
    formMaxRecursionDepth,
    formExcludeFromVectorization,
    formVectorQueryDepth,
    formVectorScoreThreshold,
    formVectorMaxResults,
    formCharacterIds,
    formPersonaIds,
    formTags,
    updateLorebook,
    localizeUi,
  ]);

  const handleAddEntry = useCallback(async () => {
    if (!lorebookId) return;
    const result = await createEntry.mutateAsync({
      lorebookId,
      name: "New Entry",
      content: "",
      keys: [],
      preventRecursion: true,
    });
    if (result && typeof result === "object" && "id" in result) {
      // Auto-expand the new entry's drawer so the user can fill it in.
      setExpandedEntryId((result as LorebookEntry).id);
      setActiveTab("entries");
    }
  }, [lorebookId, createEntry]);

  const handleClose = useCallback(() => {
    if (saving) return;
    if (lorebookDirty) {
      setShowUnsavedWarning(true);
    } else {
      closeDetail();
    }
  }, [lorebookDirty, saving, closeDetail]);

  // If the editor is opened with a `lorebookId` that no longer resolves on
  // the server (a stale pointer carried over from another Marinara
  // instance's character export, or one that survived an auto-import that
  // errored), the loading branch — `isLoading || !lorebook` — would render
  // a shimmer forever. Detect the 404 explicitly and bail back to the
  // previous view with a toast so the user is not stranded.
  useEffect(() => {
    if (!lorebookId) return;
    if (isError) {
      toast.error(localizeUi("ui.lorebooks.lorebookeditor.lorebookNotFoundItMayHaveBeenDeleted"));
      closeDetail();
    }
  }, [lorebookId, isError, closeDetail, localizeUi]);

  const handleDelete = useCallback(async () => {
    if (!lorebookId) return;
    if (
      !(await showConfirmDialog({
        title: localizeUi("ui.lorebooks.lorebookeditor.deleteLorebook_570bd40"),
        message: localizeUi("dialog.delete.namedContents", {
          name: lorebook?.name || localizeUi("ui.lorebooks.lorebookeditor.deleteLorebook"),
        }),
        confirmLabel: localizeUi("lorebook.editor.batch.delete"),
        tone: "destructive",
      }))
    ) {
      return;
    }
    await deleteLorebook.mutateAsync(lorebookId);
    closeDetail();
  }, [closeDetail, deleteLorebook, lorebook?.name, lorebookId, localizeUi]);

  // ── Loading ──
  if (isLoading || !lorebook) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="shimmer h-8 w-48 rounded-xl" />
      </div>
    );
  }

  // Recursive folder renderer: a folder header, then (when expanded) its entries
  // followed by its child folders nested inside. `renderedFolderIds` guards a
  // malformed cycle from rendering a folder twice.
  const renderedFolderIds = new Set<string>();
  const renderFolder = (folder: LorebookFolder): ReactNode => {
    if (!lorebookId || renderedFolderIds.has(folder.id)) return null;
    renderedFolderIds.add(folder.id);
    const fIdx = folders.findIndex((f) => f.id === folder.id);
    const folderEntries = entriesByContainer.get(folder.id) ?? [];
    const isCollapsed = collapsedFolderIds.has(folder.id);
    const childFolders = folderForest.childrenByParent.get(folder.id) ?? [];
    // Highlight this folder's body + indent rail while it's the live entry-drop
    // target, so the user can see which nesting level they're aiming at.
    const isEntryDropTarget = draggingEntryIdx !== null && dropTargetContainer === folder.id;
    const isFolderNestTarget = draggingFolderIdx !== null && folderNestTargetId === folder.id;
    const showFolderDropBefore =
      folderDropIdx === fIdx &&
      draggingFolderIdx !== null &&
      draggingFolderIdx !== fIdx &&
      draggingFolderIdx !== fIdx - 1;
    const showFolderDropAfter =
      fIdx === folders.length - 1 &&
      folderDropIdx === folders.length &&
      draggingFolderIdx !== null &&
      draggingFolderIdx !== fIdx;
    return (
      <div key={folder.id} className="space-y-1">
        {showFolderDropBefore && (
          <div className="mari-chrome-accent-progress mari-accent-animated mx-2 mb-1 h-0.5 rounded-full" />
        )}
        <LorebookFolderRow
          folder={folder}
          lorebookId={lorebookId}
          folders={folders}
          entryCount={folderEntries.length}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => toggleFolderCollapsed(folder.id)}
          draggable={canReorderFolders}
          isDragging={draggingFolderIdx === fIdx}
          isDragReady={folderDragReadyIdx === fIdx}
          isNestTarget={folderNestTargetId === folder.id}
          onDragHandleMouseDown={() => {
            if (canReorderFolders) setFolderDragReadyIdx(fIdx);
          }}
          onDragHandleMouseUp={() => setFolderDragReadyIdx(null)}
          onDragHandleTouchStart={(e, sourceElement) => handleFolderDragHandleTouchStart(folder.id, e, sourceElement)}
          onDragStart={(e) => handleFolderDragStart(fIdx, folder.id, e)}
          onDragOver={(e) => {
            e.stopPropagation();
            if (draggingEntryIdx !== null) handleFolderHeaderDragOver(folder.id, e);
            else handleFolderDragOverHeader(fIdx, e);
          }}
          onDrop={(e) => {
            e.stopPropagation();
            if (draggingEntryIdx !== null) commitEntryDrop(e);
            else commitFolderDrop(e);
          }}
          onDragEnd={() => {
            resetFolderDragState();
            resetEntryDragState();
          }}
          selectionMode={entrySelectionMode}
          allSelected={
            entrySelectionMode &&
            (entriesByContainer.get(folder.id) ?? []).length > 0 &&
            (entriesByContainer.get(folder.id) ?? []).every((entry) => selectedEntryIds.has(entry.id))
          }
          onToggleSelectAll={() => {
            const folderEntries = entriesByContainer.get(folder.id) ?? [];
            const allSelected =
              folderEntries.length > 0 && folderEntries.every((entry) => selectedEntryIds.has(entry.id));
            setSelectedEntryIds((current) => {
              const next = new Set(current);
              for (const entry of folderEntries) {
                if (allSelected) next.delete(entry.id);
                else next.add(entry.id);
              }
              return next;
            });
          }}
        />
        {!isCollapsed && (
          <div
            data-lorebook-folder-body-id={folder.id}
            className={cn(
              "ml-2 space-y-1.5 border-l pl-2 transition-colors sm:ml-3 sm:pl-2.5",
              isEntryDropTarget || isFolderNestTarget
                ? "border-[var(--marinara-editor-border-strong)] bg-[var(--marinara-editor-control-bg-hover)]"
                : "border-[var(--border)]",
            )}
            onDragOver={(e) => {
              if (draggingEntryIdx !== null) handleFolderBodyDragOver(folder.id, e);
              else handleFolderBodyFolderDragOver(folder.id, e);
            }}
            onDrop={(e) => {
              e.stopPropagation();
              if (draggingEntryIdx !== null) commitEntryDrop(e);
              else commitFolderDrop(e);
            }}
          >
            {folderEntries.length === 0 && childFolders.length === 0 && (
              <p className="py-2 text-[0.625rem] italic text-[var(--muted-foreground)]">
                {localizeUi("ui.lorebooks.lorebookeditor.emptyDragAnEntryHereOrPickThisFolder")}
              </p>
            )}
            {folderEntries.map((entry, eIdx) => {
              const isDropTarget = dropTargetContainer === folder.id && draggingEntryIdx !== null;
              const sameContainer = dragSourceContainer === folder.id;
              const showDropBefore =
                isDropTarget &&
                sameContainer &&
                entryDropIdx === eIdx &&
                draggingEntryIdx !== eIdx &&
                draggingEntryIdx !== eIdx - 1;
              const showDropAfter =
                isDropTarget &&
                sameContainer &&
                eIdx === folderEntries.length - 1 &&
                entryDropIdx === folderEntries.length &&
                draggingEntryIdx !== eIdx;
              return (
                <div key={entry.id}>
                  {showDropBefore && (
                    <div className="mari-chrome-accent-progress mari-accent-animated mx-2 mb-1 h-0.5 rounded-full" />
                  )}
                  <LorebookEntryRow
                    entry={entry}
                    lorebookId={lorebookId}
                    isExpanded={expandedEntryId === entry.id}
                    onToggleExpand={() => toggleEntryExpanded(entry.id)}
                    characters={characters}
                    characterTags={characterTags}
                    folders={folders}
                    draggable={canReorderEntries}
                    isDragging={sameContainer && draggingEntryIdx === eIdx}
                    isDragReady={sameContainer && entryDragReadyIdx === eIdx}
                    onDragHandleMouseDown={() => {
                      if (canReorderEntries) {
                        setEntryDragReadyIdx(eIdx);
                        setDragSourceContainer(folder.id);
                      }
                    }}
                    onDragHandleMouseUp={() => setEntryDragReadyIdx(null)}
                    onDragHandleTouchStart={(e, sourceElement) =>
                      handleEntryDragHandleTouchStart(entry.id, e, sourceElement)
                    }
                    onDragStart={(e) => handleEntryDragStart(folder.id, eIdx, entry.id, e)}
                    onDragOver={(e) => {
                      // A folder dragged over an entry is really being dragged over the
                      // enclosing folder's body — route it there (nest / un-nest).
                      if (draggingFolderIdx !== null) {
                        handleFolderBodyFolderDragOver(folder.id, e);
                        return;
                      }
                      e.stopPropagation();
                      handleEntryDragOver(folder.id, eIdx, e);
                    }}
                    onDrop={(e) => {
                      e.stopPropagation();
                      if (draggingFolderIdx !== null) commitFolderDrop(e);
                      else commitEntryDrop(e);
                    }}
                    onDragEnd={resetEntryDragState}
                    selectionMode={entrySelectionMode}
                    isSelected={selectedEntryIds.has(entry.id)}
                    onToggleSelected={() => toggleEntrySelection(entry.id)}
                    previewMatch={previewMatches.get(entry.id)}
                    mapBacklinks={mapBacklinksByEntryId.get(entry.id)}
                    onUpdateEntry={handleEntryUpdate}
                  />
                  {showDropAfter && (
                    <div className="mari-chrome-accent-progress mari-accent-animated mx-2 mt-1 h-0.5 rounded-full" />
                  )}
                </div>
              );
            })}
            {childFolders.map((child) => renderFolder(child))}
          </div>
        )}
        {showFolderDropAfter && (
          <div className="mari-chrome-accent-progress mari-accent-animated mx-2 mt-1 h-0.5 rounded-full" />
        )}
      </div>
    );
  };

  // ── Main editor ──
  return (
    <div className="mari-editor-shell mari-editor-legacy-bridge flex flex-1 flex-col overflow-hidden">
      <ExportFormatDialog
        open={exportDialogOpen}
        title={localizeUi("ui.lorebooks.lorebookeditor.exportLorebook")}
        description={localizeUi(
          "ui.lorebooks.lorebookeditor.nativeKeepsMarinaraFoldersAndEntryFieldsCompatibleExports",
        )}
        onClose={() => setExportDialogOpen(false)}
        onSelect={(format: ExportFormatChoice) => {
          if (!lorebookId) return;
          setExportDialogOpen(false);
          void api.download(`/lorebooks/${lorebookId}/export?format=${format}`);
        }}
      />
      <Modal
        open={entryTransferOperation !== null}
        onClose={() => {
          if (!transferEntries.isPending) setEntryTransferOperation(null);
        }}
        title={t(
          entryTransferOperation === "copy"
            ? "lorebook.editor.batch.transfer.copyTitle"
            : "lorebook.editor.batch.transfer.moveTitle",
        )}
        width="max-w-sm"
        closeDisabled={transferEntries.isPending}
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
            {t(
              entryTransferOperation === "copy"
                ? "lorebook.editor.batch.transfer.copyMessage"
                : "lorebook.editor.batch.transfer.moveMessage",
              { count: selectedEntryIds.size },
            )}
          </p>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--foreground)]">
              {t("lorebook.editor.batch.transfer.destination")}
            </span>
            <select
              value={entryTransferTargetId}
              onChange={(event) => setEntryTransferTargetId(event.target.value)}
              aria-label={t("lorebook.editor.batch.transfer.destination")}
              className="mari-editor-field w-full px-3 py-2 text-sm"
            >
              {transferTargetLorebooks.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEntryTransferOperation(null)}
              disabled={transferEntries.isPending}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40"
            >
              {t("lorebook.editor.batch.transfer.cancel")}
            </button>
            <button
              type="button"
              onClick={() => void handleTransferEntries()}
              disabled={!entryTransferTargetId || transferEntries.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary)]/85 disabled:opacity-40"
            >
              {transferEntries.isPending ? <Loader2 size="0.8125rem" className="animate-spin" /> : null}
              {t(
                entryTransferOperation === "copy"
                  ? "lorebook.editor.batch.transfer.copyConfirm"
                  : "lorebook.editor.batch.transfer.moveConfirm",
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Unsaved warning banner */}
      {showUnsavedWarning && (
        <div className="flex items-center gap-3 bg-[var(--warning)]/10 px-4 py-2.5 text-xs">
          <AlertTriangle size="0.875rem" className="text-[var(--warning)]" />
          <span className="flex-1 text-[var(--warning)]">
            {localizeUi("ui.lorebooks.lorebookeditor.youHaveUnsavedChanges")}
          </span>
          <button
            onClick={() => setShowUnsavedWarning(false)}
            className="mari-editor-action mari-editor-action--compact px-3 py-1 text-[0.6875rem]"
          >
            {localizeUi("ui.lorebooks.lorebookeditor.keepEditing")}
          </button>
          <button
            onClick={() => {
              setShowUnsavedWarning(false);
              setLorebookDirty(false);
              closeDetail();
            }}
            disabled={saving}
            className="rounded-lg px-3 py-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
          >
            {localizeUi("ui.lorebooks.lorebookeditor.discardClose")}
          </button>
          <button
            onClick={async () => {
              const saved = await handleSaveLorebook();
              if (!saved) return;
              setShowUnsavedWarning(false);
              closeDetail();
            }}
            disabled={saving}
            className="mari-editor-action mari-editor-action--primary mari-editor-action--compact px-3 py-1 text-[0.6875rem] disabled:opacity-50"
          >
            {localizeUi("ui.lorebooks.lorebookeditor.saveClose")}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mari-editor-header mari-editor-header--with-nav">
        <div className="mari-editor-header-main">
          <button
            onClick={handleClose}
            disabled={saving}
            className="mari-editor-action inline-flex disabled:opacity-50"
          >
            <ArrowLeft size="1rem" />
          </button>
          <div className="mari-editor-icon-tile">
            <BookOpen size="1.125rem" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="mari-editor-title truncate">{lorebook.name}</h2>
            <p className="mari-editor-meta">
              {entries.length} {localizeUi("ui.lorebooks.lorebookeditor.entries")} {lorebook.category}
            </p>
          </div>
        </div>

        <EditorTabNavigation
          tabs={TABS}
          activeId={activeTab}
          onChange={setActiveTab}
          getBadge={(tabId) => (tabId === "entries" ? entries.length : null)}
        />

        <div className="mari-editor-actions flex">
          <button
            onClick={handleSaveLorebook}
            disabled={!lorebookDirty || saving}
            className="mari-editor-action mari-editor-action--primary inline-flex disabled:opacity-50"
            aria-label={
              saving ? localizeUi("chat.settings.inlineEditor.saving") : localizeUi("ui.noodle.noodlehome.save")
            }
            title={saving ? localizeUi("chat.settings.inlineEditor.saving") : localizeUi("ui.noodle.noodlehome.save")}
          >
            <Save size="0.8125rem" />
            <span className="mari-editor-save-label">
              {saving ? localizeUi("chat.settings.inlineEditor.saving") : localizeUi("ui.noodle.noodlehome.save")}
            </span>
          </button>
          <button
            onClick={() => setExportDialogOpen(true)}
            className="mari-editor-action inline-flex"
            title={localizeUi("ui.lorebooks.lorebookeditor.exportLorebook_8e0ea30")}
          >
            <svg width="0.875rem" height="0.875rem" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M10 13V3m0 0l-4 4m4-4l4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="3" y="15" width="14" height="2" rx="1" fill="currentColor" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className="mari-editor-action inline-flex"
            title={localizeUi("ui.lorebooks.lorebookeditor.deleteLorebook")}
          >
            <Trash2 size="0.875rem" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="mari-editor-body">
        {/* Tab Content */}
        <div className="mari-editor-content @max-5xl:p-4">
          <div className="mari-editor-content-inner mari-editor-content-inner--wide">
            {activeTab === "overview" && (
              <div className="space-y-4">
                {/* Name */}
                <div className="mari-editor-panel p-3">
                  <label className="mb-1.5 block text-xs font-medium">
                    {localizeUi("ui.lorebooks.lorebookeditor.name")}
                  </label>
                  <input
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      markLorebookDirty();
                    }}
                    className="mari-editor-field w-full px-3 py-2.5 text-sm"
                  />
                </div>

                {/* Description */}
                <div className="mari-editor-panel p-3">
                  <label className="mb-1.5 block text-xs font-medium">
                    {localizeUi("chat.settings.inlineEditor.fields.description")}
                  </label>
                  <ExpandableTextarea
                    value={formDescription}
                    onChange={(value) => {
                      setFormDescription(value);
                      markLorebookDirty();
                    }}
                    rows={3}
                    title={localizeUi("ui.lorebooks.lorebookeditor.editLorebookDescription")}
                  />
                </div>

                {/* Lorebook ID */}
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/70 px-3 py-2">
                  <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                    {localizeUi("ui.lorebooks.lorebookeditor.lorebookId")}
                  </span>
                  <code className="min-w-0 flex-1 break-all rounded-lg bg-[var(--background)] px-2 py-1 text-[0.6875rem] text-[var(--foreground)]">
                    {lorebook.id}
                  </code>
                  <button
                    type="button"
                    onClick={async () => {
                      const copied = await copyToClipboard(lorebook.id);
                      if (copied) toast.success(localizeUi("ui.lorebooks.lorebookeditor.lorebookIdCopied"));
                      else toast.error(localizeUi("ui.lorebooks.lorebookeditor.couldNotCopyLorebookId"));
                    }}
                    className="mari-editor-action inline-flex h-8 px-2 text-[0.6875rem]"
                    aria-label={localizeUi("ui.lorebooks.lorebookeditor.copyLorebookId")}
                    title={localizeUi("ui.lorebooks.lorebookeditor.copyLorebookId")}
                  >
                    <Copy size="0.75rem" />
                    {localizeUi("lorebook.editor.batch.copy")}
                  </button>
                </div>

                {/* Tags */}
                <div className="mari-editor-panel p-3">
                  <label className="mb-1.5 flex items-center gap-1 text-xs font-medium">
                    <Tag size="0.75rem" /> {localizeUi("ui.lorebooks.lorebookeditor.tags")}
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {formTags.map((tag) => (
                      <span key={tag} className="mari-editor-chip mari-editor-chip--accent px-2 py-1 text-[0.6875rem]">
                        {tag}
                        <button
                          onClick={() => {
                            setFormTags(formTags.filter((t) => t !== tag));
                            markLorebookDirty();
                          }}
                          className="ml-0.5 rounded-full p-0.5 text-[var(--marinara-editor-muted)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                        >
                          <X size="0.625rem" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTags();
                        }
                      }}
                      placeholder={localizeUi("ui.lorebooks.lorebookeditor.addTag")}
                      className="mari-editor-field flex-1 px-3 py-2 text-xs"
                    />
                    <button onClick={handleAddTags} className="mari-editor-action px-3 py-2">
                      <Plus size="0.75rem" />
                    </button>
                  </div>
                </div>

                {/* Category */}
                <div className="mari-editor-panel p-3">
                  <label htmlFor="lorebook-editor-category" className="mb-1.5 block text-xs font-medium">
                    {localizeUi("ui.lorebooks.lorebookeditor.category")}
                  </label>
                  <div className="relative md:hidden">
                    <select
                      id="lorebook-editor-category"
                      value={formCategory}
                      onChange={(event) => {
                        setFormCategory(event.target.value as LorebookCategory);
                        markLorebookDirty();
                      }}
                      className="mari-editor-field h-10 w-full min-w-0 appearance-none truncate px-3 py-0 pr-9 text-xs"
                    >
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size="0.75rem"
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--marinara-editor-muted)]"
                    />
                  </div>
                  <div className="hidden gap-2 md:flex">
                    {CATEGORY_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setFormCategory(opt.value);
                            markLorebookDirty();
                          }}
                          aria-pressed={formCategory === opt.value}
                          className={cn(
                            "flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all",
                            formCategory === opt.value
                              ? "mari-chrome-accent-surface mari-accent-animated"
                              : "mari-editor-action text-[var(--marinara-editor-muted)]",
                          )}
                        >
                          <Icon size="0.8125rem" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {!formIsGlobal && (
                  <div className="mari-editor-panel p-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {/* Character Link */}
                      <LinkedResourcePicker
                        label={localizeUi("ui.lorebooks.lorebookeditor.linkedCharacters")}
                        help={localizeUi(
                          "ui.lorebooks.lorebookeditor.whenLinkedToCharactersThisLorebookAutoActivatesIn",
                        )}
                        emptyText={localizeUi("ui.lorebooks.lorebookeditor.noCharactersSelected")}
                        addLabel="Add Character"
                        searchPlaceholder="Search characters..."
                        icon={<Users size="0.875rem" />}
                        items={characters}
                        selectedIds={formCharacterIds}
                        search={characterLinkSearch}
                        onSearchChange={setCharacterLinkSearch}
                        isOpen={characterLinkPickerOpen}
                        onOpen={() => {
                          setCharacterLinkPickerOpen(true);
                          setCharacterLinkSearch("");
                        }}
                        onClose={() => setCharacterLinkPickerOpen(false)}
                        onAdd={(id) => {
                          setFormCharacterIds((current) => (current.includes(id) ? current : [...current, id]));
                          markLorebookDirty();
                        }}
                        onRemove={(id) => {
                          setFormCharacterIds((current) => current.filter((characterId) => characterId !== id));
                          markLorebookDirty();
                        }}
                      />

                      {/* Persona Link */}
                      <LinkedResourcePicker
                        label={localizeUi("ui.lorebooks.lorebookeditor.linkedPersonas")}
                        help={localizeUi("ui.lorebooks.lorebookeditor.whenLinkedToPersonasThisLorebookAutoActivatesIn")}
                        emptyText={localizeUi("ui.lorebooks.lorebookeditor.noPersonasSelected")}
                        addLabel="Add Persona"
                        searchPlaceholder="Search personas..."
                        icon={<UserRound size="0.875rem" />}
                        items={personas.map((persona) => ({
                          id: persona.id,
                          name: persona.name,
                          description: persona.comment,
                        }))}
                        selectedIds={formPersonaIds}
                        search={personaLinkSearch}
                        onSearchChange={setPersonaLinkSearch}
                        isOpen={personaLinkPickerOpen}
                        onOpen={() => {
                          setPersonaLinkPickerOpen(true);
                          setPersonaLinkSearch("");
                        }}
                        onClose={() => setPersonaLinkPickerOpen(false)}
                        onAdd={(id) => {
                          setFormPersonaIds((current) => (current.includes(id) ? current : [...current, id]));
                          markLorebookDirty();
                        }}
                        onRemove={(id) => {
                          setFormPersonaIds((current) => current.filter((personaId) => personaId !== id));
                          markLorebookDirty();
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Status cards */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="mari-editor-panel flex min-h-[4.75rem] items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-xs font-medium">{localizeUi("ui.noodle.noodlehome.enabled")}</p>
                      <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.lorebooks.lorebookeditor.whenOffEntriesInThisLorebookWonTActivate")}
                      </p>
                    </div>
                    <SettingsSwitch
                      ariaLabel={formEnabled ? "Disable lorebook" : "Enable lorebook"}
                      checked={formEnabled}
                      onChange={(checked) => {
                        setFormEnabled(checked);
                        markLorebookDirty();
                      }}
                      className="p-0 hover:bg-transparent"
                    />
                  </div>

                  {scopeSummary && (
                    <div className="mari-editor-panel flex h-[10.25rem] items-start overflow-hidden px-4 py-3 md:row-span-2">
                      <div className="min-w-0 overflow-hidden">
                        <p className="text-xs font-medium mb-1">{localizeUi("ui.lorebooks.lorebookeditor.linkedTo")}</p>
                        {"text" in scopeSummary ? (
                          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{scopeSummary.text}</p>
                        ) : (
                          <div
                            className="space-y-1 overflow-hidden text-[0.6875rem] leading-snug text-[var(--muted-foreground)]"
                            title={[scopeSummary.characters, scopeSummary.personas]
                              .filter((line): line is { label: string; names: string } => line !== null)
                              .map((line) => `${line.label} ${line.names}`)
                              .join("\n")}
                          >
                            {scopeSummary.characters && (
                              <p>
                                <span className="font-medium text-[var(--foreground)]">
                                  {scopeSummary.characters.label}
                                </span>{" "}
                                {scopeSummary.characters.names}
                              </p>
                            )}
                            {scopeSummary.personas && (
                              <p>
                                <span className="font-medium text-[var(--foreground)]">
                                  {scopeSummary.personas.label}
                                </span>{" "}
                                {scopeSummary.personas.names}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mari-editor-panel flex min-h-[4.75rem] items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-xs font-medium">{localizeUi("ui.lorebooks.lorebookeditor.global")}</p>
                      <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.lorebooks.lorebookeditor.activeInEveryChatWhenThisLorebookIsEnabled")}
                      </p>
                    </div>
                    <SettingsSwitch
                      ariaLabel={formIsGlobal ? "Disable global lorebook" : "Enable global lorebook"}
                      checked={formIsGlobal}
                      onChange={(checked) => {
                        setFormIsGlobal(checked);
                        markLorebookDirty();
                      }}
                      className="p-0 hover:bg-transparent"
                    />
                  </div>
                </div>

                {/* Scan settings */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  <div>
                    <label className="mb-1.5 flex items-center gap-1 text-xs font-medium">
                      {localizeUi("ui.lorebooks.lorebookeditor.scanDepth")}{" "}
                      <HelpTooltip
                        text={localizeUi("ui.lorebooks.lorebookeditor.howManyRecentMessagesToScanForKeywordMatches")}
                      />
                    </label>
                    <input
                      type="number"
                      value={formScanDepth}
                      onChange={(e) => {
                        setFormScanDepth(parseInt(e.target.value) || 0);
                        markLorebookDirty();
                      }}
                      min={0}
                      className="mari-editor-field h-10 w-full px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-1 text-xs font-medium">
                      {localizeUi("ui.lorebooks.lorebookeditor.tokenBudget")}{" "}
                      <HelpTooltip
                        text={localizeUi("ui.lorebooks.lorebookeditor.maximumNumberOfTokensThisLorebookCanInjectPer")}
                      />
                    </label>
                    <input
                      type="number"
                      value={formTokenBudget}
                      onChange={(e) => {
                        setFormTokenBudget(parseInt(e.target.value) || 0);
                        markLorebookDirty();
                      }}
                      min={0}
                      className="mari-editor-field h-10 w-full px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-1 text-xs font-medium">
                      {localizeUi("ui.lorebooks.lorebookeditor.entryLimit")}{" "}
                      <HelpTooltip
                        text={localizeUi(
                          "ui.lorebooks.lorebookeditor.maximumActiveEntriesThisLorebookCanContributePerGeneration",
                        )}
                      />
                    </label>
                    <input
                      type="number"
                      value={formEntryLimit}
                      onChange={(e) => {
                        const next = Math.max(
                          LIMITS.LOREBOOK_ENTRY_LIMIT_MIN,
                          Math.min(
                            LIMITS.LOREBOOK_ENTRY_LIMIT_MAX,
                            parseInt(e.target.value) || LIMITS.LOREBOOK_ENTRY_LIMIT_DEFAULT,
                          ),
                        );
                        setFormEntryLimit(next);
                        markLorebookDirty();
                      }}
                      min={LIMITS.LOREBOOK_ENTRY_LIMIT_MIN}
                      max={LIMITS.LOREBOOK_ENTRY_LIMIT_MAX}
                      className="mari-editor-field h-10 w-full px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col justify-end">
                    <div className="mari-editor-panel flex h-10 w-full items-center justify-between px-3 py-2.5">
                      <span className="mr-2 inline-flex items-center gap-1 text-xs">
                        {localizeUi("ui.lorebooks.lorebookeditor.recursive")}
                        <HelpTooltip
                          text={localizeUi(
                            "ui.lorebooks.lorebookeditor.whenOnActivatedEntryContentIsScannedForAdditional",
                          )}
                        />
                      </span>
                      <SettingsSwitch
                        ariaLabel={formRecursive ? "Disable recursive scanning" : "Enable recursive scanning"}
                        checked={formRecursive}
                        onChange={(checked) => {
                          setFormRecursive(checked);
                          markLorebookDirty();
                        }}
                        className="p-0 hover:bg-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-col justify-end">
                    <div className="mari-editor-panel flex h-10 w-full items-center justify-between px-3 py-2.5">
                      <span className="mr-2 inline-flex items-center gap-1 text-xs">
                        {localizeUi("ui.lorebooks.lorebookeditor.vectors")}
                        <HelpTooltip
                          text={localizeUi("ui.lorebooks.lorebookeditor.whenOnEntriesInThisLorebookMayUseSemantic")}
                        />
                      </span>
                      <SettingsSwitch
                        ariaLabel={
                          formExcludeFromVectorization ? "Enable lorebook vectors" : "Disable lorebook vectors"
                        }
                        checked={!formExcludeFromVectorization}
                        onChange={(checked) => {
                          setFormExcludeFromVectorization(!checked);
                          markLorebookDirty();
                        }}
                        className="p-0 hover:bg-transparent"
                      />
                    </div>
                  </div>
                </div>

                {formRecursive && (
                  <div className="max-w-[12rem]">
                    <label className="mb-1.5 flex items-center gap-1 text-xs font-medium">
                      {localizeUi("ui.lorebooks.lorebookeditor.maxDepth")}{" "}
                      <HelpTooltip
                        text={localizeUi(
                          "ui.lorebooks.lorebookeditor.maximumNumberOfRecursivePassesEachPassScansActivated",
                        )}
                      />
                    </label>
                    <input
                      type="number"
                      value={formMaxRecursionDepth}
                      onChange={(e) => {
                        setFormMaxRecursionDepth(Math.max(1, Math.min(10, parseInt(e.target.value) || 3)));
                        markLorebookDirty();
                      }}
                      min={1}
                      max={10}
                      className="mari-editor-field h-10 w-full px-3 py-2.5 text-sm"
                    />
                  </div>
                )}

                {/* Vectorize (Embeddings) */}
                <VectorizeSection
                  lorebookId={lorebookId!}
                  entries={entries}
                  excludeFromVectorization={formExcludeFromVectorization}
                  vectorQueryDepth={formVectorQueryDepth}
                  vectorScoreThreshold={formVectorScoreThreshold}
                  vectorMaxResults={formVectorMaxResults}
                  hasUnsavedChanges={lorebookDirty}
                  onBeforeVectorize={handleSaveLorebook}
                  onVectorQueryDepthChange={(value) => {
                    setFormVectorQueryDepth(value);
                    markLorebookDirty();
                  }}
                  onVectorScoreThresholdChange={(value) => {
                    setFormVectorScoreThreshold(value);
                    markLorebookDirty();
                  }}
                  onVectorMaxResultsChange={(value) => {
                    setFormVectorMaxResults(value);
                    markLorebookDirty();
                  }}
                />
              </div>
            )}

            {activeTab === "entries" && (
              <div className="space-y-3">
                {/* Keyword test — collapsible authoring aid (issue #816).
                    Paste sample chat text or a paragraph and the editor
                    highlights which entries would activate. Honors keyword
                    matching rules only — see previewMatches memo for scope. */}
                <div className="mari-editor-panel overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setKeywordPreviewOpen((open) => !open)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-colors hover:bg-[var(--accent)]/30"
                    aria-expanded={keywordPreviewOpen}
                  >
                    <FlaskConical size="0.8125rem" className="mari-chrome-accent-icon mari-accent-animated shrink-0" />
                    <span className="flex-1">{localizeUi("ui.lorebooks.lorebookeditor.keywordTest")}</span>
                    {previewActive && (
                      <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[0.625rem] font-medium text-emerald-300 ring-1 ring-emerald-400/25">
                        {previewMatchCount} {localizeUi("ui.lorebooks.lorebookeditor.match")}
                        {previewMatchCount === 1 ? "" : localizeUi("ui.lorebooks.lorebookeditor.es")}
                      </span>
                    )}
                    <ChevronDown
                      size="0.8125rem"
                      className={cn(
                        "shrink-0 text-[var(--muted-foreground)] transition-transform",
                        keywordPreviewOpen ? "rotate-0" : "-rotate-90",
                      )}
                    />
                  </button>
                  {keywordPreviewOpen && (
                    <div className="space-y-2 border-t border-[var(--marinara-editor-divider)] px-3 py-3">
                      <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.lorebooks.lorebookeditor.pasteSampleChatTextAndEntriesWhoseKeysWould")}
                      </p>
                      <div className="relative">
                        <textarea
                          value={keywordPreviewText}
                          onChange={(e) => setKeywordPreviewText(e.target.value)}
                          placeholder={localizeUi("ui.lorebooks.lorebookeditor.pasteAParagraphOrSampleMessagesHere")}
                          rows={4}
                          className="mari-editor-field w-full resize-y px-3 py-2 pr-8 text-xs"
                        />
                        {keywordPreviewText && (
                          <button
                            type="button"
                            onClick={() => setKeywordPreviewText("")}
                            className="absolute right-2 top-2 rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                            title={localizeUi("ui.lorebooks.lorebookeditor.clearKeywordTest")}
                            aria-label={localizeUi("ui.lorebooks.lorebookeditor.clearKeywordTest")}
                          >
                            <X size="0.75rem" />
                          </button>
                        )}
                      </div>
                      {previewActive && (
                        <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                          {previewMatchCount === 0
                            ? localizeUi("ui.lorebooks.lorebookeditor.noEntriesWouldActivateOnThisText")
                            : localizeUi("ui.lorebooks.lorebookeditor.enabledEntriesWouldActivate", {
                                matchCount: previewMatchCount,
                                count: entries.filter((entry) => entry.enabled).length,
                              })}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Search + Sort + Add — flex-wrap so the row collapses
                    gracefully on narrow viewports. Search keeps a 12rem
                    (~192px) flex-basis so it stays usable; the buttons tile
                    onto the next row instead of being clipped at ~400px. */}
                <div className="mari-editor-toolbar flex flex-wrap items-stretch gap-2 p-2">
                  <div className="relative min-w-0 flex-[1_1_12rem]">
                    <Search
                      size="0.8125rem"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                    />
                    <input
                      type="text"
                      placeholder={localizeUi("chat.settings.inlineLorebook.search")}
                      value={entrySearch}
                      onChange={(e) => setEntrySearch(e.target.value)}
                      className="mari-editor-field w-full py-2.5 pl-8 pr-3 text-xs"
                    />
                  </div>
                  <div className="relative shrink-0">
                    <ArrowUpDown
                      size="0.8125rem"
                      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                    />
                    <select
                      value={entrySort}
                      onChange={(e) => setEntrySort(e.target.value as EntrySortKey)}
                      className="mari-editor-field h-full appearance-none py-2.5 pl-8 pr-6 text-xs"
                    >
                      {SORT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => {
                      if (entrySelectionMode) exitEntrySelectionMode();
                      else setEntrySelectionMode(true);
                    }}
                    className={cn(
                      "mari-editor-action flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-xs",
                      entrySelectionMode &&
                        "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-button-text-active)]",
                    )}
                    title={t("lorebook.editor.batch.selectTitle")}
                  >
                    <CheckSquare2 size="0.8125rem" />
                    {localizeUi("settings.common.select")}
                  </button>
                  <button
                    onClick={handleAddFolder}
                    className="mari-editor-action flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-xs"
                    title={localizeUi("ui.lorebooks.lorebookeditor.createANewFolderToGroupEntries")}
                  >
                    <FolderPlus size="0.8125rem" />
                    {localizeUi("ui.lorebooks.lorebookeditor.addFolder")}
                  </button>
                  <button
                    onClick={handleAddEntry}
                    className="mari-editor-action mari-editor-action--primary inline-flex shrink-0"
                  >
                    <Plus size="0.8125rem" />
                    {localizeUi("ui.lorebooks.lorebookeditor.addEntry")}
                  </button>
                </div>

                <p
                  role="note"
                  className="flex items-start gap-1.5 px-1 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]"
                >
                  <Info size="0.6875rem" aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--primary)]" />
                  <span>{t("lorebook.editor.batch.hint")}</span>
                </p>

                {entrySelectionMode && (
                  <div className="mari-editor-toolbar flex flex-wrap items-center gap-2 px-3 py-2">
                    <div
                      role="status"
                      className="flex w-full items-start gap-2 rounded-lg border border-[var(--marinara-editor-border-strong)] bg-[var(--marinara-editor-control-bg-hover)] px-2.5 py-2"
                    >
                      <Info size="0.8125rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
                      <p className="text-[0.6875rem] leading-relaxed text-[var(--foreground)]">
                        {t("lorebook.editor.batch.info")}
                        <span className="block text-[var(--muted-foreground)]">
                          {t("lorebook.editor.batch.exclusions")}
                        </span>
                      </p>
                    </div>
                    <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                      {t("lorebook.editor.batch.selected", { count: selectedEntryIds.size })}
                    </span>
                    <button
                      onClick={() => setSelectedEntryIds(new Set(visibleEntryIds))}
                      disabled={visibleEntryIds.length === 0}
                      className="mari-editor-action mari-editor-action--compact px-2.5 py-1 text-[0.625rem] disabled:opacity-40"
                    >
                      {t("lorebook.editor.batch.selectAll")}
                    </button>
                    <button
                      onClick={() => setSelectedEntryIds(new Set())}
                      disabled={selectedEntryIds.size === 0}
                      className="rounded-lg px-2.5 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40"
                    >
                      {t("lorebook.editor.batch.clear")}
                    </button>
                    <button
                      onClick={() => openEntryTransferDialog("copy")}
                      disabled={
                        selectedEntryIds.size === 0 ||
                        transferTargetLorebooks.length === 0 ||
                        transferEntries.isPending ||
                        bulkUpdateEntries.isPending ||
                        deleteEntry.isPending
                      }
                      className="mari-editor-action mari-editor-action--primary mari-editor-action--compact inline-flex items-center gap-1 px-2.5 py-1.5 text-[0.625rem] disabled:opacity-40"
                    >
                      {transferEntries.isPending ? (
                        <Loader2 size="0.6875rem" className="animate-spin" />
                      ) : (
                        <Copy size="0.6875rem" />
                      )}
                      {t("lorebook.editor.batch.copy")}
                    </button>
                    <button
                      onClick={() => openEntryTransferDialog("move")}
                      disabled={
                        selectedEntryIds.size === 0 ||
                        transferTargetLorebooks.length === 0 ||
                        transferEntries.isPending ||
                        bulkUpdateEntries.isPending ||
                        deleteEntry.isPending
                      }
                      className="mari-editor-action mari-editor-action--compact inline-flex items-center gap-1 px-2.5 py-1.5 text-[0.625rem] disabled:opacity-40"
                    >
                      {transferEntries.isPending ? (
                        <Loader2 size="0.6875rem" className="animate-spin" />
                      ) : (
                        <MoveRight size="0.6875rem" />
                      )}
                      {t("lorebook.editor.batch.move")}
                    </button>
                    <button
                      onClick={() => void handleDeleteSelectedEntries()}
                      disabled={
                        selectedEntryIds.size === 0 ||
                        transferEntries.isPending ||
                        bulkUpdateEntries.isPending ||
                        deleteEntry.isPending
                      }
                      className="mari-editor-action mari-editor-action--compact inline-flex items-center gap-1 px-2.5 py-1.5 text-[0.625rem] disabled:opacity-40"
                    >
                      {deleteEntry.isPending ? (
                        <Loader2 size="0.6875rem" className="animate-spin" />
                      ) : (
                        <Trash2 size="0.6875rem" />
                      )}
                      {t("lorebook.editor.batch.delete")}
                    </button>
                    <button
                      onClick={exitEntrySelectionMode}
                      className="rounded-lg px-2.5 py-1.5 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    >
                      {t("lorebook.editor.batch.done")}
                    </button>
                  </div>
                )}

                {/* Total tokens summary */}
                {entries.length > 0 && (
                  <div className="flex items-center gap-3 text-[0.6875rem] text-[var(--muted-foreground)]">
                    <span>
                      {entries.length}{" "}
                      {entries.length === 1
                        ? localizeUi("ui.lorebooks.lorebookeditor.entry")
                        : localizeUi("ui.lorebooks.lorebookeditor.entries_c2e311d")}
                    </span>
                    {folders.length > 0 && (
                      <>
                        <span>•</span>
                        <span>
                          {folders.length}{" "}
                          {folders.length === 1
                            ? localizeUi("ui.lorebooks.lorebookeditor.folder")
                            : localizeUi("ui.lorebooks.lorebookeditor.folders")}
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Hash size="0.625rem" />
                      {entries.reduce((sum, e) => sum + estimateTokens(e.content), 0).toLocaleString()}{" "}
                      {localizeUi("ui.lorebooks.lorebookeditor.tokensEst")}
                    </span>
                    {!showFolderGrouping && folders.length > 0 && (
                      <span className="ml-auto italic">
                        {localizeUi("ui.lorebooks.lorebookeditor.folderViewPausedClearSearchAndSortByOrder")}
                      </span>
                    )}
                  </div>
                )}

                {/* Empty state */}
                {entries.length === 0 && folders.length === 0 && (
                  <div className="mari-editor-empty flex flex-col items-center gap-2 py-8 text-center">
                    <FileText size="1.5rem" className="text-[var(--muted-foreground)]" />
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {localizeUi("ui.lorebooks.lorebookeditor.noEntriesYetAddOneToGetStarted")}
                    </p>
                  </div>
                )}

                {/* Entries — folder-grouped view (default sort, no search) */}
                {lorebookId && showFolderGrouping && (entries.length > 0 || folders.length > 0) && (
                  <div className="space-y-3">
                    {/* Folder block — nested tree (folders may contain sub-folders) */}
                    {folders.length > 0 && (
                      // The folder list is itself the "move to top level" drop zone for a
                      // nested folder (its padding + the gaps between roots). It must NOT
                      // appear/disappear on drag start: inserting a strip here shifted the
                      // layout the instant a nested drag began, which cancels the drag in
                      // Chrome and made sub-folders impossible to pick up. So the target is
                      // always present and only its highlight changes.
                      <div
                        data-lorebook-folder-root
                        className={cn(
                          "space-y-1.5 rounded-lg py-1 transition-colors",
                          folderRootDropActive &&
                            "bg-[var(--marinara-editor-control-bg-hover)] ring-1 ring-[var(--marinara-editor-border-strong)]",
                        )}
                        onDragOver={(e) => {
                          if (draggingFolderIdx !== null) handleFolderRootDragOver(e);
                        }}
                        onDragLeave={() => setFolderRootDropActive(false)}
                        onDrop={(e) => {
                          if (draggingFolderIdx !== null) commitFolderDrop(e);
                        }}
                      >
                        {folderForest.roots.map((folder) => renderFolder(folder))}
                      </div>
                    )}

                    {(draggingFolderIdx !== null || (draggingEntryIdx !== null && dragSourceContainer !== null)) && (
                      <div
                        data-lorebook-entry-root
                        className="rounded-xl border border-dashed border-[var(--marinara-editor-border-strong)] bg-[var(--marinara-editor-control-bg-hover)] px-3 py-2 text-center text-[0.625rem] italic text-[var(--marinara-editor-accent)]"
                        onDragOver={(e) => {
                          if (draggingFolderIdx !== null) handleFolderRootDragOver(e);
                          else handleRootListDragOver(e);
                        }}
                        onDrop={(e) => {
                          if (draggingFolderIdx !== null) commitFolderDrop(e);
                          else commitEntryDrop(e);
                        }}
                      >
                        {draggingFolderIdx !== null
                          ? localizeUi("ui.lorebooks.lorebookeditor.dropHereToMoveTheFolderToTheTop")
                          : localizeUi("ui.lorebooks.lorebookeditor.dropHereToMoveOutOfTheFolder")}
                      </div>
                    )}

                    {/* Root entries (entries with no folder). The root drop strip above
                        handles cross-folder moves; this list only handles root-level
                        entry reordering so it does not swallow the rows below. */}
                    <div
                      ref={entryListRef}
                      className={cn(
                        "space-y-1.5",
                        draggingEntryIdx !== null &&
                          dragSourceContainer === null &&
                          dropTargetContainer === null &&
                          "rounded-xl bg-[var(--marinara-editor-control-bg-hover)] ring-1 ring-[var(--marinara-editor-border-strong)] transition-colors",
                      )}
                      onDragOver={(e) => {
                        if (draggingEntryIdx !== null && dragSourceContainer === null) handleRootListDragOver(e);
                      }}
                      onDrop={(e) => {
                        if (draggingEntryIdx !== null && dragSourceContainer === null) commitEntryDrop(e);
                      }}
                    >
                      {(entriesByContainer.get(null) ?? []).length === 0 && (
                        <p className="py-3 text-center text-[0.625rem] italic text-[var(--muted-foreground)] opacity-50">
                          {localizeUi("ui.lorebooks.lorebookeditor.noEntriesAtTheRootLevel")}
                        </p>
                      )}
                      {(entriesByContainer.get(null) ?? []).map((entry, idx) => {
                        const rootList = entriesByContainer.get(null) ?? [];
                        const isDropTarget = dropTargetContainer === null && draggingEntryIdx !== null;
                        const sameContainer = dragSourceContainer === null;
                        // Same rule as inside folders: only show the position bar for
                        // same-container drops because cross-container moves preserve
                        // Order. The amber ring on the root drop zone (added for Issue
                        // 2) handles the cross-container affordance.
                        const showDropBefore =
                          isDropTarget &&
                          sameContainer &&
                          entryDropIdx === idx &&
                          draggingEntryIdx !== idx &&
                          draggingEntryIdx !== idx - 1;
                        const showDropAfter =
                          isDropTarget &&
                          sameContainer &&
                          idx === rootList.length - 1 &&
                          entryDropIdx === rootList.length &&
                          draggingEntryIdx !== idx;
                        return (
                          <div key={entry.id}>
                            {showDropBefore && (
                              <div className="mari-chrome-accent-progress mari-accent-animated mx-2 mb-1 h-0.5 rounded-full" />
                            )}
                            <LorebookEntryRow
                              entry={entry}
                              lorebookId={lorebookId}
                              isExpanded={expandedEntryId === entry.id}
                              onToggleExpand={() => toggleEntryExpanded(entry.id)}
                              characters={characters}
                              characterTags={characterTags}
                              folders={folders}
                              draggable={canReorderEntries}
                              isDragging={sameContainer && draggingEntryIdx === idx}
                              isDragReady={sameContainer && entryDragReadyIdx === idx}
                              onDragHandleMouseDown={() => {
                                if (canReorderEntries) {
                                  setEntryDragReadyIdx(idx);
                                  setDragSourceContainer(null);
                                }
                              }}
                              onDragHandleMouseUp={() => setEntryDragReadyIdx(null)}
                              onDragHandleTouchStart={(e, sourceElement) =>
                                handleEntryDragHandleTouchStart(entry.id, e, sourceElement)
                              }
                              onDragStart={(e) => handleEntryDragStart(null, idx, entry.id, e)}
                              onDragOver={(e) => {
                                // Let folder drags fall through to the root list (un-nest).
                                if (draggingFolderIdx !== null) return;
                                e.stopPropagation();
                                handleEntryDragOver(null, idx, e);
                              }}
                              onDrop={(e) => {
                                if (draggingFolderIdx !== null) return;
                                e.stopPropagation();
                                commitEntryDrop(e);
                              }}
                              onDragEnd={resetEntryDragState}
                              selectionMode={entrySelectionMode}
                              isSelected={selectedEntryIds.has(entry.id)}
                              onToggleSelected={() => toggleEntrySelection(entry.id)}
                              previewMatch={previewMatches.get(entry.id)}
                              mapBacklinks={mapBacklinksByEntryId.get(entry.id)}
                              onUpdateEntry={handleEntryUpdate}
                            />
                            {showDropAfter && (
                              <div className="mari-chrome-accent-progress mari-accent-animated mx-2 mt-1 h-0.5 rounded-full" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Entries — flat view (search active or non-Order sort) */}
                {lorebookId && !showFolderGrouping && filteredEntries.length > 0 && (
                  <div ref={entryListRef} className="space-y-1.5">
                    {filteredEntries.map((entry) => (
                      <LorebookEntryRow
                        key={entry.id}
                        entry={entry}
                        lorebookId={lorebookId}
                        isExpanded={expandedEntryId === entry.id}
                        onToggleExpand={() => toggleEntryExpanded(entry.id)}
                        characters={characters}
                        characterTags={characterTags}
                        folders={folders}
                        draggable={false}
                        isDragging={false}
                        isDragReady={false}
                        onDragHandleMouseDown={() => undefined}
                        onDragHandleMouseUp={() => undefined}
                        onDragStart={() => undefined}
                        onDragOver={() => undefined}
                        onDrop={() => undefined}
                        onDragEnd={() => undefined}
                        selectionMode={entrySelectionMode}
                        isSelected={selectedEntryIds.has(entry.id)}
                        onToggleSelected={() => toggleEntrySelection(entry.id)}
                        previewMatch={previewMatches.get(entry.id)}
                        mapBacklinks={mapBacklinksByEntryId.get(entry.id)}
                        onUpdateEntry={handleEntryUpdate}
                      />
                    ))}
                  </div>
                )}

                {/* Search-with-no-matches */}
                {lorebookId && !showFolderGrouping && filteredEntries.length === 0 && entries.length > 0 && (
                  <div className="mari-editor-empty flex flex-col items-center gap-2 py-8 text-center">
                    <FileText size="1.5rem" className="text-[var(--muted-foreground)]" />
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {localizeUi("ui.lorebooks.lorebookeditor.noEntriesMatchYourSearch")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Vectorize lorebook entries for semantic matching. */
function VectorizeSection({
  lorebookId,
  entries,
  excludeFromVectorization,
  vectorQueryDepth,
  vectorScoreThreshold,
  vectorMaxResults,
  hasUnsavedChanges,
  onBeforeVectorize,
  onVectorQueryDepthChange,
  onVectorScoreThresholdChange,
  onVectorMaxResultsChange,
}: {
  lorebookId: string;
  entries: LorebookEntry[];
  excludeFromVectorization: boolean;
  vectorQueryDepth: number;
  vectorScoreThreshold: number;
  vectorMaxResults: number;
  hasUnsavedChanges: boolean;
  onBeforeVectorize: () => Promise<boolean>;
  onVectorQueryDepthChange: (value: number) => void;
  onVectorScoreThresholdChange: (value: number) => void;
  onVectorMaxResultsChange: (value: number) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const queryClient = useQueryClient();
  const { data: rawConnections } = useConnections();
  const sidecarModelDownloaded = useSidecarStore((s) => s.modelDownloaded);
  const sidecarModelDisplayName = useSidecarStore((s) => s.modelDisplayName);
  const fetchSidecarStatus = useSidecarStore((s) => s.fetchStatus);
  const connections = useMemo(
    () => (rawConnections ?? []) as Array<{ id: string; name: string; embeddingModel?: string }>,
    [rawConnections],
  );
  const sidecarEmbeddingConnections = useMemo(() => {
    if (import.meta.env.VITE_MARINARA_LITE === "true" || !sidecarModelDownloaded) return [];
    return [
      {
        id: LOCAL_SIDECAR_CONNECTION_ID,
        name: "Local Model (sidecar)",
        embeddingModel: sidecarModelDisplayName ?? "local-sidecar",
      },
    ];
  }, [sidecarModelDownloaded, sidecarModelDisplayName]);
  const embeddingConnections = useMemo(
    () => [
      ...sidecarEmbeddingConnections,
      ...connections.filter((c) => typeof c.embeddingModel === "string" && c.embeddingModel.trim()),
    ],
    [connections, sidecarEmbeddingConnections],
  );
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");
  const [vectorizingMode, setVectorizingMode] = useState<"missing" | "all" | null>(null);
  const vectorizeInFlightRef = useRef(false);
  const [clearingVectors, setClearingVectors] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const excludedCount = excludeFromVectorization
    ? entries.length
    : entries.filter((entry) => entry.excludeFromVectorization).length;
  const vectorizableEntries = excludeFromVectorization
    ? []
    : entries.filter((entry) => !entry.excludeFromVectorization);
  const vectorizableEntryCount = vectorizableEntries.length;
  const vectorizedCount = vectorizableEntries.filter(
    (entry) => Array.isArray(entry.embedding) && entry.embedding.length > 0,
  ).length;
  const storedVectorCount = entries.filter(
    (entry) => Array.isArray(entry.embedding) && entry.embedding.length > 0,
  ).length;
  const missingCount = Math.max(0, vectorizableEntryCount - vectorizedCount);
  const allVectorized = vectorizableEntryCount > 0 && missingCount === 0;
  const vectorizing = vectorizingMode !== null;
  const primaryVectorizeMode: "missing" | "all" = missingCount > 0 ? "missing" : "all";
  const showRevectorizeAllAction = missingCount > 0 && storedVectorCount > 0;

  useEffect(() => {
    if (import.meta.env.VITE_MARINARA_LITE !== "true") {
      void fetchSidecarStatus();
    }
  }, [fetchSidecarStatus]);

  useEffect(() => {
    if (selectedConnectionId && !embeddingConnections.some((connection) => connection.id === selectedConnectionId)) {
      setSelectedConnectionId("");
      try {
        window.localStorage.removeItem(LOREBOOK_VECTORIZE_CONNECTION_STORAGE_KEY);
      } catch {
        // localStorage is optional; the picker still works for this session.
      }
      return;
    }
    if (selectedConnectionId || embeddingConnections.length === 0) return;
    try {
      const storedConnectionId = window.localStorage.getItem(LOREBOOK_VECTORIZE_CONNECTION_STORAGE_KEY);
      if (storedConnectionId && embeddingConnections.some((connection) => connection.id === storedConnectionId)) {
        setSelectedConnectionId(storedConnectionId);
      }
    } catch {
      // localStorage is optional; the picker still works for this session.
    }
  }, [embeddingConnections, selectedConnectionId]);

  const handleConnectionChange = (nextConnectionId: string) => {
    setSelectedConnectionId(nextConnectionId);
    try {
      if (nextConnectionId) {
        window.localStorage.setItem(LOREBOOK_VECTORIZE_CONNECTION_STORAGE_KEY, nextConnectionId);
      } else {
        window.localStorage.removeItem(LOREBOOK_VECTORIZE_CONNECTION_STORAGE_KEY);
      }
    } catch {
      // localStorage is optional; keep the in-memory selection.
    }
  };

  const handleVectorize = async (mode: "missing" | "all") => {
    if (!selectedConnectionId) return;
    if (mode === "missing" && missingCount === 0) return;
    if (vectorizeInFlightRef.current) return;
    vectorizeInFlightRef.current = true;
    try {
      const conn = embeddingConnections.find((c) => c.id === selectedConnectionId);
      if (mode === "all" && storedVectorCount > 0) {
        const confirmed = await showConfirmDialog({
          title: localizeUi("ui.lorebooks.vectorizesection.reVectorizeAllEntries"),
          message: localizeUi("ui.lorebooks.vectorizesection.reVectorizeAllEntriesWithConnection", {
            count: vectorizableEntryCount,
            connection: conn?.name ?? localizeUi("ui.lorebooks.vectorizesection.theSelectedConnection"),
          }),
          confirmLabel: localizeUi("ui.lorebooks.vectorizesection.reVectorizeAll"),
          cancelLabel: "Cancel",
          tone: "default",
        });
        if (!confirmed) return;
      }
      if (hasUnsavedChanges && !(await onBeforeVectorize())) return;

      setVectorizingMode(mode);
      setResult(null);
      try {
        const res = await api.post(`/lorebooks/${lorebookId}/vectorize`, {
          connectionId: selectedConnectionId,
          model: conn?.embeddingModel ?? "",
          onlyMissing: mode === "missing",
        });
        const data = res as { vectorized: number; total?: number; skipped?: number };
        await queryClient.invalidateQueries({ queryKey: lorebookKeys.entries(lorebookId) });
        setResult({
          success: true,
          message:
            mode === "all"
              ? `Re-vectorized ${data.vectorized} entries`
              : `Vectorized ${data.vectorized} missing entries`,
        });
      } catch (err) {
        setResult({ success: false, message: err instanceof Error ? err.message : "Vectorization failed" });
      } finally {
        setVectorizingMode(null);
      }
    } finally {
      vectorizeInFlightRef.current = false;
    }
  };

  const handleClearVectors = async () => {
    if (storedVectorCount === 0 || clearingVectors) return;
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.lorebooks.vectorizesection.deleteStoredVectors"),
      message: localizeUi("ui.lorebooks.vectorizesection.deleteValue1StoredEmbeddingVectorValue2FromThisLorebook", {
        value1: storedVectorCount,
        value2: storedVectorCount === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
      }),
      confirmLabel: localizeUi("ui.lorebooks.vectorizesection.deleteVectors"),
      cancelLabel: "Cancel",
      tone: "destructive",
    });
    if (!confirmed) return;

    setClearingVectors(true);
    setResult(null);
    try {
      const data = (await api.delete(`/lorebooks/${lorebookId}/vectors`)) as { cleared: number; total?: number };
      await queryClient.invalidateQueries({ queryKey: lorebookKeys.entries(lorebookId) });
      setResult({
        success: true,
        message: `Deleted ${data.cleared} stored vector${data.cleared === 1 ? "" : "s"}`,
      });
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : "Failed to delete vectors" });
    } finally {
      setClearingVectors(false);
    }
  };

  return (
    <div className="mari-editor-panel space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Sparkles size="0.875rem" className="mari-chrome-accent-icon mari-accent-animated" />
        <h4 className="text-xs font-semibold">
          {localizeUi("ui.lorebooks.vectorizesection.semanticSearchEmbeddings")}
        </h4>
        <HelpTooltip
          text={localizeUi("ui.lorebooks.vectorizesection.vectorizeEntriesToEnableSemanticMatchingEntriesWillBe")}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[0.625rem] text-[var(--muted-foreground)]">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1",
            allVectorized
              ? "bg-emerald-400/10 text-emerald-400 ring-emerald-400/20"
              : "bg-[var(--background)]/70 ring-[var(--border)]",
          )}
        >
          {allVectorized ? <Check size="0.625rem" /> : <AlertTriangle size="0.625rem" />}
          {vectorizedCount}/{vectorizableEntryCount} {localizeUi("ui.lorebooks.vectorizesection.entriesVectorized")}
        </span>
        {missingCount > 0 && (
          <span>
            {missingCount} {localizeUi("ui.lorebooks.vectorizesection.stillNeedEmbeddings")}
          </span>
        )}
        {excludeFromVectorization ? (
          <span>{localizeUi("ui.lorebooks.vectorizesection.thisLorebookExcludesEveryEntry")}</span>
        ) : null}
        {!excludeFromVectorization && excludedCount > 0 && (
          <span>
            {excludedCount} {localizeUi("ui.lorebooks.vectorizesection.excluded")}
          </span>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="space-y-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1">
            {localizeUi("ui.lorebooks.vectorizesection.queryMessages")}
            <HelpTooltip
              text={localizeUi("ui.lorebooks.vectorizesection.howManyRecentChatMessagesToEmbedWhenSearching")}
            />
          </span>
          <input
            type="number"
            value={vectorQueryDepth}
            onChange={(e) =>
              onVectorQueryDepthChange(
                Math.max(0, Math.min(LIMITS.LOREBOOK_VECTOR_QUERY_DEPTH_MAX, Number.parseInt(e.target.value, 10) || 0)),
              )
            }
            min={0}
            max={LIMITS.LOREBOOK_VECTOR_QUERY_DEPTH_MAX}
            className="mari-editor-field h-9 w-full px-2.5 py-1.5 text-xs"
          />
        </label>
        <label className="space-y-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1">
            {localizeUi("ui.lorebooks.vectorizesection.scoreThreshold")}
            <HelpTooltip
              text={localizeUi(
                "ui.lorebooks.vectorizesection.minimumCalibratedSemanticSimilarityRequiredBeforeAVectorizedEntry",
              )}
            />
          </span>
          <input
            type="number"
            value={vectorScoreThreshold}
            onChange={(e) =>
              onVectorScoreThresholdChange(Math.max(0, Math.min(1, Number.parseFloat(e.target.value) || 0)))
            }
            min={0}
            max={1}
            step={0.01}
            className="mari-editor-field h-9 w-full px-2.5 py-1.5 text-xs"
          />
        </label>
        <label className="space-y-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1">
            {localizeUi("ui.lorebooks.vectorizesection.vectorLimit")}
            <HelpTooltip
              text={localizeUi("ui.lorebooks.vectorizesection.maximumNumberOfSemanticVectorEntriesThisLorebookCan")}
            />
          </span>
          <input
            type="number"
            value={vectorMaxResults}
            onChange={(e) =>
              onVectorMaxResultsChange(
                Math.max(
                  LIMITS.LOREBOOK_VECTOR_MAX_RESULTS_MIN,
                  Math.min(LIMITS.LOREBOOK_VECTOR_MAX_RESULTS_MAX, Number.parseInt(e.target.value, 10) || 0),
                ),
              )
            }
            min={LIMITS.LOREBOOK_VECTOR_MAX_RESULTS_MIN}
            max={LIMITS.LOREBOOK_VECTOR_MAX_RESULTS_MAX}
            className="mari-editor-field h-9 w-full px-2.5 py-1.5 text-xs"
          />
        </label>
      </div>
      {excludeFromVectorization ? (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.lorebooks.vectorizesection.semanticSearchIsDisabledByTheLorebookLevelVectors")}
        </p>
      ) : embeddingConnections.length === 0 ? (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.lorebooks.vectorizesection.noConnectionsWithAnEmbeddingModelConfiguredSetAn")}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedConnectionId}
              onChange={(e) => handleConnectionChange(e.target.value)}
              className="mari-editor-field min-w-44 flex-1 px-2.5 py-1.5 text-xs"
            >
              <option value="">{localizeUi("ui.lorebooks.vectorizesection.noSemanticSearch")}</option>
              {embeddingConnections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.embeddingModel})
                </option>
              ))}
            </select>
            <button
              onClick={() => handleVectorize(primaryVectorizeMode)}
              disabled={vectorizing || vectorizableEntryCount === 0 || !selectedConnectionId}
              className="mari-chrome-accent-surface mari-accent-animated flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {vectorizingMode === primaryVectorizeMode ? (
                <Loader2 size="0.75rem" className="animate-spin" />
              ) : primaryVectorizeMode === "all" ? (
                <RefreshCw size="0.75rem" />
              ) : (
                <Sparkles size="0.75rem" />
              )}
              {vectorizingMode === primaryVectorizeMode
                ? primaryVectorizeMode === "all"
                  ? localizeUi("ui.lorebooks.vectorizesection.reVectorizing")
                  : localizeUi("ui.lorebooks.vectorizesection.vectorizing")
                : !selectedConnectionId
                  ? localizeUi("ui.chat.homeprofessormarichat.selectConnection")
                  : primaryVectorizeMode === "all"
                    ? localizeUi("ui.lorebooks.vectorizesection.reVectorizeValue1Entries", {
                        value1: vectorizableEntryCount,
                      })
                    : localizeUi("ui.lorebooks.vectorizesection.vectorizeValue1Missing", { value1: missingCount })}
            </button>
            {showRevectorizeAllAction && (
              <button
                onClick={() => handleVectorize("all")}
                disabled={vectorizing || vectorizableEntryCount === 0 || !selectedConnectionId}
                className="flex items-center gap-1.5 rounded-xl bg-[var(--secondary)]/70 px-3 py-1.5 text-xs font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--secondary)] active:scale-[0.98] disabled:opacity-50"
                title={localizeUi("ui.lorebooks.vectorizesection.overwriteEveryStoredVectorInThisLorebookWithThe")}
              >
                {vectorizingMode === "all" ? (
                  <Loader2 size="0.75rem" className="animate-spin" />
                ) : (
                  <RefreshCw size="0.75rem" />
                )}
                {vectorizingMode === "all"
                  ? localizeUi("ui.lorebooks.vectorizesection.reVectorizing")
                  : localizeUi("ui.lorebooks.vectorizesection.reVectorizeAll")}
              </button>
            )}
            <button
              onClick={handleClearVectors}
              disabled={clearingVectors || vectorizing || storedVectorCount === 0}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--secondary)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] active:scale-[0.98] disabled:opacity-50"
              title={localizeUi("ui.lorebooks.vectorizesection.deleteAllStoredVectorsForThisLorebook")}
            >
              {clearingVectors ? <Loader2 size="0.75rem" className="animate-spin" /> : <Trash2 size="0.75rem" />}
              {localizeUi("ui.lorebooks.vectorizesection.deleteVectors")}
            </button>
          </div>
          {storedVectorCount > 0 && (
            <p className="text-[0.625rem] text-[var(--muted-foreground)]">
              {storedVectorCount} {localizeUi("ui.lorebooks.vectorizesection.storedVector")}
              {storedVectorCount === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s")}{" "}
              {localizeUi("ui.lorebooks.vectorizesection.canBeDeletedWithoutChangingLorebookText")}
            </p>
          )}
          {!selectedConnectionId && (
            <p className="text-[0.625rem] text-[var(--muted-foreground)]">
              {localizeUi("ui.lorebooks.vectorizesection.semanticSearchIsOffUntilYouChooseAnEmbedding")}
            </p>
          )}
          {result && (
            <p
              className={cn(
                "text-[0.625rem] flex items-center gap-1",
                result.success ? "text-emerald-400" : "text-red-400",
              )}
            >
              {result.success ? <Check size="0.625rem" /> : <AlertTriangle size="0.625rem" />}
              {result.message}
            </p>
          )}
        </>
      )}
    </div>
  );
}
