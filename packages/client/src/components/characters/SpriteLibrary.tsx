import { useEffect, useId, useState, type ReactNode } from "react";
import { Folder, FolderPlus, Pencil, Search, Star, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useMutateSpriteCatalog, useSpriteCatalog, type SpriteInfo } from "../../hooks/use-characters";
import { useChat, useUpdateChatMetadata } from "../../hooks/use-chats";
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
  useEffect(() => {
    setSelected((current) => {
      const next = current.filter((expression) => sprites.some((sprite) => sprite.expression === expression));
      return next.length === current.length ? current : next;
    });
  }, [sprites]);
  const folders = query.data?.folders ?? [];
  const counts = new Map<string, number>([["all", sprites.length]]);
  for (const sprite of sprites) {
    const folder = sprite.folderId ?? "unfiled";
    counts.set(folder, (counts.get(folder) ?? 0) + 1);
  }
  const visible = sprites.filter(
    (sprite) =>
      (folderId === "all" || (sprite.folderId ?? "unfiled") === folderId) &&
      `${sprite.label ?? sprite.expression} ${sprite.folderName ?? ""}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
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
    selected,
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
  const detailsId = useId();
  const [creating, setCreating] = useState(false);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [moveTo, setMoveTo] = useState("unfiled");
  const current = library.folders.find((folder) => folder.id === library.folderId);
  const defaultId = library.query.data?.defaultFolderId ?? "unfiled";
  const label = (key: string) => t(`sprites.library.${key}`);
  const choices = [{ id: "all", name: label("all") }, { id: "unfiled", name: label("unfiled") }, ...library.folders];
  const title = choices.find((choice) => choice.id === library.folderId)?.name ?? label("missingFolder");
  const defaultName = choices.find((choice) => choice.id === defaultId)?.name ?? label("unfiled");
  return (
    <div
      className="@container/sprite-library min-w-0 space-y-4"
      data-sprite-library
      aria-busy={library.query.isPending}
    >
      {toolbar && <div className="flex flex-wrap items-center justify-between gap-3">{toolbar}</div>}
      <div className="grid min-w-0 gap-5 @xl:grid-cols-[10rem_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-3" aria-label={label("folders")}>
          <div className="flex items-center justify-between gap-2">
            <span className="hidden text-xs font-semibold text-[var(--muted-foreground)] @xl:block">
              {label("folders")}
            </span>
            <select
              className={`${control} min-w-0 flex-1 @xl:hidden`}
              value={library.folderId}
              disabled={busy || library.query.isPending}
              aria-label={label("browseFolder")}
              onChange={(event) => library.chooseFolder(event.target.value)}
            >
              {choices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.id === defaultId
                    ? t("sprites.library.defaultFolderName", { name: choice.name })
                    : choice.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={button}
              aria-label={label("newFolder")}
              aria-expanded={creating}
              disabled={busy || library.query.isPending}
              onClick={() => setCreating(!creating)}
            >
              <FolderPlus size={16} />
            </button>
          </div>
          <nav className="hidden space-y-1 @xl:block" aria-label={label("browseFolder")}>
            {choices.map((choice) => (
              <button
                type="button"
                key={choice.id}
                disabled={busy}
                onClick={() => library.chooseFolder(choice.id)}
                aria-pressed={choice.id === library.folderId}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors disabled:opacity-50 md:min-h-9",
                  choice.id === library.folderId
                    ? "bg-[var(--primary)]/15 text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                )}
              >
                <Folder size={14} className="shrink-0" />
                <span className="min-w-0 flex-1 break-words">{choice.name}</span>
                <span className="text-[var(--muted-foreground)] tabular-nums">
                  {library.counts.get(choice.id) ?? 0}
                </span>
                {choice.id === defaultId && (
                  <Star size={12} aria-label={label("default")} className="shrink-0 text-[var(--primary)]" />
                )}
              </button>
            ))}
          </nav>
          {creating && (
            <form
              className="space-y-2"
              onSubmit={async (event) => {
                event.preventDefault();
                const result = await library.mutate("post", "folders", { name });
                if (result) {
                  const added = result.folders.find((folder) => !library.folders.some((old) => old.id === folder.id));
                  if (added) library.chooseFolder(added.id);
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
              <button className={`${button} w-full`} disabled={library.mutation.isPending}>
                {label("create")}
              </button>
              <button type="button" className={`${button} w-full`} onClick={() => setCreating(false)}>
                {label("cancel")}
              </button>
            </form>
          )}
          {current && (
            <div className="space-y-2 text-xs" key={current.id}>
              <button
                type="button"
                className={`${button} w-full`}
                aria-expanded={editingFolder === current.id}
                aria-controls={detailsId}
                disabled={busy}
                onClick={() => setEditingFolder(editingFolder === current.id ? null : current.id)}
              >
                <Pencil size={14} />
                {label("folderDetails")}
              </button>
              {editingFolder === current.id && (
                <div id={detailsId}>
                  <form
                    className="space-y-2 pt-2"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      const result = await library.mutate("patch", `folders/${current.id}`, {
                        name: form.get("name"),
                        description: form.get("description"),
                      });
                      if (result) setEditingFolder(null);
                    }}
                  >
                    <label className="block space-y-1">
                      <span>{label("folderName")}</span>
                      <input
                        name="name"
                        className={`${control} w-full`}
                        defaultValue={current.name}
                        maxLength={100}
                        required
                      />
                    </label>
                    <label className="block space-y-1">
                      <span>{label("description")}</span>
                      <textarea
                        name="description"
                        className={`${control} w-full`}
                        defaultValue={current.description}
                        maxLength={500}
                        rows={3}
                      />
                    </label>
                    <button className={`${button} w-full`} disabled={library.mutation.isPending}>
                      {label("saveFolder")}
                    </button>
                  </form>
                  <button
                    type="button"
                    className={`${button} mari-editor-action--danger mt-2 w-full`}
                    disabled={library.mutation.isPending}
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
                      if (await library.mutate("delete", `folders/${current.id}`)) library.chooseFolder("unfiled");
                    }}
                  >
                    <Trash2 size={14} />
                    {label("removeFolder")}
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
        <div className="@container min-w-0 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="hidden break-words text-base font-semibold @xl/sprite-library:block">{title}</h4>
              {current?.description && (
                <p className="mt-1 break-words text-xs text-[var(--muted-foreground)]">{current.description}</p>
              )}
              <p
                className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-[var(--muted-foreground)]"
                data-sprite-default
              >
                <Star size={12} className="shrink-0" />
                <span className="min-w-0 break-words">
                  {library.query.isPending
                    ? label("loadingFolders")
                    : library.query.data
                      ? t("sprites.library.chatDefault", { name: defaultName })
                      : label("loadError")}
                </span>
              </p>
            </div>
            {library.folderId !== "all" && defaultId !== library.folderId && (
              <button
                type="button"
                className={button}
                disabled={library.mutation.isPending || busy}
                onClick={() => void library.mutate("patch", "catalog", { defaultFolderId: library.uploadFolderId })}
              >
                <Star size={14} />
                {label("makeDefault")}
              </button>
            )}
          </div>
          <label className="flex items-center gap-2">
            <Search size={16} className="shrink-0 text-[var(--muted-foreground)]" />
            <span className="sr-only">{label("search")}</span>
            <input
              type="search"
              className={`${control} min-w-0 flex-1`}
              placeholder={label("search")}
              value={library.search}
              onChange={(event) => {
                library.setSearch(event.target.value);
                library.setSelected([]);
              }}
            />
          </label>
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
      </div>
    </div>
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

export function SpriteFolderChatPicker({ chatId, ownerId }: { chatId: string; ownerId: string }) {
  const { t } = useTranslation();
  const { data: catalog } = useSpriteCatalog(ownerId);
  const { data: chat } = useChat(chatId);
  const update = useUpdateChatMetadata();
  const overrides = chat?.metadata.spriteFolderOverrides ?? {};
  const selected = Object.hasOwn(overrides, ownerId) ? (overrides[ownerId] ?? "unfiled") : "inherit";
  if (!catalog || (!catalog.folders.length && !Object.hasOwn(overrides, ownerId))) return null;
  return (
    <label className="w-full min-w-0 sm:w-36">
      <span className="sr-only">{t("sprites.library.chatFolder")}</span>
      <select
        className={`${control} w-full`}
        aria-label={t("sprites.library.chatFolder")}
        value={selected}
        disabled={update.isPending}
        onChange={(event) => {
          const next = { ...overrides };
          if (event.target.value === "inherit") delete next[ownerId];
          else next[ownerId] = event.target.value === "unfiled" ? null : event.target.value;
          update.mutate(
            { id: chatId, spriteFolderOverrides: next },
            { onError: (error) => toast.error(error.message) },
          );
        }}
      >
        <option value="inherit">
          {t("sprites.library.inheritDefault", {
            name:
              catalog.folders.find((folder) => folder.id === catalog.defaultFolderId)?.name ??
              t("sprites.library.unfiled"),
          })}
        </option>
        <option value="unfiled">{t("sprites.library.unfiled")}</option>
        {catalog.folders.map((folder) => (
          <option key={folder.id} value={folder.id}>
            {folder.name}
          </option>
        ))}
        {selected !== "inherit" &&
          selected !== "unfiled" &&
          !catalog.folders.some((folder) => folder.id === selected) && (
            <option value={selected}>{t("sprites.library.missingFolder")}</option>
          )}
      </select>
    </label>
  );
}
