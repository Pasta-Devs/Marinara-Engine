import { useCallback, useId, useMemo, useRef, useState } from "react";
import { Check, Clock3, Loader2, LocateFixed } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../../lib/api-client";
import {
  detectConversationTimeZone,
  formatConversationTimeZone,
  listConversationTimeZones,
} from "../../lib/conversation-time-zone";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";

type ConversationTimeZoneSelectProps = {
  className?: string;
  compact?: boolean;
};

export function ConversationTimeZoneSelect({ className, compact = false }: ConversationTimeZoneSelectProps) {
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
          queryClient.invalidateQueries({ queryKey: ["conversation-status"] }),
        ]);
      } catch (error) {
        if (requestId === requestIdRef.current) {
          setConversationTimeZone(previousTimeZone);
          toast.error(error instanceof Error ? error.message : "Failed to save the Conversation timezone");
        }
      } finally {
        if (requestId === requestIdRef.current) setIsSaving(false);
      }
    },
    [queryClient, setConversationTimeZone],
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
          Schedule timezone
        </label>
        <span className="inline-flex items-center gap-1 text-[0.59375rem] text-[var(--muted-foreground)]">
          {isSaving ? <Loader2 size="0.625rem" className="animate-spin" /> : <Check size="0.625rem" />}
          {isSaving ? "Saving" : "All conversations"}
        </span>
      </div>

      <div
        className={cn(
          "grid gap-2",
          conversationTimeZone !== detectedTimeZone && "sm:grid-cols-[minmax(0,1fr)_auto]",
        )}
      >
        <select
          id={selectId}
          value={conversationTimeZone}
          disabled={isSaving}
          onChange={(event) => selectTimeZone(event.target.value)}
          className={cn(
            "min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 text-[0.6875rem] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/60 focus:ring-2 focus:ring-[var(--primary)]/20 disabled:cursor-wait disabled:opacity-60",
            compact && "min-h-9 bg-[var(--background)]",
          )}
        >
          {timeZoneOptions.map(({ timeZone, label }) => (
            <option key={timeZone} value={timeZone}>
              {label}
            </option>
          ))}
        </select>

        {conversationTimeZone !== detectedTimeZone && (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => selectTimeZone(detectedTimeZone)}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-[0.6875rem] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-wait disabled:opacity-60"
          >
            <LocateFixed size="0.75rem" /> Use device
          </button>
        )}
      </div>

      <p className="text-[0.59375rem] leading-4 text-[var(--muted-foreground)]/80">
        Availability and autonomous messages follow this timezone. Your device currently reports {detectedTimeZone}.
      </p>
    </div>
  );
}
