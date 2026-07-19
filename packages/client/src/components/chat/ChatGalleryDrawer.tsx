// ──────────────────────────────────────────────
// Chat: Gallery Drawer — per-chat image gallery
// ──────────────────────────────────────────────
import { Image, X } from "lucide-react";
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { cn } from "../../lib/utils";
import { ChatGallery } from "./ChatGallery";
import {
  ROLEPLAY_POPOVER_CLOSE_BUTTON,
  ROLEPLAY_POPOVER_CLOSE_ICON_SIZE,
  ROLEPLAY_POPOVER_HEADER,
  ROLEPLAY_POPOVER_SCROLL_AREA,
  ROLEPLAY_POPOVER_SHELL,
  ROLEPLAY_POPOVER_TITLE,
} from "./roleplay-popover-styles";
import type { Chat } from "@marinara-engine/shared";
import type { ChatImage } from "../../hooks/use-gallery";
import { useInstalledCapabilityPackages } from "../../hooks/use-capability-packages";
import { isDesktopShellNavigationTarget } from "../../lib/chat-floating-ui-events";
import { parseChatMetadata } from "../../lib/chat-display";

interface ChatGalleryDrawerProps {
  chat: Chat;
  open: boolean;
  onClose: () => void;
  anchor?: { right: number; top: number } | null;
  /** Manually trigger the Illustrator agent */
  onIllustrate?: () => void | Promise<void>;
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
  onGenerateSelfie,
  selfieCharacters,
  onGenerateBackground,
  onGenerateStoryboard,
  onViewStoryboard,
  onGenerateVideo,
  onAnimateImage,
}: ChatGalleryDrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const chatMetadata = useMemo(
    () => parseChatMetadata(chat.metadata) as GalleryChatMetadata,
    [chat.metadata],
  );
  const { data: installedCapabilities = [] } = useInstalledCapabilityPackages(open);
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
        : chatMetadata.enableAgents === true &&
          chatMetadata.activeAgentIds?.includes("illustrator");
  const illustratorAvailable = illustratorInstalled && illustratorEnabledForChat;

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (isDesktopShellNavigationTarget(target)) return;
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
    ? {
        right: `max(${anchor.right}px, calc(var(--mari-chat-ui-inset-right, 0px) + 0.75rem))`,
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
          ROLEPLAY_POPOVER_SHELL,
          "mari-chat-gallery-drawer fixed bottom-3 z-[70] flex w-[min(44rem,calc(100vw-var(--mari-chat-ui-inset-left,0px)-var(--mari-chat-ui-inset-right,0px)-1.5rem))] flex-col overflow-hidden max-md:inset-x-2 max-md:bottom-[calc(0.75rem+env(safe-area-inset-bottom))] max-md:top-[calc(3.5rem+env(safe-area-inset-top))] max-md:w-auto",
          anchor ? "" : "right-[calc(var(--mari-chat-ui-inset-right,0px)+0.75rem)] top-14",
        )}
        style={panelStyle}
      >
        {/* Header */}
        <div className={cn(ROLEPLAY_POPOVER_HEADER, "flex items-center justify-between")}>
          <h3 className={ROLEPLAY_POPOVER_TITLE}>
            <Image size="0.8125rem" className="shrink-0 text-[var(--muted-foreground)]" />
            Gallery
          </h3>
          <button type="button" onClick={onClose} aria-label="Close gallery" className={ROLEPLAY_POPOVER_CLOSE_BUTTON}>
            <X size={ROLEPLAY_POPOVER_CLOSE_ICON_SIZE} />
          </button>
        </div>

        <div className={cn(ROLEPLAY_POPOVER_SCROLL_AREA, "flex-1 overflow-y-auto")}>
          <ChatGallery
            chatId={chat.id}
            mode={chat.mode}
            onIllustrate={illustratorAvailable ? onIllustrate : undefined}
            onGenerateSelfie={illustratorAvailable ? onGenerateSelfie : undefined}
            selfieCharacters={selfieCharacters}
            onGenerateStoryboard={illustratorAvailable ? onGenerateStoryboard : undefined}
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
