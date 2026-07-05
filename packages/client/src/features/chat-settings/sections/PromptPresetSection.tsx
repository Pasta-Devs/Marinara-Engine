import { AlertTriangle, Pencil, Sliders } from "lucide-react";
import { ChatSettingsSection } from "../ChatSettingsSection";

interface PromptPresetOption {
  id: string;
  name: string;
}

interface PromptPresetSectionProps {
  promptPresetId: string | null;
  presets: PromptPresetOption[];
  hasVariables: boolean;
  showLorebookMarkerWarning: boolean;
  onEditVariables: () => void;
  onPromptPresetChange: (presetId: string | null) => void;
}

export function PromptPresetSection({
  promptPresetId,
  presets,
  hasVariables,
  showLorebookMarkerWarning,
  onEditVariables,
  onPromptPresetChange,
}: PromptPresetSectionProps) {
  return (
    <ChatSettingsSection
      label="Prompt Preset"
      icon={<Sliders size="0.875rem" />}
      help="Presets control how the system prompt is structured and what generation parameters are used. Different presets produce different AI behaviors."
    >
      <div className="flex items-center gap-1.5">
        <select
          value={promptPresetId ?? ""}
          onChange={(event) => onPromptPresetChange(event.target.value || null)}
          className="mari-preset-native-select min-w-0 flex-1 truncate rounded-lg bg-[var(--secondary)] px-3 py-2 pr-8 text-xs text-[var(--foreground)] outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
        >
          <option value="">None</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
        {promptPresetId && hasVariables && (
          <button
            type="button"
            aria-label="Edit preset variables"
            onClick={onEditVariables}
            className="shrink-0 rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            title="Edit preset variables"
          >
            <Pencil size="0.8125rem" />
          </button>
        )}
      </div>
      {showLorebookMarkerWarning && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-400/10 px-3 py-2 text-[0.6875rem] text-amber-200 ring-1 ring-amber-400/25">
          <AlertTriangle size="0.75rem" className="mt-[0.125rem] shrink-0" />
          <span>This preset has active lorebooks available, but no lorebook marker.</span>
        </div>
      )}
    </ChatSettingsSection>
  );
}
