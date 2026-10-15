import { useState, type TouchEvent } from "react";
import {
  BadgeCheck,
  Camera,
  Check,
  Copy,
  Film,
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
import { useDuplicateConnection, useDeleteConnection, useUpdateConnection } from "../../hooks/use-connections";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { isLanguageGenerationConnection } from "../../lib/connection-filters";
import { requestChatResourceAssignment } from "../../lib/chat-resource-drag";
import { resolveChatResourceDropAction } from "../../lib/chat-resource-drop-capabilities";
import { ChatResourceActionButton } from "../chat/ChatResourceActionButton";
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
  if (provider === "image_generation") return <ImageIcon size="1rem" />;
  if (provider === "video_generation") return <Film size="1rem" />;
  if (provider === "audio") return <Music size="1rem" />;
  return <Link size="1rem" />;
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
  // Touch screens get one ⋯ button instead of a row of always-visible actions.
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
              ? localizeUi("ui.panels.connectionrow.inRandomPoolClickToRemove")
              : localizeUi("ui.panels.connectionrow.addToRandomPool"),
            icon: <Shuffle size="0.75rem" />,
            onSelect: toggleRandomPool,
          },
        ]
      : []),
    { label: localizeUi("ui.presets.sectionstab.duplicate"), icon: <Copy size="0.75rem" />, onSelect: duplicate },
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
    "relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br text-white shadow-sm",
    conn.imagePath ? "bg-[var(--muted)]" : `${colors.from} ${colors.to}`,
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
        "group relative flex touch-pan-y cursor-grab active:cursor-grabbing items-center gap-3 rounded-xl p-2.5 transition-all hover:bg-[var(--sidebar-accent)]",
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
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (suppressClickRef?.current) return;
          onImagePick();
        }}
        className={cn(
          "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-visible rounded-xl text-white",
          "transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--marinara-chat-chrome-focus-ring)]",
        )}
        title={
          conn.imagePath
            ? localizeUi("ui.panels.connectionrow.replaceConnectionPicture")
            : localizeUi("ui.panels.connectionrow.uploadConnectionPicture")
        }
        aria-label={
          conn.imagePath
            ? localizeUi("ui.panels.connectionrow.replaceConnectionPicture")
            : localizeUi("ui.panels.connectionrow.uploadConnectionPicture")
        }
      >
        <span className={iconFrameClasses}>
          {iconContent}
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera size="0.875rem" />
          </span>
        </span>
        {!selectionMode && isSelected && (
          <div
            className={cn(
              "pointer-events-none absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-md shadow-sm ring-1 ring-[var(--sidebar)]",
              colors.badge,
            )}
          >
            <Check size="0.625rem" className="text-white" />
          </div>
        )}
      </button>
      <div className="min-w-0 flex-1 pr-0 max-md:pr-12 [@media(pointer:coarse)]:pr-12">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium leading-5" title={conn.name}>
            {conn.name}
          </span>
          {badge && <span className="mari-chrome-muted-badge shrink-0">{badge}</span>}
          {pinned && (
            <Star
              size="0.625rem"
              className="shrink-0 fill-current text-[var(--muted-foreground)]"
              aria-label={localizeUi("connections.accounts.row.favourited")}
            />
          )}
        </div>
        <div className="truncate text-[0.6875rem] leading-4 text-[var(--muted-foreground)]" title={subtitle}>
          {subtitle ?? `${conn.provider} • ${conn.model || "No model set"}`}
        </div>
      </div>
      <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 flex shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-foreground/10 transition-opacity group-hover:opacity-100 [@media(pointer:fine)]:group-focus-within:opacity-100 max-md:hidden [@media(pointer:coarse)]:hidden group-hover:[&_button]:pointer-events-auto [@media(pointer:fine)]:group-focus-within:[&_button]:pointer-events-auto">
        <ChatResourceActionButton payload={resourcePayload} />
        {onTogglePin && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            className="mari-chrome-control mari-chrome-control--small p-1.5"
            title={pinLabel}
            aria-label={pinLabel}
            aria-pressed={!!pinned}
          >
            <Star size="0.75rem" className={cn(pinned && "fill-current")} />
          </button>
        )}
        {onMakeDefault && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMakeDefault();
            }}
            className="mari-chrome-control mari-chrome-control--small p-1.5"
            title={localizeUi("connections.accounts.row.makeDefault")}
            aria-label={localizeUi("connections.accounts.row.makeDefault")}
          >
            <BadgeCheck size="0.75rem" />
          </button>
        )}
        {canShuffle && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleRandomPool();
            }}
            className={cn(
              "rounded-lg p-1.5 transition-all active:scale-90",
              inRandomPool
                ? "bg-foreground/10 text-foreground/75 ring-1 ring-foreground/20"
                : "text-foreground/45 hover:bg-foreground/10 hover:text-foreground/75",
            )}
            title={
              inRandomPool
                ? localizeUi("ui.panels.connectionrow.inRandomPoolClickToRemove")
                : localizeUi("ui.panels.connectionrow.addToRandomPool")
            }
          >
            <Shuffle size="0.75rem" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            duplicate();
          }}
          className="mari-chrome-control mari-chrome-control--small p-1.5"
          title={localizeUi("ui.presets.sectionstab.duplicate")}
        >
          <Copy size="0.75rem" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            void remove();
          }}
          className="mari-chrome-control mari-chrome-control--small p-1.5"
          title={localizeUi("lorebook.editor.batch.delete")}
        >
          <Trash2 size="0.75rem" />
        </button>
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
          className="mari-chrome-control mari-chrome-control--small absolute right-1 top-1/2 hidden h-11 w-11 -translate-y-1/2 p-0 max-md:flex [@media(pointer:coarse)]:flex"
          title={localizeUi("connections.accounts.row.actions", { name: conn.name })}
          aria-label={localizeUi("connections.accounts.row.actions", { name: conn.name })}
          aria-haspopup="menu"
          aria-expanded={!!menu}
        >
          <MoreHorizontal size="0.875rem" />
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
