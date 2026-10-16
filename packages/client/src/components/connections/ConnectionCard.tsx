// ──────────────────────────────────────────────
// ConnectionCard — one Connection (account) in the Connections panel, its Models as ConnectionRows
// ──────────────────────────────────────────────
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ImageIcon, Link, Loader2, Plus, Settings2, Wifi } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  IMAGE_GENERATION_SOURCES,
  IMAGE_SOURCE_VENDOR,
  PROVIDERS,
  isChatProvider,
  type APIProvider,
  type ConnectionAccountListItem,
} from "@marinara-engine/shared";
import { useCreateConnection, useDuplicateConnection, useTestConnection } from "../../hooks/use-connections";
import { subgroupByUpstream, roleBadges } from "../../lib/connection-groups";
import { isConnectionFlagTrue } from "../../lib/connection-filters";
import { useUIStore } from "../../stores/ui.store";
import { cn } from "../../lib/utils";
import { SmoothFolderContent } from "../ui/SmoothFolderContent";
import { ConnectionModelPicker } from "./ConnectionModelPicker";
import { SubscriptionUsageWidget } from "./SubscriptionUsageWidget";
import type { ConnectionRowData } from "./ConnectionRow";

/** Today's Local Model card surface, coloured from the Connections panel tokens. */
export const CONNECTION_CARD_CLASS =
  "mari-panel-gradient--connections rounded-xl border border-[color-mix(in_srgb,var(--mari-panel-gradient-start)_20%,transparent)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--mari-panel-gradient-start)_5%,transparent),color-mix(in_srgb,var(--mari-panel-gradient-end)_5%,transparent))] p-3 transition-all";
export const CONNECTION_TILE_CLASS =
  "mari-panel-gradient-surface mari-panel-gradient--connections flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm";

const MEDIA_KIND: Record<string, "image" | "video" | "audio"> = {
  image_generation: "image",
  video_generation: "video",
  audio: "audio",
};

/** Card header icon buttons: compact on a mouse so the name keeps the width, 44 px on touch. */
const CARD_ICON_BUTTON_CLASS =
  "mari-chrome-control mari-chrome-control--small h-7 min-h-0 w-7 !p-0 max-md:h-11 max-md:w-11 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11";

export const isMediaRow = (row: Pick<ConnectionRowData, "provider">) => row.provider in MEDIA_KIND;

export type ConnectionRowDisplay = { subtitle: string; badge: string | null };

export function ConnectionCard({
  account,
  rows,
  forceOpen = false,
  renderRow,
}: {
  account: ConnectionAccountListItem;
  rows: ConnectionRowData[];
  /** Search is on: keep the card open so its matches show. */
  forceOpen?: boolean;
  renderRow: (row: ConnectionRowData, display: ConnectionRowDisplay) => ReactNode;
}) {
  const { t } = useTranslation();
  const openModal = useUIStore((s) => s.openModal);
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const duplicate = useDuplicateConnection();
  const createConnection = useCreateConnection();
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const test = useTestConnection();
  const expanded = open || forceOpen;

  const chatRow = rows.find((row) => isChatProvider(row.provider)) ?? null;
  const firstRow = chatRow ?? rows[0] ?? null;
  // A Connection holding chat and image Models shows once; its media Models carry their kind.
  const mixed = !!chatRow && rows.some(isMediaRow);
  const mediaOnly = rows.length > 0 && rows.every(isMediaRow);
  // Decision 20: an image Model on the same vendor key joins this Connection, so it needs no key of its own.
  const imageSource = chatRow
    ? IMAGE_GENERATION_SOURCES.find((source) => IMAGE_SOURCE_VENDOR[source.id] === account.provider)
    : undefined;
  const addImageModel = () =>
    imageSource &&
    createConnection.mutate(
      {
        name: imageSource.name,
        provider: "image_generation",
        apiKey: "",
        imageGenerationSource: imageSource.id,
        accountId: account.id,
      },
      {
        onSuccess: (data) => {
          const id = (data as { id?: string } | undefined)?.id;
          if (id) openConnectionDetail(id);
        },
        onError: (error) =>
          toast.error(
            t("connections.accounts.addImageModelFailed", {
              error: error instanceof Error ? error.message : String(error ?? ""),
            }),
          ),
      },
    );
  const service = PROVIDERS[account.provider as APIProvider]?.name ?? account.provider;
  const stateLabel = t(`connections.accounts.state.${account.state}`);

  const badgeFor = (row: ConnectionRowData): string | null => {
    const kind = MEDIA_KIND[row.provider];
    if (kind) {
      if (mixed) return t(`connections.accounts.kind.${kind}`);
      if (isConnectionFlagTrue(row.defaultForAgents)) return t("connections.accounts.badge.default");
      return isConnectionFlagTrue(row.fallbackForAgents) ? t("connections.switcher.role.fallback") : null;
    }
    const [role] = roleBadges(row);
    return role ? t(`connections.switcher.role.${role}`) : null;
  };
  const subtitleFor = (row: ConnectionRowData, upstream: string | null) => {
    const model = row.model?.trim() ?? "";
    const id = upstream && model.startsWith(`${upstream}/`) ? model.slice(upstream.length + 1) : model;
    return (
      id ||
      row.imageService ||
      row.imageGenerationSource ||
      row.videoService ||
      row.videoGenerationSource ||
      t("connections.accounts.row.noModel")
    );
  };

  const runTest = () => {
    if (!firstRow) return;
    test.mutate(firstRow.id);
  };

  return (
    <section className={CONNECTION_CARD_CLASS} data-connection-account-id={account.id}>
      {/* A narrow card moves the buttons to their own line, so the name and its state stay readable. */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <div className={CONNECTION_TILE_CLASS}>{mediaOnly ? <ImageIcon size="1rem" /> : <Link size="1rem" />}</div>
        <div className="min-w-0 flex-1 md:min-w-[8rem]">
          {/* Two lines, so names that differ only at the end (an address, a port) stay apart. */}
          <div
            className="line-clamp-2 text-sm font-medium [overflow-wrap:anywhere] text-[var(--foreground)]"
            title={account.name}
          >
            {account.name}
          </div>
          <div className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">
            {service} · <span className={cn(account.state !== "ok" && "text-[var(--warning)]")}>{stateLabel}</span>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-0.5 max-md:gap-1">
          <button
            type="button"
            onClick={runTest}
            disabled={!firstRow || test.isPending}
            className={CARD_ICON_BUTTON_CLASS}
            title={firstRow ? t("connections.accounts.test") : t("connections.accounts.addModelFirst")}
            aria-label={t("connections.accounts.testNamed", { name: account.name })}
          >
            {test.isPending ? <Loader2 size="0.75rem" className="animate-spin" /> : <Wifi size="0.8125rem" />}
          </button>
          <button
            type="button"
            onClick={() => openModal("connection-account", { accountId: account.id })}
            className={CARD_ICON_BUTTON_CLASS}
            title={t("connections.accounts.edit", { name: account.name })}
            aria-label={t("connections.accounts.edit", { name: account.name })}
          >
            <Settings2 size="0.8125rem" />
          </button>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className={CARD_ICON_BUTTON_CLASS}
            aria-label={
              expanded
                ? t("connections.accounts.collapse", { name: account.name })
                : t("connections.accounts.expand", { name: account.name })
            }
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp size="0.875rem" /> : <ChevronDown size="0.875rem" />}
          </button>
        </div>
      </div>

      {(test.data || test.isError) && (
        <p
          role="status"
          className={cn(
            "mt-2 text-[0.6875rem]",
            test.data?.success ? "text-[var(--muted-foreground)]" : "text-[var(--destructive)]",
          )}
        >
          {test.data
            ? test.data.success
              ? t("connections.accounts.testOk", { latency: test.data.latencyMs })
              : test.data.message
            : t("connections.accounts.testFailed")}
        </p>
      )}

      {account.showUsageWidget && firstRow && (
        <div className="mt-2">
          <SubscriptionUsageWidget connectionId={firstRow.id} variant="inline" />
        </div>
      )}

      <SmoothFolderContent open={expanded}>
        <div className="mt-2 flex flex-col gap-0.5">
          {rows.length === 0 && (
            <p className="px-1 py-1 text-[0.6875rem] text-[var(--muted-foreground)]">
              {t("connections.accounts.noModels")}
            </p>
          )}
          {subgroupByUpstream(rows).map((group) => (
            <div key={group.upstream ?? ""} className="flex flex-col gap-0.5">
              {group.upstream && (
                <p className="px-2 pt-2 text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                  {t("connections.accounts.upstreamHeading", { upstream: group.upstream, count: group.rows.length })}
                </p>
              )}
              {group.rows.map((row) => (
                <div key={row.id}>
                  {renderRow(row, { subtitle: subtitleFor(row, group.upstream), badge: badgeFor(row) })}
                </div>
              ))}
            </div>
          ))}
          {/* Only a chat Model can seed the catalog pick; a media-only card copies its Model into the editor. */}
          {chatRow ? (
            <div className="mt-1 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setAdding((value) => !value)}
                aria-expanded={adding}
                className="mari-chrome-control mari-chrome-control--small w-fit text-[0.6875rem] max-md:min-h-11"
              >
                <Plus size="0.75rem" />
                {t("connections.accounts.addModel")}
              </button>
              {imageSource && (
                <button
                  type="button"
                  data-add-image-model
                  onClick={addImageModel}
                  disabled={createConnection.isPending}
                  className="mari-chrome-control mari-chrome-control--small w-fit text-[0.6875rem] max-md:min-h-11"
                >
                  <ImageIcon size="0.75rem" />
                  {t("connections.accounts.addImageModel")}
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                firstRow
                  ? duplicate.mutate(firstRow.id, {
                      onSuccess: (data) => {
                        const id = (data as { id?: string } | undefined)?.id;
                        if (id) openConnectionDetail(id);
                      },
                    })
                  : openModal("create-connection", { provider: account.provider })
              }
              disabled={duplicate.isPending}
              className="mari-chrome-control mari-chrome-control--small mt-1 w-fit text-[0.6875rem] max-md:min-h-11"
            >
              <Plus size="0.75rem" />
              {t("connections.accounts.addModel")}
            </button>
          )}
          {adding && chatRow && (
            <div className="mt-1 flex h-[min(24rem,60dvh)] flex-col overflow-hidden rounded-lg ring-1 ring-foreground/10">
              <ConnectionModelPicker
                connection={chatRow}
                accountName={account.name}
                autoFocusSearch
                footer={t("connections.accounts.addModelFooter")}
                applyPick={async () => {
                  toast.success(t("connections.accounts.modelAdded"));
                }}
                onPicked={() => setAdding(false)}
              />
            </div>
          )}
        </div>
      </SmoothFolderContent>
    </section>
  );
}
