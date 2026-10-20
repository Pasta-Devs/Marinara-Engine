// ──────────────────────────────────────────────
// ConnectionRow — one saved Model in the Connections panel: the shared two-line ModelRow plus its ⋯ menu.
// ModelRow is the one model row of the panel, the connection editor, the shared picker and the chat switcher;
// only its end control differs (⋯, ›, ✓ and star).
// ──────────────────────────────────────────────
import {
  useId,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  AudioLines,
  BadgeCheck,
  Camera,
  Check,
  Copy,
  Film,
  Folder,
  GitBranch,
  ImageIcon,
  KeyRound,
  MoreHorizontal,
  MoveRight,
  Pencil,
  Power,
  Scale,
  Shuffle,
  Star,
  Trash2,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "sonner";
import {
  DECISION_SOURCE_BASE_URLS,
  isChatProvider,
  type ConnectionAccountListItem,
  type ConnectionModelCost,
  type ModelCatalogPricing,
} from "@marinara-engine/shared";
import {
  useConnections,
  useCreateConnection,
  useDeleteConnection,
  useDuplicateConnection,
  useUpdateConnection,
  type CachedCatalogFacts,
} from "../../hooks/use-connections";
import { useUIStore } from "../../stores/ui.store";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { api } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { isConnectionFlagTrue, isLanguageGenerationConnection } from "../../lib/connection-filters";
import { clearActiveChatResourceDrag, writeChatResourceDragPayload } from "../../lib/chat-resource-drag";
import { roleBadges } from "../../lib/connection-groups";
import { modelKindOf, modelSubtitle, type ModelKind } from "../../lib/connection-identity";
import { ContextMenu, type ContextMenuItem } from "../ui/ContextMenu";
import { ProviderIcon } from "./ProviderIcon";
import { CostBadge, RetiringHint, costBadgeShows } from "./CostBadge";

export type ConnectionRowData = {
  credentialsFromConnectionId?: string | null;
  profileImportReviewRequired?: boolean | string;
  id: string;
  name: string;
  provider: string;
  baseUrl?: string;
  model: string;
  imagePath?: string | null;
  icon?: string | null;
  useForRandom?: string;
  isDefault?: boolean | string;
  fallbackForMain?: boolean | string;
  defaultForAgents?: boolean | string;
  fallbackForAgents?: boolean | string;
  enableCaching?: boolean | string;
  anthropicExtendedCacheTtl?: boolean | string;
  cachingAtDepth?: number;
  embeddingModel?: string | null;
  embeddingBaseUrl?: string | null;
  embeddingConnectionId?: string | null;
  openrouterProvider?: string | null;
  imageGenerationSource?: string | null;
  comfyuiWorkflow?: string | null;
  imageService?: string | null;
  imageEndpointId?: string | null;
  videoGenerationSource?: string | null;
  videoService?: string | null;
  audioSource?: string | null;
  defaultParameters?: string | null;
  promptPresetId?: string | null;
  maxContext?: number;
  maxTokensOverride?: number | null;
  maxParallelJobs?: number;
  claudeFastMode?: boolean | string;
  folderId?: string | null;
  sortOrder?: number;
  accountId?: string | null;
  pinnedModels?: unknown;
  showUsageWidget?: boolean | string;
  /** Settings of its own (a name, parameters, limits…): the Model stays without a star (decision 30). */
  ownSettings?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const MEDIA_KIND: Record<string, "image" | "video" | "audio"> = {
  image_generation: "image",
  video_generation: "video",
  audio: "audio",
};
export const isMediaRow = (row: Pick<ConnectionRowData, "provider">) => row.provider in MEDIA_KIND;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]";
/** The ⋯ beside a row or card heading: the shared quiet icon button. */
export const ROW_BUTTON = "mari-connection-btn mari-connection-btn--ghost mari-connection-btn--icon";

export type MenuAt = { x: number; y: number; keyboard: boolean };
export const menuAt = (event: MouseEvent<HTMLElement>): MenuAt => {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: rect.right, y: rect.bottom, keyboard: event.detail === 0 };
};
/** The menus are portalled, but React events still bubble to the row; keep them off its click. */
const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

/** A media Connection's service (ComfyUI, fal…), for its brand icon. */
export const mediaService = (row: ConnectionRowData) =>
  row.imageService ||
  row.imageGenerationSource ||
  row.videoService ||
  row.videoGenerationSource ||
  row.audioSource ||
  null;

/** A Model's role labels: chat roles, or a media kind's Default and Fallback. */
export function modelRoleLabels(row: ConnectionRowData, t: TFunction): string[] {
  const media = row.provider in MEDIA_KIND;
  return [
    ...(isChatProvider(row.provider)
      ? roleBadges(row)
          .filter((role) => role !== "random")
          .map((role) => t(`connections.switcher.role.${role}`))
      : []),
    ...(media && isConnectionFlagTrue(row.defaultForAgents) ? [t("connections.accounts.badge.default")] : []),
    ...(media && isConnectionFlagTrue(row.fallbackForAgents) ? [t("connections.switcher.role.fallback")] : []),
  ];
}

/** Kept for callers that import it from here; the formatter lives in lib/connection-identity. */
export { modelSubtitle };

const KIND_PILL: Record<Exclude<ModelKind, "chat">, { icon: LucideIcon; label: string }> = {
  image: { icon: ImageIcon, label: "connections.accounts.kind.image" },
  video: { icon: Film, label: "connections.accounts.kind.video" },
  voice: { icon: AudioLines, label: "connections.add.kind.voice" },
  decision: { icon: Scale, label: "connections.decision.label" },
};

type DataAttributes = { [key: `data-${string}`]: string | boolean | undefined };

/**
 * The one model row: line 1 tile, name, one role badge and "+N"; line 2 the kind pill (not for chat), the model id
 * and the custom-settings glyph, with the cost badge under the role badge. `trailing` sits inside the row button (› or ✓); `end` holds sibling controls
 * (⋯, star, fix), so no button nests in another. `onPictureClick` turns the tile into its own button.
 */
export function ModelRow({
  tile,
  title,
  tooltip,
  subtitle,
  kind,
  roles = [],
  roleSlots = 2,
  badgesBelow = false,
  status,
  customized = false,
  cost,
  showPaid = false,
  pricing,
  retiring,
  details,
  lead,
  current = false,
  dim = false,
  trailing,
  end,
  onPictureClick,
  pictureLabel,
  rowProps,
  className,
  ...button
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> &
  DataAttributes & {
    tile: ReactNode;
    title: string;
    /** The name's tooltip; the name by default. */
    tooltip?: string;
    subtitle?: string | null;
    /** Chat shows no pill. */
    kind?: ModelKind | null;
    /** Localized role labels; the first shows, the rest fold into "+N". */
    roles?: readonly string[];
    /** How many role names show before the rest fold into "+N". */
    roleSlots?: 1 | 2;
    /** The role and cost badges on a third line under the text instead of a column at the row end (folder view). */
    badgesBelow?: boolean;
    /** Why it cannot run now (its Connection needs a key or is off…); replaces the role badge. */
    status?: { label: string; state?: string } | null;
    customized?: boolean;
    /** The cost badge at the end of line 2 (CostBadge decides whether it shows). */
    cost?: ConnectionModelCost;
    showPaid?: boolean;
    /** A pay-per-use model's price, shown instead of "Paid" when known. */
    pricing?: ModelCatalogPricing;
    /** The provider retires the model: a quiet amber hint on line 2. */
    retiring?: { deprecated?: boolean; retiresAt?: string } | null;
    /** More facts after the model id on line 2 (context size…). */
    details?: ReactNode;
    /** Before the tile inside the row button, such as a Defaults role name. */
    lead?: ReactNode;
    current?: boolean;
    dim?: boolean;
    trailing?: ReactNode;
    end?: ReactNode;
    /** Opens the picture menu at the tile. */
    onPictureClick?: (at: MenuAt) => void;
    pictureLabel?: string;
    rowProps?: HTMLAttributes<HTMLDivElement> & DataAttributes;
  }) {
  const { t } = useTranslation();
  const copyId = useId();
  const pill = kind && kind !== "chat" ? KIND_PILL[kind] : null;
  // Two role names fit; only a third or more folds into "+N" (a tooltip alone would hide them on touch).
  const rest = roles.slice(roleSlots);
  const id = subtitle && subtitle.trim().toLowerCase() !== title.trim().toLowerCase() ? subtitle : null;
  const line2 = !!(pill || id || details || retiring || customized);
  // CostBadge's own rule, so the third line never shows empty.
  const costShown = useUIStore((s) => s.showCostBadges) && costBadgeShows(cost, showPaid, pricing);
  // Role or status, as before: a status (Needs key, Off) replaces the role badge.
  const badge = status ? (
    <span
      data-connection-role
      className={cn("mari-connection-pill shrink-0", status.state === "needs_key" && "mari-connection-pill--warn")}
    >
      {status.state === "needs_key" ? (
        <KeyRound size="0.5625rem" />
      ) : status.state === "off" ? (
        <Power size="0.5625rem" />
      ) : null}
      {status.label}
    </span>
  ) : roles.length > 0 ? (
    <span data-connection-role className="flex shrink-0 items-center gap-1" title={roles.join(", ")}>
      <span className="mari-connection-pill mari-connection-pill--strong">{roles[0]}</span>
      {roleSlots > 1 && roles[1] && <span className="mari-connection-pill">{roles[1]}</span>}
      {rest.length > 0 && (
        <span className="mari-connection-pill">
          <span aria-hidden>+{rest.length}</span>
          <span className="sr-only">{t("connections.row.moreRoles", { roles: rest.join(", ") })}</span>
        </span>
      )}
    </span>
  ) : null;
  return (
    <div
      {...rowProps}
      className={cn(
        "mari-connection-model group relative flex min-w-0 items-center gap-1 pe-1 transition-colors hover:bg-foreground/[0.04]",
        current && "bg-foreground/[0.06]",
        rowProps?.className,
      )}
    >
      {current && (
        <span
          aria-hidden
          className="mari-panel-gradient--connections pointer-events-none absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--mari-panel-gradient-start)]"
        />
      )}
      {onPictureClick && (
        <button
          type="button"
          onClick={(event) => onPictureClick(menuAt(event))}
          aria-label={pictureLabel}
          title={pictureLabel}
          className={cn("ms-2 flex min-h-11 shrink-0 items-center justify-center rounded-lg", FOCUS)}
        >
          {tile}
        </button>
      )}
      <button
        type="button"
        aria-describedby={button["aria-label"] ? copyId : undefined}
        {...button}
        className={cn(
          // Text starts 3.25rem in: tile 0.5rem in and 2rem wide, then 0.75rem, with or without the picture button.
          "mari-connection-model-choice flex min-h-14 min-w-0 flex-1 items-center gap-3 py-1.5 ps-2 text-left focus-visible:ring-inset disabled:cursor-not-allowed",
          FOCUS,
          className,
        )}
      >
        {lead}
        {!onPictureClick && tile}
        <span id={copyId} data-connection-model-copy className="min-w-0 flex-1">
          <span
            data-model-title
            className={cn(
              "block min-w-0 truncate text-[0.8125rem] font-semibold leading-5",
              dim ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)]",
            )}
            title={tooltip ?? title}
          >
            {title}
          </span>
          {line2 && (
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs leading-[1.125rem] text-[var(--muted-foreground)]">
              {pill && (
                <span data-connection-type className="mari-connection-pill">
                  <pill.icon size="0.6875rem" aria-hidden />
                  {t(pill.label)}
                </span>
              )}
              {id && (
                <span className="min-w-0 truncate tabular-nums" title={id}>
                  {id}
                </span>
              )}
              {/* Custom settings: a quiet person-and-gear mark right after the model id it adjusts; hover names it. */}
              {customized && (
                <span data-model-customized title={t("connections.row.customSettings")} className="flex shrink-0">
                  <UserCog size="0.6875rem" aria-hidden />
                  <span className="sr-only">{t("connections.row.customSettings")}</span>
                </span>
              )}
              {details}
              {retiring && (
                <span className="ms-auto flex shrink-0">
                  <RetiringHint deprecated={retiring.deprecated} retiresAt={retiring.retiresAt} />
                </span>
              )}
            </span>
          )}
          {badgesBelow && (badge || costShown) && (
            <span data-connection-badges className="mt-1 flex flex-wrap items-center gap-1">
              {badge}
              <CostBadge cost={cost} showPaid={showPaid} pricing={pricing} />
            </span>
          )}
        </span>
        {/* Badges: one column at the row end. Line 1 says what the model does (role or status), line 2 what it
            costs, each on its text line; a row with one text line and no cost keeps the role centred. */}
        {!badgesBelow && (badge || cost) && (
          <span data-connection-badges className="flex shrink-0 flex-col items-end">
            <span className={cn("flex items-center", (line2 || cost) && "min-h-5")}>{badge}</span>
            {(line2 || cost) && (
              <span className="mt-0.5 flex min-h-[1.125rem] items-center">
                <CostBadge cost={cost} showPaid={showPaid} pricing={pricing} />
              </span>
            )}
          </span>
        )}
        {trailing}
      </button>
      {end}
    </div>
  );
}

export function ConnectionRow({
  row,
  account,
  subtitle,
  connectionName,
  current = false,
  starred,
  onToggleStar,
  onUseInChat,
  moveTargets,
  onMove,
  folderName,
  onChooseFolder,
  onPictureClick,
  catalog,
}: {
  row: ConnectionRowData;
  /** The Connection the Model runs on; a Connection without a key, or off, makes the Model unavailable. */
  account?: ConnectionAccountListItem;
  subtitle?: string;
  /** Search results name the Connection before the model id. */
  connectionName?: string;
  /** The active chat runs this Model. */
  current?: boolean;
  /** Chat Models only; media Models have no star. */
  starred?: boolean;
  onToggleStar?: () => void;
  onUseInChat?: () => void;
  /** Names of the Connections the Model can move to (the menu hint); `onMove` opens the move dialog. */
  moveTargets?: string[];
  onMove?: () => void;
  /** The Model's folder (the menu hint); `onChooseFolder` asks for another. */
  folderName?: string;
  onChooseFolder?: () => void;
  /** The tile, and "Change picture" in ⋯, open the picture menu. */
  onPictureClick?: (at: MenuAt) => void;
  /** Cost and retirement from the Connection's cached catalogs. */
  catalog?: CachedCatalogFacts;
}) {
  const { t } = useTranslation();
  const facts = catalog?.of(row.model);
  const duplicateConnection = useDuplicateConnection();
  const deleteConnection = useDeleteConnection();
  const updateConnection = useUpdateConnection();
  const createConnection = useCreateConnection();
  const { data: allConnections } = useConnections();
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const [menu, setMenu] = useState<MenuAt | null>(null);
  // A pick closes the ⋯ menu, so "Make default for…" opens a second menu at its place.
  const [subMenu, setSubMenu] = useState<{ at: MenuAt; items: ContextMenuItem[] } | null>(null);

  const chatModel = isChatProvider(row.provider);
  const kind = MEDIA_KIND[row.provider];
  const unavailable = account && account.state !== "ok" ? account.state : null;
  const inRandomPool = row.useForRandom === "true";
  const canShuffle = row.provider !== "audio" && row.provider !== "decision";
  const title = row.name?.trim() || row.model?.trim() || row.id;
  const badges = modelRoleLabels(row, t);
  // Display only: which Models show stays with the star, role and settings rules (decision 30).
  const customSettings = chatModel && !!row.ownSettings;
  const detail = subtitle ?? modelSubtitle(row);
  const sub = [connectionName, detail.trim().toLowerCase() === title.trim().toLowerCase() ? null : detail]
    .filter(Boolean)
    .join(" · ");

  const openEditor = () => openConnectionDetail(row.id);
  const duplicate = () =>
    duplicateConnection.mutate(row.id, {
      onSuccess: (data: unknown) => {
        const id = (data as { id?: string } | undefined)?.id;
        if (id) openConnectionDetail(id);
      },
    });
  // OpenRouter lends its key to hosted Jev. A Custom connection lends its server, model and key,
  // so the chat model it already runs answers decisions.
  const decisionFromChat = row.provider === "custom";
  const canLendToDecisions = row.provider === "openrouter" || (decisionFromChat && !!row.model?.trim());
  const useForDecisions = () =>
    createConnection.mutate(
      {
        name: t("connections.decision.linkedName", { name: row.name }),
        provider: "decision",
        decisionSource: decisionFromChat ? "openai_compatible" : "openrouter",
        baseUrl: decisionFromChat ? (row.baseUrl ?? "") : DECISION_SOURCE_BASE_URLS.openrouter,
        apiKey: "",
        model: decisionFromChat ? row.model.trim() : "jev-latest",
        credentialsFromConnectionId: row.id,
        defaultForAgents: !(allConnections as ConnectionRowData[] | undefined)?.some(
          (other) => other.provider === "decision" && isConnectionFlagTrue(other.defaultForAgents),
        ),
      },
      {
        onSuccess: (created) => openConnectionDetail((created as { id: string }).id),
        onError: (error) => toast.error(error instanceof Error ? error.message : t("connections.decision.saveFailed")),
      },
    );
  const remove = async () => {
    if (await confirmModelDelete(row.id, title, t)) deleteConnection.mutate(row.id);
  };

  // Media Models carry their kind's default in the agents flag.
  const defaultRoles: Array<{ label: string; field: "isDefault" | "defaultForAgents" }> = chatModel
    ? [
        { label: t("connections.defaults.role.main"), field: "isDefault" },
        { label: t("connections.defaults.role.agents"), field: "defaultForAgents" },
      ]
    : kind
      ? [{ label: t(`connections.accounts.kind.${kind}`), field: "defaultForAgents" }]
      : [];
  const openSub = (items: ContextMenuItem[]) => menu && setSubMenu({ at: menu, items });

  const menuItems: ContextMenuItem[] = [
    ...(onUseInChat && !unavailable
      ? [
          {
            label: t("connections.row.useInChat"),
            hint: t("connections.row.useInChatHint"),
            icon: <Check size="0.75rem" />,
            onSelect: onUseInChat,
          },
        ]
      : []),
    ...(defaultRoles.length
      ? [
          {
            label: t("connections.row.makeDefaultFor"),
            icon: <BadgeCheck size="0.75rem" />,
            onSelect: () =>
              openSub(
                defaultRoles.map((role) => ({
                  label: role.label,
                  checked: isConnectionFlagTrue(row[role.field]),
                  onSelect: () => updateConnection.mutate({ id: row.id, [role.field]: true }),
                })),
              ),
          },
        ]
      : []),
    // Every saved Model has a star, so the list shows none; a Model kept without one can get it back here.
    ...(onToggleStar && !starred
      ? [{ label: t("connections.accounts.row.favourite"), icon: <Star size="0.75rem" />, onSelect: onToggleStar }]
      : []),
    { label: t("connections.row.editModel"), icon: <Pencil size="0.75rem" />, onSelect: openEditor },
    ...(onMove && moveTargets?.length
      ? [
          {
            label: t("connections.accounts.row.moveTo"),
            hint: moveTargets.join(", "),
            icon: <MoveRight size="0.75rem" />,
            onSelect: onMove,
          },
        ]
      : []),
    ...(onChooseFolder
      ? [
          {
            label: t("connections.folders.folder"),
            hint: folderName,
            icon: <Folder size="0.75rem" />,
            onSelect: onChooseFolder,
          },
        ]
      : []),
    { label: t("ui.presets.sectionstab.duplicate"), icon: <Copy size="0.75rem" />, onSelect: duplicate },
    ...(canShuffle
      ? [
          {
            label: inRandomPool
              ? t("connections.accounts.row.removeFromShuffle")
              : t("connections.accounts.row.addToShuffle"),
            icon: <Shuffle size="0.75rem" />,
            onSelect: () => updateConnection.mutate({ id: row.id, useForRandom: !inRandomPool }),
          },
        ]
      : []),
    ...(canLendToDecisions
      ? [
          {
            label: t(decisionFromChat ? "connections.decision.chatShortcut" : "connections.decision.shortcut"),
            icon: <GitBranch size="0.75rem" />,
            onSelect: useForDecisions,
            disabled: createConnection.isPending,
          },
        ]
      : []),
    ...(onPictureClick
      ? [
          {
            label: t("connections.accounts.editor.picture"),
            icon: <Camera size="0.75rem" />,
            onSelect: () => menu && onPictureClick(menu),
          },
        ]
      : []),
    {
      label: t("connections.row.remove"),
      icon: <Trash2 size="0.75rem" />,
      onSelect: () => void remove(),
      destructive: true,
    },
  ];

  const unavailableLabel = unavailable ? t(`connections.accounts.state.${unavailable}`) : "";

  return (
    <ModelRow
      rowProps={{
        "data-connection-id": row.id,
        // Desktop only: drag the Model onto a chat to use it there.
        draggable: true,
        onDragStart: (event) => {
          event.dataTransfer.effectAllowed = "copy";
          writeChatResourceDragPayload(event.dataTransfer, {
            version: 1,
            kind: "connection",
            ids: [row.id],
            label: row.name,
            ...(isLanguageGenerationConnection(row) ? {} : { unsupported: "connection-kind" as const }),
          });
        },
        onDragEnd: clearActiveChatResourceDrag,
      }}
      onClick={openEditor}
      aria-current={current ? "true" : undefined}
      aria-label={
        unavailable
          ? t("connections.row.editUnavailable", { name: title, state: unavailableLabel })
          : t("connections.row.edit", { name: title })
      }
      tile={
        <ProviderIcon
          provider={row.provider === "decision" ? row.provider : (account?.provider ?? row.provider)}
          baseUrl={account?.baseUrl ?? row.baseUrl}
          service={mediaService(row)}
          model={row.model}
          name={account?.name ?? row.name}
          icon={row.icon}
          imagePath={row.imagePath}
          size="row"
          dim={!!unavailable}
        />
      }
      onPictureClick={onPictureClick}
      pictureLabel={t("connections.picture.change", { name: title })}
      title={title}
      // The full id, upstream prefix included, which the subtitle may drop.
      tooltip={row.model && row.model !== title ? [title, row.model].join("\n") : title}
      subtitle={sub}
      kind={modelKindOf(row.provider)}
      roles={badges}
      // A folder row names its Connection on line 2, so its badges move to a third line.
      badgesBelow={!!connectionName}
      status={unavailable ? { label: unavailableLabel, state: unavailable } : null}
      customized={customSettings}
      cost={facts?.cost}
      pricing={facts?.pricing}
      showPaid={catalog?.showPaid}
      retiring={facts}
      current={current}
      dim={!!unavailable}
      end={
        <>
          {/* The row opens the editor; "…" sits beside it, never inside it. */}
          <button
            type="button"
            onClick={(event) => {
              stop(event);
              setMenu(menuAt(event));
            }}
            className={cn(ROW_BUTTON, "text-[var(--muted-foreground)] hover:text-[var(--foreground)]")}
            title={t("connections.accounts.row.actions", { name: title })}
            aria-label={t("connections.accounts.row.actions", { name: title })}
            aria-haspopup="menu"
            aria-expanded={!!menu}
          >
            <MoreHorizontal size="1rem" />
          </button>
          {menu && (
            <span onClick={stop} onKeyDown={stop}>
              <ContextMenu
                x={menu.x}
                y={menu.y}
                items={menuItems}
                autoFocus={menu.keyboard}
                onClose={() => setMenu(null)}
              />
            </span>
          )}
          {subMenu && (
            <span onClick={stop} onKeyDown={stop}>
              <ContextMenu
                x={subMenu.at.x}
                y={subMenu.at.y}
                items={subMenu.items}
                autoFocus={subMenu.at.keyboard}
                onClose={() => setSubMenu(null)}
              />
            </span>
          )}
        </>
      }
    />
  );
}

type ModelUsage = {
  chats: Array<{ id: string; name: string }>;
  agents: Array<{ id: string; name: string }>;
  models: Array<{ id: string; name: string }>;
  settings: Array<"embedding" | "features">;
};

const listNames = (names: string[], t: TFunction) =>
  names.length > 5
    ? t("connections.delete.more", { names: names.slice(0, 5).join(", "), count: names.length - 5 })
    : names.join(", ");

/** "Used by" lines for the delete questions: the chats, agents, models and settings that use these Models. */
async function usageLines(ids: string[], skip: Set<string>, t: TFunction): Promise<string[]> {
  // A failed lookup still lets the user decide; the plain question stays.
  const all = await Promise.all(ids.map((id) => api.get<ModelUsage>(`/connections/${id}/usage`).catch(() => null)));
  const unique = (items: Array<{ name: string; id?: string }>) => [
    ...new Set(items.filter((item) => !item.id || !skip.has(item.id)).map((item) => item.name)),
  ];
  const chats = unique(all.flatMap((usage) => usage?.chats ?? []));
  const agents = unique(all.flatMap((usage) => usage?.agents ?? []));
  const models = unique(all.flatMap((usage) => usage?.models ?? []));
  const settings = [...new Set(all.flatMap((usage) => usage?.settings ?? []))];
  const lines = [
    chats.length ? t("connections.delete.chats", { names: listNames(chats, t) }) : "",
    agents.length ? t("connections.delete.agents", { names: listNames(agents, t) }) : "",
    models.length ? t("connections.delete.models", { names: listNames(models, t) }) : "",
    settings.length
      ? t("connections.delete.settings", {
          names: settings.map((key) => t(`connections.delete.setting.${key}`)).join(", "),
        })
      : "",
  ].filter(Boolean);
  return lines.length ? ["", t("connections.delete.usedBy"), ...lines, "", t("connections.delete.afterDelete")] : [];
}

/** The delete question for a saved Model; it names the chats, agents, models and settings that use it. */
export async function confirmModelDelete(id: string, title: string, t: TFunction): Promise<boolean> {
  return showConfirmDialog({
    title: t("ui.panels.connectionrow.deleteConnection"),
    message: [
      t("ui.panels.characterspanel.deleteValue1ThisCannotBeUndone", { value1: title }),
      ...(await usageLines([id], new Set([id]), t)),
    ].join("\n"),
    confirmLabel: t("lorebook.editor.batch.delete"),
    tone: "destructive",
  });
}

/** Deletes a Connection's Models one by one, so the Connection itself can go after them. */
export async function deleteAccountModels(models: Array<{ id: string }>) {
  for (const row of models) await api.delete(`/connections/${row.id}`);
}

/**
 * The delete question for a Connection, asked before anything is deleted: it names its Models and what uses them.
 * True means: delete the Models, then the Connection.
 */
export async function confirmAccountDelete(
  name: string,
  models: Array<{ id: string; name?: string | null; model?: string | null }>,
  t: TFunction,
): Promise<boolean> {
  const ids = models.map((row) => row.id);
  const modelNames = models.map((row) => row.name?.trim() || row.model || row.id);
  return showConfirmDialog({
    title: t("connections.accounts.editor.delete"),
    message: models.length
      ? [
          t("connections.accounts.editor.deleteWithModels", {
            name,
            count: models.length,
            models: listNames(modelNames, t),
          }),
          t("connections.accounts.editor.deleteKeepHint"),
          ...(await usageLines(ids, new Set(ids), t)),
        ].join("\n")
      : t("connections.accounts.editor.deleteConfirm", { name }),
    confirmLabel: models.length
      ? t("connections.accounts.editor.deleteAll", { count: models.length })
      : t("connections.accounts.editor.delete"),
    tone: "destructive",
  });
}
