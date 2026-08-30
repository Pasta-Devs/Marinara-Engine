// ──────────────────────────────────────────────
// Chat: Gallery Drawer — per-chat image gallery
// ──────────────────────────────────────────────
import { Image, X } from "lucide-react";
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { cn } from "../../lib/utils";
import { ChatGallery } from "./ChatGallery";
import {
  NEUTRAL_PANEL_CLOSE_BUTTON,
  NEUTRAL_PANEL_CLOSE_ICON_SIZE,
  NEUTRAL_PANEL_HEADER,
  NEUTRAL_PANEL_SCROLL_AREA,
  NEUTRAL_PANEL_SHELL,
  NEUTRAL_PANEL_TITLE,
} from "../ui/neutral-surface-styles";
import {
  BUILT_IN_AGENTS,
  customAgentHasCapability,
  isAgentConfigDeleted,
  parseAgentSettingsRecord,
  type Chat,
} from "@marinara-engine/shared";
import type { ChatImage } from "../../hooks/use-gallery";
import { useAgentConfigs } from "../../hooks/use-agents";
import { useCapabilityAgentRegistry, useInstalledCapabilityPackages } from "../../hooks/use-capability-packages";
import { isDesktopShellNavigationTarget } from "../../lib/chat-floating-ui-events";
import { parseChatMetadata } from "../../lib/chat-display";
import {
  getChatFloatingPanelDesktopRight,
  isChatToolbarPanelTrigger,
  type ChatToolbarFloatingPanelAnchor,
} from "./ChatToolbarControls";
import { useTranslation as useUiTranslation } from "react-i18next";

interface ChatGalleryDrawerProps {
  chat: Chat;
  open: boolean;
  onClose: () => void;
  anchor?: ChatToolbarFloatingPanelAnchor;
  /** Manually trigger the Illustrator agent */
  onIllustrate?: () => void | Promise<void>;
  /** Manually trigger an active custom image-generation agent. */
  onIllustrateWithAgent?: (agentType: string) => void | Promise<void>;
  /** Generate an on-demand Conversation selfie. */
  onGenerateSelfie?: (characterId?: string) => void | Promise<void>;
  selfieCharacters?: Array<{ id: string; name: string }>;
  /** Run Illustrator in its background prompt mode. */
  onGenerateBackground?: () => void | Promise<void>;
  /** Generate a storyboard for the latest completed Game Mode GM turn. */
  onGenerateStoryboard?: () => void | Promise<void>;
  /** Show the latest Game Mode storyboard viewer. */
  onViewStoryboard?: () => void;
  /** Generate a scene video from the latest illustration. */
  onGenerateVideo?: () => void | Promise<void>;
  /** Generate a scene video from a specific gallery illustration. */
  onAnimateImage?: (image: ChatImage) => void | Promise<void>;
}

type GalleryChatMetadata = Chat["metadata"] & {
  imageGenConnectionId?: string | null;
  enableSpriteGeneration?: boolean;
};

export function ChatGalleryDrawer({
  chat,
  open,
  onClose,
  anchor,
  onIllustrate,
  onIllustrateWithAgent,
  onGenerateSelfie,
  selfieCharacters,
  onGenerateBackground,
  onGenerateStoryboard,
  onViewStoryboard,
  onGenerateVideo,
  onAnimateImage,
}: ChatGalleryDrawerProps) {
  const { t: localizeUi } = useUiTranslation();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const chatMetadata = useMemo(() => parseChatMetadata(chat.metadata) as GalleryChatMetadata, [chat.metadata]);
  const { data: installedCapabilities = [] } = useInstalledCapabilityPackages(open);
  const { data: capabilityAgents = [] } = useCapabilityAgentRegistry(open);
  const { data: agentConfigs = [] } = useAgentConfigs(open);
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

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (isDesktopShellNavigationTarget(target)) return;
      if (isChatToolbarPanelTrigger(target, "gallery")) return;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-chat-floating-panel]")) return;
      onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [onClose, open]);

  if (!open) return null;
  const panelStyle: CSSProperties | undefined = anchor
    ? typeof window !== "undefined" && window.innerWidth < 768
      ? {
          right: `${anchor.right}px`,
          top: `${anchor.top}px`,
        }
      : {
          right: getChatFloatingPanelDesktopRight(anchor),
          top: `${anchor.top}px`,
        }
    : undefined;

  return (
    <>
      {/* Floating panel */}
      <div
        ref={panelRef}
        data-chat-floating-panel
        className={cn(
          NEUTRAL_PANEL_SHELL,
          "mari-chat-gallery-drawer fixed bottom-3 z-[70] flex w-[min(44rem,calc(100vw-var(--mari-chat-ui-inset-left,0px)-var(--mari-chat-ui-inset-right,0px)-1.5rem))] flex-col overflow-hidden max-md:inset-x-2 max-md:bottom-[calc(0.75rem+var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom)))] max-md:top-[calc(3.5rem+env(safe-area-inset-top))] max-md:w-auto",
          anchor ? "" : "right-[calc(var(--mari-chat-ui-inset-right,0px)+0.75rem)] top-14",
        )}
        style={panelStyle}
      >
        {/* Header */}
        <div className={cn(NEUTRAL_PANEL_HEADER, "flex items-center justify-between")}>
          <h3 className={NEUTRAL_PANEL_TITLE}>
            <Image size="0.8125rem" className="shrink-0 text-[var(--muted-foreground)]" />
            {localizeUi("chat.toolbar.gallery")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={localizeUi("ui.chat.chatgallerydrawer.closeGallery")}
            className={NEUTRAL_PANEL_CLOSE_BUTTON}
          >
            <X size={NEUTRAL_PANEL_CLOSE_ICON_SIZE} />
          </button>
        </div>

        <div className={cn(NEUTRAL_PANEL_SCROLL_AREA, "flex-1 overflow-y-auto")}>
          <ChatGallery
            chatId={chat.id}
            mode={chat.mode}
            onIllustrate={illustratorAvailable ? onIllustrate : undefined}
            illustrateAgents={customImageAgents}
            onIllustrateWithAgent={onIllustrateWithAgent}
            onGenerateSelfie={illustratorAvailable ? onGenerateSelfie : undefined}
            selfieCharacters={selfieCharacters}
            onGenerateStoryboard={onGenerateStoryboard}
            onViewStoryboard={onViewStoryboard}
            onGenerateVideo={illustratorAvailable ? onGenerateVideo : undefined}
            onAnimateImage={illustratorAvailable ? onAnimateImage : undefined}
            onGenerateBackground={illustratorAvailable ? onGenerateBackground : undefined}
          />
        </div>
      </div>
    </>
  );
}
