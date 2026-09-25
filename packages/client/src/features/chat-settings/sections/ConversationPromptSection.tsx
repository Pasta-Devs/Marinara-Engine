import { useEffect, useState } from "react";
import { RotateCcw, Sliders } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { DEFAULT_CONVERSATION_PROMPT } from "@marinara-engine/shared";
import { MacroTextarea } from "../../../components/ui/MacroTextarea";
import { ChatSettingsSection } from "../ChatSettingsSection";

interface PromptPresetOption {
  id: string;
  name: string;
  conversationPrompt?: string;
}

interface ConversationPromptSectionProps {
  chatId: string;
  customPrompt: string;
  promptPresetId: string | null;
  promptPresets: PromptPresetOption[];
  selectedPresetPrompt: string;
  onCustomPromptChange: (chatId: string, customPrompt: string | null) => void;
  onPromptPresetChange: (presetId: string | null) => void;
}

export function ConversationPromptSection({
  chatId,
  customPrompt,
  promptPresetId,
  promptPresets,
  selectedPresetPrompt,
  onCustomPromptChange,
  onPromptPresetChange,
}: ConversationPromptSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const basePrompt = selectedPresetPrompt.trim() || DEFAULT_CONVERSATION_PROMPT;
  // The textarea always shows the effective prompt: the chat's local edit if it
  // has one, otherwise the preset's (or the built-in default). Editing it saves
  // a chat-local override; clearing it back to the base drops the override.
  const [draft, setDraft] = useState(customPrompt || basePrompt);
  useEffect(() => {
    setDraft(customPrompt || basePrompt);
  }, [customPrompt, basePrompt]);

  const commitDraft = () => {
    const isBasePrompt = draft.trim() === basePrompt.trim();
    onCustomPromptChange(chatId, !draft.trim() || isBasePrompt ? null : draft);
  };

  const resetPrompt = () => {
    onCustomPromptChange(chatId, null);
    setDraft(basePrompt);
  };

  const sourceLabel = customPrompt
    ? localizeUi("settings.notifications.customSound.status.custom")
    : promptPresetId
      ? localizeUi("chat.toolbar.preset")
      : localizeUi("ui.noodle.noodlehome.default");

  return (
    <ChatSettingsSection
      id="conversation-prompt"
      label={localizeUi("ui.chatSettings.conversationpromptsection.promptPreset")}
      icon={<Sliders size="0.875rem" />}
      help={localizeUi("ui.chatSettings.conversationpromptsection.chooseAPresetSConversationPromptThenOptionallyEdit")}
    >
      <div className="space-y-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.chatSettings.conversationpromptsection.promptSource")}
          </span>
          <select
            value={promptPresetId ?? ""}
            onChange={(event) => onPromptPresetChange(event.target.value || null)}
            disabled={promptPresets.length === 0}
            className="mari-preset-native-select min-w-0 flex-1 truncate rounded-lg bg-[var(--secondary)] px-3 py-2 pr-8 text-xs text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] transition-shadow focus:ring-[var(--primary)]/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">
              {promptPresets.length === 0
                ? localizeUi("ui.chatSettings.conversationpromptsection.noPresetsAvailable")
                : localizeUi("ui.chatSettings.conversationpromptsection.defaultConversationPrompt")}
            </option>
            {promptPresets.length > 0 &&
              promptPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
          </select>
        </label>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.6875rem] font-medium text-[var(--foreground)]">
            {localizeUi("ui.chatSettings.conversationpromptsection.conversationPrompt")}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-[0.5625rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
              {sourceLabel}
            </span>
            {customPrompt && (
              <button
                type="button"
                onClick={resetPrompt}
                className="flex items-center justify-center rounded-lg bg-[var(--secondary)] px-2 py-1 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                title={localizeUi("ui.chatSettings.conversationpromptsection.resetToDefaultPrompt")}
              >
                <RotateCcw size="0.625rem" />
              </button>
            )}
          </div>
        </div>

        <div className="mari-quick-preset-editor">
          <MacroTextarea
            showTokenCount
            value={draft}
            onChange={setDraft}
            onBlur={commitDraft}
            onExpandedClose={commitDraft}
            title={localizeUi("ui.chatSettings.conversationpromptsection.editConversationPrompt")}
            placeholder={localizeUi("ui.chatSettings.conversationpromptsection.enterYourCustomConversationPrompt")}
            rows={6}
            className="mari-editor-field min-h-[9rem] w-full p-3 font-mono text-xs"
            spellCheck={false}
          />
        </div>
      </div>
    </ChatSettingsSection>
  );
}
