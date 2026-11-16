import { type Chat, type Message } from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useUpdateChatMetadata } from "../../../hooks/use-chats";
import { AgentSettingsToggle } from "../../../components/chat/AgentSettingsControls";
import { DraftNumberInput } from "../../../components/ui/DraftNumberInput";
import { SecretPlotPanel } from "../../../components/agents/SecretPlotPanel";

interface DirectorSettingsProps {
  chat: Chat;
  agentProcessing: boolean;
  supportsNarrativeDirectorSecretPlot: boolean;
  narrativeDirectorSecretPlotEnabled: boolean;
  narrativeDirectorSecretPlotRunInterval: number;
  secretPlotMessages: Message[];
}

export function DirectorSettings({
  chat,
  agentProcessing,
  supportsNarrativeDirectorSecretPlot,
  narrativeDirectorSecretPlotEnabled,
  narrativeDirectorSecretPlotRunInterval,
  secretPlotMessages,
}: DirectorSettingsProps) {
  const { t: localizeUi } = useUiTranslation();
  const updateMeta = useUpdateChatMetadata();
  return (
    <>
      <p className="rounded-lg bg-[var(--background)]/45 px-2.5 py-2 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
        {localizeUi("ui.chat.agentaddsetupfields.chooseBetweenANaturalOrRandomPushEachTime")}
      </p>
      {supportsNarrativeDirectorSecretPlot && (
        <div className="mt-2 space-y-2">
          <AgentSettingsToggle
            label={localizeUi("ui.agents.agenteditor.secretPlot")}
            description={localizeUi("ui.chat.chatsettingsdrawer.maintainAHiddenLongTermArcForThisRoleplay")}
            enabled={narrativeDirectorSecretPlotEnabled}
            onToggle={() =>
              updateMeta.mutate({
                id: chat.id,
                narrativeDirectorSecretPlotEnabled: !narrativeDirectorSecretPlotEnabled,
              })
            }
          />
          {narrativeDirectorSecretPlotEnabled && (
            <>
              <label className="block rounded-lg bg-[var(--background)]/45 px-2.5 py-2 ring-1 ring-[var(--border)]">
                <span className="mb-1 block text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                  {localizeUi("ui.agents.agenteditor.runInterval")}
                </span>
                <div className="flex items-center gap-2">
                  <DraftNumberInput
                    value={narrativeDirectorSecretPlotRunInterval}
                    min={1}
                    max={100}
                    onCommit={(value) =>
                      updateMeta.mutate({
                        id: chat.id,
                        narrativeDirectorSecretPlotRunInterval: value,
                      })
                    }
                    className="w-24 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs tabular-nums text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
                  />
                  <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.agents.agenteditor.assistantMessages")}
                  </span>
                </div>
              </label>
              <SecretPlotPanel chatId={chat.id} messages={secretPlotMessages} isAgentProcessing={agentProcessing} />
            </>
          )}
        </div>
      )}
    </>
  );
}
