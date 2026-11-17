// Mesh avatar setup on the 2D Avatars agent page (lane: 2D): import a `.mavatar` and choose the look the
// avatar shows for each feeling. The runtime itself is not loaded here; the stage loads it to draw.
import { useRef, useState, type ChangeEvent } from "react";
import { Trash2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AVATAR_EMOTIONS, type AvatarEmotion } from "@marinara-engine/shared";
import { useAvatarModelActions } from "../../../../hooks/use-avatar-models";
import { showConfirmDialog } from "../../../../lib/app-dialogs";
import { SETTINGS_BUTTON_CLASS, SettingsSection } from "../../../../components/panels/settings/SettingControls";
import type { AvatarKindSetupPanelProps } from "../../contract";
import { AVATAR_EMOTION_LABEL_KEYS, AVATAR_SETUP_SELECT_CLASS, errorMessage } from "../pngtuber/PngtuberSetupPanel";
import { MESH_AVATAR_EMOTION_TAGS, MESH_AVATAR_EXTRA_EXPRESSIONS } from "./mesh-avatar-face";
import { Spinner } from "../../../../components/ui/Spinner";
import { Select } from "../../../../components/ui/Select";

const EXTRA_LOOK_KEYS: Readonly<Record<(typeof MESH_AVATAR_EXTRA_EXPRESSIONS)[number], string>> = {
  smile: "avatars.meshAvatar.lookSmile",
  shy: "avatars.meshAvatar.lookShy",
  halfLidded: "avatars.meshAvatar.lookHalfLidded",
  wink: "avatars.meshAvatar.lookWink",
};

export function MeshAvatarSetupPanel({ owner, config, onChanged }: AvatarKindSetupPanelProps) {
  const { t } = useTranslation();
  const { save, importFile, remove } = useAvatarModelActions(owner, onChanged);
  const fileInput = useRef<HTMLInputElement>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const stored = config?.kinds["mesh-avatar"] ?? null;
  const busy = save.isPending || importFile.isPending || remove.isPending;

  const chooseLook = (emotion: AvatarEmotion, target: string) => {
    if (!stored) return;
    save.mutate(
      {
        kinds: {
          "mesh-avatar": {
            ...stored,
            expressionMap: { ...stored.expressionMap, [emotion]: { target, source: "user", confidence: 1 } },
          },
        },
      },
      { onError: (error) => toast.error(t("avatars.meshAvatar.saveFailed", { reason: errorMessage(error) })) },
    );
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setWarnings([]);
    importFile.mutate(
      { kind: "mesh-avatar", file },
      {
        onSuccess: (result) => {
          setWarnings(result.warnings);
          toast.success(t("avatars.meshAvatar.imported"));
        },
        onError: (error) => toast.error(t("avatars.meshAvatar.importFailed", { reason: errorMessage(error) })),
      },
    );
  };

  const onRemove = async () => {
    const confirmed = await showConfirmDialog({
      title: t("avatars.meshAvatar.removeTitle"),
      message: t("avatars.meshAvatar.removeConfirm"),
      confirmLabel: t("avatars.meshAvatar.remove"),
      tone: "destructive",
    });
    if (!confirmed) return;
    remove.mutate("mesh-avatar", {
      onError: (error) => toast.error(t("avatars.meshAvatar.saveFailed", { reason: errorMessage(error) })),
    });
  };

  const drawnMouth = (stored?.expressionMap.aa?.confidence ?? 0) >= 1;

  return (
    <SettingsSection
      title={t("avatars.meshAvatar.title")}
      description={t("avatars.meshAvatar.description")}
      contentClassName="space-y-3"
    >
      <p className="text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]" data-avatar-mesh-status>
        {stored
          ? drawnMouth
            ? t("avatars.meshAvatar.readyDrawnMouth")
            : t("avatars.meshAvatar.readySimpleMouth")
          : t("avatars.meshAvatar.empty")}
      </p>

      {stored && (
        <fieldset className="space-y-1.5" disabled={busy}>
          <legend className="mb-1 text-[0.6875rem] font-semibold">{t("avatars.meshAvatar.feelings")}</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {AVATAR_EMOTIONS.map((emotion) => (
              <div key={emotion} className="flex flex-col gap-1 text-[0.6875rem]">
                <span>{t(AVATAR_EMOTION_LABEL_KEYS[emotion])}</span>
                <Select
                  disabled={busy}
                  id={`avatar-feeling-${emotion}`}
                  label={t(AVATAR_EMOTION_LABEL_KEYS[emotion])}
                  value={stored.expressionMap[emotion]?.target ?? emotion}
                  onChange={(next) => chooseLook(emotion, next)}
                  className={AVATAR_SETUP_SELECT_CLASS}
                  options={[
                    ...MESH_AVATAR_EMOTION_TAGS.map((tag) => ({
                      value: tag,
                      label: t(AVATAR_EMOTION_LABEL_KEYS[tag]),
                    })),
                    ...MESH_AVATAR_EXTRA_EXPRESSIONS.map((look) => ({ value: look, label: t(EXTRA_LOOK_KEYS[look]) })),
                  ]}
                />
              </div>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={SETTINGS_BUTTON_CLASS}
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          {importFile.isPending ? (
            <Spinner size="sm" aria-hidden="true" />
          ) : (
            <Upload size="0.75rem" aria-hidden="true" />
          )}
          {importFile.isPending
            ? t("avatars.meshAvatar.importing")
            : stored
              ? t("avatars.meshAvatar.replace")
              : t("avatars.meshAvatar.import")}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".mavatar"
          className="hidden"
          onChange={onFile}
          data-avatar-import="mesh-avatar"
          aria-label={t("avatars.meshAvatar.import")}
        />
        {stored && (
          <button
            type="button"
            className={`${SETTINGS_BUTTON_CLASS} mari-chrome-control--danger`}
            disabled={busy}
            onClick={() => void onRemove()}
          >
            <Trash2 size="0.75rem" aria-hidden="true" />
            {t("avatars.meshAvatar.remove")}
          </button>
        )}
      </div>

      {warnings.length > 0 && (
        <div
          role="status"
          className="rounded-lg bg-[var(--secondary)]/60 p-2 text-[0.6875rem] ring-1 ring-[var(--border)]"
        >
          <div className="mb-1 font-semibold">{t("avatars.meshAvatar.importNotes")}</div>
          <ul className="list-disc space-y-0.5 pl-4">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </SettingsSection>
  );
}
