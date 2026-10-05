import { Maximize2, Clapperboard } from "lucide-react";
import { ExpandedTextarea } from "../../../components/ui/ExpandedTextarea";
import { ChatSettingsSection } from "../ChatSettingsSection";
import { useTranslation as useUiTranslation } from "react-i18next";

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
  const { t: localizeUi } = useUiTranslation();
  const commitIfChanged = () => {
    if (value !== storedValue) onCommit(value);
  };

  return (
    <ChatSettingsSection
      id="scene-instructions"
      label={localizeUi("ui.chatSettings.sceneinstructionssection.sceneInstructions")}
      icon={<Clapperboard size="0.875rem" />}
      help={localizeUi("ui.chatSettings.sceneinstructionssection.theSystemPromptGeneratedForThisSceneYouCan")}
    >
      <div className="relative">
        <textarea
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onBlur={commitIfChanged}
          placeholder={localizeUi("ui.chatSettings.sceneinstructionssection.sceneSystemPrompt")}
          rows={6}
          className="w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 pr-8 text-xs leading-relaxed outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
        />
        <button
          type="button"
          aria-label={localizeUi("ui.chatSettings.sceneinstructionssection.expandSceneInstructionsEditor")}
          onClick={() => onExpandedChange(true)}
          className="absolute right-1.5 top-1.5 rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          title={localizeUi("ui.chatSettings.sceneinstructionssection.expandEditor")}
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
        title={localizeUi("ui.chatSettings.sceneinstructionssection.sceneInstructions")}
        value={value}
        onChange={onValueChange}
        placeholder={localizeUi("ui.chatSettings.sceneinstructionssection.sceneSystemPrompt")}
        surface="chat"
      />
    </ChatSettingsSection>
  );
}
