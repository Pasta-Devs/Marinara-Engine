import { useEffect, useId, useState, type DragEvent, type ReactNode } from "react";
import { Folder, FolderOpen, FolderPlus, Pencil, Search, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useMutateSpriteCatalog, useSpriteCatalog, type SpriteInfo } from "../../hooks/use-characters";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";

const control =
  "min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] md:min-h-8 md:py-1.5 md:text-xs";
const button = "mari-editor-action min-h-[44px]! min-w-[44px]! px-3 md:min-h-9! md:min-w-9!";

export function useSpriteLibrary(ownerId: string, sprites: SpriteInfo[]) {
  const query = useSpriteCatalog(ownerId);
  const mutation = useMutateSpriteCatalog(ownerId);
  const [folderId, setFolderId] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const folders = query.data?.folders ?? [];
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
      return await mutation.mutateAsync({ method, path, body });
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
  const [creating, setCreating] = useState(false),
    [name, setName] = useState(""),
    [moveTo, setMoveTo] = useState("unfiled");
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
          disabled={busy || library.query.isPending}
          aria-expanded={creating}
          onClick={() => setCreating(!creating)}
        >
          <FolderPlus size={16} />
          {label("newFolder")}
        </button>
      </div>
      {creating && (
        <form
          className="space-y-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const result = await library.mutate("post", "folders", { name });
            if (result) {
              setName("");
              setCreating(false);
            }
          }}
        >
          <label className="block space-y-1 text-xs">
            <span>{label("folderName")}</span>
            <input
              className={`${control} w-full`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              required
            />
          </label>
          <button className={`${button} w-full`} disabled={busy || library.mutation.isPending}>
            {label("create")}
          </button>
          <button type="button" className={`${button} w-full`} onClick={() => setCreating(false)}>
            {label("cancel")}
          </button>
        </form>
      )}

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
  const [dragging, setDragging] = useState(false);
  const [target, setTarget] = useState<string | null | undefined>();
  const disabled = busy || library.mutation.isPending || !library.query.data;
  function accepts(e: DragEvent) {
    return !disabled && e.dataTransfer.types.includes(dragType);
  }
  async function drop(e: DragEvent, folderId: string | null) {
    e.preventDefault();
    e.stopPropagation();
    setTarget(undefined);
    setDragging(false);
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
            e.dataTransfer.setData(
              dragType,
              JSON.stringify({
                ownerId: library.ownerId,
                expressions: library.selected.includes(sprite.expression) ? library.selected : [sprite.expression],
              }),
            );
            setDragging(true);
          }}
          onDragEnd={() => {
            setDragging(false);
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
      <div
        {...zone(null)}
        data-sprite-loose
        aria-label={t("sprites.library.loose")}
        className={cn("min-h-12 rounded-xl", target === null && "ring-2 ring-[var(--primary)]")}
      >
        {grid(library.visible.filter((sprite) => !sprite.folderId))}
        {library.folders.length > 0 && (dragging || !library.visible.some((sprite) => !sprite.folderId)) && (
          <p className="p-3 text-center text-xs text-[var(--muted-foreground)]">{t("sprites.library.dropLoose")}</p>
        )}
      </div>
      {library.folders
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
  const [open, setOpen] = useState(true),
    [editingFolder, setEditingFolder] = useState<string | null>(null);
  const detailsId = useId(),
    contentId = useId();
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
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left text-sm font-semibold"
          aria-label={current.name}
          aria-expanded={expanded}
          aria-controls={contentId}
          disabled={Boolean(library.search)}
          onClick={() => setOpen(!open)}
        >
          {expanded ? <FolderOpen size={16} /> : <Folder size={16} />}
          <span className="min-w-0 flex-1 break-words">{current.name}</span>
          <span className="text-xs font-normal text-[var(--muted-foreground)]">
            {library.counts.get(current.id) ?? 0}
          </span>
          <span className="text-xs font-normal">{label(expanded ? "collapse" : "expand")}</span>
        </button>
        <button
          type="button"
          className={button}
          aria-label={label("folderDetails")}
          aria-expanded={editingFolder === current.id}
          disabled={busy}
          onClick={() => setEditingFolder(editingFolder ? null : current.id)}
        >
          <Pencil size={14} />
        </button>
      </div>
      {editingFolder === current.id && (
        <div id={detailsId}>
          <form
            className="space-y-2 pt-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const result = await library.mutate("patch", `folders/${current.id}`, {
                name: form.get("name"),
              });
              if (result) setEditingFolder(null);
            }}
          >
            <label className="block space-y-1">
              <span>{label("folderName")}</span>
              <input name="name" className={`${control} w-full`} defaultValue={current.name} maxLength={100} required />
            </label>
            <button className={`${button} w-full`} disabled={busy || library.mutation.isPending}>
              {label("saveFolder")}
            </button>
          </form>
          <button
            type="button"
            className={`${button} mari-editor-action--danger mt-2 w-full`}
            disabled={busy || library.mutation.isPending}
            onClick={async () => {
              if (
                !(await showConfirmDialog({
                  title: label("removeFolder"),
                  message: label("removeFolderMessage"),
                  confirmLabel: label("removeFolder"),
                  tone: "destructive",
                }))
              )
                return;
              await library.mutate("delete", `folders/${current.id}`);
            }}
          >
            <Trash2 size={14} />
            {label("removeFolder")}
          </button>
        </div>
      )}

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
