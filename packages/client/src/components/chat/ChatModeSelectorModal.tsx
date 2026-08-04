import type { ChatMode } from "@marinara-engine/shared";
import { BookOpen, Gamepad2, MessageSquare } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { Modal } from "../ui/Modal";

export type ChatLaunchMode = ChatMode;

export const CHAT_MODE_OPTIONS: Array<{
  mode: ChatLaunchMode;
  labelKey: string;
  descriptionKey: string;
  icon: typeof MessageSquare;
}> = [
  {
    mode: "conversation",
    labelKey: "settings.modes.conversation",
    descriptionKey: "home.newChat.conversationDescription",
    icon: MessageSquare,
  },
  {
    mode: "roleplay",
    labelKey: "settings.modes.roleplay",
    descriptionKey: "home.newChat.roleplayDescription",
    icon: BookOpen,
  },
  {
    mode: "game",
    labelKey: "settings.modes.game",
    descriptionKey: "home.newChat.gameDescription",
    icon: Gamepad2,
  },
];

interface ChatModeSelectorModalProps {
  open: boolean;
  onClose: () => void;
  onSelectMode: (mode: ChatLaunchMode) => void;
  isPending?: boolean;
}

interface ChatModeSelectorProps {
  value?: ChatLaunchMode | null;
  onSelectMode: (mode: ChatLaunchMode) => void;
  disabled?: boolean;
  className?: string;
}

export function ChatModeSelector({ value, onSelectMode, disabled = false, className }: ChatModeSelectorProps) {
  const { t: localizeUi } = useUiTranslation();

  return (
    <div data-component="ChatModeSelector" className={cn("grid gap-2 sm:grid-cols-3", className)}>
      {CHAT_MODE_OPTIONS.map(({ mode, labelKey, descriptionKey, icon: Icon }) => {
        const selected = value === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onSelectMode(mode)}
            disabled={disabled}
            aria-pressed={selected}
            className={cn(
              "mari-chat-option-field group flex min-h-24 items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] disabled:cursor-wait disabled:opacity-60",
              selected && "ring-2 ring-[var(--marinara-chat-chrome-focus-ring)]",
            )}
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-button-text-active)] ring-1 ring-[var(--marinara-chat-chrome-button-border-active)]">
              <Icon size="0.875rem" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-[var(--foreground)]">{localizeUi(labelKey)}</span>
              <span className="mt-1 block text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
                {localizeUi(descriptionKey)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ChatModeSelectorModal({ open, onClose, onSelectMode, isPending = false }: ChatModeSelectorModalProps) {
  const { t: localizeUi } = useUiTranslation();

  return (
    <Modal open={open} onClose={onClose} title={localizeUi("home.newChat.chooseMode")} width="max-w-2xl">
      <ChatModeSelector onSelectMode={onSelectMode} disabled={isPending} />
    </Modal>
  );
}
