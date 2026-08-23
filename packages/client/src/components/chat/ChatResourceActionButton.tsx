import { MessageSquarePlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { requestChatResourceAssignment, type ChatResourceDragPayload } from "../../lib/chat-resource-drag";
import { resolveChatResourceDropAction } from "../../lib/chat-resource-drop-capabilities";
import { useChatStore } from "../../stores/chat.store";
import { cn } from "../../lib/utils";

export function ChatResourceActionButton({
  payload,
  className,
  iconClassName,
  size = "small",
}: {
  payload: ChatResourceDragPayload;
  className?: string;
  iconClassName?: string;
  size?: "small" | "row";
}) {
  const { t } = useTranslation();
  const chat = useChatStore((state) => state.activeChat);
  const result = chat ? resolveChatResourceDropAction(payload, chat) : null;
  if (!result || result.type === "blocked") return null;

  const label = t("ui.chat.chatresourceactionbutton.addToActiveChat", { name: payload.label });
  return (
    <button
      type="button"
      data-chat-resource-action={payload.kind}
      onClick={(event) => {
        event.stopPropagation();
        requestChatResourceAssignment(payload);
      }}
      className={cn("mari-chrome-control", size === "small" && "mari-chrome-control--small p-1.5", className)}
      title={label}
      aria-label={label}
    >
      <MessageSquarePlus size="0.75rem" className={iconClassName} />
    </button>
  );
}
