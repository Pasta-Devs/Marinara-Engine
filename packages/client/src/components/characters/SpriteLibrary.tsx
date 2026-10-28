import { useState, type ReactNode } from "react";
import { Folder, FolderPlus, Search, Star, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useMutateSpriteCatalog, useSpriteCatalog, type SpriteInfo } from "../../hooks/use-characters";
import { useChat, useUpdateChatMetadata } from "../../hooks/use-chats";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";

const control =
  "min-h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] md:min-h-8 md:py-1.5 md:text-xs";
const button = `${control} inline-flex items-center justify-center gap-1.5 transition-colors hover:bg-[var(--accent)] disabled:opacity-50`;

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

export function SpriteLibraryShell({ library, children }: { library: Library; children: ReactNode }) {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [moveTo, setMoveTo] = useState("unfiled");
  const current = library.folders.find((folder) => folder.id === library.folderId);
  const defaultId = library.query.data?.defaultFolderId ?? "unfiled";
  const label = (key: string) => t(`sprites.library.${key}`);
  const choices = [{ id: "all", name: label("all") }, { id: "unfiled", name: label("unfiled") }, ...library.folders];
  const title = choices.find((choice) => choice.id === library.folderId)?.name ?? label("missingFolder");
  return (
    <div className="@container min-w-0" data-sprite-library>
      <div className="grid min-w-0 gap-5 @xl:grid-cols-[10rem_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-3" aria-label={label("folders")}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">{label("folders")}</span>
            <button
              type="button"
              className={button}
              aria-label={label("newFolder")}
              onClick={() => setCreating(!creating)}
            >
              <FolderPlus size={16} />
            </button>
          </div>
          <select
            className={`${control} w-full @xl:hidden`}
            value={library.folderId}
            aria-label={label("browseFolder")}
            onChange={(event) => library.chooseFolder(event.target.value)}
          >
            {choices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.id === defaultId ? t("sprites.library.defaultFolderName", { name: choice.name }) : choice.name}
              </option>
            ))}
          </select>
          <nav className="hidden space-y-1 @xl:block" aria-label={label("browseFolder")}>
            {choices.map((choice) => (
              <button
                type="button"
                key={choice.id}
                onClick={() => library.chooseFolder(choice.id)}
                aria-pressed={choice.id === library.folderId}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
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
            </form>
          )}
          {current && (
            <details className="space-y-2 text-xs" key={current.id}>
              <summary className="cursor-pointer py-2 text-[var(--muted-foreground)]">{label("folderDetails")}</summary>
              <form
                className="space-y-2 pt-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  await library.mutate("patch", `folders/${current.id}`, {
                    name: form.get("name"),
                    description: form.get("description"),
                  });
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
                className={`${button} w-full text-[var(--destructive)]`}
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
            </details>
          )}
        </aside>
        <div className="@container min-w-0 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="break-words text-base font-semibold">{title}</h4>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {current?.description || label("browseHint")}
              </p>
            </div>
            {library.folderId !== "all" && (
              <button
                type="button"
                className={button}
                disabled={library.mutation.isPending || defaultId === library.folderId}
                onClick={() => void library.mutate("patch", "catalog", { defaultFolderId: library.uploadFolderId })}
              >
                <Star size={14} />
                {defaultId === library.folderId ? label("defaultForChats") : label("makeDefault")}
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
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="inline-flex min-h-11 items-center gap-2 md:min-h-8">
              <input
                type="checkbox"
                checked={
                  library.visible.length > 0 &&
                  library.visible.every((sprite) => library.selected.includes(sprite.expression))
                }
                onChange={(event) =>
                  library.setSelected(event.target.checked ? library.visible.map((sprite) => sprite.expression) : [])
                }
              />
              {t("sprites.library.count", { count: library.visible.length })}
            </label>
            {library.selected.length > 0 && (
              <>
                <span aria-live="polite">{t("sprites.library.selected", { count: library.selected.length })}</span>
                <select
                  className={control}
                  aria-label={label("destination")}
                  value={moveTo}
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
                  disabled={library.mutation.isPending}
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
              </>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function SpriteSelection({ library, sprite }: { library: Library; sprite: SpriteInfo }) {
  const { t } = useTranslation();
  return (
    <label className="absolute left-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--card)]/90">
      <input
        type="checkbox"
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
