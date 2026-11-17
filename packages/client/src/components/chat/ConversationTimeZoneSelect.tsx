import { useCallback, useId, useMemo, useRef, useState } from "react";
import { Check, Clock3, LocateFixed } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../../lib/api-client";
import { conversationStatusKeys } from "../../hooks/use-chats";
import {
  detectConversationTimeZone,
  formatConversationTimeZone,
  listConversationTimeZones,
} from "../../lib/conversation-time-zone";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Select } from "../ui/Select";
import { Spinner } from "../ui/Spinner";

type ConversationTimeZoneSelectProps = {
  className?: string;
  compact?: boolean;
  /** Lay out by the surrounding container's width (the Chat Settings window) instead of the screen's. */
  containerQueries?: boolean;
};

export function ConversationTimeZoneSelect({
  className,
  compact = false,
  containerQueries = false,
}: ConversationTimeZoneSelectProps) {
  const { t: localizeUi } = useUiTranslation();
  const selectId = useId();
  const queryClient = useQueryClient();
  const conversationTimeZone = useUIStore((state) => state.conversationTimeZone);
  const setConversationTimeZone = useUIStore((state) => state.setConversationTimeZone);
  const [isSaving, setIsSaving] = useState(false);
  const requestIdRef = useRef(0);
  const detectedTimeZone = useMemo(() => detectConversationTimeZone(), []);
  const timeZones = useMemo(() => listConversationTimeZones(conversationTimeZone), [conversationTimeZone]);
  const timeZoneOptions = useMemo(
    () => timeZones.map((timeZone) => ({ timeZone, label: formatConversationTimeZone(timeZone) })),
    [timeZones],
  );
  const saveTimeZone = useCallback(
    async (nextTimeZone: string, previousTimeZone: string) => {
      const requestId = ++requestIdRef.current;
      setIsSaving(true);
      try {
        await api.put("/conversation/schedule/timezone", { timeZone: nextTimeZone });
        await Promise.all([
          queryClient.invalidateQueries({
            predicate: (query) =>
              query.queryKey[0] === "chats" && (query.queryKey[1] === "list" || query.queryKey[1] === "detail"),
          }),
          queryClient.invalidateQueries({ queryKey: conversationStatusKeys.all }),
        ]);
      } catch (error) {
        if (requestId === requestIdRef.current) {
          setConversationTimeZone(previousTimeZone);
          toast.error(
            error instanceof Error
              ? error.message
              : localizeUi("ui.chat.conversationtimezoneselect.failedToSaveTheConversationTimezone"),
          );
        }
      } finally {
        if (requestId === requestIdRef.current) setIsSaving(false);
      }
    },
    [queryClient, setConversationTimeZone, localizeUi],
  );

  const selectTimeZone = (nextTimeZone: string) => {
    if (nextTimeZone === conversationTimeZone) return;
    const previousTimeZone = conversationTimeZone;
    setConversationTimeZone(nextTimeZone);
    void saveTimeZone(nextTimeZone, previousTimeZone);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <label htmlFor={selectId} className="inline-flex items-center gap-1.5 text-xs font-medium">
          <Clock3 size="0.75rem" className="text-[var(--muted-foreground)]" />
          {localizeUi("ui.chat.conversationtimezoneselect.scheduleTimezone")}
        </label>
        <span className="inline-flex items-center gap-1 text-[0.59375rem] max-sm:text-[13px] text-[var(--muted-foreground)]">
          {isSaving ? <Spinner size="sm" /> : <Check size="0.625rem" />}
          {isSaving
            ? localizeUi("ui.noodle.noodlehome.saving")
            : localizeUi("ui.chat.conversationtimezoneselect.allConversations")}
        </span>
      </div>

      <div
        className={cn(
          "grid gap-2",
          conversationTimeZone !== detectedTimeZone &&
            (containerQueries ? "@lg:grid-cols-[minmax(0,1fr)_auto]" : "sm:grid-cols-[minmax(0,1fr)_auto]"),
        )}
      >
        <Select
          id={selectId}
          label={localizeUi("ui.chat.conversationtimezoneselect.scheduleTimezone")}
          value={conversationTimeZone}
          disabled={isSaving}
          options={timeZoneOptions.map(({ timeZone, label }) => ({ value: timeZone, label }))}
          onChange={selectTimeZone}
          className={cn(
            "min-h-10 max-sm:min-h-11 max-sm:text-base w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 text-[0.6875rem] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/60 focus:ring-2 focus:ring-[var(--primary)]/20 disabled:cursor-wait disabled:opacity-60",
            compact && "min-h-9 bg-[var(--background)]",
          )}
        />

        {conversationTimeZone !== detectedTimeZone && (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => selectTimeZone(detectedTimeZone)}
            className="inline-flex min-h-10 max-sm:min-h-11 max-sm:text-[13px] items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-[0.6875rem] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-wait disabled:opacity-60"
          >
            <LocateFixed size="0.75rem" /> {localizeUi("ui.chat.conversationtimezoneselect.useDevice")}
          </button>
        )}
      </div>

      <p className="text-[0.59375rem] max-sm:text-[13px] leading-4 text-[var(--muted-foreground)]/80">
        {localizeUi("ui.chat.conversationtimezoneselect.availabilityAndAutonomousMessagesFollowThisTimezoneYourDevice")}{" "}
        {detectedTimeZone}.
      </p>
    </div>
  );
}
