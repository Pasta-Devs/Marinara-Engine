import { ArrowRight, Drama } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { HelpTooltip } from "../../../components/ui/HelpTooltip";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { QUICK_REPLIES_SETTINGS_CONTROL_ID, useUIStore } from "../../../stores/ui.store";
import { ChatSettingsSection } from "../ChatSettingsSection";
import { ImpersonatePromptTemplateField } from "./ImpersonatePromptTemplateField";

interface ImpersonateSectionProps {
  presets: Array<{ id: string; name: string }>;
  connections: Array<{ id: string; name: string }>;
}

export function ImpersonateSection({ presets, connections }: ImpersonateSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const cyoaChoices = useUIStore((state) => state.impersonateCyoaChoices);
  const setCyoaChoices = useUIStore((state) => state.setImpersonateCyoaChoices);
  const presetId = useUIStore((state) => state.impersonatePresetId);
  const setPresetId = useUIStore((state) => state.setImpersonatePresetId);
  const connectionId = useUIStore((state) => state.impersonateConnectionId);
  const setConnectionId = useUIStore((state) => state.setImpersonateConnectionId);
  const blockAgents = useUIStore((state) => state.impersonateBlockAgents);
  const setBlockAgents = useUIStore((state) => state.setImpersonateBlockAgents);
  const openRightPanel = useUIStore((state) => state.openRightPanel);
  const setSettingsTargetControlId = useUIStore((state) => state.setSettingsTargetControlId);

  const handleOpenQuickReplySettings = () => {
    setSettingsTargetControlId(QUICK_REPLIES_SETTINGS_CONTROL_ID);
    openRightPanel("settings");
  };

  return (
    <ChatSettingsSection
      id="impersonate"
      label={localizeUi("settings.quickReplies.impersonate.label")}
      icon={<Drama size="0.875rem" />}
      help={localizeUi("ui.chatSettings.impersonatesection.globalSettingsAppliedToEveryImpersonateGenerationAcrossAll")}
      contentClassName="pt-1.5"
    >
      <div className="space-y-2.5">
        <ImpersonatePromptTemplateField />

        <div className="border-t border-[var(--border)]/60 pt-2.5">
          <div className="grid gap-3 pb-2.5 @lg:grid-cols-2">
            <label className="min-w-0 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[0.6875rem] font-semibold">{localizeUi("chat.toolbar.preset")}</span>
                <HelpTooltip
                  text={localizeUi(
                    "ui.chatSettings.impersonatesection.useASpecificPromptPresetForRoleplayImpersonateGenerations",
                  )}
                />
              </div>
              <select
                value={presetId ?? ""}
                onChange={(event) => setPresetId(event.target.value || null)}
                className="w-full rounded-lg bg-[var(--secondary)]/70 px-2.5 py-1.5 text-xs outline-none ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--secondary)] focus:ring-2 focus:ring-[var(--ring)]"
              >
                <option value="">{localizeUi("ui.chatSettings.impersonatesection.useChatDefault")}</option>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[0.6875rem] font-semibold">
                  {localizeUi("ui.chatSettings.connectionsection.connection")}
                </span>
                <HelpTooltip
                  text={localizeUi(
                    "ui.chatSettings.impersonatesection.useASpecificConnectionModelProviderForImpersonateGenerations",
                  )}
                />
              </div>
              <select
                value={connectionId ?? ""}
                onChange={(event) => setConnectionId(event.target.value || null)}
                className="w-full rounded-lg bg-[var(--secondary)]/70 px-2.5 py-1.5 text-xs outline-none ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--secondary)] focus:ring-2 focus:ring-[var(--ring)]"
              >
                <option value="">{localizeUi("ui.chatSettings.impersonatesection.useChatDefault")}</option>
                <option value="random">{localizeUi("ui.game.gamesurfacecomponent.random")}</option>
                {connections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-1 border-t border-[var(--border)]/60 py-2">
            <SettingsSwitch
              label={localizeUi("ui.chatSettings.impersonatesection.skipAgents")}
              help={localizeUi(
                "ui.chatSettings.impersonatesection.whenEnabledTheAgentPipelineTrackersLorebookRoutersEtc",
              )}
              description={localizeUi("ui.chatSettings.impersonatesection.suppressTrackersRoutersAndOtherAgentWork")}
              helpPosition="label"
              checked={blockAgents}
              onChange={setBlockAgents}
              labelPosition="start"
              className="justify-between rounded-md px-2 py-1.5 text-left"
              labelClassName="text-xs font-semibold"
            />

            <SettingsSwitch
              label={localizeUi("ui.chatSettings.impersonatesection.useCyoaAsDirection")}
              help={localizeUi("ui.chatSettings.impersonatesection.whenEnabledClickingACyoaOptionUsesItAs")}
              description={localizeUi("ui.chatSettings.impersonatesection.treatChoicesAsImpersonateGuidance")}
              helpPosition="label"
              checked={cyoaChoices}
              onChange={setCyoaChoices}
              labelPosition="start"
              className="justify-between rounded-md px-2 py-1.5 text-left"
              labelClassName="text-xs font-semibold"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)]/60 px-2 pt-2">
            <p className="min-w-0 flex-1 text-[0.65rem] leading-snug text-[var(--muted-foreground)]">
              {localizeUi("ui.chatSettings.impersonatesection.enableQuickSendInSettingsGeneralInputEditingQuick")}
            </p>
            <button
              type="button"
              onClick={handleOpenQuickReplySettings}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[0.65rem] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/10"
            >
              {localizeUi("ui.chatSettings.impersonatesection.openSettings")}
              <ArrowRight size="0.6875rem" />
            </button>
          </div>
        </div>
      </div>
    </ChatSettingsSection>
  );
}
