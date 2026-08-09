import type { ComponentType } from "react";
import { Gamepad2, MessageSquare, Theater, type LucideProps } from "lucide-react";
import type { ChatMode } from "@marinara-engine/shared";

export const CHAT_MODE_ICON_COMPONENTS = {
  conversation: MessageSquare,
  roleplay: Theater,
  game: Gamepad2,
} satisfies Record<ChatMode, ComponentType<LucideProps>>;

type ChatModeIconProps = LucideProps & {
  mode: ChatMode;
};

export function ChatModeIcon({ mode, ...props }: ChatModeIconProps) {
  const Icon = CHAT_MODE_ICON_COMPONENTS[mode];
  return <Icon data-chat-mode-icon={mode} {...props} />;
}
