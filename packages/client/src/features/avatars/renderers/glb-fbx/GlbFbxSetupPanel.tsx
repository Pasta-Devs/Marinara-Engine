// GLB and FBX setup on the 3D Avatars agent page (lane: 3D): import a rigged `.glb` or `.fbx`, see how many body
// bones its rig matched, and check or change which blend shape shows each face and mouth shape. A model whose
// rig can't be matched is refused at import, and the reason stays on the page.
import { useState } from "react";
import { AlertTriangle, Info, Loader2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AVATAR_HUMANOID_BONES, type GlbFbxAvatarData } from "@marinara-engine/shared";
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

export function GlbFbxSetupPanel({ owner, config, onChanged }: AvatarKindSetupPanelProps) {
  const { t } = useTranslation();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [pending, setPending] = useState<{ base: GlbFbxAvatarData; data: GlbFbxAvatarData } | null>(null);
  const { save, importFile, remove } = useAvatarModelActions(owner, onChanged, {
    importFile: {
      onSuccess: (result) => {
        setWarnings(result.warnings);
        setRefusal(null);
        toast.success(t("avatars.glbFbx.imported"));
      },
      onError: (error) => {
        const message = modelErrorMessage(error, t("avatars.glbFbx.importFailed"));
        setRefusal(message);
        toast.error(message);
      },
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
        setRefusal(null);
        toast.success(t("avatars.glbFbx.removed"));
      },
      onError: (error) => toast.error(modelErrorMessage(error, t("avatars.vrm.removeFailed"))),
    },
  });
  const stored = config?.kinds["glb-fbx"] ?? null;
  const data = pending && pending.base === stored ? pending.data : stored;
  const busy = save.isPending || importFile.isPending || remove.isPending;
  const saveData = (next: GlbFbxAvatarData) => {
    if (stored) setPending({ base: stored, data: next });
    save.mutate({ kinds: { "glb-fbx": next } });
  };
  const confirmRemove = async () => {
    if (
      await showConfirmDialog({
        title: t("avatars.glbFbx.removeConfirm.title"),
        message: t("avatars.glbFbx.removeConfirm.message"),
        confirmLabel: t("avatars.glbFbx.remove"),
        tone: "destructive",
      })
    )
      remove.mutate("glb-fbx");
  };
  return (
    <div className="min-w-0 max-w-full space-y-3" data-avatar-glb-fbx-setup>
      <ModelSection title={t("avatars.glbFbx.title")} description={t("avatars.glbFbx.description")}>
        {data ? (
          <p className="text-[0.6875rem] text-[var(--foreground)]" data-glb-fbx-bones>
            {t("avatars.glbFbx.bonesMatched", {
              format: data.format.toUpperCase(),
              matched: Object.keys(data.bones).length,
              total: AVATAR_HUMANOID_BONES.length,
            })}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <ModelFileButton
            accept=".glb,.fbx"
            label={t(data ? "avatars.glbFbx.replace" : "avatars.glbFbx.import")}
            busy={importFile.isPending}
            disabled={busy}
            onFile={(file) => importFile.mutate({ kind: "glb-fbx", file })}
          />
          {data ? (
            <button type="button" disabled={busy} onClick={() => void confirmRemove()} className={MODEL_BUTTON_CLASS}>
              {remove.isPending ? (
                <Loader2 size="0.75rem" className="animate-spin" />
              ) : (
                <Trash2 size="0.75rem" className="text-[var(--destructive)]" />
              )}
              {t("avatars.glbFbx.remove")}
            </button>
          ) : null}
        </div>
        <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
          {t("avatars.glbFbx.authorTerms")}
        </p>
        {refusal ? (
          <p
            role="alert"
            className="flex items-start gap-1.5 text-[0.6875rem] leading-relaxed text-[var(--destructive)]"
            data-glb-fbx-refusal
          >
            <AlertTriangle size="0.75rem" className="mt-px shrink-0" aria-hidden="true" />
            <span>{refusal}</span>
          </p>
        ) : null}
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
        <ModelSection title={t("avatars.vrm.expressions.title")} description={t("avatars.glbFbx.expressionsHelp")}>
          {data.expressionNames?.length ? (
            <ExpressionBindings
              data={data}
              saving={busy}
              onChange={(expressionMap) => saveData({ ...data, expressionMap })}
            />
          ) : (
            <p className="text-xs text-[var(--muted-foreground)]" data-glb-fbx-body-only>
              {t("avatars.glbFbx.bodyOnly")}
            </p>
          )}
        </ModelSection>
      ) : null}
    </div>
  );
}
