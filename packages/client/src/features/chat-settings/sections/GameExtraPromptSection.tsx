import { useEffect, useState } from "react";
import { RotateCcw, Sliders } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { DEFAULT_GAME_SYSTEM_PROMPT, type AgentPromptTemplateOption } from "@marinara-engine/shared";
import { MacroTextarea } from "../../../components/ui/MacroTextarea";
import { ChatSettingsSection } from "../ChatSettingsSection";

interface PromptPresetOption {
  id: string;
  name: string;
  gamePrompt?: string;
}

interface GameExtraPromptSectionProps {
  storedValue: string;
  specialInstructionsValue: string;
  promptPresetId: string | null;
  promptPresets: PromptPresetOption[];
  selectedPresetPrompt: string;
  gmPromptTemplateId: string | null;
  gmPromptTemplates: AgentPromptTemplateOption[];
  onCommit: (value: string | null) => void;
  onSpecialInstructionsCommit: (value: string | null) => void;
  onSpecialInstructionsChange: (value: string) => void;
  onPromptPresetChange: (presetId: string | null) => void;
  onGmPromptTemplateChange: (templateId: string | null) => void;
}

export function GameExtraPromptSection({
  storedValue,
  specialInstructionsValue,
  promptPresetId,
  promptPresets,
  selectedPresetPrompt,
  gmPromptTemplateId,
  gmPromptTemplates,
  onCommit,
  onSpecialInstructionsCommit,
  onSpecialInstructionsChange,
  onPromptPresetChange,
  onGmPromptTemplateChange,
}: GameExtraPromptSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const selectedGmPromptTemplate = gmPromptTemplates.find((template) => template.id === gmPromptTemplateId) ?? null;
  const basePrompt =
    selectedGmPromptTemplate?.promptTemplate.trim() || selectedPresetPrompt.trim() || DEFAULT_GAME_SYSTEM_PROMPT;
  // Local draft always shows the effective Game prompt (chat-local edit, else
  // the GM style / preset / built-in default). Editing saves a chat-local copy.
  const [draft, setDraft] = useState(storedValue || basePrompt);
  useEffect(() => {
    setDraft(storedValue || basePrompt);
  }, [storedValue, basePrompt]);

  const commitDraft = () => {
    const isBasePrompt = draft.trim() === basePrompt.trim();
    onCommit(!draft.trim() || isBasePrompt ? null : draft);
  };

  const resetPrompt = () => {
    onCommit(null);
    setDraft(basePrompt);
  };

  const sourceLabel = storedValue
    ? localizeUi("settings.notifications.customSound.status.custom")
    : selectedGmPromptTemplate
      ? localizeUi("ui.chatSettings.gameextrapromptsection.style")
      : promptPresetId
        ? localizeUi("chat.toolbar.preset")
        : localizeUi("ui.noodle.noodlehome.default");

  return (
    <ChatSettingsSection
      id="game-prompt"
      label={localizeUi("ui.chatSettings.conversationpromptsection.promptPreset")}
      icon={<Sliders size="0.875rem" />}
      help={localizeUi("ui.chatSettings.gameextrapromptsection.chooseAPresetSGamePromptThenOptionallyEdit")}
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
                : localizeUi("ui.chatSettings.gameextrapromptsection.defaultGamePrompt")}
            </option>
            {promptPresets.length > 0 &&
              promptPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.chatSettings.gameextrapromptsection.gmPromptStyle")}
          </span>
          <select
            value={gmPromptTemplateId ?? ""}
            onChange={(event) => onGmPromptTemplateChange(event.target.value || null)}
            className="mari-preset-native-select w-full truncate rounded-lg bg-[var(--secondary)] px-3 py-2 pr-8 text-xs text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] transition-shadow focus:ring-[var(--primary)]/40"
          >
            <option value="">{localizeUi("ui.chatSettings.gameextrapromptsection.useSelectedPromptSource")}</option>
            {gmPromptTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <span className="text-[0.575rem] leading-relaxed text-[var(--muted-foreground)]">
            {localizeUi("ui.chatSettings.gameextrapromptsection.aSelectedGmStyleReplacesOnlyTheGamePrompt")}
          </span>
        </label>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.6875rem] font-medium text-[var(--foreground)]">
            {localizeUi("ui.chatSettings.gameextrapromptsection.gamePrompt")}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-[0.5625rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
              {sourceLabel}
            </span>
            {storedValue && (
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
            value={draft}
            onChange={setDraft}
            onBlur={commitDraft}
            onExpandedClose={commitDraft}
            title={localizeUi("ui.chatSettings.gameextrapromptsection.editGamePrompt")}
            placeholder={localizeUi("ui.chatSettings.gameextrapromptsection.enterYourCustomGameMasterPrompt")}
            rows={6}
            className="mari-editor-field min-h-[9rem] w-full p-3 font-mono text-xs"
            spellCheck={false}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.chatSettings.gameextrapromptsection.extraInstructions")}
          </span>
          <MacroTextarea
            value={specialInstructionsValue}
            onChange={onSpecialInstructionsChange}
            onBlur={() => onSpecialInstructionsCommit(specialInstructionsValue.trim() || null)}
            onExpandedClose={() => onSpecialInstructionsCommit(specialInstructionsValue.trim() || null)}
            title={localizeUi("ui.chatSettings.gameextrapromptsection.extraInstructions")}
            ariaLabel={localizeUi("ui.chatSettings.gameextrapromptsection.extraInstructions")}
            placeholder={localizeUi("ui.chatSettings.gameextrapromptsection.writeInTheStyleOfTerryPratchett")}
            rows={3}
            maxLength={2000}
            className="mari-chrome-field min-h-[5rem] w-full !rounded-md px-3 py-2 pr-8 text-xs leading-relaxed"
          />
        </div>
      </div>
    </ChatSettingsSection>
  );
}
