import { Feather, Pencil, Trash2 } from "lucide-react";
import { DEFAULT_GAME_SYSTEM_PROMPT } from "@marinara-engine/shared";
import { ExpandedTextarea } from "../../../components/ui/ExpandedTextarea";
import { ChatSettingsSection } from "../ChatSettingsSection";

interface GameExtraPromptSectionProps {
  expanded: boolean;
  storedValue: string;
  value: string;
  specialInstructionsValue: string;
  onCommit: (value: string | null) => void;
  onSpecialInstructionsCommit: (value: string | null) => void;
  onExpandedChange: (expanded: boolean) => void;
  onValueChange: (value: string) => void;
  onSpecialInstructionsChange: (value: string) => void;
}

export function GameExtraPromptSection({
  expanded,
  storedValue,
  value,
  specialInstructionsValue,
  onCommit,
  onSpecialInstructionsCommit,
  onExpandedChange,
  onValueChange,
  onSpecialInstructionsChange,
}: GameExtraPromptSectionProps) {
  const openPromptEditor = () => {
    onValueChange(storedValue || DEFAULT_GAME_SYSTEM_PROMPT);
    onExpandedChange(true);
  };

  const closePromptEditor = () => {
    const nextValue = value === DEFAULT_GAME_SYSTEM_PROMPT ? null : value.trim() || null;
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
        label="Prompt"
        icon={<Feather size="0.875rem" />}
        help="Game-mode GM system prompt. Custom text replaces the default instruction block and is sent wrapped in <instructions>."
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2 ring-1 ring-[var(--border)]">
            <div className="min-w-0">
              <span className="block text-[0.6875rem] font-medium text-[var(--foreground)]">GM Prompt</span>
              <span className="block text-[0.625rem] text-[var(--muted-foreground)]">
                {storedValue ? "Using custom game prompt" : "Using default game prompt"}
              </span>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--background)] px-2 py-0.5 text-[0.5625rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
              {storedValue ? "Custom" : "Default"}
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
