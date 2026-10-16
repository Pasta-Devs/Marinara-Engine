// ──────────────────────────────────────────────
// ConnectionRow — one saved Model in the Connections panel (variant D): a focusable row that opens the model
// editor, its role badges, the star (decision 30) and the ⋯ menu.
// ──────────────────────────────────────────────
import { useState, type MouseEvent } from "react";
import {
  BadgeCheck,
  Camera,
  Check,
  Copy,
  GitBranch,
  KeyRound,
  MoreHorizontal,
  MoveRight,
  Pencil,
  Power,
  Shuffle,
  Star,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { DECISION_SOURCE_BASE_URLS, isChatProvider, type ConnectionAccountListItem } from "@marinara-engine/shared";
import {
  useConnections,
  useCreateConnection,
  useDeleteConnection,
  useDuplicateConnection,
  useUpdateConnection,
} from "../../hooks/use-connections";
import { useUIStore } from "../../stores/ui.store";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { isConnectionFlagTrue, isLanguageGenerationConnection } from "../../lib/connection-filters";
import { clearActiveChatResourceDrag, writeChatResourceDragPayload } from "../../lib/chat-resource-drag";
import { roleBadges } from "../../lib/connection-groups";
import { ContextMenu, type ContextMenuItem } from "../ui/ContextMenu";
import { ProviderIcon } from "./ProviderIcon";

export type ConnectionRowData = {
  credentialsFromConnectionId?: string | null;
  profileImportReviewRequired?: boolean | string;
  id: string;
  name: string;
  provider: string;
  baseUrl?: string;
  model: string;
  imagePath?: string | null;
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
const ROW_BUTTON = cn(
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[var(--sidebar)] active:scale-90 max-md:h-11 max-md:w-11 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11",
  FOCUS,
);

type MenuAt = { x: number; y: number; keyboard: boolean };
const menuAt = (event: MouseEvent<HTMLElement>): MenuAt => {
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

/** The model id under the name; a gateway's upstream prefix is dropped when the list already groups by it. */
export function modelSubtitle(row: ConnectionRowData, upstream: string | null = null): string {
  const model = row.model?.trim() ?? "";
  const id = upstream && model.startsWith(`${upstream}/`) ? model.slice(upstream.length + 1) : model;
  return id || row.imageService || row.imageGenerationSource || row.videoService || row.videoGenerationSource || "";
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
  onImagePick,
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
  /** Other Connections of the same service the Model can move to. */
  moveTargets?: { id: string; name: string }[];
  onMove?: (accountId: string, name: string) => void;
  onImagePick: () => void;
}) {
  const { t } = useTranslation();
  const duplicateConnection = useDuplicateConnection();
  const deleteConnection = useDeleteConnection();
  const updateConnection = useUpdateConnection();
  const createConnection = useCreateConnection();
  const { data: allConnections } = useConnections();
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const [menu, setMenu] = useState<MenuAt | null>(null);
  // A pick closes the ⋯ menu, so "Make default for…" and "Move to connection…" open a second menu at its place.
  const [subMenu, setSubMenu] = useState<{ at: MenuAt; items: ContextMenuItem[] } | null>(null);

  const chatModel = isChatProvider(row.provider);
  const kind = MEDIA_KIND[row.provider];
  const unavailable = account && account.state !== "ok" ? account.state : null;
  const inRandomPool = row.useForRandom === "true";
  const canShuffle = row.provider !== "audio" && row.provider !== "decision";
  const title = row.name?.trim() || row.model?.trim() || row.id;
  const roles = chatModel ? roleBadges(row).filter((role) => role !== "random") : [];
  const badges = [
    ...(kind ? [t(`connections.accounts.kind.${kind}`)] : []),
    ...roles.map((role) => t(`connections.switcher.role.${role}`)),
    ...(kind && isConnectionFlagTrue(row.defaultForAgents) ? [t("connections.accounts.badge.default")] : []),
    ...(kind && isConnectionFlagTrue(row.fallbackForAgents) ? [t("connections.switcher.role.fallback")] : []),
    ...(chatModel && !starred && roles.length === 0 && row.ownSettings ? [t("connections.row.customSettings")] : []),
  ];
  const sub = [connectionName, subtitle ?? modelSubtitle(row)].filter(Boolean).join(" · ");

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
    const confirmed = await showConfirmDialog({
      title: t("ui.panels.connectionrow.deleteConnection"),
      message: t("ui.panels.characterspanel.deleteValue1ThisCannotBeUndone", { value1: title }),
      confirmLabel: t("lorebook.editor.batch.delete"),
      tone: "destructive",
    });
    if (confirmed) deleteConnection.mutate(row.id);
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
    { label: t("connections.row.editModel"), icon: <Pencil size="0.75rem" />, onSelect: openEditor },
    ...(onMove && moveTargets?.length
      ? [
          {
            label: t("connections.accounts.row.moveTo"),
            hint: moveTargets.map((target) => target.name).join(", "),
            icon: <MoveRight size="0.75rem" />,
            onSelect: () =>
              openSub(
                moveTargets.map((target) => ({
                  label: target.name,
                  icon: <MoveRight size="0.75rem" />,
                  onSelect: () => onMove(target.id, target.name),
                })),
              ),
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
    {
      label: row.imagePath
        ? t("ui.panels.connectionrow.replaceConnectionPicture")
        : t("ui.panels.connectionrow.uploadConnectionPicture"),
      icon: <Camera size="0.75rem" />,
      onSelect: onImagePick,
    },
    {
      label: t("connections.row.remove"),
      icon: <Trash2 size="0.75rem" />,
      onSelect: () => void remove(),
      destructive: true,
    },
  ];

  const starLabel = starred ? t("connections.accounts.row.unfavourite") : t("connections.accounts.row.favourite");
  const unavailableLabel = unavailable ? t(`connections.accounts.state.${unavailable}`) : "";

  return (
    <div
      data-connection-id={row.id}
      // Desktop only: drag the Model onto a chat to use it there.
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "copy";
        writeChatResourceDragPayload(event.dataTransfer, {
          version: 1,
          kind: "connection",
          ids: [row.id],
          label: row.name,
          ...(isLanguageGenerationConnection(row) ? {} : { unsupported: "connection-kind" as const }),
        });
      }}
      onDragEnd={clearActiveChatResourceDrag}
      className={cn(
        "group relative flex min-h-11 min-w-0 items-center gap-1 rounded-lg pr-1 transition-colors hover:bg-[var(--sidebar-accent)]",
        current && "bg-[var(--sidebar-accent)]/40",
      )}
    >
      {current && (
        <span
          className="mari-chrome-accent-progress mari-accent-animated absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full"
          title={t("connections.row.current")}
        />
      )}
      {/* The row opens the editor; the star and "…" sit beside it, never inside it. */}
      <button
        type="button"
        onClick={openEditor}
        aria-label={
          unavailable
            ? t("connections.row.editUnavailable", { name: title, state: unavailableLabel })
            : t("connections.row.edit", { name: title })
        }
        className={cn("flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1.5 pl-2 text-left", FOCUS)}
      >
        {row.imagePath ? (
          <span
            aria-hidden
            className={cn("h-6 w-6 shrink-0 overflow-hidden rounded-lg bg-[var(--muted)]", unavailable && "opacity-40")}
          >
            <img src={row.imagePath} alt="" className="h-full w-full object-cover" draggable={false} />
          </span>
        ) : (
          <ProviderIcon
            provider={account?.provider ?? row.provider}
            baseUrl={account?.baseUrl ?? row.baseUrl}
            service={mediaService(row)}
            name={account?.name ?? row.name}
            size="sm"
            dim={!!unavailable}
          />
        )}
        <span className="block min-w-0 flex-1">
          <span
            className={cn(
              "line-clamp-2 break-words text-sm leading-5",
              unavailable ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)]",
            )}
            title={title}
          >
            {title}
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            {unavailable ? (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[0.5625rem] font-medium uppercase leading-none tracking-wide",
                  unavailable === "needs_key"
                    ? "bg-[var(--marinara-app-accent-static)]/10 text-[var(--marinara-app-accent-static)]"
                    : "bg-[var(--secondary)] text-[var(--muted-foreground)]",
                )}
              >
                {unavailable === "needs_key" ? <KeyRound size="0.5625rem" /> : <Power size="0.5625rem" />}
                {unavailableLabel}
              </span>
            ) : (
              badges.map((badge) => (
                // Presets' DEFAULT badge; the badge rule is unlayered, so the readable foreground needs `!`.
                <span
                  key={badge}
                  className="mari-chrome-muted-badge shrink-0 rounded px-1 py-0.5 text-[0.5625rem] uppercase leading-none tracking-wide !text-[var(--foreground)]"
                >
                  {badge}
                </span>
              ))
            )}
            {sub && (
              <span className="min-w-0 truncate text-[0.6875rem] leading-4 text-[var(--muted-foreground)]" title={sub}>
                {sub}
              </span>
            )}
          </span>
        </span>
      </button>
      {onToggleStar && (
        <button
          type="button"
          onClick={(event) => {
            stop(event);
            onToggleStar();
          }}
          className={cn(
            ROW_BUTTON,
            starred && !unavailable ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]",
          )}
          aria-pressed={!!starred}
          title={starLabel}
          aria-label={starLabel}
        >
          <Star
            size="0.875rem"
            className={cn(starred && "fill-current", (!starred || unavailable) && "mari-rgb-static-icon")}
          />
        </button>
      )}
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
    </div>
  );
}
