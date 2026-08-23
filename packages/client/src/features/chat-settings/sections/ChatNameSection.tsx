import { Check, LetterText } from "lucide-react";
import { toast } from "sonner";
import { ChatSettingsSection } from "../ChatSettingsSection";
import { copyToClipboard } from "../../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";

interface ChatNameSectionProps {
  chatId: string;
  chatName: string;
  editingName: boolean;
  nameValue: string;
  onBeginEdit: () => void;
  onNameValueChange: (value: string) => void;
  onSaveName: () => void;
}

export function ChatNameSection({
  chatId,
  chatName,
  editingName,
  nameValue,
  onBeginEdit,
  onNameValueChange,
  onSaveName,
}: ChatNameSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <ChatSettingsSection
      id="chat-name"
      label={localizeUi("ui.chatSettings.chatnamesection.chatName")}
      icon={<LetterText size="0.875rem" />}
      help={localizeUi("ui.chatSettings.chatnamesection.thisNameIsOnlyVisibleToYouItWon")}
    >
      <div className="space-y-2">
        {editingName ? (
          <div className="flex gap-2">
            <input
              value={nameValue}
              onChange={(e) => onNameValueChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSaveName()}
              autoFocus
              className="flex-1 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-[var(--primary)]/40"
            />
            <button
              type="button"
              aria-label={localizeUi("ui.chatSettings.chatnamesection.saveChatName")}
              onClick={onSaveName}
              className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs text-white"
            >
              <Check size="0.75rem" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onBeginEdit}
            className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--accent)]"
          >
            {chatName}
          </button>
        )}
        <button
          type="button"
          onClick={async () => {
            const copied = await copyToClipboard(chatId);
            if (copied) toast.success(localizeUi("ui.chatSettings.chatnamesection.chatIdCopied"));
            else toast.error(localizeUi("ui.chatSettings.chatnamesection.couldNotCopyChatId"));
          }}
          className="group flex w-full min-w-0 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--secondary)]/50 px-3 py-2 text-left transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          title={localizeUi("ui.chatSettings.chatnamesection.copyChatId")}
          aria-label={localizeUi("ui.chatSettings.chatnamesection.copyChatId")}
        >
          <span className="shrink-0 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {localizeUi("ui.chatSettings.chatnamesection.chatId")}
          </span>
          <code className="min-w-0 flex-1 truncate text-[0.6875rem] text-[var(--foreground)]" title={chatId}>
            {chatId}
          </code>
          <span className="shrink-0 text-[0.625rem] text-[var(--muted-foreground)] transition-colors group-hover:text-[var(--foreground)]">
            {localizeUi("ui.chatSettings.chatnamesection.clickToCopy")}
          </span>
        </button>
      </div>
    </ChatSettingsSection>
  );
}
