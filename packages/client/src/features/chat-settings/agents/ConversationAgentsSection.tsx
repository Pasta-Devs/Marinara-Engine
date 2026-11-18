// Conversation's face of Agents in Chat Settings: the Commands, Illustrator, Calls and Long-Term Memory cards and the
// schedule preferences. Its state lives in useChatAgents, and the render helpers it shares with the Roleplay and Game
// face in agent-settings-renderers.
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { Archive, Image, Puzzle, Sparkles } from "lucide-react";
import { VIDEO_FIRST_FRAMES, normalizeVideoFirstFrame, type Chat } from "@marinara-engine/shared";
import { ChatSettingsSection as Section } from "../ChatSettingsSection";
import { PictureCheckFields } from "../PictureCheckFields";
import { type ChatConnectionOption } from "../sections/ConnectionSection";
import {
  AgentSettingsCard,
  AgentSettingsToggle,
  GenerationSettingsLink,
  MediaScopeSelect,
} from "../../../components/chat/AgentSettingsControls";
import { CapabilityElement } from "../../../components/capabilities/CapabilityElement";
import { ConnectionSelect } from "../../../components/connections/ConnectionSelect";
import { NeedsModelChip } from "../../../components/connections/NeedsModelChip";
import { HelpTooltip } from "../../../components/ui/HelpTooltip";
import { useUpdateChatMetadata } from "../../../hooks/use-chats";
import { Select } from "../../../components/ui/Select";
import { cn } from "../../../lib/utils";
import { ConversationCommandsSettings } from "./ConversationCommandsSettings";
import { LongTermMemoryCapabilitySettings, LongTermMemoryEnableSwitch } from "./LongTermMemorySettings";
import { getAgentSettingsMenuId, type ChatAgents } from "./use-chat-agents";
import type { AgentSettingsRenderers } from "./agent-settings-renderers";

interface ConversationAgentsSectionProps {
  /** useChatAgents' result, which the drawer also reads. */
  agents: ChatAgents;
  chat: Chat;
  metadata: Record<string, unknown>;
  activeAgentIds: string[];
  textConnectionsList: ChatConnectionOption[];
  requestClose: () => Promise<boolean>;
  rememberSettingsReturn: () => void;
  /** The render helpers the faces of Agents share. */
  renderers: AgentSettingsRenderers;
}

export function ConversationAgentsSection({
  agents,
  chat,
  metadata,
  activeAgentIds,
  textConnectionsList,
  requestClose,
  rememberSettingsReturn,
  renderers,
}: ConversationAgentsSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const updateMeta = useUpdateChatMetadata();
  const {
    renderAgentLorebookAttachment,
    renderIllustratorPromptConnectionSelect,
    renderIllustratorImageStyleSelect,
    renderIllustratorImagesPerGeneration,
    renderIllustratorVideoRunInterval,
    renderCustomAgentPicker,
    renderActiveCustomAgentSettingsCard,
    renderHapticSettingsCard,
  } = renderers;
  const {
    hasConversationCommands,
    conversationCommandsEnabled,
    conversationCommandToggles,
    availableConversationCommandOptions,
    illustratorInstalled,
    openGenerationSettings,
    selfieFeatureEnabled,
    toggleConversationSelfies,
    selfieSettingsOpen,
    selfieConnectionId,
    imageSelfieWidth,
    imageSelfieHeight,
    videoConnectionsList,
    selfieUseAvatarReferences,
    selfieIncludeCharacterAppearance,
    callsPackage,
    callsSettingsOpen,
    setChatSettingsSectionExpanded,
    callsSettingsMenuId,
    ltmPackage,
    setLtmEnabledForChat,
    scheduleGenerationPreferences,
    setScheduleGenerationPreferences,
  } = agents;
  return (
    <Section
      id="conversation-agents"
      label={localizeUi("navigation.topbar.agents")}
      icon={<Sparkles size="0.875rem" />}
      help={localizeUi("ui.chat.chatsettingsdrawer.configureConversationCommandsCustomAgentsAndSettingsSuppliedBy")}
    >
      <div className="space-y-3">
        {hasConversationCommands && (
          <div className="space-y-3">
            <AgentSettingsCard
              id={getAgentSettingsMenuId(chat.id, "conversation-commands")}
              icon={<Puzzle size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
              title={localizeUi("ui.chat.chatsettingsdrawer.commands")}
              description={localizeUi(
                "ui.chat.chatsettingsdrawer.allowModelsToInteractWithYouThroughInstalledCommands",
              )}
              initialOpen={false}
            >
              <ConversationCommandsSettings
                chat={chat}
                conversationCommandsEnabled={conversationCommandsEnabled}
                conversationCommandToggles={conversationCommandToggles}
                availableConversationCommandOptions={availableConversationCommandOptions}
              />
            </AgentSettingsCard>

            {illustratorInstalled && (
              <AgentSettingsCard
                id={getAgentSettingsMenuId(chat.id, "illustrator")}
                icon={<Image size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                title={localizeUi("ui.chat.chatsettingsdrawer.illustratorSettings")}
                description={localizeUi(
                  "ui.chat.chatsettingsdrawer.configureIllustratorSSelfieCommandImageConnectionPromptModel",
                )}
                initialOpen={false}
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
                  label={localizeUi("ui.chat.chatsettingsdrawer.generatedSelfies")}
                  description={localizeUi(
                    "ui.chat.chatsettingsdrawer.enableIllustratorSSelfiesCommandForThisConversation",
                  )}
                  enabled={selfieFeatureEnabled}
                  onToggle={toggleConversationSelfies}
                />

                {selfieSettingsOpen ? (
                  <div className="space-y-2 border-t border-[var(--border)]/60 pt-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                        {localizeUi("ui.chat.chatsettingsdrawer.selfieConnection")}
                      </span>
                      <ConnectionSelect
                        job={t("connections.picker.job.selfies")}
                        value={selfieConnectionId || null}
                        onChange={(connectionId) =>
                          updateMeta.mutate({ id: chat.id, imageGenConnectionId: connectionId })
                        }
                        kind="image"
                        defaultLabel={localizeUi("ui.chat.chatsettingsdrawer.noneSelfiesDisabled")}
                      />
                    </label>
                    {renderIllustratorPromptConnectionSelect()}
                    {renderIllustratorImageStyleSelect()}
                    {renderIllustratorImagesPerGeneration()}
                    <p className="text-[0.55rem] text-[var(--muted-foreground)]">
                      {localizeUi("ui.chat.chatsettingsdrawer.usedForCharacterSelfiesWhenCommandsAreEnabledThe")}
                    </p>

                    {selfieConnectionId ? (
                      <div className="mt-2 space-y-1">
                        <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                          {localizeUi("ui.connections.videogenerationdefaultspanel.resolution")}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { label: "512x512", w: 512, h: 512 },
                            { label: "512x768", w: 512, h: 768 },
                            { label: "768x768", w: 768, h: 768 },
                            { label: "768x1024", w: 768, h: 1024 },
                            { label: "896x1152", w: 896, h: 1152 },
                            { label: "1024x1024", w: 1024, h: 1024 },
                          ].map((opt) => {
                            const current =
                              (metadata.selfieResolution as string) ?? `${imageSelfieWidth}x${imageSelfieHeight}`;
                            const val = `${opt.w}x${opt.h}`;
                            const active = current === val;
                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() => updateMeta.mutate({ id: chat.id, selfieResolution: val })}
                                className={cn(
                                  "rounded-md px-2 py-1 text-[0.625rem] font-medium transition-colors",
                                  active
                                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                                    : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                                )}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed border-[var(--border)] px-2.5 py-2 text-[0.59375rem] leading-snug text-[var(--muted-foreground)]">
                        {localizeUi("ui.chat.chatsettingsdrawer.chooseASelfieConnectionToLetCharactersGenerateSelfie")}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-[var(--border)] px-2.5 py-2 text-[0.59375rem] leading-snug text-[var(--muted-foreground)]">
                    {localizeUi("ui.chat.chatsettingsdrawer.turnOnSelfiesToRevealConnectionPromptModelImage")}
                  </p>
                )}

                <div className="space-y-2 border-t border-[var(--border)]/60 pt-3">
                  <span className="block text-[0.6875rem] font-semibold text-[var(--foreground)]">
                    {localizeUi("ui.chat.chatsettingsdrawer.videoMessages")}
                  </span>
                  <AgentSettingsToggle
                    label={localizeUi("ui.chat.chatsettingsdrawer.generatedVideos")}
                    description={localizeUi("ui.chat.chatsettingsdrawer.generatedVideosConversationHelp")}
                    enabled={conversationCommandsEnabled && conversationCommandToggles.video === true}
                    onToggle={() => {
                      const nextEnabled = !(conversationCommandsEnabled && conversationCommandToggles.video === true);
                      updateMeta.mutate({
                        id: chat.id,
                        ...(nextEnabled ? { characterCommands: true } : {}),
                        conversationCommandToggles: { ...conversationCommandToggles, video: nextEnabled },
                      });
                    }}
                  />
                  {conversationCommandsEnabled &&
                    conversationCommandToggles.video === true &&
                    renderIllustratorVideoRunInterval()}
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
                      defaultLabel={localizeUi("ui.chat.chatsettingsdrawer.defaultVideoConnection")}
                      inherits="main"
                    />
                  </label>
                  <div className="flex flex-col gap-1">
                    <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                      {localizeUi("ui.chat.chatsettingsdrawer.videoFirstFrame")}
                    </span>
                    <Select
                      label={localizeUi("ui.chat.chatsettingsdrawer.videoFirstFrame")}
                      value={normalizeVideoFirstFrame(metadata.sceneVideoFirstFrame)}
                      options={VIDEO_FIRST_FRAMES.map((mode) => ({
                        value: mode,
                        // Send Avatar References for videos gives Prompt only the avatar to start from.
                        label: localizeUi(
                          mode === "prompt_only" && metadata.selfieVideoUseAvatarReferences === true
                            ? "ui.chat.chatsettingsdrawer.videoFirstFrame.prompt_only_avatar"
                            : `ui.chat.chatsettingsdrawer.videoFirstFrame.${mode}`,
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
                  {videoConnectionsList.length === 0 && <NeedsModelChip kind="video" />}
                  <p className="text-[0.55rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.chat.chatsettingsdrawer.videoMessagesHelp")}
                  </p>
                </div>

                <div className="space-y-2 border-t border-[var(--border)]/60 pt-3">
                  <MediaScopeSelect
                    label={localizeUi("ui.chat.agentaddsetupfields.sendAvatarReferences")}
                    description={localizeUi("ui.chat.chatsettingsdrawer.conversationAvatarReferencesScopeHelp")}
                    images={selfieUseAvatarReferences}
                    videos={metadata.selfieVideoUseAvatarReferences === true}
                    onChange={({ images, videos }) =>
                      updateMeta.mutate({
                        id: chat.id,
                        selfieUseAvatarReferences: images,
                        selfieVideoUseAvatarReferences: videos,
                      })
                    }
                  />
                  <MediaScopeSelect
                    label={localizeUi("ui.chat.agentaddsetupfields.attachCardAppearance")}
                    description={localizeUi("ui.chat.chatsettingsdrawer.characterAppearanceScopeHelp")}
                    images={selfieIncludeCharacterAppearance}
                    videos={metadata.selfieVideoIncludeCharacterAppearance === true}
                    onChange={({ images, videos }) =>
                      updateMeta.mutate({
                        id: chat.id,
                        selfieIncludeCharacterAppearance: images,
                        selfieVideoIncludeCharacterAppearance: videos,
                      })
                    }
                  />
                  <PictureCheckFields chatId={chat.id} metadata={metadata} />
                </div>
              </AgentSettingsCard>
            )}

            {callsPackage ? (
              <CapabilityElement
                packageId={callsPackage.id}
                view="settings"
                capabilityProps={{
                  chatId: chat.id,
                  metadata,
                  connections: textConnectionsList,
                  expanded: callsSettingsOpen,
                  onExpandedChange: (expanded: boolean) =>
                    setChatSettingsSectionExpanded(callsSettingsMenuId, expanded),
                  updateMetadata: (patch: Record<string, unknown>) => updateMeta.mutate({ id: chat.id, ...patch }),
                }}
                className="block"
              />
            ) : null}

            {ltmPackage ? (
              <AgentSettingsCard
                icon={<Archive size="0.75rem" className="mt-0.5 text-[var(--primary)]" />}
                title={localizeUi("ui.chat.chatsettingsdrawer.longTermMemory")}
                description={localizeUi("ui.chat.chatsettingsdrawer.enableLongTermMemoryForThisConversation")}
              >
                <LongTermMemoryEnableSwitch
                  enabledForChat={metadata.enableAgents === true && activeAgentIds.includes(ltmPackage.id)}
                  setLtmEnabledForChat={setLtmEnabledForChat}
                />
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
            ) : null}

            {/* Schedule generation preferences — free-form authorial guidance */}
            <label className="flex flex-col gap-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                {localizeUi("ui.chat.chatsettingsdrawer.scheduleGenerationPreferences")}
                <HelpTooltip
                  text={localizeUi("ui.chat.chatsettingsdrawer.freeFormGuidanceThatSteersHowCharacterSchedulesAre")}
                />
              </span>
              <textarea
                value={scheduleGenerationPreferences}
                onChange={(e) => setScheduleGenerationPreferences(e.target.value)}
                placeholder={localizeUi("ui.chat.chatsettingsdrawer.eGMakeEveryoneGoToSleepBeforeMidnight")}
                className="min-h-[5rem] resize-y rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-2.5 text-[0.6875rem] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50 placeholder:text-[var(--muted-foreground)]/40"
              />
              <p className="text-[0.59375rem] text-[var(--muted-foreground)]/70">
                {localizeUi("ui.chat.chatsettingsdrawer.globalSettingAppliesToEveryConversationChatSNext")}
              </p>
            </label>

            {/* Active schedule-generation preference indicator */}
            {scheduleGenerationPreferences.trim() && (
              <div
                className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3 py-2.5"
                title={scheduleGenerationPreferences.trim()}
              >
                <div className="min-w-0 flex-1">
                  <span className="block text-[0.6875rem] font-medium leading-snug text-[var(--foreground)]">
                    {localizeUi("ui.chat.chatsettingsdrawer.scheduleGenerationPreferenceActive")}
                  </span>
                  <p className="mt-0.5 truncate text-[0.625rem] italic text-[var(--muted-foreground)]">
                    "{scheduleGenerationPreferences.trim()}"
                  </p>
                  <p className="mt-1 text-[0.59375rem] text-[var(--muted-foreground)]/70">
                    {localizeUi("ui.chat.chatsettingsdrawer.willBeAppliedTheNextTimeSchedulesAreRegenerated")}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        {renderCustomAgentPicker()}
        {renderActiveCustomAgentSettingsCard()}
        {renderHapticSettingsCard()}
      </div>
    </Section>
  );
}
