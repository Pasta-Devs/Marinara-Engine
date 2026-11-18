// Game's face of Agents in Chat Settings: sequential tasks, the scene connection, the Game-only agent cards and
// the game's agent list. Roleplay has its own face, RoleplayAgentsSection. Its state lives in useChatAgents and
// the cards it shares with the other faces in agent-settings-renderers; it only reads them.
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { GAME_VIDEO_PROMPT_TEMPLATE_ID, type Lorebook, STORYBOARD_AGENT_ID } from "@marinara-engine/shared";
import { Archive, BookOpen, Image, MapIcon, Music2, Paintbrush, Sparkles } from "lucide-react";
import {
  AgentSettingsCard,
  AgentSettingsSegmentedControl,
  AgentSettingsSubsection,
  AgentSettingsToggle,
  GamePromptTemplateSelect,
  GenerationSettingsLink,
} from "../../../components/chat/AgentSettingsControls";
import { CapabilityElement } from "../../../components/capabilities/CapabilityElement";
import { ConnectionSelect } from "../../../components/connections/ConnectionSelect";
import { GAME_SPOTIFY_KEYS, SpotifySourceSettings } from "./SpotifySourceSettings";
import { KnowledgeAgentSettingsCard } from "./KnowledgeAgentSettingsCard";
import { LongTermMemoryCapabilitySettings } from "./LongTermMemorySettings";
import { MacroTextarea } from "../../../components/ui/MacroTextarea";
import type { MusicProvider } from "../../../components/chat/AgentAddSetupFields";
import { NeedsModelChip } from "../../../components/connections/NeedsModelChip";
import { ChatSettingsSection as Section } from "../ChatSettingsSection";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { Suspense } from "react";
import { cn } from "../../../lib/utils";
import { isKnowledgeAgentType } from "./knowledge-agent-settings";
import { renderRoleplayAgentMenuIcon } from "./roleplay-agent-menu-icon";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import type { useConnections } from "../../../hooks/use-connections";
import { type AgentSettingsRenderers, StoryboardChatSettingsPanel } from "./agent-settings-renderers";
import {
  type ChatAgents,
  getActiveAgentMenuDescription,
  getAgentSettingsMenuId,
  type UseChatAgentsOptions,
} from "./use-chat-agents";
import {
  AgentSuiteButton,
  EnableAgentsSwitch,
  getMusicProviderLabel,
  NoAgentsDownloaded,
} from "./agents-section-parts";

type GameAgentsSectionProps = Pick<
  UseChatAgentsOptions,
  | "chat"
  | "metadata"
  | "chatMode"
  | "activeAgentIds"
  | "availableAgents"
  | "closeForSurface"
  | "gameLorebookKeeperEnabled"
  | "gameSetupConfig"
  | "lorebooks"
  | "updateMeta"
> & {
  /** useChatAgents' result, which the drawer also reads. */
  agents: ChatAgents;
  /** The render helpers the faces of Agents share. */
  renderers: AgentSettingsRenderers;
  connections: ReturnType<typeof useConnections>["data"];
  initialAgentId: string | null;
  requestClose: () => Promise<boolean>;
  rememberSettingsReturn: () => void;
  setShowAgentSuiteModal: (open: boolean) => void;
};

export function GameAgentsSection({
  agents,
  renderers,
  chat,
  metadata,
  chatMode,
  activeAgentIds,
  availableAgents,
  closeForSurface,
  gameLorebookKeeperEnabled,
  gameSetupConfig,
  lorebooks,
  updateMeta,
  connections,
  initialAgentId,
  requestClose,
  rememberSettingsReturn,
  setShowAgentSuiteModal,
}: GameAgentsSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const {
    builtInAgentCards,
    campaignArtStyleDraft,
    changeMusicDjProvider,
    commitCampaignArtStyle,
    commitGameImagePromptInstructions,
    debugMode,
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
    illustratorIncludeCharacterAppearance,
    illustratorInstalled,
    illustratorUseAvatarReferences,
    ltmPackage,
    mapsPackage,
    mapsPackageEnabledForChat,
    musicPlayerSource,
    openDownloadAgents,
    openGenerationSettings,
    openLorebookFromSettings,
    readLatestActiveAgentIds,
    refreshLorebooks,
    resetIllustratorAvatarReferences,
    resetIllustratorCharacterAppearance,
    selectedGameVideoPromptTemplateId,
    setCampaignArtStyleDraft,
    setEditorDirty,
    setGameImagePromptInstructionsDraft,
    setGameSpotifyArtistDraft,
    setLtmEnabledForChat,
    setMapsEnabledForChat,
    spotifyPlaylistsQuery,
    toggleGameLorebookKeeper,
    toggleGameMusicDj,
    toggleIllustratorAvatarReferences,
    toggleIllustratorCharacterAppearance,
    updateGameVideoPromptSelection,
    updateKnowledgeAgentSourceSettings,
    useCampaignArtStyle,
    videoConnectionsList,
    worldMapsSettingsDescription,
  } = agents;
  const {
    renderReviewAgentOutputsToggle,
    renderIllustratorPromptConnectionSelect,
    renderIllustratorImageStyleSelect,
    renderIllustratorImagesPerGeneration,
    renderAgentLorebookAttachment,
    avatarLayoutCard,
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
      count={gameAgentFeatureCount}
      help={localizeUi("ui.chat.chatsettingsdrawer.whenEnabledAiAgentsRunAutomaticallyDuringGenerationTo")}
    >
      <SettingsSwitch
        label={localizeUi("chat.settings.game.sequentialTasks")}
        description={localizeUi("chat.settings.game.sequentialTasksHelp")}
        checked={metadata.gameSequentialAgents === true}
        onChange={(gameSequentialAgents) => updateMeta.mutate({ id: chat.id, gameSequentialAgents })}
        labelPosition="start"
        className="justify-between rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-left"
        labelClassName="text-xs font-medium"
      />
      {availableAgents.length === 0 ? (
        <NoAgentsDownloaded modeLabel={localizeUi("ui.chat.chatsettingsdrawer.game")} onDownload={openDownloadAgents} />
      ) : (
        <div className="space-y-2">
          {metadata.enableAgents && (
            <p className="px-1 text-[0.625rem] text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.chatsettingsdrawer.toggleSceneAnalysisAndCustomAgentsForThisGame")}
            </p>
          )}
          <EnableAgentsSwitch
            enabled={metadata.enableAgents === true}
            description={
              <>
                <span className="block">
                  {localizeUi("ui.chat.chatsettingsdrawer.runSceneAnalysisAndAnyAttachedCustomAgentsDuring")}
                </span>
                {metadata.enableAgents &&
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
            onChange={(enabled) => updateMeta.mutate({ id: chat.id, enableAgents: enabled })}
          />
          {renderReviewAgentOutputsToggle("secondary")}
          <AgentSuiteButton onClick={() => setShowAgentSuiteModal(true)} />
          {metadata.enableAgents && (
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

          <AgentSettingsCard
            icon={<BookOpen size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
            title={builtInAgentCards["lorebook-keeper"].name}
            description={builtInAgentCards["lorebook-keeper"].description}
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

          <AgentSettingsCard
            icon={<Music2 size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
            title={builtInAgentCards.spotify.name}
            description={builtInAgentCards.spotify.description}
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

          {avatarLayoutCard}

          {/* Haptic Feedback */}
          {renderHapticSettingsCard()}

          {/* Illustrator */}
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
                <label className="flex flex-col gap-1">
                  <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                    {localizeUi("ui.chat.chatsettingsdrawer.imageConnection")}
                  </span>
                  <ConnectionSelect
                    job={t("connections.picker.job.images")}
                    value={(metadata.gameImageConnectionId as string) || null}
                    onChange={(connectionId) => updateMeta.mutate({ id: chat.id, gameImageConnectionId: connectionId })}
                    kind="image"
                    defaultLabel={localizeUi("ui.chat.chatsettingsdrawer.selectImageConnection")}
                    inherits="main"
                  />
                </label>
                {renderIllustratorImageStyleSelect({
                  emptyOptionLabel: "Use global or connection default",
                })}
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
                    onChange={(connectionId) => updateMeta.mutate({ id: chat.id, gameVideoConnectionId: connectionId })}
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

          {/* Categorized agent sub-sections */}
          {metadata.enableAgents && (
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
                              enabledForChat={metadata.enableAgents === true && activeAgentIds.includes(ltmPackage.id)}
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
          )}
          {renderCustomAgentPicker({ showWhenEmpty: true })}
        </div>
      )}
    </Section>
  );
}
