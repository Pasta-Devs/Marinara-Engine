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
import { AlertTriangle, Check, Download, HardDrive, Link2, Loader2, Scale, Trash2, Zap } from "lucide-react";
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
  type DecisionSidecarModel,
} from "../../hooks/use-decision-sidecar";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { useUIStore } from "../../stores/ui.store";

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

  const row = (model: DecisionSidecarModel) => {
    const blocked = !model.preflight.installable;
    const chosen = selected?.id === model.id;
    return (
      <label
        key={model.id}
        className={`mari-dm-row flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
          blocked
            ? "cursor-not-allowed border-[var(--border)] opacity-60"
            : chosen
              ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)]"
              : "border-[var(--border)] hover:bg-[var(--secondary)]/50"
        }`}
      >
        <input
          type="radio"
          name="decision-model"
          value={model.id}
          checked={chosen}
          disabled={blocked}
          onChange={() => setSelectedId(model.id)}
          className="sr-only"
        />
        <div
          className={`h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${
            chosen
              ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-accent)]"
              : "border-[var(--border)]"
          }`}
        >
          {chosen && (
            <div className="flex h-full items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-white" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">{model.label}</div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted-foreground)]/70">
            <span className="flex items-center gap-1">
              <Download size="0.75rem" />
              {formatBytes(model.downloadSizeBytes)}
            </span>
            <span className="flex items-center gap-1">
              <HardDrive size="0.75rem" />~{formatBytes(model.vramBytes)}{" "}
              {localizeUi("ui.modals.decisionmodelmodal.vram")}
            </span>
            <span className="flex items-center gap-1">
              <Scale size="0.75rem" />
              {model.licenses.join(", ")}
            </span>
          </div>
          {/* An entry that cannot be installed says why, in the one sentence the
              preflight produced, rather than being hidden or left unexplained. */}
          {model.preflight.reason && (
            <div className="mt-1 text-[0.6875rem] max-sm:text-[13px] text-[var(--warning)]">
              {model.preflight.reason}
            </div>
          )}
        </div>
        {model.id === installedId &&
          (needsUpdate ? (
            <span className="flex items-center gap-1 rounded-full bg-[var(--warning)]/15 px-2 py-0.5 text-[0.625rem] font-medium text-[var(--warning)]">
              <AlertTriangle size="0.625rem" />
              {localizeUi("ui.modals.decisionmodelmodal.needsUpdateBadge")}
            </span>
          ) : needsReinstall ? (
            <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] max-sm:text-[13px] font-medium text-[var(--warning)] ring-1 ring-[var(--warning)]">
              {localizeUi("ui.modals.decisionmodelmodal.needsReinstallBadge")}
            </span>
          ) : (
            <span className="mari-chrome-accent-surface flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] max-sm:text-[13px] font-medium">
              <Check size="0.625rem" />
              {localizeUi("ui.modals.decisionmodelmodal.installedBadge")}
            </span>
          ))}
      </label>
    );
  };

  const body = (
    <div className="mari-dm-body flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Zap size="1rem" className="shrink-0 text-[var(--muted-foreground)]" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{localizeUi("ui.modals.decisionmodelmodal.title")}</div>
          <div className="text-xs text-[var(--muted-foreground)]">
            {[
              nothingRuns
                ? localizeUi("ui.modals.decisionmodelmodal.notAvailable")
                : needsReinstall
                  ? localizeUi("ui.modals.decisionmodelmodal.needsReinstallBadge")
                  : hasInstall
                    ? enabled
                      ? localizeUi("ui.modals.decisionmodelmodal.installedBadge")
                      : localizeUi("connections.accounts.state.off")
                    : localizeUi("connections.device.state.notDownloaded"),
              !hasInstall && !nothingRuns && selected ? formatBytes(selected.downloadSizeBytes) : installedLabel,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        {data?.supported && !hasInstall && !nothingRuns && (
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={busy || !selected?.preflight.installable}
            className="mari-chrome-control px-3"
          >
            {install.isPending ? <Loader2 size="0.75rem" className="animate-spin" /> : <Download size="0.75rem" />}
            {localizeUi("ui.modals.decisionmodelmodal.download")}
          </button>
        )}
        {data?.supported && hasInstall && !enabled && (
          <button
            type="button"
            onClick={() => void handleEnable(true)}
            disabled={busy}
            className="mari-chrome-control px-3"
          >
            {localizeUi("ui.modals.decisionmodelmodal.enableToggle")}
          </button>
        )}
      </div>

      {data && !data.supported ? (
        // Greyed out, never hidden: people who read about this elsewhere need to see
        // why it is not offered, and what does work instead.
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/50 p-3 text-xs text-[var(--muted-foreground)]">
          {data.unsupportedReason}. {localizeUi("ui.modals.decisionmodelmodal.useLocalInstead")}
        </div>
      ) : (
        <details className="group" open={needsReinstall || undefined}>
          <summary className="cursor-pointer text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.modals.decisionmodelmodal.options")}
          </summary>
          <div className="mt-3 flex flex-col gap-5">
            {/* Only with more than one card: with one there is nothing to choose. */}
            {data && data.devices.length > 1 && (
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium">{localizeUi("ui.modals.decisionmodelmodal.gpu")}</span>
                <select
                  value={String(data.cudaDevice)}
                  disabled={busy}
                  onChange={(event) => device.mutate(Number(event.target.value), { onError: report })}
                  className="mari-chrome-field h-11 w-full px-3 text-xs max-sm:text-base md:h-9"
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
                <span className="text-[0.625rem] max-sm:text-[13px] text-[var(--muted-foreground)]">
                  {localizeUi("ui.modals.decisionmodelmodal.gpuHelp")}
                </span>
              </label>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleEnable(!enabled)}
              className="mari-dm-toggle flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--sidebar-accent)] disabled:opacity-50"
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium">{localizeUi("ui.modals.decisionmodelmodal.enableToggle")}</div>
                <div className="mt-0.5 text-[0.625rem] max-sm:text-[13px] text-[var(--muted-foreground)]">
                  {localizeUi(
                    enabled ? "ui.modals.decisionmodelmodal.enabledHint" : "ui.modals.decisionmodelmodal.disabledHint",
                  )}
                </div>
              </div>
              {busy ? <Loader2 size="0.875rem" className="animate-spin" /> : enabled ? <Check size="0.875rem" /> : null}
            </button>

            {/* The model choice and Install only appear after the toggle is confirmed,
                so nothing can download from a single click. */}
            {enabled && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-[var(--muted-foreground)]/60">
                  {localizeUi("ui.modals.decisionmodelmodal.curated")}
                </span>
                {needsUpdate && (
                  <div className="flex items-center gap-3 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-3">
                    <p className="flex-1 text-xs text-[var(--muted-foreground)]">
                      {localizeUi("ui.modals.decisionmodelmodal.needsUpdateBody")}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        updateRuntime.mutate(undefined, {
                          onSuccess: () => toast.success(localizeUi("ui.modals.decisionmodelmodal.updated")),
                          onError: report,
                        })
                      }
                      disabled={busy}
                      className="mari-chrome-accent-surface flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                    >
                      {updateRuntime.isPending ? (
                        <Loader2 size="0.75rem" className="animate-spin" />
                      ) : (
                        <Download size="0.75rem" />
                      )}
                      {localizeUi(
                        updateRuntime.isPending
                          ? "ui.modals.decisionmodelmodal.updating"
                          : "ui.modals.decisionmodelmodal.update",
                      )}
                    </button>
                  </div>
                )}
                {models.map(row)}
                {needsReinstall && (
                  <div className="flex flex-col gap-2 rounded-xl border border-[var(--warning)] p-3">
                    <p className="text-[0.6875rem] max-sm:text-[13px] text-[var(--warning)]">
                      {localizeUi("ui.modals.decisionmodelmodal.needsReinstall", { label: installedLabel ?? "" })}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleReinstall()}
                      disabled={busy}
                      className="mari-chrome-accent-surface flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {install.isPending || installRepo.isPending ? (
                        <Loader2 size="0.875rem" className="animate-spin" />
                      ) : (
                        <Download size="0.875rem" />
                      )}
                      {localizeUi(
                        install.isPending || installRepo.isPending
                          ? "ui.modals.decisionmodelmodal.installing"
                          : "ui.modals.decisionmodelmodal.reinstall",
                      )}
                    </button>
                  </div>
                )}
                <button
                  onClick={() => void handleInstall()}
                  disabled={!selected || busy || !selected.preflight.installable || selected.id === installedId}
                  className="mari-chrome-accent-surface mt-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {install.isPending ? (
                    <Loader2 size="0.875rem" className="animate-spin" />
                  ) : (
                    <Download size="0.875rem" />
                  )}
                  {localizeUi(
                    install.isPending
                      ? "ui.modals.decisionmodelmodal.installing"
                      : "ui.modals.decisionmodelmodal.installSelected",
                  )}
                </button>
                {/* Pasting a repository, in the same block shape the chat installer
                    uses for its own bring-your-own section. Inspect first, always:
                    the user sees the base weights it pulls and the total size before
                    agreeing to any of it. */}
                <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--card)]/50 p-3">
                  <div className="text-xs font-medium">{localizeUi("ui.modals.decisionmodelmodal.byoTitle")}</div>
                  <p className="mt-1 text-[0.625rem] max-sm:text-[13px] text-[var(--muted-foreground)]">
                    {localizeUi("ui.modals.decisionmodelmodal.byoHelp")}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={repoInput}
                      onChange={(event) => {
                        setRepoInput(event.target.value);
                        setInspectedRepo("");
                        inspect.reset();
                      }}
                      placeholder={localizeUi("ui.modals.decisionmodelmodal.byoPlaceholder")}
                      className="min-w-0 flex-1 rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm max-sm:text-base ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)]"
                    />
                    <button
                      type="button"
                      disabled={!repoInput.trim() || inspect.isPending || busy}
                      onClick={() => {
                        const repo = repoInput.trim();
                        setInspectedRepo(repo);
                        inspect.mutate({ repoId: repo }, { onError: report });
                      }}
                      className="mari-chrome-control px-3"
                    >
                      {localizeUi(
                        inspect.isPending
                          ? "ui.modals.decisionmodelmodal.checking"
                          : "ui.modals.decisionmodelmodal.check",
                      )}
                    </button>
                  </div>
                  {inspect.data?.refusal && (
                    <p className="mt-2 text-[0.6875rem] max-sm:text-[13px] text-[var(--warning)]">
                      {localizeUi(`ui.modals.decisionmodelmodal.refusal.${inspect.data.refusal}`, {
                        defaultValue: localizeUi("ui.modals.decisionmodelmodal.refusal.unreadable_manifest"),
                      })}
                    </p>
                  )}
                  {inspect.data?.model && inspect.data.preflight && (
                    <div className="mt-2 rounded-lg border border-[var(--border)] p-2.5">
                      <div className="text-xs font-medium">{inspect.data.model.label}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[0.625rem] max-sm:text-[13px] text-[var(--muted-foreground)]/70">
                        <span className="flex items-center gap-1">
                          <Download size="0.75rem" />
                          {formatBytes(inspect.data.model.downloadSizeBytes)}
                        </span>
                        <span className="flex items-center gap-1">
                          <HardDrive size="0.75rem" />~{formatBytes(inspect.data.model.vramBytes)}{" "}
                          {localizeUi("ui.modals.decisionmodelmodal.vram")}
                        </span>
                        <span>
                          {localizeUi("ui.modals.decisionmodelmodal.baseWeights", {
                            base: inspect.data.model.artifacts[1]?.repoId ?? "",
                          })}
                        </span>
                        <span>
                          {localizeUi("ui.modals.decisionmodelmodal.pastedLicenses", {
                            licenses: inspect.data.model.licenses.join(", "),
                          })}
                        </span>
                      </div>
                      {inspect.data.preflight.reason && (
                        <div className="mt-1 text-[0.6875rem] max-sm:text-[13px] text-[var(--warning)]">
                          {inspect.data.preflight.reason}
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={!inspect.data.preflight.installable || busy}
                        onClick={() => void handleInstallRepo()}
                        className="mari-chrome-control mt-2 w-full"
                      >
                        {localizeUi("ui.modals.decisionmodelmodal.installPasted")}
                      </button>
                    </div>
                  )}
                </div>

                {/* Off by default, because a model that only answers gates does not
                    need to hold GPU memory from boot. */}
                <label className="mt-2 flex items-start gap-2 text-[0.625rem] max-sm:text-[13px] text-[var(--muted-foreground)] max-sm:min-h-11 max-sm:items-center max-sm:text-[13px]">
                  <input
                    type="checkbox"
                    checked={data?.settings.startPolicy === "with_marinara"}
                    disabled={busy}
                    onChange={(event) =>
                      startPolicy.mutate(event.target.checked ? "with_marinara" : "on_demand", { onError: report })
                    }
                    className="mt-0.5 accent-[var(--primary)]"
                  />
                  <span>{localizeUi("ui.modals.decisionmodelmodal.startWithMarinara")}</span>
                </label>
              </div>
            )}
            {/* Outside the enabled branch: switching the sidecar off keeps its
                  files, and deleting them must not require switching it back on. */}
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
                className="mari-chrome-control px-3"
              >
                <Trash2 size="0.75rem" />
                {localizeUi("ui.modals.decisionmodelmodal.remove")}
              </button>
            )}
          </div>
        </details>
      )}

      {nothingRuns && (
        <button type="button" onClick={openDecisionConnection} className="mari-chrome-control px-3 max-sm:!min-h-11">
          <Link2 size="0.75rem" />
          {localizeUi("ui.modals.decisionmodelmodal.setUpDecisionConnection")}
        </button>
      )}
    </div>
  );
  return body;
}
