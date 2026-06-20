import { Maximize2, Sparkles } from "lucide-react";
import { ExpandedTextarea } from "../../../components/ui/ExpandedTextarea";
import { ChatSettingsSection } from "../ChatSettingsSection";

interface SceneInstructionsSectionProps {
  expanded: boolean;
  storedValue: string;
  value: string;
  onCommit: (value: string) => void;
  onExpandedChange: (expanded: boolean) => void;
  onValueChange: (value: string) => void;
}

export function SceneInstructionsSection({
  expanded,
  storedValue,
  value,
  onCommit,
  onExpandedChange,
  onValueChange,
}: SceneInstructionsSectionProps) {
  const commitIfChanged = () => {
    if (value !== storedValue) onCommit(value);
  };

  return (
    <ChatSettingsSection
      label="Scene Instructions"
      icon={<Sparkles size="0.875rem" />}
      help="The system prompt generated for this scene. You can edit it to change the AI's writing style, POV, tone, and focus."
    >
      <div className="relative">
        <textarea
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onBlur={commitIfChanged}
          placeholder="Scene system prompt..."
          rows={6}
          className="w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 pr-8 text-xs leading-relaxed outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
        />
        <button
          type="button"
          aria-label="Expand scene instructions editor"
          onClick={() => onExpandedChange(true)}
          className="absolute right-1.5 top-1.5 rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          title="Expand editor"
        >
          <Maximize2 size="0.75rem" />
        </button>
      </div>
      <ExpandedTextarea
        open={expanded}
        onClose={() => {
          onExpandedChange(false);
          commitIfChanged();
        }}
        title="Scene Instructions"
        value={value}
        onChange={onValueChange}
        placeholder="Scene system prompt..."
      />
    </ChatSettingsSection>
  );
}
