// PNGTuber setup on the 2D Avatars agent page (lane: 2D): reuse the owner's sprites, pick a face for each
// feeling (the six, and under "More feelings" the 23 extra ones), tune the hop and blink, and import a
// PNGTuber Plus `.save`.
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { ChevronRight, Loader2, Trash2, Upload, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AVATAR_EMOTIONS,
  AVATAR_FACE_GROUPS,
  PNGTUBER_DEFAULT_MOTION,
  type AvatarEmotion,
  type AvatarExpressionBinding,
  type AvatarExtraFeeling,
  type PngtuberAvatarData,
  type PngtuberMotion,
} from "@marinara-engine/shared";
import { useAvatarModelActions } from "../../../../hooks/use-avatar-models";
import { useCharacterSprites } from "../../../../hooks/use-characters";
import { showConfirmDialog } from "../../../../lib/app-dialogs";
import {
  SETTINGS_BUTTON_CLASS,
  SETTINGS_COMPACT_PRIMARY_BUTTON_CLASS,
  SettingsSection,
  ToggleSetting,
} from "../../../../components/panels/settings/SettingControls";
import type { AvatarKindSetupPanelProps } from "../../contract";
import { resolveAvatarImage } from "../../stage/avatar-stage-logic";
import { AVATAR_FEELING_LABEL_KEYS, buildPngtuberLayersFromSprites, pngtuberFaceChoices } from "./pngtuber-layers";

/** Labels of the six feelings, shared with the mesh avatar panel. */
export const AVATAR_EMOTION_LABEL_KEYS: Readonly<Record<AvatarEmotion, string>> = {
  neutral: "avatars.pngtuber.emotionNeutral",
  happy: "avatars.pngtuber.emotionHappy",
  angry: "avatars.pngtuber.emotionAngry",
  sad: "avatars.pngtuber.emotionSad",
  relaxed: "avatars.pngtuber.emotionRelaxed",
  surprised: "avatars.pngtuber.emotionSurprised",
};

const SOURCE_KEYS: Readonly<Record<PngtuberAvatarData["source"], string>> = {
  sprites: "avatars.pngtuber.sourceSprites",
  "pngtuber-plus": "avatars.pngtuber.sourcePlus",
  generated: "avatars.pngtuber.sourceGenerated",
};

export const AVATAR_SETUP_SELECT_CLASS =
  "w-full rounded-lg bg-[var(--secondary)] px-2.5 py-2 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";

export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}

/** Keeps the user's own picks whose face still exists; everything else comes from the fresh detection. Works
 *  for the six feelings' map and the extra feelings' map alike. */
function keepUserBindings<M extends Partial<Record<string, AvatarExpressionBinding>>>(
  previous: M | undefined,
  next: M | undefined,
  layers: PngtuberAvatarData["layers"],
): M {
  const map: Partial<Record<string, AvatarExpressionBinding>> = { ...next };
  for (const [slot, binding] of Object.entries(previous ?? {})) {
    if (binding?.source === "user" && (binding.target === null || Object.hasOwn(layers, binding.target))) {
      map[slot] = binding;
    }
  }
  return map as M;
}

export function PngtuberSetupPanel({ owner, config, onChanged }: AvatarKindSetupPanelProps) {
  const { t } = useTranslation();
  const sprites = useCharacterSprites(owner.ownerId);
  const { save, importFile, remove } = useAvatarModelActions(owner, onChanged);
  const fileInput = useRef<HTMLInputElement>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [motionDraft, setMotionDraft] = useState<PngtuberMotion | null>(null);

  const stored = config?.kinds.pngtuber ?? null;
  const spriteList = useMemo(() => sprites.data ?? [], [sprites.data]);
  const fromSprites = useMemo(() => buildPngtuberLayersFromSprites(spriteList), [spriteList]);
  /** What the avatar shows now: the saved setup, or the sprites until one is saved. */
  const shown = stored ?? fromSprites;
  /** Every face a feeling can be given, sprites made since the setup was saved too, past the first 64 sprites. */
  const spriteFaces = useMemo(() => buildPngtuberLayersFromSprites(spriteList, Infinity), [spriteList]);
  const faces = useMemo(() => pngtuberFaceChoices(shown, spriteFaces), [shown, spriteFaces]);
  const motion = motionDraft ?? shown?.motion ?? PNGTUBER_DEFAULT_MOTION;
  const busy = save.isPending || importFile.isPending || remove.isPending;
  /** Sprites can start a setup or refresh one built from sprites, never replace an imported or generated one. */
  const spritesApply = fromSprites && (!stored || stored.source === "sprites") ? fromSprites : null;

  const store = (next: PngtuberAvatarData) =>
    save.mutate(
      { kinds: { pngtuber: next }, ...(config?.activeKind ? {} : { activeKind: "pngtuber" as const }) },
      { onError: (error) => toast.error(t("avatars.pngtuber.saveFailed", { reason: errorMessage(error) })) },
    );

  const applySprites = () => {
    if (!spritesApply) return;
    store(
      stored
        ? {
            ...spritesApply,
            motion: stored.motion,
            expressionMap: keepUserBindings(stored.expressionMap, spritesApply.expressionMap, spritesApply.layers),
            feelingMap: keepUserBindings(stored.feelingMap, spritesApply.feelingMap, spritesApply.layers),
          }
        : spritesApply,
    );
  };

  /** The setup with the chosen face among its faces. */
  const withFace = (data: PngtuberAvatarData, target: string): PngtuberAvatarData =>
    target && !Object.hasOwn(data.layers, target) && faces[target]
      ? { ...data, layers: { ...data.layers, [target]: faces[target]! } }
      : data;

  const chooseFace = (emotion: AvatarEmotion, target: string) => {
    if (!shown) return;
    store({
      ...withFace(shown, target),
      expressionMap: {
        ...shown.expressionMap,
        [emotion]: { target: target || null, source: "user", confidence: 1 },
      },
    });
  };

  const chooseFeelingFace = (feeling: AvatarExtraFeeling, target: string) => {
    if (!shown) return;
    store({
      ...withFace(shown, target),
      feelingMap: {
        ...shown.feelingMap,
        [feeling]: { target: target || null, source: "user", confidence: 1 },
      },
    });
  };

  const commitMotion = () => {
    if (!shown || !motionDraft) return;
    store({ ...shown, motion: motionDraft });
    setMotionDraft(null);
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setWarnings([]);
    importFile.mutate(
      { kind: "pngtuber", file },
      {
        onSuccess: (result) => {
          setWarnings(result.warnings);
          toast.success(t("avatars.pngtuber.imported"));
        },
        onError: (error) => toast.error(t("avatars.pngtuber.importFailed", { reason: errorMessage(error) })),
      },
    );
  };

  const onRemove = async () => {
    const confirmed = await showConfirmDialog({
      title: t("avatars.pngtuber.removeTitle"),
      message: t("avatars.pngtuber.removeConfirm"),
      confirmLabel: t("avatars.pngtuber.remove"),
      tone: "destructive",
    });
    if (!confirmed) return;
    remove.mutate("pngtuber", {
      onError: (error) => toast.error(t("avatars.pngtuber.saveFailed", { reason: errorMessage(error) })),
    });
  };

  const faceKeys = Object.keys(faces);

  return (
    <SettingsSection
      title={t("avatars.pngtuber.title")}
      description={t("avatars.pngtuber.description")}
      contentClassName="space-y-3"
    >
      <p className="text-[0.6875rem] text-[var(--marinara-chat-chrome-panel-muted)]" data-avatar-pngtuber-status>
        {stored
          ? t(SOURCE_KEYS[stored.source])
          : fromSprites
            ? t("avatars.pngtuber.usingSprites")
            : sprites.isLoading
              ? t("avatars.pngtuber.loadingSprites")
              : t("avatars.pngtuber.noSprites")}
      </p>

      {shown && (
        <div>
          <div className="mb-1.5 text-[0.6875rem] font-semibold">{t("avatars.pngtuber.faces")}</div>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label={t("avatars.pngtuber.faces")}>
            {faceKeys.map((key) => {
              const set = faces[key]!;
              const url = resolveAvatarImage(owner, config ?? { updatedAt: "" }, spriteList, set.base);
              return (
                <li
                  key={key}
                  className="overflow-hidden rounded-lg bg-[var(--secondary)]/60 ring-1 ring-[var(--border)]"
                  data-avatar-face={key}
                >
                  {url ? (
                    <img src={url} alt={key} loading="lazy" className="h-20 w-full object-contain" />
                  ) : (
                    <div className="flex h-20 items-center justify-center text-[0.625rem] text-[var(--muted-foreground)]">
                      {t("avatars.pngtuber.pictureMissing")}
                    </div>
                  )}
                  <div className="space-y-0.5 px-1.5 py-1">
                    <div className="truncate text-[0.625rem] font-medium" title={key}>
                      {key}
                    </div>
                    <div className="flex flex-wrap gap-1 text-[0.5625rem] text-[var(--muted-foreground)]">
                      {set.mouthOpen && <span>{t("avatars.pngtuber.talkVariant")}</span>}
                      {set.eyesClosed && <span>{t("avatars.pngtuber.blinkVariant")}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {shown.source === "sprites" && (
            <p className="mt-1.5 text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]">
              {t("avatars.pngtuber.variantHint")}
            </p>
          )}
        </div>
      )}

      {shown && faceKeys.length > 1 && (
        <fieldset className="space-y-1.5" disabled={busy}>
          <legend className="mb-1 text-[0.6875rem] font-semibold">{t("avatars.pngtuber.feelings")}</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {AVATAR_EMOTIONS.map((emotion) => (
              <label key={emotion} className="flex flex-col gap-1 text-[0.6875rem]">
                <span>{t(AVATAR_EMOTION_LABEL_KEYS[emotion])}</span>
                <select
                  value={shown.expressionMap[emotion]?.target ?? ""}
                  onChange={(event) => chooseFace(emotion, event.target.value)}
                  className={AVATAR_SETUP_SELECT_CLASS}
                  data-avatar-feeling={emotion}
                >
                  <option value="">{t("avatars.pngtuber.restingFace")}</option>
                  {faceKeys.map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <details className="group pt-1" data-avatar-more-feelings>
            <summary className="flex cursor-pointer list-none items-center gap-1 text-[0.6875rem] font-semibold marker:hidden">
              <ChevronRight
                size="0.75rem"
                className="shrink-0 text-[var(--muted-foreground)] transition-transform group-open:rotate-90"
                aria-hidden="true"
              />
              {t("avatars.pngtuber.moreFeelings")}
            </summary>
            <p className="mt-1 text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]">
              {t("avatars.pngtuber.moreFeelingsHelp")}
            </p>
            {AVATAR_FACE_GROUPS.map(([emotion, ...feelings]) => (
              <div key={emotion} className="mt-2">
                <div className="mb-1 text-[0.625rem] font-semibold text-[var(--muted-foreground)]">
                  {t(AVATAR_EMOTION_LABEL_KEYS[emotion])}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {feelings.map((feeling) => (
                    <label key={feeling} className="flex flex-col gap-1 text-[0.6875rem]">
                      <span>{t(AVATAR_FEELING_LABEL_KEYS[feeling])}</span>
                      <select
                        value={shown.feelingMap?.[feeling]?.target ?? ""}
                        onChange={(event) => chooseFeelingFace(feeling, event.target.value)}
                        className={AVATAR_SETUP_SELECT_CLASS}
                        data-avatar-feeling={feeling}
                      >
                        <option value="">
                          {t("avatars.pngtuber.usesFeelingFace", { feeling: t(AVATAR_EMOTION_LABEL_KEYS[emotion]) })}
                        </option>
                        {faceKeys.map((key) => (
                          <option key={key} value={key}>
                            {key}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </details>
        </fieldset>
      )}

      {shown && (
        <fieldset className="space-y-1" disabled={busy}>
          <legend className="mb-1 text-[0.6875rem] font-semibold">{t("avatars.pngtuber.movement")}</legend>
          <ToggleSetting
            label={t("avatars.pngtuber.bounceOnTalk")}
            checked={motion.bounceOnTalk}
            onChange={(bounceOnTalk) => store({ ...shown, motion: { ...motion, bounceOnTalk } })}
          />
          <label className="flex flex-col gap-1 p-1.5 text-xs">
            <span className="flex justify-between gap-2">
              <span>{t("avatars.pngtuber.bounceHeight")}</span>
              <span className="tabular-nums text-[var(--muted-foreground)]">
                {Math.round(motion.bounceHeight * 100)}%
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={0.25}
              step={0.01}
              value={motion.bounceHeight}
              disabled={!motion.bounceOnTalk}
              onChange={(event) => setMotionDraft({ ...motion, bounceHeight: Number(event.target.value) })}
              onPointerUp={commitMotion}
              onKeyUp={commitMotion}
              onBlur={commitMotion}
              className="w-full accent-[var(--primary)]"
            />
          </label>
          <label className="flex flex-col gap-1 p-1.5 text-xs">
            <span className="flex justify-between gap-2">
              <span>{t("avatars.pngtuber.blinkInterval")}</span>
              <span className="tabular-nums text-[var(--muted-foreground)]">
                {t("avatars.pngtuber.seconds", { count: motion.blinkIntervalSeconds })}
              </span>
            </span>
            <input
              type="range"
              min={1}
              max={20}
              step={0.5}
              value={motion.blinkIntervalSeconds}
              onChange={(event) => setMotionDraft({ ...motion, blinkIntervalSeconds: Number(event.target.value) })}
              onPointerUp={commitMotion}
              onKeyUp={commitMotion}
              onBlur={commitMotion}
              className="w-full accent-[var(--primary)]"
            />
          </label>
        </fieldset>
      )}

      <div className="flex flex-wrap gap-1.5">
        {spritesApply && (
          <button
            type="button"
            className={SETTINGS_COMPACT_PRIMARY_BUTTON_CLASS}
            disabled={busy}
            onClick={applySprites}
            title={t("avatars.pngtuber.useSpritesHelp")}
          >
            <Wand2 size="0.75rem" aria-hidden="true" />
            {stored ? t("avatars.pngtuber.updateFromSprites") : t("avatars.pngtuber.useSprites")}
          </button>
        )}
        <button
          type="button"
          className={SETTINGS_BUTTON_CLASS}
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          {importFile.isPending ? (
            <Loader2 size="0.75rem" className="animate-spin" aria-hidden="true" />
          ) : (
            <Upload size="0.75rem" aria-hidden="true" />
          )}
          {importFile.isPending ? t("avatars.pngtuber.importing") : t("avatars.pngtuber.importSave")}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".save"
          className="hidden"
          onChange={onFile}
          data-avatar-import="pngtuber"
          aria-label={t("avatars.pngtuber.importSave")}
        />
        {stored && (
          <button
            type="button"
            className={`${SETTINGS_BUTTON_CLASS} mari-chrome-control--danger`}
            disabled={busy}
            onClick={() => void onRemove()}
          >
            <Trash2 size="0.75rem" aria-hidden="true" />
            {t("avatars.pngtuber.remove")}
          </button>
        )}
      </div>

      {warnings.length > 0 && (
        <div
          role="status"
          className="rounded-lg bg-[var(--secondary)]/60 p-2 text-[0.6875rem] ring-1 ring-[var(--border)]"
        >
          <div className="mb-1 font-semibold">{t("avatars.pngtuber.importNotes")}</div>
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
