import { useTranslation as useUiTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateChatMetadata, chatKeys } from "../../../hooks/use-chats";
import { useRef, useEffect, useState, useCallback } from "react";
import { useUIStore } from "../../../stores/ui.store";
import { api } from "../../../lib/api-client";
import { toast } from "sonner";
import { Bot, RefreshCw } from "lucide-react";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { cn } from "../../../lib/utils";
import { DraftNumberInput } from "../../../components/ui/DraftNumberInput";
import { ConversationTimeZoneSelect } from "../../../components/chat/ConversationTimeZoneSelect";
import { type Chat, type WeekSchedule } from "@marinara-engine/shared";
import { ChatSettingsSection } from "../ChatSettingsSection";

interface AutonomousMessagingSectionProps {
  chat: Chat;
  metadata: Record<string, unknown>;
  chatCharIds: string[];
  charNameMap: Map<string, string>;
  open: boolean;
  /** Required, not optional: the "autonomous" link from the presence card opens and scrolls to this section. */
  initialSection: string | null | undefined;
  isConversation: boolean;
  onOpenScheduleEditor?: (characterId: string) => void;
}

export function AutonomousMessagingSection({
  chat,
  metadata,
  chatCharIds,
  charNameMap,
  open,
  initialSection,
  isConversation,
  onOpenScheduleEditor,
}: AutonomousMessagingSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const qc = useQueryClient();
  const updateMeta = useUpdateChatMetadata();
  const scheduleControlsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open || initialSection !== "autonomous" || !isConversation) return;
    const frame = window.requestAnimationFrame(() => {
      scheduleControlsRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialSection, isConversation, open]);
  const hasGeneratedConversationSchedules =
    !!metadata.characterSchedules &&
    typeof metadata.characterSchedules === "object" &&
    Object.keys(metadata.characterSchedules).length > 0;
  const conversationSchedulesEnabled =
    metadata.conversationSchedulesEnabled === true ||
    (metadata.conversationSchedulesEnabled == null && hasGeneratedConversationSchedules);
  const autonomousDailyCapOverride =
    typeof metadata.autonomousDailyCapOverride === "number" && Number.isFinite(metadata.autonomousDailyCapOverride)
      ? Math.max(1, Math.floor(metadata.autonomousDailyCapOverride))
      : null;
  const [isRegeneratingSchedules, setIsRegeneratingSchedules] = useState(false);
  // Synchronous lock to close the re-entry gap: React state commits are async, so two
  // fast clicks can both pass the `isRegeneratingSchedules` check before the state updates.
  const isRegeneratingSchedulesRef = useRef(false);
  const scheduleGenerationAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => scheduleGenerationAbortRef.current?.abort(), [chat.id, open]);
  type ScheduleGenerationResult = { status: string; schedule?: Record<string, unknown> };
  type ScheduleGenerationResponse = {
    results?: Record<string, ScheduleGenerationResult>;
    schedules?: Record<string, unknown>;
  };
  const generateConversationSchedules = useCallback(
    async (forceRefresh = false) => {
      if (isRegeneratingSchedulesRef.current) return;
      isRegeneratingSchedulesRef.current = true;
      setIsRegeneratingSchedules(true);
      const controller = new AbortController();
      scheduleGenerationAbortRef.current = controller;
      try {
        const scheduleGenerationPreferences = useUIStore.getState().scheduleGenerationPreferences;
        const conversationTimeZone = useUIStore.getState().conversationTimeZone;
        const result = await api.post<ScheduleGenerationResponse>(
          "/conversation/schedule/generate",
          {
            chatId: chat.id,
            characterIds: chatCharIds,
            forceRefresh,
            scheduleGenerationPreferences,
            timeZone: conversationTimeZone,
          },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        await qc.refetchQueries({ queryKey: chatKeys.detail(chat.id) });
        await qc.invalidateQueries({ queryKey: chatKeys.list() });
        await qc.invalidateQueries({ queryKey: ["conversation-status", chat.id] });

        const statuses = Object.values(result.results ?? {}).map((entry) => entry.status);
        const generatedCount = statuses.filter((status) => status === "generated").length;
        const sharedCount = statuses.filter((status) => status === "shared").length;
        const freshCount = statuses.filter((status) => status === "fresh").length;
        const skippedCount = statuses.filter((status) => status === "skipped_assistant").length;
        const errorMessages = statuses
          .filter((status) => status.startsWith("error:"))
          .map((status) => status.slice("error:".length).trim())
          .filter(Boolean);

        if (errorMessages.length > 0) {
          const prefix = errorMessages[0]?.startsWith("Refused to fetch")
            ? "Connection failed"
            : "Schedule generation failed";
          const summary = `${prefix}: ${errorMessages[0]}`;
          if (generatedCount + sharedCount + freshCount > 0) {
            toast.error(
              localizeUi("ui.chat.chatsettingsdrawer.value1Value2GeneratedValue3ReusedValue4AlreadyFresh", {
                value1: summary,
                value2: generatedCount,
                value3: sharedCount,
                value4: freshCount,
              }),
            );
          } else {
            toast.error(summary);
          }
          return;
        }

        if (generatedCount > 0 || sharedCount > 0) {
          const parts: string[] = [];
          if (generatedCount > 0) parts.push(`${generatedCount} generated`);
          if (sharedCount > 0) parts.push(`${sharedCount} reused`);
          if (freshCount > 0) parts.push(`${freshCount} already fresh`);
          if (skippedCount > 0) parts.push(`${skippedCount} skipped`);
          toast.success(localizeUi("ui.chat.chatsettingsdrawer.schedulesReadyValue1", { value1: parts.join(", ") }));
          return;
        }

        if (freshCount > 0) {
          toast.info(
            localizeUi("ui.chat.chatsettingsdrawer.schedulesAreAlreadyUpToDateValue1", {
              value1:
                freshCount > 1
                  ? localizeUi("ui.chat.chatsettingsdrawer.forValue1Characters", { value1: freshCount })
                  : "",
            }),
          );
          return;
        }

        if (skippedCount > 0) {
          toast.info(localizeUi("ui.chat.chatsettingsdrawer.noSchedulesWereNeededForTheSelectedCharacters"));
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        toast.error(
          error instanceof Error ? error.message : localizeUi("ui.chat.chatsettingsdrawer.failedToGenerateSchedules"),
        );
      } finally {
        scheduleGenerationAbortRef.current = null;
        isRegeneratingSchedulesRef.current = false;
        setIsRegeneratingSchedules(false);
      }
    },
    [chat.id, chatCharIds, qc, localizeUi],
  );
  return (
    <ChatSettingsSection
      id="conversation-autonomous-messaging"
      label={localizeUi("ui.chat.chatsettingsdrawer.autonomousMessaging")}
      icon={<Bot size="0.875rem" />}
      help={localizeUi("ui.chat.chatsettingsdrawer.charactersCanMessageYouUnpromptedBasedOnTheirPersonality")}
      forceOpen={initialSection === "autonomous"}
    >
      <div className="space-y-2">
        {/* Enable autonomous messages toggle */}
        <div className="overflow-hidden rounded-md">
          <SettingsSwitch
            label={localizeUi("ui.chat.chatsettingsdrawer.autonomousMessages")}
            description={localizeUi("ui.chat.chatsettingsdrawer.charactersMessageYouWhenYouReInactiveEvenWithout")}
            checked={Boolean(metadata.autonomousMessages)}
            onChange={(autonomousMessages) => updateMeta.mutate({ id: chat.id, autonomousMessages })}
            labelPosition="start"
            className={cn(
              "justify-between rounded-md px-3 py-2.5 text-left",
              metadata.autonomousMessages
                ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
            )}
            labelClassName="text-xs font-medium"
          />

          {Boolean(metadata.autonomousMessages) && (
            <div className="border-t border-[var(--border)]/50 px-3 pb-2.5 pt-2">
              <div className="space-y-1.5">
                <span className="block text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                  {localizeUi("ui.chat.chatsettingsdrawer.chatCheckInCap")}
                </span>
                <select
                  aria-label={localizeUi("ui.chat.chatsettingsdrawer.chatCheckInCapMode")}
                  value={autonomousDailyCapOverride === null ? "default" : "numeric"}
                  onChange={(e) =>
                    updateMeta.mutate({
                      id: chat.id,
                      autonomousDailyCapOverride:
                        e.target.value === "numeric" ? (autonomousDailyCapOverride ?? 8) : null,
                    })
                  }
                  className="mari-chrome-field w-full !rounded-md px-3 py-2 text-xs"
                >
                  <option value="default">
                    {localizeUi("ui.chat.chatsettingsdrawer.defaultChatCeilingTalkativenessBased")}
                  </option>
                  <option value="numeric">{localizeUi("ui.chat.chatsettingsdrawer.numericValue")}</option>
                </select>
                {autonomousDailyCapOverride !== null && (
                  <label className="flex items-center justify-between gap-3 rounded-md bg-[var(--background)]/35 px-2.5 py-2">
                    <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                      {localizeUi("ui.chat.chatsettingsdrawer.checkInsPerDay")}
                    </span>
                    <DraftNumberInput
                      value={autonomousDailyCapOverride}
                      min={1}
                      onCommit={(value) =>
                        updateMeta.mutate({
                          id: chat.id,
                          autonomousDailyCapOverride: value,
                        })
                      }
                      ariaLabel="Numeric chat check-in ceiling"
                      className="mari-chrome-field w-24 !rounded-md px-2 py-1.5 text-right text-xs"
                    />
                  </label>
                )}
                <p className="text-[0.55rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.chat.chatsettingsdrawer.setsTheChatWideCeilingCharacterCapsCanOnly")}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Character exchanges toggle (group chats only) */}
        {chatCharIds.length > 1 && (
          <SettingsSwitch
            label={localizeUi("ui.chat.chatsettingsdrawer.characterExchanges")}
            description={localizeUi("ui.chat.chatsettingsdrawer.charactersChatWithEachOtherInGroupChats")}
            checked={Boolean(metadata.characterExchanges)}
            onChange={(characterExchanges) => updateMeta.mutate({ id: chat.id, characterExchanges })}
            labelPosition="start"
            className={cn(
              "justify-between rounded-md px-3 py-2.5 text-left",
              metadata.characterExchanges
                ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
                : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
            )}
            labelClassName="text-xs font-medium"
          />
        )}

        {/* Conversation schedules toggle */}
        <SettingsSwitch
          label={localizeUi("ui.chat.chatsettingsdrawer.schedules")}
          description={localizeUi("ui.chat.chatsettingsdrawer.optionalCharacterRoutinesForAvailabilityAndDelays")}
          checked={conversationSchedulesEnabled}
          onChange={(nextEnabled) => updateMeta.mutate({ id: chat.id, conversationSchedulesEnabled: nextEnabled })}
          labelPosition="start"
          className={cn(
            "justify-between rounded-md px-3 py-2.5 text-left",
            conversationSchedulesEnabled
              ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
              : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
          )}
          labelClassName="text-xs font-medium"
        />

        <div ref={scheduleControlsRef} className="scroll-mt-2 space-y-2">
          {/* Schedule status */}
          <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <span className="text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
                {!conversationSchedulesEnabled
                  ? localizeUi("ui.chat.chatsettingsdrawer.schedulesAreOffAutonomyUsesTalkativenessAndYourStatus")
                  : hasGeneratedConversationSchedules
                    ? localizeUi("ui.chat.chatsettingsdrawer.schedulesGeneratedStatusIsDerivedFromCharacterRoutines")
                    : localizeUi("ui.chat.chatsettingsdrawer.schedulesEnabledGenerateRoutinesWhenYouReReady")}
              </span>
              <p className="text-[0.59375rem] mt-0.5 text-[var(--muted-foreground)]/60">
                {conversationSchedulesEnabled
                  ? localizeUi("schedule.sharedRoutines.help")
                  : localizeUi("ui.chat.chatsettingsdrawer.turnSchedulesOnIfYouWantAvailabilityAndBusy")}
              </p>
            </div>
            <button
              onClick={async () => {
                await generateConversationSchedules(true);
              }}
              disabled={isRegeneratingSchedules || chatCharIds.length === 0}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[0.625rem] font-medium transition-colors",
                isRegeneratingSchedules || chatCharIds.length === 0
                  ? "cursor-not-allowed text-[var(--muted-foreground)]/60"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
              )}
              title={
                isRegeneratingSchedules
                  ? localizeUi("ui.chat.chatsettingsdrawer.regeneratingSchedules")
                  : localizeUi("ui.chat.chatsettingsdrawer.generateSchedules")
              }
            >
              <RefreshCw size="0.6875rem" className={cn(isRegeneratingSchedules && "animate-spin")} />
              {isRegeneratingSchedules
                ? localizeUi("ui.chat.chatsettingsdrawer.regenerating")
                : hasGeneratedConversationSchedules
                  ? localizeUi("ui.agents.secretplotpanel.regenerate")
                  : localizeUi("ui.characters.characterclipcard.generate")}
            </button>
          </div>

          <div className="rounded-lg bg-[var(--secondary)]/55 px-3 py-2.5 ring-1 ring-[var(--border)]/80">
            <ConversationTimeZoneSelect compact containerQueries />
          </div>

          {hasGeneratedConversationSchedules && onOpenScheduleEditor && (
            <div className="mt-2 space-y-1.5">
              <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                {localizeUi("ui.chat.chatsettingsdrawer.editSchedules")}
              </span>
              {chatCharIds.map((charId) => {
                const schedule = (metadata.characterSchedules as Record<string, WeekSchedule> | undefined)?.[charId];
                const scheduledDayCount = schedule?.days
                  ? Object.values(schedule.days).filter((blocks) => Array.isArray(blocks) && blocks.length > 0).length
                  : 0;
                return (
                  <button
                    key={charId}
                    type="button"
                    onClick={() => onOpenScheduleEditor(charId)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent)]/50"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {charNameMap.get(charId) ?? "Unknown"}
                    </span>
                    <span className="shrink-0 text-[0.625rem] text-[var(--muted-foreground)]">
                      {schedule
                        ? localizeUi("ui.chat.chatsettingsdrawer.value1DayValue2Scheduled", {
                            value1: scheduledDayCount,
                            value2: scheduledDayCount === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
                          })
                        : localizeUi("ui.chat.chatsettingsdrawer.createSchedule")}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ChatSettingsSection>
  );
}
