import { useState, type TouchEvent } from "react";
import {
  BadgeCheck,
  Camera,
  Check,
  Copy,
  Film,
  GitBranch,
  ImageIcon,
  Link,
  MessageSquarePlus,
  MoreHorizontal,
  Music,
  Shuffle,
  Star,
  Trash2,
} from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { DECISION_SOURCE_BASE_URLS } from "@marinara-engine/shared";
import {
  useConnections,
  useCreateConnection,
  useDuplicateConnection,
  useDeleteConnection,
  useUpdateConnection,
} from "../../hooks/use-connections";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { isLanguageGenerationConnection } from "../../lib/connection-filters";
import { requestChatResourceAssignment } from "../../lib/chat-resource-drag";
import { resolveChatResourceDropAction } from "../../lib/chat-resource-drop-capabilities";
import { ContextMenu, type ContextMenuItem } from "../ui/ContextMenu";

const CONNECTION_ICON_COLORS = {
  from: "from-sky-400",
  to: "to-blue-500",
  ring: "ring-sky-400/40",
  badge: "bg-sky-400",
};
const PROVIDER_COLORS: Record<string, { from: string; to: string; ring: string; badge: string }> = {
  openai: CONNECTION_ICON_COLORS,
  openai_chatgpt: CONNECTION_ICON_COLORS,
  anthropic: CONNECTION_ICON_COLORS,
  claude_subscription: CONNECTION_ICON_COLORS,
  grok_subscription: CONNECTION_ICON_COLORS,
  google: CONNECTION_ICON_COLORS,
  google_vertex: CONNECTION_ICON_COLORS,
  mistral: CONNECTION_ICON_COLORS,
  cohere: CONNECTION_ICON_COLORS,
  openrouter: CONNECTION_ICON_COLORS,
  nanogpt: CONNECTION_ICON_COLORS,
  xai: CONNECTION_ICON_COLORS,
  arli: CONNECTION_ICON_COLORS,
  zai: CONNECTION_ICON_COLORS,
  deepseek: CONNECTION_ICON_COLORS,
  custom: CONNECTION_ICON_COLORS,
  image_generation: CONNECTION_ICON_COLORS,
  video_generation: CONNECTION_ICON_COLORS,
  audio: CONNECTION_ICON_COLORS,
  decision: CONNECTION_ICON_COLORS,
};
const DEFAULT_COLOR = CONNECTION_ICON_COLORS;

function getConnectionFallbackIcon(provider: string) {
  if (provider === "image_generation") return <ImageIcon size="0.75rem" />;
  if (provider === "video_generation") return <Film size="0.75rem" />;
  if (provider === "audio") return <Music size="0.75rem" />;
  return <Link size="0.75rem" />;
}

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
  createdAt?: string;
  updatedAt?: string;
};

export function ConnectionRow({
  conn,
  isSelected,
  isBulkSelected,
  selectionMode,
  onClickRow,
  isDragging,
  onDragStart,
  onDragEnd,
  onDropOnRow,
  onTouchStart,
  suppressClickRef,
  onImagePick,
  subtitle,
  badge,
  pinned,
  onTogglePin,
  onMakeDefault,
}: {
  conn: ConnectionRowData;
  isSelected: boolean;
  isBulkSelected: boolean;
  selectionMode: boolean;
  onClickRow: () => void;
  isDragging: boolean;
  onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDropOnRow: (event: React.DragEvent<HTMLDivElement>) => void;
  onTouchStart?: (event: TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => void;
  suppressClickRef?: { current: boolean };
  onImagePick: () => void;
  /** Replaces the "provider • model" line (the Connection card shows the model id). */
  subtitle?: string;
  /** One short role or kind label beside the name. */
  badge?: string | null;
  /** Favourite state; the star action shows only with `onTogglePin`. */
  pinned?: boolean;
  onTogglePin?: () => void;
  /** Shown only when the row does not hold the role yet. */
  onMakeDefault?: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const duplicateConnection = useDuplicateConnection();
  const deleteConnection = useDeleteConnection();
  const updateConnection = useUpdateConnection();
  const createConnection = useCreateConnection();
  const { data: allConnections } = useConnections();
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const activeChat = useChatStore((state) => state.activeChat);
  const [menu, setMenu] = useState<{ x: number; y: number; keyboard: boolean } | null>(null);
  const inRandomPool = conn.useForRandom === "true";

  const resourcePayload = {
    version: 1 as const,
    kind: "connection" as const,
    ids: [conn.id],
    label: conn.name,
    ...(isLanguageGenerationConnection(conn) ? {} : { unsupported: "connection-kind" as const }),
  };
  const chatAction = activeChat ? resolveChatResourceDropAction(resourcePayload, activeChat) : null;
  const canShuffle = conn.provider !== "audio" && conn.provider !== "decision";
  const toggleRandomPool = () => updateConnection.mutate({ id: conn.id, useForRandom: !inRandomPool });
  const duplicate = () =>
    duplicateConnection.mutate(conn.id, {
      onSuccess: (data: any) => {
        if (data?.id) openConnectionDetail(data.id);
      },
    });
  // OpenRouter lends its key to hosted Jev. A Custom connection lends its server, model and key,
  // so the chat model it already runs answers decisions.
  const decisionFromChat = conn.provider === "custom";
  const canLendToDecisions = conn.provider === "openrouter" || (decisionFromChat && !!conn.model?.trim());
  const useForDecisions = () =>
    createConnection.mutate(
      {
        name: localizeUi("connections.decision.linkedName", { name: conn.name }),
        provider: "decision",
        decisionSource: decisionFromChat ? "openai_compatible" : "openrouter",
        baseUrl: decisionFromChat ? (conn.baseUrl ?? "") : DECISION_SOURCE_BASE_URLS.openrouter,
        apiKey: "",
        model: decisionFromChat ? conn.model.trim() : "jev-latest",
        credentialsFromConnectionId: conn.id,
        defaultForAgents: !(allConnections as ConnectionRowData[] | undefined)?.some(
          (row) => row.provider === "decision" && (row.defaultForAgents === true || row.defaultForAgents === "true"),
        ),
      },
      {
        onSuccess: (created) => openConnectionDetail((created as { id: string }).id),
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : localizeUi("connections.decision.saveFailed")),
      },
    );
  const remove = async () => {
    if (
      !(await showConfirmDialog({
        title: localizeUi("ui.panels.connectionrow.deleteConnection"),
        message: localizeUi("ui.panels.characterspanel.deleteValue1ThisCannotBeUndone", { value1: conn.name }),
        confirmLabel: localizeUi("lorebook.editor.batch.delete"),
        tone: "destructive",
      }))
    ) {
      return;
    }
    deleteConnection.mutate(conn.id);
  };
  const pinLabel = pinned
    ? localizeUi("connections.accounts.row.unfavourite")
    : localizeUi("connections.accounts.row.favourite");
  const pictureLabel = conn.imagePath
    ? localizeUi("ui.panels.connectionrow.replaceConnectionPicture")
    : localizeUi("ui.panels.connectionrow.uploadConnectionPicture");
  // One ⋯ menu holds every row action, on every pointer; the row itself opens the editor.
  const menuItems: ContextMenuItem[] = [
    ...(chatAction && chatAction.type !== "blocked"
      ? [
          {
            label: localizeUi("ui.chat.chatresourceactionbutton.addToActiveChat", { name: conn.name }),
            icon: <MessageSquarePlus size="0.75rem" />,
            onSelect: () => requestChatResourceAssignment(resourcePayload),
          },
        ]
      : []),
    ...(onTogglePin ? [{ label: pinLabel, icon: <Star size="0.75rem" />, onSelect: onTogglePin }] : []),
    ...(onMakeDefault
      ? [
          {
            label: localizeUi("connections.accounts.row.makeDefault"),
            icon: <BadgeCheck size="0.75rem" />,
            onSelect: onMakeDefault,
          },
        ]
      : []),
    ...(canShuffle
      ? [
          {
            label: inRandomPool
              ? localizeUi("connections.accounts.row.removeFromShuffle")
              : localizeUi("connections.accounts.row.addToShuffle"),
            icon: <Shuffle size="0.75rem" />,
            onSelect: toggleRandomPool,
          },
        ]
      : []),
    ...(canLendToDecisions
      ? [
          {
            label: localizeUi(decisionFromChat ? "connections.decision.chatShortcut" : "connections.decision.shortcut"),
            icon: <GitBranch size="0.75rem" />,
            onSelect: useForDecisions,
            disabled: createConnection.isPending,
          },
        ]
      : []),
    { label: localizeUi("ui.presets.sectionstab.duplicate"), icon: <Copy size="0.75rem" />, onSelect: duplicate },
    { label: pictureLabel, icon: <Camera size="0.75rem" />, onSelect: onImagePick },
    {
      label: localizeUi("lorebook.editor.batch.delete"),
      icon: <Trash2 size="0.75rem" />,
      onSelect: () => void remove(),
      destructive: true,
    },
  ];

  const colors = PROVIDER_COLORS[conn.provider] ?? DEFAULT_COLOR;
  const iconContent = conn.imagePath ? (
    <img src={conn.imagePath} alt="" className="h-full w-full object-cover" draggable={false} />
  ) : (
    getConnectionFallbackIcon(conn.provider)
  );
  const iconFrameClasses = cn(
    "relative flex h-6 w-6 shrink-0 items-center justify-center overflow-visible rounded-lg text-white shadow-sm",
    conn.imagePath ? "bg-[var(--muted)]" : `bg-gradient-to-br ${colors.from} ${colors.to}`,
  );

  return (
    <div
      data-connection-id={conn.id}
      data-touch-drag-card="connection"
      data-drag-id={conn.id}
      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
      data-drag-kind="connection"
      data-drag-payload={JSON.stringify({
        version: 1,
        kind: "connection",
        ids: [conn.id],
        label: conn.name,
        ...(isLanguageGenerationConnection(conn) ? {} : { unsupported: "connection-kind" }),
      })}
      onMouseDown={onTouchStart}
      onTouchStart={(event) => {
        onTouchStart?.(event);
      }}
      onClick={() => {
        if (suppressClickRef?.current) return;
        onClickRow();
      }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={onDropOnRow}
      className={cn(
        "group relative flex min-h-11 touch-pan-y cursor-grab active:cursor-grabbing items-center gap-2.5 rounded-lg px-2 py-1.5 transition-all hover:bg-[var(--sidebar-accent)] md:min-h-10",
        isSelected && `ring-1 ${colors.ring} bg-[var(--sidebar-accent)]/50`,
        selectionMode && isBulkSelected && "ring-1 ring-[var(--border)] bg-[var(--sidebar-accent)]/70",
        isDragging && "opacity-50",
      )}
    >
      {selectionMode && (
        <div
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
            isBulkSelected
              ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-button-text-active)]"
              : "border-[var(--muted-foreground)]/40 bg-[var(--secondary)] text-transparent",
          )}
          aria-hidden="true"
        >
          {isBulkSelected && <Check size="0.75rem" />}
        </div>
      )}
      <span className={iconFrameClasses} aria-hidden="true">
        <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-lg">{iconContent}</span>
        {!selectionMode && isSelected && (
          <span
            className={cn(
              "pointer-events-none absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full ring-1 ring-[var(--sidebar)]",
              colors.badge,
            )}
          >
            <Check size="0.5rem" className="text-white" />
          </span>
        )}
      </span>
      {/* The ⋯ button sits in this right gutter on every pointer, so the name and badge never run under it. */}
      <div className="min-w-0 flex-1 pr-9 max-md:pr-11 [@media(pointer:coarse)]:pr-11">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-sm leading-5" title={conn.name}>
            {conn.name}
          </span>
          {/* Presets' DEFAULT badge; the badge rule is unlayered, so the readable foreground needs `!`. */}
          {badge && (
            <span className="mari-chrome-muted-badge shrink-0 rounded px-1 py-0.5 text-[0.5625rem] uppercase leading-none tracking-wide !text-[var(--foreground)]">
              {badge}
            </span>
          )}
          {pinned && (
            <Star
              size="0.625rem"
              className="shrink-0 fill-current text-[var(--muted-foreground)]"
              aria-label={localizeUi("connections.accounts.row.favourited")}
            />
          )}
        </div>
        <div className="truncate text-[0.6875rem] leading-4 text-[var(--muted-foreground)]" title={subtitle}>
          {subtitle ?? `${conn.provider} • ${conn.model || localizeUi("connections.accounts.row.noModel")}`}
        </div>
      </div>
      {!selectionMode && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setMenu({ x: rect.right, y: rect.bottom, keyboard: e.detail === 0 });
          }}
          // Hover and keyboard focus reveal it on a mouse; touch screens always show it at 44 px.
          className={cn(
            "absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-[opacity,background-color,color] hover:bg-[var(--sidebar)] hover:text-[var(--foreground)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] active:scale-90",
            "opacity-0 group-hover:opacity-100 max-md:h-11 max-md:w-11 max-md:opacity-100 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 [@media(pointer:coarse)]:opacity-100",
            menu && "opacity-100",
          )}
          title={localizeUi("connections.accounts.row.actions", { name: conn.name })}
          aria-label={localizeUi("connections.accounts.row.actions", { name: conn.name })}
          aria-haspopup="menu"
          aria-expanded={!!menu}
        >
          <MoreHorizontal size="1rem" />
        </button>
      )}
      {menu && (
        // The menu is portalled, but React events still bubble to the row; keep them off its click and drag.
        <span
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <ContextMenu
            x={menu.x}
            y={menu.y}
            items={menuItems}
            autoFocus={menu.keyboard}
            onClose={() => setMenu(null)}
          />
        </span>
      )}
    </div>
  );
}
