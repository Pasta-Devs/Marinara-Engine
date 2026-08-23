import { Image } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AvatarCrop } from "@marinara-engine/shared";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import {
  AgentSettingsActionButton,
  AgentSettingsSegmentedControl,
  AgentSettingsToggle,
  SpriteRangeSlider,
} from "./AgentSettingsControls";
import {
  SPRITE_DISPLAY_OPACITY_PERCENT_MAX,
  SPRITE_DISPLAY_OPACITY_PERCENT_MIN,
  SPRITE_DISPLAY_SCALE_PERCENT_MAX,
  SPRITE_DISPLAY_SCALE_PERCENT_MIN,
  hasSpriteDisplayMode,
  type SpriteDisplayMode,
} from "./sprite-display-modes";

type SpriteOwnerKind = "character" | "persona";

interface ExpressionSpriteOwner {
  id: string;
  kind: SpriteOwnerKind;
  name: string;
  title: string | null;
  avatarPath: string | null;
  avatarCrop: AvatarCrop | null;
  active: boolean;
}

interface SpriteLayoutSubject {
  id: string;
  name: string;
}

interface ExpressionSpriteSettingsProps {
  chatId: string;
  displayModes: readonly SpriteDisplayMode[];
  onToggleDisplayMode: (mode: SpriteDisplayMode) => void;
  expressionAvatarsEnabled: boolean;
  onToggleExpressionAvatars: () => void;
  ownerCount: number;
  ownersLoading: boolean;
  choicesLoading: boolean;
  owners: ExpressionSpriteOwner[];
  onOpenOwner: (kind: SpriteOwnerKind, id: string) => void;
  onToggleOwner: (id: string) => void;
  enabledOwnerCount: number;
  layoutSubjects: SpriteLayoutSubject[];
  selectedLayoutSubjectId: string | null;
  onSelectLayoutSubject: (id: string | null) => void;
  selectedLayoutSubjectHasOverride: boolean;
  onResetSelectedLayoutSubject: () => void;
  spriteArrangeMode: boolean;
  onToggleSpriteArrange?: () => void;
  hasCustomSpritePlacements: boolean;
  onResetSpritePlacements: () => void;
  spritePosition: "left" | "right";
  onSpritePositionChange: (position: "left" | "right") => void;
  expressionSpriteScalePercent: number;
  fullBodySpriteScalePercent: number;
  expressionSpriteOpacityPercent: number;
  fullBodySpriteOpacityPercent: number;
  onExpressionSpriteScaleChange: (value: number) => void;
  onFullBodySpriteScaleChange: (value: number) => void;
  onExpressionSpriteOpacityChange: (value: number) => void;
  onFullBodySpriteOpacityChange: (value: number) => void;
}

export function ExpressionSpriteSettings({
  chatId,
  displayModes,
  onToggleDisplayMode,
  expressionAvatarsEnabled,
  onToggleExpressionAvatars,
  ownerCount,
  ownersLoading,
  choicesLoading,
  owners,
  onOpenOwner,
  onToggleOwner,
  enabledOwnerCount,
  layoutSubjects,
  selectedLayoutSubjectId,
  onSelectLayoutSubject,
  selectedLayoutSubjectHasOverride,
  onResetSelectedLayoutSubject,
  spriteArrangeMode,
  onToggleSpriteArrange,
  hasCustomSpritePlacements,
  onResetSpritePlacements,
  spritePosition,
  onSpritePositionChange,
  expressionSpriteScalePercent,
  fullBodySpriteScalePercent,
  expressionSpriteOpacityPercent,
  fullBodySpriteOpacityPercent,
  onExpressionSpriteScaleChange,
  onFullBodySpriteScaleChange,
  onExpressionSpriteOpacityChange,
  onFullBodySpriteOpacityChange,
}: ExpressionSpriteSettingsProps) {
  const { t: localizeUi } = useTranslation();

  return (
    <>
      <SpriteDisplayModeToggle modes={displayModes} onToggle={onToggleDisplayMode} />

      <AgentSettingsToggle
        label={localizeUi("ui.chat.expressionsetupfields.expressionAvatars")}
        description={localizeUi("ui.chat.expressionsetupfields.replaceMessageAvatarsWithTheSelectedExpressionSprite")}
        enabled={expressionAvatarsEnabled}
        onToggle={onToggleExpressionAvatars}
      />

      {ownerCount === 0 ? (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.chatsettingsdrawer.addCharactersToThisChatOrChooseAPersona")}
        </p>
      ) : ownersLoading ? (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.chatsettingsdrawer.loadingSpriteOwners")}
        </p>
      ) : owners.length > 0 ? (
        <div className="space-y-1.5">
          {owners.map((owner) => (
            <div
              key={`${owner.kind}:${owner.id}`}
              className="flex items-center gap-2.5 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]"
            >
              <button
                type="button"
                onClick={() => onOpenOwner(owner.kind, owner.id)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition-colors hover:opacity-80"
                title={
                  owner.kind === "persona"
                    ? localizeUi("ui.chat.chatsettingsdrawer.openPersona")
                    : localizeUi("ui.chat.chatsettingsdrawer.openCharacterCard")
                }
              >
                {owner.avatarPath ? (
                  <span className="relative block h-8 w-8 shrink-0 overflow-hidden rounded-full">
                    <img
                      src={owner.avatarPath}
                      alt={owner.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                      style={getAvatarCropStyle(owner.avatarCrop)}
                    />
                  </span>
                ) : (
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-[0.625rem] font-bold",
                      owner.kind === "persona"
                        ? "mari-avatar-placeholder mari-avatar-placeholder--persona"
                        : "mari-avatar-placeholder mari-avatar-placeholder--character",
                    )}
                  >
                    {owner.name[0]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{owner.name}</span>
                  {owner.title && (
                    <span className="block truncate text-[0.625rem] italic text-[var(--muted-foreground)]">
                      {owner.title}
                    </span>
                  )}
                  <span className="block text-[0.625rem] text-[var(--muted-foreground)]">
                    {owner.kind === "persona"
                      ? localizeUi("ui.chat.chatsettingsdrawer.personaSpritesAvailable")
                      : localizeUi("ui.chat.chatsettingsdrawer.uploadedSpritesAvailable")}
                  </span>
                </div>
              </button>

              <SpriteToggleButton active={owner.active} onToggle={() => onToggleOwner(owner.id)} />
            </div>
          ))}
        </div>
      ) : choicesLoading ? (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.expressionsetupfields.checkingAddedCharactersForUploadedSprites")}
        </p>
      ) : (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.chatsettingsdrawer.noneOfTheAddedCharactersHaveUploadedSpritesYet")}
        </p>
      )}

      <p className="text-[0.625rem] text-[var(--muted-foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.onlyAddedCharactersAndTheActivePersonaWithUploaded")}
      </p>

      {enabledOwnerCount > 0 && (
        <div className="rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
          <div className="flex items-center gap-2">
            <Image size="0.75rem" className="text-[var(--muted-foreground)]" />
            <span className="flex-1 text-[0.6875rem] text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.expressionsetupfields.spriteLayout")}
            </span>
            <AgentSettingsActionButton
              onClick={onToggleSpriteArrange}
              disabled={!onToggleSpriteArrange}
              variant={spriteArrangeMode ? "primary" : "default"}
            >
              {spriteArrangeMode
                ? localizeUi("lorebook.editor.batch.done")
                : localizeUi("ui.chat.chatsettingsdrawer.arrange")}
            </AgentSettingsActionButton>
            <AgentSettingsActionButton onClick={onResetSpritePlacements} disabled={!hasCustomSpritePlacements}>
              {localizeUi("ui.characters.charactercliptrimmodal.reset")}
            </AgentSettingsActionButton>
          </div>

          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label
              htmlFor={`sprite-layout-apply-to-${chatId}`}
              className="text-[0.625rem] font-medium text-[var(--muted-foreground)]"
            >
              {localizeUi("ui.chat.chatsettingsdrawer.spriteLayoutApplyTo")}
            </label>
            <select
              id={`sprite-layout-apply-to-${chatId}`}
              value={selectedLayoutSubjectId ?? ""}
              onChange={(event) => onSelectLayoutSubject(event.target.value || null)}
              className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-[0.625rem] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/60"
            >
              <option value="">{localizeUi("ui.chat.chatsettingsdrawer.spriteLayoutAll")}</option>
              {layoutSubjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            {selectedLayoutSubjectId && (
              <AgentSettingsActionButton
                onClick={onResetSelectedLayoutSubject}
                disabled={!selectedLayoutSubjectHasOverride}
              >
                {localizeUi("ui.chat.chatsettingsdrawer.useAllSpriteLayoutSettings")}
              </AgentSettingsActionButton>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
              {selectedLayoutSubjectId
                ? localizeUi("ui.chat.chatsettingsdrawer.characterSide")
                : localizeUi("ui.chat.chatsettingsdrawer.defaultSide")}
            </span>
            <div className="min-w-32 flex-1">
              <AgentSettingsSegmentedControl
                value={spritePosition}
                options={[
                  { id: "left", label: localizeUi("ui.chat.chatsettingsdrawer.left") },
                  { id: "right", label: localizeUi("ui.chat.chatsettingsdrawer.right") },
                ]}
                onChange={onSpritePositionChange}
              />
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <SpriteRangeSlider
              label={localizeUi("ui.chat.expressionsetupfields.expressionSize")}
              value={expressionSpriteScalePercent}
              min={SPRITE_DISPLAY_SCALE_PERCENT_MIN}
              max={SPRITE_DISPLAY_SCALE_PERCENT_MAX}
              step={5}
              suffix="%"
              onChange={onExpressionSpriteScaleChange}
            />
            <SpriteRangeSlider
              label={localizeUi("ui.chat.expressionsetupfields.fullBodySize")}
              value={fullBodySpriteScalePercent}
              min={SPRITE_DISPLAY_SCALE_PERCENT_MIN}
              max={SPRITE_DISPLAY_SCALE_PERCENT_MAX}
              step={5}
              suffix="%"
              onChange={onFullBodySpriteScaleChange}
            />
            <SpriteRangeSlider
              label={localizeUi("ui.chat.expressionsetupfields.expressionOpacity")}
              value={expressionSpriteOpacityPercent}
              min={SPRITE_DISPLAY_OPACITY_PERCENT_MIN}
              max={SPRITE_DISPLAY_OPACITY_PERCENT_MAX}
              step={5}
              suffix="%"
              onChange={onExpressionSpriteOpacityChange}
            />
            <SpriteRangeSlider
              label={localizeUi("ui.chat.expressionsetupfields.fullBodyOpacity")}
              value={fullBodySpriteOpacityPercent}
              min={SPRITE_DISPLAY_OPACITY_PERCENT_MIN}
              max={SPRITE_DISPLAY_OPACITY_PERCENT_MAX}
              step={5}
              suffix="%"
              onChange={onFullBodySpriteOpacityChange}
            />
          </div>

          <p className="mt-2 text-[0.5625rem] leading-relaxed text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.chatsettingsdrawer.arrangeModeLetsYouDragSpritesAnywhereInThe")}
          </p>
        </div>
      )}
    </>
  );
}

function SpriteDisplayModeToggle({
  modes,
  onToggle,
}: {
  modes: readonly SpriteDisplayMode[];
  onToggle: (mode: SpriteDisplayMode) => void;
}) {
  const { t: localizeUi } = useTranslation();
  const options: Array<{ id: SpriteDisplayMode; label: string }> = [
    { id: "expressions", label: "Expressions" },
    { id: "full-body", label: "Full-body" },
  ];

  return (
    <div className="space-y-1.5 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.6875rem] font-medium text-[var(--foreground)]">
          {localizeUi("ui.chat.spritedisplaymodetoggle.spriteSource")}
        </span>
        <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.spritedisplaymodetoggle.chooseOneOrBoth")}
        </span>
      </div>
      <div className="grid grid-cols-2 overflow-hidden rounded-md ring-1 ring-[var(--border)]">
        {options.map((option, index) => {
          const active = hasSpriteDisplayMode(modes, option.id);
          const isLastActive = active && modes.length === 1;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onToggle(option.id)}
              disabled={isLastActive}
              className={cn(
                "min-w-0 px-2.5 py-1.5 text-[0.625rem] font-medium transition-colors",
                index > 0 && "border-l border-[var(--border)]",
                active
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                isLastActive && "cursor-not-allowed",
              )}
              title={
                isLastActive
                  ? localizeUi("ui.chat.spritedisplaymodetoggle.atLeastOneSpriteSourceMustStayEnabled")
                  : localizeUi("ui.chat.spritedisplaymodetoggle.value1Sprites", { value1: option.label })
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SpriteToggleButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  const { t: localizeUi } = useTranslation();
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.625rem] font-medium transition-colors ring-1",
        active
          ? "bg-[var(--primary)]/10 text-[var(--primary)] ring-[var(--primary)]/30 hover:bg-[var(--primary)]/15"
          : "text-[var(--muted-foreground)] ring-[var(--border)] hover:bg-[var(--accent)]",
      )}
      title={
        active
          ? localizeUi("ui.chat.spritetogglebutton.disableSprite")
          : localizeUi("ui.chat.spritetogglebutton.enableSprite")
      }
    >
      <Image size="0.6875rem" />
      <span>{active ? localizeUi("ui.noodle.noodlehome.enabled") : localizeUi("ui.presets.sectionstab.enable")}</span>
    </button>
  );
}
