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
} from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  useUpdateLorebookEntry,
  useReorderLorebookFolders,
  useUpdateLorebookFolder,
  useTransferLorebookEntries,
  lorebookKeys,
} from "../../hooks/use-lorebooks";
import { useCharacters, usePersonas } from "../../hooks/use-characters";
import { useConnections } from "../../hooks/use-connections";
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
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  ChevronDown,
  Globe,
  Users,
  UserRound,
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
} from "lucide-react";
import { cn } from "../../lib/utils";
import { HelpTooltip } from "../ui/HelpTooltip";
import { api } from "../../lib/api-client";
import {
  LOCAL_SIDECAR_CONNECTION_ID,
  LIMITS,
  testPrimaryKeys,
  testSecondaryKeys,
  buildFolderForest,
  canReparentFolder,
  type Lorebook,
  type LorebookEntry,
  type LorebookFolder,
  type LorebookCategory,
} from "@marinara-engine/shared";
import { LorebookEntryRow } from "./LorebookEntryRow";
import { LorebookFolderRow } from "./LorebookFolderRow";
import { ExpandableTextarea, estimateTokens } from "./LorebookFormFields";
import { ExportFormatDialog, type ExportFormatChoice } from "../ui/ExportFormatDialog";
import { EditorTabRail } from "../ui/EditorTabRail";

// ──────────────────────────────────────────────
// Folder collapse state lives in localStorage — purely a UI preference, not
// worth a server round-trip on every toggle. Keyed per-lorebook so collapse
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
      [item.name, item.description ?? ""].some((value) => value.toLowerCase().includes(search.toLowerCase())),
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
              className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30"
            >
              <span className="text-[var(--primary)]">{icon}</span>
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
                title={`Remove ${item.name}`}
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
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
        >
          <Plus size="0.75rem" /> {addLabel}
        </button>
      ) : (
        <div className="mt-2 overflow-hidden rounded-lg bg-[var(--card)] ring-1 ring-[var(--border)]">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
            <Search size="0.75rem" className="text-[var(--muted-foreground)]" />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--muted-foreground)]"
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
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
              >
                <span className="text-[var(--muted-foreground)]">{icon}</span>
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
                {items.length === selectedItems.length ? `All ${label.toLowerCase()} already added.` : "No matches."}
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
  { value: "npc", label: "NPC", icon: UserRound },
  { value: "spellbook", label: "Spellbook", icon: Wand2 },
  { value: "uncategorized", label: "Uncategorized", icon: BookOpen },
];

type EntrySortKey = "order" | "name-asc" | "name-desc" | "tokens" | "keys" | "newest" | "oldest";

const SORT_OPTIONS: Array<{ value: EntrySortKey; label: string }> = [
  { value: "order", label: "Order" },
  { value: "name-asc", label: "Name A→Z" },
  { value: "name-desc", label: "Name Z→A" },
  { value: "tokens", label: "Tokens ↓" },
  { value: "keys", label: "Keys ↓" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

export function LorebookEditor() {
  const lorebookId = useUIStore((s) => s.lorebookDetailId);
  const closeDetail = useUIStore((s) => s.closeLorebookDetail);
  const activeChat = useChatStore((s) => s.activeChat);
  const { data: rawLorebook, isLoading, isError } = useLorebook(lorebookId);
  const { data: rawLorebooks } = useLorebooks();
  const { data: rawEntries } = useLorebookEntries(lorebookId);
  const { data: rawFolders } = useLorebookFolders(lorebookId);
  const { data: rawCharacters } = useCharacters();
  const { data: rawPersonas } = usePersonas();
  const updateLorebook = useUpdateLorebook();
  const deleteLorebook = useDeleteLorebook();
  const createEntry = useCreateLorebookEntry();
  const updateEntry = useUpdateLorebookEntry();
  const reorderEntries = useReorderLorebookEntries();
  const createFolder = useCreateLorebookFolder();
  const updateFolder = useUpdateLorebookFolder();
  const reorderFolders = useReorderLorebookFolders();
  const transferEntries = useTransferLorebookEntries();

  const lorebook = rawLorebook as Lorebook | undefined;
  const lorebooks = useMemo(() => (rawLorebooks ?? []) as Lorebook[], [rawLorebooks]);
  const entries = useMemo(() => (rawEntries ?? []) as LorebookEntry[], [rawEntries]);
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
  const personas = useMemo(() => {
    if (!rawPersonas) return [] as Array<{ id: string; name: string; comment?: string | null }>;
    return (rawPersonas as Array<{ id: string; name: string; comment?: string | null }>).map((p) => ({
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

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [lorebookDirty, setLorebookDirty] = useState(false);
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
  const markLorebookDirty = useCallback(() => setLorebookDirty(true), []);

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

  const handleTransferEntries = useCallback(
    async (operation: "copy" | "move") => {
      if (!lorebookId || !entryTransferTargetId || selectedEntryIds.size === 0) return;
      const targetLorebookName =
        transferTargetLorebooks.find((book) => book.id === entryTransferTargetId)?.name ?? "the selected lorebook";

      if (
        operation === "move" &&
        !(await showConfirmDialog({
          title: "Move Lorebook Entries",
          message: `Move ${selectedEntryIds.size} selected ${selectedEntryIds.size === 1 ? "entry" : "entries"} to "${targetLorebookName}"? They will be removed from this lorebook.`,
          confirmLabel: "Move",
        }))
      ) {
        return;
      }

      try {
        const result = await transferEntries.mutateAsync({
          sourceLorebookId: lorebookId,
          targetLorebookId: entryTransferTargetId,
          entryIds: Array.from(selectedEntryIds),
          operation,
        });
        toast.success(
          `${operation === "move" ? "Moved" : "Copied"} ${result.transferred} ${result.transferred === 1 ? "entry" : "entries"} to "${targetLorebookName}".`,
        );
        exitEntrySelectionMode();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Failed to ${operation} entries.`);
      }
    },
    [
      entryTransferTargetId,
      exitEntrySelectionMode,
      lorebookId,
      selectedEntryIds,
      transferEntries,
      transferTargetLorebooks,
    ],
  );

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
    await createFolder.mutateAsync({ lorebookId, name: "New Folder", enabled: true });
  }, [lorebookId, createFolder]);

  const handleSaveLorebook = useCallback(async () => {
    if (!lorebookId) return;
    setSaving(true);
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
        characterIds: formIsGlobal ? [] : formCharacterIds,
        personaIds: formIsGlobal ? [] : formPersonaIds,
        tags: formTags,
      });
      setLorebookDirty(false);
    } finally {
      setSaving(false);
    }
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
    formCharacterIds,
    formPersonaIds,
    formTags,
    updateLorebook,
  ]);

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
  // the server (a stale pointer carried over from another Marinara
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
    await deleteLorebook.mutateAsync(lorebookId);
    closeDetail();
  }, [lorebookId, deleteLorebook, closeDetail]);

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
        {showFolderDropBefore && <div className="mx-2 mb-1 h-0.5 rounded-full bg-amber-400" />}
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
        />
        {!isCollapsed && (
          <div
            className={cn(
              "ml-2 space-y-1.5 border-l pl-2 transition-colors sm:ml-3 sm:pl-2.5",
              isEntryDropTarget || isFolderNestTarget ? "border-amber-400 bg-amber-400/5" : "border-[var(--border)]",
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
                Empty — drag an entry here or pick this folder from an entry's folder selector.
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
                  {showDropBefore && <div className="mx-2 mb-1 h-0.5 rounded-full bg-amber-400" />}
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
                  />
                  {showDropAfter && <div className="mx-2 mt-1 h-0.5 rounded-full bg-amber-400" />}
                </div>
              );
            })}
            {childFolders.map((child) => renderFolder(child))}
          </div>
        )}
        {showFolderDropAfter && <div className="mx-2 mt-1 h-0.5 rounded-full bg-amber-400" />}
      </div>
    );
  };

  // ── Main editor ──
  return (
    <div className="mari-editor-shell flex flex-1 flex-col overflow-hidden">
      <ExportFormatDialog
        open={exportDialogOpen}
        title="Export Lorebook"
        description="Native keeps Marinara folders and entry fields. Compatible exports a folderless World Info JSON for other roleplay tools."
        onClose={() => setExportDialogOpen(false)}
        onSelect={(format: ExportFormatChoice) => {
          if (!lorebookId) return;
          setExportDialogOpen(false);
          void api.download(`/lorebooks/${lorebookId}/export?format=${format}`);
        }}
      />

      {/* Unsaved warning banner */}
      {showUnsavedWarning && (
        <div className="flex items-center gap-3 bg-amber-500/10 px-4 py-2.5 text-xs">
          <AlertTriangle size="0.875rem" className="text-amber-400" />
          <span className="flex-1 text-amber-200">You have unsaved changes</span>
          <button
            onClick={() => setShowUnsavedWarning(false)}
            className="rounded-lg px-3 py-1 text-[0.6875rem] font-medium text-amber-300 ring-1 ring-amber-400/30 transition-colors hover:bg-amber-400/10"
          >
            Keep editing
          </button>
          <button
            onClick={() => {
              setShowUnsavedWarning(false);
              setLorebookDirty(false);
              closeDetail();
            }}
            className="rounded-lg px-3 py-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            Discard & close
          </button>
          <button
            onClick={async () => {
              await handleSaveLorebook();
              setShowUnsavedWarning(false);
              closeDetail();
            }}
            className="rounded-lg bg-amber-500 px-3 py-1 text-[0.6875rem] font-medium text-white transition-colors hover:bg-amber-600"
          >
            Save & close
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mari-editor-header">
        <button onClick={handleClose} className="mari-editor-action inline-flex">
          <ArrowLeft size="1rem" />
        </button>
        <div className="mari-editor-icon-tile">
          <BookOpen size="1.125rem" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="mari-editor-title truncate text-base">{lorebook.name}</h2>
          <p className="mari-editor-meta">
            {entries.length} entries • {lorebook.category}
          </p>
        </div>
        <div className="mari-editor-actions flex">
          <button
            onClick={handleSaveLorebook}
            disabled={!lorebookDirty || saving}
            className="mari-editor-action mari-editor-action--primary inline-flex disabled:opacity-50"
          >
            <Save size="0.8125rem" />
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => setExportDialogOpen(true)}
            className="mari-editor-action inline-flex"
            title="Export lorebook"
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
            className="mari-editor-action mari-editor-action--danger inline-flex"
            title="Delete lorebook"
          >
            <Trash2 size="0.875rem" />
          </button>
        </div>
      </div>

      {/* Body: Side-tabs + Content */}
      <div className="mari-editor-body @max-5xl:flex-col">
        <EditorTabRail
          tabs={TABS}
          activeId={activeTab}
          onChange={setActiveTab}
          getBadge={(tabId) => (tabId === "entries" ? entries.length : null)}
        />

        {/* Tab Content */}
        <div className="mari-editor-content @max-5xl:p-4">
          <div className="mari-editor-content-inner mari-editor-content-inner--wide">
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Name */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium">Name</label>
                  <input
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      markLorebookDirty();
                    }}
                    className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium">Description</label>
                  <ExpandableTextarea
                    value={formDescription}
                    onChange={(value) => {
                      setFormDescription(value);
                      markLorebookDirty();
                    }}
                    rows={3}
                    title="Edit lorebook description"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1 text-xs font-medium">
                    <Tag size="0.75rem" /> Tags
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {formTags.map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 rounded-lg bg-amber-400/15 px-2 py-1 text-[0.6875rem] font-medium text-amber-400"
                      >
                        {tag}
                        <button
                          onClick={() => {
                            setFormTags(formTags.filter((t) => t !== tag));
                            markLorebookDirty();
                          }}
                          className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-amber-400/20"
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
                      placeholder="Add tag…"
                      className="flex-1 rounded-xl bg-[var(--secondary)] px-3 py-2 text-xs ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    />
                    <button
                      onClick={handleAddTags}
                      className="rounded-xl bg-[var(--secondary)] px-3 py-2 text-xs font-medium ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]"
                    >
                      <Plus size="0.75rem" />
                    </button>
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium">Category</label>
                  <div className="flex gap-2">
                    {CATEGORY_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setFormCategory(opt.value);
                            markLorebookDirty();
                          }}
                          className={cn(
                            "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all",
                            formCategory === opt.value
                              ? "bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/30"
                              : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
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
                  <div className="rounded-xl bg-[var(--secondary)]/60 p-4 ring-1 ring-[var(--border)]">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {/* Character Link */}
                      <LinkedResourcePicker
                        label="Linked Characters"
                        help="When linked to characters, this lorebook auto-activates in chats that include any of them."
                        emptyText="No characters selected"
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
                        label="Linked Personas"
                        help="When linked to personas, this lorebook auto-activates in chats that use any of them."
                        emptyText="No personas selected"
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
                  <div className="flex min-h-[4.75rem] items-center justify-between rounded-xl bg-[var(--secondary)] px-4 py-3 ring-1 ring-[var(--border)]">
                    <div>
                      <p className="text-xs font-medium">Enabled</p>
                      <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                        When off, entries in this lorebook won't activate
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setFormEnabled(!formEnabled);
                        markLorebookDirty();
                      }}
                      className="transition-colors"
                    >
                      {formEnabled ? (
                        <ToggleRight size="1.75rem" className="text-amber-400" />
                      ) : (
                        <ToggleLeft size="1.75rem" className="text-[var(--muted-foreground)]" />
                      )}
                    </button>
                  </div>

                  {scopeSummary && (
                    <div className="flex h-[10.25rem] items-start overflow-hidden rounded-xl bg-[var(--secondary)] px-4 py-3 ring-1 ring-[var(--border)] md:row-span-2">
                      <div className="min-w-0 overflow-hidden">
                        <p className="text-xs font-medium mb-1">Linked To:</p>
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

                  <div className="flex min-h-[4.75rem] items-center justify-between rounded-xl bg-[var(--secondary)] px-4 py-3 ring-1 ring-[var(--border)]">
                    <div>
                      <p className="text-xs font-medium">Global</p>
                      <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                        Active in every chat when this lorebook is enabled
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setFormIsGlobal(!formIsGlobal);
                        markLorebookDirty();
                      }}
                      className="transition-colors"
                    >
                      {formIsGlobal ? (
                        <ToggleRight size="1.75rem" className="text-amber-400" />
                      ) : (
                        <ToggleLeft size="1.75rem" className="text-[var(--muted-foreground)]" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Scan settings */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  <div>
                    <label className="mb-1.5 flex items-center gap-1 text-xs font-medium">
                      Scan Depth{" "}
                      <HelpTooltip text="How many recent messages to scan for keyword matches. Higher = searches further back in chat history, but uses more processing." />
                    </label>
                    <input
                      type="number"
                      value={formScanDepth}
                      onChange={(e) => {
                        setFormScanDepth(parseInt(e.target.value) || 0);
                        markLorebookDirty();
                      }}
                      min={0}
                      className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-1 text-xs font-medium">
                      Token Budget{" "}
                      <HelpTooltip text="Maximum number of tokens this lorebook can inject per generation. Prevents a lorebook from consuming too much of the context window." />
                    </label>
                    <input
                      type="number"
                      value={formTokenBudget}
                      onChange={(e) => {
                        setFormTokenBudget(parseInt(e.target.value) || 0);
                        markLorebookDirty();
                      }}
                      min={0}
                      className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-1 text-xs font-medium">
                      Entry Limit{" "}
                      <HelpTooltip text="Maximum active entries this lorebook can contribute per generation. Token budgets still trim the final prompt." />
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
                      className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex items-center justify-between rounded-xl bg-[var(--secondary)] px-3 py-2.5 ring-1 ring-[var(--border)]">
                      <span className="mr-2 text-xs">Recursive</span>
                      <button
                        onClick={() => {
                          setFormRecursive(!formRecursive);
                          markLorebookDirty();
                        }}
                      >
                        {formRecursive ? (
                          <ToggleRight size="1.375rem" className="text-amber-400" />
                        ) : (
                          <ToggleLeft size="1.375rem" className="text-[var(--muted-foreground)]" />
                        )}
                      </button>
                    </div>
                    {formRecursive && (
                      <div>
                        <label className="mb-1.5 flex items-center gap-1 text-xs font-medium">
                          Max Depth{" "}
                          <HelpTooltip text="Maximum number of recursive passes. Each pass scans activated entry content for additional keyword matches. Higher values find more connections but use more processing." />
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
                          className="w-20 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-end">
                    <div className="flex w-full items-center justify-between rounded-xl bg-[var(--secondary)] px-3 py-2.5 ring-1 ring-[var(--border)]">
                      <span className="mr-2 inline-flex items-center gap-1 text-xs">
                        No Vector
                        <HelpTooltip text="Skip semantic embeddings for every entry in this lorebook. Keyword matching still works." />
                      </span>
                      <button
                        onClick={() => {
                          setFormExcludeFromVectorization(!formExcludeFromVectorization);
                          markLorebookDirty();
                        }}
                      >
                        {formExcludeFromVectorization ? (
                          <ToggleRight size="1.375rem" className="text-amber-400" />
                        ) : (
                          <ToggleLeft size="1.375rem" className="text-[var(--muted-foreground)]" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Vectorize (Embeddings) */}
                <VectorizeSection
                  lorebookId={lorebookId!}
                  entries={entries}
                  excludeFromVectorization={formExcludeFromVectorization}
                />
              </div>
            )}

            {activeTab === "entries" && (
              <div className="space-y-3">
                {/* Keyword test — collapsible authoring aid (issue #816).
                    Paste sample chat text or a paragraph and the editor
                    highlights which entries would activate. Honors keyword
                    matching rules only — see previewMatches memo for scope. */}
                <div className="rounded-xl bg-[var(--secondary)]/60 ring-1 ring-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setKeywordPreviewOpen((open) => !open)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-colors hover:bg-[var(--accent)]/30"
                    aria-expanded={keywordPreviewOpen}
                  >
                    <FlaskConical size="0.8125rem" className="shrink-0 text-amber-400" />
                    <span className="flex-1">Keyword test</span>
                    {previewActive && (
                      <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[0.625rem] font-medium text-emerald-300 ring-1 ring-emerald-400/25">
                        {previewMatchCount} match{previewMatchCount === 1 ? "" : "es"}
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
                    <div className="space-y-2 border-t border-[var(--border)] px-3 py-3">
                      <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                        Paste sample chat text and entries whose keys would trigger get an emerald accent and a
                        &quot;Would activate&quot; chip. Constant entries are flagged separately because they activate
                        regardless of text. Out of scope: timing, probability, character/persona filters, and semantic
                        matching.
                      </p>
                      <div className="relative">
                        <textarea
                          value={keywordPreviewText}
                          onChange={(e) => setKeywordPreviewText(e.target.value)}
                          placeholder="Paste a paragraph or sample messages here…"
                          rows={4}
                          className="w-full resize-y rounded-xl bg-[var(--background)] px-3 py-2 pr-8 text-xs ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                        />
                        {keywordPreviewText && (
                          <button
                            type="button"
                            onClick={() => setKeywordPreviewText("")}
                            className="absolute right-2 top-2 rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                            title="Clear keyword test"
                            aria-label="Clear keyword test"
                          >
                            <X size="0.75rem" />
                          </button>
                        )}
                      </div>
                      {previewActive && (
                        <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                          {previewMatchCount === 0
                            ? "No entries would activate on this text."
                            : `${previewMatchCount} of ${entries.filter((e) => e.enabled).length} enabled entr${
                                entries.filter((e) => e.enabled).length === 1 ? "y" : "ies"
                              } would activate.`}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Search + Sort + Add — flex-wrap so the row collapses
                    gracefully on narrow viewports. Search keeps a 12rem
                    (~192px) flex-basis so it stays usable; the buttons tile
                    onto the next row instead of being clipped at ~400px. */}
                <div className="flex flex-wrap items-stretch gap-2">
                  <div className="relative min-w-0 flex-[1_1_12rem]">
                    <Search
                      size="0.8125rem"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                    />
                    <input
                      type="text"
                      placeholder="Search entries…"
                      value={entrySearch}
                      onChange={(e) => setEntrySearch(e.target.value)}
                      className="w-full rounded-xl bg-[var(--secondary)] py-2.5 pl-8 pr-3 text-xs ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
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
                      className="h-full appearance-none rounded-xl bg-[var(--secondary)] py-2.5 pl-8 pr-6 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
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
                      "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium ring-1 transition-colors",
                      entrySelectionMode
                        ? "bg-amber-400/15 text-amber-400 ring-amber-400/30"
                        : "bg-[var(--secondary)] ring-[var(--border)] hover:bg-[var(--accent)]",
                    )}
                    title="Select entries to copy or move"
                  >
                    <CheckSquare2 size="0.8125rem" />
                    Select
                  </button>
                  <button
                    onClick={handleAddFolder}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-xs font-medium ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]"
                    title="Create a new folder to group entries"
                  >
                    <FolderPlus size="0.8125rem" />
                    Add Folder
                  </button>
                  <button
                    onClick={handleAddEntry}
                    className="mari-editor-action mari-editor-action--primary inline-flex shrink-0"
                  >
                    <Plus size="0.8125rem" />
                    Add Entry
                  </button>
                </div>

                {entrySelectionMode && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 px-3 py-2">
                    <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                      {selectedEntryIds.size} selected
                    </span>
                    <button
                      onClick={() => setSelectedEntryIds(new Set(visibleEntryIds))}
                      disabled={visibleEntryIds.length === 0}
                      className="rounded-lg px-2.5 py-1 text-[0.625rem] font-medium text-amber-400 transition-colors hover:bg-[var(--accent)] disabled:opacity-40"
                    >
                      Select all
                    </button>
                    <button
                      onClick={() => setSelectedEntryIds(new Set())}
                      disabled={selectedEntryIds.size === 0}
                      className="rounded-lg px-2.5 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40"
                    >
                      Clear
                    </button>
                    <select
                      value={entryTransferTargetId}
                      onChange={(e) => setEntryTransferTargetId(e.target.value)}
                      disabled={transferTargetLorebooks.length === 0}
                      className="min-h-8 min-w-[12rem] flex-1 rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50"
                    >
                      {transferTargetLorebooks.length === 0 ? (
                        <option value="">Create another lorebook first</option>
                      ) : (
                        transferTargetLorebooks.map((book) => (
                          <option key={book.id} value={book.id}>
                            {book.name}
                          </option>
                        ))
                      )}
                    </select>
                    <button
                      onClick={() => void handleTransferEntries("copy")}
                      disabled={selectedEntryIds.size === 0 || !entryTransferTargetId || transferEntries.isPending}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-[0.625rem] font-medium text-white transition-all hover:opacity-90 disabled:opacity-40"
                    >
                      {transferEntries.isPending ? (
                        <Loader2 size="0.6875rem" className="animate-spin" />
                      ) : (
                        <Copy size="0.6875rem" />
                      )}
                      Copy
                    </button>
                    <button
                      onClick={() => void handleTransferEntries("move")}
                      disabled={selectedEntryIds.size === 0 || !entryTransferTargetId || transferEntries.isPending}
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--destructive)]/12 px-2.5 py-1.5 text-[0.625rem] font-medium text-[var(--destructive)] transition-all hover:bg-[var(--destructive)]/20 disabled:opacity-40"
                    >
                      {transferEntries.isPending ? (
                        <Loader2 size="0.6875rem" className="animate-spin" />
                      ) : (
                        <MoveRight size="0.6875rem" />
                      )}
                      Move
                    </button>
                    <button
                      onClick={exitEntrySelectionMode}
                      className="rounded-lg px-2.5 py-1.5 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    >
                      Done
                    </button>
                  </div>
                )}

                {/* Total tokens summary */}
                {entries.length > 0 && (
                  <div className="flex items-center gap-3 text-[0.6875rem] text-[var(--muted-foreground)]">
                    <span>
                      {entries.length} {entries.length === 1 ? "entry" : "entries"}
                    </span>
                    {folders.length > 0 && (
                      <>
                        <span>•</span>
                        <span>
                          {folders.length} {folders.length === 1 ? "folder" : "folders"}
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Hash size="0.625rem" />
                      {entries.reduce((sum, e) => sum + estimateTokens(e.content), 0).toLocaleString()} tokens (est.)
                    </span>
                    {!showFolderGrouping && folders.length > 0 && (
                      <span className="ml-auto italic">Folder view paused (clear search and sort by Order)</span>
                    )}
                  </div>
                )}

                {/* Empty state */}
                {entries.length === 0 && folders.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <FileText size="1.5rem" className="text-[var(--muted-foreground)]" />
                    <p className="text-xs text-[var(--muted-foreground)]">No entries yet — add one to get started</p>
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
                        className={cn(
                          "space-y-1.5 rounded-lg py-1 transition-colors",
                          folderRootDropActive && "bg-amber-400/5 ring-1 ring-amber-400/40",
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

                    {/* Root entries (entries with no folder).
                        Always rendered when grouping is active so it acts as
                        a permanent drop target — otherwise a user with all
                        entries inside folders has no place to drop a folder
                        entry to bring it back to root. */}
                    <div
                      ref={entryListRef}
                      className={cn(
                        "space-y-1.5",
                        // Highlight while an entry from another container, or a nested
                        // folder being un-nested, is dragged toward this root zone.
                        ((draggingEntryIdx !== null && dragSourceContainer !== null && dropTargetContainer === null) ||
                          (draggingFolderIdx !== null && folderRootDropActive)) &&
                          "rounded-xl ring-1 ring-amber-400/40 bg-amber-400/5 transition-colors",
                      )}
                      onDragOver={(e) => {
                        // Dragging a folder down into the root-entries area un-nests it to
                        // the top level (the root entries already live there).
                        if (draggingFolderIdx !== null) handleFolderRootDragOver(e);
                        else handleRootListDragOver(e);
                      }}
                      onDrop={(e) => {
                        if (draggingFolderIdx !== null) commitFolderDrop(e);
                        else commitEntryDrop(e);
                      }}
                    >
                      {(entriesByContainer.get(null) ?? []).length === 0 && (
                        <p
                          className={cn(
                            "py-3 text-center text-[0.625rem] italic text-[var(--muted-foreground)] transition-opacity",
                            // Only call out the empty-root zone while the user
                            // is actively dragging an entry from a folder; in
                            // the steady state it would just be visual noise.
                            draggingFolderIdx !== null || (draggingEntryIdx !== null && dragSourceContainer !== null)
                              ? "opacity-100"
                              : "opacity-50",
                          )}
                        >
                          {draggingFolderIdx !== null
                            ? "Drop here to move the folder to the top level"
                            : draggingEntryIdx !== null && dragSourceContainer !== null
                              ? "Drop here to move out of the folder"
                              : "No entries at the root level"}
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
                            {showDropBefore && <div className="mx-2 mb-1 h-0.5 rounded-full bg-amber-400" />}
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
                            />
                            {showDropAfter && <div className="mx-2 mt-1 h-0.5 rounded-full bg-amber-400" />}
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
                      />
                    ))}
                  </div>
                )}

                {/* Search-with-no-matches */}
                {lorebookId && !showFolderGrouping && filteredEntries.length === 0 && entries.length > 0 && (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <FileText size="1.5rem" className="text-[var(--muted-foreground)]" />
                    <p className="text-xs text-[var(--muted-foreground)]">No entries match your search</p>
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
}: {
  lorebookId: string;
  entries: LorebookEntry[];
  excludeFromVectorization: boolean;
}) {
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
  const [vectorizing, setVectorizing] = useState(false);
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
  const missingCount = Math.max(0, vectorizableEntryCount - vectorizedCount);
  const allVectorized = vectorizableEntryCount > 0 && missingCount === 0;

  useEffect(() => {
    if (import.meta.env.VITE_MARINARA_LITE !== "true") {
      void fetchSidecarStatus();
    }
  }, [fetchSidecarStatus]);

  const handleVectorize = async () => {
    if (!selectedConnectionId) return;
    setVectorizing(true);
    setResult(null);
    try {
      const conn = embeddingConnections.find((c) => c.id === selectedConnectionId);
      const res = await api.post(`/lorebooks/${lorebookId}/vectorize`, {
        connectionId: selectedConnectionId,
        model: conn?.embeddingModel ?? "",
        onlyMissing: !allVectorized,
      });
      const data = res as { vectorized: number; total?: number; skipped?: number };
      await queryClient.invalidateQueries({ queryKey: lorebookKeys.entries(lorebookId) });
      setResult({
        success: true,
        message: allVectorized
          ? `Re-vectorized ${data.vectorized} entries`
          : `Vectorized ${data.vectorized} missing entries`,
      });
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : "Vectorization failed" });
    } finally {
      setVectorizing(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size="0.875rem" className="text-violet-400" />
        <h4 className="text-xs font-semibold">Semantic Search (Embeddings)</h4>
        <HelpTooltip text="Vectorize entries to enable semantic matching. Entries will be found by meaning, not just keywords. Requires a connection with an Embedding Model configured." />
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
          {vectorizedCount}/{vectorizableEntryCount} entries vectorized
        </span>
        {missingCount > 0 && <span>{missingCount} still need embeddings.</span>}
        {excludeFromVectorization ? <span>This lorebook excludes every entry.</span> : null}
        {!excludeFromVectorization && excludedCount > 0 && <span>{excludedCount} excluded.</span>}
      </div>
      {excludeFromVectorization ? (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          Semantic search is disabled by the lorebook-level No Vector toggle.
        </p>
      ) : embeddingConnections.length === 0 ? (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          No connections with an embedding model configured. Set an Embedding Model on a connection first.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <select
              value={selectedConnectionId}
              onChange={(e) => setSelectedConnectionId(e.target.value)}
              className="flex-1 rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              <option value="">No semantic search</option>
              {embeddingConnections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.embeddingModel})
                </option>
              ))}
            </select>
            <button
              onClick={handleVectorize}
              disabled={vectorizing || vectorizableEntryCount === 0 || !selectedConnectionId}
              className="flex items-center gap-1.5 rounded-xl bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-400 ring-1 ring-violet-500/30 transition-all hover:bg-violet-500/25 active:scale-[0.98] disabled:opacity-50"
            >
              {vectorizing ? <Loader2 size="0.75rem" className="animate-spin" /> : <Sparkles size="0.75rem" />}
              {vectorizing
                ? "Vectorizing..."
                : !selectedConnectionId
                  ? "Select connection"
                  : allVectorized
                    ? `Re-vectorize ${vectorizableEntryCount} entries`
                    : `Vectorize ${missingCount} missing`}
            </button>
          </div>
          {!selectedConnectionId && (
            <p className="text-[0.625rem] text-[var(--muted-foreground)]">
              Semantic search is off until you choose an embedding connection and vectorize entries.
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
