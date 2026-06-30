import { cn } from "../../lib/utils";

type ChatInputLayout = "conversation" | "game" | "roleplay";

interface ChatInputShellClassOptions {
  className?: string;
  dragging?: boolean;
  hasContent?: boolean;
  inline?: boolean;
  layout: ChatInputLayout;
}

const CHAT_INPUT_LAYOUT_CLASSES: Record<ChatInputLayout, string> = {
  conversation: "items-center gap-0.5 px-2 py-1.5 sm:gap-2 sm:px-4 sm:py-2.5",
  game: "items-center gap-1 px-2 py-1.5 sm:gap-1.5 sm:px-4 sm:py-3",
  roleplay: "items-center gap-1 px-2 py-1.5 sm:gap-2 sm:px-4 sm:py-2.5",
};

const CHAT_INPUT_INLINE_LAYOUT_CLASSES: Partial<Record<ChatInputLayout, string>> = {
  game: "items-center gap-1.5 px-2 py-2",
};

export const CHAT_INPUT_SHELL_BASE_CLASS =
  "mari-chat-input-box marinara-chat-input-shell relative flex rounded-2xl border border-[var(--marinara-chat-chrome-input-border)] bg-[var(--marinara-chat-chrome-input-bg)] text-[var(--marinara-chat-chrome-panel-text)] shadow-sm backdrop-blur-md transition-all duration-200 focus-within:border-[var(--marinara-chat-chrome-input-border-focus)] focus-within:ring-1 focus-within:ring-[var(--marinara-chat-chrome-focus-ring)]";

export const CHAT_INPUT_DRAGGING_CLASS =
  "border-[var(--marinara-chat-chrome-input-border-focus)] bg-[var(--marinara-chat-chrome-highlight-bg)] shadow-lg shadow-black/10";

export const CHAT_INPUT_HAS_CONTENT_CLASS = "shadow-md shadow-black/5";

export function getChatInputShellClass({
  className,
  dragging = false,
  hasContent = false,
  inline = false,
  layout,
}: ChatInputShellClassOptions) {
  const layoutClass =
    inline && CHAT_INPUT_INLINE_LAYOUT_CLASSES[layout]
      ? CHAT_INPUT_INLINE_LAYOUT_CLASSES[layout]
      : CHAT_INPUT_LAYOUT_CLASSES[layout];

  return cn(
    CHAT_INPUT_SHELL_BASE_CLASS,
    layoutClass,
    dragging ? CHAT_INPUT_DRAGGING_CLASS : hasContent ? CHAT_INPUT_HAS_CONTENT_CLASS : "",
    className,
  );
}
