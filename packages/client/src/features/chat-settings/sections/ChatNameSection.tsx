import { Check, LetterText } from "lucide-react";
import { ChatSettingsSection } from "../ChatSettingsSection";

interface ChatNameSectionProps {
  chatName: string;
  editingName: boolean;
  nameValue: string;
  onBeginEdit: () => void;
  onNameValueChange: (value: string) => void;
  onSaveName: () => void;
}

export function ChatNameSection({
  chatName,
  editingName,
  nameValue,
  onBeginEdit,
  onNameValueChange,
  onSaveName,
}: ChatNameSectionProps) {
  return (
    <ChatSettingsSection
      label="Chat Name"
      icon={<LetterText size="0.875rem" />}
      help="This name is only visible to you — it won't be sent to the AI or affect the conversation in any way."
    >
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
            aria-label="Save chat name"
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
    </ChatSettingsSection>
  );
}
