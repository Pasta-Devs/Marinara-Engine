// Roleplay's face of Agents in Chat Settings: the commands, Trackers Control, the agent library and every agent's
// card. Game has its own face, GameAgentsSection. Its state lives in useChatAgents and the cards it shares with the
// other faces in agent-settings-renderers; it only reads them, so it holds nothing a collapse could lose.
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import {
  AGENT_COST_HIGH_CALLS,
  AGENT_COST_HIGH_TOKENS,
  audioConnectionSupportsGeneration,
  ILLUSTRATOR_VIDEO_MODES,
  type Lorebook,
  normalizeIllustratorVideoMode,
  normalizeVideoFirstFrame,
  REFERENCE_PICTURE_TARGETS,
  ROLEPLAY_DEFAULT_VIDEO_FIRST_FRAME,
  VIDEO_FIRST_FRAMES,
} from "@marinara-engine/shared";
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  Feather,
  Plus,
  Puzzle,
  Radar,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  AgentCategorySection,
  AgentChoiceSelect,
  AgentSettingsActionButton,
  AgentSettingsCard,
  AgentSettingsSegmentedControl,
  AgentSettingsSubsection,
  AgentSettingsTextarea,
  AgentSettingsToggle,
  MediaScopeSelect,
} from "../../../components/chat/AgentSettingsControls";
import { CardEvolutionAuditorSettings } from "./CardEvolutionAuditorSettings";
import { ConnectionSelect } from "../../../components/connections/ConnectionSelect";
import { DirectorSettings } from "./DirectorSettings";
import { EchoChamberSettings } from "./EchoChamberSettings";
import { ExpressionSpriteSettings } from "./ExpressionSpriteSettings";
import { ROLEPLAY_SPOTIFY_KEYS, SpotifySourceSettings } from "./SpotifySourceSettings";
import { HelpTooltip } from "../../../components/ui/HelpTooltip";
import { HoldForRewriteToggle } from "./HoldForRewriteToggle";
import { KnowledgeAgentSettingsCard } from "./KnowledgeAgentSettingsCard";
import { LorebookKeeperSettings } from "./LorebookKeeperSettings";
import { Select } from "../../../components/ui/Select";
import type { MusicProvider } from "../../../components/chat/AgentAddSetupFields";
import { NeedsModelChip } from "../../../components/connections/NeedsModelChip";
import { RoleplayCommandsSettings } from "./RoleplayCommandsSettings";
import { PictureCheckFields } from "../PictureCheckFields";
import { ChatSettingsSection as Section } from "../ChatSettingsSection";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { cn } from "../../../lib/utils";
import { filterAudioGenerationConnections } from "../../../lib/connection-filters";
import { renderRoleplayAgentMenuIcon } from "./roleplay-agent-menu-icon";
import { useUIStore } from "../../../stores/ui.store";
import type { useConnections } from "../../../hooks/use-connections";
import type { CharacterDisplayInfo } from "../../../lib/character-display";
import type { CastCardLike } from "../sections/cast-shared";
import { type AgentSettingsRenderers } from "./agent-settings-renderers";
import {
  type ChatAgents,
  DEFAULT_PROSE_GUARDIAN_AVOID,
  DEFAULT_PROSE_GUARDIAN_BANNED_WORDS,
  getAgentSettingsMenuId,
  type UseChatAgentsOptions,
} from "./use-chat-agents";
import { Spinner } from "../../../components/ui/Spinner";
import {
  AgentSuiteButton,
  EnableAgentsSwitch,
  getMusicProviderLabel,
  NoAgentsDownloaded,
} from "./agents-section-parts";

type RoleplayAgentsSectionProps = Pick<
  UseChatAgentsOptions,
  | "chat"
  | "metadata"
  | "chatMode"
  | "activeAgentIds"
  | "availableAgents"
  | "activeTrackerAgents"
  | "chatCharacters"
  | "charName"
  | "charTitle"
  | "closeForSurface"
  | "lorebooks"
  | "spriteCharacterIds"
  | "updateMeta"
  | "onSpriteVisualSettingsChange"
> & {
  /** useChatAgents' result, which the drawer also reads. */
  agents: ChatAgents;
  /** The render helpers the faces of Agents share. */
  renderers: AgentSettingsRenderers;
  connections: ReturnType<typeof useConnections>["data"];
  activeManualTrackerTypes: Set<string>;
  getCharacterInfo: (c: CastCardLike) => CharacterDisplayInfo;
  initialAgentId: string | null;
  spriteArrangeMode: boolean;
  onToggleSpriteArrange: (() => void) | undefined;
  setShowAgentSuiteModal: (open: boolean) => void;
};

export function RoleplayAgentsSection({
  agents,
  renderers,
  chat,
  metadata,
  chatMode,
  activeAgentIds,
  availableAgents,
  activeTrackerAgents,
  chatCharacters,
  charName,
  charTitle,
  closeForSurface,
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
  setShowAgentSuiteModal,
}: RoleplayAgentsSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const {
    activeGeneration,
    agentLoadCost,
    agentProcessing,
    builtInAgentCards,
    changeMusicDjProvider,
    chatSettingsPackageByAgentId,
    chatSpriteChoicesLoading,
    chatSpriteSubjects,
    chatSpriteSubjectsLoading,
    chatSpriteSubjectsWithSprites,
    commitProseGuardianSettings,
    editedSpritePosition,
    effectiveCustomMusicSource,
    expressionAvatarsEnabled,
    expressionSpriteOpacityPercent,
    expressionSpriteScalePercent,
    fullBodySpriteOpacityPercent,
    fullBodySpriteScalePercent,
    getKnowledgeAgentSourceSettings,
    getRoleplayAgentMenuRemoveHandler,
    getRoleplayAgentSettingsOrder,
    handleLorebookKeeperBackfill,
    handleStopActiveGeneration,
    hasCustomSpritePlacements,
    illustratorAutoBackgroundsEnabled,
    illustratorIncludeCharacterAppearance,
    illustratorInstalled,
    illustratorUseAvatarReferences,
    illustratorReferencePictureTarget,
    lorebookKeeperReadBehindMessages,
    lorebookKeeperTargetLorebookId,
    musicPlayerSource,
    narrativeDirectorSecretPlotEnabled,
    narrativeDirectorSecretPlotRunInterval,
    openAgentAddModal,
    openDownloadAgents,
    pendingAgentMenuTargetId,
    proseGuardianAvoidDraft,
    proseGuardianAvoidInstructions,
    proseGuardianBannedDraft,
    proseGuardianBannedWords,
    proseGuardianHoldForRewrite,
    proseGuardianStyleDraft,
    proseGuardianStyleInstructions,
    resetIllustratorAvatarReferences,
    resetIllustratorCharacterAppearance,
    resetSelectedSpriteCharacterVisualSettings,
    resetSpritePlacements,
    roleplayAgentMenuLinks,
    scrollToAgentMenu,
    secretPlotMessages,
    selectedSpriteCharacterVisualSettings,
    selectedSpriteLayoutCharacterId,
    setExpressionSpriteOpacity,
    setExpressionSpriteScale,
    setFullBodySpriteOpacity,
    setFullBodySpriteScale,
    setProseGuardianAvoidDraft,
    setProseGuardianBannedDraft,
    setProseGuardianStyleDraft,
    setSelectedSpriteLayoutCharacterId,
    setSpotifyArtistDraft,
    setSpriteSide,
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
    toggleIllustratorAutoBackgrounds,
    toggleManualTrackerAgent,
    toggleSprite,
    toggleSpriteDisplayMode,
    updateKnowledgeAgentSourceSettings,
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
      count={visibleActiveAgentIds.length}
      help={localizeUi("ui.chat.chatsettingsdrawer.whenEnabledAiAgentsRunAutomaticallyDuringGenerationTo")}
    >
      <RoleplayCommandsSettings
        chat={chat}
        installedAgentIds={new Set(availableAgents.filter((agent) => !agent.runtimeDisabled).map((agent) => agent.id))}
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
      {availableAgents.length === 0 ? (
        <NoAgentsDownloaded
          modeLabel={localizeUi("ui.chat.chatsettingsdrawer.roleplay")}
          onDownload={openDownloadAgents}
        />
      ) : (
        <div className="space-y-2">
          <EnableAgentsSwitch
            enabled={metadata.enableAgents === true}
            description={
              <span className="block">
                {localizeUi("ui.chat.chatsettingsdrawer.runAiAgentsDuringGenerationWorldStateExpressionsEtc")}
              </span>
            }
            onChange={(enabled) => updateMeta.mutate({ id: chat.id, enableAgents: enabled })}
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
              {metadata.enableAgents && activeTrackerAgents.length > 0 && (
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
              {metadata.enableAgents && activeTrackerAgents.length > 0 && (
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
          {(activeGeneration || stoppingGeneration) && (
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
          <AgentSuiteButton onClick={() => setShowAgentSuiteModal(true)} />

          <div className="flex flex-col gap-2">
            {metadata.enableAgents && builtInAgentCards["lorebook-keeper"].active && (
              <AgentSettingsCard
                id={getAgentSettingsMenuId(chat.id, "lorebook-keeper")}
                icon={renderRoleplayAgentMenuIcon("lorebook-keeper")}
                title={builtInAgentCards["lorebook-keeper"].name}
                description={builtInAgentCards["lorebook-keeper"].description}
                order={getRoleplayAgentSettingsOrder("lorebook-keeper")}
                onRemove={getRoleplayAgentMenuRemoveHandler(
                  "lorebook-keeper",
                  builtInAgentCards["lorebook-keeper"].name,
                )}
              >
                {renderAgentLorebookAttachment("lorebook-keeper")}
                <LorebookKeeperSettings
                  chat={chat}
                  lorebookKeeperTargetLorebookId={lorebookKeeperTargetLorebookId}
                  lorebookKeeperReadBehindMessages={lorebookKeeperReadBehindMessages}
                  lorebooks={lorebooks}
                  agentProcessing={agentProcessing}
                  closeForSurface={closeForSurface}
                  handleLorebookKeeperBackfill={handleLorebookKeeperBackfill}
                />
              </AgentSettingsCard>
            )}

            {metadata.enableAgents && builtInAgentCards["card-evolution-auditor"].active && (
              <AgentSettingsCard
                id={getAgentSettingsMenuId(chat.id, "card-evolution-auditor")}
                icon={renderRoleplayAgentMenuIcon("card-evolution-auditor")}
                title={builtInAgentCards["card-evolution-auditor"].name}
                description={builtInAgentCards["card-evolution-auditor"].description}
                order={getRoleplayAgentSettingsOrder("card-evolution-auditor")}
                onRemove={getRoleplayAgentMenuRemoveHandler(
                  "card-evolution-auditor",
                  builtInAgentCards["card-evolution-auditor"].name,
                )}
              >
                {renderAgentLorebookAttachment("card-evolution-auditor")}
                <CardEvolutionAuditorSettings closeForSurface={closeForSurface} />
              </AgentSettingsCard>
            )}

            {metadata.enableAgents && builtInAgentCards["prose-guardian"].active && (
              <AgentSettingsCard
                id={getAgentSettingsMenuId(chat.id, "prose-guardian")}
                icon={renderRoleplayAgentMenuIcon("prose-guardian")}
                title={builtInAgentCards["prose-guardian"].name}
                description={builtInAgentCards["prose-guardian"].description}
                order={getRoleplayAgentSettingsOrder("prose-guardian")}
                onRemove={getRoleplayAgentMenuRemoveHandler("prose-guardian", builtInAgentCards["prose-guardian"].name)}
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

            {metadata.enableAgents && builtInAgentCards.director.active && (
              <AgentSettingsCard
                id={getAgentSettingsMenuId(chat.id, "director")}
                icon={renderRoleplayAgentMenuIcon("director")}
                title={builtInAgentCards.director.name}
                description={builtInAgentCards.director.description}
                order={getRoleplayAgentSettingsOrder("director")}
                onRemove={getRoleplayAgentMenuRemoveHandler("director", builtInAgentCards.director.name)}
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

            {metadata.enableAgents && builtInAgentCards.continuity.active && (
              <AgentSettingsCard
                id={getAgentSettingsMenuId(chat.id, "continuity")}
                icon={renderRoleplayAgentMenuIcon("continuity")}
                title={builtInAgentCards.continuity.name}
                description={builtInAgentCards.continuity.description}
                order={getRoleplayAgentSettingsOrder("continuity")}
                onRemove={getRoleplayAgentMenuRemoveHandler("continuity", builtInAgentCards.continuity.name)}
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

            {metadata.enableAgents && builtInAgentCards.html.active && (
              <AgentSettingsCard
                id={getAgentSettingsMenuId(chat.id, "html")}
                icon={renderRoleplayAgentMenuIcon("html")}
                title={builtInAgentCards.html.name}
                description={builtInAgentCards.html.description}
                order={getRoleplayAgentSettingsOrder("html")}
                onRemove={getRoleplayAgentMenuRemoveHandler("html", builtInAgentCards.html.name)}
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

            {metadata.enableAgents && builtInAgentCards["knowledge-retrieval"].active && (
              <KnowledgeAgentSettingsCard
                attachment={renderAgentLorebookAttachment("knowledge-retrieval")}
                id={getAgentSettingsMenuId(chat.id, "knowledge-retrieval")}
                agentType="knowledge-retrieval"
                title={builtInAgentCards["knowledge-retrieval"].name}
                description={builtInAgentCards["knowledge-retrieval"].description}
                lorebooks={(lorebooks ?? []) as Lorebook[]}
                settings={getKnowledgeAgentSourceSettings("knowledge-retrieval")}
                order={getRoleplayAgentSettingsOrder("knowledge-retrieval")}
                onChange={(patch) => updateKnowledgeAgentSourceSettings("knowledge-retrieval", patch)}
                onRemove={getRoleplayAgentMenuRemoveHandler(
                  "knowledge-retrieval",
                  builtInAgentCards["knowledge-retrieval"].name,
                )}
              />
            )}

            {metadata.enableAgents && builtInAgentCards["knowledge-router"].active && (
              <KnowledgeAgentSettingsCard
                attachment={renderAgentLorebookAttachment("knowledge-router")}
                id={getAgentSettingsMenuId(chat.id, "knowledge-router")}
                agentType="knowledge-router"
                title={builtInAgentCards["knowledge-router"].name}
                description={builtInAgentCards["knowledge-router"].description}
                lorebooks={(lorebooks ?? []) as Lorebook[]}
                settings={getKnowledgeAgentSourceSettings("knowledge-router")}
                order={getRoleplayAgentSettingsOrder("knowledge-router")}
                onChange={(patch) => updateKnowledgeAgentSourceSettings("knowledge-router", patch)}
                onRemove={getRoleplayAgentMenuRemoveHandler(
                  "knowledge-router",
                  builtInAgentCards["knowledge-router"].name,
                )}
              />
            )}

            {standaloneRoleplayAgents.map(renderStandaloneRoleplayAgentSettingsCard)}

            {metadata.enableAgents && builtInAgentCards.expression.active && (
              <AgentSettingsCard
                id={getAgentSettingsMenuId(chat.id, "expression")}
                icon={renderRoleplayAgentMenuIcon("expression")}
                title={builtInAgentCards.expression.name}
                description={builtInAgentCards.expression.description}
                order={getRoleplayAgentSettingsOrder("expression")}
                onRemove={getRoleplayAgentMenuRemoveHandler("expression", builtInAgentCards.expression.name)}
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
                  onToggleOnlyActiveSprites={() =>
                    updateMeta.mutate({
                      id: chat.id,
                      expressionOnlyActiveSprites: metadata.expressionOnlyActiveSprites !== true,
                    })
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

            {metadata.enableAgents && builtInAgentCards["echo-chamber"].active && (
              <AgentSettingsCard
                id={getAgentSettingsMenuId(chat.id, "echo-chamber")}
                icon={renderRoleplayAgentMenuIcon("echo-chamber")}
                title={builtInAgentCards["echo-chamber"].name}
                description={builtInAgentCards["echo-chamber"].description}
                order={getRoleplayAgentSettingsOrder("echo-chamber")}
                onRemove={getRoleplayAgentMenuRemoveHandler("echo-chamber", builtInAgentCards["echo-chamber"].name)}
              >
                {renderAgentLorebookAttachment("echo-chamber")}
                <EchoChamberSettings
                  promptTemplateSelect={renderAgentPromptTemplateSelect("echo-chamber")}
                  closeForSurface={closeForSurface}
                />
              </AgentSettingsCard>
            )}

            {metadata.enableAgents && builtInAgentCards.illustrator.active && (
              <AgentSettingsCard
                id={getAgentSettingsMenuId(chat.id, "illustrator")}
                icon={renderRoleplayAgentMenuIcon("illustrator")}
                title={builtInAgentCards.illustrator.name}
                description={builtInAgentCards.illustrator.description}
                order={getRoleplayAgentSettingsOrder("illustrator")}
                onRemove={getRoleplayAgentMenuRemoveHandler("illustrator", builtInAgentCards.illustrator.name)}
              >
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
                <PictureCheckFields chatId={chat.id} metadata={metadata} illustrator />
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
                    value={normalizeVideoFirstFrame(metadata.sceneVideoFirstFrame, ROLEPLAY_DEFAULT_VIDEO_FIRST_FRAME)}
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
                {illustratorUseAvatarReferences && (
                  <AgentChoiceSelect
                    label={localizeUi("ui.agents.agenteditor.referencePictureTarget")}
                    description={localizeUi(
                      `ui.agents.agenteditor.referencePictureTargetHelp.${illustratorReferencePictureTarget}`,
                    )}
                    value={illustratorReferencePictureTarget}
                    options={REFERENCE_PICTURE_TARGETS.map((target) => ({
                      value: target,
                      label: localizeUi(`ui.agents.agenteditor.referencePictureTargetOption.${target}`),
                    }))}
                    active
                    onChange={(target) => updateMeta.mutate({ id: chat.id, illustratorReferencePictureTarget: target })}
                    overridden={typeof metadata.illustratorReferencePictureTarget === "string"}
                    onReset={() => updateMeta.mutate({ id: chat.id, illustratorReferencePictureTarget: null })}
                  />
                )}
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
                    description={localizeUi("ui.chat.chatsettingsdrawer.generateManualMp4SceneVideosFromGalleryImages")}
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

            {metadata.enableAgents && builtInAgentCards.spotify.active && (
              <AgentSettingsCard
                id={getAgentSettingsMenuId(chat.id, "spotify")}
                icon={renderRoleplayAgentMenuIcon("spotify")}
                title={builtInAgentCards.spotify.name}
                description={builtInAgentCards.spotify.description}
                order={getRoleplayAgentSettingsOrder("spotify")}
                onRemove={getRoleplayAgentMenuRemoveHandler("spotify", builtInAgentCards.spotify.name)}
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

          {/* Haptic Feedback */}
          {renderHapticSettingsCard()}

          {/* Categorized agent sub-sections */}
          {metadata.enableAgents && (
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
        </div>
      )}
    </Section>
  );
}
