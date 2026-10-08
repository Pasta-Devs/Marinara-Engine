// ──────────────────────────────────────────────
// Chat: Gallery — per-chat image gallery (a Chat Settings drawer)
// ──────────────────────────────────────────────
import { useMemo } from "react";
import { ChatGallery } from "./ChatGallery";
import {
  BUILT_IN_AGENTS,
  customAgentHasCapability,
  isAgentConfigDeleted,
  parseAgentSettingsRecord,
  type Chat,
} from "@marinara-engine/shared";
import { useAgentConfigs } from "../../hooks/use-agents";
import { useCapabilityAgentRegistry, useInstalledCapabilityPackages } from "../../hooks/use-capability-packages";
import { useChatGalleryActions } from "../../hooks/use-chat-gallery-actions";
import { parseChatMetadata } from "../../lib/chat-display";

type GalleryChatMetadata = Chat["metadata"] & {
  imageGenConnectionId?: string | null;
  enableSpriteGeneration?: boolean;
};

/** The gallery for one chat, with the generate actions its chat surface offers. */
export function ChatGalleryPanel({ chat }: { chat: Chat }) {
  const {
    onIllustrate,
    onIllustrateWithAgent,
    onGenerateSelfie,
    selfieCharacters,
    onGenerateBackground,
    onGenerateStoryboard,
    onViewStoryboard,
    onGenerateVideo,
    onAnimateImage,
  } = useChatGalleryActions(chat.id) ?? {};
  const chatMetadata = useMemo(() => parseChatMetadata(chat.metadata) as GalleryChatMetadata, [chat.metadata]);
  const { data: installedCapabilities = [] } = useInstalledCapabilityPackages();
  const { data: capabilityAgents = [] } = useCapabilityAgentRegistry();
  const { data: agentConfigs = [] } = useAgentConfigs();
  const illustratorInstalled = installedCapabilities.some(
    (item) => item.id === "illustrator" && item.status === "active",
  );
  const conversationSelfieToggle = chatMetadata.conversationCommandToggles?.selfie;
  const conversationSelfiesEnabled =
    chatMetadata.characterCommands !== false &&
    conversationSelfieToggle !== false &&
    (conversationSelfieToggle === true || !!chatMetadata.imageGenConnectionId);
  const illustratorEnabledForChat =
    chat.mode === "conversation"
      ? conversationSelfiesEnabled
      : chat.mode === "game"
        ? chatMetadata.enableSpriteGeneration === true
        : chatMetadata.enableAgents === true && chatMetadata.activeAgentIds?.includes("illustrator");
  const illustratorAvailable = illustratorInstalled && illustratorEnabledForChat;
  // Roleplay Illustrate and Background are one-off runs: an installed Illustrator need not be added to the chat.
  const manualIllustratorAvailable = illustratorInstalled && (chat.mode === "roleplay" || illustratorEnabledForChat);
  const customImageAgents = useMemo(() => {
    if (chatMetadata.enableAgents !== true || !onIllustrateWithAgent) return [];
    const activeAgentIds = new Set(chatMetadata.activeAgentIds ?? []);
    const reservedAgentIds = new Set([
      ...BUILT_IN_AGENTS.map((agent) => agent.id),
      ...capabilityAgents.map((agent) => agent.id),
    ]);
    return agentConfigs
      .filter(
        (agent) =>
          activeAgentIds.has(agent.type) &&
          !reservedAgentIds.has(agent.type) &&
          !isAgentConfigDeleted(agent.settings) &&
          customAgentHasCapability(parseAgentSettingsRecord(agent.settings), "trigger_image_generation"),
      )
      .map((agent) => ({ id: agent.type, name: agent.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [agentConfigs, capabilityAgents, chatMetadata.activeAgentIds, chatMetadata.enableAgents, onIllustrateWithAgent]);

  return (
    <ChatGallery
      chatId={chat.id}
      mode={chat.mode}
      onIllustrate={manualIllustratorAvailable ? onIllustrate : undefined}
      illustrateAgents={customImageAgents}
      onIllustrateWithAgent={onIllustrateWithAgent}
      onGenerateSelfie={illustratorAvailable ? onGenerateSelfie : undefined}
      selfieCharacters={selfieCharacters}
      onGenerateStoryboard={onGenerateStoryboard}
      onViewStoryboard={onViewStoryboard}
      onGenerateVideo={illustratorAvailable ? onGenerateVideo : undefined}
      onAnimateImage={illustratorAvailable ? onAnimateImage : undefined}
      onGenerateBackground={manualIllustratorAvailable ? onGenerateBackground : undefined}
    />
  );
}
