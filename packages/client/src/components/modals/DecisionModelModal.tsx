// ──────────────────────────────────────────────
// Decision Model Modal
//
// Installs a decision model for the managed
// decision sidecar. Deliberately built from the
// same pieces as ModelDownloadModal — the same
// Modal shell, warning block, radio rows, fact
// line and primary action — so the two installers
// read as one feature rather than two.
//
// Kept separate from that component rather than
// added to it as a mode: the chat download path
// must keep behaving exactly as it does, and a
// 1400-line component is not the place to prove
// that.
// ──────────────────────────────────────────────

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Download, HardDrive, Loader2, Scale, Trash2, Zap } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Modal } from "../ui/Modal.js";
import {
  useDecisionSidecar,
  useEnableDecisionSidecar,
  useInstallDecisionModel,
  useInspectDecisionRepo,
  useInstallDecisionRepo,
  useRemoveDecisionSidecar,
  useSetDecisionStartPolicy,
  type DecisionSidecarModel,
} from "../../hooks/use-decision-sidecar";
import { showConfirmDialog } from "../../lib/app-dialogs";

interface Props {
  open: boolean;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  return `${Math.round(bytes / 1_000_000)} MB`;
}

export function DecisionModelModal({ open, onClose }: Props) {
  const { t: localizeUi } = useUiTranslation();
  const sidecar = useDecisionSidecar();
  const enable = useEnableDecisionSidecar();
  const install = useInstallDecisionModel();
  const remove = useRemoveDecisionSidecar();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [repoInput, setRepoInput] = useState("");
  const inspect = useInspectDecisionRepo();
  const installRepo = useInstallDecisionRepo();
  const startPolicy = useSetDecisionStartPolicy();

  const data = sidecar.data;
  const models = data?.models ?? [];
  const selected =
    models.find((model) => model.id === selectedId) ?? models.find((model) => model.preflight.installable) ?? null;
  const enabled = data?.settings.enabled === true;
  const installedId = data?.settings.modelId ?? null;
  const busy = enable.isPending || install.isPending || remove.isPending || installRepo.isPending;

  /**
   * Turning it on is a decision with a cost, so it is confirmed against the verdict
   * for this machine rather than a generic warning. The confirm wording changes when
   * the verdict is a warning, because "Enable" reads as approval of something safe.
   */
  const handleEnable = async (next: boolean) => {
    if (!next) {
      await enable.mutateAsync({ enabled: false });
      return;
    }
    const verdict = selected?.preflight.assessment.verdict ?? "recommended";
    const tight = verdict === "tight" || verdict === "wont_fit_beside_sidecar";
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.modals.decisionmodelmodal.confirmTitle"),
      message: [
        localizeUi("ui.modals.decisionmodelmodal.confirmBody"),
        selected?.preflight.reason ?? localizeUi("ui.modals.decisionmodelmodal.verdictRecommended"),
      ].join("\n\n"),
      confirmLabel: localizeUi(
        tight ? "ui.modals.decisionmodelmodal.enableAnyway" : "ui.modals.decisionmodelmodal.enable",
      ),
      tone: tight ? "destructive" : "default",
    });
    if (!confirmed) return;
    await enable.mutateAsync({ enabled: true, confirmedVerdict: verdict });
  };

  const handleInstall = async () => {
    if (!selected) return;
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.modals.decisionmodelmodal.downloadTitle"),
      message: localizeUi("ui.modals.decisionmodelmodal.downloadBody", {
        label: selected.label,
        size: formatBytes(selected.downloadSizeBytes),
        disk: formatBytes(selected.diskBytes),
        licenses: selected.licenses.join(", "),
      }),
      confirmLabel: localizeUi("ui.modals.decisionmodelmodal.download"),
    });
    if (!confirmed) return;
    try {
      await install.mutateAsync(selected.id);
      toast.success(localizeUi("ui.modals.decisionmodelmodal.installed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localizeUi("ui.modals.decisionmodelmodal.installFailed"));
    }
  };

  const handleInstallRepo = async () => {
    const model = inspect.data?.model;
    if (!model) return;
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.modals.decisionmodelmodal.downloadTitle"),
      message: localizeUi("ui.modals.decisionmodelmodal.downloadPastedBody", {
        label: model.label,
        base: model.artifacts[1]?.repoId ?? "",
        size: formatBytes(model.downloadSizeBytes),
      }),
      confirmLabel: localizeUi("ui.modals.decisionmodelmodal.download"),
    });
    if (!confirmed) return;
    try {
      await installRepo.mutateAsync({ repoId: repoInput.trim() });
      toast.success(localizeUi("ui.modals.decisionmodelmodal.installed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localizeUi("ui.modals.decisionmodelmodal.installFailed"));
    }
  };

  const row = (model: DecisionSidecarModel) => {
    const blocked = !model.preflight.installable;
    const chosen = selected?.id === model.id;
    return (
      <label
        key={model.id}
        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
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
            <div className="mt-1 text-[0.6875rem] text-[var(--warning)]">{model.preflight.reason}</div>
          )}
        </div>
        {model.id === installedId && (
          <span className="mari-chrome-accent-surface mari-accent-animated flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-medium">
            <Check size="0.625rem" />
            {localizeUi("ui.modals.decisionmodelmodal.installedBadge")}
          </span>
        )}
      </label>
    );
  };

  return (
    <Modal open={open} onClose={onClose} title={localizeUi("ui.modals.decisionmodelmodal.title")} width="max-w-2xl">
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div className="mari-chrome-accent-soft-tile mari-accent-animated flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <Zap size="1.25rem" />
          </div>
          <div className="text-sm text-[var(--muted-foreground)]">
            <p>{localizeUi("ui.modals.decisionmodelmodal.intro")}</p>
            <p className="mt-1.5 text-xs text-[var(--muted-foreground)]/70">
              {localizeUi("ui.modals.decisionmodelmodal.introDetail")}
            </p>
          </div>
        </div>

        {/* Always visible above the toggle, in the same shape the chat installer uses
            for its own "this is for helpers" warning. */}
        <div className="rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--warning)]">
            <AlertTriangle size="0.95rem" className="shrink-0" />
            {localizeUi("ui.modals.decisionmodelmodal.warningTitle")}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted-foreground)]">
            {localizeUi("ui.modals.decisionmodelmodal.warningBody")}
          </p>
        </div>

        {data && !data.supported ? (
          // Greyed out, never hidden: people who read about this elsewhere need to see
          // why it is not offered, and what does work instead.
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/50 p-3 text-xs text-[var(--muted-foreground)]">
            {data.unsupportedReason}. {localizeUi("ui.modals.decisionmodelmodal.useLocalInstead")}
          </div>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleEnable(!enabled)}
              className="mari-chrome-control flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left disabled:opacity-50"
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium">{localizeUi("ui.modals.decisionmodelmodal.enableToggle")}</div>
                <div className="mt-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
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
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]/60">
                  {localizeUi("ui.modals.decisionmodelmodal.curated")}
                </span>
                {models.map(row)}
                <button
                  onClick={() => void handleInstall()}
                  disabled={!selected || busy || selected.id === installedId}
                  className="mari-chrome-accent-surface mari-accent-animated mt-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
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
                  <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.modals.decisionmodelmodal.byoHelp")}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={repoInput}
                      onChange={(event) => {
                        setRepoInput(event.target.value);
                        inspect.reset();
                      }}
                      placeholder={localizeUi("ui.modals.decisionmodelmodal.byoPlaceholder")}
                      className="min-w-0 flex-1 rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)]"
                    />
                    <button
                      type="button"
                      disabled={!repoInput.trim() || inspect.isPending || busy}
                      onClick={() => inspect.mutate({ repoId: repoInput.trim() })}
                      className="mari-chrome-control mari-chrome-control--compact px-3 text-xs disabled:opacity-50"
                    >
                      {localizeUi(
                        inspect.isPending
                          ? "ui.modals.decisionmodelmodal.checking"
                          : "ui.modals.decisionmodelmodal.check",
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
                    <div className="mt-2 rounded-lg border border-[var(--border)] p-2.5">
                      <div className="text-xs font-medium">{inspect.data.model.label}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[0.625rem] text-[var(--muted-foreground)]/70">
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
                      </div>
                      {inspect.data.preflight.reason && (
                        <div className="mt-1 text-[0.6875rem] text-[var(--warning)]">
                          {inspect.data.preflight.reason}
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={!inspect.data.preflight.installable || busy}
                        onClick={() => void handleInstallRepo()}
                        className="mari-chrome-control mari-chrome-control--compact mt-2 w-full text-xs disabled:opacity-50"
                      >
                        {localizeUi("ui.modals.decisionmodelmodal.installPasted")}
                      </button>
                    </div>
                  )}
                </div>

                {/* Off by default, because a model that only answers gates does not
                    need to hold GPU memory from boot. */}
                <label className="mt-2 flex items-start gap-2 text-[0.625rem] text-[var(--muted-foreground)]">
                  <input
                    type="checkbox"
                    checked={data?.settings.startPolicy === "with_marinara"}
                    disabled={busy}
                    onChange={(event) => startPolicy.mutate(event.target.checked ? "with_marinara" : "on_demand")}
                    className="mt-0.5 accent-[var(--primary)]"
                  />
                  <span>{localizeUi("ui.modals.decisionmodelmodal.startWithMarinara")}</span>
                </label>

                {installedId && (
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
                        await remove.mutateAsync();
                      }
                    }}
                    className="mari-chrome-control mari-chrome-control--compact flex items-center justify-center gap-2 text-xs"
                  >
                    <Trash2 size="0.75rem" />
                    {localizeUi("ui.modals.decisionmodelmodal.remove")}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
