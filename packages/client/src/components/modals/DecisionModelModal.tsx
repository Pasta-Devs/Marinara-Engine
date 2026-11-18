// ──────────────────────────────────────────────
// Decision Model installer
//
// Installs and runs the managed decision sidecar, on the built-in
// model's This device page. Choosing it for Decision is the Decision
// job's. Built from the same pieces as ModelDownloadModal (warning block,
// radio rows, fact line, primary action) so the two installers read as
// one feature.
// ──────────────────────────────────────────────

import { useState } from "react";
import { toast } from "sonner";
import {
  Download,
  Eye,
  Gauge,
  HardDriveDownload,
  Link2,
  ListChecks,
  Power,
  PowerOff,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { DECISION_SIDECAR_CONNECTION_ID, type DecisionInstallProgress } from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  useCancelDecisionInstall,
  useDecisionInstallProgress,
  useDecisionSidecar,
  useEnableDecisionSidecar,
  useInstallDecisionModel,
  useInspectDecisionRepo,
  useInstallDecisionRepo,
  useRemoveDecisionSidecar,
  useSetDecisionDevice,
  useSetDecisionStartPolicy,
  decisionCannotRun,
  useUpdateDecisionRuntime,
  type DecisionSidecarModel,
} from "../../hooks/use-decision-sidecar";
import { useDecisionOptions, useSelectDecisionModel } from "../../hooks/use-decision-model";
import { cn } from "../../lib/utils";
import { ProviderIcon } from "../connections/ProviderIcon";
import {
  DETAIL_CARD_CLASS,
  DEVICE_FIELD,
  DetailHero,
  FactRow,
  SMALL_ACTION,
  StateWord,
  type EngineTone,
} from "../connections/DeviceDetail";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { LocalModelSlotNote, UnloadWhenUnusedRow } from "../connections/LocalModelShared";
import { useUIStore } from "../../stores/ui.store";
import { Select } from "../ui/Select";
import { Spinner } from "../ui/Spinner";

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  return `${Math.round(bytes / 1_000_000)} MB`;
}

/**
 * Set by Cancel, so the aborted install's error reads as what the user asked for. Not
 * per page: the install may have been started by a page that has since been left and
 * reopened, and it is that first page's promise that rejects.
 */
const installCancelled = { current: false };

export function DecisionModelModal() {
  const { t: localizeUi, i18n } = useUiTranslation();
  const numberFormat = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });
  const sidecar = useDecisionSidecar(true);
  const enable = useEnableDecisionSidecar();
  const install = useInstallDecisionModel();
  const remove = useRemoveDecisionSidecar();
  const updateRuntime = useUpdateDecisionRuntime();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [repoInput, setRepoInput] = useState("");
  /** Which repository the inspection on screen actually describes. */
  const [inspectedRepo, setInspectedRepo] = useState("");
  const inspect = useInspectDecisionRepo();
  const installRepo = useInstallDecisionRepo();
  const startPolicy = useSetDecisionStartPolicy();
  const device = useSetDecisionDevice();
  const openModal = useUIStore((state) => state.openModal);
  const installProgress = useDecisionInstallProgress(install.isPending || installRepo.isPending).data?.progress ?? null;
  const cancelInstall = useCancelDecisionInstall();

  const data = sidecar.data;
  const models = data?.models ?? [];
  // Prefer what is installed, then an explicit pick, then the first installable
  // entry. Before the status loads there is no verdict at all, and confirming
  // against an assumed "recommended" would record consent to something nobody was
  // shown, so the toggle waits instead.
  const selected =
    models.find((model) => model.id === selectedId) ??
    models.find((model) => model.id === data?.settings.modelId) ??
    models.find((model) => model.preflight.installable) ??
    // Where nothing is installable there is still something to show and explain:
    // falling through to null would leave the list looking empty rather than
    // greyed out with its reason.
    models[0] ??
    null;
  const enabled = data?.settings.enabled === true;
  const installedId = data?.settings.modelId ?? null;
  // A pasted model is stored whole and has no catalog id, so asking only about
  // modelId would leave its files with no way to remove them from the panel.
  // The runtime alone is several gigabytes, so an install that stopped before any
  // model landed still needs a way to be removed.
  const hasInstall = !!installedId || !!data?.settings.customModel || data?.runtimeInstalled === true;
  // A model, not just its runtime: the runtime lands first, minutes before the model,
  // and a page that counted it read "Ready" with no model at all.
  const hasModel = !!installedId || !!data?.settings.customModel;
  // The installed model, from the catalog or pasted. An update can pin a different runtime (a new uv or Open-Jev
  // revision) than the one on disk, or its weights can go missing; either leaves it unable to start. Installing it
  // again repairs both, and files that are already here and whole are kept, not downloaded again.
  const customModel = data?.settings.customModel ?? null;
  const installedLabel = customModel?.label ?? models.find((model) => model.id === installedId)?.label ?? installedId;
  const needsReinstall =
    enabled &&
    (!!installedId || !!customModel) &&
    (data?.runtimeInstalled === false || data?.installedModelDownloaded === false);
  // Fetching as well as pending: on reopen the cached verdict is on screen while the
  // fresh one loads, and consent must not be recorded against a stale one.
  // Installed and working before an engine update changed the runtime: it needs an update, not a reinstall.
  const needsUpdate = data?.runtimeNeedsUpdate === true;
  const busy =
    updateRuntime.isPending ||
    enable.isPending ||
    install.isPending ||
    remove.isPending ||
    installRepo.isPending ||
    device.isPending ||
    sidecar.isPending ||
    sidecar.isFetching;
  // Where this machine cannot run any decision model, the way that still works is a
  // hosted decision service, so Add opens on the Decision job's services rather than naming one.
  const nothingRuns = decisionCannotRun(data);
  const openDecisionConnection = () => {
    openModal("job-picker", { job: "decision" });
  };

  /**
   * Turning it on is a decision with a cost, so it is confirmed against the verdict
   * for this machine rather than a generic warning. The confirm wording changes when
   * the verdict is a warning, because "Enable" reads as approval of something safe.
   */
  /** Every mutation here reports its own failure; a silent no-op reads as a bug. */
  const report = (error: unknown) => {
    toast.error(error instanceof Error ? error.message : localizeUi("ui.modals.decisionmodelmodal.installFailed"));
  };
  /** An install's failure: "cancelled" only when Cancel stopped this install, never a later failure. */
  const reportInstall = (error: unknown) => {
    if (!installCancelled.current) return report(error);
    installCancelled.current = false;
    toast(localizeUi("ui.modals.decisionmodelmodal.progress.cancelled"));
  };
  /** Runs one install; a Cancel pressed for an earlier one cannot relabel this one's failure. */
  const runInstall = async (start: () => Promise<unknown>) => {
    installCancelled.current = false;
    try {
      await start();
      toast.success(localizeUi("ui.modals.decisionmodelmodal.installed"));
      return true;
    } catch (error) {
      reportInstall(error);
      return false;
    } finally {
      installCancelled.current = false;
    }
  };

  const handleEnable = async (next: boolean): Promise<boolean> => {
    if (!next) {
      try {
        await enable.mutateAsync({ enabled: false });
        return true;
      } catch (error) {
        report(error);
      }
      return false;
    }
    if (!data || !selected) {
      // No status means no verdict, and consent recorded against an assumed
      // "recommended" would be consent to something nobody was shown.
      toast.error(localizeUi("ui.modals.decisionmodelmodal.statusUnavailable"));
      return false;
    }
    const verdict = selected.preflight.assessment.verdict;
    const tight = verdict === "tight" || verdict === "wont_fit_beside_sidecar";
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.modals.decisionmodelmodal.confirmTitle"),
      message: [
        localizeUi("ui.modals.decisionmodelmodal.confirmBody"),
        selected.preflight.reason ?? localizeUi("ui.modals.decisionmodelmodal.verdictRecommended"),
      ].join("\n\n"),
      confirmLabel: localizeUi(
        tight ? "ui.modals.decisionmodelmodal.enableAnyway" : "ui.modals.decisionmodelmodal.enable",
      ),
      tone: tight ? "destructive" : "default",
    });
    if (!confirmed) return false;
    try {
      await enable.mutateAsync({ enabled: true, confirmedVerdict: verdict });
      return true;
    } catch (error) {
      report(error);
    }
    return false;
  };

  /** One click from the row: consent to turn it on (with the verdict), then the download confirm. */
  const handleDownload = async () => {
    const wasOff = !enabled;
    if (wasOff && !(await handleEnable(true))) return;
    // Declining (or failing) the download must not leave the sidecar on with no model.
    if (!(await handleInstall()) && wasOff) await enable.mutateAsync({ enabled: false }).catch(report);
  };

  const handleInstall = async () => {
    if (!selected) return false;
    // The verdict is re-stated here rather than trusted from enable time: a bigger
    // sidecar model or a game can have taken the headroom since, and a download is
    // the expensive step to agree to blind.
    const warning = selected.preflight.reason;
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.modals.decisionmodelmodal.downloadTitle"),
      message: [
        localizeUi("ui.modals.decisionmodelmodal.downloadBody", {
          label: selected.label,
          size: formatBytes(selected.downloadSizeBytes),
          disk: formatBytes(selected.diskBytes),
          licenses: selected.licenses.join(", "),
        }),
        ...(warning ? [warning] : []),
      ].join("\n\n"),
      confirmLabel: localizeUi("ui.modals.decisionmodelmodal.download"),
      ...(warning ? { tone: "destructive" as const } : {}),
    });
    if (!confirmed) return false;
    return runInstall(() => install.mutateAsync(selected.id));
  };

  const handleReinstall = async () => {
    const checkpoint = customModel?.artifacts[0];
    if (!installedId && !checkpoint) return;
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.modals.decisionmodelmodal.reinstallTitle"),
      message: localizeUi("ui.modals.decisionmodelmodal.reinstallBody", { label: installedLabel ?? "" }),
      confirmLabel: localizeUi("ui.modals.decisionmodelmodal.reinstall"),
    });
    if (!confirmed) return;
    // A pasted model has no catalog id: it goes back through the repository route at the commit it was
    // installed from, which the server inspects again.
    await runInstall(() =>
      installedId
        ? install.mutateAsync(installedId)
        : installRepo.mutateAsync({ repoId: checkpoint!.repoId, revision: checkpoint!.revision }),
    );
  };

  const handleInstallRepo = async () => {
    const model = inspect.data?.model;
    if (!model) return;
    // The confirmation quotes what was inspected, so installing whatever happens to
    // be in the box now could download a different repository than the one the user
    // just agreed to. Editing the field after checking means checking again.
    const repo = repoInput.trim();
    if (inspectedRepo !== repo) {
      toast.error(localizeUi("ui.modals.decisionmodelmodal.recheckNeeded"));
      return;
    }
    // A GGUF repository is one file with no base model; an Open-Jev package pins one.
    const base = model.artifacts[1]?.repoId;
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.modals.decisionmodelmodal.downloadTitle"),
      message: localizeUi(
        base
          ? "ui.modals.decisionmodelmodal.downloadPastedBody"
          : "ui.modals.decisionmodelmodal.downloadPastedGgufBody",
        {
          label: model.label,
          base: base ?? "",
          size: formatBytes(model.downloadSizeBytes),
          // The download excludes the runtime's own environment, which is several
          // gigabytes on its own, so the total on disk is named separately.
          disk: formatBytes(model.diskBytes),
          licenses: model.licenses.join(", "),
        },
      ),
      confirmLabel: localizeUi("ui.modals.decisionmodelmodal.download"),
    });
    if (!confirmed) return;
    await runInstall(() =>
      installRepo.mutateAsync({
        repoId: repo,
        // The commit the confirmation described, so a branch moving in between
        // cannot substitute different weights.
        ...(inspect.data?.revision ? { revision: inspect.data.revision } : {}),
      }),
    );
  };

  /** How much memory a model takes, and which kind it is weighed against. */
  const memoryLine = (model: Pick<DecisionSidecarModel, "vramBytes" | "memory">) =>
    localizeUi(
      model.memory === "cpu"
        ? "connections.decisionDevice.memoryRam"
        : model.memory === "llama"
          ? "connections.decisionDevice.memoryAny"
          : "connections.decisionDevice.memory",
      { size: formatBytes(model.vramBytes) },
    );

  /** What a model answers, what it reads, and how fast it was here, in short lines. */
  const capabilities = (model: {
    questionTypes?: string[];
    inputs?: string[];
    extraInputs?: string[];
    speed?: DecisionSidecarModel["speed"];
  }) => {
    const list = (kind: "questionType" | "input", values: string[] | undefined) =>
      (values ?? []).map((value) => localizeUi(`ui.modals.decisionmodelmodal.${kind}.${value}`)).join(", ");
    const answers = list("questionType", model.questionTypes);
    const reads = list("input", model.inputs);
    const elsewhere = list("input", model.extraInputs);
    if (!answers && !reads) return null;
    // Timed on this computer, never quoted from somewhere else: a speed measured on
    // another machine would put people off for nothing, or promise too much.
    const seconds = (value: number) => numberFormat.format(value);
    const speed = model.speed
      ? [
          localizeUi("ui.modals.decisionmodelmodal.speed.scene", { seconds: seconds(model.speed.sceneSeconds) }),
          ...(model.speed.pictureSeconds !== undefined
            ? [
                localizeUi("ui.modals.decisionmodelmodal.speed.picture", {
                  seconds: seconds(model.speed.pictureSeconds),
                }),
              ]
            : []),
          ...(model.speed.clipSeconds !== undefined
            ? [localizeUi("ui.modals.decisionmodelmodal.speed.clip", { seconds: seconds(model.speed.clipSeconds) })]
            : []),
        ].join(", ")
      : null;
    return (
      <div className="mt-1 flex flex-col gap-1 text-[0.6875rem] text-[var(--muted-foreground)]">
        {answers && (
          <span className="flex items-start gap-1.5">
            <ListChecks size="0.75rem" className="mt-0.5 shrink-0" />
            {localizeUi("ui.modals.decisionmodelmodal.answers", { types: answers })}
          </span>
        )}
        {reads && (
          <span className="flex items-start gap-1.5">
            <Eye size="0.75rem" className="mt-0.5 shrink-0" />
            <span>
              {localizeUi("ui.modals.decisionmodelmodal.reads", { inputs: reads })}
              {elsewhere && (
                <span className="text-[var(--muted-foreground)]/70">
                  {" · "}
                  {localizeUi("ui.modals.decisionmodelmodal.readsElsewhere", { inputs: elsewhere })}
                </span>
              )}
            </span>
          </span>
        )}
        {"speed" in model && (
          <span className="flex items-start gap-1.5">
            <Gauge size="0.75rem" className="mt-0.5 shrink-0" />
            {speed
              ? localizeUi("ui.modals.decisionmodelmodal.speedLine", { parts: speed })
              : localizeUi("ui.modals.decisionmodelmodal.speedUnknown")}
          </span>
        )}
      </div>
    );
  };

  const decisionOptions = useDecisionOptions(true);
  const selectDecision = useSelectDecisionModel();
  const isDefault = decisionOptions.data?.selected === DECISION_SIDECAR_CONNECTION_ID;
  const running = data?.process.running === true;
  const processError = data?.process.error ?? null;
  // The same states, in the same order, as the other models on this device.
  const state: { tone: EngineTone; label: string } = nothingRuns
    ? { tone: "off", label: localizeUi("ui.modals.decisionmodelmodal.notAvailable") }
    : needsUpdate
      ? { tone: "warn", label: localizeUi("ui.modals.decisionmodelmodal.needsUpdateBadge") }
      : needsReinstall
        ? { tone: "warn", label: localizeUi("ui.modals.decisionmodelmodal.needsReinstallBadge") }
        : !hasModel
          ? { tone: "off", label: localizeUi("connections.device.state.notDownloaded") }
          : !enabled
            ? { tone: "off", label: localizeUi("connections.accounts.state.off") }
            : processError && !running
              ? { tone: "warn", label: localizeUi("connections.device.state.error") }
              : running
                ? { tone: "ok", label: localizeUi("connections.device.state.running") }
                : { tone: "ok", label: localizeUi("connections.device.state.ready") };
  const shown = installedId ? (models.find((model) => model.id === installedId) ?? selected) : selected;
  const switching = !!selected && hasModel && !customModel && selected.id !== installedId;
  // A download started before this page opened still counts, so its button stays busy.
  const installing = install.isPending || installRepo.isPending || !!installProgress;

  const body = (
    <div className="flex flex-col gap-3" data-component="DecisionModelDetail">
      <DetailHero
        icon={<ProviderIcon provider="decision" size="lg" />}
        title={localizeUi("ui.panels.sidecarcard.decisionSidecar")}
      >
        <StateWord tone={state.tone} label={state.label} />
        <span>· {localizeUi("connections.accounts.section.device")}</span>
      </DetailHero>

      {data?.supported && !nothingRuns && hasModel && (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => void handleEnable(!enabled)} disabled={busy} className={SMALL_ACTION}>
            {enable.isPending ? (
              <Spinner size="sm" />
            ) : enabled ? (
              <PowerOff size="0.75rem" />
            ) : (
              <Power size="0.75rem" />
            )}
            {localizeUi(enabled ? "connections.decisionDevice.turnOff" : "connections.decisionDevice.turnOn")}
          </button>
          {enabled && !isDefault && !needsReinstall && (
            <button
              type="button"
              disabled={selectDecision.isPending}
              onClick={() =>
                selectDecision.mutate(DECISION_SIDECAR_CONNECTION_ID, {
                  onSuccess: () => toast.success(localizeUi("connections.decisionDevice.nowDecision")),
                  onError: report,
                })
              }
              className={SMALL_ACTION}
            >
              {localizeUi("connections.decisionDevice.useForDecision")}
            </button>
          )}
          {needsUpdate && (
            <button
              type="button"
              onClick={() =>
                updateRuntime.mutate(undefined, {
                  onSuccess: () => toast.success(localizeUi("ui.modals.decisionmodelmodal.updated")),
                  onError: report,
                })
              }
              disabled={busy}
              className={SMALL_ACTION}
            >
              {updateRuntime.isPending ? <Spinner size="sm" /> : <RefreshCw size="0.75rem" />}
              {localizeUi(
                updateRuntime.isPending
                  ? "ui.modals.decisionmodelmodal.updating"
                  : "ui.modals.decisionmodelmodal.update",
              )}
            </button>
          )}
          {needsReinstall && (
            <button type="button" onClick={() => void handleReinstall()} disabled={busy} className={SMALL_ACTION}>
              {installing ? <Spinner size="sm" /> : <Download size="0.75rem" />}
              {localizeUi("ui.modals.decisionmodelmodal.reinstall")}
            </button>
          )}
        </div>
      )}

      {data && nothingRuns ? (
        // Greyed out, never hidden: people who read about this elsewhere need to see
        // why it is not offered, and what does work instead.
        <div className="mari-device-warn rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-2.5 text-[0.6875rem]">
          <p className="text-[var(--foreground)]">
            {data.supported
              ? localizeUi("ui.game.gamesurfacecomponent.value1", {
                  value1: localizeUi("ui.modals.decisionmodelmodal.notAvailable"),
                })
              : localizeUi("ui.game.gamesurfacecomponent.value1", { value1: data.unsupportedReason })}{" "}
            {localizeUi("ui.modals.decisionmodelmodal.useLocalInstead")}
          </p>
          <button type="button" onClick={openDecisionConnection} className={cn(SMALL_ACTION, "mt-2")}>
            <Link2 size="0.75rem" />
            {localizeUi("ui.modals.decisionmodelmodal.setUpDecisionConnection")}
          </button>
        </div>
      ) : null}

      {needsUpdate && (
        <p className="mari-device-warn rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-2.5 text-[0.6875rem] text-[var(--foreground)]">
          {localizeUi("ui.modals.decisionmodelmodal.needsUpdateBody")}
        </p>
      )}
      {needsReinstall && (
        <p className="mari-device-warn rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-2.5 text-[0.6875rem] text-[var(--foreground)]">
          {localizeUi("ui.modals.decisionmodelmodal.needsReinstall", { label: installedLabel ?? "" })}
        </p>
      )}
      {processError && enabled && !running && !needsReinstall && !needsUpdate && (
        <div
          role="alert"
          className="mari-device-warn rounded-lg border border-[var(--marinara-app-accent-static)]/20 bg-[var(--marinara-app-accent-static)]/5 p-2.5 text-[0.6875rem]"
        >
          <div className="text-[var(--muted-foreground)] [overflow-wrap:anywhere]">{processError}</div>
        </div>
      )}
      {hasInstall && <LocalModelSlotNote slot="decision" />}

      {data?.supported && !nothingRuns && (
        <section className={DETAIL_CARD_CLASS}>
          <FactRow label={localizeUi("connections.device.fact.model")}>
            {customModel ? (
              <span className="block">{customModel.label}</span>
            ) : (
              // A dropdown, like the embedding model's: the name fits on one line on a phone.
              <Select
                value={selected?.id ?? null}
                disabled={busy}
                onChange={(next) => setSelectedId(next)}
                label={localizeUi("connections.device.fact.model")}
                className={DEVICE_FIELD}
                // A model this computer cannot run stays choosable, so its reason can be read; its Download stays off.
                options={models.map((model) => ({
                  value: model.id,
                  label:
                    model.id === installedId
                      ? model.label
                      : !model.preflight.installable
                        ? localizeUi("ui.modals.decisionmodelmodal.optionCannotRun", { model: model.label })
                        : model.downloaded
                          ? localizeUi("ui.modals.decisionmodelmodal.optionDownloaded", { model: model.label })
                          : localizeUi("connections.builtinEmbedding.optionToDownload", {
                              model: model.label,
                              size: formatBytes(model.downloadSizeBytes),
                            }),
                }))}
              />
            )}
            {selected && (
              <span className="mt-1 block text-[0.6875rem] text-[var(--muted-foreground)]">{selected.description}</span>
            )}
            {selected && capabilities(selected)}
            {selected?.preflight.reason ? (
              <span className="mt-1 block text-[0.6875rem] text-[var(--warning)]">{selected.preflight.reason}</span>
            ) : selected ? (
              <span className="mt-1 block text-[0.6875rem] text-[var(--muted-foreground)]">
                {[selected.languages, selected.licenses.join(", ")].filter(Boolean).join(" · ")}
              </span>
            ) : null}
          </FactRow>
          {shown && <FactRow label={localizeUi("connections.device.fact.memory")}>{memoryLine(shown)}</FactRow>}
          <FactRow label={localizeUi("connections.device.fact.usedBy")}>
            {isDefault ? localizeUi("connections.decision.label") : localizeUi("connections.device.usedBy.none")}
          </FactRow>
          <FactRow label={localizeUi("connections.builtinEmbedding.runsOn")}>
            {/* A processor-only model ignores the card, so it names the processor, not a card. */}
            {shown?.memory === "cpu" ? (
              <span className="block">{localizeUi("connections.builtinEmbedding.device.cpu")}</span>
            ) : data.devices.length > 1 ? (
              <Select
                value={String(data.cudaDevice)}
                disabled={busy}
                onChange={(next) => device.mutate(Number(next), { onError: report })}
                label={localizeUi("connections.builtinEmbedding.runsOn")}
                className={DEVICE_FIELD}
                options={data.devices.map((entry) => ({
                  value: String(entry.index),
                  label: localizeUi("ui.modals.decisionmodelmodal.gpuOption", {
                    index: entry.index,
                    name: entry.name,
                    memory: formatBytes(entry.totalBytes),
                  }),
                }))}
              />
            ) : (
              <span className="block">
                {data.devices[0]?.name ?? localizeUi("connections.builtinEmbedding.device.auto")}
              </span>
            )}
          </FactRow>
          {/* Off by default, because a model that only answers gates does not need to hold memory from boot. */}
          <FactRow label={localizeUi("connections.decisionDevice.starts")}>
            <Select
              value={data.settings.startPolicy === "with_marinara" ? "with_marinara" : "on_demand"}
              disabled={busy || !hasInstall}
              onChange={(next) => startPolicy.mutate(next, { onError: report })}
              label={localizeUi("connections.decisionDevice.starts")}
              className={DEVICE_FIELD}
              options={[
                { value: "on_demand", label: localizeUi("connections.decisionDevice.startOnDemand") },
                { value: "with_marinara", label: localizeUi("connections.decisionDevice.startWithMarinara") },
              ]}
            />
          </FactRow>
          {hasInstall && <UnloadWhenUnusedRow />}
        </section>
      )}

      {/* One primary button, as on the other models: download, or download the model picked above. */}
      {data?.supported && !nothingRuns && selected && (!hasModel || switching) && (
        <button
          type="button"
          onClick={() => void (hasModel ? handleInstall() : handleDownload())}
          disabled={busy || installing || !selected.preflight.installable}
          className="mari-chrome-control mari-chrome-control--primary w-full"
        >
          {installing ? <Spinner size="sm" /> : <HardDriveDownload size="0.8125rem" />}
          {installing
            ? localizeUi("ui.modals.decisionmodelmodal.installing")
            : selected.downloaded
              ? localizeUi("ui.modals.decisionmodelmodal.useSelected")
              : localizeUi("connections.builtinEmbedding.downloadModel", {
                  model: selected.label,
                  size: formatBytes(selected.downloadSizeBytes),
                })}
        </button>
      )}

      {installProgress && (
        <InstallProgressBar
          progress={installProgress}
          cancelling={cancelInstall.isPending}
          onCancel={() => {
            installCancelled.current = true;
            cancelInstall.mutate(undefined, {
              onError: (error) => {
                installCancelled.current = false;
                report(error);
              },
            });
          }}
        />
      )}

      {/* Bring your own: checked first, always, so the size and base weights are seen before agreeing. */}
      {data?.supported && !nothingRuns && (
        <section className={DETAIL_CARD_CLASS}>
          <div className="text-xs font-medium">{localizeUi("ui.modals.decisionmodelmodal.byoTitle")}</div>
          <p className="mt-1 text-[0.6875rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.modals.decisionmodelmodal.byoHelp")}
          </p>
          <div className="mt-2 flex gap-1.5">
            <input
              value={repoInput}
              onChange={(event) => {
                setRepoInput(event.target.value);
                setInspectedRepo("");
                inspect.reset();
              }}
              placeholder={localizeUi("ui.modals.decisionmodelmodal.byoPlaceholder")}
              aria-label={localizeUi("ui.modals.decisionmodelmodal.byoTitle")}
              className={cn(DEVICE_FIELD, "max-w-none flex-1")}
            />
            <button
              type="button"
              disabled={!repoInput.trim() || inspect.isPending || busy}
              onClick={() => {
                const repo = repoInput.trim();
                setInspectedRepo(repo);
                inspect.mutate({ repoId: repo }, { onError: report });
              }}
              className={SMALL_ACTION}
            >
              {localizeUi(
                inspect.isPending ? "ui.modals.decisionmodelmodal.checking" : "ui.modals.decisionmodelmodal.check",
              )}
            </button>
          </div>
          {inspect.data?.refusal && (
            <p className="mt-2 text-[0.6875rem] text-[var(--warning)]">
              {localizeUi(`ui.modals.decisionmodelmodal.refusal.${inspect.data.refusal}`, {
                defaultValue: localizeUi("ui.modals.decisionmodelmodal.refusal.unreadable_manifest"),
              })}
            </p>
          )}
          {inspect.data?.model && inspect.data.preflight && (
            <div className="mt-2 flex flex-col gap-1">
              <div className="text-xs font-medium">{inspect.data.model.label}</div>
              {capabilities(inspect.data.model)}
              <div className="text-[0.6875rem] text-[var(--muted-foreground)]">
                {[
                  formatBytes(inspect.data.model.downloadSizeBytes),
                  memoryLine(inspect.data.model),
                  // A GGUF repository has no separate base weights.
                  ...(inspect.data.model.artifacts[1]
                    ? [
                        localizeUi("ui.modals.decisionmodelmodal.baseWeights", {
                          base: inspect.data.model.artifacts[1].repoId,
                        }),
                      ]
                    : []),
                  localizeUi("ui.modals.decisionmodelmodal.pastedLicenses", {
                    licenses: inspect.data.model.licenses.join(", "),
                  }),
                ].join(" · ")}
              </div>
              {inspect.data.preflight.reason && (
                <div className="text-[0.6875rem] text-[var(--warning)]">{inspect.data.preflight.reason}</div>
              )}
              <button
                type="button"
                disabled={!inspect.data.preflight.installable || busy}
                onClick={() => void handleInstallRepo()}
                className={cn(SMALL_ACTION, "self-start")}
              >
                <Download size="0.75rem" />
                {localizeUi("ui.modals.decisionmodelmodal.installPasted")}
              </button>
            </div>
          )}
        </section>
      )}

      {/* Switching it off keeps its files, and deleting them must not require switching it back on. */}
      {hasInstall && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (
              await showConfirmDialog({
                title: localizeUi("ui.modals.decisionmodelmodal.removeTitle"),
                message: localizeUi("ui.modals.decisionmodelmodal.removeBody"),
                confirmLabel: localizeUi("ui.modals.decisionmodelmodal.remove"),
                tone: "destructive",
              })
            ) {
              try {
                await remove.mutateAsync();
              } catch (error) {
                report(error);
              }
            }
          }}
          className={cn(SMALL_ACTION, "mari-device-remove self-start")}
        >
          <Trash2 size="0.75rem" />
          {localizeUi("connections.device.removeFiles")}
        </button>
      )}
    </div>
  );
  return body;
}

/**
 * One bar for the whole install: the program that runs the model first, then the
 * model's files counted together, with the speed and time left so a slow download
 * reads as slow rather than stuck.
 */
function InstallProgressBar({
  progress,
  cancelling,
  onCancel,
}: {
  progress: DecisionInstallProgress;
  cancelling: boolean;
  onCancel: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const percent = progress.total > 0 ? Math.min(100, Math.floor((progress.downloaded / progress.total) * 100)) : null;
  const secondsLeft =
    progress.speed > 0 && progress.total > 0 ? (progress.total - progress.downloaded) / progress.speed : null;
  const timeLeft =
    secondsLeft === null
      ? null
      : secondsLeft < 60
        ? localizeUi("ui.modals.decisionmodelmodal.progress.underMinute")
        : localizeUi("ui.modals.decisionmodelmodal.progress.minutesLeft", { count: Math.round(secondsLeft / 60) });
  const runtime = progress.phase === "runtime";
  return (
    <div className="flex flex-col gap-1.5" role="status" aria-live="polite">
      <div
        className="h-1.5 overflow-hidden rounded-full bg-[var(--secondary)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        {...(percent === null ? {} : { "aria-valuenow": percent })}
      >
        <div
          className={cn(
            "h-full rounded-full bg-[var(--primary)] transition-[width]",
            percent === null && "animate-pulse",
          )}
          style={{ width: `${percent ?? 8}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-[0.6875rem] text-[var(--muted-foreground)]">
        <span className="min-w-0">
          {runtime
            ? localizeUi("ui.modals.decisionmodelmodal.progress.runtime", { model: progress.label })
            : localizeUi("ui.modals.decisionmodelmodal.progress.model", {
                model: progress.label,
                done: formatBytes(progress.downloaded),
                total: formatBytes(progress.total),
                percent: percent ?? 0,
              })}
          {!runtime && progress.speed > 0 && (
            <>
              {" · "}
              {localizeUi("ui.modals.decisionmodelmodal.progress.speed", { speed: formatBytes(progress.speed) })}
              {timeLeft && ` · ${timeLeft}`}
            </>
          )}
        </span>
        {!runtime && (
          <button type="button" onClick={onCancel} disabled={cancelling} className={SMALL_ACTION}>
            <X size="0.75rem" />
            {localizeUi("connections.builtinEmbedding.cancel")}
          </button>
        )}
      </div>
    </div>
  );
}
