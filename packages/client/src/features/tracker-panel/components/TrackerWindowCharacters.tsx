import { useState } from "react";
import { ListPlus, Lock, RefreshCw, Sparkles, Trash2, Unlock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PlayerStats, PresentCharacter } from "@marinara-engine/shared";
import { useUpdateAgent } from "../../../hooks/use-agents";
import type { GameStatePatchField } from "../../../hooks/use-game-state-patcher";
import { useUIStore, type TrackerDataPanelSection } from "../../../stores/ui.store";
import { cn } from "../../../lib/utils";
import { useFeaturedCharacterCards } from "../hooks/use-featured-character-cards";
import { useStatIcons } from "../hooks/use-stat-icons";
import { useTrackerMutations } from "../hooks/use-tracker-mutations";
import { useTrackerPanelModel } from "../hooks/use-tracker-panel-model";
import { getSpriteExpressionForCharacter } from "../lib/sprite-expressions";
import { FeaturedCharacterTrackerCard } from "./character-card/FeaturedCharacterTrackerCard";
import { AddRowButton, EmptySection, SectionIconButton } from "./controls/SectionControls";
import { useTrackerLockContext } from "./TrackerLockContext";

const CHARACTER_SECTIONS: TrackerDataPanelSection[] = ["characters"];

/** The standard tracker window and its popped-out drawer share the panel's readable character cards. */
export function TrackerWindowCharacters({
  chatId,
  characters,
  patchField,
  patchPlayerStats,
  onRerunSingleTracker,
  isTrackerRetryBusy,
}: {
  chatId: string;
  characters: PresentCharacter[];
  patchField: (field: GameStatePatchField, value: unknown) => void;
  patchPlayerStats: (field: keyof PlayerStats, value: unknown) => void;
  onRerunSingleTracker: (agentType: string) => void;
  isTrackerRetryBusy: boolean;
}) {
  const { t } = useTranslation();
  const trackerPanelSide = useUIStore((state) => state.trackerPanelSide);
  const trackerPanelSizeProfile = useUIStore((state) => state.trackerPanelSizeProfile);
  const trackerStatDisplayMode = useUIStore((state) => state.trackerStatDisplayMode);
  const trackerPanelUseExpressionSprites = useUIStore((state) => state.trackerPanelUseExpressionSprites);
  const { lockMode, onSetLockMode } = useTrackerLockContext();
  const [editMode, setEditMode] = useState<"add" | "delete" | null>(null);
  const addMode = editMode === "add";
  const deleteMode = editMode === "delete";
  const {
    activePersona,
    characterSpriteLookup,
    characterTrackerConfig,
    characterTrackerSettings,
    expressionSpritesEnabled,
    featuredCharacterCardKeys,
    resolveSpriteCharacterId,
    spriteExpressions,
    trackerStatIconOverrides,
  } = useTrackerPanelModel({
    activeChatId: chatId,
    presentCharacters: characters,
    trackerPanelSectionOrder: CHARACTER_SECTIONS,
    trackerPanelUseExpressionSprites,
  });
  const resolveStatIcon = useStatIcons({
    activeChatId: chatId,
    trackerStatIconOverrides,
    activePersona,
    presentCharacters: characters,
    characterProfileColorsById: characterSpriteLookup.profileColorsById,
    resolveProfileCharacterId: resolveSpriteCharacterId,
  });
  const { removeFeaturedCharacterCard } = useFeaturedCharacterCards({
    activeChatId: chatId,
    featuredCharacterCardKeys,
  });
  const {
    addCharacter,
    removeCharacter,
    updateCharacter,
    avatarFileInputRef,
    handleAvatarFileInputChange,
    openAvatarUpload,
  } = useTrackerMutations({
    activeChatId: chatId,
    customFields: [],
    personaStats: [],
    presentCharacters: characters,
    quests: [],
    patchField,
    patchPlayerStats,
    removeFeaturedCharacterCard,
  });
  const updateAgent = useUpdateAgent();
  const autoGenerateAvatars = characterTrackerSettings.autoGenerateAvatars === true;
  const toggleAutoGenerateAvatars = () => {
    if (!characterTrackerConfig) return;
    const nextSettings = { ...characterTrackerSettings };
    if (autoGenerateAvatars) delete nextSettings.autoGenerateAvatars;
    else nextSettings.autoGenerateAvatars = true;
    updateAgent.mutate({ id: characterTrackerConfig.id, settings: nextSettings });
  };
  const toggleEditMode = (mode: "add" | "delete") => {
    onSetLockMode?.(false);
    setEditMode(editMode === mode ? null : mode);
  };

  return (
    <div data-component="TrackerWindowCharacters">
      {/* The drawer or detached window already supplies the Present Characters heading. */}
      <div className="flex flex-wrap items-center justify-end gap-1 px-2 py-1">
        <SectionIconButton
          onClick={() => onRerunSingleTracker("character-tracker")}
          disabled={isTrackerRetryBusy}
          title={t("ui.chat.combinedplayerpanel.reRunCharacterTrackerOnly")}
        >
          <RefreshCw size="0.75rem" className={cn(isTrackerRetryBusy && "animate-spin")} />
        </SectionIconButton>
        {characterTrackerConfig && (
          <SectionIconButton
            onClick={toggleAutoGenerateAvatars}
            disabled={updateAgent.isPending}
            pressed={autoGenerateAvatars}
            tone="feature"
            title={t(
              autoGenerateAvatars
                ? "ui.chat.characterspanel.autoGenerateAvatarsOn"
                : "ui.chat.characterspanel.autoGenerateAvatarsOff",
            )}
          >
            <Sparkles size="0.75rem" />
          </SectionIconButton>
        )}
        {onSetLockMode && (
          <SectionIconButton
            onClick={() => {
              setEditMode(null);
              onSetLockMode(!lockMode);
            }}
            pressed={lockMode}
            title={t(
              lockMode ? "ui.chat.hudlockmodetoggle.exitHudLockMode" : "ui.chat.hudlockmodetoggle.enterHudLockMode",
            )}
          >
            {lockMode ? <Lock size="0.75rem" /> : <Unlock size="0.75rem" />}
          </SectionIconButton>
        )}
        <SectionIconButton
          onClick={() => toggleEditMode("add")}
          pressed={addMode}
          title={t(
            addMode
              ? "ui.trackerPanel.trackersidebarheader.exitTrackerAddMode"
              : "ui.trackerPanel.trackersidebarheader.enterTrackerAddMode",
          )}
        >
          <ListPlus size="0.875rem" />
        </SectionIconButton>
        <SectionIconButton
          onClick={() => toggleEditMode("delete")}
          pressed={deleteMode}
          title={t(
            deleteMode
              ? "ui.trackerPanel.trackersidebarheader.exitTrackerDeleteMode"
              : "ui.trackerPanel.trackersidebarheader.enterTrackerDeleteMode",
          )}
        >
          <Trash2 size="0.75rem" />
        </SectionIconButton>
        <AddRowButton onClick={addCharacter} title={t("ui.trackerPanel.charactertrackerpanel.addCharacter")}>
          {t("ui.characters.metadatatab.add")}
        </AddRowButton>
      </div>
      {characters.length === 0 ? (
        <EmptySection>{t("ui.trackerPanel.charactertrackerpanel.noCharactersTracked")}</EmptySection>
      ) : (
        <div
          data-tracker-character-grid
          className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] items-start gap-y-2 pb-1"
        >
          {characters.map((character, index) => {
            const spriteCharacterId = resolveSpriteCharacterId(character);
            return (
              <div key={`${chatId}-${character.characterId}-${index}`} className="@container min-w-0">
                <FeaturedCharacterTrackerCard
                  character={character}
                  spriteCharacterId={spriteCharacterId}
                  spriteExpression={
                    expressionSpritesEnabled
                      ? getSpriteExpressionForCharacter(spriteExpressions, character, spriteCharacterId)
                      : undefined
                  }
                  expressionSpritesEnabled={expressionSpritesEnabled}
                  characterPicture={
                    spriteCharacterId ? characterSpriteLookup.pictureById[spriteCharacterId] : undefined
                  }
                  profileColors={
                    spriteCharacterId ? characterSpriteLookup.profileColorsById[spriteCharacterId] : undefined
                  }
                  trackerPanelSide={trackerPanelSide}
                  trackerPanelSizeProfile={trackerPanelSizeProfile}
                  thoughtBubbleDisplay="inline"
                  dockedThoughtsAlwaysVisible
                  statDisplayMode={trackerStatDisplayMode}
                  resolveStatIcon={resolveStatIcon}
                  onUpdate={(updated) => updateCharacter(index, updated)}
                  onRemove={() => removeCharacter(index)}
                  characterIndex={index}
                  deleteMode={deleteMode}
                  addMode={addMode}
                  onUploadAvatar={() => openAvatarUpload(index)}
                />
              </div>
            );
          })}
        </div>
      )}
      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarFileInputChange}
      />
    </div>
  );
}
