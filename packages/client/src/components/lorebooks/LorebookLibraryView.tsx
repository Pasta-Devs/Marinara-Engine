import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type UIEvent } from "react";
import type { LorebookCategory } from "@marinara-engine/shared";
import {
  ArrowLeft,
  ArrowUpDown,
  BookOpen,
  Check,
  CheckSquare2,
  Copy,
  Download,
  Globe2,
  Grid3X3,
  Hash,
  List,
  Pencil,
  Plus,
  Search,
  Tag,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  flattenLorebookPages,
  useCreateLorebook,
  useDeleteLorebook,
  useLorebookPages,
} from "../../hooks/use-lorebooks";
import { useLibrarySelection } from "../../hooks/use-library-selection";
import { api } from "../../lib/api-client";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { getChatCharacterIds } from "../../lib/chat-macros";
import { duplicateLorebook } from "../../lib/lorebook-duplicate";
import {
  isLorebookActiveForChat,
  lorebookToResource,
  type LorebookResource,
} from "../../lib/library/lorebook-resource";
import { cn } from "../../lib/utils";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore, type LorebookPanelCategory, type LorebookPanelSort } from "../../stores/ui.store";
import { ChatResourceActionButton } from "../chat/ChatResourceActionButton";
import { SelectionActionBar } from "../ui/SelectionActionBar";
import { EntitySummaryStatusBadge } from "../ui/EntitySummaryStatusBadge";

const CATEGORIES: Array<{ value: LorebookPanelCategory; key: string }> = [
  { value: "all", key: "all" },
  { value: "world", key: "world" },
  { value: "character", key: "character" },
  { value: "npc", key: "npc" },
  { value: "spellbook", key: "spellbook" },
  { value: "uncategorized", key: "other" },
];

const toolbarButtonClass = "mari-chrome-control mari-chrome-control--primary h-10 min-h-10 px-3 text-xs md:h-9";
const toolbarFieldClass = "mari-chrome-field h-10 min-w-0 text-xs md:h-9";

function categoryLabel(t: ReturnType<typeof useTranslation>["t"], category: LorebookCategory) {
  const key = category === "uncategorized" ? "other" : category;
  return t(`ui.lorebooks.lorebooklibraryview.category.${key}`);
}

function parseActiveLorebookIds(metadata: unknown) {
  try {
    const parsed = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
    if (!parsed || typeof parsed !== "object") return [];
    const ids = (parsed as Record<string, unknown>).activeLorebookIds;
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function LorebookCover({ resource, size = "row" }: { resource: LorebookResource; size?: "row" | "grid" | "detail" }) {
  const sizeClass =
    size === "row" ? "h-12 w-12 rounded-lg" : size === "grid" ? "h-24 w-20 rounded-lg" : "aspect-[4/3] w-full";
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden bg-amber-500/12 text-amber-300 ring-1 ring-inset ring-amber-400/20",
        sizeClass,
      )}
    >
      {resource.coverPath ? (
        <img src={resource.coverPath} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <BookOpen size={size === "detail" ? "2.25rem" : "1.25rem"} aria-hidden="true" />
      )}
    </div>
  );
}

function StatusBadge({ resource, active }: { resource: LorebookResource; active: boolean }) {
  const { t } = useTranslation();
  const label = !resource.enabled
    ? t("ui.lorebooks.lorebooklibraryview.disabled")
    : active
      ? t("ui.lorebooks.lorebooklibraryview.activeInChat")
      : t("ui.lorebooks.lorebooklibraryview.enabled");
  return (
    <span className={cn("mari-chrome-muted-badge gap-1 text-[0.625rem]", active && "mari-chrome-accent-surface")}>
      <Check size="0.625rem" aria-hidden="true" /> {label}
    </span>
  );
}

function LorebookDetail({
  resource,
  active,
  onEdit,
  onDuplicate,
}: {
  resource: LorebookResource;
  active: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
}) {
  const { t } = useTranslation();
  const linkedNames = [...resource.characterNames, ...resource.personaNames];
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)]/75">
        <LorebookCover resource={resource} size="detail" />
        <div className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="break-words text-xl font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                {resource.name}
              </h2>
              <p className="mt-1 text-xs capitalize text-[var(--marinara-chat-chrome-panel-muted)]">
                {categoryLabel(t, resource.category)}
              </p>
            </div>
            <StatusBadge resource={resource} active={active} />
            <EntitySummaryStatusBadge input={resource.summaryStatusInput} />
          </div>
          {resource.summary && (
            <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--marinara-chat-chrome-panel-text)]">
              {resource.summary}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-[var(--marinara-chat-chrome-highlight-bg)] p-2.5">
              <span className="block text-[var(--marinara-chat-chrome-panel-muted)]">
                {t("ui.lorebooks.lorebooklibraryview.tokenBudget")}
              </span>
              <strong className="mt-1 flex items-center gap-1 text-sm">
                <Hash size="0.75rem" />
                {resource.tokenBudget.toLocaleString()}
              </strong>
            </div>
            <div className="rounded-md bg-[var(--marinara-chat-chrome-highlight-bg)] p-2.5">
              <span className="block text-[var(--marinara-chat-chrome-panel-muted)]">
                {t("ui.lorebooks.lorebooklibraryview.entryLimit")}
              </span>
              <strong className="mt-1 block text-sm">{resource.entryLimit.toLocaleString()}</strong>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {resource.isGlobal && (
              <span className="mari-chrome-muted-badge gap-1">
                <Globe2 size="0.6875rem" />
                {t("ui.lorebooks.lorebooklibraryview.global")}
              </span>
            )}
            {resource.tags.map((tag) => (
              <span key={tag} className="mari-chrome-muted-badge gap-1">
                <Tag size="0.625rem" />
                {tag}
              </span>
            ))}
          </div>
          {linkedNames.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[var(--marinara-chat-chrome-panel-muted)]">
                {t("ui.lorebooks.lorebooklibraryview.linkedTo")}
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {resource.characterNames.map((name) => (
                  <span key={`character-${name}`} className="mari-chrome-muted-badge gap-1">
                    <UsersRound size="0.6875rem" />
                    {name}
                  </span>
                ))}
                {resource.personaNames.map((name) => (
                  <span key={`persona-${name}`} className="mari-chrome-muted-badge gap-1">
                    <UserRound size="0.6875rem" />
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={onEdit} className="mari-chrome-control min-h-10 px-2 text-xs">
              <Pencil size="0.75rem" />
              {t("ui.lorebooks.lorebooklibraryview.edit")}
            </button>
            <button type="button" onClick={onDuplicate} className="mari-chrome-control min-h-10 px-2 text-xs">
              <Copy size="0.75rem" />
              {t("ui.lorebooks.lorebooklibraryview.duplicate")}
            </button>
            <ChatResourceActionButton
              payload={{ version: 1, kind: "lorebook", ids: [resource.id], label: resource.name }}
              className="min-h-10 justify-center px-2"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function LorebookLibraryView() {
  const { t } = useTranslation();
  const activeChat = useChatStore((state) => state.activeChat);
  const closeLibrary = useUIStore((state) => state.closeLorebookLibrary);
  const openDetail = useUIStore((state) => state.openLorebookDetail);
  const openModal = useUIStore((state) => state.openModal);
  const viewMode = useUIStore((state) => state.lorebookLibraryViewMode);
  const selectedId = useUIStore((state) => state.lorebookLibrarySelectedId);
  const search = useUIStore((state) => state.lorebookLibrarySearch);
  const category = useUIStore((state) => state.lorebookLibraryCategory);
  const activeFilter = useUIStore((state) => state.lorebookLibraryActiveFilter);
  const sort = useUIStore((state) => state.lorebookLibrarySort);
  const setViewMode = useUIStore((state) => state.setLorebookLibraryViewMode);
  const setSelectedId = useUIStore((state) => state.setLorebookLibrarySelectedId);
  const setSearch = useUIStore((state) => state.setLorebookLibrarySearch);
  const setCategory = useUIStore((state) => state.setLorebookLibraryCategory);
  const setActiveFilter = useUIStore((state) => state.setLorebookLibraryActiveFilter);
  const setSort = useUIStore((state) => state.setLorebookLibrarySort);
  const setScrollTop = useUIStore((state) => state.setLorebookLibraryScrollTop);
  const deleteLorebook = useDeleteLorebook();
  const createLorebook = useCreateLorebook();
  const [exporting, setExporting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const pendingSelectedIdRef = useRef<string | null>(null);

  const activeContext = useMemo(
    () => ({
      lorebookIds: parseActiveLorebookIds(activeChat?.metadata),
      characterIds: getChatCharacterIds(activeChat),
      personaId: activeChat?.personaId ?? null,
      chatId: activeChat?.id ?? null,
    }),
    [activeChat],
  );
  const pages = useLorebookPages({
    category: category === "all" || category === "active" ? undefined : category,
    search,
    sort,
    active: activeFilter === "active" && activeChat ? activeContext : undefined,
  });
  const lorebooks = useMemo(() => flattenLorebookPages(pages.data), [pages.data]);
  const resources = useMemo(() => lorebooks.map(lorebookToResource), [lorebooks]);
  const selection = useLibrarySelection(
    useMemo(() => resources.map((item) => item.id), [resources]),
    `${search}\u0000${category}\u0000${activeFilter}\u0000${sort}\u0000${activeContext.chatId ?? ""}\u0000${activeContext.personaId ?? ""}\u0000${activeContext.characterIds.join(",")}\u0000${activeContext.lorebookIds.join(",")}`,
  );

  useEffect(() => {
    if (!activeChat && activeFilter === "active") setActiveFilter("all");
  }, [activeChat, activeFilter, setActiveFilter]);

  useEffect(() => {
    if (pendingSelectedIdRef.current) {
      if (!resources.some((item) => item.id === pendingSelectedIdRef.current)) return;
      pendingSelectedIdRef.current = null;
    }
    if (selectedId && resources.some((item) => item.id === selectedId)) return;
    setSelectedId(resources[0]?.id ?? null);
  }, [resources, selectedId, setSelectedId]);
  const selected = resources.find((item) => item.id === selectedId) ?? null;

  useLayoutEffect(() => {
    if (pages.isLoading || !scrollRef.current) return;
    const node = scrollRef.current;
    const restore = () => {
      const top = useUIStore.getState().lorebookLibraryScrollTop;
      node.scrollTop = Math.min(top, Math.max(0, node.scrollHeight - node.clientHeight));
    };
    restore();
    const frame = window.requestAnimationFrame(restore);
    return () => window.cancelAnimationFrame(frame);
  }, [pages.isLoading, resources.length]);

  useEffect(
    () => () => {
      if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
    },
    [],
  );

  const handleScroll = (event: UIEvent<HTMLElement>) => {
    const top = event.currentTarget.scrollTop;
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      setScrollTop(top);
    });
  };
  const editResource = (id: string) => {
    if (scrollRef.current) setScrollTop(scrollRef.current.scrollTop);
    setSelectedId(id);
    openDetail(id, { preserveLorebookLibrary: true });
  };
  const duplicateResource = useCallback(
    async (resource: LorebookResource) => {
      setDuplicatingId(resource.id);
      try {
        const created = await duplicateLorebook(resource.source, createLorebook.mutateAsync);
        pendingSelectedIdRef.current = created.id;
        setSelectedId(created.id);
        toast.success(t("ui.lorebooks.lorebooklibraryview.duplicated", { name: resource.name }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("ui.panels.lorebookspanel.failedToCopyLorebook"));
      } finally {
        setDuplicatingId(null);
      }
    },
    [createLorebook.mutateAsync, setSelectedId, t],
  );

  const exportSelected = async () => {
    if (selection.selectedIds.size === 0) return;
    setExporting(true);
    try {
      await api.downloadPost(
        "/lorebooks/export-bulk",
        { ids: [...selection.selectedIds], format: "native" },
        "marinara-lorebooks.zip",
      );
      toast.success(t("ui.lorebooks.lorebooklibraryview.exported", { count: selection.selectedIds.size }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("ui.panels.lorebookspanel.failedToExportLorebooks"));
    } finally {
      setExporting(false);
    }
  };
  const deleteSelected = async () => {
    const ids = [...selection.selectedIds];
    if (ids.length === 0) return;
    const confirmed = await showConfirmDialog({
      title: t("ui.lorebooks.lorebooklibraryview.deleteSelected"),
      message: t("ui.lorebooks.lorebooklibraryview.deleteSelectedMessage", { count: ids.length }),
      confirmLabel: t("lorebook.editor.batch.delete"),
      tone: "destructive",
    });
    if (!confirmed) return;
    const results = await Promise.allSettled(ids.map((id) => deleteLorebook.mutateAsync(id)));
    const failedIds = ids.filter((_, index) => results[index]?.status === "rejected");
    const deleted = ids.length - failedIds.length;
    if (deleted) toast.success(t("ui.lorebooks.lorebooklibraryview.deleted", { count: deleted }));
    if (failedIds.length) {
      selection.setSelectedIds(new Set(failedIds));
      toast.error(t("ui.lorebooks.lorebooklibraryview.deleteFailed", { count: failedIds.length }));
    } else selection.exitSelectionMode();
  };

  const renderResource = (resource: LorebookResource, grid: boolean) => {
    const previewSelected = resource.id === selectedId;
    const bulkSelected = selection.selectedIds.has(resource.id);
    const active = isLorebookActiveForChat(resource.source, activeContext);
    return (
      <Fragment key={resource.id}>
        <article
          className={cn(
            "group relative border bg-[var(--card)]/72 transition-colors hover:border-[var(--marinara-chat-chrome-button-border-hover)]",
            grid
              ? "flex min-h-40 gap-3 rounded-lg p-3 sm:flex-col"
              : "flex min-h-[4.75rem] items-center gap-3 rounded-lg px-3 py-2",
            (selection.selectionMode ? bulkSelected : previewSelected)
              ? "border-[var(--marinara-chat-chrome-button-border-active)] ring-1 ring-[var(--marinara-chat-chrome-focus-ring)]"
              : "border-[var(--marinara-chat-chrome-panel-border)]",
          )}
        >
          <button
            type="button"
            onClick={() =>
              selection.selectionMode ? selection.toggleSelected(resource.id) : setSelectedId(resource.id)
            }
            aria-pressed={selection.selectionMode ? bulkSelected : previewSelected}
            aria-label={
              selection.selectionMode
                ? t(
                    bulkSelected
                      ? "ui.lorebooks.lorebooklibraryview.deselectNamed"
                      : "ui.lorebooks.lorebooklibraryview.selectNamed",
                    { name: resource.name },
                  )
                : t("ui.lorebooks.lorebooklibraryview.previewNamed", { name: resource.name })
            }
            className="absolute inset-0 z-[1] rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marinara-chat-chrome-focus-ring)]"
          />
          {selection.selectionMode && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-2 top-2 z-[2] flex h-5 w-5 items-center justify-center rounded border-2",
                bulkSelected
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border-[var(--muted-foreground)]/50 bg-[var(--background)]",
              )}
            >
              {bulkSelected && <Check size="0.75rem" />}
            </span>
          )}
          <LorebookCover resource={resource} size={grid ? "grid" : "row"} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                  {resource.name}
                </h2>
                <p className="mt-0.5 truncate text-[0.6875rem] capitalize text-[var(--marinara-chat-chrome-panel-muted)]">
                  {categoryLabel(t, resource.category)}
                </p>
              </div>
              <StatusBadge resource={resource} active={active} />
              <EntitySummaryStatusBadge input={resource.summaryStatusInput} />
            </div>
            <p
              className={cn(
                "mt-2 text-xs leading-5 text-[var(--marinara-chat-chrome-panel-muted)]",
                grid ? "line-clamp-3" : "truncate",
              )}
            >
              {resource.summary || t("ui.lorebooks.lorebooklibraryview.noDescription")}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]">
              <span className="mari-chrome-muted-badge gap-1">
                <Hash size="0.625rem" />
                {resource.tokenBudget.toLocaleString()}
              </span>
              {[...resource.characterNames, ...resource.personaNames].slice(0, grid ? 2 : 1).map((name) => (
                <span key={name} className="mari-chrome-muted-badge max-w-36 truncate">
                  {name}
                </span>
              ))}
              {resource.tags.slice(0, grid ? 2 : 1).map((tag) => (
                <span key={tag} className="mari-chrome-muted-badge max-w-28 truncate">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          {!selection.selectionMode && (
            <div className="pointer-events-none absolute bottom-2 right-2 z-[3] flex gap-0.5 rounded-md bg-[var(--sidebar)] p-1 opacity-0 ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100 [&_button]:pointer-events-auto">
              <ChatResourceActionButton
                payload={{ version: 1, kind: "lorebook", ids: [resource.id], label: resource.name }}
              />
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void duplicateResource(resource);
                }}
                disabled={duplicatingId === resource.id}
                className="mari-chrome-control mari-chrome-control--small p-1.5"
                title={t("ui.lorebooks.lorebooklibraryview.duplicate")}
                aria-label={t("ui.lorebooks.lorebooklibraryview.duplicateNamed", { name: resource.name })}
              >
                <Copy size="0.75rem" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  editResource(resource.id);
                }}
                className="mari-chrome-control mari-chrome-control--small p-1.5"
                title={t("ui.lorebooks.lorebooklibraryview.edit")}
                aria-label={t("ui.lorebooks.lorebooklibraryview.editNamed", { name: resource.name })}
              >
                <Pencil size="0.75rem" />
              </button>
            </div>
          )}
        </article>
        {!selection.selectionMode && previewSelected && (
          <div className="lg:hidden">
            <LorebookDetail
              resource={resource}
              active={active}
              onEdit={() => editResource(resource.id)}
              onDuplicate={() => void duplicateResource(resource)}
            />
          </div>
        )}
      </Fragment>
    );
  };

  return (
    <div
      data-component="LorebookLibraryView"
      className="mari-chrome-token-scope flex h-full min-h-0 flex-col bg-[var(--background)] text-[var(--marinara-chat-chrome-panel-text)]"
    >
      <header className="z-10 border-b border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--card)]/92">
        <div className="flex flex-col gap-3 px-3 py-3 md:px-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={closeLibrary}
              className="mari-chrome-control h-10 w-10 shrink-0 p-0"
              title={t("ui.lorebooks.lorebooklibraryview.close")}
              aria-label={t("ui.lorebooks.lorebooklibraryview.close")}
            >
              <ArrowLeft size="0.95rem" />
            </button>
            <div className="min-w-0">
              <p className="text-[0.625rem] font-semibold uppercase text-[var(--marinara-chat-chrome-panel-muted)]">
                {t("ui.lorebooks.lorebooklibraryview.title")}
              </p>
              <h1 className="truncate text-xl font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                {t("ui.lorebooks.lorebooklibraryview.heading")}
              </h1>
              <p role="status" className="text-xs text-[var(--marinara-chat-chrome-panel-muted)]">
                {t("ui.lorebooks.lorebooklibraryview.loadedCount", { count: resources.length })}
              </p>
            </div>
          </div>
          <div className="grid w-full grid-cols-[auto_repeat(3,minmax(0,1fr))] gap-1.5 lg:w-[30rem]">
            <div
              role="group"
              aria-label={t("ui.characters.characterlibraryview.viewMode")}
              className="flex h-10 items-center gap-0.5 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)]/70 p-1 md:h-9"
            >
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-pressed={viewMode === "list"}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md focus-visible:outline-2",
                  viewMode === "list" &&
                    "bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-accent)]",
                )}
                aria-label={t("ui.characters.characterlibraryview.listView")}
              >
                <List size="0.875rem" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-pressed={viewMode === "grid"}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md focus-visible:outline-2",
                  viewMode === "grid" &&
                    "bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-accent)]",
                )}
                aria-label={t("ui.characters.characterlibraryview.gridView")}
              >
                <Grid3X3 size="0.875rem" />
              </button>
            </div>
            <button
              type="button"
              onClick={selection.selectionMode ? selection.exitSelectionMode : selection.enterSelectionMode}
              aria-pressed={selection.selectionMode}
              className={cn(toolbarButtonClass, selection.selectionMode && "mari-chrome-control--selected")}
              title={t("ui.lorebooks.lorebooklibraryview.selectLorebooks")}
              aria-label={t("ui.lorebooks.lorebooklibraryview.selectLorebooks")}
            >
              {selection.selectionMode ? <X size="0.75rem" /> : <CheckSquare2 size="0.75rem" />}
            </button>
            <button
              type="button"
              onClick={() => openModal("create-lorebook")}
              className="mari-panel-gradient-button mari-panel-gradient--lorebooks h-10 px-3 md:h-9"
              title={t("ui.lorebooks.lorebooklibraryview.create")}
              aria-label={t("ui.lorebooks.lorebooklibraryview.create")}
            >
              <Plus size="0.75rem" />
            </button>
            <button
              type="button"
              onClick={() => openModal("import-lorebook")}
              className={toolbarButtonClass}
              title={t("ui.lorebooks.lorebooklibraryview.import")}
              aria-label={t("ui.lorebooks.lorebooklibraryview.import")}
            >
              <Download size="0.75rem" />
            </button>
            <label className="relative col-span-4 min-w-0 sm:col-span-2">
              <span className="sr-only">{t("ui.lorebooks.lorebooklibraryview.search")}</span>
              <Search
                size="0.75rem"
                className="mari-chrome-field-icon pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("ui.lorebooks.lorebooklibraryview.search")}
                className={cn(toolbarFieldClass, "w-full pl-7 pr-2.5")}
              />
            </label>
            <label className="min-w-0">
              <span className="sr-only">{t("ui.lorebooks.lorebooklibraryview.category")}</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as LorebookPanelCategory)}
                className={cn(toolbarFieldClass, "w-full px-2")}
              >
                {CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(`ui.lorebooks.lorebooklibraryview.category.${option.key}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0">
              <span className="sr-only">{t("ui.lorebooks.lorebooklibraryview.activeFilter")}</span>
              <select
                value={activeFilter}
                onChange={(event) => setActiveFilter(event.target.value === "active" ? "active" : "all")}
                className={cn(toolbarFieldClass, "w-full px-2")}
              >
                <option value="all">{t("ui.lorebooks.lorebooklibraryview.allStatuses")}</option>
                <option value="active" disabled={!activeChat}>
                  {t("ui.lorebooks.lorebooklibraryview.activeChat")}
                </option>
              </select>
            </label>
            <label className="relative col-span-2 min-w-0">
              <span className="sr-only">{t("ui.panels.agentspanel.sortOrder")}</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as LorebookPanelSort)}
                className={cn(toolbarFieldClass, "w-full appearance-none pl-2.5 pr-7")}
              >
                <option value="name-asc">{t("ui.characters.characterlibraryview.nameAZ")}</option>
                <option value="name-desc">{t("ui.characters.characterlibraryview.nameZA")}</option>
                <option value="newest">{t("ui.characters.characterlibraryview.newest")}</option>
                <option value="oldest">{t("ui.characters.characterlibraryview.oldest")}</option>
                <option value="tokens">{t("ui.lorebooks.lorebooklibraryview.tokenBudget")}</option>
              </select>
              <ArrowUpDown
                size="0.6875rem"
                className="mari-chrome-field-icon pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
              />
            </label>
          </div>
        </div>
        {selection.selectionMode && (
          <div className="flex items-center justify-between border-t border-[var(--marinara-chat-chrome-panel-divider)] px-3 py-2 md:px-6">
            <span role="status" className="text-xs text-[var(--marinara-chat-chrome-panel-muted)]">
              {t("ui.lorebooks.lorebooklibraryview.selectedCount", { count: selection.selectedIds.size })}
            </span>
            <button
              type="button"
              onClick={selection.toggleAllVisible}
              aria-pressed={selection.allVisibleSelected}
              className="mari-chrome-control min-h-9 px-3 text-xs"
            >
              <CheckSquare2 size="0.75rem" />
              {t(
                selection.allVisibleSelected
                  ? "ui.characters.characterlibraryview.deselectAllVisible"
                  : "ui.characters.characterlibraryview.selectAllVisible",
              )}
            </button>
          </div>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_25rem]">
        <section
          ref={scrollRef}
          onScroll={handleScroll}
          aria-label={t("ui.lorebooks.lorebooklibraryview.results")}
          className="min-h-0 overflow-y-auto px-3 py-4 md:px-6"
        >
          {pages.isLoading ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="shimmer h-24 rounded-lg" />
              <div className="shimmer h-24 rounded-lg" />
            </div>
          ) : pages.isError ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--marinara-chat-chrome-panel-border)] px-5 text-center">
              <BookOpen size="2rem" className="text-[var(--destructive)]" />
              <div>
                <h2 className="font-semibold">{t("ui.lorebooks.lorebooklibraryview.errorTitle")}</h2>
                <p className="mt-1 text-sm text-[var(--marinara-chat-chrome-panel-muted)]">
                  {t("ui.lorebooks.lorebooklibraryview.errorBody")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void pages.refetch()}
                className="mari-chrome-control mari-chrome-control--primary min-h-10 px-4 text-sm"
              >
                {t("ui.lorebooks.lorebooklibraryview.retry")}
              </button>
            </div>
          ) : resources.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--marinara-chat-chrome-panel-border)] text-center">
              <BookOpen size="2rem" className="text-amber-300" />
              <div>
                <h2 className="font-semibold">{t("ui.lorebooks.lorebooklibraryview.emptyTitle")}</h2>
                <p className="mt-1 text-sm text-[var(--marinara-chat-chrome-panel-muted)]">
                  {t("ui.lorebooks.lorebooklibraryview.emptyBody")}
                </p>
              </div>
            </div>
          ) : (
            <div className={viewMode === "grid" ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" : "space-y-2"}>
              {resources.map((resource) => renderResource(resource, viewMode === "grid"))}
            </div>
          )}
          {pages.hasNextPage && (
            <div className="sticky bottom-0 mt-4 flex justify-center border-t border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--background)]/95 py-3">
              <button
                type="button"
                onClick={() => void pages.fetchNextPage()}
                disabled={pages.isFetchingNextPage}
                className="mari-chrome-control mari-chrome-control--primary px-5 py-2 text-sm"
              >
                {pages.isFetchingNextPage
                  ? t("ui.characters.characterlibraryview.loading")
                  : t("ui.characters.characterlibraryview.loadMoreValue1Loaded", { value1: resources.length })}
              </button>
            </div>
          )}
        </section>
        <aside className="hidden min-h-0 overflow-y-auto border-l border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--card)]/65 p-5 lg:block">
          {selected ? (
            <LorebookDetail
              resource={selected}
              active={isLorebookActiveForChat(selected.source, activeContext)}
              onEdit={() => editResource(selected.id)}
              onDuplicate={() => void duplicateResource(selected)}
            />
          ) : (
            <div className="flex min-h-72 items-center justify-center text-sm text-[var(--marinara-chat-chrome-panel-muted)]">
              {t("ui.lorebooks.lorebooklibraryview.selectPreview")}
            </div>
          )}
        </aside>
      </div>
      {selection.selectionMode && (
        <SelectionActionBar
          selectedCount={selection.selectedIds.size}
          onExport={() => void exportSelected()}
          onDelete={() => void deleteSelected()}
          exporting={exporting}
          className="mx-0 px-4 md:px-6"
        />
      )}
    </div>
  );
}
