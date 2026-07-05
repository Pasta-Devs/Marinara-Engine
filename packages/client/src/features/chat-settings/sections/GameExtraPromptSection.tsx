import { ExternalLink, Pencil, Sliders, Trash2 } from "lucide-react";
import { DEFAULT_GAME_SYSTEM_PROMPT } from "@marinara-engine/shared";
import { ExpandedTextarea } from "../../../components/ui/ExpandedTextarea";
import { ChatSettingsSection } from "../ChatSettingsSection";

interface PromptPresetOption {
  id: string;
  name: string;
  gamePrompt?: string;
}

interface GameExtraPromptSectionProps {
  expanded: boolean;
  storedValue: string;
  value: string;
  specialInstructionsValue: string;
  promptPresetId: string | null;
  promptPresets: PromptPresetOption[];
  selectedPresetName: string | null;
  selectedPresetPrompt: string;
  onCommit: (value: string | null) => void;
  onSpecialInstructionsCommit: (value: string | null) => void;
  onExpandedChange: (expanded: boolean) => void;
  onValueChange: (value: string) => void;
  onSpecialInstructionsChange: (value: string) => void;
  onPromptPresetChange: (presetId: string | null) => void;
  onOpenPromptPreset: () => void;
}

export function GameExtraPromptSection({
  expanded,
  storedValue,
  value,
  specialInstructionsValue,
  promptPresetId,
  promptPresets,
  selectedPresetName,
  selectedPresetPrompt,
  onCommit,
  onSpecialInstructionsCommit,
  onExpandedChange,
  onValueChange,
  onSpecialInstructionsChange,
  onPromptPresetChange,
  onOpenPromptPreset,
}: GameExtraPromptSectionProps) {
  const basePrompt = selectedPresetPrompt.trim() || DEFAULT_GAME_SYSTEM_PROMPT;

  const openPromptEditor = () => {
    onValueChange(storedValue || basePrompt);
    onExpandedChange(true);
  };

  const closePromptEditor = () => {
    const isPresetPrompt = value.trim() === basePrompt.trim();
    const nextValue = !value.trim() || isPresetPrompt ? null : value;
    onCommit(nextValue);
    onExpandedChange(false);
  };

  const resetPrompt = () => {
    onValueChange("");
    onCommit(null);
  };

  return (
    <>
      <ChatSettingsSection
        label="Prompt Preset"
        icon={<Sliders size="0.875rem" />}
        help="Choose a preset's Game prompt, then optionally edit a chat-local copy."
      >
        <div className="space-y-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">Prompt source</span>
            <div className="flex items-center gap-1.5">
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
              <button
                type="button"
                onClick={onOpenPromptPreset}
                disabled={!promptPresetId}
                className="mari-chrome-control mari-chrome-control--small shrink-0 px-2 py-2 text-[0.625rem] disabled:cursor-not-allowed disabled:opacity-45"
                title="Open selected preset"
              >
                <ExternalLink size="0.75rem" />
                <span className="max-sm:hidden">Preset</span>
              </button>
            </div>
          </label>
          <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2 ring-1 ring-[var(--border)]">
            <div className="min-w-0">
              <span className="block text-[0.6875rem] font-medium text-[var(--foreground)]">Game Prompt</span>
              <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                {storedValue
                  ? "Using chat-local edit"
                  : promptPresetId
                    ? `From ${selectedPresetName ?? "selected preset"}`
                    : "Using default game prompt"}
              </span>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--background)] px-2 py-0.5 text-[0.5625rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
              {storedValue ? "Custom" : promptPresetId ? "Preset" : "Default"}
            </span>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={openPromptEditor}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-[0.625rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]"
            >
              <Pencil size="0.625rem" />
              Edit Prompt
            </button>
            {storedValue && (
              <button
                type="button"
                onClick={resetPrompt}
                className="flex items-center justify-center rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                title="Reset to default prompt"
              >
                <Trash2 size="0.625rem" />
              </button>
            )}
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
      <ExpandedTextarea
        open={expanded}
        onClose={closePromptEditor}
        title="Edit Game Prompt"
        value={value}
        onChange={onValueChange}
        placeholder="Enter your custom Game Master prompt..."
        surface="chat"
      />
    </>
  );
}
