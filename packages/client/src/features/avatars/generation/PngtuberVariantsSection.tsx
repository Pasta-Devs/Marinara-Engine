// Blink and talk pictures for the talking head (PNGTuber avatar): one row per face it shows for the six
// feelings and for extra feelings with a face of their own, with that face's own blink and talk pictures, made
// or provided (lane: generation).
import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import {
  AVATAR_PNGTUBER_VARIANTS,
  normalizeSpriteExpressionKey,
  type AvatarConfig,
  type AvatarImageRef,
  type AvatarOwnerRef,
  type AvatarPngtuberVariant,
} from "@marinara-engine/shared";
import type { SpriteInfo } from "../../../hooks/use-characters";
import { cn } from "../../../lib/utils";
import { useUIStore } from "../../../stores/ui.store";
import type { ImagePromptOverride, ImagePromptReviewItem } from "../../../components/ui/ImagePromptReviewModal";
import { AVATAR_EMOTION_LABEL_KEYS } from "../renderers/pngtuber/PngtuberSetupPanel";
import {
  AVATAR_FEELING_LABEL_KEYS,
  buildPngtuberLayersFromSprites,
  pngtuberSpriteFamily,
  talkingHeadFaces,
} from "../renderers/pngtuber/pngtuber-layers";
import { resolveAvatarImage } from "../stage/avatar-stage-logic";
import { avatarSourceSprites } from "./SpritePicker";
import {
  previewVariantPrompts,
  useOneAtATime,
  usePngtuberVariantJob,
  useSavePngtuberVariants,
  variantJobId,
  type VariantJobItem,
  type VariantPair,
} from "./use-avatar-generation";

const VARIANT_KEYS: Record<AvatarPngtuberVariant, string> = {
  "eyes-closed": "avatars.generation.eyesClosed",
  "mouth-open": "avatars.generation.mouthOpen",
};
const VARIANT_LAYERS = { "eyes-closed": "eyesClosed", "mouth-open": "mouthOpen" } as const;
const SLOT_BUTTON_CLASS =
  "inline-flex min-h-8 min-w-8 items-center justify-center gap-1 rounded-lg px-2 text-[0.625rem] font-medium transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-50";

/** One picture of a face: its name above, the picture, and the slot's buttons below. */
function PictureSlot({
  title,
  name,
  busy = false,
  kept = false,
  picture,
  children,
}: {
  title: string;
  /** Accessible name of the slot. */
  name: string;
  busy?: boolean;
  kept?: boolean;
  picture: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div role="group" aria-label={name} aria-busy={busy} className="flex min-w-0 flex-col gap-1">
      <span className="truncate text-[0.625rem] font-medium text-[var(--muted-foreground)]">{title}</span>
      <div
        className={cn(
          "relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-[var(--background)]",
          kept ? "ring-2 ring-[var(--primary)]" : "ring-1 ring-[var(--border)]",
        )}
      >
        {picture}
        {busy && <Loader2 size="1.25rem" className="absolute animate-spin text-[var(--foreground)]" aria-hidden />}
      </div>
      {children}
    </div>
  );
}

export function PngtuberVariantsSection({
  owner,
  config,
  spriteList,
  imageConnectionId,
  reviewPrompts,
  onChanged,
}: {
  owner: AvatarOwnerRef;
  config: AvatarConfig | null;
  /** Every sprite of the owner, talk and blink pictures included. */
  spriteList: readonly SpriteInfo[];
  /** Null when there is no image connection to use. */
  imageConnectionId: string | null;
  reviewPrompts: (items: ImagePromptReviewItem[]) => Promise<ImagePromptOverride[] | null>;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const preparing = useOneAtATime();
  const saving = useOneAtATime();
  const job = usePngtuberVariantJob(owner);
  const save = useSavePngtuberVariants(owner);
  const faces = useMemo(() => {
    const fromSprites = buildPngtuberLayersFromSprites(spriteList);
    // The sprite a face's pictures are drawn from: the server takes only these labels.
    const sources = new Set(avatarSourceSprites(spriteList));
    const family = pngtuberSpriteFamily(spriteList).filter((sprite) => sources.has(sprite));
    const labelFor = (key: string) =>
      family.find((sprite) => normalizeSpriteExpressionKey(sprite.expression) === key)?.expression ?? null;
    // What the avatar shows now: the saved setup, or the sprites until one is saved (as in the setup panel).
    return talkingHeadFaces(config?.kinds.pngtuber ?? fromSprites, fromSprites, labelFor);
  }, [config, spriteList]);
  const itemsById = useMemo(() => new Map(job.items.map((item) => [item.id, item])), [job.items]);
  const busy = job.running || preparing.pending;
  // Only pictures of the faces listed count: a face can drop out of the list (a new sprite takes its
  // feeling), and its unseen pictures must not be kept or saved.
  const shownIds = useMemo(
    () =>
      new Set(
        faces.flatMap(({ label }) =>
          label ? AVATAR_PNGTUBER_VARIANTS.map((variant) => variantJobId(label, variant)) : [],
        ),
      ),
    [faces],
  );
  const drafts = useMemo(() => job.items.filter((item) => item.draft && shownIds.has(item.id)), [job.items, shownIds]);
  const kept = useMemo(() => drafts.filter((item) => item.kept), [drafts]);
  const savedPicture = (ref: AvatarImageRef | undefined) =>
    ref ? resolveAvatarImage(owner, config ?? { updatedAt: "" }, spriteList, ref) : null;
  // Slots with no picture yet, saved, provided or made: what "Make" fills.
  const empty = faces.flatMap(({ label, set }): VariantPair[] =>
    label
      ? AVATAR_PNGTUBER_VARIANTS.filter(
          (variant) =>
            !savedPicture(set[VARIANT_LAYERS[variant]]) && !itemsById.get(variantJobId(label, variant))?.draft,
        ).map((variant) => ({ label, variant }))
      : [],
  );

  /** The run's connection and, with the image prompt review on, the prompts the user confirmed. Null
   *  when the review was cancelled. */
  const runOptions = async (pairs: readonly VariantPair[]) => {
    if (!useUIStore.getState().reviewImagePromptsBeforeSend) return { connectionId: imageConnectionId };
    const byLabel = new Map<string, AvatarPngtuberVariant[]>();
    for (const { label, variant } of pairs) byLabel.set(label, [...(byLabel.get(label) ?? []), variant]);
    const previews = await Promise.all(
      [...byLabel].map(([label, variants]) => previewVariantPrompts(owner, [label], variants, imageConnectionId)),
    );
    const overrides = await reviewPrompts(previews.flatMap((preview) => preview.items));
    return overrides ? { connectionId: imageConnectionId, promptOverrides: overrides } : null;
  };

  const make = (pairs: readonly VariantPair[]) =>
    preparing.run(async () => {
      if (job.running || !pairs.length || !imageConnectionId) return;
      const options = await runOptions(pairs);
      if (options) job.start(pairs, options);
    });

  const retry = (item: VariantJobItem) =>
    preparing.run(async () => {
      if (job.running || !imageConnectionId) return;
      const options = await runOptions([item]);
      if (options) job.retry(item.id, options);
    });

  const saveKept = () =>
    saving.run(async () => {
      if (!kept.length) return;
      try {
        await save.mutateAsync(
          kept.map((item) => ({
            label: item.label,
            variant: item.variant,
            image: item.draft!.image,
            sourceHash: item.draft!.sourceHash,
            ...(item.draft!.face ? { face: item.draft!.face } : {}),
          })),
        );
        toast.success(t("avatars.generation.pngtuberSaved", { count: kept.length }));
        job.removeSaved(kept.map((item) => item.id));
        onChanged();
      } catch (error) {
        toast.error(
          t("avatars.generation.saveFailed", { error: error instanceof Error ? error.message : String(error) }),
        );
      }
    });

  return (
    <section className="space-y-3" aria-labelledby="avatar-generation-pngtuber">
      <div>
        <h4 id="avatar-generation-pngtuber" className="text-[0.8125rem] font-semibold text-[var(--foreground)]">
          {t("avatars.generation.pngtuberTitle")}
        </h4>
        <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("avatars.generation.pngtuberDescription")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void make(empty)}
          disabled={busy || !empty.length || !imageConnectionId}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary)]/85 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size="0.875rem" className="animate-spin" aria-hidden />
          ) : (
            <Sparkles size="0.875rem" aria-hidden />
          )}
          {t("avatars.generation.makePictures", { count: empty.length })}
        </button>
        {job.running && (
          <>
            {job.progress && (
              <span role="status" className="text-[0.6875rem] text-[var(--muted-foreground)]">
                {t("avatars.generation.progress", job.progress)}
              </span>
            )}
            <button
              type="button"
              onClick={job.cancel}
              className="inline-flex min-h-9 items-center gap-1 rounded-xl px-3 py-2 text-xs ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] active:scale-95"
            >
              <X size="0.875rem" aria-hidden />
              {t("avatars.generation.cancel")}
            </button>
          </>
        )}
      </div>

      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {faces.map((face) => {
          const faceName = (face.label ?? face.key).replace(/_/gu, " ");
          const base = savedPicture(face.set.base);
          // An image connection that can't edit pictures draws a new face with both of its pictures.
          const newFace = face.label
            ? AVATAR_PNGTUBER_VARIANTS.map((variant) => itemsById.get(variantJobId(face.label!, variant))).find(
                (item) => item?.draft?.face,
              )
            : undefined;
          const faceTitle = t(newFace ? "avatars.generation.newFace" : "avatars.generation.face");
          return (
            <li
              key={face.key}
              className="min-w-0 space-y-2 rounded-xl bg-[var(--secondary)] p-2 ring-1 ring-[var(--border)]"
              data-talking-head-face={face.key}
            >
              <div>
                <p className="text-xs font-medium text-[var(--foreground)]">
                  {[
                    ...face.emotions.map((emotion) => t(AVATAR_EMOTION_LABEL_KEYS[emotion])),
                    ...face.feelings.map((feeling) => t(AVATAR_FEELING_LABEL_KEYS[feeling])),
                  ].join(", ")}
                </p>
                {!face.label && (
                  <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                    {t("avatars.generation.noSourceSprite")}
                  </p>
                )}
                {newFace && (
                  <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                    {t("avatars.generation.newFaceHint")}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <PictureSlot
                  title={faceTitle}
                  name={`${faceName}: ${faceTitle}`}
                  busy={newFace?.status === "running"}
                  kept={newFace?.kept}
                  picture={
                    newFace?.draft?.face ? (
                      <img
                        src={newFace.draft.face}
                        alt={t("avatars.generation.pictureAlt", { name: `${faceName}: ${faceTitle}` })}
                        className={cn(
                          "h-full w-full object-contain transition-opacity",
                          newFace.status === "running" && "opacity-40",
                        )}
                      />
                    ) : base ? (
                      <img src={base} alt={faceName} loading="lazy" className="h-full w-full object-contain" />
                    ) : (
                      <span className="p-1 text-center text-[0.625rem] text-[var(--muted-foreground)]">
                        {t("avatars.pngtuber.pictureMissing")}
                      </span>
                    )
                  }
                />
                {AVATAR_PNGTUBER_VARIANTS.map((variant) => {
                  const name = `${faceName}: ${t(VARIANT_KEYS[variant])}`;
                  const label = face.label;
                  const item = label ? itemsById.get(variantJobId(label, variant)) : undefined;
                  const running = item?.status === "running";
                  const idle = !running && item?.status !== "waiting";
                  const picture = item?.draft?.image ?? savedPicture(face.set[VARIANT_LAYERS[variant]]);
                  const error = item?.status === "failed" ? item.error || t("avatars.generation.failed") : null;
                  const canMake = !!label && !!imageConnectionId && !busy;
                  return (
                    <PictureSlot
                      key={variant}
                      title={t(VARIANT_KEYS[variant])}
                      name={name}
                      busy={running}
                      kept={item?.kept && !!item.draft}
                      picture={
                        picture ? (
                          <img
                            src={picture}
                            alt={item?.draft ? t("avatars.generation.pictureAlt", { name }) : name}
                            className={cn("h-full w-full object-contain transition-opacity", running && "opacity-40")}
                          />
                        ) : item?.status === "waiting" ? (
                          <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                            {t("avatars.generation.waiting")}
                          </span>
                        ) : null
                      }
                    >
                      {error && <p className="break-words text-[0.625rem] text-[var(--foreground)]">{error}</p>}
                      {idle && (
                        <div className="flex flex-wrap gap-1">
                          {item?.draft && (
                            <button
                              type="button"
                              aria-pressed={item.kept}
                              onClick={() => job.setKept(item.id, !item.kept)}
                              className={cn(
                                SLOT_BUTTON_CLASS,
                                "min-w-0 flex-1",
                                item.kept
                                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                                  : "ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
                              )}
                            >
                              <Check size="0.75rem" aria-hidden />
                              {item.kept ? t("avatars.generation.kept") : t("avatars.generation.keep")}
                            </button>
                          )}
                          {/* A kept picture is replaced only after the user lets it go. */}
                          {picture && !item?.kept && (
                            <button
                              type="button"
                              disabled={!canMake}
                              onClick={() => void (item?.draft ? retry(item) : make([{ label: label!, variant }]))}
                              aria-label={t("avatars.generation.retryName", { name })}
                              title={t("avatars.generation.retry")}
                              className={cn(SLOT_BUTTON_CLASS, "ring-1 ring-[var(--border)] hover:bg-[var(--accent)]")}
                            >
                              <RotateCcw size="0.75rem" aria-hidden />
                            </button>
                          )}
                          {!picture && (
                            <button
                              type="button"
                              disabled={!canMake}
                              onClick={() => void make([{ label: label!, variant }])}
                              aria-label={t("avatars.generation.makeName", { name })}
                              className={cn(
                                SLOT_BUTTON_CLASS,
                                "flex-1 ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
                              )}
                            >
                              <Sparkles size="0.75rem" aria-hidden />
                              {t("avatars.generation.make")}
                            </button>
                          )}
                        </div>
                      )}
                    </PictureSlot>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>

      {drafts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => job.keepAll(shownIds)}
            // Like each picture's Keep: a picture being redone can't be kept.
            disabled={busy || !drafts.some((item) => !item.kept)}
            className="inline-flex min-h-9 items-center rounded-xl px-3 py-2 text-xs ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] active:scale-95 disabled:opacity-50"
          >
            {t("avatars.generation.keepAll")}
          </button>
          <button
            type="button"
            onClick={() => void saveKept()}
            disabled={!kept.length || save.isPending || job.running}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary)]/85 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {save.isPending && <Loader2 size="0.875rem" className="animate-spin" aria-hidden />}
            {t("avatars.generation.saveKept", { count: kept.length })}
          </button>
          <span className="text-[0.625rem] text-[var(--muted-foreground)]">{t("avatars.generation.unsavedHint")}</span>
        </div>
      )}
    </section>
  );
}
