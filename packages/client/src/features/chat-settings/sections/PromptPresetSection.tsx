import type { ReactNode } from "react";
import { AlertTriangle, ChevronDown, Layers, Pencil, Sliders } from "lucide-react";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { useUIStore } from "../../../stores/ui.store";
import { ChatSettingsSection } from "../ChatSettingsSection";

interface PromptPresetOption {
  id: string;
  name: string;
}

const PROMPT_PRESET_CHEVRON_CLASS =
  "pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]";
const QUICK_PRESET_EDITOR_SECTION_ID = "prompt-preset-editor";

interface PromptPresetSectionProps {
  promptPresetId: string | null;
  presets: PromptPresetOption[];
  hasVariables: boolean;
  quickEditor: ReactNode;
  showLorebookMarkerWarning: boolean;
  onEditVariables: () => void;
  onPromptPresetChange: (presetId: string | null) => void;
}

export function PromptPresetSection({
  promptPresetId,
  presets,
  hasVariables,
  quickEditor,
  showLorebookMarkerWarning,
  onEditVariables,
  onPromptPresetChange,
}: PromptPresetSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const showVariableEditor = !!promptPresetId && hasVariables;
  const quickEditorExpanded = useUIStore(
    (state) => state.chatSettingsExpandedSections[QUICK_PRESET_EDITOR_SECTION_ID] ?? false,
  );
  const setSectionExpanded = useUIStore((state) => state.setChatSettingsSectionExpanded);

  return (
    <ChatSettingsSection
      id="prompt-preset"
      label={localizeUi("ui.chatSettings.conversationpromptsection.promptPreset")}
      icon={<Sliders size="0.875rem" />}
      help={localizeUi("ui.chatSettings.promptpresetsection.presetsControlHowTheSystemPromptIsStructuredAnd")}
    >
      <div className="flex items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          <select
            value={promptPresetId ?? ""}
            onChange={(event) => onPromptPresetChange(event.target.value || null)}
            className="mari-preset-native-select w-full appearance-none truncate rounded-lg bg-[var(--secondary)] px-3 py-2 pr-8 text-xs text-[var(--foreground)] outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
          >
            <option value="">{localizeUi("ui.game.gamesurfacecomponent.none")}</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          <ChevronDown
            data-prompt-preset-chevron="select"
            aria-hidden
            size="0.75rem"
            className={PROMPT_PRESET_CHEVRON_CLASS}
          />
        </div>
        {showVariableEditor && (
          <button
            type="button"
            aria-label={t("chat.settings.promptPreset.editVariables")}
            onClick={onEditVariables}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            title={t("chat.settings.promptPreset.editVariables")}
          >
            <Pencil size="0.8125rem" />
          </button>
        )}
      </div>
      {showLorebookMarkerWarning && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-400/10 px-3 py-2 text-[0.6875rem] text-amber-200 ring-1 ring-amber-400/25">
          <AlertTriangle size="0.75rem" className="mt-[0.125rem] shrink-0" />
          <span>{localizeUi("ui.chatSettings.promptpresetsection.thisPresetHasActiveLorebooksAvailableButNoLorebook")}</span>
        </div>
      )}
      {promptPresetId && (
        <div
          data-prompt-preset-quick-editor-disclosure
          className="mt-2 overflow-hidden rounded-lg border border-[var(--border)]"
        >
          <button
            type="button"
            aria-expanded={quickEditorExpanded}
            aria-label={
              quickEditorExpanded
                ? t("chat.settings.promptPreset.quickEdit.hide")
                : t("chat.settings.promptPreset.quickEdit.show")
            }
            onClick={() => setSectionExpanded(QUICK_PRESET_EDITOR_SECTION_ID, !quickEditorExpanded)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]/40"
          >
            <Layers size="0.75rem" className="shrink-0 text-[var(--primary)]" />
            <span className="min-w-0 flex-1 truncate">
              {quickEditorExpanded
                ? t("chat.settings.promptPreset.quickEdit.hide")
                : t("chat.settings.promptPreset.quickEdit.show")}
            </span>
            <ChevronDown
              aria-hidden
              size="0.75rem"
              className={cn(
                "shrink-0 text-[var(--muted-foreground)] transition-transform",
                quickEditorExpanded && "rotate-180",
              )}
            />
          </button>
          {quickEditorExpanded && (
            <div data-prompt-preset-quick-editor-content className="border-t border-[var(--border)] p-2">
              <p className="mb-2 px-1 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                {t("chat.settings.promptPreset.quickEdit.autoSave")}
              </p>
              {quickEditor}
            </div>
          )}
        </div>
      )}
    </ChatSettingsSection>
  );
}
