// ──────────────────────────────────────────────
// Avatar setup: live preview through the lazy renderer (lane: base)
// ──────────────────────────────────────────────
// Draws one avatar with its own small loop (the chat stage is not mounted on the Agent editor page). "Try a
// face" and "Talk" show how the faces and mouth look (a talking head also offers its extra feelings' faces); the
// owner's switches apply as they do in chats.
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AVATAR_EMOTIONS,
  AVATAR_EXTRA_FEELINGS,
  AVATAR_FEELING_EMOTIONS,
  AVATAR_VISEMES,
  isAvatarExtraFeeling,
  type AvatarConfig,
  type AvatarEmotion,
  type AvatarExtraFeeling,
  type AvatarFrameInput,
  type AvatarImageRef,
  type AvatarKind,
  type AvatarOwnerRef,
} from "@marinara-engine/shared";
import type { SpriteInfo } from "../../../hooks/use-characters";
import { useMatchMedia } from "../../../hooks/use-match-media";
import { useReducedAmbientEffects } from "../../../hooks/use-reduced-ambient-effects";
import {
  AVATAR_PHONE_QUERY,
  applyAvatarFeatures,
  avatarTargetFps,
  resolveAvatarImage,
} from "../stage/avatar-stage-logic";
import { useAvatarEffectsPaused, useOnScreen } from "../stage/use-avatar-pause";
import { useAvatarRenderer } from "../stage/use-avatar-renderer";
import { AVATAR_FEELING_LABEL_KEYS } from "../renderers/pngtuber/pngtuber-layers";
import { DEMO_AVATAR_CONFIG, DEMO_AVATAR_OWNER, resolveDemoAvatarImage } from "./demo-avatar";

export function AvatarSetupPreview({
  owner,
  config,
  kind,
  sprites,
}: {
  owner: AvatarOwnerRef | null;
  config: AvatarConfig | null;
  kind: AvatarKind;
  /** The owner's sprites (PNGTuber layers may reuse them); null while loading. */
  sprites: SpriteInfo[] | null;
}) {
  const { t } = useTranslation();
  const phone = useMatchMedia(AVATAR_PHONE_QUERY);
  const reducedMotion = useReducedAmbientEffects();
  const effectsPaused = useAvatarEffectsPaused();
  const boxRef = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(boxRef, true);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [face, setFace] = useState<AvatarEmotion | AvatarExtraFeeling>("neutral");
  const [talking, setTalking] = useState(false);

  // The owner's avatar of this kind, or the example PNGTuber until one is set up.
  const ownAvatar = Boolean(owner && config?.kinds[kind]);
  const demo = !ownAvatar && kind === "pngtuber";
  const previewOwner = ownAvatar && owner ? owner : DEMO_AVATAR_OWNER;
  const previewConfig = ownAvatar ? config : demo ? DEMO_AVATAR_CONFIG : null;
  const needsSprites = ownAvatar && kind !== "vrm" && kind !== "mmd";
  // A talking head's extra feelings that have a face of their own.
  const pngtuber = kind === "pngtuber" ? previewConfig?.kinds.pngtuber : undefined;
  const feelings = useMemo(
    () =>
      AVATAR_EXTRA_FEELINGS.filter((feeling) => {
        const target = pngtuber?.feelingMap?.[feeling]?.target;
        return !!target && Object.hasOwn(pngtuber.layers, target);
      }),
    [pngtuber],
  );
  // A feeling the avatar can't show (another kind, or its face is gone) falls back to its emotion.
  const faceFeeling = isAvatarExtraFeeling(face) && feelings.includes(face) ? face : null;
  const faceEmotion = isAvatarExtraFeeling(face) ? AVATAR_FEELING_EMOTIONS[face].emotion : face;
  const resolveImage = useMemo(() => {
    if (demo) return resolveDemoAvatarImage;
    if (!previewConfig || (needsSprites && sprites === null)) return null;
    return (ref: AvatarImageRef) => resolveAvatarImage(previewOwner, previewConfig, sprites ?? undefined, ref);
  }, [demo, needsSprites, previewConfig, previewOwner, sprites]);
  const { renderer, status } = useAvatarRenderer({
    canvas,
    owner: previewOwner,
    config: previewConfig,
    kind: previewConfig ? kind : null,
    resolveImage,
    imagesKey: sprites ? sprites.map((sprite) => sprite.url).join("|") : "",
    reducedMotion: reducedMotion || previewConfig?.features.idleMotion === false,
    phone,
  });

  const paused = effectsPaused || !onScreen;
  const features = previewConfig?.features;
  useEffect(() => {
    if (!renderer || !features) return;
    renderer.setPaused(paused);
    if (paused) return;
    let frameRequest = 0;
    let lastDraw = performance.now();
    const interval = 1000 / avatarTargetFps({ talking, phone, underLoad: false });
    const tick = (now: number) => {
      frameRequest = requestAnimationFrame(tick);
      if (now - lastDraw < interval - 1) return;
      const dtMs = Math.min(now - lastDraw, 250);
      lastDraw = now;
      const frame: AvatarFrameInput = talking
        ? {
            emotion: faceEmotion,
            feeling: faceFeeling,
            emotionWeight: 1,
            viseme: AVATAR_VISEMES[Math.floor(now / 160) % AVATAR_VISEMES.length]!,
            mouthOpen: 0.5 + 0.5 * Math.sin(now / 90),
            state: "talking",
          }
        : { emotion: faceEmotion, feeling: faceFeeling, emotionWeight: 1, viseme: null, mouthOpen: 0, state: "idle" };
      renderer.update(applyAvatarFeatures(frame, features, reducedMotion), dtMs);
    };
    frameRequest = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRequest);
  }, [faceEmotion, faceFeeling, features, paused, phone, reducedMotion, renderer, talking]);

  return (
    <div ref={boxRef} className="flex flex-col items-center gap-2">
      <div className="relative flex aspect-[3/4] w-full max-w-[13rem] items-center justify-center overflow-hidden rounded-xl bg-[var(--secondary)]/55 ring-1 ring-[var(--border)]">
        {previewConfig ? (
          <canvas
            ref={setCanvas}
            role="img"
            aria-label={t("avatars.setup.preview.title")}
            className="absolute inset-0 h-full w-full"
          />
        ) : null}
        {!previewConfig || status === "error" ? (
          <p className="px-3 text-center text-[0.6875rem] text-[var(--muted-foreground)]">
            {status === "error" ? t("avatars.setup.preview.unavailable") : t("avatars.setup.preview.empty")}
          </p>
        ) : null}
      </div>
      {demo ? (
        <p className="text-center text-[0.625rem] text-[var(--muted-foreground)]">{t("avatars.setup.preview.demo")}</p>
      ) : null}
      {previewConfig ? (
        <div className="flex w-full max-w-[13rem] items-center gap-2">
          {!demo ? (
            <select
              value={faceFeeling ?? faceEmotion}
              onChange={(event) => setFace(event.target.value as AvatarEmotion | AvatarExtraFeeling)}
              aria-label={t("avatars.setup.preview.face")}
              className="min-w-0 flex-1 rounded-xl bg-[var(--secondary)] px-2 py-1.5 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              {AVATAR_EMOTIONS.map((emotion) => (
                <option key={emotion} value={emotion}>
                  {t(`avatars.setup.slot.${emotion}`)}
                </option>
              ))}
              {feelings.length > 0 ? (
                <optgroup label={t("avatars.pngtuber.moreFeelings")}>
                  {feelings.map((feeling) => (
                    <option key={feeling} value={feeling}>
                      {t(AVATAR_FEELING_LABEL_KEYS[feeling])}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          ) : null}
          <button
            type="button"
            aria-pressed={talking}
            onClick={() => setTalking((value) => !value)}
            className={`mari-editor-action mari-editor-action--compact px-3 ${demo ? "flex-1" : ""} ${talking ? "mari-editor-action--accent" : ""}`}
          >
            {t("avatars.setup.preview.talk")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
