import { useEffect, useState } from "react";
import { RotateCcw, Sliders } from "lucide-react";
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

  const sourceLabel = storedValue ? "Custom" : selectedGmPromptTemplate ? "Style" : promptPresetId ? "Preset" : "Default";

  return (
    <ChatSettingsSection
      id="game-prompt"
      label="Prompt Preset"
      icon={<Sliders size="0.875rem" />}
      help="Choose a preset's Game prompt, then optionally edit a chat-local copy."
    >
      <div className="space-y-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Prompt source</span>
          <select
            value={promptPresetId ?? ""}
            onChange={(event) => onPromptPresetChange(event.target.value || null)}
            disabled={promptPresets.length === 0}
            className="mari-preset-native-select min-w-0 flex-1 truncate rounded-lg bg-[var(--secondary)] px-3 py-2 pr-8 text-xs text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] transition-shadow focus:ring-[var(--primary)]/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">{promptPresets.length === 0 ? "No presets available" : "Default game prompt"}</option>
            {promptPresets.length > 0 &&
              promptPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">GM prompt style</span>
          <select
            value={gmPromptTemplateId ?? ""}
            onChange={(event) => onGmPromptTemplateChange(event.target.value || null)}
            className="mari-preset-native-select w-full truncate rounded-lg bg-[var(--secondary)] px-3 py-2 pr-8 text-xs text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] transition-shadow focus:ring-[var(--primary)]/40"
          >
            <option value="">Use selected prompt source</option>
            {gmPromptTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <span className="text-[0.575rem] leading-relaxed text-[var(--muted-foreground)]">
            A selected GM style replaces only the Game prompt. A chat-local edit still takes priority.
          </span>
        </label>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.6875rem] font-medium text-[var(--foreground)]">Game Prompt</span>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-[0.5625rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
              {sourceLabel}
            </span>
            {storedValue && (
              <button
                type="button"
                onClick={resetPrompt}
                className="flex items-center justify-center rounded-lg bg-[var(--secondary)] px-2 py-1 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                title="Reset to default prompt"
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
            title="Edit Game Prompt"
            placeholder="Enter your custom Game Master prompt..."
            rows={6}
            className="mari-editor-field min-h-[9rem] w-full p-3 font-mono text-xs"
            spellCheck={false}
          />
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Extra instructions</span>
          <textarea
            value={specialInstructionsValue}
            onChange={(event) => onSpecialInstructionsChange(event.target.value)}
            onBlur={() => onSpecialInstructionsCommit(specialInstructionsValue.trim() || null)}
            placeholder="Write in the style of Terry Pratchett."
            rows={3}
            maxLength={2000}
            className="min-h-[5rem] w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-xs leading-relaxed text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--foreground)]/40"
          />
        </label>
      </div>
    </ChatSettingsSection>
  );
}
