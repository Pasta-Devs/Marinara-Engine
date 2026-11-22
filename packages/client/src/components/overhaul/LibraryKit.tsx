// ──────────────────────────────────────────────
// UI overhaul: shared Library list tools
//
// The pieces every Library page uses for working with several items at once
// and keeping them tidy, so the new layout has what the classic panels had:
//   • Select: checkboxes, then one bar at the bottom (Move to, Export, Delete…)
//   • "⋯" on each row or card (and right-click / long-press): Duplicate, Move to
//     folder, Export, Delete
//   • Folders: collapsible groups above the loose items, + New folder
//   • My order: drag rows into your own order (no grip handle: the whole row)
// Folder data stays where the classic panels keep it, so both layouts agree.
// ──────────────────────────────────────────────
import { isKeyboardContextMenu } from "../../hooks/use-menu-keyboard";
import { useBackSteps } from "../../hooks/use-back-steps";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type TouchEvent,
} from "react";
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderInput,
  FolderPlus,
  FolderTree,
  ImageOff,
  ImagePlus,
  MoreHorizontal,
  Palette,
  Pencil,
  Pipette,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { ContextMenu, type ContextMenuItem } from "../ui/ContextMenu";
import { useTouchFolderDrag } from "../../hooks/use-touch-folder-drag";
import type { InsertEdge } from "../../lib/library-order";
import { RowActionSheet } from "./RowActionSheet";
import { translate } from "../../localization/i18n";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";
import { useOverhaulMobile, useOverhaulStore } from "../../stores/overhaul.store";
import { confirmNonEmptyFolderDelete, showConfirmDialog, showPromptDialog } from "../../lib/app-dialogs";
import { api } from "../../lib/api-client";
import { EXPORT_FAILED_TOAST_ID } from "../../lib/file-download";
import { toast } from "sonner";
import {
  getNextUnnamedLibraryFolderName,
  useCreateLibraryFolder,
  useDeleteLibraryFolder,
  useLibraryFolders,
  useMoveLibraryItem,
  useUpdateLibraryFolder,
  type LibraryFolderScope,
} from "../../hooks/use-library-folders";
import {
  useCharacterGroups,
  useCreateGroup,
  useCreatePersonaGroup,
  useDeleteGroup,
  useDeletePersonaGroup,
  usePersonaGroups,
  useUpdateGroup,
  useUpdatePersonaGroup,
} from "../../hooks/use-characters";
import { useTranslation as useUiTranslation } from "react-i18next";

// ── Actions ──

export type KitAction = {
  key: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  /** Opens a second list in the same place (Move to folder). */
  submenu?: KitAction[];
  onSelect?: () => void;
};

function isTouchScreen() {
  return typeof window !== "undefined" && window.matchMedia?.("(hover: none) and (any-pointer: coarse)").matches;
}

/**
 * One open menu at a time for a page: the "⋯" buttons, right-click and long-press all open it.
 * Touch screens get the bottom action sheet, pointers a small menu by the button.
 */
export function useKitMenu() {
  const localize = useLocalizedUiText();
  const [menu, setMenu] = useState<{
    title: string;
    actions: KitAction[];
    x: number;
    y: number;
    keyboard?: boolean;
  } | null>(null);
  const open = useCallback((title: string, actions: KitAction[], at: { x: number; y: number }, keyboard = false) => {
    if (actions.length) setMenu({ title, actions, x: at.x, y: at.y, keyboard });
  }, []);
  const openFromEvent = useCallback(
    (event: MouseEvent<HTMLElement>, title: string, actions: KitAction[], anchor: "pointer" | "button" = "pointer") => {
      event.preventDefault();
      event.stopPropagation();
      // A11Y3: opened from the keyboard (Enter on ⋯, Shift+F10 or the menu key on a row), focus starts on the
      // first item and comes back when the menu closes.
      const keyboard = event.type === "contextmenu" ? isKeyboardContextMenu(event) : event.detail === 0;
      if (anchor === "button" || keyboard) {
        const rect = event.currentTarget.getBoundingClientRect();
        open(
          title,
          actions,
          anchor === "button" ? { x: rect.right - 200, y: rect.bottom + 4 } : { x: rect.left + 16, y: rect.bottom },
          keyboard,
        );
      } else open(title, actions, { x: event.clientX, y: event.clientY });
    },
    [open],
  );
  const close = useCallback(() => setMenu(null), []);
  const pick = useCallback((action: KitAction) => {
    if (action.submenu) {
      // The menu closes itself after a pick; reopen in the same place with the submenu.
      setMenu((current) => {
        if (current) {
          const next = { ...current, title: action.label, actions: action.submenu! };
          window.setTimeout(() => setMenu(next), 0);
        }
        return current;
      });
      return;
    }
    setMenu(null);
    action.onSelect?.();
  }, []);
  const node = menu ? (
    isTouchScreen() ? (
      <RowActionSheet
        title={menu.title}
        onClose={close}
        actions={menu.actions
          .filter((action) => !action.disabled)
          .map((action) => ({
            key: action.key,
            label: localize(action.label),
            icon: action.icon ?? null,
            tone: action.danger ? "danger" : undefined,
            // The sheet closes itself first; a submenu reopens with the folder list.
            onSelect: () =>
              action.submenu
                ? window.setTimeout(() => setMenu({ ...menu, title: action.label, actions: action.submenu! }), 0)
                : action.onSelect?.(),
          }))}
      />
    ) : (
      <ContextMenu
        key={menu.title}
        x={menu.x}
        y={menu.y}
        autoFocus={menu.keyboard}
        onClose={close}
        items={menu.actions.map((action): ContextMenuItem => ({
          label: action.submenu ? `${localize(action.label)} ›` : localize(action.label),
          icon: action.icon,
          disabled: action.disabled,
          destructive: action.danger,
          onSelect: () => pick(action),
        }))}
      />
    )
  ) : null;
  return { open, openFromEvent, close, node };
}

/** The "⋯" button at the end of a row or on a card. */
export function KitMoreButton({
  label,
  onOpen,
  className,
}: {
  label: string;
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn("ov-kit-more", className)}
      aria-label={label}
      title={label}
      aria-haspopup="menu"
      onClick={(event) => {
        event.stopPropagation();
        onOpen(event);
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
    >
      <MoreHorizontal size={15} aria-hidden="true" />
    </button>
  );
}

// ── Selection ──

export function useKitSelection(visibleIds: string[]) {
  const [on, setOn] = useState(false);
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const start = useCallback((first?: string) => {
    setOn(true);
    setIds(first ? new Set([first]) : new Set());
  }, []);
  const stop = useCallback(() => {
    setOn(false);
    setIds(new Set());
  }, []);
  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => ids.has(id));
  const toggleAll = useCallback(() => {
    setIds(allSelected ? new Set() : new Set(visibleIds));
  }, [allSelected, visibleIds]);
  // Escape leaves selection, like the chat list.
  useEffect(() => {
    if (!on) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !document.querySelector('[role="dialog"]')) stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on, stop]);
  return {
    on,
    ids,
    list: [...ids],
    count: ids.size,
    has: (id: string) => ids.has(id),
    start,
    stop,
    toggle,
    set: setIds,
    allSelected,
    toggleAll,
  };
}
export type KitSelection = ReturnType<typeof useKitSelection>;

export function KitCheck({ checked, label }: { checked: boolean; label: string }) {
  return (
    <span className={cn("ov-kit-check", checked && "is-on")} role="checkbox" aria-checked={checked} aria-label={label}>
      {checked ? <CheckSquare size={16} aria-hidden="true" /> : <Square size={16} aria-hidden="true" />}
    </span>
  );
}

/** Toolbar button that turns selection on and off. */
export function KitSelectButton({ selection }: { selection: KitSelection }) {
  const localize = useLocalizedUiText();
  return (
    <button
      type="button"
      className={cn("ov-btn ov-btn--icon", selection.on && "is-on")}
      aria-pressed={selection.on}
      aria-label={localize("Select")}
      title={localize("Select")}
      onClick={() => (selection.on ? selection.stop() : selection.start())}
    >
      <CheckSquare size={15} aria-hidden="true" />
    </button>
  );
}

/**
 * One empty state for every Library page (audit C17): a dashed box with an icon, a short title, one
 * line that says what to do (never a copy of the page description) and, when there is one, the next step.
 */
export function KitEmpty({
  icon,
  title,
  text,
  action,
}: {
  icon?: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ov-list__empty ov-kit-empty">
      {icon ? <span className="ov-kit-empty__icon">{icon}</span> : null}
      <p className="ov-kit-empty__title">{title}</p>
      {text ? <p className="ov-kit-empty__text">{text}</p> : null}
      {action}
    </div>
  );
}

/** The bar at the bottom while selecting: count, Select all, the page's actions, Done. */
export function KitBulkBar({ selection, actions }: { selection: KitSelection; actions: KitAction[] }) {
  const localize = useLocalizedUiText();
  const menu = useKitMenu();
  if (!selection.on) return null;
  return (
    <div className="ov-kit-bulk" role="toolbar" aria-label={localize("Selected items")}>
      <span className="ov-kit-bulk__count">
        {selection.count} {localize("selected")}
      </span>
      <button type="button" className="ov-btn" onClick={selection.toggleAll}>
        {localize(selection.allSelected ? "Select none" : "Select all")}
      </button>
      <span className="ov-kit-bulk__spacer" />
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          className={cn("ov-btn", action.danger && "ov-btn--danger")}
          disabled={selection.count === 0 || action.disabled}
          onClick={(event) =>
            action.submenu
              ? menu.openFromEvent(event, localize(action.label), action.submenu, "button")
              : action.onSelect?.()
          }
        >
          {action.icon}
          <span className="ov-kit-bulk__label">{localize(action.label)}</span>
        </button>
      ))}
      <button
        type="button"
        className="ov-btn ov-btn--icon"
        aria-label={localize("Done")}
        title={localize("Done")}
        onClick={selection.stop}
      >
        <X size={15} aria-hidden="true" />
      </button>
      {menu.node}
    </div>
  );
}

// ── Folders ──

/** `virtual`: a folder the app makes on its own (a preset's regex scripts); nothing can be dropped or filed into it. */
export type KitFolder = {
  id: string;
  name: string;
  itemIds: string[];
  collapsed?: boolean;
  virtual?: boolean;
  paused?: boolean;
  /** The folder icon's colour ("#rrggbb"); null/undefined = the theme's accent. */
  color?: string | null;
  /** A small picture (data URL) on the folder icon's front. */
  cover?: string | null;
};

export type KitFolderLook = { color?: string | null; cover?: string | null };

export type KitFolders = {
  folders: KitFolder[];
  create: () => void;
  rename: (folder: KitFolder) => void;
  remove: (folder: KitFolder) => void;
  move: (itemIds: string[], folderId: string | null) => void;
  isCollapsed: (folder: KitFolder) => boolean;
  toggleCollapsed: (folder: KitFolder) => void;
  folderOf: (itemId: string) => string | null;
  /** Colour and front picture of the folder icon (folders that store them). */
  setLook?: (folder: KitFolder, look: KitFolderLook) => void;
};

export function useLocalCollapsed(key: string) {
  const storageKey = `marinara-ov-folders-collapsed:${key}`;
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });
  const toggle = useCallback(
    (id: string) => {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        try {
          window.localStorage.setItem(storageKey, JSON.stringify([...next]));
        } catch {
          /* private mode */
        }
        return next;
      });
    },
    [storageKey],
  );
  return { collapsed, toggle };
}

function useFolderBasics(folders: KitFolder[], kindLabel: string) {
  const localize = useLocalizedUiText();
  const folderOfMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const folder of folders) for (const id of folder.itemIds) if (!map.has(id)) map.set(id, folder.id);
    return map;
  }, [folders]);
  const askName = useCallback(
    async (current: string) => {
      const name = await showPromptDialog({
        title: localize("Rename folder"),
        message: localize("Folder name"),
        defaultValue: current,
        confirmLabel: localize("Rename"),
      });
      return name?.trim() || null;
    },
    [localize],
  );
  const confirmDelete = useCallback(
    (folder: KitFolder) =>
      confirmNonEmptyFolderDelete(folder.itemIds.length, {
        title: localize("Delete folder"),
        message: `${localize("Delete")} "${folder.name}"? ${folder.itemIds.length} ${kindLabel} ${localize(
          "stay in the library and move out of the folder.",
        )}`,
        confirmLabel: localize("Delete"),
        tone: "destructive",
      }),
    [kindLabel, localize],
  );
  return { folderOf: (id: string) => folderOfMap.get(id) ?? null, askName, confirmDelete };
}

/** Folders for Lorebooks, Presets and Agents (the shared library folder store). */
export function useScopeFolders(scope: LibraryFolderScope, kindLabel: string): KitFolders {
  const { data } = useLibraryFolders(scope);
  const create = useCreateLibraryFolder(scope);
  const update = useUpdateLibraryFolder(scope);
  const remove = useDeleteLibraryFolder(scope);
  const move = useMoveLibraryItem(scope);
  const folders = useMemo(
    () =>
      (data ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        itemIds: f.itemIds,
        collapsed: f.collapsed,
        paused: f.paused,
        color: f.color ?? null,
        cover: f.cover ?? null,
      })),
    [data],
  );
  const basics = useFolderBasics(folders, kindLabel);
  return {
    folders,
    folderOf: basics.folderOf,
    create: () => create.mutate({ name: getNextUnnamedLibraryFolderName(folders) }),
    rename: (folder) => void basics.askName(folder.name).then((name) => name && update.mutate({ id: folder.id, name })),
    remove: (folder) => void basics.confirmDelete(folder).then((ok) => ok && remove.mutate(folder.id)),
    move: (itemIds, folderId) => move.mutate({ itemIds, folderId }),
    isCollapsed: (folder) => !!folder.collapsed,
    toggleCollapsed: (folder) => update.mutate({ id: folder.id, collapsed: !folder.collapsed }),
    setLook: (folder, look) => update.mutate({ id: folder.id, ...look }),
  };
}

type GroupRow = {
  id: string;
  name: string;
  characterIds?: string;
  personaIds?: string;
  color?: string | null;
  cover?: string | null;
};

function parseIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((id): id is string => typeof id === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Folders for Characters (character groups) or Personas (persona groups), as the classic panels keep them. */
export function useCardFolders(kind: "characters" | "personas", kindLabel: string): KitFolders {
  const characterGroups = useCharacterGroups();
  const personaGroups = usePersonaGroups();
  const createCharacterGroup = useCreateGroup();
  const updateCharacterGroup = useUpdateGroup();
  const deleteCharacterGroup = useDeleteGroup();
  const createPersonaGroup = useCreatePersonaGroup();
  const updatePersonaGroup = useUpdatePersonaGroup();
  const deletePersonaGroup = useDeletePersonaGroup();
  const isCharacters = kind === "characters";
  const raw = ((isCharacters ? characterGroups.data : personaGroups.data) ?? []) as GroupRow[];
  const folders = useMemo(
    () =>
      raw
        .map((g) => ({
          id: g.id,
          name: g.name,
          itemIds: parseIds(isCharacters ? g.characterIds : g.personaIds),
          color: g.color ?? null,
          cover: g.cover ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [isCharacters, raw],
  );
  const basics = useFolderBasics(folders, kindLabel);
  const local = useLocalCollapsed(kind);
  const setMembers = (id: string, ids: string[]) =>
    isCharacters
      ? updateCharacterGroup.mutateAsync({ id, characterIds: ids })
      : updatePersonaGroup.mutateAsync({ id, personaIds: ids });
  return {
    folders,
    folderOf: basics.folderOf,
    create: () => {
      const name = getNextUnnamedLibraryFolderName(folders);
      if (isCharacters) createCharacterGroup.mutate({ name, characterIds: [] });
      else createPersonaGroup.mutate({ name, personaIds: [] });
    },
    rename: (folder) =>
      void basics.askName(folder.name).then((name) => {
        if (!name) return;
        if (isCharacters) updateCharacterGroup.mutate({ id: folder.id, name });
        else updatePersonaGroup.mutate({ id: folder.id, name });
      }),
    remove: (folder) =>
      void basics.confirmDelete(folder).then((ok) => {
        if (!ok) return;
        if (isCharacters) deleteCharacterGroup.mutate(folder.id);
        else deletePersonaGroup.mutate(folder.id);
      }),
    move: (itemIds, folderId) => {
      const moving = new Set(itemIds);
      const updates = folders.flatMap((folder) => {
        const kept = folder.itemIds.filter((id) => !moving.has(id));
        const next = folder.id === folderId ? [...kept, ...itemIds] : kept;
        const same = next.length === folder.itemIds.length && next.every((id, i) => id === folder.itemIds[i]);
        return same ? [] : [setMembers(folder.id, next)];
      });
      void Promise.all(updates);
    },
    isCollapsed: (folder) => local.collapsed.has(folder.id),
    toggleCollapsed: (folder) => local.toggle(folder.id),
    setLook: (folder, look) =>
      isCharacters
        ? updateCharacterGroup.mutate({ id: folder.id, ...look })
        : updatePersonaGroup.mutate({ id: folder.id, ...look }),
  };
}

/** "Move to folder" as a submenu: each folder, No folder, and New folder. */
export function moveToFolderAction(folders: KitFolders, itemIds: () => string[], current: string | null): KitAction {
  return {
    key: "move",
    label: "Move to folder",
    icon: <FolderInput size={14} aria-hidden="true" />,
    submenu: [
      ...folders.folders
        .filter((folder) => !folder.virtual)
        .map((folder) => ({
          key: `f:${folder.id}`,
          label: folder.name,
          icon: <Folder size={14} aria-hidden="true" />,
          disabled: folder.id === current,
          onSelect: () => folders.move(itemIds(), folder.id),
        })),
      { key: "root", label: "No folder", disabled: current === null, onSelect: () => folders.move(itemIds(), null) },
    ],
  };
}

/** Colours offered for a folder icon (the first entry puts back the theme's own). */
export const FOLDER_COLORS: { key: string; label: string; value: string | null }[] = [
  { key: "theme", label: "Theme color", value: null },
  { key: "blue", label: "Blue", value: "#3b82f6" },
  { key: "teal", label: "Teal", value: "#14b8a6" },
  { key: "green", label: "Green", value: "#22c55e" },
  { key: "yellow", label: "Yellow", value: "#eab308" },
  { key: "orange", label: "Orange", value: "#f97316" },
  { key: "red", label: "Red", value: "#ef4444" },
  { key: "pink", label: "Pink", value: "#ec4899" },
  { key: "purple", label: "Purple", value: "#8b5cf6" },
  { key: "grey", label: "Gray", value: "#78716c" },
];

/** Opens the system colour picker and resolves with the picked "#rrggbb" (null if closed unchanged). */
function pickCustomColor(current: string | null | undefined): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "color";
    input.value = current ?? "#3b82f6";
    input.style.cssText = "position:fixed;left:50%;top:50%;width:1px;height:1px;opacity:0;pointer-events:none";
    document.body.appendChild(input);
    const done = (value: string | null) => {
      input.remove();
      resolve(value);
    };
    input.addEventListener("change", () => done(/^#[0-9a-f]{6}$/i.test(input.value) ? input.value : null), {
      once: true,
    });
    input.addEventListener("cancel", () => done(null), { once: true });
    input.click();
  });
}

/** Asks for a picture and shrinks it to a small front-of-folder image (5:3, centre-cropped, WebP or JPEG). */
export function pickFolderPicture(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
          const width = 300;
          const height = 180;
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          if (!context) {
            URL.revokeObjectURL(url);
            return resolve(null);
          }
          const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
          const drawWidth = image.naturalWidth * scale;
          const drawHeight = image.naturalHeight * scale;
          context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
          URL.revokeObjectURL(url);
          const webp = canvas.toDataURL("image/webp", 0.85);
          resolve(webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85));
        };
        image.onerror = () => {
          URL.revokeObjectURL(url);
          toast.error(translate("ui.overhaul.kit.pictureUnreadable"));
          resolve(null);
        };
        image.src = url;
      },
      { once: true },
    );
    input.click();
  });
}

/** Colour and Picture entries for a folder's menu, when its folders store a look. */
function folderLookActions(folders: KitFolders, folder: KitFolder): KitAction[] {
  const setLook = folders.setLook;
  if (!setLook || folder.virtual) return [];
  return [
    {
      key: "color",
      label: "Color",
      icon: <Palette size={14} aria-hidden="true" />,
      submenu: [
        ...FOLDER_COLORS.map((color) => ({
          key: `c:${color.key}`,
          label: color.label,
          icon: (
            <span
              className={cn("ov-kit-swatch", !color.value && "is-theme")}
              style={color.value ? { background: color.value } : undefined}
              aria-hidden="true"
            />
          ),
          disabled: (folder.color ?? null) === color.value,
          onSelect: () => setLook(folder, { color: color.value }),
        })),
        {
          key: "c:custom",
          label: "Custom color…",
          icon: <Pipette size={14} aria-hidden="true" />,
          onSelect: () =>
            void pickCustomColor(folder.color).then((value) => value && setLook(folder, { color: value })),
        },
      ],
    },
    {
      key: "picture",
      label: folder.cover ? "Change picture…" : "Add picture…",
      icon: <ImagePlus size={14} aria-hidden="true" />,
      onSelect: () => void pickFolderPicture().then((cover) => cover && setLook(folder, { cover })),
    },
    ...(folder.cover
      ? [
          {
            key: "picture-remove",
            label: "Remove picture",
            icon: <ImageOff size={14} aria-hidden="true" />,
            onSelect: () => setLook(folder, { cover: null }),
          },
        ]
      : []),
  ];
}

export function folderActions(folders: KitFolders, folder: KitFolder): KitAction[] {
  return [
    {
      key: "rename",
      label: "Rename",
      icon: <Pencil size={14} aria-hidden="true" />,
      onSelect: () => folders.rename(folder),
    },
    ...folderLookActions(folders, folder),
    {
      key: "delete",
      label: "Delete folder",
      icon: <Trash2 size={14} aria-hidden="true" />,
      danger: true,
      onSelect: () => folders.remove(folder),
    },
  ];
}

export function KitNewFolderButton({ folders, onCreate }: { folders: KitFolders; onCreate?: () => void }) {
  const localize = useLocalizedUiText();
  return (
    <button
      type="button"
      className="ov-btn ov-btn--icon"
      aria-label={localize("New folder")}
      title={localize("New folder")}
      onClick={() => {
        onCreate?.();
        folders.create();
      }}
    >
      <FolderPlus size={15} aria-hidden="true" />
    </button>
  );
}

/**
 * Folders or everything together, per Library page and remembered on this device: with folders off, the page
 * lists every item in one run, so a sort such as Newest reaches across folders.
 */
export function useLibraryFolderView(page: string) {
  const flat = useOverhaulStore((state) => state.libraryFlatPages.includes(page));
  const setFlat = useOverhaulStore((state) => state.setLibraryFlat);
  return { flat, setFlat: (next: boolean) => setFlat(page, next) };
}

/** The "Folders" switch on a Library page's toolbar; only shown while the page has folders. */
export function KitFolderViewToggle({
  folders,
  view,
}: {
  folders: KitFolders | null | undefined;
  view: ReturnType<typeof useLibraryFolderView>;
}) {
  const localize = useLocalizedUiText();
  const mobile = useOverhaulMobile();
  if (!folders || !folders.folders.some((folder) => !folder.virtual)) return null;
  const on = !view.flat;
  const title = localize(on ? "Showing folders. Turn off to list everything together" : "Show folders");
  return (
    <button
      type="button"
      className={cn("ov-btn ov-kit-folderview", on && "is-on", mobile && "ov-btn--icon")}
      aria-pressed={on}
      aria-label={localize("Folders")}
      title={title}
      data-folder-view={on ? "folders" : "all"}
      onClick={() => view.setFlat(on)}
    >
      <FolderTree size={14} aria-hidden="true" />
      {mobile ? null : localize("Folders")}
    </button>
  );
}

/** A small folder mark in the folder's colour (the theme's accent unless picked), for rows, lines and badges. */
export function KitFolderIcon({ folder }: { folder: KitFolder }) {
  return (
    <svg
      className="ov-folder-icon"
      viewBox="0 0 64 52"
      aria-hidden="true"
      style={folder.color ? ({ "--ov-folder-color": folder.color } as CSSProperties) : undefined}
    >
      <path
        className="ov-folder-icon__back"
        d="M3 7.5A4.5 4.5 0 0 1 7.5 3h14.2a3 3 0 0 1 2.1.9L28 8h28.5A4.5 4.5 0 0 1 61 12.5v34a4.5 4.5 0 0 1-4.5 4.5h-49A4.5 4.5 0 0 1 3 46.5z"
      />
      <path
        className="ov-folder-icon__front"
        d="M1.5 18.5A4.5 4.5 0 0 1 6 14h52a4.5 4.5 0 0 1 4.5 4.5v28A4.5 4.5 0 0 1 58 51H6a4.5 4.5 0 0 1-4.5-4.5z"
      />
      <path className="ov-folder-icon__shine" d="M6 15.5h52" />
    </svg>
  );
}

/**
 * The Folders view's folder: the same size and box as the cards beside it, with a folder tab on top in
 * the folder's colour. The folder's picture fills the box, or else up to four of the things inside peek
 * through. The colour also runs along the top edge and tints the folder mark in the count badge.
 */
export function KitFolderTile({
  folder,
  count,
  dragKind,
  previews,
  onOpen,
  onMenu,
}: {
  folder: KitFolder;
  count: number;
  dragKind?: string;
  /** Up to four of the folder's members, drawn as a 2 × 2 peek when the folder has no picture. */
  previews?: ReactNode[];
  onOpen: () => void;
  onMenu: (event: MouseEvent<HTMLElement>, anchor: "pointer" | "button") => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  const peek = (previews ?? []).slice(0, 4);
  // The coloured edge sits outside the box (themes may tint card art, e.g. Gutterlight's ink print, and the
  // folder colour should stay true), so it copies the box's top-right corner to follow its curve.
  const boxRef = useRef<HTMLSpanElement>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = boxRef.current;
    const tile = tileRef.current;
    if (!box || !tile) return;
    tile.style.setProperty("--ov-folder-r", getComputedStyle(box).borderTopRightRadius);
    // The ⋯ button goes just under the colour strip, wherever a theme puts it on the card.
    const more = tile.querySelector<HTMLElement>(".ov-card__more");
    if (!more) return;
    more.style.marginTop = "0px";
    const gap = box.getBoundingClientRect().top + 9 - more.getBoundingClientRect().top;
    more.style.marginTop = `${Math.max(0, Math.round(gap))}px`;
  });
  return (
    <div
      ref={tileRef}
      className="ov-card ov-folder-tile"
      data-component="FolderTile"
      style={folder.color ? ({ "--ov-folder-color": folder.color } as CSSProperties) : undefined}
      {...(folder.virtual
        ? {}
        : {
            "data-ov-folder-id": folder.id,
            ...(dragKind ? { [`data-${dragKind}-folder-id`]: folder.id } : {}),
          })}
      onContextMenu={(event) => onMenu(event, "pointer")}
    >
      <button
        type="button"
        className="ov-folder-tile__art"
        aria-label={localizeUi("ui.overhaul.kit.openFolder", { name: folder.name })}
        onClick={onOpen}
      >
        <span className="ov-folder-tile__tab" aria-hidden="true" />
        <span ref={boxRef} className="ov-card__art ov-folder-tile__box">
          {folder.cover ? (
            <img className="ov-folder-tile__cover" src={folder.cover} alt="" draggable={false} />
          ) : peek.length ? (
            <span className="ov-folder-tile__peek" data-count={peek.length} aria-hidden="true">
              {peek.map((node, index) => (
                <span key={index} className="ov-folder-tile__peek-cell">
                  {node}
                </span>
              ))}
            </span>
          ) : (
            <span className="ov-folder-tile__empty" aria-hidden="true">
              <KitFolderIcon folder={folder} />
            </span>
          )}
          <span className="ov-folder-tile__badge" aria-hidden="true">
            <KitFolderIcon folder={folder} />
            {count}
          </span>
        </span>
        <span className="ov-folder-tile__edge" aria-hidden="true" />
      </button>
      <KitMoreButton
        className="ov-card__more"
        label={localize("Folder actions")}
        onOpen={(event) => onMenu(event, "button")}
      />
      <button type="button" className="ov-card__name" onClick={onOpen}>
        {folder.name}
      </button>
      <p className="ov-card__tags">{localizeUi("ui.overhaul.kit.itemCount", { count })}</p>
    </div>
  );
}

/** A folder's heading: arrow, name and count. Dropping a dragged row on it files the row there. */
export function KitFolderHead({
  folder,
  count,
  collapsed,
  onToggle,
  onMenu,
  dragKind,
  note,
  trail,
  icon,
  mode = "toggle",
}: {
  /** Replaces the folder icon (Regex scripts: a preset's own folder shows the preset icon). */
  icon?: ReactNode;
  dragKind?: string;
  folder: KitFolder;
  count: number;
  /** Shown instead of the count, such as "3/12 on". */
  note?: string;
  /** A control before the ⋯ button, such as the folder's on/off switch. */
  trail?: ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  onMenu: (event: MouseEvent<HTMLElement>, anchor: "pointer" | "button") => void;
  /** "open": the Folders view, where a click opens the folder on its own page instead of expanding it. */
  mode?: "toggle" | "open";
}) {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  const opens = mode === "open";
  return (
    <div
      className={cn("ov-kit-folder", opens && "ov-kit-folder--opens")}
      {...(folder.virtual
        ? {}
        : {
            "data-ov-folder-id": folder.id,
            ...(dragKind ? { [`data-${dragKind}-folder-id`]: folder.id } : {}),
          })}
      role="button"
      tabIndex={0}
      aria-expanded={opens ? undefined : !collapsed}
      aria-label={opens ? localizeUi("ui.overhaul.kit.openFolder", { name: folder.name }) : undefined}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
      onContextMenu={(event) => onMenu(event, "pointer")}
    >
      {opens ? null : (
        <ChevronRight size={14} className={cn("ov-kit-folder__arrow", !collapsed && "is-open")} aria-hidden="true" />
      )}
      {icon ?? <KitFolderIcon folder={folder} />}
      <span className="ov-kit-folder__name">{folder.name}</span>
      <span className="ov-kit-folder__count">{note ?? count}</span>
      {trail ? (
        <span
          className="ov-kit-folder__trail"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {trail}
        </span>
      ) : null}
      <KitMoreButton label={localize("Folder actions")} onOpen={(event) => onMenu(event, "button")} />
      {opens ? <ChevronRight size={14} className="ov-kit-folder__arrow" aria-hidden="true" /> : null}
    </div>
  );
}

/**
 * The Folders view works like a file browser: the page lists its folders (closed) and the items in no folder;
 * opening a folder shows its items alone, under a "back" line. Not remembered: the page opens on the list.
 */
export function useOpenFolder(folders: KitFolders | null | undefined) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? (folders?.folders.find((folder) => folder.id === openId) ?? null) : null;
  // Back (mouse, browser, swipe) closes the open folder, like its back line.
  useBackSteps(open ? 1 : 0, () => setOpenId(null));
  return {
    open,
    openFolder: (folder: KitFolder) => setOpenId(folder.id),
    close: () => setOpenId(null),
  };
}

/** The open folder's line: back to every folder, then the folder's name, count and actions. */
export function KitFolderCrumb({
  backLabel,
  folder,
  count,
  onBack,
  onMenu,
}: {
  backLabel: string;
  folder: KitFolder;
  count: number;
  onBack: () => void;
  onMenu: (event: MouseEvent<HTMLElement>, anchor: "pointer" | "button") => void;
}) {
  const localize = useLocalizedUiText();
  return (
    <div className="ov-kit-crumb" data-component="FolderCrumb" onContextMenu={(event) => onMenu(event, "pointer")}>
      <button type="button" className="ov-kit-crumb__back" onClick={onBack}>
        <ChevronLeft size={15} aria-hidden="true" />
        {backLabel}
      </button>
      <ChevronRight size={13} className="ov-kit-crumb__sep" aria-hidden="true" />
      <KitFolderIcon folder={folder} />
      <span className="ov-kit-folder__name">{folder.name}</span>
      <span className="ov-kit-folder__count">{count}</span>
      <KitMoreButton label={localize("Folder actions")} onOpen={(event) => onMenu(event, "button")} />
    </div>
  );
}

/** Splits rows into folders (in folder order) and the loose rows after them. */
export function groupByFolder<T extends { id: string }>(rows: T[], folders: KitFolders | null, filtering: boolean) {
  if (!folders || folders.folders.length === 0)
    return { groups: [] as { folder: KitFolder; rows: T[] }[], loose: rows };
  const byId = new Map(rows.map((row) => [row.id, row]));
  const used = new Set<string>();
  const rank = new Map(rows.map((row, index) => [row.id, index]));
  const groups = folders.folders
    .map((folder) => {
      const members = folder.itemIds.map((id) => byId.get(id)).filter((row): row is T => !!row && !used.has(row.id));
      members.forEach((row) => used.add(row.id));
      // Inside a folder, rows keep the page's sort.
      members.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
      return { folder, rows: members };
    })
    // While searching or filtering, folders with nothing to show step aside.
    .filter((group) => !filtering || group.rows.length > 0);
  return { groups, loose: rows.filter((row) => !used.has(row.id)) };
}

/** Keeps a click that ends a drag from also opening the row. */
export function useSuppressClick() {
  const ref = useRef(false);
  return {
    arm: () => {
      ref.current = true;
    },
    release: () => window.setTimeout(() => (ref.current = false), 0),
    blocked: () => ref.current,
  };
}

// ── Dragging rows: My order, and into folders ──

/**
 * Press and drag a row (no grip handle): drop it between rows to put it in your own order,
 * or on a folder to file it. Touch screens pick the row up after a short hold; holding
 * still and lifting opens the row's actions instead.
 */
export function useKitRowDrag({
  kind,
  reorder,
  folders,
  selection,
  suppress,
  onHold,
}: {
  kind: string;
  reorder?: (ids: string[], target: string, edge: InsertEdge, visibleIds: string[]) => void;
  folders?: KitFolders | null;
  selection: KitSelection;
  suppress: ReturnType<typeof useSuppressClick>;
  onHold?: (id: string) => void;
}) {
  const { startTouchDrag } = useTouchFolderDrag({
    getDragIds: (id) => (selection.on && selection.has(id) ? selection.list : [id]),
    onReorder: reorder,
    onActivate: () => suppress.arm(),
    onDrop: (id, x, y, ids) => {
      const dragged = ids.length ? ids : [id];
      if (folders) {
        const hit = document.elementFromPoint(x, y);
        const folderEl = hit?.closest<HTMLElement>("[data-ov-folder-id]");
        const target = folderEl?.dataset.ovFolderId ?? (hit?.closest(`[data-drag-kind="${kind}"]`) ? null : undefined);
        if (target !== undefined) {
          const moving = dragged.filter((itemId) => folders.folderOf(itemId) !== target);
          if (moving.length) folders.move(moving, target);
        }
      }
      suppress.release();
    },
    onCancel: () => suppress.release(),
    onHoldRelease: onHold,
  });
  return (id: string, folderId: string | null) => ({
    "data-drag-id": id,
    "data-drag-kind": kind,
    ...(folderId ? { "data-ov-folder-id": folderId, [`data-${kind}-folder-id`]: folderId } : {}),
    onMouseDown: (event: MouseEvent<HTMLElement>) => startTouchDrag(event, id),
    onTouchStart: (event: TouchEvent<HTMLElement>) => startTouchDrag(event, id),
  });
}

// ── Export and delete helpers ──

/** Download one or many items as Marinara files (a .zip when there are several). */
export async function kitExport(
  path: string,
  ids: string[],
  filename: string,
  localize: (text: string) => string,
  body: Record<string, unknown> = { format: "native" },
) {
  if (!ids.length) return;
  try {
    const status = await api.downloadPost(path, { ids, ...body }, filename);
    if (status === "saved") toast.success(translate("ui.overhaul.text.exportedNumber", { number: ids.length }));
  } catch (error) {
    toast.error(error instanceof Error ? error.message : localize("Export failed"), { id: EXPORT_FAILED_TOAST_ID });
  }
}

/** Ask once, delete each, and report what failed. Resolves to the ids that could not be deleted. */
export async function kitDelete(
  ids: string[],
  remove: (id: string) => Promise<unknown>,
  { noun, localize, names }: { noun: string; localize: (text: string) => string; names?: string },
): Promise<string[] | null> {
  if (!ids.length) return null;
  const ok = await showConfirmDialog({
    title: translate("ui.overhaul.text.deleteNameQuestion", { name: names ?? `${ids.length} ${noun}` }),
    message: localize(
      ids.length === 1
        ? "This can't be undone. Export first if you might want it back."
        : "This can't be undone. Export first if you might want them back.",
    ),
    confirmLabel: localize("Delete"),
    tone: "destructive",
  });
  if (!ok) return null;
  const results = await Promise.allSettled(ids.map((id) => remove(id)));
  const failed = ids.filter((_, index) => results[index]?.status === "rejected");
  const done = ids.length - failed.length;
  if (done) toast.success(translate("ui.overhaul.text.deletedNumber", { number: done }));
  if (failed.length) toast.error(translate("ui.overhaul.text.couldntDeleteNumber", { number: failed.length }));
  return failed;
}
