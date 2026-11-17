// The pieces both faces of Agents in Chat Settings draw: agent cards, the Illustrator and prompt pickers, the custom
// agent and Haptic cards and the custom music library. Plain render functions over the Agents hook's result, called on
// each render as they were inside the drawer, so no input in them remounts.
import { Suspense, lazy } from "react";
import type { useTranslation } from "react-i18next";
import { Camera, FolderOpen, Plus, RefreshCw, Settings2, Sparkles, Trash2 } from "lucide-react";
import { STORYBOARD_AGENT_ID, customAgentHasCapability, parseAgentSettingsRecord } from "@marinara-engine/shared";
import {
  AgentCategorySection,
  AgentDefaultStatus,
  AgentSettingsCard,
  AgentSettingsToggle,
} from "../../../components/chat/AgentSettingsControls";
import {
  MusicFolderScope,
  normalizeCustomMusicExternalFolder,
  type CustomMusicSource,
} from "../../../components/chat/AgentAddSetupFields";
import { AvatarLayoutSettings } from "../../../components/chat/AvatarLayoutSettings";
import { CapabilityElement } from "../../../components/capabilities/CapabilityElement";
import { ConnectionSelect } from "../../../components/connections/ConnectionSelect";
import { NeedsModelChip, agentModelNeed } from "../../../components/connections/NeedsModelChip";
import { DraftNumberInput } from "../../../components/ui/DraftNumberInput";
import { Select } from "../../../components/ui/Select";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { cn } from "../../../lib/utils";
import { useUIStore } from "../../../stores/ui.store";
import { type ChatConnectionOption } from "../sections/ConnectionSection";
import { AgentLorebookAttachment } from "./AgentLorebookAttachment";
import { AgentPromptTemplateSelect } from "./AgentPromptTemplateSelect";
import { HapticSettings } from "./HapticSettings";
import {
  IllustratorImageConnectionSelect,
  IllustratorImageStyleSelect,
  IllustratorImagesPerGeneration,
  IllustratorPromptConnectionSelect,
  IllustratorRunIntervalField,
} from "./IllustratorControls";
import { LongTermMemoryCapabilitySettings } from "./LongTermMemorySettings";
import { renderRoleplayAgentMenuIcon } from "./roleplay-agent-menu-icon";
import {
  getActiveAgentMenuDescription,
  getAgentSettingsMenuId,
  normalizePositiveInteger,
  type AvailableAgent,
  type ChatAgents,
  type UseChatAgentsOptions,
} from "./use-chat-agents";

export const StoryboardChatSettingsPanel = lazy(() => import("../StoryboardChatSettingsPanel"));
const BeholderChatSettingsPanel = lazy(() => import("../BeholderChatSettingsPanel"));

const DEFAULT_CUSTOM_LOREBOOK_BACKFILL_CHUNK_SIZE = 25;
const MAX_CUSTOM_LOREBOOK_BACKFILL_CHUNK_SIZE = 100;

function customAgentCanBackfillLorebooks(agent: AvailableAgent, settings: Record<string, unknown>): boolean {
  if (agent.phase !== "post_processing") return false;
  const canEdit = customAgentHasCapability(settings, "edit_lorebooks");
  const canCreate = customAgentHasCapability(settings, "create_lorebooks");
  const enabledTools = Array.isArray(settings.enabledTools) ? settings.enabledTools : [];
  return (
    (canEdit && (settings.lorebookWriteEnabled === true || enabledTools.includes("save_lorebook_entry"))) ||
    (settings.resultType === "lorebook_update" && (canEdit || canCreate))
  );
}

function customLorebookBackfillChunkSize(settings: Record<string, unknown>): number {
  const value = settings.lorebookBackfillChunkSize;
  return normalizePositiveInteger(
    typeof value === "string" ? Number(value) : value,
    DEFAULT_CUSTOM_LOREBOOK_BACKFILL_CHUNK_SIZE,
    MAX_CUSTOM_LOREBOOK_BACKFILL_CHUNK_SIZE,
  );
}

/** What the renderers read from the drawer, besides the Agents hook's result. */
export type AgentSettingsRendererValues = Pick<
  UseChatAgentsOptions,
  | "chat"
  | "metadata"
  | "chatMode"
  | "isGame"
  | "activeAgentIds"
  | "availableAgents"
  | "agentConfigsByType"
  | "avatarLayout"
  | "updateMeta"
  | "closeForSurface"
> & {
  chatGenerationConnectionsList: ChatConnectionOption[];
  sidecarModelDownloaded: boolean;
  requestClose: () => Promise<boolean>;
  rememberSettingsReturn: () => void;
  t: ReturnType<typeof useTranslation>["t"];
  localizeUi: ReturnType<typeof useTranslation>["t"];
};

export type AgentSettingsRenderers = ReturnType<typeof createAgentSettingsRenderers>;

export function createAgentSettingsRenderers(agents: ChatAgents, drawer: AgentSettingsRendererValues) {
  const {
    chat,
    metadata,
    chatMode,
    isGame,
    activeAgentIds,
    availableAgents,
    agentConfigsByType,
    avatarLayout,
    updateMeta,
    closeForSurface,
    chatGenerationConnectionsList,
    sidecarModelDownloaded,
    requestClose,
    rememberSettingsReturn,
    t,
    localizeUi,
  } = drawer;
  const {
    activeCustomAgents,
    agentLoadCost,
    agentProcessing,
    agentPromptTemplateSelections,
    agentWriteApprovalRequired,
    avatarLayoutActive,
    avatarSettingsOrder,
    characterMusicFolder,
    chatCustomMusicFolder,
    chatMusicFolder,
    chatSettingsPackageByAgentId,
    customAgentImageSelections,
    customAgentSettingsOrder,
    customAgents,
    customMusicFolder,
    customMusicSource,
    debugMode,
    effectiveCustomMusicSource,
    getDefaultPromptTemplateIdForAgent,
    getPromptOptionsForAgent,
    getRoleplayAgentMenuRemoveHandler,
    getRoleplayAgentSettingsOrder,
    handleBackfillCustomAgent,
    handleRerunCustomAgent,
    handleSnapshotCustomAgent,
    hapticActive,
    hapticAgentMeta,
    illustratorChatRunInterval,
    illustratorChatVideoRunInterval,
    illustratorConfig,
    illustratorImageConnectionId,
    illustratorImagesPerGeneration,
    illustratorPromptConnectionId,
    illustratorRunInterval,
    illustratorVideoRunInterval,
    imageStyleProfiles,
    inactiveCustomAgents,
    isImageCapableCustomAgent,
    ltmPackage,
    mapsPackage,
    mapsPackageEnabledForChat,
    musicFolderCharacter,
    musicFolderInUse,
    musicFolderTarget,
    openAgentAddModal,
    openLorebookFromSettings,
    refreshLorebooks,
    saveCustomMusicExternalFolder,
    saveCustomMusicFolder,
    selectCustomMusicExternalFolder,
    setEditorDirty,
    setLtmEnabledForChat,
    setMapsEnabledForChat,
    setMusicFolderTargetChoice,
    targetMusicFolder,
    toggleAgent,
    updateAgentConfig,
    updateAgentPromptTemplateSelection,
    updateCustomAgentBackfillSettings,
    updateCustomAgentImageConnection,
    updateCustomAgentImageStyle,
    updateCustomMusicLibrary,
    worldMapsSettingsDescription,
  } = agents;
  const renderDownloadedAgentChatSettings = (
    agent: { id: string; name: string; description: string },
    className = "mt-2 block overflow-hidden rounded-lg",
  ) => {
    if (agent.id === "hierarchical-maps" || agent.id === "long-term-memory") return null;
    const capabilityPackage = chatSettingsPackageByAgentId.get(agent.id);
    if (!capabilityPackage) return null;
    return (
      <CapabilityElement
        packageId={capabilityPackage.id}
        view="settings"
        capabilityProps={{
          chatId: chat.id,
          chatMode,
          debugMode,
          agent,
          connections: chatGenerationConnectionsList,
          onDirtyChange: setEditorDirty,
          confirmAction: showConfirmDialog,
        }}
        className={className}
      />
    );
  };
  const renderReviewAgentOutputsToggle = (surface: "card" | "secondary") => (
    <AgentSettingsToggle
      label={localizeUi("ui.chat.chatsettingsdrawer.reviewAgentOutputs")}
      description={
        agentWriteApprovalRequired
          ? localizeUi("ui.chat.chatsettingsdrawer.lorebookSummaryCharacterCardUpdatesAndReviewableWriterAgent")
          : localizeUi("ui.chat.chatsettingsdrawer.lorebookAndSummaryUpdatesCanBeCommittedAutomaticallyCharacter")
      }
      enabled={agentWriteApprovalRequired}
      surface={surface}
      onToggle={() =>
        updateMeta.mutate({
          id: chat.id,
          agentWriteApprovalRequired: !agentWriteApprovalRequired,
        })
      }
    />
  );
  const renderIllustratorPromptConnectionSelect = () => (
    <IllustratorPromptConnectionSelect
      chat={chat}
      connectionId={illustratorPromptConnectionId}
      includeLocalSidecar={!isGame && sidecarModelDownloaded}
    />
  );
  const renderIllustratorImageConnectionSelect = () => (
    <IllustratorImageConnectionSelect
      chat={chat}
      connectionId={illustratorImageConnectionId}
      agentSettings={illustratorConfig?.settings}
    />
  );
  const renderIllustratorImageStyleSelect = (options: { emptyOptionLabel?: string; description?: string } = {}) => (
    <IllustratorImageStyleSelect
      chat={chat}
      styleProfileId={(metadata.imageStyleProfileId as string) ?? ""}
      emptyOptionLabel={options.emptyOptionLabel}
      description={options.description}
    />
  );
  const renderIllustratorImagesPerGeneration = () => (
    <IllustratorImagesPerGeneration chat={chat} value={illustratorImagesPerGeneration} />
  );
  const renderIllustratorRunInterval = () => (
    <IllustratorRunIntervalField
      chat={chat}
      kind="image"
      value={illustratorRunInterval}
      overridden={illustratorChatRunInterval !== null}
    />
  );
  const renderIllustratorVideoRunInterval = () => (
    <IllustratorRunIntervalField
      chat={chat}
      kind="video"
      value={illustratorVideoRunInterval}
      overridden={illustratorChatVideoRunInterval !== null}
    />
  );

  const renderAgentLorebookAttachment = (agentType: string) => {
    const agent = availableAgents.find((entry) => entry.id === agentType);
    if (!agent || (agent.builtIn && agent.category !== "writer" && agent.category !== "tracker")) return null;
    if (agentType === "hierarchical-maps") {
      const api = mapsPackage?.manifest.schemaVersion === 2 ? mapsPackage.manifest.capabilityApi : null;
      if (!api || api.major < 1 || (api.major === 1 && api.minor < 380)) {
        return (
          <p data-agent-lorebook-package-update={agentType} className="text-xs text-[var(--muted-foreground)]">
            {localizeUi("chat.agentLorebook.packageUpdateRequired")}
          </p>
        );
      }
    }
    return <AgentLorebookAttachment chatId={chat.id} agentType={agentType} />;
  };

  const avatarLayoutCard =
    avatarLayoutActive && avatarLayout ? (
      <AgentSettingsCard
        id={getAgentSettingsMenuId(chat.id, "avatars")}
        icon={renderRoleplayAgentMenuIcon("avatars")}
        title={localizeUi("avatars.setup.title")}
        description={localizeUi("avatars.layout.description")}
        order={isGame ? undefined : avatarSettingsOrder}
      >
        <AvatarLayoutSettings chatId={chat.id} layout={avatarLayout} />
      </AgentSettingsCard>
    ) : null;

  const renderStandaloneRoleplayAgentSettingsCard = (agent: (typeof availableAgents)[number]) => {
    let settings: React.ReactNode;

    if (agent.id === "hierarchical-maps" && mapsPackage) {
      settings = (
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
          className="block overflow-hidden"
        />
      );
    } else if (agent.id === "long-term-memory" && ltmPackage) {
      settings = (
        <LongTermMemoryCapabilitySettings
          chat={chat}
          metadata={metadata}
          packageId={ltmPackage.id}
          enabledForChat={metadata.enableAgents === true && activeAgentIds.includes(ltmPackage.id)}
          setLtmEnabledForChat={setLtmEnabledForChat}
          requestClose={requestClose}
          rememberSettingsReturn={rememberSettingsReturn}
          className="block overflow-hidden"
        />
      );
    } else if (agent.id === STORYBOARD_AGENT_ID) {
      settings = (
        <Suspense fallback={null}>
          <StoryboardChatSettingsPanel
            chatId={chat.id}
            metadata={metadata as Record<string, unknown>}
            onClose={closeForSurface}
            ownerMode="roleplay"
          />
        </Suspense>
      );
    } else if (agent.id === "beholder") {
      settings = (
        <Suspense fallback={null}>
          <BeholderChatSettingsPanel
            chatId={chat.id}
            onOpenAgentSettings={() => {
              void requestClose().then((closed) => {
                if (closed) {
                  rememberSettingsReturn();
                  useUIStore.getState().openAgentDetail("beholder");
                }
              });
            }}
          />
        </Suspense>
      );
    } else {
      settings = renderDownloadedAgentChatSettings(agent, "block overflow-hidden");
    }

    if (!settings) return null;
    return (
      <AgentSettingsCard
        key={agent.id}
        id={getAgentSettingsMenuId(chat.id, agent.id)}
        icon={renderRoleplayAgentMenuIcon(agent.id)}
        title={agent.name}
        description={
          agent.id === "hierarchical-maps"
            ? worldMapsSettingsDescription
            : getActiveAgentMenuDescription(agent.description)
        }
        order={getRoleplayAgentSettingsOrder(agent.id)}
        onRemove={getRoleplayAgentMenuRemoveHandler(agent.id, agent.name)}
      >
        {renderAgentLorebookAttachment(agent.id)}
        {settings}
      </AgentSettingsCard>
    );
  };
  const renderAgentPromptTemplateSelect = (agentId: string) => (
    <AgentPromptTemplateSelect
      options={getPromptOptionsForAgent(agentId)}
      selectedId={agentPromptTemplateSelections[agentId] ?? getDefaultPromptTemplateIdForAgent(agentId)}
      overridden={typeof agentPromptTemplateSelections[agentId] === "string"}
      onChange={(promptTemplateId) => updateAgentPromptTemplateSelection(agentId, promptTemplateId)}
    />
  );

  const renderCustomMusicLibrarySettings = (surface: "game" | "roleplay") => (
    <div className="space-y-2">
      <MusicFolderScope
        target={musicFolderTarget}
        character={musicFolderCharacter}
        inUse={musicFolderInUse}
        showInUse={effectiveCustomMusicSource === "folder"}
        canUseDefault={!!chatMusicFolder}
        canUnlink={!!characterMusicFolder}
        onTargetChange={(target) => setMusicFolderTargetChoice({ chatId: chat.id, target })}
        onUseDefault={() => void saveCustomMusicExternalFolder("chat", "")}
        onUnlink={() => void saveCustomMusicExternalFolder("character", "")}
      />
      {musicFolderTarget === "default" && (
        <div className="flex flex-col gap-1">
          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.chatsettingsdrawer.customMusicSource")}
          </span>
          <Select<CustomMusicSource>
            label={localizeUi("ui.chat.chatsettingsdrawer.customMusicSource")}
            value={customMusicSource}
            options={[
              { value: "game-assets", label: localizeUi("game.toolbar.assets") },
              { value: "folder", label: localizeUi("ui.chat.musicdjsetupfields.folderOnThisDevice") },
            ]}
            onChange={(value) => void updateCustomMusicLibrary({ customMusicSource: value })}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)]"
          />
        </div>
      )}

      {musicFolderTarget !== "default" || customMusicSource === "folder" ? (
        <div className="flex flex-col gap-1">
          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.agents.agenteditor.musicFolderOnThisDevice")}
          </span>
          <div className="flex flex-col gap-2 @lg:flex-row">
            <input
              key={`${chat.id}-${surface}-custom-music-folder-${musicFolderTarget}-${targetMusicFolder}`}
              defaultValue={targetMusicFolder}
              onBlur={(event) => {
                const folder = normalizeCustomMusicExternalFolder(event.target.value);
                if (folder !== targetMusicFolder) void saveCustomMusicExternalFolder(musicFolderTarget, folder);
              }}
              placeholder={localizeUi("ui.agents.agenteditor.noFolderSelected")}
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
            />
            <button
              type="button"
              onClick={() => void selectCustomMusicExternalFolder(musicFolderTarget)}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
            >
              <FolderOpen size="0.75rem" />
              {localizeUi("ui.chat.musicdjsetupfields.chooseFolder")}
            </button>
          </div>
          <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.musicdjsetupfields.musicDjWillChooseFromAudioFilesInThis")}
          </span>
        </div>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.agents.agenteditor.gameAssetsMusicFolder")}
          </span>
          <input
            key={`${chat.id}-${surface}-custom-music-${customMusicFolder}`}
            defaultValue={customMusicFolder}
            onBlur={(event) => saveCustomMusicFolder("default", event.target.value)}
            placeholder={localizeUi("ui.agents.agenteditor.music")}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
          />
          <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.musicdjsetupfields.readsLocalAudioFromGameAssetsForExample")} <code>music</code>{" "}
            {localizeUi("ui.noodle.noodlehome.or")} <code>music/combat</code>.
          </span>
        </label>
      )}
      {/* This chat's own Game Assets subfolder (#8916), while the chat plays Game Assets. */}
      {musicFolderTarget === "chat" && effectiveCustomMusicSource === "game-assets" && (
        <label className="flex flex-col gap-1">
          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.agents.agenteditor.gameAssetsMusicFolder")}
          </span>
          <input
            key={`${chat.id}-${surface}-chat-custom-music-${chatCustomMusicFolder}`}
            defaultValue={chatCustomMusicFolder}
            onBlur={(event) => saveCustomMusicFolder("chat", event.target.value)}
            placeholder={customMusicFolder}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50"
          />
          <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.musicdjsetupfields.gameAssetsMusicFolderForThisChatOnly")}
          </span>
        </label>
      )}
    </div>
  );

  const renderCustomAgentPicker = ({ showWhenEmpty = false }: { showWhenEmpty?: boolean } = {}) => {
    if (customAgents.length === 0 && !showWhenEmpty) return null;
    return (
      <AgentCategorySection
        label={localizeUi("ui.panels.agentspanel.customAgents")}
        icon={<Settings2 size="0.75rem" />}
        description={localizeUi("ui.chat.chatsettingsdrawer.addYourCustomCreatedAgentsToThisChat")}
        count={activeCustomAgents.length}
      >
        {inactiveCustomAgents.length > 0 ? (
          <div className="flex flex-col gap-1">
            {inactiveCustomAgents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => openAgentAddModal(agent)}
                className="flex items-center gap-2.5 rounded-lg bg-[var(--secondary)] px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
              >
                <Plus size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs">{agent.name}</span>
                  <span className="mt-0.5 block text-[0.625rem] leading-tight text-[var(--muted-foreground)] line-clamp-2">
                    {agent.description}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : customAgents.length === 0 ? (
          <div className="space-y-2 px-1">
            <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.chatsettingsdrawer.noCustomAgentsAreAvailableYetCreateOneIn")}
            </p>
            <button
              type="button"
              onClick={() => {
                closeForSurface();
                const ui = useUIStore.getState();
                ui.openRightPanel("agents");
                ui.openAgentDetail("__new__");
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-2 text-[0.6875rem] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
            >
              <Plus size="0.75rem" />
              {localizeUi("ui.chat.chatsettingsdrawer.createCustomAgent")}
            </button>
          </div>
        ) : (
          <p className="px-1 text-[0.625rem] text-[var(--muted-foreground)]">
            {isGame && !metadata.enableAgents
              ? localizeUi("ui.chat.chatsettingsdrawer.allCustomAgentsAreAlreadyAttachedEnableAgentsTo")
              : localizeUi("ui.chat.chatsettingsdrawer.allCustomAgentsAreActiveConfigureThemBelowThe")}
          </p>
        )}
      </AgentCategorySection>
    );
  };

  const renderActiveCustomAgentSettingsCard = () => {
    if (!metadata.enableAgents || activeCustomAgents.length === 0) return null;
    return (
      <AgentSettingsCard
        id={getAgentSettingsMenuId(chat.id, "custom-agents")}
        icon={renderRoleplayAgentMenuIcon("custom-agents")}
        title={localizeUi("ui.panels.agentspanel.customAgents")}
        description={localizeUi("ui.chat.chatsettingsdrawer.configureCustomAgentsCurrentlyAttachedToThisChat")}
        order={customAgentSettingsOrder}
      >
        <div className="space-y-3">
          {activeCustomAgents.map((agent) => {
            const agentConfig = agentConfigsByType.get(agent.id);
            const agentSettings = parseAgentSettingsRecord(agentConfig?.settings);
            const backfillAvailable = customAgentCanBackfillLorebooks(agent, agentSettings);
            const backfillEnabled = backfillAvailable && agentSettings.lorebookBackfillEnabled === true;
            const backfillChunkSize = customLorebookBackfillChunkSize(agentSettings);
            const tokenEst = agentLoadCost.tokensByType.get(agent.id);
            const imageCapable = isImageCapableCustomAgent(agent.id);
            const agentImageConnectionId = customAgentImageSelections[agent.id]?.imageConnectionId ?? "";
            const agentImageStyleProfileId = customAgentImageSelections[agent.id]?.styleProfileId ?? "";
            const agentImageStyleProfileMissing =
              agentImageStyleProfileId.length > 0 &&
              !imageStyleProfiles.profiles.some((profile) => profile.id === agentImageStyleProfileId);
            return (
              // No box per agent: its toggles sit on the card like every other agent menu's; a rule separates agents.
              <div
                key={agent.id}
                className="space-y-2 border-t border-[var(--border)] pt-3 first:border-t-0 first:pt-0"
              >
                <div className="flex items-start gap-2.5">
                  <Sparkles size="0.875rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="block min-w-0 truncate text-xs font-medium">{agent.name}</span>
                      {tokenEst != null ? (
                        <span
                          className="shrink-0 tabular-nums text-[0.625rem] text-[var(--muted-foreground)]"
                          title={localizeUi("ui.chat.chatsettingsdrawer.value1TokensOfAgentInstructionsEstimated", {
                            value1: tokenEst.toLocaleString(),
                          })}
                        >
                          ~{tokenEst.toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                    <span className="mt-0.5 block text-[0.625rem] leading-tight text-[var(--muted-foreground)] line-clamp-2">
                      {agent.description}
                    </span>
                    <NeedsModelChip
                      kind={imageCapable ? "image" : null}
                      own={agentImageConnectionId || agentModelNeed(agent.id, agentConfig?.settings)?.own}
                      className="mt-1"
                    />
                  </div>
                  <button
                    onClick={() => {
                      void handleRerunCustomAgent(agent.id);
                    }}
                    disabled={agentProcessing}
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors",
                      agentProcessing
                        ? "cursor-not-allowed opacity-40"
                        : "hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]",
                    )}
                    title={localizeUi("ui.chat.chatsettingsdrawer.reRunValue1OnTheLastMessage", {
                      value1: agent.name,
                    })}
                  >
                    <RefreshCw size="0.6875rem" className={cn(agentProcessing && "animate-spin")} />
                  </button>
                  {imageCapable && (
                    <button
                      onClick={() => {
                        void handleSnapshotCustomAgent(agent.id);
                      }}
                      disabled={agentProcessing}
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors",
                        agentProcessing
                          ? "cursor-not-allowed opacity-40"
                          : "hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]",
                      )}
                      title={localizeUi("ui.chat.chatsettingsdrawer.generateAnImageWithValue1Now", {
                        value1: agent.name,
                      })}
                    >
                      <Camera size="0.6875rem" />
                    </button>
                  )}
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
                {renderAgentPromptTemplateSelect(agent.id)}
                {renderAgentLorebookAttachment(agent.id)}
                {backfillAvailable && agentConfig && (
                  <div className="space-y-2">
                    <AgentSettingsToggle
                      label={localizeUi("ui.agents.agenteditor.enableChunkedBackfill")}
                      description={localizeUi("ui.agents.agenteditor.enableChunkedBackfillDescription")}
                      enabled={backfillEnabled}
                      onToggle={() =>
                        void updateCustomAgentBackfillSettings(agent.id, {
                          lorebookBackfillEnabled: !backfillEnabled,
                          lorebookBackfillChunkSize: backfillChunkSize,
                        })
                      }
                    />
                    {backfillEnabled && (
                      <div className="flex flex-col gap-2 rounded-lg bg-[var(--background)]/45 px-2.5 py-2 ring-1 ring-[var(--border)] @lg:flex-row @lg:items-end">
                        <label className="min-w-0 flex-1 text-[0.625rem] text-[var(--muted-foreground)]">
                          <span className="mb-1 block font-medium text-[var(--foreground)]">
                            {localizeUi("ui.agents.agenteditor.backfillChunkSize")}
                          </span>
                          <DraftNumberInput
                            value={backfillChunkSize}
                            min={1}
                            max={MAX_CUSTOM_LOREBOOK_BACKFILL_CHUNK_SIZE}
                            disabled={updateAgentConfig.isPending}
                            onCommit={(lorebookBackfillChunkSize) =>
                              void updateCustomAgentBackfillSettings(agent.id, { lorebookBackfillChunkSize })
                            }
                            ariaLabel={localizeUi("ui.agents.agenteditor.backfillChunkSize")}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs tabular-nums text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void handleBackfillCustomAgent(agent.id)}
                          disabled={agentProcessing}
                          className={cn(
                            "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[0.6875rem] font-medium transition-colors",
                            agentProcessing
                              ? "cursor-not-allowed bg-[var(--muted)] text-[var(--muted-foreground)]"
                              : "bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/15",
                          )}
                        >
                          <RefreshCw size="0.75rem" className={cn(agentProcessing && "animate-spin")} />
                          {localizeUi("ui.chat.customAgentBackfill.nextChunk")}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {imageCapable && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                      {localizeUi("ui.chat.chatsettingsdrawer.imageConnection")}
                    </span>
                    <ConnectionSelect
                      job={t("connections.picker.job.images")}
                      aria-label={localizeUi("ui.chat.chatsettingsdrawer.imageConnection")}
                      value={agentImageConnectionId || null}
                      onChange={(connectionId) => updateCustomAgentImageConnection(agent.id, connectionId ?? "")}
                      kind="image"
                      defaultLabel={localizeUi("ui.chat.chatsettingsdrawer.agentDefault")}
                      inherits="agents"
                    />
                    <AgentDefaultStatus
                      overridden={agentImageConnectionId.length > 0}
                      onReset={() => updateCustomAgentImageConnection(agent.id, "")}
                    />
                    <span className="mt-1 text-[0.625rem] font-medium text-[var(--foreground)]">
                      {localizeUi("ui.chat.chatsettingsdrawer.imageStyle")}
                    </span>
                    <Select
                      label={localizeUi("ui.chat.chatsettingsdrawer.imageStyle")}
                      value={agentImageStyleProfileId}
                      options={[
                        { value: "", label: localizeUi("ui.chat.chatsettingsdrawer.chatDefault") },
                        ...(agentImageStyleProfileMissing
                          ? [
                              {
                                value: agentImageStyleProfileId,
                                label: localizeUi("ui.chat.chatsettingsdrawer.missingStyleProfile"),
                              },
                            ]
                          : []),
                        ...imageStyleProfiles.profiles.map((profile) => ({ value: profile.id, label: profile.name })),
                      ]}
                      onChange={(value) => updateCustomAgentImageStyle(agent.id, value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
                    />
                    <AgentDefaultStatus
                      overridden={agentImageStyleProfileId.length > 0 && !agentImageStyleProfileMissing}
                      onReset={() => updateCustomAgentImageStyle(agent.id, "")}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </AgentSettingsCard>
    );
  };

  const renderHapticSettingsCard = () => {
    if (!metadata.enableAgents || !hapticActive) return null;

    return (
      <AgentSettingsCard
        id={getAgentSettingsMenuId(chat.id, "haptic")}
        icon={renderRoleplayAgentMenuIcon("haptic")}
        title={hapticAgentMeta.name}
        description={hapticAgentMeta.description}
        order={getRoleplayAgentSettingsOrder("haptic")}
        onRemove={getRoleplayAgentMenuRemoveHandler("haptic", hapticAgentMeta.name)}
      >
        {renderAgentLorebookAttachment("haptic")}
        <HapticSettings chat={chat} metadata={metadata} />
      </AgentSettingsCard>
    );
  };
  return {
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
  };
}
