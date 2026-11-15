import { useTranslation as useUiTranslation } from "react-i18next";
import { AgentSettingsActionButton } from "../../../components/chat/AgentSettingsControls";
import { useUIStore } from "../../../stores/ui.store";
import { Settings2 } from "lucide-react";

interface CardEvolutionAuditorSettingsProps {
  closeForSurface: () => void;
}

export function CardEvolutionAuditorSettings({ closeForSurface }: CardEvolutionAuditorSettingsProps) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="space-y-2 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
      <p className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.thisAgentNeverEditsCardsDirectlyItProposesExact")}
      </p>
      <AgentSettingsActionButton
        onClick={() => {
          closeForSurface();
          useUIStore.getState().openAgentDetail("card-evolution-auditor");
        }}
        variant="primary"
      >
        <Settings2 size="0.75rem" />
        <span>{localizeUi("ui.chat.chatsettingsdrawer.openAuditorSetup")}</span>
      </AgentSettingsActionButton>
    </div>
  );
}
