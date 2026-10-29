import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Folder, FolderOpen, FolderPlus, Search, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useMutateSpriteCatalog, useSpriteCatalog, type SpriteInfo } from "../../hooks/use-characters";
import { handleFolderRenameKeyDown, useFolderRenameGesture } from "../../hooks/use-folder-rename-gesture";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";

const control =
  "min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] md:min-h-8 md:py-1.5 md:text-xs";
const button = "mari-editor-action min-h-[44px]! min-w-[44px]! px-3 md:min-h-9! md:min-w-9!";

export function useSpriteLibrary(ownerId: string, sprites: SpriteInfo[], category: "expressions" | "full-body") {
  const query = useSpriteCatalog(ownerId);
  const mutation = useMutateSpriteCatalog(ownerId);
  const [folderId, setFolderId] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const folders = (query.data?.folders ?? []).filter((folder) => folder.category === category);
  useEffect(() => {
    setSelected([]);
    setSearch("");
  }, [category]);
  const counts = new Map<string, number>([["all", sprites.length]]);
  for (const sprite of sprites) {
    const folder = sprite.folderId ?? "unfiled";
    counts.set(folder, (counts.get(folder) ?? 0) + 1);
  }
  const visible = sprites.filter((sprite) =>
    `${sprite.label ?? sprite.expression} ${sprite.folderName ?? ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  useEffect(() => {
    setSelected((current) => {
      const next = current.filter((expression) => visible.some((sprite) => sprite.expression === expression));
      return next.length === current.length ? current : next;
    });
  }, [visible]);
  async function mutate(method: "post" | "patch" | "delete", path: string, body?: unknown) {
    try {
      return await mutation.mutateAsync({
        method,
        path,
        body: path === "folders" && method === "post" ? { ...(body as object), category } : body,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
      return undefined;
    }
  }
  return {
    ownerId,
    query,
    mutation,
    folders,
    counts,
    folderId,
    search,
    setSearch,
    selected: selected.filter((expression) => visible.some((sprite) => sprite.expression === expression)),
    setSelected,
    visible,
    mutate,
    uploadFolderId: folderId === "all" || folderId === "unfiled" ? null : folderId,
    chooseFolder: (id: string) => {
      setFolderId(id);
      setSelected([]);
      setSearch("");
    },
    toggle: (expression: string) =>
      setSelected((current) =>
        current.includes(expression) ? current.filter((item) => item !== expression) : [...current, expression],
      ),
  };
}

type Library = ReturnType<typeof useSpriteLibrary>;

export function SpriteLibraryShell({
  library,
  children,
  toolbar,
  selectionActions,
  busy = false,
}: {
  library: Library;
  children: ReactNode;
  toolbar?: ReactNode;
  selectionActions?: ReactNode;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  const label = (key: string) => t(`sprites.library.${key}`);
  const [moveTo, setMoveTo] = useState("unfiled");
  return (
    <div
      className="@container/sprite-library min-w-0 space-y-4 [overflow-wrap:anywhere]"
      data-sprite-library
      aria-busy={library.query.isPending}
    >
      {toolbar && <div className="flex flex-wrap items-center justify-between gap-3">{toolbar}</div>}
      <div className="flex items-center gap-3">
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <Search size={16} />
          <span className="sr-only">{label("search")}</span>
          <input
            type="search"
            className={`${control} min-w-0 flex-1`}
            placeholder={label("search")}
            value={library.search}
            onChange={(e) => {
              library.setSearch(e.target.value);
              library.setSelected([]);
            }}
          />
        </label>
        <button
          type="button"
          className={button}
          disabled={busy || library.query.isPending || library.mutation.isPending}
          onClick={() => {
            const names = new Set(library.folders.map((folder) => folder.name.toLowerCase()));
            let name = "unnamed";
            let index = 2;
            while (names.has(name)) name = `unnamed ${index++}`;
            void library.mutate("post", "folders", { name });
          }}
        >
          <FolderPlus size={16} />
          {label("newFolder")}
        </button>
      </div>
      {library.query.isError && (
        <p role="alert" className="text-sm text-[var(--destructive)]">
          {label("loadError")}
        </p>
      )}
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 text-xs",
          library.selected.length > 0 && "rounded-xl bg-[var(--secondary)] p-3",
        )}
      >
        <label className="inline-flex min-h-11 items-center gap-2 md:min-h-8">
          <input
            type="checkbox"
            disabled={busy || library.visible.length === 0}
            checked={
              library.visible.length > 0 &&
              library.visible.every((sprite) => library.selected.includes(sprite.expression))
            }
            onChange={(event) =>
              library.setSelected(event.target.checked ? library.visible.map((sprite) => sprite.expression) : [])
            }
          />
          {t("sprites.library.selectAll", { count: library.visible.length })}
        </label>
        {library.selected.length > 0 && (
          <>
            <span aria-live="polite">{t("sprites.library.selected", { count: library.selected.length })}</span>
            <select
              className={control}
              aria-label={label("destination")}
              value={moveTo}
              disabled={busy || library.mutation.isPending}
              onChange={(event) => setMoveTo(event.target.value)}
            >
              <option value="unfiled">{label("unfiled")}</option>
              {library.folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={button}
              disabled={library.mutation.isPending || busy}
              onClick={async () => {
                if (
                  await library.mutate("post", "move", {
                    expressions: library.selected,
                    folderId: moveTo === "unfiled" ? null : moveTo,
                  })
                )
                  library.setSelected([]);
              }}
            >
              {label("move")}
            </button>
            {selectionActions}
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => library.setSelected([])}
              aria-label={label("clearSelection")}
            >
              <X size={14} />
            </button>
          </>
        )}
      </div>

      {children}
    </div>
  );
}
const dragType = "application/x-marinara-sprites";
export function SpriteFolderGrid({
  library,
  renderSprite,
  busy = false,
}: {
  library: Library;
  renderSprite: (sprite: SpriteInfo) => ReactNode;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<string | null | undefined>();
  const dragPreview = useRef<HTMLElement | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const movePreview = (event: globalThis.DragEvent) => {
      if (!dragPreview.current || (!event.clientX && !event.clientY)) return;
      dragPreview.current.style.left = `${event.clientX - dragOffset.current.x}px`;
      dragPreview.current.style.top = `${event.clientY - dragOffset.current.y}px`;
    };
    window.addEventListener("dragover", movePreview, true);
    return () => {
      window.removeEventListener("dragover", movePreview, true);
      dragPreview.current?.remove();
      dragPreview.current = null;
    };
  }, []);
  const disabled = busy || library.mutation.isPending || !library.query.data;
  function accepts(e: DragEvent) {
    return !disabled && e.dataTransfer.types.includes(dragType);
  }
  async function drop(e: DragEvent, folderId: string | null) {
    e.preventDefault();
    e.stopPropagation();
    dragPreview.current?.remove();
    dragPreview.current = null;
    setTarget(undefined);
    if (disabled) return;
    try {
      const payload = JSON.parse(e.dataTransfer.getData(dragType));
      if (
        payload.ownerId !== library.ownerId ||
        !Array.isArray(payload.expressions) ||
        !payload.expressions.length ||
        !payload.expressions.every(
          (expression: unknown) =>
            typeof expression === "string" && library.visible.some((sprite) => sprite.expression === expression),
        )
      )
        return;
      if (folderId && !library.folders.some((folder) => folder.id === folderId)) return;
      await library.mutate("post", "move", { expressions: payload.expressions, folderId });
    } catch {
      /* Ignore foreign or malformed drag data. */
    }
  }
  const grid = (sprites: SpriteInfo[]) => (
    <div className="grid grid-cols-2 gap-3 @md:grid-cols-3 @xl:grid-cols-4">
      {sprites.map((sprite) => (
        <div
          key={sprite.expression}
          draggable={!disabled}
          onDragStart={(e) => {
            if (disabled) {
              e.preventDefault();
              return;
            }
            e.dataTransfer.effectAllowed = "move";
            const source = e.currentTarget;
            const bounds = source.getBoundingClientRect();
            dragOffset.current = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
            dragPreview.current?.remove();
            const preview = source.cloneNode(true) as HTMLElement;
            preview.dataset.spriteDragPreview = "";
            preview.setAttribute("aria-hidden", "true");
            preview.inert = true;
            const sourceStyle = getComputedStyle(source);
            for (const property of sourceStyle) {
              if (property.startsWith("--"))
                preview.style.setProperty(property, sourceStyle.getPropertyValue(property));
            }
            const originals = [source, ...source.querySelectorAll<HTMLElement | SVGElement>("*")];
            const copies = [preview, ...preview.querySelectorAll<HTMLElement | SVGElement>("*")];
            const visualProperties = [
              "color",
              "background-color",
              "background-image",
              "border-top-color",
              "border-right-color",
              "border-bottom-color",
              "border-left-color",
              "box-shadow",
              "opacity",
              "filter",
              "font-family",
              "font-size",
              "font-weight",
              "line-height",
              "letter-spacing",
            ];
            originals.forEach((original, index) => {
              const style = getComputedStyle(original);
              const copy = copies[index];
              if (!copy) return;
              for (const property of visualProperties)
                copy.style.setProperty(property, style.getPropertyValue(property));
            });
            Object.assign(preview.style, {
              position: "fixed",
              left: `${bounds.left}px`,
              top: `${bounds.top}px`,
              width: `${bounds.width}px`,
              height: `${bounds.height}px`,
              pointerEvents: "none",
              zIndex: "2147483647",
              opacity: "1",
              margin: "0",
              backgroundColor: sourceStyle.getPropertyValue("--background").trim(),
              borderRadius: source.firstElementChild ? getComputedStyle(source.firstElementChild).borderRadius : "",
            });
            document.body.appendChild(preview);
            dragPreview.current = preview;
            const transparent = document.createElement("canvas");
            transparent.width = 1;
            transparent.height = 1;
            e.dataTransfer.setDragImage(transparent, 0, 0);
            e.dataTransfer.setData(
              dragType,
              JSON.stringify({
                ownerId: library.ownerId,
                expressions: library.selected.includes(sprite.expression) ? library.selected : [sprite.expression],
              }),
            );
          }}
          onDragEnd={() => {
            dragPreview.current?.remove();
            dragPreview.current = null;
            setTarget(undefined);
          }}
        >
          {renderSprite(sprite)}
        </div>
      ))}
    </div>
  );
  const zone = (id: string | null) => ({
    onDragOver: (e: DragEvent) => {
      if (accepts(e)) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        setTarget(id);
      }
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setTarget(undefined);
    },
    onDrop: (e: DragEvent) => void drop(e, id),
  });
  return (
    <div className="space-y-4">
      {library.search && library.visible.length === 0 && (
        <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">{t("sprites.library.noMatches")}</p>
      )}
      {library.folders
        .slice()
        .reverse()
        .filter((folder) => !library.search || library.visible.some((sprite) => sprite.folderId === folder.id))
        .map((folder) => (
          <SpriteInlineFolder
            key={folder.id}
            library={library}
            current={folder}
            busy={disabled}
            highlighted={target === folder.id}
            zone={zone(folder.id)}
          >
            {grid(library.visible.filter((sprite) => sprite.folderId === folder.id))}
          </SpriteInlineFolder>
        ))}
      <div
        {...zone(null)}
        data-sprite-loose
        aria-label={t("sprites.library.loose")}
        className={cn("min-h-12 rounded-xl", target === null && "ring-2 ring-[var(--primary)]")}
      >
        {grid(library.visible.filter((sprite) => !sprite.folderId))}
        {library.folders.length > 0 && !library.visible.some((sprite) => !sprite.folderId) && (
          <p className="p-3 text-center text-xs text-[var(--muted-foreground)]">{t("sprites.library.dropLoose")}</p>
        )}
      </div>
    </div>
  );
}
function SpriteInlineFolder({
  library,
  current,
  busy,
  highlighted,
  zone,
  children,
}: {
  library: Library;
  current: Library["folders"][number];
  busy: boolean;
  highlighted: boolean;
  zone: { onDragOver: (e: DragEvent) => void; onDragLeave: (e: DragEvent) => void; onDrop: (e: DragEvent) => void };
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const label = (key: string) => t(`sprites.library.${key}`);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current.name);
  const gesture = useFolderRenameGesture();
  const contentId = useId();
  const beginRename = () => {
    setDraft(current.name);
    setEditing(true);
  };
  const rename = () => {
    const name = draft.trim();
    setEditing(false);
    if (name && name !== current.name) void library.mutate("patch", "folders/" + current.id, { name });
  };
  const expanded = open || Boolean(library.search);
  return (
    <section
      {...zone}
      data-sprite-folder={current.id}
      className={cn(
        "min-w-0 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3",
        highlighted && "ring-2 ring-[var(--primary)]",
      )}
    >
      <div className="group relative flex items-center gap-2">
        <div
          role="button"
          tabIndex={0}
          aria-label={current.name}
          aria-expanded={expanded}
          aria-controls={contentId}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left text-sm font-semibold"
          onClick={(event) => {
            if (!editing && !library.search)
              gesture(current.id, event, { onSingleClick: () => setOpen(!open), onRename: beginRename });
          }}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget || editing || library.search) return;
            handleFolderRenameKeyDown(event, { onSingleClick: () => setOpen(!open), onRename: beginRename });
          }}
        >
          {expanded ? <FolderOpen size={16} /> : <Folder size={16} />}
          {editing ? (
            <input
              autoFocus
              aria-label={label("folderName")}
              className="min-w-0 flex-1 rounded bg-transparent px-1 outline-none ring-1 ring-[var(--border)]"
              maxLength={100}
              value={draft}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                  event.preventDefault();
                  setEditing(false);
                }
              }}
              onBlur={rename}
            />
          ) : (
            <span className="min-w-0 flex-1 break-words">{current.name}</span>
          )}
          <span className="text-xs font-normal text-[var(--muted-foreground)]">
            {library.counts.get(current.id) ?? 0}
          </span>
        </div>
        <button
          type="button"
          className="mari-editor-action mari-editor-action--danger min-h-11! min-w-11! opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100 [@media(pointer:coarse)]:opacity-100"
          aria-label={label("removeFolder")}
          disabled={busy}
          onClick={async () => {
            if (
              await showConfirmDialog({
                title: label("removeFolder"),
                message: label("removeFolderMessage"),
                confirmLabel: label("removeFolder"),
                tone: "destructive",
              })
            )
              await library.mutate("delete", "folders/" + current.id);
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {expanded && (
        <div id={contentId}>
          {children}
          {!library.counts.get(current.id) && (
            <p className="p-3 text-center text-xs text-[var(--muted-foreground)]">{label("emptyFolder")}</p>
          )}
        </div>
      )}
    </section>
  );
}
export function SpriteSelection({
  library,
  sprite,
  disabled = false,
}: {
  library: Library;
  sprite: SpriteInfo;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <label className="absolute left-2 top-2 z-10 flex h-[44px] w-[44px] items-center justify-center rounded-lg bg-[var(--card)]/90 md:h-9 md:w-9">
      <input
        type="checkbox"
        disabled={disabled}
        checked={library.selected.includes(sprite.expression)}
        onChange={() => library.toggle(sprite.expression)}
        aria-label={t("sprites.library.selectSpriteInFolder", {
          name: (sprite.label ?? sprite.expression).replace(/^full_/u, "").replace(/_/gu, " "),
          folder: sprite.folderName ?? t("sprites.library.unfiled"),
        })}
      />
    </label>
  );
}
