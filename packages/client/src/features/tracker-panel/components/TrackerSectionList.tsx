import { useCallback, type ReactNode } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import type {
  GameState,
  InventoryTrackerGroup,
  InventoryTrackerRow,
  Persona,
  PresentCharacter,
} from "@marinara-engine/shared";
import { useUpdateAgent, type AgentConfigRow } from "../../../hooks/use-agents";
import type { GameStatePatchField } from "../../../hooks/use-game-state-patcher";
import type {
  TrackerPanelCollapsedSections,
  TrackerPanelSide,
  TrackerPanelSizeProfile,
  TrackerStatDisplayMode,
  TrackerTemperatureUnit,
  TrackerThoughtBubbleDisplay,
} from "../../../stores/ui.store";
import { useFeaturedCharacterCards } from "../hooks/use-featured-character-cards";
import type { StatIconLookup } from "../hooks/use-stat-icons";
import { useTrackerMutations } from "../hooks/use-tracker-mutations";
import { useTrackerRerun } from "../hooks/use-tracker-rerun";
import type { PersonaPortraitSaveSnapshot } from "../hooks/use-persona-portrait-save";
import { buildInventoryTrackerEditPatch } from "../lib/inventory-tracker-edit";
import { TRACKER_SECTION_AGENT_TYPES, TRACKER_SECTION_RERUN_TITLES } from "../lib/tracker-panel.constants";
import type { TrackerPanelSection, TrackerSpriteLookup } from "../tracker-panel.types";
import { SectionIconButton } from "./controls/SectionControls";
import { CharacterTrackerPanel } from "./sections/CharacterTrackerPanel";
import { CustomTrackerPanel } from "./sections/CustomTrackerPanel";
import { PersonaInventoryPanel } from "./sections/PersonaInventoryPanel";
import { InventoryTrackerPanel } from "./sections/InventoryTrackerPanel";
import { QuestTrackerPanel } from "./sections/quest-tracker/QuestTrackerPanel";
import { WorldStatePanel } from "./sections/WorldStatePanel";

export function TrackerSectionList({
  activeChatId,
  activePersona,
  characterSpriteLookup,
  characterTrackerConfig,
  characterTrackerSettings,
  currentGameState,
  enabledAgentTypes,
  expressionSpritesEnabled,
  featuredCharacterCardKeys,
  flushPatch,
  gameStateRefreshing,
  orderedTrackerSections,
  patchField,
  patchPlayerStats,
  patchPlayerStatsMany,
  resolveSpriteCharacterId,
  spriteExpressions,
  trackerPanelCollapsedSections,
  trackerPanelSide,
  trackerPanelSizeProfile,
  trackerPanelThoughtBubbleDisplay,
  trackerStatDisplayMode,
  trackerPanelDockedThoughtsAlwaysVisible,
  trackerTemperatureUnit,
  toggleTrackerPanelSectionCollapsed,
  deleteMode,
  addMode,
  queuePersonaPortraitSave,
  flushPersonaPortraitSave,
  resolveStatIcon,
  beforeCustomSections,
  afterCustomSections,
}: {
  activeChatId: string;
  activePersona: Persona | null;
  characterSpriteLookup: TrackerSpriteLookup;
  characterTrackerConfig: AgentConfigRow | null;
  characterTrackerSettings: Record<string, unknown>;
  currentGameState: GameState;
  enabledAgentTypes: Set<string>;
  expressionSpritesEnabled: boolean;
  featuredCharacterCardKeys: Set<string>;
  flushPatch: () => Promise<void>;
  gameStateRefreshing: boolean;
  orderedTrackerSections: TrackerPanelSection[];
  patchField: (field: GameStatePatchField, value: unknown) => void;
  patchPlayerStats: (field: keyof NonNullable<GameState["playerStats"]>, value: unknown) => void;
  patchPlayerStatsMany: (
    patch:
      | Partial<NonNullable<GameState["playerStats"]>>
      | ((current: NonNullable<GameState["playerStats"]>) => Partial<NonNullable<GameState["playerStats"]>>),
  ) => void;
  resolveSpriteCharacterId: (character: PresentCharacter) => string | null;
  spriteExpressions: Record<string, string>;
  trackerPanelCollapsedSections: TrackerPanelCollapsedSections;
  trackerPanelSide: TrackerPanelSide;
  trackerPanelSizeProfile: TrackerPanelSizeProfile;
  trackerPanelThoughtBubbleDisplay: TrackerThoughtBubbleDisplay;
  trackerStatDisplayMode: TrackerStatDisplayMode;
  trackerPanelDockedThoughtsAlwaysVisible: boolean;
  trackerTemperatureUnit: TrackerTemperatureUnit;
  toggleTrackerPanelSectionCollapsed: (section: TrackerPanelSection) => void;
  deleteMode: boolean;
  addMode: boolean;
  queuePersonaPortraitSave: (snapshot: PersonaPortraitSaveSnapshot) => void;
  flushPersonaPortraitSave: (personaId: string) => void;
  resolveStatIcon: StatIconLookup;
  beforeCustomSections?: ReactNode;
  afterCustomSections?: ReactNode;
}) {
  const updateAgent = useUpdateAgent();
  const autoGenerateCharacterAvatars = characterTrackerSettings.autoGenerateAvatars === true;
  const { featuredCharacterCards, removeFeaturedCharacterCard, toggleFeaturedCharacterCard } =
    useFeaturedCharacterCards({
      activeChatId,
      featuredCharacterCardKeys,
    });
  const { rerunTracker, trackerRetryBusy } = useTrackerRerun({
    activeChatId,
    enabledAgentTypes,
    flushPatch,
    gameStateRefreshing,
  });

  const playerStats =
    currentGameState.playerStats &&
    typeof currentGameState.playerStats === "object" &&
    !Array.isArray(currentGameState.playerStats)
      ? currentGameState.playerStats
      : null;
  const personaStats = Array.isArray(currentGameState.personaStats) ? currentGameState.personaStats : [];
  const presentCharacters = Array.isArray(currentGameState.presentCharacters) ? currentGameState.presentCharacters : [];
  const quests = Array.isArray(playerStats?.activeQuests) ? playerStats.activeQuests : [];
  const customFields = Array.isArray(playerStats?.customTrackerFields) ? playerStats.customTrackerFields : [];
  const inventoryTrackerCurrencies = Array.isArray(playerStats?.inventoryTrackerCurrencies)
    ? playerStats.inventoryTrackerCurrencies
    : [];
  const inventoryTrackerEquipped = Array.isArray(playerStats?.inventoryTrackerEquipped)
    ? playerStats.inventoryTrackerEquipped
    : [];
  const inventoryTrackerInventory = Array.isArray(playerStats?.inventoryTrackerInventory)
    ? playerStats.inventoryTrackerInventory
    : [];
  // Editing one group can rewrite two, so this must land as a single patch.
  const editInventoryTracker = (group: InventoryTrackerGroup, rows: InventoryTrackerRow[]) =>
    patchPlayerStatsMany((current) => buildInventoryTrackerEditPatch(current, group, rows));
  const {
    addCharacter,
    addPersonaStat,
    addQuest,
    avatarFileInputRef,
    handleAvatarFileInputChange,
    openAvatarUpload,
    removeCharacter,
    removeQuest,
    savePersonaStatus,
    updateCharacter,
    updateCustomFields,
    updatePersonaStats,
    updateQuest,
  } = useTrackerMutations({
    activeChatId,
    customFields,
    personaStats,
    presentCharacters,
    quests,
    patchField,
    patchPlayerStats,
    removeFeaturedCharacterCard,
  });
  const isPanelCollapsed = (section: TrackerPanelSection) => trackerPanelCollapsedSections[section] === true;
  const toggleAutoGenerateCharacterAvatars = useCallback(() => {
    if (!characterTrackerConfig) return;
    const nextSettings = { ...characterTrackerSettings };
    if (autoGenerateCharacterAvatars) {
      delete nextSettings.autoGenerateAvatars;
    } else {
      nextSettings.autoGenerateAvatars = true;
    }
    updateAgent.mutate({ id: characterTrackerConfig.id, settings: nextSettings });
  }, [autoGenerateCharacterAvatars, characterTrackerConfig, characterTrackerSettings, updateAgent]);

  const renderRerunAction = (section: TrackerPanelSection) => {
    const agentType = TRACKER_SECTION_AGENT_TYPES[section];
    if (!agentType || !enabledAgentTypes.has(agentType)) return null;
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
        {characterTrackerConfig && (
          <SectionIconButton
            onClick={toggleAutoGenerateCharacterAvatars}
            disabled={updateAgent.isPending}
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
            state={currentGameState}
            trackerPanelSizeProfile={trackerPanelSizeProfile}
            trackerTemperatureUnit={trackerTemperatureUnit}
            action={renderRerunAction("world")}
            onSaveField={patchField}
            deleteMode={deleteMode}
            addMode={addMode}
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
            trackerPanelSide={trackerPanelSide}
            statDisplayMode={trackerStatDisplayMode}
            resolveStatIcon={resolveStatIcon}
            spriteExpression={
              expressionSpritesEnabled && activePersona
                ? (spriteExpressions[activePersona.id] ?? spriteExpressions[activePersona.name] ?? "neutral")
                : undefined
            }
            personaStats={personaStats}
            action={renderRerunAction("persona")}
            onSaveStatus={savePersonaStatus}
            onUpdatePersonaStats={updatePersonaStats}
            onAddPersonaStat={addPersonaStat}
            deleteMode={deleteMode}
            addMode={addMode}
            queuePersonaPortraitSave={queuePersonaPortraitSave}
            flushPersonaPortraitSave={flushPersonaPortraitSave}
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
            statDisplayMode={trackerStatDisplayMode}
            resolveStatIcon={resolveStatIcon}
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
      case "inventory":
        return (
          <InventoryTrackerPanel
            key="inventory"
            currencies={inventoryTrackerCurrencies}
            equipped={inventoryTrackerEquipped}
            inventory={inventoryTrackerInventory}
            action={renderRerunAction("inventory")}
            onUpdateCurrencies={(rows) => editInventoryTracker("currencies", rows)}
            onUpdateEquipped={(rows) => editInventoryTracker("equipped", rows)}
            onUpdateInventory={(rows) => editInventoryTracker("inventory", rows)}
            deleteMode
            addMode={addMode}
            collapsed={isPanelCollapsed("inventory")}
            onToggleCollapsed={() => toggleTrackerPanelSectionCollapsed("inventory")}
          />
        );
      case "custom":
        return (
          <CustomTrackerPanel
            key="custom"
            fields={customFields}
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
      {orderedTrackerSections.map((section) => (
        <div key={section} className="contents">
          {section === "custom" ? beforeCustomSections : null}
          {renderTrackerSection(section)}
        </div>
      ))}
      {!orderedTrackerSections.includes("custom") ? beforeCustomSections : null}
      {afterCustomSections}
    </>
  );
}
