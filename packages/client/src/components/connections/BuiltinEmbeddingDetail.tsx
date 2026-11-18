// ──────────────────────────────────────────────
// The built-in embedding model's page: a small search model the Engine downloads and runs itself, for semantic
// search (lorebooks, Long-term memory). Same anatomy as the built-in model's page: hero with state, labelled
// actions, one facts card, then its own controls.
// ──────────────────────────────────────────────
import { useState } from "react";
import { HardDriveDownload, Power, PowerOff, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  BUILTIN_EMBEDDING_CONNECTION_ID,
  type BuiltinEmbeddingModelId,
  type BuiltinEmbeddingModelInfo,
} from "@marinara-engine/shared";
import { useDefaultEmbeddingConnection, useSetDefaultEmbeddingConnection } from "../../hooks/use-connections";
import {
  useBuiltinEmbedding,
  useCancelBuiltinEmbeddingDownload,
  useDownloadBuiltinEmbedding,
  useLoadBuiltinEmbedding,
  useRemoveBuiltinEmbeddingModel,
  useSetBuiltinEmbeddingDevice,
  useUnloadBuiltinEmbedding,
  useUseBuiltinEmbeddingModel,
} from "../../hooks/use-builtin-embedding";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { JOB, jobLabelKey } from "../../lib/connection-jobs";
import { cn } from "../../lib/utils";
import { Spinner } from "../ui/Spinner";
import { DetailHero, FactRow, formatBytes, SMALL_ACTION, StateWord, type EngineTone } from "./DeviceDetail";
import type { ConnectionExtraOption } from "./ConnectionSelect";
import { ProviderIcon } from "./ProviderIcon";
import { LocalModelSlotNote, UnloadWhenUnusedRow } from "./LocalModelShared";

const FIELD = "mari-chrome-field h-8 w-full max-w-[18rem] px-2 text-xs max-md:h-11 max-sm:text-base";

/** The page's state as one coloured word, shared with the On this device rows. */
export function useBuiltinEmbeddingState(): { name: string; tone: EngineTone; state: string; detail: string } | null {
  const { t } = useTranslation();
  const { data } = useBuiltinEmbedding();
  if (!data?.supported) return null;
  const name = t("connections.builtinEmbedding.name");
  const active = data.models.find((model) => model.id === data.activeModelId);
  const detail = active?.label ?? "";
  const download = data.download;
  if (download?.status === "downloading") {
    const percent = download.total > 0 ? Math.round((download.downloaded / download.total) * 100) : 0;
    return { name, tone: "off", detail, state: t("connections.builtinEmbedding.downloadingPercent", { percent }) };
  }
  if (data.error && !data.running) return { name, tone: "warn", detail, state: t("connections.device.state.error") };
  if (!active) return { name, tone: "off", detail, state: t("connections.device.state.notDownloaded") };
  if (data.starting) return { name, tone: "off", detail, state: t("connections.device.state.starting") };
  if (data.running) return { name, tone: "ok", detail, state: t("connections.device.state.running") };
  return { name, tone: "ok", detail, state: t("connections.builtinEmbedding.state.ready") };
}

/**
 * The built-in embedding model as a choice in an embedding picker: offered once a model is downloaded, and kept
 * while it is the current value so the picker can still name it.
 */
export function useBuiltinEmbeddingOption(current?: string | null): ConnectionExtraOption | null {
  const { t } = useTranslation();
  const { data } = useBuiltinEmbedding();
  const active = data?.models.find((model) => model.id === data.activeModelId);
  if (!data?.supported || (!active && current !== BUILTIN_EMBEDDING_CONNECTION_ID)) return null;
  return {
    value: BUILTIN_EMBEDDING_CONNECTION_ID,
    label: t("connections.builtinEmbedding.name"),
    subtitle: active
      ? `${active.label} · ${t("connections.accounts.section.device")}`
      : t("connections.device.state.notDownloaded"),
    icon: <ProviderIcon provider="builtin-embedding" size="sm" />,
  };
}

export function BuiltinEmbeddingDetail() {
  const { t } = useTranslation();
  const status = useBuiltinEmbedding();
  const embeddingDefault = useDefaultEmbeddingConnection();
  const setDefault = useSetDefaultEmbeddingConnection();
  const download = useDownloadBuiltinEmbedding();
  const cancel = useCancelBuiltinEmbeddingDownload();
  const useModel = useUseBuiltinEmbeddingModel();
  const load = useLoadBuiltinEmbedding();
  const unload = useUnloadBuiltinEmbedding();
  const remove = useRemoveBuiltinEmbeddingModel();
  const setDevice = useSetBuiltinEmbeddingDevice();
  const engine = useBuiltinEmbeddingState();
  const [picked, setPicked] = useState<BuiltinEmbeddingModelId | null>(null);

  const data = status.data;
  if (!data) {
    return status.isError ? (
      <p className="text-xs text-[var(--muted-foreground)]">{t("connections.builtinEmbedding.statusFailed")}</p>
    ) : (
      <Spinner size="sm" />
    );
  }
  const report = (error: unknown) =>
    toast.error(error instanceof Error ? error.message : t("connections.builtinEmbedding.failed"));

  const active = data.models.find((model) => model.id === data.activeModelId) ?? null;
  const downloading = data.download?.status === "downloading" ? data.download : null;
  const failedDownload = data.download?.status === "error" ? data.download : null;
  const choice =
    data.models.find((model) => model.id === picked) ?? active ?? data.models.find((model) => model.recommended)!;
  const isDefault = embeddingDefault.data?.connectionId === BUILTIN_EMBEDDING_CONNECTION_ID;
  const busy =
    download.isPending ||
    useModel.isPending ||
    load.isPending ||
    unload.isPending ||
    remove.isPending ||
    setDevice.isPending;

  const describe = (model: BuiltinEmbeddingModelInfo) =>
    [
      data?.installed[model.id]
        ? ""
        : t("connections.builtinEmbedding.notDownloadedSize", { size: formatBytes(model.downloadSizeBytes) }),
      model.recommended ? `${t("connections.builtinEmbedding.recommended")}.` : "",
      t(
        model.id === "qwen3-embedding-0.6b"
          ? "connections.builtinEmbedding.aboutQwen"
          : "connections.builtinEmbedding.aboutGemma",
        { dimensions: model.dimensions, license: model.license },
      ),
    ]
      .filter(Boolean)
      .join(" ");

  const startDownload = async (model: BuiltinEmbeddingModelInfo) => {
    const confirmed = await showConfirmDialog({
      title: t("connections.builtinEmbedding.downloadTitle", { model: model.label }),
      message: t("connections.builtinEmbedding.downloadBody", {
        size: formatBytes(model.downloadSizeBytes),
        memory: formatBytes(model.ramBytes),
        license: model.license,
      }),
      confirmLabel: t("connections.device.download"),
    });
    if (!confirmed) return;
    download.mutate(model.id, { onError: report });
  };

  const pickModel = async (model: BuiltinEmbeddingModelInfo) => {
    if (!active) return setPicked(model.id);
    if (model.id === active.id) return;
    if (!data.installed[model.id]) return startDownload(model);
    const confirmed = await showConfirmDialog({
      title: t("connections.builtinEmbedding.switchTitle", { model: model.label }),
      message: t("connections.builtinEmbedding.switchBody"),
      confirmLabel: t("connections.builtinEmbedding.switch"),
    });
    if (confirmed) useModel.mutate(model.id, { onError: report });
  };

  const removeFiles = async () => {
    if (!active) return;
    const other = data.models.find((model) => model.id !== active.id && data.installed[model.id]);
    const confirmed = await showConfirmDialog({
      title: t("connections.builtinEmbedding.removeTitle", { model: active.label }),
      message: other
        ? t("connections.builtinEmbedding.removeBodyOther", { other: other.label })
        : t("connections.builtinEmbedding.removeBody"),
      confirmLabel: t("connections.builtinEmbedding.removeFiles"),
      tone: "destructive",
    });
    if (confirmed) remove.mutate(active.id, { onError: report });
  };

  const toggleLoad = () => {
    if (data.running) unload.mutate(undefined, { onError: report });
    else
      load.mutate(undefined, {
        onSuccess: () => toast.success(t("connections.builtinEmbedding.loaded")),
        onError: report,
      });
  };

  return (
    <div className="flex flex-col gap-3" data-component="BuiltinEmbeddingDetail">
      <DetailHero
        icon={<ProviderIcon provider="builtin-embedding" size="lg" />}
        title={t("connections.builtinEmbedding.name")}
      >
        {engine ? <StateWord tone={engine.tone} label={engine.state} /> : null}
        <span>· {t("connections.accounts.section.device")}</span>
      </DetailHero>

      {active && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={toggleLoad}
            disabled={busy || data.starting || !data.runtimeInstalled}
            className={SMALL_ACTION}
          >
            {load.isPending || unload.isPending || data.starting ? (
              <Spinner size="sm" />
            ) : data.running ? (
              <PowerOff size="0.75rem" />
            ) : (
              <Power size="0.75rem" />
            )}
            {load.isPending || data.starting
              ? t("connections.device.pleaseWait")
              : data.running
                ? t("connections.builtinEmbedding.unload")
                : t("connections.builtinEmbedding.load")}
          </button>
          {!isDefault && (
            <button
              type="button"
              disabled={setDefault.isPending}
              onClick={() =>
                setDefault.mutate(BUILTIN_EMBEDDING_CONNECTION_ID, {
                  onSuccess: () => toast.success(t("connections.builtinEmbedding.nowEmbeddings")),
                  onError: report,
                })
              }
              className={SMALL_ACTION}
            >
              {t("connections.builtinEmbedding.useForEmbeddings")}
            </button>
          )}
        </div>
      )}

      {!data.runtimeInstalled && (
        <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-2.5 text-[0.6875rem]">
          <p className="text-[var(--foreground)]">{t("connections.builtinEmbedding.needsRuntime")}</p>
        </div>
      )}

      {data.error && !data.running && (
        <div
          role="alert"
          className="rounded-lg border border-[var(--marinara-app-accent-static)]/20 bg-[var(--marinara-app-accent-static)]/5 p-2.5 text-[0.6875rem]"
        >
          <div className="font-medium text-[var(--marinara-app-accent-static)]">
            {t("connections.builtinEmbedding.didNotStart")}
          </div>
          <div className="mt-1 text-[var(--muted-foreground)] [overflow-wrap:anywhere]">{data.error}</div>
        </div>
      )}

      {active && <LocalModelSlotNote slot="embedding" />}

      {/* It sits inside the built-in model page's own card, so the facts are not boxed a second time. */}
      <section className="flex flex-col">
        <FactRow label={t("connections.device.fact.model")} stack>
          {/* A dropdown, not chips: a phone has room for the name on one line and little more. */}
          <select
            value={(active ?? choice).id}
            disabled={busy || !!downloading}
            onChange={(event) => {
              const model = data.models.find((entry) => entry.id === event.target.value);
              if (model) void pickModel(model);
            }}
            aria-label={t("connections.device.fact.model")}
            className={FIELD}
          >
            {data.models.map((model) => (
              <option key={model.id} value={model.id}>
                {data.installed[model.id]
                  ? model.label
                  : t("connections.builtinEmbedding.optionToDownload", {
                      model: model.label,
                      size: formatBytes(model.downloadSizeBytes),
                    })}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[0.6875rem] text-[var(--muted-foreground)]">
            {describe(active ?? choice)}
          </span>
        </FactRow>
        <FactRow label={t("connections.device.fact.memory")}>
          {data.running && data.memoryBytes
            ? t("connections.builtinEmbedding.memoryNow", {
                now: formatBytes(data.memoryBytes),
                max: formatBytes((active ?? choice).ramBytes),
              })
            : t("connections.builtinEmbedding.memoryUpTo", { max: formatBytes((active ?? choice).ramBytes) })}
        </FactRow>
        <FactRow label={t("connections.device.fact.usedBy")}>
          {isDefault ? t(jobLabelKey(JOB.embeddings)) : t("connections.device.usedBy.none")}
        </FactRow>
        <FactRow label={t("connections.builtinEmbedding.runsOn")} stack>
          <select
            value={data.device}
            disabled={busy}
            onChange={(event) => setDevice.mutate(event.target.value as "auto" | "cpu", { onError: report })}
            aria-label={t("connections.builtinEmbedding.runsOn")}
            className={FIELD}
          >
            <option value="auto">{t("connections.builtinEmbedding.device.auto")}</option>
            <option value="cpu">{t("connections.builtinEmbedding.device.cpu")}</option>
          </select>
          {data.device === "auto" && (
            <span className="mt-1 block text-[0.6875rem] text-[var(--muted-foreground)]">
              {t("connections.builtinEmbedding.device.autoHint")}
            </span>
          )}
        </FactRow>
        {active && <UnloadWhenUnusedRow />}
      </section>

      {downloading ? (
        <div className="flex flex-col gap-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--secondary)]">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-[width]"
              style={{
                width: `${downloading.total > 0 ? Math.min(100, Math.round((downloading.downloaded / downloading.total) * 100)) : 8}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-2 text-[0.6875rem] text-[var(--muted-foreground)]">
            <span className="min-w-0 truncate">
              {t("connections.builtinEmbedding.downloadingOf", {
                model: downloading.label,
                done: formatBytes(downloading.downloaded),
                total: formatBytes(downloading.total),
              })}
            </span>
            <button
              type="button"
              onClick={() => cancel.mutate(undefined, { onError: report })}
              className={SMALL_ACTION}
            >
              <X size="0.75rem" />
              {t("connections.builtinEmbedding.cancel")}
            </button>
          </div>
        </div>
      ) : !active ? (
        <button
          type="button"
          onClick={() => void startDownload(choice)}
          disabled={busy}
          className="mari-chrome-control mari-chrome-control--primary w-full"
        >
          <HardDriveDownload size="0.8125rem" />
          {t("connections.builtinEmbedding.downloadModel", {
            model: choice.label,
            size: formatBytes(choice.downloadSizeBytes),
          })}
        </button>
      ) : null}

      {failedDownload && (
        <p role="alert" className="text-[0.6875rem] text-[var(--marinara-app-accent-static)] [overflow-wrap:anywhere]">
          {t("connections.builtinEmbedding.downloadFailed", { error: failedDownload.error ?? "" })}
        </p>
      )}

      <p className="px-0.5 text-[0.6875rem] text-[var(--muted-foreground)]">
        {t("connections.builtinEmbedding.switchNote")}
      </p>

      {active && !downloading && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void removeFiles()}
          className={cn(SMALL_ACTION, "mari-device-remove self-start")}
        >
          <Trash2 size="0.75rem" />
          {t("connections.builtinEmbedding.removeFiles")}
        </button>
      )}
    </div>
  );
}
