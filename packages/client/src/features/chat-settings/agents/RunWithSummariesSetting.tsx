// "Run with summaries" for Lorebook Keeper and Card Evolution Auditor: the agent runs on the same reply as each
// automatic summary instead of on its own count, so everything that changes the prompt lands on one turn and the
// prompt cache breaks once per summary. For the Auditor, card edits approved later wait for the next summary turn.
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  CARD_EVOLUTION_RUN_WITH_SUMMARIES_KEY,
  LOREBOOK_KEEPER_RUN_WITH_SUMMARIES_KEY,
  readHeldCardUpdates,
} from "@marinara-engine/shared";
import { useUpdateChatMetadata } from "../../../hooks/use-chats";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { cn } from "../../../lib/utils";

/** Same rule as the server: automatic summaries on, by the chat switch or the retired Chat Summary agent. */
function automaticSummariesOn(metadata: Record<string, unknown>): boolean {
  if (metadata.automaticSummaryEnabled === false) return false;
  if (metadata.automaticSummaryEnabled === true) return true;
  const active = Array.isArray(metadata.activeAgentIds) ? metadata.activeAgentIds : [];
  return metadata.enableAgents === true && active.includes("chat-summary");
}

export function RunWithSummariesSetting({
  chatId,
  metadata,
  agent,
}: {
  chatId: string;
  metadata: Record<string, unknown>;
  agent: "lorebook-keeper" | "card-evolution-auditor";
}) {
  const { t: localizeUi } = useUiTranslation();
  const updateMeta = useUpdateChatMetadata();
  const settingKey =
    agent === "lorebook-keeper" ? LOREBOOK_KEEPER_RUN_WITH_SUMMARIES_KEY : CARD_EVOLUTION_RUN_WITH_SUMMARIES_KEY;
  const on = metadata[settingKey] === true;
  const summariesOn = automaticSummariesOn(metadata);
  const heldCount = agent === "card-evolution-auditor" ? readHeldCardUpdates(metadata).length : 0;
  return (
    <div className="space-y-1.5" data-run-with-summaries={agent}>
      <SettingsSwitch
        label={localizeUi("ui.chat.chatsettingsdrawer.runWithSummaries")}
        description={localizeUi(
          agent === "lorebook-keeper"
            ? "ui.chat.chatsettingsdrawer.runWithSummariesKeeperDescription"
            : "ui.chat.chatsettingsdrawer.runWithSummariesAuditorDescription",
        )}
        checked={on}
        onChange={(checked) => updateMeta.mutate({ id: chatId, [settingKey]: checked })}
        labelPosition="start"
        className={cn(
          "justify-between rounded-lg px-3 py-2.5 text-left",
          on
            ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
            : "bg-[var(--background)]/75 ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
        )}
        labelClassName="text-xs font-medium"
      />
      {on && !summariesOn && (
        <p className="px-1 text-[0.625rem] leading-snug text-[var(--muted-foreground)]" data-run-with-summaries-off>
          {localizeUi("ui.chat.chatsettingsdrawer.runWithSummariesNeedsSummaries")}
        </p>
      )}
      {heldCount > 0 && (
        <p className="px-1 text-[0.625rem] leading-snug text-[var(--muted-foreground)]" data-held-card-updates>
          {localizeUi("ui.chat.chatsettingsdrawer.heldCardUpdates", { count: heldCount })}
        </p>
      )}
    </div>
  );
}
