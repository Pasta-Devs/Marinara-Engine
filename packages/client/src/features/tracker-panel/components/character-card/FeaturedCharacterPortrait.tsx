import { useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Eye, Loader2, Shirt, Undo2 } from "lucide-react";
import type { PresentCharacter } from "@marinara-engine/shared";
import { useCharacterSprites, type SpriteInfo } from "../../../../hooks/use-characters";
import {
  TRACKER_PORTRAIT_DEFAULT_FOCUS_X,
  TRACKER_PORTRAIT_DEFAULT_FOCUS_Y,
  TRACKER_PORTRAIT_DEFAULT_ZOOM,
  TRACKER_PORTRAIT_EXPRESSION_DEFAULT_FOCUS_Y,
  TRACKER_PORTRAIT_EXPRESSION_FOCUS_Y_MAX,
  TRACKER_PORTRAIT_MAX_ZOOM,
  TRACKER_PORTRAIT_MIN_ZOOM,
} from "../../lib/tracker-panel.constants";
import { getCharacterPortraitFallback } from "../../lib/character-tracker-data";
import { clampNumber, visibleText } from "../../lib/tracker-display";
import type { TrackerProfileSide } from "../../lib/tracker-profile-layout";
import { getCharacterExpressionHint, isSpriteLookupCharacterId, resolveSpriteUrl } from "../../lib/sprite-expressions";
import {
  TrackerPortraitStage,
  type TrackerPortraitStageAction,
  type TrackerPortraitStageMediaKind,
} from "../controls/TrackerPortraitStage";

export function FeaturedCharacterPortrait({
  character,
  spriteCharacterId,
  spriteExpression,
  expressionSpritesEnabled,
  characterPicture,
  outsideSide,
  onUploadAvatar,
  onGeneratePortrait,
  onRevertScenePortrait,
  onPortraitFocusChange,
}: {
  character: PresentCharacter;
  spriteCharacterId?: string | null;
  spriteExpression?: string;
  expressionSpritesEnabled: boolean;
  characterPicture?: string | null;
  outsideSide: TrackerProfileSide;
  onUploadAvatar?: () => void;
  /** Set when the Character Tracker has an image connection. */
  onGeneratePortrait?: (includeOutfit: boolean) => Promise<void>;
  onRevertScenePortrait?: () => void;
  onPortraitFocusChange: (focusX: number, focusY: number, zoom: number) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [generating, setGenerating] = useState<"look" | "outfit" | null>(null);
  const resolvedSpriteCharacterId =
    expressionSpritesEnabled && isSpriteLookupCharacterId(spriteCharacterId) ? (spriteCharacterId ?? null) : null;
  const expression = expressionSpritesEnabled ? getCharacterExpressionHint(character, spriteExpression) : null;
  const { data: sprites } = useCharacterSprites(resolvedSpriteCharacterId);
  const spriteUrl = expression ? resolveSpriteUrl(sprites as SpriteInfo[] | undefined, expression) : null;
  const scenePortrait =
    typeof character.scenePortraitPath === "string" && character.scenePortraitPath.trim()
      ? character.scenePortraitPath.trim()
      : null;
  const media = spriteUrl ?? scenePortrait ?? characterPicture ?? character.avatarPath ?? null;
  const mediaKind: TrackerPortraitStageMediaKind | null = spriteUrl ? "expression" : media ? "art" : null;
  const canEditPortrait = !spriteUrl;
  const canRevertScenePortrait = canEditPortrait && Boolean(scenePortrait) && Boolean(onRevertScenePortrait);
  const defaultPortraitFocusY =
    mediaKind === "expression" ? TRACKER_PORTRAIT_EXPRESSION_DEFAULT_FOCUS_Y : TRACKER_PORTRAIT_DEFAULT_FOCUS_Y;
  const portraitFocusYMax = mediaKind === "expression" ? TRACKER_PORTRAIT_EXPRESSION_FOCUS_Y_MAX : 100;
  const portraitFocusX = clampNumber(
    typeof character.portraitFocusX === "number" ? character.portraitFocusX : TRACKER_PORTRAIT_DEFAULT_FOCUS_X,
    0,
    100,
  );
  const portraitFocusY = clampNumber(
    typeof character.portraitFocusY === "number" ? character.portraitFocusY : defaultPortraitFocusY,
    0,
    portraitFocusYMax,
  );
  const portraitZoom = clampNumber(
    typeof character.portraitZoom === "number" ? character.portraitZoom : TRACKER_PORTRAIT_DEFAULT_ZOOM,
    TRACKER_PORTRAIT_MIN_ZOOM,
    TRACKER_PORTRAIT_MAX_ZOOM,
  );
  const setPortraitFocus = (nextFocusX: number, nextFocusY: number, nextZoom: number) =>
    onPortraitFocusChange(
      clampNumber(Math.round(nextFocusX), 0, 100),
      clampNumber(Math.round(nextFocusY), 0, portraitFocusYMax),
      Math.round(clampNumber(nextZoom, TRACKER_PORTRAIT_MIN_ZOOM, TRACKER_PORTRAIT_MAX_ZOOM) * 100) / 100,
    );
  const characterName = visibleText(character.name, "character");
  const generatePortrait = (mode: "look" | "outfit") => {
    if (!onGeneratePortrait || generating) return;
    setGenerating(mode);
    void onGeneratePortrait(mode === "outfit").finally(() => setGenerating(null));
  };
  const portraitActions: TrackerPortraitStageAction[] = [];
  if (canEditPortrait && onGeneratePortrait) {
    const modes =
      typeof character.outfit === "string" && character.outfit.trim()
        ? (["look", "outfit"] as const)
        : (["look"] as const);
    for (const mode of modes) {
      const Icon = generating === mode ? Loader2 : mode === "look" ? Eye : Shirt;
      portraitActions.push({
        key: mode,
        icon: <Icon size="0.75rem" className={generating === mode ? "animate-spin" : undefined} />,
        onClick: () => generatePortrait(mode),
        title: localizeUi(
          mode === "look"
            ? "ui.trackerPanel.featuredcharacterportrait.newPortraitFromLook"
            : "ui.trackerPanel.featuredcharacterportrait.newPortraitFromLookAndOutfit",
        ),
        disabled: !!generating,
      });
    }
  }
  if (canRevertScenePortrait && onRevertScenePortrait) {
    portraitActions.push({
      key: "revert",
      icon: <Undo2 size="0.75rem" />,
      onClick: onRevertScenePortrait,
      title: localizeUi("ui.trackerPanel.featuredcharacterportrait.revertToCardPortrait"),
      disabled: !!generating,
    });
  }

  return (
    <TrackerPortraitStage
      accessibleLabel={media ? `${characterName} portrait` : `${characterName} portrait placeholder`}
      media={media}
      mediaKind={mediaKind}
      outsideSide={outsideSide}
      frameTone="featured"
      placeholder={getCharacterPortraitFallback(character)}
      placeholderVariant="avatar"
      uploadAction={
        canEditPortrait && onUploadAvatar
          ? {
              ariaLabel: media ? `Change ${characterName} tracker art` : `Upload ${characterName} tracker art`,
              onClick: onUploadAvatar,
              title: media ? "Change tracker art" : "Upload tracker art",
            }
          : undefined
      }
      actions={portraitActions.length > 0 ? portraitActions : undefined}
      view={{
        defaultY: defaultPortraitFocusY,
        onChange: setPortraitFocus,
        x: portraitFocusX,
        y: portraitFocusY,
        zoom: portraitZoom,
      }}
    />
  );
}
