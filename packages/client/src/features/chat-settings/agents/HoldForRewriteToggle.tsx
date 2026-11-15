import { useTranslation as useUiTranslation } from "react-i18next";
import { AgentSettingsToggle } from "../../../components/chat/AgentSettingsControls";

/** Prose Guardian, Continuity and HTML share one hold-for-rewrite setting, so each of their cards shows this switch. */
export function HoldForRewriteToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <AgentSettingsToggle
      label={localizeUi("ui.chat.agentaddsetupfields.holdMessageUntilRewrite")}
      description={
        enabled
          ? localizeUi("ui.chat.agentaddsetupfields.showTheRewriteWorkingIndicatorThenRevealTheEdited")
          : localizeUi("ui.chat.chatsettingsdrawer.streamTheOriginalMessageNormallyThenReplaceItWhen")
      }
      enabled={enabled}
      onToggle={onToggle}
    />
  );
}
