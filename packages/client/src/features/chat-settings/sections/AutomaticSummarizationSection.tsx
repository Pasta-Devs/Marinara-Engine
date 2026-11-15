import {
  type Chat,
  normalizeSemanticSummaryRetrievalSettings,
  CHAT_SUMMARY_OUTPUT_TOKENS,
  SUMMARY_TAIL_MESSAGES,
} from "@marinara-engine/shared";
import { useTranslation as useUiTranslation, useTranslation } from "react-i18next";
import { useUpdateChatMetadata } from "../../../hooks/use-chats";
import { useSidecarStore } from "../../../stores/sidecar.store";
import { useState, useEffect } from "react";
import { CalendarClock, Pencil, AlertTriangle } from "lucide-react";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { cn } from "../../../lib/utils";
import { AGENT_SETTINGS_SURFACE_CLASS } from "../../../components/chat/AgentSettingsControls";
import {
  SemanticSummaryRetrievalControls,
  type SemanticSummaryRetrievalControlField,
} from "../../../components/chat/SemanticSummaryRetrievalControls";
import { ConnectionSelect } from "../../../components/connections/ConnectionSelect";
import { DraftNumberInput } from "../../../components/ui/DraftNumberInput";
import { ChatSettingsSection } from "../ChatSettingsSection";

interface AutomaticSummarizationSectionProps {
  chat: Chat;
  metadata: Record<string, unknown>;
  setShowSummariesModal: (open: boolean) => void;
  isGame: boolean;
}

export function AutomaticSummarizationSection({
  chat,
  metadata,
  setShowSummariesModal,
  isGame,
}: AutomaticSummarizationSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const updateMeta = useUpdateChatMetadata();
  const sidecarModelDownloaded = useSidecarStore((state) => state.modelDownloaded);
  const summaryRetrievalSettings = normalizeSemanticSummaryRetrievalSettings(metadata);
  const conversationSummaryConnectionId =
    typeof metadata.summaryConnectionId === "string" ? metadata.summaryConnectionId : "";
  // Session-ephemeral: did the user change Day Rollover Hour in this drawer mount?
  // Used to gate the "transitional duplication" warning so it only appears
  // immediately after a change (when the warning is operationally useful) and
  // doesn't permanently clutter chats that already have summaries.
  const [rolloverTouchedThisSession, setRolloverTouchedThisSession] = useState(false);
  useEffect(() => {
    setRolloverTouchedThisSession(false);
  }, [chat.id]);
  return (
    <ChatSettingsSection
      id="conversation-automatic-summarization"
      label={localizeUi("ui.chat.chatsettingsdrawer.automaticSummarization")}
      icon={<CalendarClock size="0.875rem" />}
      help={localizeUi("ui.chat.chatsettingsdrawer.toHelpKeepTheRequestContextLowTheConversation")}
    >
      <div className="space-y-2.5">
        <button
          onClick={() => setShowSummariesModal(true)}
          className="flex w-full items-center justify-between rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-left transition-all hover:bg-[var(--accent)]"
        >
          <div className="flex-1 min-w-0">
            <span className="text-[0.6875rem] font-medium">
              {localizeUi("ui.chat.chatsettingsdrawer.editSummaries")}
            </span>
            <p className="text-[0.625rem] text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.chatsettingsdrawer.reviewAndEditWhatCharactersRememberFromThisChat")}
            </p>
          </div>
          <Pencil size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
        </button>

        {import.meta.env.VITE_MARINARA_LITE !== "true" && (
          <SettingsSwitch
            label={localizeUi("ui.chat.chatsettingsdrawer.semanticSummaryRetrieval")}
            description={localizeUi(
              "ui.chat.chatsettingsdrawer.keepRecentSummariesInContextAndRetrieveOnlyRelevantOlder",
            )}
            checked={metadata.semanticSummaryRetrievalEnabled === true}
            onChange={(semanticSummaryRetrievalEnabled) =>
              updateMeta.mutate({ id: chat.id, semanticSummaryRetrievalEnabled })
            }
            labelPosition="start"
            className={cn(
              "justify-between rounded-lg px-3 py-2.5 text-left",
              metadata.semanticSummaryRetrievalEnabled === true
                ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                : cn(AGENT_SETTINGS_SURFACE_CLASS, "hover:bg-[var(--accent)]"),
            )}
            labelClassName="text-xs font-medium"
          />
        )}
        {import.meta.env.VITE_MARINARA_LITE !== "true" && (
          <SemanticSummaryRetrievalControls
            enabled={metadata.semanticSummaryRetrievalEnabled === true}
            recentCount={summaryRetrievalSettings.semanticSummaryRecentCount}
            olderCount={summaryRetrievalSettings.semanticSummaryOlderCount}
            minSimilarity={summaryRetrievalSettings.semanticSummaryMinSimilarity}
            recentLabel={localizeUi("ui.chat.chatsettingsdrawer.recentWeeks")}
            olderLabel={localizeUi("ui.chat.chatsettingsdrawer.olderWeeks")}
            thresholdLabel={localizeUi("ui.chat.chatsettingsdrawer.summaryRelevanceThreshold")}
            onChange={(field: SemanticSummaryRetrievalControlField, value) =>
              updateMeta.mutate({ id: chat.id, [field]: value })
            }
          />
        )}

        <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/35 p-2.5">
          <div className="space-y-1.5">
            <span className="text-xs font-medium">
              {localizeUi("ui.chat.summarypopover.summaryConnection_febe5c4")}
            </span>
            <ConnectionSelect
              job={t("connections.picker.job.summary")}
              value={conversationSummaryConnectionId || null}
              onChange={(connectionId) => updateMeta.mutate({ id: chat.id, summaryConnectionId: connectionId })}
              includeLocalSidecar={!isGame && sidecarModelDownloaded}
              defaultLabel={localizeUi("chat.summary.connection.agentDefaultFallback")}
              inherits="agents"
              aria-label={localizeUi("ui.chat.summarypopover.summaryConnection_febe5c4")}
            />
            <p className="text-[0.625rem] text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.summarypopover.chooseTheModelConnectionUsedForManualAndAutomatic")}
            </p>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium">{localizeUi("ui.chat.summarypopover.maximumOutputSize")}</span>
            <DraftNumberInput
              value={
                typeof metadata.summaryMaxTokens === "number"
                  ? metadata.summaryMaxTokens
                  : CHAT_SUMMARY_OUTPUT_TOKENS.DEFAULT
              }
              min={CHAT_SUMMARY_OUTPUT_TOKENS.MIN}
              max={CHAT_SUMMARY_OUTPUT_TOKENS.MAX}
              onCommit={(value) =>
                updateMeta.mutate({
                  id: chat.id,
                  summaryMaxTokens: value,
                })
              }
              ariaLabel={localizeUi("ui.chat.summarypopover.summaryMaximumOutputSize")}
              className="mari-chrome-field w-full !rounded-md px-3 py-2 text-xs"
            />
          </div>
        </div>

        {/* Day rollover hour */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium">{localizeUi("ui.chat.chatsettingsdrawer.dayRolloverHour")}</span>
          <select
            value={(metadata.dayRolloverHour as number | undefined) ?? 4}
            onChange={(e) => {
              setRolloverTouchedThisSession(true);
              updateMeta.mutate({ id: chat.id, dayRolloverHour: Number(e.target.value) });
            }}
            className="mari-chrome-field w-full !rounded-md px-3 py-2 text-xs"
          >
            {Array.from({ length: 12 }, (_, h) => {
              const label = h === 0 ? "12 AM (midnight)" : `${h} AM`;
              return (
                <option key={h} value={h}>
                  {label}
                </option>
              );
            })}
          </select>
          <p className="text-[0.625rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.chatsettingsdrawer.messagesSentBeforeThisHourCountAsPartOf")}
          </p>
          {rolloverTouchedThisSession &&
            (((metadata.daySummaries as Record<string, unknown> | undefined) &&
              Object.keys(metadata.daySummaries as Record<string, unknown>).length > 0) ||
              ((metadata.weekSummaries as Record<string, unknown> | undefined) &&
                Object.keys(metadata.weekSummaries as Record<string, unknown>).length > 0)) && (
              <div className="flex items-start gap-1.5 rounded-md bg-amber-400/10 px-2 py-1.5 ring-1 ring-amber-400/20">
                <AlertTriangle size="0.75rem" className="mt-[0.125rem] shrink-0 text-amber-400/80" />
                <p className="text-[0.625rem] text-amber-400/80 leading-snug">
                  {localizeUi("ui.chat.chatsettingsdrawer.existingSummariesWereBuiltWithThePreviousSettingFor")}{" "}
                  <span className="font-medium">{localizeUi("ui.chat.chatsettingsdrawer.editSummaries")}</span>{" "}
                  {localizeUi("ui.chat.chatsettingsdrawer.above")}
                </p>
              </div>
            )}
        </div>

        {/* Recent message tail */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium">{localizeUi("ui.chat.chatsettingsdrawer.recentMessageTail")}</span>
          <DraftNumberInput
            value={(metadata.summaryTailMessages as number | undefined) ?? SUMMARY_TAIL_MESSAGES.DEFAULT}
            min={SUMMARY_TAIL_MESSAGES.MIN}
            onCommit={(value) =>
              updateMeta.mutate({
                id: chat.id,
                summaryTailMessages: value,
              })
            }
            ariaLabel="Recent message tail"
            className="mari-chrome-field w-full !rounded-md px-3 py-2 text-xs"
          />
          <p className="text-[0.625rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.chatsettingsdrawer.howManyRecentMessagesToKeepWordForWord")}{" "}
            <span className="font-medium">0</span>{" "}
            {localizeUi("ui.chat.chatsettingsdrawer.toDisableHigherValuesIncreasePromptSizeAndModel")}
          </p>
        </div>
      </div>
    </ChatSettingsSection>
  );
}
