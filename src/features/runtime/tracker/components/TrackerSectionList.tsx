import { RefreshCw, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { TrackerPanelModel } from "../hooks/use-tracker-panel-model";
import { useTrackerMutations } from "../hooks/use-tracker-mutations";
import { useTrackerRerun } from "../hooks/use-tracker-rerun";
import {
  TRACKER_AGENT_TYPE_IDS,
  TRACKER_SECTION_AGENT_TYPES,
  TRACKER_SECTION_RERUN_TITLES,
  type TrackerPanelSection,
} from "../../world-state/index";
import { SectionIconButton } from "./tracker-data-sidebar.controls";
import { WorldStatePanel } from "./WorldStatePanel";
import { PersonaInventoryPanel } from "./PersonaTrackerPanel";
import { CharacterTrackerPanel } from "./CharacterTrackerPanel";
import { QuestTrackerPanel } from "./QuestTrackerPanel";
import { CustomTrackerPanel } from "./CustomTrackerPanel";

export function TrackerSectionList({
  addMode,
  deleteMode,
  model,
}: {
  addMode: boolean;
  deleteMode: boolean;
  model: TrackerPanelModel;
}) {
  const {
    activeChatId,
    activePersona,
    agentConfigLookupEnabled,
    characterSpriteLookup,
    customTrackerFields,
    enabledAgentTypes,
    expressionSpritesEnabled,
    featuredCharacterCards,
    flushPatch,
    gameState,
    gameStateRefreshing,
    getSnapshot,
    inventory,
    patchField,
    patchPlayerStats,
    personaStats,
    playerStats,
    presentCharacters,
    quests,
    removeFeaturedCharacterCard,
    resolveSpriteCharacterId,
    spriteExpressions,
    toggleFeaturedCharacterCard,
    toggleTrackerPanelSectionCollapsed,
    trackerPanelCollapsedSections,
    trackerPanelDockedThoughtsAlwaysVisible,
    trackerPanelSide,
    trackerPanelSizeProfile,
    trackerPanelThoughtBubbleDisplay,
    trackerTemperatureUnit,
    orderedTrackerSections,
  } = model;
  const { rerunTracker, trackerRetryBusy } = useTrackerRerun({
    activeChatId,
    enabledAgentTypes,
    flushPatch,
    gameStateRefreshing,
  });
  const {
    addCharacter,
    addInventoryItem,
    addPersonaStat,
    addQuest,
    autoGenerateCharacterAvatars,
    avatarFileInputRef,
    canToggleAutoGenerateCharacterAvatars,
    handleAvatarFileInputChange,
    isUpdatingAutoGenerateCharacterAvatars,
    openAvatarUpload,
    removeCharacter,
    removeInventoryItem,
    removeQuest,
    savePersonaStatus,
    toggleAutoGenerateCharacterAvatars,
    updateCharacter,
    updateCustomFields,
    updateInventoryItem,
    updatePersonaStats,
    updateQuest,
  } = useTrackerMutations({
    activeChatId,
    agentConfigLookupEnabled,
    customTrackerFields,
    inventory,
    personaStats,
    presentCharacters,
    quests,
    getSnapshot,
    patchField,
    patchPlayerStats,
    removeFeaturedCharacterCard,
  });

  if (!activeChatId || !gameState) return null;

  const isPanelCollapsed = (section: TrackerPanelSection) => trackerPanelCollapsedSections[section] === true;
  const renderRerunAction = (section: TrackerPanelSection): ReactNode => {
    const agentType = TRACKER_SECTION_AGENT_TYPES[section];
    if (!agentType || !TRACKER_AGENT_TYPE_IDS.has(agentType) || !enabledAgentTypes.has(agentType)) return null;
    const title = trackerRetryBusy
      ? "A tracker or reply is already running"
      : (TRACKER_SECTION_RERUN_TITLES[section] ?? `Re-run ${agentType} tracker`);
    return (
      <SectionIconButton onClick={() => void rerunTracker(agentType)} disabled={trackerRetryBusy} title={title}>
        <RefreshCw size="0.75rem" className={trackerRetryBusy ? "animate-spin" : ""} />
      </SectionIconButton>
    );
  };
  const renderCharacterHeaderAction = () => {
    const autoAvatarTitle = autoGenerateCharacterAvatars
      ? "Auto-generate character avatars: ON"
      : "Auto-generate character avatars: OFF";
    return (
      <>
        {canToggleAutoGenerateCharacterAvatars && (
          <SectionIconButton
            onClick={toggleAutoGenerateCharacterAvatars}
            disabled={isUpdatingAutoGenerateCharacterAvatars}
            title={autoAvatarTitle}
            pressed={autoGenerateCharacterAvatars}
            tone="feature"
          >
            <Sparkles size="0.6875rem" />
          </SectionIconButton>
        )}
        {renderRerunAction("characters")}
      </>
    );
  };

  const renderTrackerSection = (section: TrackerPanelSection) => {
    switch (section) {
      case "world":
        return (
          <WorldStatePanel
            key="world"
            state={gameState}
            trackerPanelSizeProfile={trackerPanelSizeProfile}
            trackerTemperatureUnit={trackerTemperatureUnit}
            action={renderRerunAction("world")}
            onSaveField={patchField}
            collapsed={isPanelCollapsed("world")}
            onToggleCollapsed={() => toggleTrackerPanelSectionCollapsed("world")}
          />
        );
      case "persona":
        return (
          <PersonaInventoryPanel
            key="persona"
            persona={activePersona}
            status={playerStats?.status ?? ""}
            spriteExpression={
              expressionSpritesEnabled && activePersona
                ? (spriteExpressions[activePersona.id] ?? spriteExpressions[activePersona.name] ?? "neutral")
                : undefined
            }
            trackerPanelSide={trackerPanelSide}
            trackerPanelSizeProfile={trackerPanelSizeProfile}
            personaStats={personaStats}
            inventory={inventory}
            action={renderRerunAction("persona")}
            onSaveStatus={savePersonaStatus}
            onUpdatePersonaStats={updatePersonaStats}
            onAddPersonaStat={addPersonaStat}
            onAddInventoryItem={addInventoryItem}
            onUpdateInventoryItem={updateInventoryItem}
            onRemoveInventoryItem={removeInventoryItem}
            deleteMode={deleteMode}
            addMode={addMode}
            collapsed={isPanelCollapsed("persona")}
            onToggleCollapsed={() => toggleTrackerPanelSectionCollapsed("persona")}
          />
        );
      case "characters":
        return (
          <CharacterTrackerPanel
            key="characters"
            activeChatId={activeChatId}
            characters={presentCharacters}
            featuredCharacterCards={featuredCharacterCards}
            spriteExpressions={spriteExpressions}
            expressionSpritesEnabled={expressionSpritesEnabled}
            characterPictures={characterSpriteLookup.pictureById}
            characterProfileColors={characterSpriteLookup.profileColorsById}
            resolveSpriteCharacterId={resolveSpriteCharacterId}
            trackerPanelSide={trackerPanelSide}
            trackerPanelSizeProfile={trackerPanelSizeProfile}
            thoughtBubbleDisplay={trackerPanelThoughtBubbleDisplay}
            dockedThoughtsAlwaysVisible={trackerPanelDockedThoughtsAlwaysVisible}
            action={renderCharacterHeaderAction()}
            onUpdateCharacter={updateCharacter}
            onRemoveCharacter={removeCharacter}
            onAddCharacter={addCharacter}
            onUploadAvatar={openAvatarUpload}
            onToggleFeatured={toggleFeaturedCharacterCard}
            deleteMode={deleteMode}
            addMode={addMode}
            collapsed={isPanelCollapsed("characters")}
            onToggleCollapsed={() => toggleTrackerPanelSectionCollapsed("characters")}
          />
        );
      case "quests":
        return (
          <QuestTrackerPanel
            key="quests"
            quests={quests}
            action={renderRerunAction("quests")}
            onAddQuest={addQuest}
            onUpdateQuest={updateQuest}
            onRemoveQuest={removeQuest}
            deleteMode={deleteMode}
            addMode={addMode}
            trackerPanelSizeProfile={trackerPanelSizeProfile}
            collapsed={isPanelCollapsed("quests")}
            onToggleCollapsed={() => toggleTrackerPanelSectionCollapsed("quests")}
          />
        );
      case "custom":
        return (
          <CustomTrackerPanel
            key="custom"
            fields={customTrackerFields}
            action={renderRerunAction("custom")}
            onUpdateFields={updateCustomFields}
            deleteMode={deleteMode}
            addMode={addMode}
            trackerPanelSizeProfile={trackerPanelSizeProfile}
            collapsed={isPanelCollapsed("custom")}
            onToggleCollapsed={() => toggleTrackerPanelSectionCollapsed("custom")}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarFileInputChange}
      />
      {orderedTrackerSections.map((section) => renderTrackerSection(section))}
    </>
  );
}
