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
import { Download, HardDriveDownload, Link2, Power, PowerOff, RefreshCw, Trash2 } from "lucide-react";
import { DECISION_SIDECAR_CONNECTION_ID } from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
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
import { useUIStore } from "../../stores/ui.store";
import { Spinner } from "../ui/Spinner";

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  return `${Math.round(bytes / 1_000_000)} MB`;
}

export function DecisionModelModal() {
  const { t: localizeUi } = useUiTranslation();
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
  const report = (error: unknown) =>
    toast.error(error instanceof Error ? error.message : localizeUi("ui.modals.decisionmodelmodal.installFailed"));

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
    try {
      await install.mutateAsync(selected.id);
      toast.success(localizeUi("ui.modals.decisionmodelmodal.installed"));
      return true;
    } catch (error) {
      report(error);
      return false;
    }
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
    try {
      // A pasted model has no catalog id: it goes back through the repository route at the commit it was
      // installed from, which the server inspects again.
      if (installedId) await install.mutateAsync(installedId);
      else await installRepo.mutateAsync({ repoId: checkpoint!.repoId, revision: checkpoint!.revision });
      toast.success(localizeUi("ui.modals.decisionmodelmodal.installed"));
    } catch (error) {
      report(error);
    }
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
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.modals.decisionmodelmodal.downloadTitle"),
      message: localizeUi("ui.modals.decisionmodelmodal.downloadPastedBody", {
        label: model.label,
        base: model.artifacts[1]?.repoId ?? "",
        size: formatBytes(model.downloadSizeBytes),
        // The download excludes the runtime's own environment, which is several
        // gigabytes on its own, so the total on disk is named separately.
        disk: formatBytes(model.diskBytes),
        licenses: model.licenses.join(", "),
      }),
      confirmLabel: localizeUi("ui.modals.decisionmodelmodal.download"),
    });
    if (!confirmed) return;
    try {
      await installRepo.mutateAsync({
        repoId: repo,
        // The commit the confirmation described, so a branch moving in between
        // cannot substitute different weights.
        ...(inspect.data?.revision ? { revision: inspect.data.revision } : {}),
      });
      toast.success(localizeUi("ui.modals.decisionmodelmodal.installed"));
    } catch (error) {
      report(error);
    }
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
        : !hasInstall
          ? { tone: "off", label: localizeUi("connections.device.state.notDownloaded") }
          : !enabled
            ? { tone: "off", label: localizeUi("connections.accounts.state.off") }
            : processError && !running
              ? { tone: "warn", label: localizeUi("connections.device.state.error") }
              : running
                ? { tone: "ok", label: localizeUi("connections.device.state.running") }
                : { tone: "ok", label: localizeUi("connections.device.state.ready") };
  const shown = installedId ? (models.find((model) => model.id === installedId) ?? selected) : selected;
  const switching = !!selected && hasInstall && !customModel && selected.id !== installedId;
  const installing = install.isPending || installRepo.isPending;

  const body = (
    <div className="flex flex-col gap-3" data-component="DecisionModelDetail">
      <DetailHero
        icon={<ProviderIcon provider="decision" size="lg" />}
        title={localizeUi("ui.panels.sidecarcard.decisionSidecar")}
      >
        <StateWord tone={state.tone} label={state.label} />
        <span>· {localizeUi("connections.accounts.section.device")}</span>
      </DetailHero>

      {data?.supported && !nothingRuns && hasInstall && (
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

      {data?.supported && !nothingRuns && (
        <section className={DETAIL_CARD_CLASS}>
          <FactRow label={localizeUi("connections.device.fact.model")}>
            {customModel ? (
              <span className="block">{customModel.label}</span>
            ) : (
              // A dropdown, like the embedding model's: the name fits on one line on a phone.
              <select
                value={selected?.id ?? ""}
                disabled={busy}
                onChange={(event) => setSelectedId(event.target.value)}
                aria-label={localizeUi("connections.device.fact.model")}
                className={DEVICE_FIELD}
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id} disabled={!model.preflight.installable}>
                    {model.id === installedId
                      ? model.label
                      : localizeUi("connections.builtinEmbedding.optionToDownload", {
                          model: model.label,
                          size: formatBytes(model.downloadSizeBytes),
                        })}
                  </option>
                ))}
              </select>
            )}
            {selected?.preflight.reason ? (
              <span className="mt-1 block text-[0.6875rem] text-[var(--warning)]">{selected.preflight.reason}</span>
            ) : selected ? (
              <span className="mt-1 block text-[0.6875rem] text-[var(--muted-foreground)]">
                {selected.licenses.join(", ")}
              </span>
            ) : null}
          </FactRow>
          {shown && (
            <FactRow label={localizeUi("connections.device.fact.memory")}>
              {localizeUi("connections.decisionDevice.memory", { size: formatBytes(shown.vramBytes) })}
            </FactRow>
          )}
          <FactRow label={localizeUi("connections.device.fact.usedBy")}>
            {isDefault ? localizeUi("connections.decision.label") : localizeUi("connections.device.usedBy.none")}
          </FactRow>
          <FactRow label={localizeUi("connections.builtinEmbedding.runsOn")}>
            {data.devices.length > 1 ? (
              <select
                value={String(data.cudaDevice)}
                disabled={busy}
                onChange={(event) => device.mutate(Number(event.target.value), { onError: report })}
                aria-label={localizeUi("connections.builtinEmbedding.runsOn")}
                className={DEVICE_FIELD}
              >
                {data.devices.map((entry) => (
                  <option key={entry.index} value={String(entry.index)}>
                    {localizeUi("ui.modals.decisionmodelmodal.gpuOption", {
                      index: entry.index,
                      name: entry.name,
                      memory: formatBytes(entry.totalBytes),
                    })}
                  </option>
                ))}
              </select>
            ) : (
              <span className="block">
                {data.devices[0]?.name ?? localizeUi("connections.builtinEmbedding.device.auto")}
              </span>
            )}
          </FactRow>
          {/* Off by default, because a model that only answers gates does not need to hold memory from boot. */}
          <FactRow label={localizeUi("connections.decisionDevice.starts")}>
            <select
              value={data.settings.startPolicy === "with_marinara" ? "with_marinara" : "on_demand"}
              disabled={busy || !hasInstall}
              onChange={(event) =>
                startPolicy.mutate(event.target.value as "with_marinara" | "on_demand", { onError: report })
              }
              aria-label={localizeUi("connections.decisionDevice.starts")}
              className={DEVICE_FIELD}
            >
              <option value="on_demand">{localizeUi("connections.decisionDevice.startOnDemand")}</option>
              <option value="with_marinara">{localizeUi("connections.decisionDevice.startWithMarinara")}</option>
            </select>
          </FactRow>
        </section>
      )}

      {/* One primary button, as on the other models: download, or download the model picked above. */}
      {data?.supported && !nothingRuns && selected && (!hasInstall || switching) && (
        <button
          type="button"
          onClick={() => void (hasInstall ? handleInstall() : handleDownload())}
          disabled={busy || !selected.preflight.installable}
          className="mari-chrome-control mari-chrome-control--primary w-full"
        >
          {installing ? <Spinner size="sm" /> : <HardDriveDownload size="0.8125rem" />}
          {installing
            ? localizeUi("ui.modals.decisionmodelmodal.installing")
            : localizeUi("connections.builtinEmbedding.downloadModel", {
                model: selected.label,
                size: formatBytes(selected.downloadSizeBytes),
              })}
        </button>
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
              <div className="text-[0.6875rem] text-[var(--muted-foreground)]">
                {[
                  formatBytes(inspect.data.model.downloadSizeBytes),
                  localizeUi("connections.decisionDevice.memory", {
                    size: formatBytes(inspect.data.model.vramBytes),
                  }),
                  localizeUi("ui.modals.decisionmodelmodal.baseWeights", {
                    base: inspect.data.model.artifacts[1]?.repoId ?? "",
                  }),
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
