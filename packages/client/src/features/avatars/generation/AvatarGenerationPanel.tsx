// ──────────────────────────────────────────────
// One-click generation on the 2D Avatars agent page (lane: generation)
// ──────────────────────────────────────────────
// PNGTuber blink/talk pictures and a mesh avatar from the owner's sprites, through /api/avatar-generation.
// The base lane's setup mounts this through AVATAR_GENERATION_PANEL for the chosen character or persona.
// Results stay in the browser until the user keeps them, so the owner's avatar does not change before that.
// Faces without a background come from sprite generation (SpriteGenerationModal, as in the character and
// persona editors): it draws them from the avatar on a plain colour, removes it and saves them as sprites. A saved
// talking head then shows each new face for its feeling.
import { Suspense, lazy, useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  AVATAR_EMOTIONS,
  AVATAR_EXTRA_FEELINGS,
  AVATAR_FACE_GROUPS,
  isChatProvider,
  readImageAppearanceOverride,
  type AvatarConfig,
  type Persona,
} from "@marinara-engine/shared";
import { useAvatarModelActions } from "../../../hooks/use-avatar-models";
import { useConnections } from "../../../hooks/use-connections";
import {
  spriteKeys,
  useCharacter,
  useCharacterSprites,
  usePersona,
  useSpriteCapabilities,
} from "../../../hooks/use-characters";
import { useUIStore } from "../../../stores/ui.store";
import {
  ImagePromptReviewModal,
  type ImagePromptOverride,
  type ImagePromptReviewItem,
} from "../../../components/ui/ImagePromptReviewModal";
import { avatarModelKeys, type AvatarKindSetupPanelProps } from "../contract";
import { errorMessage } from "../renderers/pngtuber/PngtuberSetupPanel";
import { withGeneratedFaces, type SavedTalkingHeadFace } from "../renderers/pngtuber/pngtuber-layers";
import { MeshAvatarSection, type ConnectionOption } from "./MeshAvatarSection";
import { PngtuberVariantsSection } from "./PngtuberVariantsSection";
import { avatarSourceSprites } from "./SpritePicker";

type ConnectionRow = ConnectionOption & { defaultForAgents?: boolean | string };

const SpriteGenerationModal = lazy(() =>
  import("../../../components/ui/SpriteGenerationModal").then((m) => ({ default: m.SpriteGenerationModal })),
);

/** The six main faces first, so a run cut short already has every face the others fall back to. */
const TALKING_HEAD_FACES = [...AVATAR_EMOTIONS, ...AVATAR_EXTRA_FEELINGS];

function cardRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return cardRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** The avatar and look the character and persona editors give the sprite generator (the image appearance
 *  when it is on), from the owner's loaded card: the row from `/characters/:id` or the persona. Null until
 *  it has loaded. */
function spriteGeneratorSeed(
  character: unknown,
  persona: Persona | undefined,
): { avatarUrl: string | null; appearance: string } | null {
  if (persona) {
    const { imageAppearanceEnabled, imageAppearance } = persona;
    const look = persona.appearance || persona.description;
    return {
      avatarUrl: persona.avatarPath,
      appearance: readImageAppearanceOverride({ imageAppearanceEnabled, imageAppearance }, look) ?? "",
    };
  }
  if (!character) return null;
  const row = cardRecord(character);
  const data = cardRecord(row.data);
  const extensions = cardRecord(data.extensions);
  const look = typeof extensions.appearance === "string" ? extensions.appearance : data.description;
  return {
    avatarUrl: typeof row.avatarPath === "string" && row.avatarPath ? row.avatarPath : null,
    appearance: readImageAppearanceOverride(extensions, typeof look === "string" ? look : null) ?? "",
  };
}

export function AvatarGenerationPanel({ owner, config, onChanged }: AvatarKindSetupPanelProps) {
  const { t } = useTranslation();
  const { data: spriteList, isLoading } = useCharacterSprites(owner.ownerId);
  const { data: capabilities } = useSpriteCapabilities();
  const { data: connectionList } = useConnections();
  const queryClient = useQueryClient();
  const { save } = useAvatarModelActions(owner, onChanged);
  const character = useCharacter(owner.ownerType === "character" ? owner.ownerId : null);
  const persona = usePersona(owner.ownerType === "persona" ? owner.ownerId : null);
  const [facesOpen, setFacesOpen] = useState(false);
  const [chosenImageConnectionId, setChosenImageConnectionId] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<ImagePromptReviewItem[]>([]);
  const reviewResolveRef = useRef<((overrides: ImagePromptOverride[] | null) => void) | null>(null);

  // Talk and blink pictures belong to another face, so they are never offered as a source.
  const sprites = useMemo(() => avatarSourceSprites(spriteList), [spriteList]);
  const portraitSprites = useMemo(
    () => (spriteList ?? []).filter((sprite) => !sprite.expression.toLowerCase().startsWith("full_")),
    [spriteList],
  );
  const seed = useMemo(() => spriteGeneratorSeed(character.data, persona.data), [character.data, persona.data]);
  const { imageConnections, languageConnections } = useMemo(() => {
    const rows = (connectionList ?? []) as ConnectionRow[];
    return {
      imageConnections: rows.filter((row) => row.provider === "image_generation"),
      languageConnections: rows.filter((row) => isChatProvider(row.provider)),
    };
  }, [connectionList]);
  const defaultImageConnection = imageConnections.find(
    (row) => row.defaultForAgents === true || row.defaultForAgents === "true",
  );
  const imageConnectionId =
    (imageConnections.some((row) => row.id === chosenImageConnectionId) ? chosenImageConnectionId : null) ??
    defaultImageConnection?.id ??
    imageConnections[0]?.id ??
    null;

  const reviewPrompts = useCallback(
    (items: ImagePromptReviewItem[]) =>
      new Promise<ImagePromptOverride[] | null>((resolve) => {
        if (!items.length) return resolve([]);
        reviewResolveRef.current = resolve;
        setReviewItems(items);
      }),
    [],
  );
  const closeReview = useCallback((overrides: ImagePromptOverride[] | null) => {
    reviewResolveRef.current?.(overrides);
    reviewResolveRef.current = null;
    setReviewItems([]);
  }, []);

  const facesSaved = (saved: readonly SavedTalkingHeadFace[]) => {
    void queryClient.invalidateQueries({ queryKey: spriteKeys.list(owner.ownerId) });
    // Without a saved talking head the sprites are the faces, and a face named after a feeling is already its face.
    // The latest saved setup, in case it changed while the faces were being saved.
    const latest = queryClient.getQueryData<AvatarConfig | null>(avatarModelKeys.detail(owner));
    const stored = (latest === undefined ? config : latest)?.kinds.pngtuber;
    const next = stored && withGeneratedFaces(stored, saved);
    if (!next || next === stored) return;
    save.mutate(
      { kinds: { pngtuber: next } },
      { onError: (error) => toast.error(t("avatars.pngtuber.saveFailed", { reason: errorMessage(error) })) },
    );
  };

  const unavailable = capabilities?.imageProcessingAvailable === false;

  return (
    <section
      aria-labelledby="avatar-generation-title"
      className="space-y-4 rounded-2xl bg-[var(--card)] p-3 ring-1 ring-[var(--border)] md:p-4"
    >
      <div>
        <h3 id="avatar-generation-title" className="text-sm font-semibold text-[var(--foreground)]">
          {t("avatars.generation.title")}
        </h3>
        <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("avatars.generation.description")}</p>
      </div>

      {unavailable ? null : (
        <div className="space-y-1.5">
          <button
            type="button"
            // Opened once the card is loaded, so its avatar is the reference from the start.
            disabled={!seed?.avatarUrl}
            onClick={() => setFacesOpen(true)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary)]/85 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Wand2 size="0.875rem" aria-hidden />
            {t("avatars.generation.facesFromAvatar")}
          </button>
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {t(
              seed && !seed.avatarUrl ? "avatars.generation.facesNeedAvatar" : "avatars.generation.facesFromAvatarHelp",
            )}
          </p>
        </div>
      )}

      {unavailable ? (
        <p className="text-xs text-[var(--muted-foreground)]">{t("avatars.generation.unavailable")}</p>
      ) : isLoading ? null : sprites.length === 0 ? (
        <p className="text-xs text-[var(--muted-foreground)]">{t("avatars.generation.noSprites")}</p>
      ) : (
        <>
          {imageConnections.length > 0 ? (
            <label className="flex flex-col gap-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)] md:max-w-sm">
              {t("avatars.generation.imageConnection")}
              <select
                value={imageConnectionId ?? ""}
                onChange={(event) => setChosenImageConnectionId(event.target.value)}
                className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              >
                {imageConnections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.id === defaultImageConnection?.id
                      ? t("avatars.generation.imageConnectionDefault", { name: connection.name })
                      : connection.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("avatars.generation.noImageConnection")}{" "}
              <button
                type="button"
                className="text-[var(--primary)] underline"
                onClick={() => useUIStore.getState().openRightPanel("connections")}
              >
                {t("avatars.generation.openConnections")}
              </button>
            </p>
          )}
          <PngtuberVariantsSection
            owner={owner}
            config={config}
            spriteList={spriteList ?? []}
            imageConnectionId={imageConnectionId}
            reviewPrompts={reviewPrompts}
            onChanged={onChanged}
          />
          <div className="border-t border-[var(--border)]" />
          <MeshAvatarSection
            owner={owner}
            sprites={sprites}
            languageConnections={languageConnections}
            onChanged={onChanged}
          />
        </>
      )}

      <ImagePromptReviewModal
        open={reviewItems.length > 0}
        items={reviewItems}
        onCancel={() => closeReview(null)}
        onConfirm={(overrides) => closeReview(overrides)}
      />
      <Suspense fallback={null}>
        {facesOpen && seed?.avatarUrl ? (
          <SpriteGenerationModal
            open
            onClose={() => setFacesOpen(false)}
            entityId={owner.ownerId}
            initialSpriteType="expressions"
            existingExpressionSprites={portraitSprites}
            defaultAppearance={seed.appearance}
            defaultAvatarUrl={seed.avatarUrl}
            // The six main faces, chosen at first, and the 23 extra feelings that fall back to them, each with open
            // eyes and a closed mouth for its blink and talk pictures to change.
            expressionChoices={TALKING_HEAD_FACES}
            expressionGroups={AVATAR_FACE_GROUPS}
            talkingHeadFaces
            onSpritesGenerated={facesSaved}
          />
        ) : null}
      </Suspense>
    </section>
  );
}
