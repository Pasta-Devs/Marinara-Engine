// ──────────────────────────────────────────────
// ConnectionRow — one saved Model in the Connections panel (variant D): a focusable row that opens the model
// editor, its kind and role badges and the ⋯ menu. Every kind (chat, image, video, audio) uses the same row.
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
  SlidersHorizontal,
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
export const ROW_BUTTON = cn(
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[var(--sidebar)] active:scale-90 max-md:h-11 max-md:w-11 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11",
  FOCUS,
);

/** A kind, role or state pill at the right of a Model's second line. */
const BADGE = "shrink-0 whitespace-nowrap rounded-md px-1.5 text-[0.6875rem] font-medium leading-5";

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
  // The kind reads quieter than the roles: it says what the Model is, a role says what it does.
  const kindLabel = kind
    ? t(`connections.accounts.kind.${kind}`)
    : chatModel
      ? t("connections.accounts.section.chat")
      : row.provider === "decision"
        ? t("connections.decision.label")
        : null;
  const badges = [
    ...roles.map((role) => t(`connections.switcher.role.${role}`)),
    ...(kind && isConnectionFlagTrue(row.defaultForAgents) ? [t("connections.accounts.badge.default")] : []),
    ...(kind && isConnectionFlagTrue(row.fallbackForAgents) ? [t("connections.switcher.role.fallback")] : []),
  ];
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
    // Every saved Model has a star, so the list shows none; a Model kept without one can get it back here.
    ...(onToggleStar && !starred
      ? [{ label: t("connections.accounts.row.favourite"), icon: <Star size="0.75rem" />, onSelect: onToggleStar }]
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
        "mari-connection-model group relative flex min-h-11 min-w-0 items-center gap-1 pr-1 transition-colors hover:bg-foreground/[0.04]",
        current && "bg-foreground/[0.06]",
      )}
    >
      {/* The row opens the editor; "…" sits beside it, never inside it. */}
      <button
        type="button"
        onClick={openEditor}
        aria-current={current ? "true" : undefined}
        aria-label={
          unavailable
            ? t("connections.row.editUnavailable", { name: title, state: unavailableLabel })
            : t("connections.row.edit", { name: title })
        }
        className={cn(
          "mari-connection-model-choice min-h-11 min-w-0 flex-1 py-0.5 ps-4 text-left focus-visible:ring-inset",
          FOCUS,
        )}
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
            provider={row.provider === "decision" ? row.provider : (account?.provider ?? row.provider)}
            baseUrl={account?.baseUrl ?? row.baseUrl}
            service={mediaService(row)}
            model={row.model}
            name={account?.name ?? row.name}
            size="sm"
            dim={!!unavailable}
          />
        )}
        <span data-connection-model-copy className="min-w-0 flex-1">
          <span
            className={cn(
              "line-clamp-2 break-words text-sm font-semibold leading-5",
              unavailable ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)]",
            )}
            title={row.model && row.model !== title ? [title, row.model].join("\n") : title}
          >
            {customSettings && (
              <span title={t("connections.row.customSettings")} className="mr-1 inline-block align-[-0.125em]">
                <SlidersHorizontal size="0.75rem" className="text-[var(--muted-foreground)]" aria-hidden />
                <span className="sr-only">{t("connections.row.customSettings")}</span>
              </span>
            )}
            {title}
          </span>
          {sub && (
            <span className="block truncate text-xs leading-[1.125rem] text-[var(--muted-foreground)]" title={sub}>
              {sub}
            </span>
          )}
        </span>
        <span className="mari-connection-model-meta">
          <span
            data-connection-type
            className="min-w-0 whitespace-nowrap text-xs leading-4 text-[var(--muted-foreground)]"
          >
            {kindLabel}
          </span>
          <span data-connection-role className="flex min-w-0 flex-wrap items-center justify-start gap-1">
            {current && <Check size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" aria-hidden />}
            {unavailable ? (
              <span
                className={cn(
                  BADGE,
                  "inline-flex max-w-full items-center gap-1 border",
                  unavailable === "needs_key"
                    ? "border-[var(--marinara-app-accent-static)]/45 text-[var(--marinara-app-accent-static)]"
                    : "border-[var(--border)] text-[var(--muted-foreground)]",
                )}
              >
                {unavailable === "needs_key" ? <KeyRound size="0.5625rem" /> : <Power size="0.5625rem" />}
                <span className="min-w-0">{unavailableLabel}</span>
              </span>
            ) : (
              badges.map((badge) => (
                <span
                  key={badge}
                  title={badge}
                  className={cn(BADGE, "max-w-full whitespace-normal bg-foreground/[0.08] text-[var(--foreground)]")}
                >
                  {badge}
                </span>
              ))
            )}
          </span>
        </span>
      </button>
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
