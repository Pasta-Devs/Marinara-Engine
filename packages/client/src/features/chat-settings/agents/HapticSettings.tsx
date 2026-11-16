import { type Chat, type HapticFeedbackSensitivity } from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useUpdateChatMetadata } from "../../../hooks/use-chats";
import { AgentSettingsToggle, AgentSettingsSegmentedControl } from "../../../components/chat/AgentSettingsControls";
import { HAPTIC_SENSITIVITY_OPTIONS } from "../../../components/chat/haptic-sensitivity-options";
import { HapticConnectionPanel } from "./HapticConnectionPanel";

interface HapticSettingsProps {
  chat: Chat;
  metadata: Record<string, any>;
}

export function HapticSettings({ chat, metadata }: HapticSettingsProps) {
  const { t: localizeUi } = useUiTranslation();
  const updateMeta = useUpdateChatMetadata();
  const hapticSensitivity: HapticFeedbackSensitivity =
    metadata.hapticSensitivity === "subtle" || metadata.hapticSensitivity === "intense"
      ? metadata.hapticSensitivity
      : "standard";
  return (
    <>
      <AgentSettingsToggle
        label={localizeUi("ui.chat.hapticsetupfields.hapticFeedback")}
        description={
          metadata.enableHapticFeedback
            ? localizeUi("ui.chat.hapticsetupfields.touchCuesAreEnabledForThisChat")
            : localizeUi("ui.chat.hapticsetupfields.allowThisAgentToSendTouchCuesDuringThe")
        }
        enabled={metadata.enableHapticFeedback}
        onToggle={() => updateMeta.mutate({ id: chat.id, enableHapticFeedback: !metadata.enableHapticFeedback })}
      />
      {metadata.enableHapticFeedback && (
        <>
          <div className="space-y-2 rounded-lg bg-[var(--background)]/75 p-2.5 ring-1 ring-[var(--border)]">
            <div className="space-y-1">
              <span className="text-[0.6875rem] font-semibold text-[var(--foreground)]">
                {localizeUi("ui.chat.chatsettingsdrawer.touchSensitivity")}
              </span>
              <AgentSettingsSegmentedControl<HapticFeedbackSensitivity>
                value={hapticSensitivity}
                columns={3}
                options={HAPTIC_SENSITIVITY_OPTIONS.map((option) => ({
                  id: option.id,
                  label: localizeUi(option.labelKey),
                }))}
                onChange={(hapticSensitivity) => updateMeta.mutate({ id: chat.id, hapticSensitivity })}
              />
            </div>
            <AgentSettingsToggle
              label={localizeUi("ui.chat.chatsettingsdrawer.incidentalContact")}
              description={localizeUi("ui.chat.hapticsetupfields.tinyTapsForAccidentalBrushesAndBumps")}
              enabled={metadata.hapticIncidentalContact === true}
              onToggle={() =>
                updateMeta.mutate({
                  id: chat.id,
                  hapticIncidentalContact: metadata.hapticIncidentalContact !== true,
                })
              }
            />
          </div>
          <HapticConnectionPanel
            intifaceUrl={typeof metadata.hapticIntifaceUrl === "string" ? metadata.hapticIntifaceUrl : undefined}
            onIntifaceUrlChange={(hapticIntifaceUrl) => updateMeta.mutate({ id: chat.id, hapticIntifaceUrl })}
          />
        </>
      )}
    </>
  );
}
