// The Roleplay and Game face of Agents in Chat Settings: the commands, the agent library and every agent's card.
// Its state lives in useChatAgents and the cards it shares with Conversation's face in agent-settings-renderers;
// it only reads them, so it holds nothing a collapse could lose.
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import {
  AGENT_COST_HIGH_CALLS,
  AGENT_COST_HIGH_TOKENS,
  audioConnectionSupportsGeneration,
  GAME_VIDEO_PROMPT_TEMPLATE_ID,
  ILLUSTRATOR_VIDEO_MODES,
  type Lorebook,
  normalizeIllustratorVideoMode,
  normalizeVideoFirstFrame,
  ROLEPLAY_DEFAULT_VIDEO_FIRST_FRAME,
  STORYBOARD_AGENT_ID,
  VIDEO_FIRST_FRAMES,
} from "@marinara-engine/shared";
import {
  Activity,
  AlertTriangle,
  Archive,
  BookOpen,
  ChevronRight,
  Feather,
  Image,
  MapIcon,
  Music2,
  Paintbrush,
  Plus,
  Puzzle,
  Radar,
  Settings2,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import {
  AgentCategorySection,
  AgentSettingsActionButton,
  AgentSettingsCard,
  AgentSettingsSegmentedControl,
  AgentSettingsSubsection,
  AgentSettingsTextarea,
  AgentSettingsToggle,
  GamePromptTemplateSelect,
  GenerationSettingsLink,
  MediaScopeSelect,
} from "../../../components/chat/AgentSettingsControls";
import { CapabilityElement } from "../../../components/capabilities/CapabilityElement";
import { CardEvolutionAuditorSettings } from "./CardEvolutionAuditorSettings";
import { ConnectionSelect } from "../../../components/connections/ConnectionSelect";
import { NextImageSummary } from "./NextImageSummary";
import { DirectorSettings } from "./DirectorSettings";
import { EchoChamberSettings } from "./EchoChamberSettings";
import { ExpressionSpriteSettings } from "./ExpressionSpriteSettings";
import { GAME_SPOTIFY_KEYS, ROLEPLAY_SPOTIFY_KEYS, SpotifySourceSettings } from "./SpotifySourceSettings";
import { HelpTooltip } from "../../../components/ui/HelpTooltip";
import { HoldForRewriteToggle } from "./HoldForRewriteToggle";
import { KnowledgeAgentSettingsCard } from "./KnowledgeAgentSettingsCard";
import { LongTermMemoryCapabilitySettings } from "./LongTermMemorySettings";
import { LorebookKeeperSettings } from "./LorebookKeeperSettings";
import { MacroTextarea } from "../../../components/ui/MacroTextarea";
import { Select } from "../../../components/ui/Select";
import type { MusicProvider } from "../../../components/chat/AgentAddSetupFields";
import { NeedsModelChip } from "../../../components/connections/NeedsModelChip";
import { RoleplayCommandsSettings } from "./RoleplayCommandsSettings";
import { ChatSettingsSection as Section } from "../ChatSettingsSection";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { Suspense } from "react";
import { cn } from "../../../lib/utils";
import { filterAudioGenerationConnections } from "../../../lib/connection-filters";
import { isKnowledgeAgentType } from "./knowledge-agent-settings";
import { renderRoleplayAgentMenuIcon } from "./roleplay-agent-menu-icon";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { useUIStore } from "../../../stores/ui.store";
import type { useConnections } from "../../../hooks/use-connections";
import type { CharacterDisplayInfo } from "../../../lib/character-display";
import type { CastCardLike } from "../sections/cast-shared";
import { type AgentSettingsRenderers, StoryboardChatSettingsPanel } from "./agent-settings-renderers";
import {
  type ChatAgents,
  DEFAULT_PROSE_GUARDIAN_AVOID,
  DEFAULT_PROSE_GUARDIAN_BANNED_WORDS,
  getActiveAgentMenuDescription,
  getAgentSettingsMenuId,
  type UseChatAgentsOptions,
} from "./use-chat-agents";
import { Spinner } from "../../../components/ui/Spinner";

function getMusicProviderLabel(provider: MusicProvider): string {
  return provider === "spotify" ? "Spotify" : provider === "youtube" ? "YouTube" : "Custom";
}

type RoleplayAgentsSectionProps = Pick<
  UseChatAgentsOptions,
  | "chat"
  | "metadata"
  | "chatMode"
  | "isGame"
  | "isRoleplayMode"
  | "activeAgentIds"
  | "availableAgents"
  | "activeTrackerAgents"
  | "chatCharacters"
  | "charName"
  | "charTitle"
  | "closeForSurface"
  | "gameLorebookKeeperEnabled"
  | "gameSetupConfig"
  | "lorebooks"
  | "spriteCharacterIds"
  | "updateMeta"
  | "onSpriteVisualSettingsChange"
> & {
  /** useChatAgents' result, which the drawer also reads. */
  agents: ChatAgents;
  /** The render helpers both faces of Agents use. */
  renderers: AgentSettingsRenderers;
  connections: ReturnType<typeof useConnections>["data"];
  activeManualTrackerTypes: Set<string>;
  getCharacterInfo: (c: CastCardLike) => CharacterDisplayInfo;
  initialAgentId: string | null;
  spriteArrangeMode: boolean;
  onToggleSpriteArrange: (() => void) | undefined;
  requestClose: () => Promise<boolean>;
  rememberSettingsReturn: () => void;
  setShowAgentSuiteModal: (open: boolean) => void;
};

export function RoleplayAgentsSection({
  agents,
  renderers,
  chat,
  metadata,
  chatMode,
  isGame,
  isRoleplayMode,
  activeAgentIds,
  availableAgents,
  activeTrackerAgents,
  chatCharacters,
  charName,
  charTitle,
  closeForSurface,
  gameLorebookKeeperEnabled,
  gameSetupConfig,
  lorebooks,
  spriteCharacterIds,
  updateMeta,
  onSpriteVisualSettingsChange,
  connections,
  activeManualTrackerTypes,
  getCharacterInfo,
  initialAgentId,
  spriteArrangeMode,
  onToggleSpriteArrange,
  requestClose,
  rememberSettingsReturn,
  setShowAgentSuiteModal,
}: RoleplayAgentsSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const {
    activeGeneration,
    agentLoadCost,
    agentProcessing,
    campaignArtStyleDraft,
    cardEvolutionAuditorActive,
    cardEvolutionAuditorAgentMeta,
    changeMusicDjProvider,
    chatSettingsPackageByAgentId,
    chatSpriteChoicesLoading,
    chatSpriteSubjects,
    chatSpriteSubjectsLoading,
    chatSpriteSubjectsWithSprites,
    commitCampaignArtStyle,
    commitGameImagePromptInstructions,
    commitProseGuardianSettings,
    continuityActive,
    continuityAgentMeta,
    debugMode,
    directorActive,
    directorAgentMeta,
    echoChamberActive,
    echoChamberAgentMeta,
    editedSpritePosition,
    effectiveCustomMusicSource,
    expressionActive,
    expressionAgentMeta,
    expressionAvatarsEnabled,
    expressionSpriteOpacityPercent,
    expressionSpriteScalePercent,
    fullBodySpriteOpacityPercent,
    fullBodySpriteScalePercent,
    gameAgentFeatureCount,
    gameAgentPool,
    gameImageAutoGenerationEnabled,
    gameImageDynamicPromptEnabled,
    gameImageIncludeCharacterAppearance,
    gameImagePromptInstructionsDraft,
    gameImageUseAvatarReferences,
    gameLorebookKeeperLorebook,
    gameMusicDjEnabled,
    gameSceneVideosEnabled,
    gameSpotifyArtistDraft,
    gameSpotifyPlaylistId,
    gameSpotifySourceType,
    gameVideoPromptOptions,
    generatedCampaignArtStyle,
    getKnowledgeAgentSourceSettings,
    getRoleplayAgentMenuRemoveHandler,
    getRoleplayAgentSettingsOrder,
    handleLorebookKeeperBackfill,
    handleStopActiveGeneration,
    hasCustomSpritePlacements,
    htmlActive,
    htmlAgentMeta,
    illustratorActive,
    illustratorAgentMeta,
    illustratorAutoBackgroundsEnabled,
    illustratorIncludeCharacterAppearance,
    illustratorInstalled,
    illustratorUseAvatarReferences,
    knowledgeRetrievalActive,
    knowledgeRetrievalAgentMeta,
    knowledgeRouterActive,
    knowledgeRouterAgentMeta,
    lorebookKeeperActive,
    lorebookKeeperAgentMeta,
    lorebookKeeperReadBehindMessages,
    lorebookKeeperTargetLorebookId,
    ltmPackage,
    mapsPackage,
    mapsPackageEnabledForChat,
    musicDjAgentMeta,
    musicPlayerSource,
    narrativeDirectorSecretPlotEnabled,
    narrativeDirectorSecretPlotRunInterval,
    openAgentAddModal,
    openDownloadAgents,
    openGenerationSettings,
    openLorebookFromSettings,
    pendingAgentMenuTargetId,
    proseGuardianActive,
    proseGuardianAgentMeta,
    proseGuardianAvoidDraft,
    proseGuardianAvoidInstructions,
    proseGuardianBannedDraft,
    proseGuardianBannedWords,
    proseGuardianHoldForRewrite,
    proseGuardianStyleDraft,
    proseGuardianStyleInstructions,
    readLatestActiveAgentIds,
    refreshLorebooks,
    resetIllustratorAvatarReferences,
    resetIllustratorCharacterAppearance,
    resetSelectedSpriteCharacterVisualSettings,
    resetSpritePlacements,
    roleplayAgentMenuLinks,
    scrollToAgentMenu,
    secretPlotMessages,
    selectedGameVideoPromptTemplateId,
    selectedSpriteCharacterVisualSettings,
    selectedSpriteLayoutCharacterId,
    setCampaignArtStyleDraft,
    setEditorDirty,
    setExpressionSpriteOpacity,
    setExpressionSpriteScale,
    setFullBodySpriteOpacity,
    setFullBodySpriteScale,
    setGameImagePromptInstructionsDraft,
    setGameSpotifyArtistDraft,
    setLtmEnabledForChat,
    setMapsEnabledForChat,
    setProseGuardianAvoidDraft,
    setProseGuardianBannedDraft,
    setProseGuardianStyleDraft,
    setSelectedSpriteLayoutCharacterId,
    setSpotifyArtistDraft,
    setSpriteSide,
    spotifyActive,
    spotifyArtistDraft,
    spotifyPlaylistId,
    spotifyPlaylistsQuery,
    spotifySourceType,
    spriteDisplayModes,
    spriteLayoutSubjects,
    standaloneRoleplayAgentIds,
    standaloneRoleplayAgents,
    stoppingGeneration,
    supportsNarrativeDirectorSecretPlot,
    toggleAgent,
    toggleGameLorebookKeeper,
    toggleGameMusicDj,
    toggleIllustratorAutoBackgrounds,
    toggleIllustratorAvatarReferences,
    toggleIllustratorCharacterAppearance,
    toggleManualTrackerAgent,
    toggleSprite,
    toggleSpriteDisplayMode,
    updateGameVideoPromptSelection,
    updateKnowledgeAgentSourceSettings,
    useCampaignArtStyle,
    videoConnectionsList,
    visibleActiveAgentIds,
    worldMapsSettingsDescription,
  } = agents;
  const {
    renderDownloadedAgentChatSettings,
    renderReviewAgentOutputsToggle,
    renderIllustratorPromptConnectionSelect,
    renderIllustratorImageConnectionSelect,
    renderIllustratorImageStyleSelect,
    renderIllustratorImagesPerGeneration,
    renderIllustratorRunInterval,
    renderIllustratorVideoRunInterval,
    renderAgentLorebookAttachment,
    avatarLayoutCard,
    renderStandaloneRoleplayAgentSettingsCard,
    renderAgentPromptTemplateSelect,
    renderCustomMusicLibrarySettings,
    renderCustomAgentPicker,
    renderActiveCustomAgentSettingsCard,
    renderHapticSettingsCard,
  } = renderers;
  return (
    <Section
      id={`${chatMode}-agents`}
      forceOpen={initialAgentId !== null}
      label={localizeUi("navigation.topbar.agents")}
      icon={<Sparkles size="0.875rem" />}
      count={isGame ? gameAgentFeatureCount : visibleActiveAgentIds.length}
      help={localizeUi("ui.chat.chatsettingsdrawer.whenEnabledAiAgentsRunAutomaticallyDuringGenerationTo")}
    >
      {isRoleplayMode && (
        <RoleplayCommandsSettings
          chat={chat}
          installedAgentIds={
            new Set(availableAgents.filter((agent) => !agent.runtimeDisabled).map((agent) => agent.id))
          }
          characters={chatCharacters.map((character) => ({
            id: character.id,
            name: JSON.parse(character.data).name || character.id,
          }))}
          audioConnections={filterAudioGenerationConnections(
            (connections ?? []) as Array<{
              id: string;
              name: string;
              provider: string;
              audioGenerationSource?: string | null;
              audioGenerationLegacyConnectionId?: string | null;
              audioSoundEffects?: string | boolean;
              audioSoundEffectsEndpoint?: string | null;
              profileImportReviewRequired?: unknown;
            }>,
          ).filter((connection) => audioConnectionSupportsGeneration(connection, "sfx"))}
        />
      )}
      {isGame && (
        <SettingsSwitch
          label={localizeUi("chat.settings.game.sequentialTasks")}
          description={localizeUi("chat.settings.game.sequentialTasksHelp")}
          checked={metadata.gameSequentialAgents === true}
          onChange={(gameSequentialAgents) => updateMeta.mutate({ id: chat.id, gameSequentialAgents })}
          labelPosition="start"
          className="justify-between rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-left"
          labelClassName="text-xs font-medium"
        />
      )}
      {availableAgents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--secondary)]/35 px-4 py-5 text-center">
          <p className="text-xs font-medium text-[var(--foreground)]">
            {localizeUi("ui.chat.chatsettingsdrawer.noAgentsDownloadedYet")}
          </p>
          <p className="mx-auto mt-1 max-w-[32rem] text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.chatsettingsdrawer.downloadOptionalAgentsToAddTrackersWritersMapsAnd")}{" "}
            {isGame ? localizeUi("ui.chat.chatsettingsdrawer.game") : localizeUi("ui.chat.chatsettingsdrawer.roleplay")}
            .
          </p>
          <button
            type="button"
            onClick={openDownloadAgents}
            className="mari-chrome-control mari-chrome-control--primary mx-auto mt-3 px-4 py-2 text-xs"
          >
            <Sparkles size="0.8125rem" />
            {localizeUi("ui.agents.agentcatalogview.downloadAgents")}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {isGame && metadata.enableAgents && (
            <p className="px-1 text-[0.625rem] text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.chatsettingsdrawer.toggleSceneAnalysisAndCustomAgentsForThisGame")}
            </p>
          )}
          <SettingsSwitch
            label={localizeUi("ui.chat.chatsettingsdrawer.enableAgents")}
            description={
              <>
                <span className="block">
                  {isGame
                    ? localizeUi("ui.chat.chatsettingsdrawer.runSceneAnalysisAndAnyAttachedCustomAgentsDuring")
                    : localizeUi("ui.chat.chatsettingsdrawer.runAiAgentsDuringGenerationWorldStateExpressionsEtc")}
                </span>
                {isGame &&
                  metadata.enableAgents &&
                  (() => {
                    const setupCfg = metadata.gameSetupConfig as Record<string, unknown> | undefined;
                    const sceneConnId =
                      (metadata.gameSceneConnectionId as string) || (setupCfg?.sceneConnectionId as string) || null;
                    const sceneConn = sceneConnId
                      ? ((connections ?? []) as Array<{ id: string; name: string; model?: string }>).find(
                          (connection) => connection.id === sceneConnId,
                        )
                      : null;
                    const connectionLabel = sceneConn
                      ? `${sceneConn.name}${sceneConn.model ? ` — ${sceneConn.model}` : ""}`
                      : "Local sidecar (Gemma)";
                    return <span className="mt-0.5 block text-[var(--primary)]/70">{connectionLabel}</span>;
                  })()}
              </>
            }
            checked={metadata.enableAgents === true}
            onChange={(enabled) => updateMeta.mutate({ id: chat.id, enableAgents: enabled })}
            labelPosition="start"
            className={cn(
              "justify-between rounded-lg px-3 py-2.5 text-left",
              metadata.enableAgents
                ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
            )}
            labelClassName="text-xs font-medium"
          />
          {roleplayAgentMenuLinks.length > 0 && (
            <div
              data-agent-menus
              className="rounded-lg bg-[var(--background)]/45 px-2.5 py-2 ring-1 ring-[var(--border)]"
            >
              <div className="mb-1.5 flex items-center gap-1.5 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                <ChevronRight size="0.6875rem" className="shrink-0" />
                <span>{localizeUi("ui.chat.chatsettingsdrawer.agentMenus")}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {roleplayAgentMenuLinks.map((link) => (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => scrollToAgentMenu(link.targetId)}
                    className="inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-md bg-[var(--secondary)] px-2 py-1 text-[0.625rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]/60"
                    title={localizeUi("ui.chat.chatsettingsdrawer.jumpToValue1", { value1: link.label })}
                  >
                    {renderRoleplayAgentMenuIcon(link.id, "chip")}
                    <span className="min-w-0 truncate">{link.label}</span>
                    {link.count != null && (
                      <span className="shrink-0 rounded-full bg-[var(--primary)]/15 px-1.5 py-0.5 text-[0.5625rem] text-[var(--primary)]">
                        {link.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isRoleplayMode ? (
            <div data-trackers-control>
              <AgentSettingsCard
                id={`${chat.id}:trackers-control`}
                icon={<Radar size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                title={localizeUi("chat.settings.agents.trackersControl")}
                description={localizeUi("chat.settings.agents.trackersControlHelp")}
                initialOpen={false}
              >
                <AgentSettingsToggle
                  label={localizeUi("chat.settings.agents.attachSummaries")}
                  description={localizeUi("chat.settings.agents.attachSummariesHelp")}
                  enabled={metadata.attachSummariesToAgents === true}
                  onToggle={() =>
                    updateMeta.mutate({
                      id: chat.id,
                      attachSummariesToAgents: metadata.attachSummariesToAgents !== true,
                    })
                  }
                />
                {/* Manual trackers run only in roleplay-style chats. */}
                {metadata.enableAgents && isRoleplayMode && activeTrackerAgents.length > 0 && (
                  <AgentSettingsToggle
                    label={localizeUi("ui.chat.chatsettingsdrawer.attachLorebooksToTrackers")}
                    description={localizeUi("ui.chat.chatsettingsdrawer.attachLorebooksToTrackersDescription")}
                    enabled={metadata.attachLorebooksToTrackers === true}
                    onToggle={() =>
                      updateMeta.mutate({
                        id: chat.id,
                        attachLorebooksToTrackers: !metadata.attachLorebooksToTrackers,
                      })
                    }
                  />
                )}
                {renderReviewAgentOutputsToggle("card")}
                {metadata.enableAgents && isRoleplayMode && activeTrackerAgents.length > 0 && (
                  <div className="space-y-1.5 rounded-lg bg-[var(--background)]/45 p-2 ring-1 ring-[var(--border)]">
                    <span className="block px-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                      {localizeUi("ui.chat.chatsettingsdrawer.individualTrackerSchedule")}
                    </span>
                    <div className="space-y-1">
                      {activeTrackerAgents.map((agent) => {
                        const manuallyTriggered = activeManualTrackerTypes.has(agent.id);
                        return (
                          <SettingsSwitch
                            key={agent.id}
                            label={
                              <span className="flex min-w-0 items-center gap-2">
                                <Sparkles size="0.75rem" className="shrink-0 text-[var(--primary)]" />
                                <span className="min-w-0">
                                  <span className="block truncate text-[0.625rem] font-medium">{agent.name}</span>
                                  <span className="block truncate text-[0.5625rem] text-[var(--muted-foreground)]">
                                    {manuallyTriggered
                                      ? localizeUi("ui.chat.chatsettingsdrawer.runsOnlyFromHudControls")
                                      : localizeUi("ui.chat.chatsettingsdrawer.runsAutomatically")}
                                  </span>
                                </span>
                              </span>
                            }
                            checked={manuallyTriggered}
                            onChange={() => toggleManualTrackerAgent(agent.id)}
                            labelPosition="start"
                            className={cn(
                              "justify-between rounded-md px-2 py-1.5 text-left",
                              manuallyTriggered
                                ? "bg-[var(--primary)]/10 text-[var(--foreground)] ring-1 ring-[var(--primary)]/25"
                                : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                            )}
                            labelClassName="min-w-0"
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </AgentSettingsCard>
            </div>
          ) : (
            renderReviewAgentOutputsToggle("secondary")
          )}
          {isRoleplayMode && (activeGeneration || stoppingGeneration) && (
            <button
              type="button"
              onClick={() => void handleStopActiveGeneration()}
              disabled={stoppingGeneration}
              className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="min-w-0 flex-1">
                <span className="text-[0.6875rem] font-medium">
                  {stoppingGeneration
                    ? localizeUi("ui.chat.chatsettingsdrawer.stoppingGeneration")
                    : localizeUi("ui.chat.chatsettingsdrawer.stopActiveGeneration")}
                </span>
                <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                  {localizeUi("ui.chat.chatsettingsdrawer.stopActiveGenerationDescription")}
                </p>
              </div>
              {stoppingGeneration ? (
                <Spinner size="sm" className="shrink-0 text-[var(--muted-foreground)]" />
              ) : (
                <X size="0.8125rem" className="shrink-0 text-[var(--muted-foreground)]" />
              )}
            </button>
          )}
          <button
            onClick={() => setShowAgentSuiteModal(true)}
            className="flex w-full items-center justify-between gap-3 rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-left transition-all hover:bg-[var(--accent)]"
          >
            <div className="min-w-0 flex-1">
              <span className="text-[0.6875rem] font-medium">{localizeUi("ui.chat.agentsuitemodal.agentSuite")}</span>
              <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.chat.chatsettingsdrawer.viewAndEditEverythingAgentsHaveStoredInThis")}
              </p>
            </div>
            <div className="flex h-5 w-9 shrink-0 items-center justify-center text-[var(--muted-foreground)]">
              <Wrench size="0.75rem" />
            </div>
          </button>
          {isGame && metadata.enableAgents && (
            <div className="mt-1.5 px-3">
              <ConnectionSelect
                job={t("connections.picker.job.sceneEffects")}
                value={(metadata.gameSceneConnectionId as string) || null}
                onChange={(connectionId) => updateMeta.mutate({ id: chat.id, gameSceneConnectionId: connectionId })}
                inherits={
                  import.meta.env.VITE_MARINARA_LITE === "true"
                    ? { connectionId: chat.connectionId ?? null }
                    : undefined
                }
                // Lite has no sidecar; an empty scene connection falls back to the chat's own.
                defaultLabel={
                  import.meta.env.VITE_MARINARA_LITE === "true"
                    ? t("connections.select.default")
                    : localizeUi("ui.chat.chatsettingsdrawer.localSidecarGemma")
                }
                includeLocalSidecar={import.meta.env.VITE_MARINARA_LITE !== "true"}
              />
            </div>
          )}

          {isGame && (
            <AgentSettingsCard
              icon={<BookOpen size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
              title={lorebookKeeperAgentMeta.name}
              description={lorebookKeeperAgentMeta.description}
            >
              <AgentSettingsToggle
                label={localizeUi("ui.chat.chatsettingsdrawer.gameSessionKeeper")}
                description={localizeUi("ui.chat.chatsettingsdrawer.gameModeRunsThisAfterASessionEndsWith")}
                enabled={gameLorebookKeeperEnabled}
                onToggle={toggleGameLorebookKeeper}
              />
              {gameLorebookKeeperLorebook && (
                <p className="truncate rounded-lg bg-[var(--background)]/75 px-3 py-2 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                  {localizeUi("ui.chat.chatsettingsdrawer.target")}{" "}
                  <span className="font-medium text-[var(--foreground)]">{gameLorebookKeeperLorebook.name}</span>
                </p>
              )}
            </AgentSettingsCard>
          )}

          {isGame && (
            <AgentSettingsCard
              icon={<Music2 size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
              title={musicDjAgentMeta.name}
              description={musicDjAgentMeta.description}
            >
              <AgentSettingsToggle
                label={localizeUi("ui.chat.chatsettingsdrawer.musicDj")}
                description={localizeUi("ui.chat.chatsettingsdrawer.activePlayerValue1", {
                  value1: getMusicProviderLabel(musicPlayerSource),
                })}
                enabled={gameMusicDjEnabled}
                onToggle={() => void toggleGameMusicDj()}
              />

              <AgentSettingsSegmentedControl<MusicProvider>
                value={musicPlayerSource}
                columns={3}
                options={(["spotify", "youtube", "custom"] as const).map((provider) => ({
                  id: provider,
                  label: getMusicProviderLabel(provider),
                }))}
                onChange={(provider) => void changeMusicDjProvider(provider)}
              />

              {gameMusicDjEnabled && musicPlayerSource === "spotify" && (
                <div className="space-y-2">
                  <SpotifySourceSettings
                    chat={chat}
                    metadata={metadata}
                    keys={GAME_SPOTIFY_KEYS}
                    sourceType={gameSpotifySourceType}
                    playlistId={gameSpotifyPlaylistId}
                    artistDraft={gameSpotifyArtistDraft}
                    setArtistDraft={setGameSpotifyArtistDraft}
                    playlistsQuery={spotifyPlaylistsQuery}
                  />
                </div>
              )}

              {gameMusicDjEnabled && musicPlayerSource === "custom" && renderCustomMusicLibrarySettings("game")}
            </AgentSettingsCard>
          )}

          {isGame && avatarLayoutCard}

          {!isGame && (
            <div className="flex flex-col gap-2">
              {metadata.enableAgents && !isGame && lorebookKeeperActive && (
                <AgentSettingsCard
                  id={getAgentSettingsMenuId(chat.id, "lorebook-keeper")}
                  icon={renderRoleplayAgentMenuIcon("lorebook-keeper")}
                  title={lorebookKeeperAgentMeta.name}
                  description={lorebookKeeperAgentMeta.description}
                  order={getRoleplayAgentSettingsOrder("lorebook-keeper")}
                  onRemove={getRoleplayAgentMenuRemoveHandler("lorebook-keeper", lorebookKeeperAgentMeta.name)}
                >
                  {renderAgentLorebookAttachment("lorebook-keeper")}
                  <LorebookKeeperSettings
                    chat={chat}
                    metadata={metadata}
                    lorebookKeeperTargetLorebookId={lorebookKeeperTargetLorebookId}
                    lorebookKeeperReadBehindMessages={lorebookKeeperReadBehindMessages}
                    lorebooks={lorebooks}
                    agentProcessing={agentProcessing}
                    closeForSurface={closeForSurface}
                    handleLorebookKeeperBackfill={handleLorebookKeeperBackfill}
                  />
                </AgentSettingsCard>
              )}

              {metadata.enableAgents && !isGame && cardEvolutionAuditorActive && (
                <AgentSettingsCard
                  id={getAgentSettingsMenuId(chat.id, "card-evolution-auditor")}
                  icon={renderRoleplayAgentMenuIcon("card-evolution-auditor")}
                  title={cardEvolutionAuditorAgentMeta.name}
                  description={cardEvolutionAuditorAgentMeta.description}
                  order={getRoleplayAgentSettingsOrder("card-evolution-auditor")}
                  onRemove={getRoleplayAgentMenuRemoveHandler(
                    "card-evolution-auditor",
                    cardEvolutionAuditorAgentMeta.name,
                  )}
                >
                  {renderAgentLorebookAttachment("card-evolution-auditor")}
                  <CardEvolutionAuditorSettings closeForSurface={closeForSurface} />
                </AgentSettingsCard>
              )}

              {metadata.enableAgents && !isGame && proseGuardianActive && (
                <AgentSettingsCard
                  id={getAgentSettingsMenuId(chat.id, "prose-guardian")}
                  icon={renderRoleplayAgentMenuIcon("prose-guardian")}
                  title={proseGuardianAgentMeta.name}
                  description={proseGuardianAgentMeta.description}
                  order={getRoleplayAgentSettingsOrder("prose-guardian")}
                  onRemove={getRoleplayAgentMenuRemoveHandler("prose-guardian", proseGuardianAgentMeta.name)}
                >
                  {renderAgentLorebookAttachment("prose-guardian")}
                  <AgentSettingsTextarea
                    label={localizeUi("ui.agents.agenteditor.bannedWords")}
                    value={proseGuardianBannedDraft}
                    placeholder={DEFAULT_PROSE_GUARDIAN_BANNED_WORDS}
                    rows={2}
                    onChange={setProseGuardianBannedDraft}
                    onBlur={() => {
                      if (proseGuardianBannedDraft.trim() !== proseGuardianBannedWords) {
                        commitProseGuardianSettings({
                          proseGuardianBannedWords: proseGuardianBannedDraft.trim(),
                        });
                      }
                    }}
                  />
                  <AgentSettingsTextarea
                    label={localizeUi("ui.agents.agenteditor.removeFromWriting")}
                    value={proseGuardianAvoidDraft}
                    placeholder={DEFAULT_PROSE_GUARDIAN_AVOID}
                    rows={3}
                    onChange={setProseGuardianAvoidDraft}
                    onBlur={() => {
                      if (proseGuardianAvoidDraft.trim() !== proseGuardianAvoidInstructions) {
                        commitProseGuardianSettings({
                          proseGuardianAvoidInstructions: proseGuardianAvoidDraft.trim(),
                        });
                      }
                    }}
                  />
                  <AgentSettingsTextarea
                    label={localizeUi("ui.agents.agenteditor.preferInWriting")}
                    value={proseGuardianStyleDraft}
                    placeholder={localizeUi("ui.agents.agenteditor.optionalStyleNotesPhrasesOrAuthorialPreferences")}
                    rows={3}
                    onChange={setProseGuardianStyleDraft}
                    onBlur={() => {
                      if (proseGuardianStyleDraft.trim() !== proseGuardianStyleInstructions) {
                        commitProseGuardianSettings({
                          proseGuardianStyleInstructions: proseGuardianStyleDraft.trim(),
                        });
                      }
                    }}
                  />
                  <HoldForRewriteToggle
                    enabled={proseGuardianHoldForRewrite}
                    onToggle={() =>
                      commitProseGuardianSettings({ proseGuardianHoldForRewrite: !proseGuardianHoldForRewrite })
                    }
                  />
                </AgentSettingsCard>
              )}

              {metadata.enableAgents && !isGame && directorActive && (
                <AgentSettingsCard
                  id={getAgentSettingsMenuId(chat.id, "director")}
                  icon={renderRoleplayAgentMenuIcon("director")}
                  title={directorAgentMeta.name}
                  description={directorAgentMeta.description}
                  order={getRoleplayAgentSettingsOrder("director")}
                  onRemove={getRoleplayAgentMenuRemoveHandler("director", directorAgentMeta.name)}
                >
                  {renderAgentLorebookAttachment("director")}
                  <DirectorSettings
                    chat={chat}
                    agentProcessing={agentProcessing}
                    supportsNarrativeDirectorSecretPlot={supportsNarrativeDirectorSecretPlot}
                    narrativeDirectorSecretPlotEnabled={narrativeDirectorSecretPlotEnabled}
                    narrativeDirectorSecretPlotRunInterval={narrativeDirectorSecretPlotRunInterval}
                    secretPlotMessages={secretPlotMessages}
                  />
                </AgentSettingsCard>
              )}

              {metadata.enableAgents && !isGame && continuityActive && (
                <AgentSettingsCard
                  id={getAgentSettingsMenuId(chat.id, "continuity")}
                  icon={renderRoleplayAgentMenuIcon("continuity")}
                  title={continuityAgentMeta.name}
                  description={continuityAgentMeta.description}
                  order={getRoleplayAgentSettingsOrder("continuity")}
                  onRemove={getRoleplayAgentMenuRemoveHandler("continuity", continuityAgentMeta.name)}
                >
                  {renderAgentLorebookAttachment("continuity")}
                  <HoldForRewriteToggle
                    enabled={proseGuardianHoldForRewrite}
                    onToggle={() =>
                      commitProseGuardianSettings({ proseGuardianHoldForRewrite: !proseGuardianHoldForRewrite })
                    }
                  />
                </AgentSettingsCard>
              )}

              {metadata.enableAgents && !isGame && htmlActive && (
                <AgentSettingsCard
                  id={getAgentSettingsMenuId(chat.id, "html")}
                  icon={renderRoleplayAgentMenuIcon("html")}
                  title={htmlAgentMeta.name}
                  description={htmlAgentMeta.description}
                  order={getRoleplayAgentSettingsOrder("html")}
                  onRemove={getRoleplayAgentMenuRemoveHandler("html", htmlAgentMeta.name)}
                >
                  {renderAgentLorebookAttachment("html")}
                  <HoldForRewriteToggle
                    enabled={proseGuardianHoldForRewrite}
                    onToggle={() =>
                      commitProseGuardianSettings({ proseGuardianHoldForRewrite: !proseGuardianHoldForRewrite })
                    }
                  />
                </AgentSettingsCard>
              )}

              {metadata.enableAgents && isRoleplayMode && knowledgeRetrievalActive && (
                <KnowledgeAgentSettingsCard
                  attachment={renderAgentLorebookAttachment("knowledge-retrieval")}
                  id={getAgentSettingsMenuId(chat.id, "knowledge-retrieval")}
                  agentType="knowledge-retrieval"
                  title={knowledgeRetrievalAgentMeta.name}
                  description={knowledgeRetrievalAgentMeta.description}
                  lorebooks={(lorebooks ?? []) as Lorebook[]}
                  settings={getKnowledgeAgentSourceSettings("knowledge-retrieval")}
                  order={getRoleplayAgentSettingsOrder("knowledge-retrieval")}
                  onChange={(patch) => updateKnowledgeAgentSourceSettings("knowledge-retrieval", patch)}
                  onRemove={getRoleplayAgentMenuRemoveHandler("knowledge-retrieval", knowledgeRetrievalAgentMeta.name)}
                />
              )}

              {metadata.enableAgents && isRoleplayMode && knowledgeRouterActive && (
                <KnowledgeAgentSettingsCard
                  attachment={renderAgentLorebookAttachment("knowledge-router")}
                  id={getAgentSettingsMenuId(chat.id, "knowledge-router")}
                  agentType="knowledge-router"
                  title={knowledgeRouterAgentMeta.name}
                  description={knowledgeRouterAgentMeta.description}
                  lorebooks={(lorebooks ?? []) as Lorebook[]}
                  settings={getKnowledgeAgentSourceSettings("knowledge-router")}
                  order={getRoleplayAgentSettingsOrder("knowledge-router")}
                  onChange={(patch) => updateKnowledgeAgentSourceSettings("knowledge-router", patch)}
                  onRemove={getRoleplayAgentMenuRemoveHandler("knowledge-router", knowledgeRouterAgentMeta.name)}
                />
              )}

              {standaloneRoleplayAgents.map(renderStandaloneRoleplayAgentSettingsCard)}

              {metadata.enableAgents && !isGame && expressionActive && (
                <AgentSettingsCard
                  id={getAgentSettingsMenuId(chat.id, "expression")}
                  icon={renderRoleplayAgentMenuIcon("expression")}
                  title={expressionAgentMeta.name}
                  description={expressionAgentMeta.description}
                  order={getRoleplayAgentSettingsOrder("expression")}
                  onRemove={getRoleplayAgentMenuRemoveHandler("expression", expressionAgentMeta.name)}
                  badge={
                    spriteCharacterIds.length > 0 ? (
                      <span className="shrink-0 rounded-full bg-[var(--primary)]/10 px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--primary)]">
                        {spriteCharacterIds.length} {localizeUi("ui.chat.chatsettingsdrawer.enabled")}
                      </span>
                    ) : null
                  }
                >
                  {renderAgentLorebookAttachment("expression")}
                  <ExpressionSpriteSettings
                    chatId={chat.id}
                    displayModes={spriteDisplayModes}
                    onToggleDisplayMode={toggleSpriteDisplayMode}
                    onlyActiveSprites={metadata.expressionOnlyActiveSprites === true}
                    onToggleOnlyActiveSprites={
                      isRoleplayMode
                        ? () =>
                            updateMeta.mutate({
                              id: chat.id,
                              expressionOnlyActiveSprites: metadata.expressionOnlyActiveSprites !== true,
                            })
                        : undefined
                    }
                    expressionAvatarsEnabled={expressionAvatarsEnabled}
                    onToggleExpressionAvatars={() => {
                      const nextEnabled = !expressionAvatarsEnabled;
                      if (onSpriteVisualSettingsChange) {
                        onSpriteVisualSettingsChange({ expressionAvatarsEnabled: nextEnabled });
                        return;
                      }
                      updateMeta.mutate({ id: chat.id, expressionAvatarsEnabled: nextEnabled });
                    }}
                    ownerCount={chatSpriteSubjects.length}
                    ownersLoading={chatSpriteSubjectsLoading}
                    choicesLoading={chatSpriteChoicesLoading}
                    owners={chatSpriteSubjectsWithSprites.map((subject) => {
                      const isPersona = subject.kind === "persona";
                      return {
                        id: subject.id,
                        kind: subject.kind,
                        name: isPersona ? subject.persona.name : charName(subject.character),
                        title: isPersona ? subject.persona.comment || "Persona" : charTitle(subject.character),
                        avatarPath: isPersona ? subject.persona.avatarPath : subject.character.avatarPath,
                        avatarCrop: isPersona
                          ? (subject.persona.avatarCrop ?? null)
                          : (getCharacterInfo(subject.character).avatarCrop ?? null),
                        active: spriteCharacterIds.includes(subject.id),
                      };
                    })}
                    onOpenOwner={(kind, id) => {
                      closeForSurface();
                      if (kind === "persona") {
                        useUIStore.getState().openPersonaDetail(id);
                      } else {
                        useUIStore.getState().openCharacterDetail(id);
                      }
                    }}
                    onToggleOwner={toggleSprite}
                    enabledOwnerCount={spriteCharacterIds.length}
                    layoutSubjects={spriteLayoutSubjects}
                    selectedLayoutSubjectId={selectedSpriteLayoutCharacterId}
                    onSelectLayoutSubject={setSelectedSpriteLayoutCharacterId}
                    selectedLayoutSubjectHasOverride={Boolean(selectedSpriteCharacterVisualSettings)}
                    onResetSelectedLayoutSubject={resetSelectedSpriteCharacterVisualSettings}
                    spriteArrangeMode={spriteArrangeMode}
                    onToggleSpriteArrange={onToggleSpriteArrange}
                    hasCustomSpritePlacements={hasCustomSpritePlacements}
                    onResetSpritePlacements={resetSpritePlacements}
                    spritePosition={editedSpritePosition}
                    onSpritePositionChange={setSpriteSide}
                    expressionSpriteScalePercent={expressionSpriteScalePercent}
                    fullBodySpriteScalePercent={fullBodySpriteScalePercent}
                    expressionSpriteOpacityPercent={expressionSpriteOpacityPercent}
                    fullBodySpriteOpacityPercent={fullBodySpriteOpacityPercent}
                    onExpressionSpriteScaleChange={setExpressionSpriteScale}
                    onFullBodySpriteScaleChange={setFullBodySpriteScale}
                    onExpressionSpriteOpacityChange={setExpressionSpriteOpacity}
                    onFullBodySpriteOpacityChange={setFullBodySpriteOpacity}
                  />
                </AgentSettingsCard>
              )}

              {avatarLayoutCard}

              {metadata.enableAgents && isRoleplayMode && echoChamberActive && (
                <AgentSettingsCard
                  id={getAgentSettingsMenuId(chat.id, "echo-chamber")}
                  icon={renderRoleplayAgentMenuIcon("echo-chamber")}
                  title={echoChamberAgentMeta.name}
                  description={echoChamberAgentMeta.description}
                  order={getRoleplayAgentSettingsOrder("echo-chamber")}
                  onRemove={getRoleplayAgentMenuRemoveHandler("echo-chamber", echoChamberAgentMeta.name)}
                >
                  {renderAgentLorebookAttachment("echo-chamber")}
                  <EchoChamberSettings
                    promptTemplateSelect={renderAgentPromptTemplateSelect("echo-chamber")}
                    closeForSurface={closeForSurface}
                  />
                </AgentSettingsCard>
              )}

              {metadata.enableAgents && isRoleplayMode && illustratorActive && (
                <AgentSettingsCard
                  id={getAgentSettingsMenuId(chat.id, "illustrator")}
                  icon={renderRoleplayAgentMenuIcon("illustrator")}
                  title={illustratorAgentMeta.name}
                  description={illustratorAgentMeta.description}
                  order={getRoleplayAgentSettingsOrder("illustrator")}
                  onRemove={getRoleplayAgentMenuRemoveHandler("illustrator", illustratorAgentMeta.name)}
                >
                  <NextImageSummary chat={chat} />
                  {renderAgentLorebookAttachment("illustrator")}
                  {renderAgentPromptTemplateSelect("illustrator")}
                  {renderIllustratorPromptConnectionSelect()}
                  {renderIllustratorImageConnectionSelect()}
                  {/* Clips only runs on the Video Run Interval, shown with the clip settings. */}
                  {normalizeIllustratorVideoMode(metadata.illustratorVideoMode) !== "clips_only" &&
                    renderIllustratorRunInterval()}
                  <AgentSettingsToggle
                    label={localizeUi("ui.chat.chatsettingsdrawer.generateSceneBackgrounds")}
                    description={localizeUi("ui.chat.chatsettingsdrawer.whenTheStoryEntersANewLocationLetIllustrator")}
                    enabled={illustratorAutoBackgroundsEnabled}
                    onToggle={toggleIllustratorAutoBackgrounds}
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                      {localizeUi("ui.chat.chatsettingsdrawer.illustratorMakes")}
                    </span>
                    <span className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
                      {localizeUi("ui.chat.chatsettingsdrawer.illustratorMakesHelp")}
                    </span>
                    <Select
                      label={localizeUi("ui.chat.chatsettingsdrawer.illustratorMakes")}
                      value={normalizeIllustratorVideoMode(metadata.illustratorVideoMode)}
                      options={ILLUSTRATOR_VIDEO_MODES.map((mode) => ({
                        value: mode,
                        label: localizeUi(`ui.chat.chatsettingsdrawer.illustratorVideoMode.${mode}`),
                      }))}
                      onChange={(value) =>
                        updateMeta.mutate({
                          id: chat.id,
                          illustratorVideoMode: normalizeIllustratorVideoMode(value),
                        })
                      }
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
                    />
                  </div>
                  {normalizeIllustratorVideoMode(metadata.illustratorVideoMode) !== "pictures" &&
                    renderIllustratorVideoRunInterval()}
                  <div className="flex flex-col gap-1">
                    <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                      {localizeUi("ui.chat.chatsettingsdrawer.videoFirstFrame")}
                    </span>
                    <span className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
                      {localizeUi("ui.chat.chatsettingsdrawer.roleplayVideoFirstFrameHelp")}
                    </span>
                    <Select
                      label={localizeUi("ui.chat.chatsettingsdrawer.videoFirstFrame")}
                      value={normalizeVideoFirstFrame(
                        metadata.sceneVideoFirstFrame,
                        ROLEPLAY_DEFAULT_VIDEO_FIRST_FRAME,
                      )}
                      options={VIDEO_FIRST_FRAMES.map((mode) => ({
                        value: mode,
                        // Send Avatar References for videos gives Prompt only the avatar to start from.
                        label: localizeUi(
                          mode === "prompt_only" && metadata.illustratorVideoUseAvatarReferences === true
                            ? "ui.chat.chatsettingsdrawer.videoFirstFrame.prompt_only_avatar"
                            : `ui.chat.chatsettingsdrawer.roleplayVideoFirstFrame.${mode}`,
                        ),
                      }))}
                      onChange={(value) =>
                        updateMeta.mutate({
                          id: chat.id,
                          sceneVideoFirstFrame: normalizeVideoFirstFrame(value),
                        })
                      }
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
                    />
                  </div>
                  {renderIllustratorImageStyleSelect({
                    description:
                      "Shared by Illustrator scenes and generated backgrounds so both keep the same visual language.",
                  })}
                  {renderIllustratorImagesPerGeneration()}
                  <p className="text-[0.59375rem] leading-snug text-[var(--muted-foreground)]">
                    {localizeUi(
                      "ui.chat.chatsettingsdrawer.usesTheBackgroundResolutionFromSettingsGenerationsTrackerLocations",
                    )}
                  </p>
                  <MediaScopeSelect
                    label={localizeUi("ui.chat.agentaddsetupfields.attachCardAppearance")}
                    description={localizeUi("ui.chat.chatsettingsdrawer.characterAppearanceScopeHelp")}
                    images={illustratorIncludeCharacterAppearance}
                    videos={metadata.illustratorVideoIncludeCharacterAppearance === true}
                    onChange={({ images, videos }) =>
                      updateMeta.mutate({
                        id: chat.id,
                        illustratorIncludeCharacterAppearance: images,
                        illustratorVideoIncludeCharacterAppearance: videos,
                      })
                    }
                    overridden={
                      typeof metadata.illustratorIncludeCharacterAppearance === "boolean" ||
                      metadata.illustratorVideoIncludeCharacterAppearance === true
                    }
                    onReset={resetIllustratorCharacterAppearance}
                  />
                  <MediaScopeSelect
                    label={localizeUi("ui.chat.agentaddsetupfields.sendAvatarReferences")}
                    description={localizeUi("ui.chat.chatsettingsdrawer.roleplayAvatarReferencesScopeHelp")}
                    images={illustratorUseAvatarReferences}
                    videos={metadata.illustratorVideoUseAvatarReferences === true}
                    onChange={({ images, videos }) =>
                      updateMeta.mutate({
                        id: chat.id,
                        illustratorUseAvatarReferences: images,
                        illustratorVideoUseAvatarReferences: videos,
                      })
                    }
                    overridden={
                      typeof metadata.illustratorUseAvatarReferences === "boolean" ||
                      metadata.illustratorVideoUseAvatarReferences === true
                    }
                    onReset={resetIllustratorAvatarReferences}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
                    <p className="min-w-0 flex-1 text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
                      {localizeUi("ui.chat.chatsettingsdrawer.promptModeControlsHowIllustratorWritesImagePromptsFor")}
                    </p>
                    <AgentSettingsActionButton
                      onClick={() => {
                        closeForSurface();
                        useUIStore.getState().openAgentDetail("illustrator");
                      }}
                      className="shrink-0"
                    >
                      <Settings2 size="0.75rem" />
                      <span>{localizeUi("ui.chat.chatsettingsdrawer.openSetup")}</span>
                    </AgentSettingsActionButton>
                  </div>
                  {illustratorInstalled && (
                    <AgentSettingsSubsection
                      id="scene-videos"
                      title={localizeUi("ui.chat.chatsettingsdrawer.sceneVideos")}
                      description={localizeUi(
                        "ui.chat.chatsettingsdrawer.generateManualMp4SceneVideosFromGalleryImages",
                      )}
                    >
                      <label className="flex flex-col gap-1">
                        <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                          {localizeUi("ui.chat.chatsettingsdrawer.videoConnection")}
                        </span>
                        <ConnectionSelect
                          job={t("connections.picker.job.video")}
                          value={(metadata.sceneVideoConnectionId as string) || null}
                          onChange={(connectionId) =>
                            updateMeta.mutate({ id: chat.id, sceneVideoConnectionId: connectionId })
                          }
                          kind="video"
                          defaultLabel={localizeUi("ui.chat.chatsettingsdrawer.selectVideoConnection")}
                          inherits="main"
                        />
                      </label>
                      {videoConnectionsList.length === 0 && <NeedsModelChip kind="video" />}
                      <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.chat.chatsettingsdrawer.galleryVideoAndImageAnimateUseThisConnectionWith")}
                      </p>
                    </AgentSettingsSubsection>
                  )}
                </AgentSettingsCard>
              )}

              {metadata.enableAgents && isRoleplayMode && spotifyActive && (
                <AgentSettingsCard
                  id={getAgentSettingsMenuId(chat.id, "spotify")}
                  icon={renderRoleplayAgentMenuIcon("spotify")}
                  title={musicDjAgentMeta.name}
                  description={musicDjAgentMeta.description}
                  order={getRoleplayAgentSettingsOrder("spotify")}
                  onRemove={getRoleplayAgentMenuRemoveHandler("spotify", musicDjAgentMeta.name)}
                >
                  {renderAgentLorebookAttachment("spotify")}
                  <p className="text-[0.55rem] text-[var(--muted-foreground)]/80">
                    {localizeUi("ui.chat.musicdjsetupfields.activePlayer")} {getMusicProviderLabel(musicPlayerSource)}.
                  </p>

                  <AgentSettingsSegmentedControl<MusicProvider>
                    value={musicPlayerSource}
                    columns={3}
                    options={(["spotify", "youtube", "custom"] as const).map((provider) => ({
                      id: provider,
                      label: getMusicProviderLabel(provider),
                    }))}
                    onChange={(provider) => void changeMusicDjProvider(provider)}
                  />

                  {musicPlayerSource === "spotify" && (
                    <SpotifySourceSettings
                      chat={chat}
                      metadata={metadata}
                      keys={ROLEPLAY_SPOTIFY_KEYS}
                      sourceType={spotifySourceType}
                      playlistId={spotifyPlaylistId}
                      artistDraft={spotifyArtistDraft}
                      setArtistDraft={setSpotifyArtistDraft}
                      playlistsQuery={spotifyPlaylistsQuery}
                    />
                  )}

                  {musicPlayerSource === "custom" && renderCustomMusicLibrarySettings("roleplay")}

                  <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                    {musicPlayerSource === "spotify"
                      ? localizeUi("ui.chat.chatsettingsdrawer.roleplayDjQueuesSeveralFittingTracksWhenItChanges")
                      : musicPlayerSource === "youtube"
                        ? localizeUi("ui.chat.chatsettingsdrawer.youtubeModeUsesTheMusicDjAgentSYoutube")
                        : effectiveCustomMusicSource === "folder"
                          ? localizeUi("ui.chat.chatsettingsdrawer.customModePicksFromTheSelectedDeviceFolderAnd")
                          : localizeUi("ui.chat.chatsettingsdrawer.customModePicksFromLocalGameAssetsMusicAnd")}
                  </p>
                </AgentSettingsCard>
              )}

              {renderActiveCustomAgentSettingsCard()}
            </div>
          )}

          {/* Haptic Feedback */}
          {renderHapticSettingsCard()}

          {/* Illustrator — game mode only */}
          {isGame && (
            <AgentSettingsCard
              id={getAgentSettingsMenuId(chat.id, "illustrator")}
              icon={<Image size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
              title={localizeUi("ui.chat.chatsettingsdrawer.illustrator")}
              description={localizeUi(
                "ui.chat.chatsettingsdrawer.autoGenerateSceneIllustrationsNpcPortraitsAndLocationBackgrounds",
              )}
            >
              {renderAgentLorebookAttachment("illustrator")}
              <GenerationSettingsLink
                onClick={openGenerationSettings}
                title={localizeUi("ui.chat.chatsettingsdrawer.openSettingsGenerations")}
                label={localizeUi("ui.chat.chatsettingsdrawer.imageGenerationSettings")}
                description={localizeUi(
                  "ui.chat.chatsettingsdrawer.adjustGenerationBehaviorImageSizesAndStylesInSettings",
                )}
              />
              <AgentSettingsToggle
                label={localizeUi("ui.chat.chatsettingsdrawer.gameIllustrator")}
                description={
                  metadata.enableSpriteGeneration
                    ? localizeUi("ui.chat.chatsettingsdrawer.illustratorIsEnabledForThisGame")
                    : localizeUi("ui.chat.chatsettingsdrawer.allowTheGameToRequestSceneImagesPortraitsAnd")
                }
                enabled={!!metadata.enableSpriteGeneration}
                onToggle={() =>
                  updateMeta.mutate({ id: chat.id, enableSpriteGeneration: !metadata.enableSpriteGeneration })
                }
              />
              {metadata.enableSpriteGeneration && (
                <div className="space-y-2">
                  <AgentSettingsToggle
                    label={localizeUi("ui.chat.chatsettingsdrawer.automaticVisuals")}
                    description={localizeUi(
                      "ui.chat.chatsettingsdrawer.letGameModeAutomaticallyRequestBackgroundsNpcPortraitsAnd",
                    )}
                    enabled={gameImageAutoGenerationEnabled}
                    onToggle={() =>
                      updateMeta.mutate({
                        id: chat.id,
                        gameImageAutoGenerationEnabled: !gameImageAutoGenerationEnabled,
                      })
                    }
                  />
                  <AgentSettingsToggle
                    label={localizeUi("ui.chat.chatsettingsdrawer.dynamicLlmPromptGenerationForGmModeAssets")}
                    description={localizeUi("ui.chat.chatsettingsdrawer.askThePromptModelToRewriteGameNpcPortrait")}
                    enabled={gameImageDynamicPromptEnabled}
                    onToggle={() =>
                      updateMeta.mutate({
                        id: chat.id,
                        gameImageDynamicPromptEnabled: !gameImageDynamicPromptEnabled,
                      })
                    }
                  />
                  {renderIllustratorPromptConnectionSelect()}
                  {renderIllustratorImageConnectionSelect("gameImageConnectionId")}
                  {renderIllustratorImageStyleSelect()}
                  {renderIllustratorImagesPerGeneration()}
                  <AgentSettingsToggle
                    label={localizeUi("ui.chat.chatsettingsdrawer.useCampaignArtStyle")}
                    description={localizeUi("ui.chat.chatsettingsdrawer.addThisGameSSetupGeneratedArtDirectionAs")}
                    enabled={useCampaignArtStyle}
                    onToggle={() =>
                      updateMeta.mutate({
                        id: chat.id,
                        gameSetupConfig: {
                          ...gameSetupConfig,
                          useCampaignArtStyle: !useCampaignArtStyle,
                        },
                      })
                    }
                  />
                  {useCampaignArtStyle && (
                    <label className="flex flex-col gap-1">
                      <span className="flex items-center justify-between gap-2 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                        <span>{localizeUi("ui.chat.chatsettingsdrawer.campaignArtStyle")}</span>
                        {generatedCampaignArtStyle && generatedCampaignArtStyle !== campaignArtStyleDraft.trim() && (
                          <button
                            type="button"
                            onClick={() => {
                              setCampaignArtStyleDraft(generatedCampaignArtStyle);
                              updateMeta.mutate({
                                id: chat.id,
                                gameSetupConfig: {
                                  ...gameSetupConfig,
                                  artStylePrompt: generatedCampaignArtStyle,
                                },
                              });
                            }}
                            className="rounded px-1.5 py-0.5 text-[0.5625rem] text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/10"
                          >
                            {localizeUi("ui.chat.chatsettingsdrawer.restoreSetupStyle")}
                          </button>
                        )}
                      </span>
                      <MacroTextarea
                        value={campaignArtStyleDraft}
                        onChange={setCampaignArtStyleDraft}
                        onBlur={commitCampaignArtStyle}
                        onExpandedClose={commitCampaignArtStyle}
                        title={localizeUi("ui.chat.chatsettingsdrawer.campaignArtStyle")}
                        ariaLabel={localizeUi("ui.chat.chatsettingsdrawer.campaignArtStyle")}
                        placeholder={localizeUi("ui.chat.chatsettingsdrawer.leaveBlankToUseOnlyTheSelectedImageStyle")}
                        rows={3}
                        maxLength={500}
                        className="mari-chrome-field min-h-[4.75rem] w-full !rounded-md px-2.5 py-2 pr-8 text-xs leading-relaxed"
                      />
                      <span className="text-[0.5625rem] leading-snug text-[var(--muted-foreground)]">
                        {localizeUi("ui.chat.chatsettingsdrawer.generatedDuringGameSetupEditOrClearItHere")}
                      </span>
                    </label>
                  )}
                  <label className="flex flex-col gap-1">
                    <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                      {localizeUi("ui.chat.chatsettingsdrawer.sceneImageInstructions")}
                    </span>
                    <MacroTextarea
                      value={gameImagePromptInstructionsDraft}
                      onChange={setGameImagePromptInstructionsDraft}
                      onBlur={commitGameImagePromptInstructions}
                      onExpandedClose={commitGameImagePromptInstructions}
                      title={localizeUi("ui.chat.chatsettingsdrawer.sceneImageInstructions")}
                      ariaLabel={localizeUi("ui.chat.chatsettingsdrawer.sceneImageInstructions")}
                      placeholder={localizeUi("ui.chat.chatsettingsdrawer.eGDottoreSMaskCompletelyCoversHisEyes")}
                      rows={3}
                      maxLength={1200}
                      className="mari-chrome-field min-h-[4.75rem] w-full !rounded-md px-2.5 py-2 pr-8 text-xs leading-relaxed"
                    />
                  </label>
                  <AgentSettingsToggle
                    label={localizeUi("ui.chat.agentaddsetupfields.attachCardAppearance")}
                    description={localizeUi(
                      "ui.chat.chatsettingsdrawer.appendMatchedCharacterAppearanceDetailsToTheFinalScene",
                    )}
                    enabled={gameImageIncludeCharacterAppearance}
                    onToggle={() =>
                      updateMeta.mutate({
                        id: chat.id,
                        gameImageIncludeCharacterAppearance: !gameImageIncludeCharacterAppearance,
                      })
                    }
                  />
                  <AgentSettingsToggle
                    label={localizeUi("ui.chat.agentaddsetupfields.sendAvatarReferences")}
                    description={localizeUi(
                      "ui.chat.chatsettingsdrawer.sendMatchingCharacterAndPersonaAvatarsOrSpritesAs",
                    )}
                    enabled={gameImageUseAvatarReferences}
                    onToggle={() =>
                      updateMeta.mutate({
                        id: chat.id,
                        gameImageUseAvatarReferences: !gameImageUseAvatarReferences,
                      })
                    }
                  />
                </div>
              )}
              {illustratorInstalled && (
                <div
                  data-agent-settings-feature-toggles="illustrator"
                  className="space-y-2 border-t border-[var(--border)] pt-3"
                >
                  <AgentSettingsToggle
                    label={localizeUi("ui.chat.chatsettingsdrawer.enableSceneVideos")}
                    description={localizeUi(
                      "ui.chat.chatsettingsdrawer.showSceneVideoControlsAndAllowManualVideoGeneration",
                    )}
                    enabled={gameSceneVideosEnabled}
                    onToggle={() =>
                      updateMeta.mutate({
                        id: chat.id,
                        gameSceneVideosEnabled: !gameSceneVideosEnabled,
                      })
                    }
                  />
                </div>
              )}
              {illustratorInstalled && gameSceneVideosEnabled && (
                <AgentSettingsSubsection
                  id="scene-videos"
                  title={localizeUi("ui.chat.chatsettingsdrawer.sceneVideos")}
                  description={localizeUi("ui.chat.chatsettingsdrawer.generateMp4SceneVideosFromGameIllustrations")}
                >
                  <GenerationSettingsLink
                    onClick={openGenerationSettings}
                    title={localizeUi("ui.chat.chatsettingsdrawer.openSettingsGenerations")}
                    label={localizeUi("ui.chat.chatsettingsdrawer.videoGenerationSettings")}
                    description={localizeUi(
                      "ui.chat.chatsettingsdrawer.adjustVideoModelsSizesAndPromptOverridesInSettings",
                    )}
                  />
                  <label className="flex flex-col gap-1">
                    <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                      {localizeUi("ui.chat.chatsettingsdrawer.videoConnection")}
                    </span>
                    <ConnectionSelect
                      job={t("connections.picker.job.video")}
                      value={(metadata.gameVideoConnectionId as string) || null}
                      onChange={(connectionId) =>
                        updateMeta.mutate({ id: chat.id, gameVideoConnectionId: connectionId })
                      }
                      kind="video"
                      defaultLabel={localizeUi("ui.chat.chatsettingsdrawer.selectVideoConnection")}
                      inherits="main"
                    />
                  </label>
                  {videoConnectionsList.length === 0 && <NeedsModelChip kind="video" />}
                  <GamePromptTemplateSelect
                    label={localizeUi("ui.chat.chatsettingsdrawer.gameVideoPrompt")}
                    description={localizeUi("ui.chat.chatsettingsdrawer.usedForGameSceneVideos")}
                    options={gameVideoPromptOptions}
                    selectedId={selectedGameVideoPromptTemplateId}
                    fallbackId={GAME_VIDEO_PROMPT_TEMPLATE_ID}
                    onChange={updateGameVideoPromptSelection}
                  />
                  <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.chat.chatsettingsdrawer.sceneVideosUseTheLatestGeneratedSceneIllustrationAs")}
                  </p>
                </AgentSettingsSubsection>
              )}
            </AgentSettingsCard>
          )}

          {/* Categorized agent sub-sections */}
          {metadata.enableAgents && (
            <>
              {isGame ? (
                <div className="space-y-1.5">
                  {gameAgentPool.length > 0 && (
                    <div className="space-y-1">
                      {gameAgentPool.map((agent) => {
                        const active = activeAgentIds.includes(agent.id);
                        const knowledgeAgentType = isKnowledgeAgentType(agent.id) ? agent.id : null;
                        if (active && agent.id === "hierarchical-maps" && mapsPackage) {
                          return (
                            <div key={agent.id} data-chat-agent-entry={agent.id} className="space-y-1.5">
                              <AgentSettingsCard
                                icon={<MapIcon size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                                title={agent.name}
                                description={worldMapsSettingsDescription}
                              >
                                {renderAgentLorebookAttachment(agent.id)}
                                <CapabilityElement
                                  packageId={mapsPackage.id}
                                  view="settings"
                                  capabilityProps={{
                                    chatId: chat.id,
                                    chatName: chat.name,
                                    chatMode,
                                    debugMode,
                                    enabledForChat: mapsPackageEnabledForChat,
                                    onEnabledForChatChange: setMapsEnabledForChat,
                                    confirmAction: showConfirmDialog,
                                    onDirtyChange: setEditorDirty,
                                    onOpenLorebook: openLorebookFromSettings,
                                    onLorebooksChanged: refreshLorebooks,
                                  }}
                                  className="block overflow-hidden rounded-lg"
                                />
                              </AgentSettingsCard>
                            </div>
                          );
                        }
                        if (active && agent.id === "long-term-memory" && ltmPackage) {
                          return (
                            <div key={agent.id} data-chat-agent-entry={agent.id} className="space-y-1.5">
                              <AgentSettingsCard
                                icon={<Archive size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                                title={agent.name}
                                description={getActiveAgentMenuDescription(agent.description)}
                              >
                                <LongTermMemoryCapabilitySettings
                                  chat={chat}
                                  metadata={metadata}
                                  packageId={ltmPackage.id}
                                  enabledForChat={
                                    metadata.enableAgents === true && activeAgentIds.includes(ltmPackage.id)
                                  }
                                  setLtmEnabledForChat={setLtmEnabledForChat}
                                  requestClose={requestClose}
                                  rememberSettingsReturn={rememberSettingsReturn}
                                />
                              </AgentSettingsCard>
                            </div>
                          );
                        }
                        if (active && agent.id === STORYBOARD_AGENT_ID) {
                          return (
                            <div key={agent.id} data-chat-agent-entry={agent.id} className="space-y-1.5">
                              <AgentSettingsCard
                                icon={renderRoleplayAgentMenuIcon(agent.id)}
                                title={agent.name}
                                description={getActiveAgentMenuDescription(agent.description)}
                              >
                                <Suspense fallback={null}>
                                  <StoryboardChatSettingsPanel
                                    chatId={chat.id}
                                    metadata={metadata as Record<string, unknown>}
                                    onClose={closeForSurface}
                                    ownerMode="game"
                                  />
                                </Suspense>
                              </AgentSettingsCard>
                            </div>
                          );
                        }
                        return (
                          <div key={agent.id} data-chat-agent-entry={agent.id} className="space-y-1.5">
                            <SettingsSwitch
                              label={agent.name}
                              description={getActiveAgentMenuDescription(agent.description) || undefined}
                              checked={active}
                              onChange={(nextActive) => {
                                const latestActiveAgentIds = readLatestActiveAgentIds();
                                if (!nextActive) {
                                  updateMeta.mutate({
                                    id: chat.id,
                                    activeAgentIds: latestActiveAgentIds.filter((id) => id !== agent.id),
                                  });
                                } else {
                                  updateMeta.mutate({
                                    id: chat.id,
                                    enableAgents: true,
                                    activeAgentIds: Array.from(new Set([...latestActiveAgentIds, agent.id])),
                                  });
                                }
                              }}
                              labelPosition="start"
                              className={cn(
                                "justify-between rounded-md px-3 py-2.5 text-left",
                                active
                                  ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                                  : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
                              )}
                              labelClassName="min-w-0 text-xs font-medium [&>span>label]:block [&>span>label]:truncate"
                            />
                            {active && !knowledgeAgentType && renderAgentLorebookAttachment(agent.id)}
                            {active && knowledgeAgentType && (
                              <KnowledgeAgentSettingsCard
                                attachment={renderAgentLorebookAttachment(knowledgeAgentType)}
                                agentType={knowledgeAgentType}
                                title={agent.name}
                                description={getActiveAgentMenuDescription(agent.description)}
                                lorebooks={(lorebooks ?? []) as Lorebook[]}
                                settings={getKnowledgeAgentSourceSettings(knowledgeAgentType)}
                                onChange={(patch) => updateKnowledgeAgentSourceSettings(knowledgeAgentType, patch)}
                              />
                            )}
                            {active && agent.id !== "illustrator" && renderAgentPromptTemplateSelect(agent.id)}
                            {active && agent.id === "illustrator" && (
                              <AgentSettingsCard
                                icon={<Paintbrush size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                                title={agent.name}
                                description={getActiveAgentMenuDescription(agent.description)}
                              >
                                {renderAgentPromptTemplateSelect(agent.id)}
                                {renderIllustratorPromptConnectionSelect()}
                                {renderIllustratorImagesPerGeneration()}
                                <AgentSettingsToggle
                                  label={localizeUi("ui.chat.agentaddsetupfields.attachCardAppearance")}
                                  description={localizeUi(
                                    "ui.chat.agentaddsetupfields.appendMatchedCharacterAppearanceLinesToImagePromptsUsing",
                                  )}
                                  enabled={illustratorIncludeCharacterAppearance}
                                  onToggle={toggleIllustratorCharacterAppearance}
                                  overridden={typeof metadata.illustratorIncludeCharacterAppearance === "boolean"}
                                  onReset={resetIllustratorCharacterAppearance}
                                />
                                <AgentSettingsToggle
                                  label={localizeUi("ui.chat.agentaddsetupfields.sendAvatarReferences")}
                                  description={localizeUi(
                                    "ui.chat.agentaddsetupfields.sendMatchingCharacterAndPersonaAvatarsOrSpritesAs",
                                  )}
                                  enabled={illustratorUseAvatarReferences}
                                  onToggle={toggleIllustratorAvatarReferences}
                                  overridden={typeof metadata.illustratorUseAvatarReferences === "boolean"}
                                  onReset={resetIllustratorAvatarReferences}
                                />
                              </AgentSettingsCard>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {renderActiveCustomAgentSettingsCard()}
                </div>
              ) : (
                <>
                  {/* Approximate per-turn cost of the active agent loadout. */}
                  <div
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[0.6875rem] ring-1",
                      agentLoadCost.cost.level === "high"
                        ? "bg-[var(--primary)]/10 text-[var(--primary)] ring-[var(--primary)]/30"
                        : "bg-[var(--secondary)]/60 text-[var(--primary)] ring-[var(--border)]",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      {agentLoadCost.cost.level === "high" && <AlertTriangle size="0.75rem" className="shrink-0" />}
                      <span className="truncate">
                        ~{agentLoadCost.cost.instructionTokens.toLocaleString()}{" "}
                        {localizeUi("ui.chat.chatsettingsdrawer.tokensOfAgentInstructions")}
                        {" · "}~{agentLoadCost.cost.extraCalls} {localizeUi("ui.chat.chatsettingsdrawer.extraCall")}
                        {agentLoadCost.cost.extraCalls === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s")}
                        {localizeUi("ui.chat.chatsettingsdrawer.turn")}
                      </span>
                    </span>
                    <HelpTooltip
                      text={localizeUi(
                        "ui.chat.chatsettingsdrawer.approximateEachCallAlsoCarriesChatContextRecentMessages",
                        { value1: AGENT_COST_HIGH_CALLS, value2: AGENT_COST_HIGH_TOKENS.toLocaleString() },
                      )}
                      className="-my-2 -mr-2 shrink-0"
                      buttonClassName="h-11 w-11 justify-center"
                      wide
                    />
                  </div>

                  {visibleActiveAgentIds.length === 0 && (
                    <p className="text-[0.6875rem] text-[var(--muted-foreground)] px-1">
                      {localizeUi("ui.chat.chatsettingsdrawer.noAgentsAreActiveForThisChatYetAdd")}
                    </p>
                  )}

                  {/* Agent category sub-sections */}
                  {(
                    [
                      {
                        key: "writer",
                        label: "Writer Agents",
                        icon: <Feather size="0.75rem" />,
                        description:
                          "Improve prose quality, maintain continuity, and shape the narrative direction of your roleplay.",
                      },
                      {
                        key: "tracker",
                        label: "Tracker Agents",
                        icon: <Activity size="0.75rem" />,
                        description:
                          "Automatically track world state, character stats, quests, expressions, and other data that changes over time.",
                      },
                      {
                        key: "misc",
                        label: "Misc Agents",
                        icon: <Puzzle size="0.75rem" />,
                        description:
                          "Specialized utilities — image generation, combat systems, music, summaries, and other extras.",
                      },
                    ] as const
                  ).map((cat) => {
                    const catAgents = availableAgents.filter((a) => a.category === cat.key);
                    const activeInCat = catAgents
                      .filter((agent) => activeAgentIds.includes(agent.id) && !standaloneRoleplayAgentIds.has(agent.id))
                      .sort((a, b) => getRoleplayAgentSettingsOrder(a.id) - getRoleplayAgentSettingsOrder(b.id));
                    const inactiveInCat = catAgents.filter((a) => !activeAgentIds.includes(a.id));
                    if (catAgents.length === 0) return null;
                    return (
                      <AgentCategorySection
                        key={cat.key}
                        label={cat.label}
                        icon={cat.icon}
                        description={cat.description}
                        count={activeInCat.length}
                        openRequest={catAgents.some(
                          (agent) =>
                            !standaloneRoleplayAgentIds.has(agent.id) &&
                            getAgentSettingsMenuId(chat.id, agent.id) === pendingAgentMenuTargetId,
                        )}
                      >
                        {/* Active agents in this category */}
                        {activeInCat.length > 0 && (
                          <div className="flex flex-col gap-1 mb-1.5">
                            {activeInCat.map((agent) => {
                              const tokenEst = agentLoadCost.tokensByType.get(agent.id);
                              const hasSettingsTarget = chatSettingsPackageByAgentId.has(agent.id);
                              return (
                                <div
                                  key={agent.id}
                                  id={hasSettingsTarget ? getAgentSettingsMenuId(chat.id, agent.id) : undefined}
                                  tabIndex={hasSettingsTarget ? -1 : undefined}
                                  data-chat-agent-entry={agent.id}
                                  // The lorebook switch sits under the description with the prompt select's gap.
                                  className="scroll-mt-3 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/60 [&>[data-agent-lorebook-attachment]]:mt-2 [&>[data-agent-lorebook-package-update]]:mt-2"
                                >
                                  <div className="flex items-start gap-2.5">
                                    <Sparkles size="0.875rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex min-w-0 items-center gap-1.5">
                                        <span className="block min-w-0 truncate text-xs">{agent.name}</span>
                                        {tokenEst != null ? (
                                          <span
                                            className="shrink-0 tabular-nums text-[0.625rem] text-[var(--muted-foreground)]"
                                            title={localizeUi(
                                              "ui.chat.chatsettingsdrawer.value1TokensOfAgentInstructionsEstimated",
                                              { value1: tokenEst.toLocaleString() },
                                            )}
                                          >
                                            ~{tokenEst.toLocaleString()}
                                          </span>
                                        ) : null}
                                      </div>
                                      <span className="mt-0.5 block text-[0.625rem] leading-tight text-[var(--muted-foreground)] line-clamp-2">
                                        {agent.id === "hierarchical-maps"
                                          ? worldMapsSettingsDescription
                                          : agent.description}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => {
                                        void toggleAgent(agent.id);
                                      }}
                                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                                      title={localizeUi("ui.chat.chatsettingsdrawer.removeFromChat")}
                                    >
                                      <Trash2 size="0.6875rem" />
                                    </button>
                                  </div>
                                  {cat.key === "tracker" && renderAgentPromptTemplateSelect(agent.id)}
                                  {renderAgentLorebookAttachment(agent.id)}
                                  {renderDownloadedAgentChatSettings(agent)}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {/* Available agents to add */}
                        {inactiveInCat.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {inactiveInCat.map((agent) => (
                              <button
                                key={agent.id}
                                onClick={() => openAgentAddModal(agent)}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)] bg-[var(--secondary)]"
                              >
                                <Plus size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
                                <div className="flex-1 min-w-0">
                                  <span className="block truncate text-xs">{agent.name}</span>
                                  <span className="mt-0.5 block text-[0.625rem] leading-tight text-[var(--muted-foreground)] line-clamp-2">
                                    {agent.description}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[0.625rem] text-[var(--muted-foreground)] px-1">
                            {localizeUi("ui.chat.chatsettingsdrawer.allAgentsInThisCategoryAreActive")}
                          </p>
                        )}
                      </AgentCategorySection>
                    );
                  })}

                  {/* Custom agents */}
                  {renderCustomAgentPicker()}
                </>
              )}
            </>
          )}
          {isGame && renderCustomAgentPicker({ showWhenEmpty: true })}
        </div>
      )}
    </Section>
  );
}
