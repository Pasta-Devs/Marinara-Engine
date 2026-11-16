import { useTranslation as useUiTranslation } from "react-i18next";
import { AgentSettingsActionButton } from "../../../components/chat/AgentSettingsControls";
import { useUIStore } from "../../../stores/ui.store";
import { Settings2 } from "lucide-react";

interface EchoChamberSettingsProps {
  promptTemplateSelect: React.ReactNode;
  closeForSurface: () => void;
}

export function EchoChamberSettings({ promptTemplateSelect, closeForSurface }: EchoChamberSettingsProps) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <>
      {promptTemplateSelect}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
        <p className="min-w-0 flex-1 text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.chatsettingsdrawer.promptModeControlsTheFictionalAudienceStyleUsedFor")}
        </p>
        <AgentSettingsActionButton
          onClick={() => {
            closeForSurface();
            useUIStore.getState().openAgentDetail("echo-chamber");
          }}
          className="shrink-0"
        >
          <Settings2 size="0.75rem" />
          <span>{localizeUi("ui.chat.chatsettingsdrawer.openSetup")}</span>
        </AgentSettingsActionButton>
      </div>
    </>
  );
}
