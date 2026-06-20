import { useState } from "react";
import { Feather, Pencil, Trash2 } from "lucide-react";
import { DEFAULT_CONVERSATION_PROMPT } from "@marinara-engine/shared";
import { useUIStore } from "../../../stores/ui.store";
import { ExpandedTextarea } from "../../../components/ui/ExpandedTextarea";
import { ChatSettingsSection } from "../ChatSettingsSection";

interface ConversationPromptSectionProps {
  chatId: string;
  customPrompt: string;
  onCustomPromptChange: (chatId: string, customPrompt: string | null) => void;
}

export function ConversationPromptSection({
  chatId,
  customPrompt,
  onCustomPromptChange,
}: ConversationPromptSectionProps) {
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptDraft, setPromptDraft] = useState("");

  const openPromptEditor = () => {
    setPromptDraft(customPrompt || DEFAULT_CONVERSATION_PROMPT);
    setPromptOpen(true);
  };

  const closePromptEditor = () => {
    const isDefault = promptDraft === DEFAULT_CONVERSATION_PROMPT;
    const nextPrompt = isDefault ? null : promptDraft;
    onCustomPromptChange(chatId, nextPrompt);
    useUIStore.getState().setCustomConversationPrompt(nextPrompt);
    setPromptOpen(false);
  };

  const resetPrompt = () => {
    onCustomPromptChange(chatId, null);
    useUIStore.getState().setCustomConversationPrompt(null);
  };

  return (
    <>
      <ChatSettingsSection
        label="Prompt"
        icon={<Feather size="0.875rem" />}
        help="Conversation-only system prompt that shapes how characters text in this chat."
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2 ring-1 ring-[var(--border)]">
            <div className="min-w-0">
              <span className="block text-[0.6875rem] font-medium text-[var(--foreground)]">System Prompt</span>
              <span className="block text-[0.625rem] text-[var(--muted-foreground)]">
                {customPrompt ? "Using custom conversation prompt" : "Using default conversation prompt"}
              </span>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--background)] px-2 py-0.5 text-[0.5625rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
              {customPrompt ? "Custom" : "Default"}
            </span>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={openPromptEditor}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-[0.625rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]"
            >
              <Pencil size="0.625rem" />
              Edit Prompt
            </button>
            {customPrompt && (
              <button
                onClick={resetPrompt}
                className="flex items-center justify-center rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                title="Reset to default prompt"
              >
                <Trash2 size="0.625rem" />
              </button>
            )}
          </div>
        </div>
      </ChatSettingsSection>
      <ExpandedTextarea
        open={promptOpen}
        onClose={closePromptEditor}
        title="Edit System Prompt"
        value={promptDraft}
        onChange={setPromptDraft}
        placeholder="Enter your custom system prompt..."
        surface="chat"
      />
    </>
  );
}
