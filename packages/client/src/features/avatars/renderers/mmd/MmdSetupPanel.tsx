import { useState } from "react";
import { Info, Loader2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { MmdAvatarData } from "@marinara-engine/shared";
import { useAvatarModelActions } from "../../../../hooks/use-avatar-models";
import { showConfirmDialog } from "../../../../lib/app-dialogs";
import type { AvatarKindSetupPanelProps } from "../../contract";
import {
  ExpressionBindings,
  ModelFileButton,
  ModelSection,
  MODEL_BUTTON_CLASS,
  modelErrorMessage,
} from "../../setup/ModelSetupControls";

export function MmdSetupPanel({ owner, config, onChanged }: AvatarKindSetupPanelProps) {
  const { t } = useTranslation();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pending, setPending] = useState<{ base: MmdAvatarData; data: MmdAvatarData } | null>(null);
  const { save, importFile, remove } = useAvatarModelActions(owner, onChanged, {
    importFile: {
      onSuccess: (result, { file }) => {
        setWarnings(result.warnings);
        toast.success(t(/\.vmd$/iu.test(file.name) ? "avatars.mmd.motionAdded" : "avatars.mmd.imported"));
      },
      onError: (error) => toast.error(modelErrorMessage(error, t("avatars.mmd.importFailed"))),
    },
    save: {
      onError: (error) => {
        setPending(null);
        toast.error(modelErrorMessage(error, t("avatars.vrm.saveFailed")));
      },
    },
    remove: {
      onSuccess: () => {
        setWarnings([]);
        toast.success(t("avatars.mmd.removed"));
      },
      onError: (error) => toast.error(modelErrorMessage(error, t("avatars.vrm.removeFailed"))),
    },
  });
  const stored = config?.kinds.mmd ?? null;
  const data = pending && pending.base === stored ? pending.data : stored;
  const busy = save.isPending || importFile.isPending || remove.isPending;
  const saveData = (next: MmdAvatarData) => {
    if (stored) setPending({ base: stored, data: next });
    save.mutate({ kinds: { mmd: next } });
  };
  const importModel = (file: File) => importFile.mutate({ kind: "mmd", file });
  const confirmRemove = async () => {
    if (
      await showConfirmDialog({
        title: t("avatars.mmd.removeConfirm.title"),
        message: t("avatars.mmd.removeConfirm.message"),
        confirmLabel: t("avatars.mmd.remove"),
        tone: "destructive",
      })
    )
      remove.mutate("mmd");
  };
  return (
    <div className="min-w-0 max-w-full space-y-3" data-avatar-mmd-setup>
      <ModelSection title={t("avatars.mmd.title")} description={t("avatars.mmd.description")}>
        <div className="flex flex-wrap gap-2">
          <ModelFileButton
            accept=".pmx,.zip"
            label={t(data ? "avatars.mmd.replace" : "avatars.mmd.import")}
            busy={importFile.isPending}
            disabled={busy}
            onFile={importModel}
          />
          {data ? (
            <button type="button" disabled={busy} onClick={() => void confirmRemove()} className={MODEL_BUTTON_CLASS}>
              {remove.isPending ? (
                <Loader2 size="0.75rem" className="animate-spin" />
              ) : (
                <Trash2 size="0.75rem" className="text-[var(--destructive)]" />
              )}
              {t("avatars.mmd.remove")}
            </button>
          ) : null}
        </div>
        <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">{t("avatars.mmd.authorTerms")}</p>
        {warnings.length ? (
          <ul className="space-y-1">
            {warnings.map((warning) => (
              <li
                key={warning}
                className="flex items-start gap-1.5 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]"
              >
                <Info size="0.75rem" className="mt-px shrink-0" aria-hidden="true" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </ModelSection>
      {data ? (
        <>
          <ModelSection title={t("avatars.vrm.expressions.title")} description={t("avatars.mmd.expressionsHelp")}>
            {data.expressionNames?.length ? (
              <ExpressionBindings
                data={data}
                saving={busy}
                onChange={(expressionMap) => saveData({ ...data, expressionMap })}
              />
            ) : (
              <p className="text-xs text-[var(--muted-foreground)]">{t("avatars.vrm.bodyOnlyHelp")}</p>
            )}
          </ModelSection>
          <ModelSection title={t("avatars.mmd.motionTitle")} description={t("avatars.mmd.motionHelp")}>
            <p className="text-[0.6875rem] text-[var(--foreground)]">
              {t(data.idleAnimation ? "avatars.mmd.customMotion" : "avatars.vrm.idle.builtIn")}
            </p>
            <div className="flex flex-wrap gap-2">
              <ModelFileButton
                accept=".vmd"
                label={t(data.idleAnimation ? "avatars.mmd.replaceMotion" : "avatars.mmd.addMotion")}
                busy={importFile.isPending}
                disabled={busy}
                onFile={(file) =>
                  /\.vmd$/iu.test(file.name) ? importModel(file) : toast.error(t("avatars.mmd.notMotion"))
                }
              />
              {data.idleAnimation ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => saveData({ ...data, idleAnimation: null })}
                  className={MODEL_BUTTON_CLASS}
                >
                  <Trash2 size="0.75rem" className="text-[var(--destructive)]" />
                  {t("avatars.mmd.removeMotion")}
                </button>
              ) : null}
            </div>
          </ModelSection>
        </>
      ) : null}
    </div>
  );
}
