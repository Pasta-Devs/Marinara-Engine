import type { ChatMode } from "@marinara-engine/shared";
import { CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { requestChatHelp } from "../../lib/chat-help-events";
import { useUIStore } from "../../stores/ui.store";
import { ChatToolbarButton } from "./ChatToolbarControls";

export function ChatHelpButton({
  mode,
  className,
  compact = false,
}: {
  mode: ChatMode;
  className?: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const hidden = useUIStore((state) => state.chatHelpButtonHidden ?? false);

  if (hidden) return null;

  return (
    <ChatToolbarButton
      icon={<CircleHelp size="0.875rem" />}
      title={t("chat.help.button")}
      helpTarget="help"
      className={className}
      size={compact ? "sm" : undefined}
      onClick={() => requestChatHelp(mode)}
    />
  );
}
