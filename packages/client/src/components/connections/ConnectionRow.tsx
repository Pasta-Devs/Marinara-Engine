// ──────────────────────────────────────────────
// ConnectionRow — one saved Model in the Connections panel: the shared two-line ModelRow plus its ⋯ menu.
// ──────────────────────────────────────────────
import { useState } from "react";
import {
  BadgeCheck,
  Camera,
  Check,
  Copy,
  Folder,
  GitBranch,
  MoreHorizontal,
  MoveRight,
  Pencil,
  Shuffle,
  Star,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "sonner";
import { DECISION_SOURCE_BASE_URLS, isChatProvider, type ConnectionAccountListItem } from "@marinara-engine/shared";
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
import { modelKindOf, modelSubtitle } from "../../lib/connection-identity";
import { ContextMenu, type ContextMenuItem } from "../ui/ContextMenu";
import { MEDIA_KIND, ModelRow, ModelTile, menuAt, modelRoleLabels, type MenuAt } from "./ModelRow";

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
  /** Whether this chat Model reads images; null lets its catalog decide. */
  imageInput?: string | null;
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

export const isMediaRow = (row: Pick<ConnectionRowData, "provider">) => row.provider in MEDIA_KIND;

/** The ⋯ beside a row or card heading: the shared quiet icon button. */
export const ROW_BUTTON = "mari-connection-btn mari-connection-btn--ghost mari-connection-btn--icon";

/** The menus are portalled, but React events still bubble to the row; keep them off its click. */
const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

/** Kept for callers that import it from here; the formatter lives in lib/connection-identity. */
export { modelSubtitle };

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
      tile={<ModelTile row={row} account={account} dim={!!unavailable} />}
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
      facts={facts}
      showPaid={catalog?.showPaid}
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
