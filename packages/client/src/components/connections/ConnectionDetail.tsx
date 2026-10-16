// ──────────────────────────────────────────────
// ConnectionDetail — one Connection's page in the Connections panel (variant D): hero with state, service and
// host; Test / Edit / Add model; the problem strip; usage; "Your models", grouped by upstream; Browse all models.
// ──────────────────────────────────────────────
import type { ReactNode } from "react";
import { AlertTriangle, ChevronRight, ImageIcon, Loader2, Plus, Search, Settings2, Wifi } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  IMAGE_GENERATION_SOURCES,
  IMAGE_SOURCE_VENDOR,
  PROVIDERS,
  type APIProvider,
  type ConnectionAccountListItem,
} from "@marinara-engine/shared";
import { useCreateConnection, useDuplicateConnection, useTestConnection } from "../../hooks/use-connections";
import { useUpdateConnectionAccount } from "../../hooks/use-connection-accounts";
import { starAnchorOf } from "../../hooks/use-model-star";
import { sortByModelId, subgroupByUpstream } from "../../lib/connection-groups";
import { useUIStore } from "../../stores/ui.store";
import { openAddModels } from "../../lib/add-connection";
import { cn } from "../../lib/utils";
import { SubscriptionUsageWidget } from "./SubscriptionUsageWidget";
import { BrandMark, ProviderIcon } from "./ProviderIcon";
import { DETAIL_CARD_CLASS, DetailHero, SMALL_ACTION, StateWord, type EngineTone } from "./DeviceDetail";
import { modelSubtitle, type ConnectionRowData } from "./ConnectionRow";

const STATE_TONE: Record<ConnectionAccountListItem["state"], EngineTone> = { ok: "ok", off: "off", needs_key: "warn" };

/** The host a Connection talks to, for the hero's third line. */
export function hostOf(url: string | null | undefined): string {
  try {
    return url ? new URL(url).host : "";
  } catch {
    return url?.trim() ?? "";
  }
}

export function ConnectionDetail({
  account,
  rows,
  renderRow,
}: {
  account: ConnectionAccountListItem;
  rows: ConnectionRowData[];
  renderRow: (row: ConnectionRowData, subtitle: string) => ReactNode;
}) {
  const { t } = useTranslation();
  const openModal = useUIStore((s) => s.openModal);
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const duplicate = useDuplicateConnection();
  const createConnection = useCreateConnection();
  const updateAccount = useUpdateConnectionAccount();
  const test = useTestConnection();

  // The anchor Model: Add model shows and keeps the Connection's stars on it.
  const chatRow = starAnchorOf(rows) ?? null;
  const firstRow = chatRow ?? rows[0] ?? null;
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
  // Only a chat Model can seed the catalog pick; a media-only Connection copies its Model into the editor.
  const addModel = () =>
    chatRow
      ? openAddModels({ accountId: account.id, connectionId: chatRow.id })
      : firstRow
        ? duplicate.mutate(firstRow.id, {
            onSuccess: (data) => {
              const id = (data as { id?: string } | undefined)?.id;
              if (id) openConnectionDetail(id);
            },
          })
        : openModal("create-connection", { provider: account.provider });
  const service = PROVIDERS[account.provider as APIProvider]?.name ?? account.provider;
  const host = hostOf(account.baseUrl);
  const editAccount = () => openModal("connection-account", { accountId: account.id });
  const hint =
    account.state === "needs_key"
      ? t("connections.detail.hint.needsKey")
      : account.state === "off"
        ? t("connections.detail.hint.off")
        : t("connections.detail.hint.ok");

  return (
    <div className="flex flex-col gap-3" data-connection-account-id={account.id}>
      <DetailHero
        icon={<ProviderIcon provider={account.provider} baseUrl={account.baseUrl} name={account.name} size="lg" />}
        title={account.name}
        dim={account.state === "off"}
      >
        <StateWord tone={STATE_TONE[account.state]} label={t(`connections.accounts.state.${account.state}`)} />
        <span>· {service}</span>
        {host && <span className="basis-full truncate">{host}</span>}
      </DetailHero>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => firstRow && test.mutate(firstRow.id)}
          disabled={!firstRow || test.isPending}
          className={SMALL_ACTION}
          title={
            firstRow
              ? t("connections.accounts.testNamed", { name: account.name })
              : t("connections.accounts.addModelFirst")
          }
        >
          {test.isPending ? <Loader2 size="0.75rem" className="animate-spin" /> : <Wifi size="0.75rem" />}
          {t("connections.accounts.test")}
        </button>
        <button type="button" onClick={editAccount} className={SMALL_ACTION}>
          <Settings2 size="0.75rem" />
          {t("connections.detail.edit")}
        </button>
        <button type="button" data-add-model onClick={addModel} disabled={duplicate.isPending} className={SMALL_ACTION}>
          <Plus size="0.75rem" />
          {t("connections.accounts.addModel")}
        </button>
        {imageSource && (
          <button
            type="button"
            data-add-image-model
            onClick={addImageModel}
            disabled={createConnection.isPending}
            className={SMALL_ACTION}
          >
            <ImageIcon size="0.75rem" />
            {t("connections.accounts.addImageModel")}
          </button>
        )}
      </div>

      {(test.data || test.isError) && (
        <p
          role="status"
          className={cn(
            "text-[0.6875rem]",
            test.data?.success ? "text-[var(--muted-foreground)]" : "text-[var(--marinara-app-accent-static)]",
          )}
        >
          {test.data
            ? test.data.success
              ? t("connections.accounts.testOk", { latency: test.data.latencyMs })
              : test.data.message
            : t("connections.accounts.testFailed")}
        </p>
      )}

      {account.state !== "ok" && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg bg-[var(--marinara-app-accent-static)]/10 px-2.5 py-1.5 text-[0.6875rem] text-[var(--marinara-app-accent-static)]"
        >
          <AlertTriangle size="0.75rem" className="shrink-0" />
          <span className="min-w-0 flex-1">
            {account.state === "off"
              ? t("connections.defaults.warning.off", { connection: account.name })
              : t("connections.defaults.warning.needsKey", { connection: account.name })}
          </span>
          <button
            type="button"
            onClick={
              account.state === "off" ? () => updateAccount.mutate({ id: account.id, enabled: true }) : editAccount
            }
            className={cn(SMALL_ACTION, "shrink-0")}
          >
            {account.state === "off" ? t("connections.defaults.fix.turnOn") : t("connections.defaults.fix.addKey")}
          </button>
        </div>
      )}

      {account.showUsageWidget && firstRow && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
          <SubscriptionUsageWidget connectionId={firstRow.id} variant="inline" />
        </div>
      )}

      <section
        className={cn(DETAIL_CARD_CLASS, "p-2")}
        aria-label={t("connections.detail.models", { count: rows.length })}
      >
        <div className="flex items-center justify-between gap-2 px-1.5 pb-1 pt-0.5">
          <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
            {t("connections.detail.models", { count: rows.length })}
          </span>
          <span
            className={cn(
              "text-right text-[0.625rem]",
              account.state === "ok" ? "text-[var(--muted-foreground)]" : "text-[var(--marinara-app-accent-static)]",
            )}
          >
            {hint}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          {rows.length === 0 && (
            <p className="px-1.5 py-1 text-[0.6875rem] text-[var(--muted-foreground)]">
              {t("connections.accounts.noModels")}
            </p>
          )}
          {/* By model id: the groups and rows keep their places when a star or an edit touches a Model. */}
          {subgroupByUpstream(sortByModelId(rows)).map((group) => (
            <div key={group.upstream ?? ""} className="flex flex-col gap-0.5">
              {group.upstream && (
                <p className="flex items-center gap-1.5 px-2 pt-2 text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                  <BrandMark of={group.upstream} className="h-3 w-3" />
                  {t("connections.accounts.upstreamHeading", { upstream: group.upstream, count: group.rows.length })}
                </p>
              )}
              {group.rows.map((row) => (
                <div key={row.id}>{renderRow(row, modelSubtitle(row, group.upstream))}</div>
              ))}
            </div>
          ))}
        </div>
        {chatRow && (
          <button
            type="button"
            onClick={() => openAddModels({ accountId: account.id, connectionId: chatRow.id })}
            className="mt-0.5 flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 text-left text-xs hover:bg-[var(--sidebar-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] md:min-h-9"
          >
            <Search size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
            <span className="min-w-0 flex-1 text-[var(--muted-foreground)]">{t("connections.detail.browseAll")}</span>
            <ChevronRight size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
          </button>
        )}
      </section>
    </div>
  );
}
