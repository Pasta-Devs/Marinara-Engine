import {
  CheckSquare,
  Download,
  Eye,
  EyeOff,
  FileUp,
  GripVertical,
  List,
  Minus,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useCharacterSummariesByIds, type CharacterSummary } from "../../../catalog/characters";
import { useChat, type Chat } from "../../../catalog/chats";
import { pluginMemoryApi } from "../../../../shared/api/plugin-memory-api";
import { cn } from "../../../../shared/lib/utils";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { ME_NOTES_MODULE_ID } from "../lib/core-module-registry";

const LAYOUT_STORAGE_KEY = "marinara-notepad-layout-v1";
const NOTEPAD_MEMORY_KEY = "state";
const MIN_PANEL_WIDTH = 240;
const MIN_PANEL_HEIGHT = 360;
const PANEL_MARGIN = 12;
const COLLAPSED_WIDTH = 96;
const COLLAPSED_HEIGHT = 36;
const COLLAPSED_OPEN_SUPPRESS_MS = 500;

type NoteScope = "global" | "character" | "chat";
type BranchMode = "branch" | "family";
type ViewMode = "edit" | "preview";
type StatusTone = "muted" | "ok" | "error";

interface NotepadLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface NotepadTab {
  id: string;
  title: string;
  scope: NoteScope;
  branchMode: BranchMode;
  characterId: string | null;
  chatId: string | null;
  groupId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NotepadMemoryState {
  version: 1;
  activeTabId: string | null;
  tabs: NotepadTab[];
  notes: Record<string, string>;
}

interface NotepadLayoutState {
  open: boolean;
  viewMode: ViewMode;
  tabsCollapsed: boolean;
  layout: NotepadLayout;
  collapsedLayout: NotepadLayout;
}

interface NotepadState extends NotepadMemoryState, NotepadLayoutState {}

interface NotepadContext {
  chatId: string | null;
  chat: Chat | null;
  characterLabels: Map<string, string>;
}

interface ScopeResolution {
  key: string;
  label: string;
  placeholder: string;
}

interface PendingSelection {
  start: number;
  end: number;
}

interface DropTarget {
  id: string;
  position: "before" | "after";
}

interface NotepadStatus {
  message: string;
  tone: StatusTone;
}

const DEFAULT_TAB: NotepadTab = {
  id: "tab-notes",
  title: "Notes",
  scope: "chat",
  branchMode: "branch",
  characterId: null,
  chatId: null,
  groupId: null,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function viewportSize() {
  if (!hasWindow()) return { width: 1280, height: 800 };
  return {
    width: Math.max(document.documentElement.clientWidth || window.innerWidth || 1280, MIN_PANEL_WIDTH),
    height: Math.max(document.documentElement.clientHeight || window.innerHeight || 800, MIN_PANEL_HEIGHT),
  };
}

function defaultLayout(): NotepadLayout {
  const viewport = viewportSize();
  const width = Math.min(384, viewport.width - PANEL_MARGIN * 2);
  const height = Math.min(560, viewport.height - PANEL_MARGIN * 4);
  return {
    width,
    height,
    x: Math.max(PANEL_MARGIN, viewport.width - width - 16),
    y: Math.max(PANEL_MARGIN, viewport.height - height - 84),
  };
}

function constrainLayout(layout: Partial<NotepadLayout> | null | undefined): NotepadLayout {
  const fallback = defaultLayout();
  const viewport = viewportSize();
  const maxWidth = Math.max(MIN_PANEL_WIDTH, viewport.width - PANEL_MARGIN * 2);
  const maxHeight = Math.max(300, viewport.height - PANEL_MARGIN * 2);
  const width = clamp(Number.isFinite(layout?.width) ? Number(layout?.width) : fallback.width, MIN_PANEL_WIDTH, maxWidth);
  const height = clamp(
    Number.isFinite(layout?.height) ? Number(layout?.height) : fallback.height,
    Math.min(MIN_PANEL_HEIGHT, maxHeight),
    maxHeight,
  );
  return {
    width,
    height,
    x: clamp(Number.isFinite(layout?.x) ? Number(layout?.x) : fallback.x, PANEL_MARGIN, viewport.width - width - PANEL_MARGIN),
    y: clamp(Number.isFinite(layout?.y) ? Number(layout?.y) : fallback.y, PANEL_MARGIN, viewport.height - height - PANEL_MARGIN),
  };
}

function constrainCollapsedLayout(layout: Partial<NotepadLayout> | null | undefined): NotepadLayout {
  const fallback = defaultLayout();
  const viewport = viewportSize();
  return {
    width: Number.isFinite(layout?.width) ? Number(layout?.width) : fallback.width,
    height: Number.isFinite(layout?.height) ? Number(layout?.height) : fallback.height,
    x: clamp(
      Number.isFinite(layout?.x) ? Number(layout?.x) : fallback.x,
      PANEL_MARGIN,
      Math.max(PANEL_MARGIN, viewport.width - COLLAPSED_WIDTH - PANEL_MARGIN),
    ),
    y: clamp(
      Number.isFinite(layout?.y) ? Number(layout?.y) : fallback.y,
      PANEL_MARGIN,
      Math.max(PANEL_MARGIN, viewport.height - COLLAPSED_HEIGHT - PANEL_MARGIN),
    ),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeTab(value: unknown): NotepadTab {
  const raw = asRecord(value) ?? {};
  const scope = raw.scope === "global" || raw.scope === "character" || raw.scope === "chat" ? raw.scope : "chat";
  const branchMode = raw.branchMode === "family" ? "family" : "branch";
  const timestamp = nowIso();
  return {
    id: readString(raw.id) ?? makeId("tab"),
    title: readString(raw.title) ?? "Notes",
    scope,
    branchMode,
    characterId: readString(raw.characterId),
    chatId: readString(raw.chatId),
    groupId: readString(raw.groupId),
    createdAt: readString(raw.createdAt) ?? timestamp,
    updatedAt: readString(raw.updatedAt) ?? timestamp,
  };
}

function normalizeNotes(value: unknown): Record<string, string> {
  const raw = asRecord(value);
  if (!raw) return {};
  return Object.fromEntries(
    Object.entries(raw).flatMap(([key, note]) => (typeof note === "string" ? [[key, note] as const] : [])),
  );
}

function normalizeMemoryState(value: unknown): NotepadMemoryState {
  const raw = asRecord(value) ?? {};
  const tabs = (Array.isArray(raw.tabs) && raw.tabs.length > 0 ? raw.tabs : [DEFAULT_TAB]).map(normalizeTab);
  const activeTabId = tabs.some((tab) => tab.id === raw.activeTabId) ? String(raw.activeTabId) : tabs[0]?.id ?? null;
  return {
    version: 1,
    activeTabId,
    tabs,
    notes: normalizeNotes(raw.notes),
  };
}

function normalizeLayoutState(value: unknown): NotepadLayoutState {
  const raw = asRecord(value) ?? {};
  const layout = constrainLayout(asRecord(raw.layout) as Partial<NotepadLayout> | null);
  return {
    open: Boolean(raw.open),
    viewMode: raw.viewMode === "preview" ? "preview" : "edit",
    tabsCollapsed: Boolean(raw.tabsCollapsed),
    layout,
    collapsedLayout: constrainCollapsedLayout((asRecord(raw.collapsedLayout) as Partial<NotepadLayout> | null) ?? layout),
  };
}

function memoryState(state: NotepadState): NotepadMemoryState {
  return {
    version: 1,
    activeTabId: state.activeTabId,
    tabs: state.tabs,
    notes: state.notes,
  };
}

function layoutState(state: NotepadState): NotepadLayoutState {
  return {
    open: state.open,
    viewMode: state.viewMode,
    tabsCollapsed: state.tabsCollapsed,
    layout: state.layout,
    collapsedLayout: state.collapsedLayout,
  };
}

function initialState(): NotepadState {
  return {
    ...normalizeMemoryState(null),
    ...loadLayoutState(),
  };
}

function loadLayoutState(): NotepadLayoutState {
  if (!hasWindow()) return normalizeLayoutState(null);
  try {
    return normalizeLayoutState(JSON.parse(window.localStorage.getItem(LAYOUT_STORAGE_KEY) || "{}"));
  } catch {
    return normalizeLayoutState(null);
  }
}

function saveLayoutState(state: NotepadLayoutState): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Layout persistence is best-effort; notes are stored through plugin memory.
  }
}

async function loadMemoryState(): Promise<NotepadMemoryState> {
  const record = await pluginMemoryApi.get<NotepadMemoryState>(ME_NOTES_MODULE_ID, NOTEPAD_MEMORY_KEY);
  return normalizeMemoryState(record?.value);
}

async function saveMemoryState(state: NotepadMemoryState): Promise<void> {
  await pluginMemoryApi.put(ME_NOTES_MODULE_ID, NOTEPAD_MEMORY_KEY, state);
}

function characterName(character: CharacterSummary): string {
  return readString(character.data?.name) ?? `Character ${character.id.slice(0, 6)}`;
}

function currentCharacterIds(chat: Chat | null): string[] {
  return Array.isArray(chat?.characterIds) ? chat.characterIds.filter((id) => typeof id === "string" && id.trim()) : [];
}

function characterLabel(context: NotepadContext, id: string | null | undefined): string {
  if (!id) return "Character";
  return context.characterLabels.get(id) ?? `Character ${id.slice(0, 6)}`;
}

function titleForScope(scope: NoteScope, context: NotepadContext, characterId: string | null, branchMode: BranchMode): string {
  if (scope === "global") return "Global";
  if (scope === "character") return characterLabel(context, characterId);
  if (branchMode === "family") return "Branch-wide";
  return "Chat";
}

function uniqueTabTitle(tabs: NotepadTab[], base: string): string {
  const cleanBase = base.trim() || "Notes";
  const existing = new Set(tabs.map((tab) => tab.title.trim().toLowerCase()));
  if (!existing.has(cleanBase.toLowerCase())) return cleanBase;
  let index = 2;
  while (existing.has(`${cleanBase} ${index}`.toLowerCase())) index += 1;
  return `${cleanBase} ${index}`;
}

function tabRowLabel(scope: NoteScope): string {
  if (scope === "global") return "ALL";
  if (scope === "character") return "CHAR";
  return "CHAT";
}

function labelForTabTarget(tab: NotepadTab, context: NotepadContext): string {
  if (tab.scope === "chat") return tab.branchMode === "family" ? "branch-wide scope" : "this chat";
  if (tab.scope === "character") return tab.characterId ? characterLabel(context, tab.characterId) : "current character";
  return "every chat";
}

function noteEntryCount(tab: NotepadTab | null, state: NotepadState): number {
  if (!tab) return 0;
  const prefix = `${tab.id}::`;
  return Object.keys(state.notes).filter((key) => key.startsWith(prefix)).length;
}

function statusToneClass(tone: StatusTone): string {
  if (tone === "ok") return "border-[var(--primary)]/35 text-[var(--primary)]";
  if (tone === "error") return "border-[var(--destructive)]/40 text-[var(--destructive)]";
  return "border-[var(--border)] text-[var(--muted-foreground)]";
}

function NotepadBrand({ heading = false }: { heading?: boolean }) {
  const content = (
    <>
      <img
        src="/favicon.png"
        alt=""
        draggable={false}
        aria-hidden="true"
        className="h-4 w-4 shrink-0 rounded-full border border-[var(--primary)]/35 bg-[var(--background)]/60 p-px shadow-sm"
      />
      <span className="min-w-0 truncate font-bold leading-tight text-[var(--foreground)]">Notes</span>
    </>
  );

  return heading ? (
    <h2 className="flex min-w-0 items-center gap-1.5">{content}</h2>
  ) : (
    <span className="flex min-w-0 items-center gap-1.5">{content}</span>
  );
}

function hasNoteForScopeKey(state: NotepadState, tab: NotepadTab, scopeKey: string): boolean {
  return Object.prototype.hasOwnProperty.call(state.notes, `${tab.id}::${scopeKey}`);
}

function resolveScope(tab: NotepadTab, context: NotepadContext, state: NotepadState): ScopeResolution {
  const chat = context.chat;
  if (tab.scope === "global") {
    return {
      key: "global",
      label: "Every chat",
      placeholder: "Write anything you want available everywhere in Marinara.",
    };
  }

  if (tab.scope === "character") {
    const ids = currentCharacterIds(chat);
    const characterId = tab.characterId ?? ids.find((id) => hasNoteForScopeKey(state, tab, `character:${id}`)) ?? ids[0] ?? null;
    if (!characterId) {
      return {
        key: "character:none",
        label: "Needs character chat",
        placeholder: "This tab saves per character once the active chat has a character.",
      };
    }
    return {
      key: `character:${characterId}`,
      label: characterLabel(context, characterId),
      placeholder: `Notes for ${characterLabel(context, characterId)}.`,
    };
  }

  if (!chat?.id) {
    return {
      key: "chat:none",
      label: "Open a chat",
      placeholder: "Open a chat to save this note.",
    };
  }

  if (tab.branchMode === "family") {
    const groupId = tab.groupId ?? chat.groupId ?? chat.id;
    const currentFamilyKey = chat.groupId ? `chat-family:${chat.groupId}` : null;
    return {
      key: currentFamilyKey && hasNoteForScopeKey(state, tab, currentFamilyKey) ? currentFamilyKey : `chat-family:${groupId}`,
      label: "Branch-wide",
      placeholder: "Notes shared across every branch of this chat.",
    };
  }

  const currentBranchKey = `chat:${chat.id}`;
  const chatId = tab.chatId ?? chat.id;
  return {
    key: hasNoteForScopeKey(state, tab, currentBranchKey) ? currentBranchKey : `chat:${chatId}`,
    label: "This chat",
    placeholder: "Notes for this chat.",
  };
}

function noteKey(tab: NotepadTab, context: NotepadContext, state: NotepadState): string {
  return `${tab.id}::${resolveScope(tab, context, state).key}`;
}

function tabRelevant(state: NotepadState, tab: NotepadTab, context: NotepadContext): boolean {
  const chat = context.chat;
  if (tab.scope === "global") return true;
  if (!chat?.id) return false;

  if (tab.scope === "character") {
    const ids = currentCharacterIds(chat);
    if (tab.characterId) return ids.includes(tab.characterId);
    return ids.some((id) => hasNoteForScopeKey(state, tab, `character:${id}`));
  }

  if (tab.branchMode === "family") {
    const currentGroupId = chat.groupId ?? chat.id;
    const currentFamilyKey = chat.groupId ? `chat-family:${chat.groupId}` : null;
    return Boolean(
      (tab.groupId && tab.groupId === currentGroupId) || (currentFamilyKey && hasNoteForScopeKey(state, tab, currentFamilyKey)),
    );
  }

  return Boolean(tab.chatId === chat.id || hasNoteForScopeKey(state, tab, `chat:${chat.id}`) || !tab.chatId);
}

function visibleTabs(state: NotepadState, context: NotepadContext): NotepadTab[] {
  return state.tabs.filter((tab) => tabRelevant(state, tab, context));
}

function ensureContextTargets(state: NotepadState, chat: Chat | null): NotepadState {
  if (!chat?.id) return state;
  let changed = false;
  const ids = currentCharacterIds(chat);
  const tabs = state.tabs.map((tab) => {
    if (tab.scope === "character" && !tab.characterId && ids.length > 0) {
      changed = true;
      return { ...tab, characterId: ids[0], updatedAt: nowIso() };
    }
    if (tab.scope !== "chat") return tab;
    if (tab.branchMode === "family") {
      if (tab.groupId) return tab;
      changed = true;
      return { ...tab, groupId: chat.groupId ?? chat.id, updatedAt: nowIso() };
    }
    if (tab.chatId) return tab;
    changed = true;
    return { ...tab, chatId: chat.id, groupId: chat.groupId ?? null, updatedAt: nowIso() };
  });
  if (!changed) return state;
  return { ...state, tabs };
}

function ensureActiveTab(state: NotepadState, context: NotepadContext): NotepadState {
  const visible = visibleTabs(state, context);
  if (visible.length === 0 || visible.some((tab) => tab.id === state.activeTabId)) return state;
  return { ...state, activeTabId: visible[0].id };
}

function makeBackupPayload(state: NotepadState) {
  return {
    type: "marinara-plugin-notepad-backup",
    version: 1,
    exportedAt: nowIso(),
    pluginId: ME_NOTES_MODULE_ID,
    key: NOTEPAD_MEMORY_KEY,
    data: memoryState(state),
  };
}

function useIsMobileLayout(): boolean {
  const [mobile, setMobile] = useState(() => (hasWindow() ? window.matchMedia("(max-width: 640px)").matches : false));
  useEffect(() => {
    if (!hasWindow()) return undefined;
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return mobile;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return Boolean(target instanceof Element && target.closest("button, input, select, textarea, a"));
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const pattern =
    /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let tokenIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const raw = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index));
    const key = `${keyPrefix}-${tokenIndex++}`;
    if (raw.startsWith("**") && raw.endsWith("**")) {
      nodes.push(<strong key={key}>{renderInlineMarkdown(raw.slice(2, -2), key)}</strong>);
    } else if (raw.startsWith("__") && raw.endsWith("__")) {
      nodes.push(<u key={key}>{renderInlineMarkdown(raw.slice(2, -2), key)}</u>);
    } else if (raw.startsWith("~~") && raw.endsWith("~~")) {
      nodes.push(<s key={key}>{renderInlineMarkdown(raw.slice(2, -2), key)}</s>);
    } else if (raw.startsWith("`") && raw.endsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-[var(--secondary)] px-1 py-0.5 font-mono text-[0.82em]">
          {raw.slice(1, -1)}
        </code>,
      );
    } else if (raw.startsWith("*") && raw.endsWith("*")) {
      nodes.push(<em key={key}>{renderInlineMarkdown(raw.slice(1, -1), key)}</em>);
    } else {
      const link = raw.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      nodes.push(
        link ? (
          <a
            key={key}
            href={link[2]}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--primary)] underline underline-offset-2"
          >
            {link[1]}
          </a>
        ) : (
          raw
        ),
      );
    }
    lastIndex = index + raw.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function MarkdownPreview({ value, onToggleChecklist }: { value: string; onToggleChecklist: (lineIndex: number) => void }) {
  const lines = value.split(/\r?\n/);
  if (!value.trim()) return <p className="text-[var(--muted-foreground)]">Nothing here yet.</p>;

  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        if (!line.trim()) return <div key={index} className="h-1" />;
        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
          const content = renderInlineMarkdown(heading[2], `heading-${index}`);
          if (heading[1].length === 1) {
            return (
              <h3 key={index} className="text-sm font-semibold text-[var(--foreground)]">
                {content}
              </h3>
            );
          }
          if (heading[1].length === 2) {
            return (
              <h4 key={index} className="text-sm font-semibold text-[var(--foreground)]">
                {content}
              </h4>
            );
          }
          return (
            <h5 key={index} className="text-sm font-semibold text-[var(--foreground)]">
              {content}
            </h5>
          );
        }
        const checklist = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/);
        if (checklist) {
          const checked = checklist[1].toLowerCase() === "x";
          return (
            <div key={index} className="flex items-start gap-2">
              <button
                type="button"
                aria-label={checked ? "Mark unchecked" : "Mark checked"}
                title={checked ? "Mark unchecked" : "Mark checked"}
                onClick={() => onToggleChecklist(index)}
                className={cn(
                  "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors",
                  checked
                    ? "border-[var(--primary)] bg-[var(--primary)]/20 text-[var(--primary)]"
                    : "border-[var(--border)] bg-[var(--background)] text-transparent",
                )}
              >
                <CheckSquare size="0.75rem" />
              </button>
              <span className={cn("min-w-0", checked && "text-[var(--muted-foreground)] line-through")}>
                {renderInlineMarkdown(checklist[2], `check-${index}`)}
              </span>
            </div>
          );
        }
        const bullet = line.match(/^\s*[-*]\s+(.+)$/);
        if (bullet) {
          return (
            <div key={index} className="grid grid-cols-[0.9rem_minmax(0,1fr)] gap-1">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--primary)]/80" />
              <span>{renderInlineMarkdown(bullet[1], `bullet-${index}`)}</span>
            </div>
          );
        }
        const quote = line.match(/^\s*>\s+(.+)$/);
        if (quote) {
          return (
            <blockquote key={index} className="border-l border-[var(--primary)]/45 pl-2 text-[var(--muted-foreground)]">
              {renderInlineMarkdown(quote[1], `quote-${index}`)}
            </blockquote>
          );
        }
        return <p key={index}>{renderInlineMarkdown(line, `line-${index}`)}</p>;
      })}
    </div>
  );
}

function ToolbarButton({
  title,
  disabled,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-[1.35rem] min-w-[1.45rem] items-center justify-center rounded-md border border-[var(--border)] bg-[var(--secondary)]/45 px-1 text-[0.625rem] font-black leading-none text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}

export function MeNotepadModule() {
  const activeChatId = useChatStore((state) => state.activeChatId);
  const activeChatFromStore = useChatStore((state) => state.activeChat);
  const chatQuery = useChat(activeChatId);
  const chat = activeChatFromStore?.id === activeChatId ? activeChatFromStore : chatQuery.data ?? null;
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const suppressCollapsedOpenUntilRef = useRef(0);
  const memorySaveTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    saveLayoutState(layoutState(state));
  }, [state.collapsedLayout, state.layout, state.open, state.tabsCollapsed, state.viewMode]);

  const memorySnapshot = useMemo(() => memoryState(state), [state.activeTabId, state.notes, state.tabs]);

  useEffect(() => {
    if (!memoryReady || !hasWindow()) return undefined;
    if (memorySaveTimerRef.current !== null) {
      window.clearTimeout(memorySaveTimerRef.current);
    }
    memorySaveTimerRef.current = window.setTimeout(() => {
      memorySaveTimerRef.current = null;
      void saveMemoryState(memorySnapshot).catch((error) => {
        setStatus({
          message: error instanceof Error ? error.message : "Could not sync notes.",
          tone: "error",
        });
      });
    }, 350);
    return () => {
      if (memorySaveTimerRef.current !== null) {
        window.clearTimeout(memorySaveTimerRef.current);
        memorySaveTimerRef.current = null;
      }
    };
  }, [memoryReady, memorySnapshot]);

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
  const currentNote = activeNoteKey ? state.notes[activeNoteKey] ?? "" : "";
  const pendingDeleteTab = pendingDeleteTabId ? tabs.find((tab) => tab.id === pendingDeleteTabId) ?? null : null;
  const pendingDeleteNoteCount = noteEntryCount(pendingDeleteTab, state);
  const activeNoteEntryCount = noteEntryCount(activeTab, state);
  const rootLayout = state.open ? state.layout : state.collapsedLayout;

  const rootStyle: CSSProperties | undefined = isMobile
    ? undefined
    : {
        left: rootLayout.x,
        top: rootLayout.y,
        right: "auto",
        bottom: "auto",
        width: state.open ? state.layout.width : COLLAPSED_WIDTH,
        height: state.open ? state.layout.height : undefined,
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
        characterId: scope === "character" ? characterId ?? currentCharacterIds(chatTarget)[0] ?? null : null,
        chatId: scope === "chat" && branchMode === "branch" ? chatTarget?.id ?? context.chatId : null,
        groupId:
          scope === "chat"
            ? branchMode === "family"
              ? chatTarget?.groupId ?? chatTarget?.id ?? context.chatId
              : chatTarget?.groupId ?? null
            : null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      setState((current) => ({ ...current, open: true, tabs: [...current.tabs, tab], activeTabId: tab.id }));
      setAddMenuOpen(false);
      setActionsMenuOpen(false);
      setPendingDeleteTabId(null);
      showStatus(`${titleForScope(scope, context, characterId, branchMode)} tab created`, "ok");
    },
    [context, showStatus, state.tabs],
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
    setState((current) => ({
      ...current,
      tabs: current.tabs.map((tab) => (tab.id === renamingTabId ? { ...tab, title, updatedAt: nowIso() } : tab)),
    }));
    setRenamingTabId(null);
    setRenameDraft("");
    if (changed) showStatus("Renamed", "ok");
  }, [activeTab?.title, renameDraft, renamingTabId, showStatus]);

  const deleteTab = useCallback(
    (tabId: string) => {
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
    [context, showStatus],
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
    setState((current) => ({ ...current, ...pendingImportState }));
    setPendingImportState(null);
    showStatus("Backup restored", "ok");
  }, [pendingImportState, showStatus]);

  const handleImportFile = useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const envelope = asRecord(parsed);
      const next = normalizeMemoryState(asRecord(envelope?.data) ?? envelope);
      setPendingImportState(next);
      setActionsMenuOpen(false);
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Backup import failed.", "error");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }, [showStatus]);

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
    [draggedTabId, showStatus],
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
      const startLayout = state[target];
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
          target === "collapsedLayout" ? { ...current, collapsedLayout: nextLayout } : { ...current, layout: nextLayout },
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
    [isMobile, state.collapsedLayout, state.layout],
  );

  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!state.open) return;
      if (startLayoutDrag(event)) event.preventDefault();
    },
    [startLayoutDrag, state.open],
  );

  const startCollapsedDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (state.open) return;
      startLayoutDrag(event, {
        allowInteractiveTarget: true,
        constrain: constrainCollapsedLayout,
        target: "collapsedLayout",
        onMoved: () => {
          suppressCollapsedOpenUntilRef.current = Date.now() + COLLAPSED_OPEN_SUPPRESS_MS;
        },
      });
    },
    [startLayoutDrag, state.open],
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

  if (!activeChatId || !memoryReady) return null;

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
      className={cn(
        "fixed bottom-[4.5rem] right-4 z-[9998] text-[var(--foreground)] max-sm:left-3 max-sm:right-3",
        state.open ? "max-sm:bottom-[4.25rem]" : "max-sm:left-auto",
      )}
      style={rootStyle}
      data-core-module="me-notes"
    >
      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(event) => void handleImportFile(event.target.files?.[0])}
      />

      {!state.open && (
        <button
          type="button"
          onClick={openFromCollapsedLauncher}
          onPointerDown={startCollapsedDrag}
          className="inline-flex min-h-9 w-full min-w-0 cursor-grab items-center justify-center rounded-[0.625rem] border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs shadow-2xl transition-colors hover:bg-[var(--secondary)] active:cursor-grabbing"
          title="Open notes"
          aria-label="Open notes"
        >
          <NotepadBrand />
        </button>
      )}

      {state.open && (
        <section
          aria-label="ME Notes"
          className="relative flex h-full min-h-[22.5rem] w-full flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-[0_1rem_3rem_rgb(0_0_0_/_0.42)] max-sm:max-h-[68vh] max-sm:min-h-0"
          onClickCapture={(event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target?.closest("[data-notepad-menu]")) {
              setAddMenuOpen(false);
              setActionsMenuOpen(false);
            }
          }}
        >
          <header
            className="relative flex shrink-0 cursor-grab items-center gap-1.5 border-b border-[var(--border)] px-2 py-1.5 active:cursor-grabbing"
            style={{
              background:
                "linear-gradient(118deg, color-mix(in srgb, var(--primary) 10%, transparent), transparent 34%), linear-gradient(180deg, color-mix(in srgb, var(--secondary) 54%, var(--card)), var(--card))",
            }}
            onPointerDown={startDrag}
          >
            <button
              type="button"
              aria-label="Minimize notes"
              title="Minimize notes"
              onClick={() => setOpen(false)}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[var(--border)]/80 bg-[var(--secondary)]/35 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
            >
              <Minus size="0.875rem" />
            </button>
            <GripVertical className="shrink-0 text-[var(--muted-foreground)] max-sm:hidden" size="0.875rem" />
            <div className="min-w-0 flex-1">
              <NotepadBrand heading />
            </div>

            <div className="relative" data-notepad-menu>
              <button
                type="button"
                aria-label="Notepad options"
                title="Notepad options"
                onClick={(event) => {
                  event.stopPropagation();
                  setAddMenuOpen(false);
                  setActionsMenuOpen((open) => !open);
                }}
                className="grid h-6 w-6 place-items-center rounded-md border border-[var(--border)]/80 bg-[var(--secondary)]/35 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
              >
                <MoreHorizontal size="0.95rem" />
              </button>
              {actionsMenuOpen && (
                <div className="absolute right-0 top-8 z-10 grid w-40 gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 text-xs shadow-xl">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-left font-semibold hover:bg-[var(--secondary)]"
                    onClick={() => importInputRef.current?.click()}
                  >
                    <FileUp size="0.8125rem" />
                    Import backup
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-left font-semibold hover:bg-[var(--secondary)]"
                    onClick={exportBackup}
                  >
                    <Download size="0.8125rem" />
                    Export backup
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-left font-semibold hover:bg-[var(--secondary)]"
                    onClick={resetLayout}
                  >
                    <RotateCcw size="0.8125rem" />
                    Reset layout
                  </button>
                  <button
                    type="button"
                    disabled={!activeTab}
                    className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-left font-semibold text-[var(--destructive)] hover:bg-[var(--secondary)] disabled:cursor-not-allowed disabled:opacity-45"
                    onClick={() => {
                      setPendingDeleteTabId(activeTab?.id ?? null);
                      setActionsMenuOpen(false);
                    }}
                  >
                    <Trash2 size="0.8125rem" />
                    Delete tab
                  </button>
                </div>
              )}
            </div>

            <div className="relative" data-notepad-menu>
              <button
                type="button"
                aria-label="Add notepad tab"
                title="Add notepad tab"
                onClick={(event) => {
                  event.stopPropagation();
                  setActionsMenuOpen(false);
                  setAddMenuOpen((open) => !open);
                }}
                className="grid h-6 w-6 place-items-center rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm transition-opacity hover:opacity-90"
              >
                <Plus size="1rem" />
              </button>
              {addMenuOpen && (
                <div className="absolute right-0 top-8 z-10 grid w-44 gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 text-xs shadow-xl">
                  <button type="button" className="rounded-md px-2 py-1.5 text-left font-semibold hover:bg-[var(--secondary)]" onClick={() => addTab("global")}>
                    Global
                  </button>
                  {characterIds.length === 0 ? (
                    <button
                      type="button"
                      className="rounded-md px-2 py-1.5 text-left font-semibold hover:bg-[var(--secondary)]"
                      onClick={() => addTab("character")}
                    >
                      Character
                    </button>
                  ) : (
                    characterIds.map((characterId) => (
                      <button
                        key={characterId}
                        type="button"
                        className="truncate rounded-md px-2 py-1.5 text-left font-semibold hover:bg-[var(--secondary)]"
                        onClick={() => addTab("character", "branch", characterId)}
                      >
                        {characterLabel(context, characterId)}
                      </button>
                    ))
                  )}
                  <button
                    type="button"
                    className="rounded-md px-2 py-1.5 text-left font-semibold hover:bg-[var(--secondary)]"
                    onClick={() => addTab("chat", "branch")}
                  >
                    Chat
                  </button>
                  {chat?.groupId && (
                    <button
                      type="button"
                      className="rounded-md px-2 py-1.5 text-left font-semibold hover:bg-[var(--secondary)]"
                      onClick={() => addTab("chat", "family")}
                    >
                      Branch-wide
                    </button>
                  )}
                </div>
              )}
            </div>
          </header>

          <div
            className={cn(
              "relative shrink-0 border-b border-[var(--border)] bg-[var(--secondary)]/25 pr-8",
              state.tabsCollapsed ? "h-8 overflow-hidden px-2 py-1" : "max-h-28 overflow-y-auto px-1.5 py-1.5",
            )}
          >
            <button
              type="button"
              aria-label={state.tabsCollapsed ? "Show tabs" : "Hide tabs"}
              title={state.tabsCollapsed ? "Show tabs" : "Hide tabs"}
              onClick={() => setState((current) => ({ ...current, tabsCollapsed: !current.tabsCollapsed }))}
              className="absolute right-2 top-1.5 grid h-5 w-5 place-items-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
            >
              {state.tabsCollapsed ? <Eye size="0.75rem" /> : <EyeOff size="0.75rem" />}
            </button>
            {state.tabsCollapsed ? (
              <button
                type="button"
                className="h-full w-full text-left text-[0.6875rem] font-semibold text-[var(--muted-foreground)]"
                onClick={() => setState((current) => ({ ...current, tabsCollapsed: false }))}
              >
                {tabs.length} tab{tabs.length === 1 ? "" : "s"}
              </button>
            ) : (
              <div className="grid gap-1">
                {groups.map((group) =>
                  group.tabs.length > 0 ? (
                    <div key={group.scope} className="grid min-h-6 grid-cols-[2rem_minmax(0,1fr)] items-center gap-1">
                      <div className="text-center text-[0.5625rem] font-black text-[var(--muted-foreground)]">
                        {tabRowLabel(group.scope)}
                      </div>
                      <div className="flex min-w-0 gap-1 overflow-x-auto">
                        {group.tabs.map((tab, index) => {
                          const active = tab.id === activeTab?.id;
                          const branchSpecific = tab.scope === "chat" && tab.branchMode === "branch" && Boolean(tab.groupId);
                          const targetLabel = labelForTabTarget(tab, context);
                          const dropBefore = dropTarget?.id === tab.id && dropTarget.position === "before";
                          const dropAfter = dropTarget?.id === tab.id && dropTarget.position === "after";
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              draggable
                              data-active={active}
                              onDragStart={() => setDraggedTabId(tab.id)}
                              onDragEnd={() => {
                                setDraggedTabId(null);
                                setDropTarget(null);
                              }}
                              onDragOver={(event) => {
                                if (!draggedTabId || draggedTabId === tab.id) return;
                                event.preventDefault();
                                const rect = event.currentTarget.getBoundingClientRect();
                                setDropTarget({
                                  id: tab.id,
                                  position: event.clientX < rect.left + rect.width / 2 ? "before" : "after",
                                });
                              }}
                              onDragLeave={(event) => {
                                if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
                                  setDropTarget((current) => (current?.id === tab.id ? null : current));
                                }
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                moveTab(tab.id, dropTarget?.id === tab.id ? dropTarget.position : "before");
                              }}
                              onClick={() => {
                                setState((current) => ({ ...current, activeTabId: tab.id }));
                                setRenamingTabId(null);
                                setPendingDeleteTabId(null);
                                setPendingImportState(null);
                              }}
                              onDoubleClick={(event) => {
                                event.preventDefault();
                                setState((current) => ({ ...current, activeTabId: tab.id }));
                                setRenamingTabId(tab.id);
                                setRenameDraft(tab.title);
                              }}
                              className={cn(
                                "relative inline-flex h-6 max-w-28 shrink-0 items-center gap-1 rounded-full border px-2 text-[0.6875rem] font-semibold transition-colors",
                                active
                                  ? "border-[var(--primary)]/60 bg-[var(--primary)]/15 text-[var(--foreground)]"
                                  : "border-[var(--border)] bg-[var(--secondary)]/55 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                                branchSpecific && "border-b-[var(--primary)]",
                                dropBefore &&
                                  "before:absolute before:-left-1 before:top-1 before:bottom-1 before:w-0.5 before:rounded-full before:bg-[var(--primary)] before:content-['']",
                                dropAfter &&
                                  "after:absolute after:-right-1 after:top-1 after:bottom-1 after:w-0.5 after:rounded-full after:bg-[var(--primary)] after:content-['']",
                              )}
                              title={`${tab.title} / saved for ${targetLabel}`}
                              aria-label={`${tab.title}, saved for ${targetLabel}, tab ${index + 1}`}
                            >
                              <span className={cn("min-w-0 truncate", !active && "w-4 text-center")}>
                                {active ? tab.title : index + 1}
                              </span>
                              {branchSpecific && active ? (
                                <span
                                  aria-hidden="true"
                                  className="rounded-full bg-[var(--primary)]/15 px-1 text-[0.5rem] font-black uppercase text-[var(--primary)]"
                                >
                                  br
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </div>

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

          <div className="flex shrink-0 items-center justify-between gap-1 border-b border-[var(--border)] bg-[var(--card)]/60 px-2 py-1">
            <div className="flex min-w-0 gap-1 overflow-x-auto">
              <ToolbarButton title="Bold selected text" disabled={!canEdit || state.viewMode === "preview"} onClick={() => wrapSelection("**")}>
                <span className="font-black">B</span>
              </ToolbarButton>
              <ToolbarButton
                title="Italicize selected text"
                disabled={!canEdit || state.viewMode === "preview"}
                onClick={() => wrapSelection("*")}
              >
                <span className="font-black italic">I</span>
              </ToolbarButton>
              <ToolbarButton
                title="Underline selected text"
                disabled={!canEdit || state.viewMode === "preview"}
                onClick={() => wrapSelection("__")}
              >
                <span className="font-black underline underline-offset-2">U</span>
              </ToolbarButton>
              <ToolbarButton
                title="Strikethrough selected text"
                disabled={!canEdit || state.viewMode === "preview"}
                onClick={() => wrapSelection("~~")}
              >
                <span className="font-black line-through">S</span>
              </ToolbarButton>
              <ToolbarButton
                title="Add bullet list item"
                disabled={!canEdit || state.viewMode === "preview"}
                onClick={() => prefixLines("- ")}
              >
                <List size="0.75rem" />
              </ToolbarButton>
              <ToolbarButton
                title="Add checklist item"
                disabled={!canEdit || state.viewMode === "preview"}
                onClick={() => prefixLines("- [ ] ")}
              >
                <CheckSquare size="0.75rem" />
              </ToolbarButton>
            </div>
            <button
              type="button"
              aria-label={state.viewMode === "preview" ? "Edit note" : "Preview note"}
              title={state.viewMode === "preview" ? "Edit note" : "Preview note"}
              aria-pressed={state.viewMode === "preview"}
              onClick={() =>
                setState((current) => ({ ...current, viewMode: current.viewMode === "preview" ? "edit" : "preview" }))
              }
              className="grid h-6 w-12 shrink-0 grid-cols-2 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--secondary)]/45 p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)]"
            >
              <span
                className={cn(
                  "grid place-items-center rounded-full transition-colors",
                  state.viewMode === "edit" && "bg-[var(--primary)]/20 text-[var(--foreground)]",
                )}
              >
                <Pencil size="0.7rem" />
              </span>
              <span
                className={cn(
                  "grid place-items-center rounded-full transition-colors",
                  state.viewMode === "preview" && "bg-[var(--primary)]/20 text-[var(--foreground)]",
                )}
              >
                <Eye size="0.7rem" />
              </span>
            </button>
          </div>

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
              className="absolute bottom-1 right-1 h-4 w-4 cursor-nwse-resize opacity-55 before:absolute before:bottom-1 before:right-1 before:h-2.5 before:w-2.5 before:border-b-2 before:border-r-2 before:border-[var(--muted-foreground)] before:content-[''] hover:opacity-90"
            />
          )}

          {status.message ? (
            <div
              className={cn(
                "absolute bottom-4 left-3 right-3 z-10 flex items-center gap-2 rounded-lg border bg-[var(--card)] px-2.5 py-2 text-[0.6875rem] font-semibold shadow-xl",
                statusToneClass(status.tone),
              )}
            >
              <span className="min-w-0 flex-1">{status.message}</span>
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
            </div>
          ) : null}

          {pendingDeleteTab && (
            <div
              className="absolute inset-0 z-20 grid place-items-center bg-[var(--background)]/70 p-3"
              onClick={(event) => {
                if (event.target === event.currentTarget) setPendingDeleteTabId(null);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="me-notes-delete-title"
                aria-describedby="me-notes-delete-message"
                className="w-full max-w-72 rounded-lg border border-[var(--destructive)]/35 bg-[var(--card)] p-3 shadow-xl"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[0.6875rem] font-black uppercase text-[var(--destructive)]">Delete tab</div>
                    <h3 id="me-notes-delete-title" className="mt-1 truncate text-sm font-semibold text-[var(--foreground)]">
                      Delete this tab?
                    </h3>
                  </div>
                  <button
                    type="button"
                    aria-label="Cancel delete"
                    title="Cancel delete"
                    onClick={() => setPendingDeleteTabId(null)}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                  >
                    <X size="0.875rem" />
                  </button>
                </div>
                <p id="me-notes-delete-message" className="mt-2 text-xs leading-snug text-[var(--muted-foreground)]">
                  {pendingDeleteNoteCount > 0
                    ? `This removes "${pendingDeleteTab.title}" and ${pendingDeleteNoteCount} saved note ${
                        pendingDeleteNoteCount === 1 ? "entry" : "entries"
                      }.`
                    : `This removes "${pendingDeleteTab.title}".`}
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingDeleteTabId(null)}
                    className="rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1.5 text-xs font-semibold hover:bg-[var(--accent)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTab(pendingDeleteTab.id)}
                    className="rounded-md bg-[var(--destructive)] px-2.5 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] hover:opacity-90"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {pendingImportState && (
            <div className="absolute inset-0 z-20 grid place-items-center bg-[var(--background)]/70 p-3">
              <div className="w-full max-w-72 rounded-lg border border-[var(--primary)]/35 bg-[var(--card)] p-3 shadow-xl">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[0.6875rem] font-black uppercase text-[var(--primary)]">Restore backup</div>
                    <h3 className="mt-1 text-sm font-semibold text-[var(--foreground)]">Replace current notes?</h3>
                  </div>
                  <button
                    type="button"
                    aria-label="Cancel restore"
                    title="Cancel restore"
                    onClick={() => setPendingImportState(null)}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                  >
                    <X size="0.875rem" />
                  </button>
                </div>
                <p className="mt-2 text-xs leading-snug text-[var(--muted-foreground)]">
                  This restores {pendingImportState.tabs.length} tab
                  {pendingImportState.tabs.length === 1 ? "" : "s"} and replaces current synced notes data.
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingImportState(null)}
                    className="rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1.5 text-xs font-semibold hover:bg-[var(--accent)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={restoreImport}
                    className="rounded-md bg-[var(--primary)] px-2.5 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] hover:opacity-90"
                  >
                    Restore
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
