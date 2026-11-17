// ──────────────────────────────────────────────
// UI overhaul: the reasoning toggle ("Thought for Ns ›") by a message's name and time, and the reasoning text it
// opens inline (grey italic, no box). Shared by Roleplay and Conversation messages; it fills in live while a reply
// streams.
// ──────────────────────────────────────────────
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Clock } from "lucide-react";
import { cn } from "../../lib/utils";

/** Shared timer + open state for the reasoning ("Thought for Ns") toggle. */
export function useThinkingToggle(
  isStreaming: boolean,
  outputStarted: boolean,
  keepExpanded: boolean,
  durationMs: number | null,
  short = false,
  /** Start closed even while streaming (the Thinking button picked in Settings > Chatting > Message buttons). */
  startCollapsed = false,
) {
  const { t } = useTranslation();
  const startedAtRef = useRef(Date.now());
  const [expanded, setExpanded] = useState(!startCollapsed && (isStreaming || keepExpanded));
  const [liveDurationMs, setLiveDurationMs] = useState(0);
  const [capturedReasoningDurationMs, setCapturedReasoningDurationMs] = useState<number | null>(null);

  useEffect(() => {
    if (!isStreaming || outputStarted) return;
    startedAtRef.current = Date.now();
    setCapturedReasoningDurationMs(null);
    const updateDuration = () => setLiveDurationMs(Date.now() - startedAtRef.current);
    updateDuration();
    const interval = window.setInterval(updateDuration, 1_000);
    return () => window.clearInterval(interval);
  }, [isStreaming, outputStarted]);

  useLayoutEffect(() => {
    if (!isStreaming || !outputStarted) return;
    const elapsedMs = Date.now() - startedAtRef.current;
    setLiveDurationMs(elapsedMs);
    setCapturedReasoningDurationMs((current) => current ?? elapsedMs);
    if (!keepExpanded) setExpanded(false);
  }, [isStreaming, keepExpanded, outputStarted]);

  const displayedDurationMs = capturedReasoningDurationMs ?? (isStreaming ? liveDurationMs : durationMs);
  const durationLabel =
    displayedDurationMs === null
      ? t("chat.message.thoughts.durationUnknown")
      : t(short ? "chat.message.thoughts.ovDuration" : "chat.message.thoughts.duration", {
          count: Math.max(1, Math.round(displayedDurationMs / 1_000)),
        });
  return { expanded, setExpanded, durationLabel };
}

/** New layout: small "Thought for Ns ›" toggle that sits next to the name and time. */
export function OvThinkingToggle({
  label,
  expanded,
  pulsing,
  controls,
  onToggle,
}: {
  label: string;
  expanded: boolean;
  pulsing: boolean;
  controls: string;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={cn("ov-thought-btn", expanded && "is-on", pulsing && "is-live")}
      data-mari-part="reasoning"
      aria-expanded={expanded}
      aria-controls={expanded ? controls : undefined}
      title={t(expanded ? "chat.message.thoughts.collapse" : "chat.message.thoughts.expand")}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <Clock size={11} aria-hidden="true" />
      <span>{label}</span>
      <ChevronRight size={11} aria-hidden="true" className="ov-thought-btn__chev" />
    </button>
  );
}

/** New layout: the reasoning text itself, grey italic with no box. */
export function OvThinkingText({
  id,
  thinking,
  summaryUnavailable,
}: {
  id: string;
  thinking: string | null;
  summaryUnavailable: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div id={id} data-message-thinking-inline data-mari-part="reasoning-text" className="ov-thought-text">
      {summaryUnavailable ? (
        <>
          <p>{t("chat.message.thoughts.unavailable.title")}</p>
          <p>{t("chat.message.thoughts.unavailable.description")}</p>
        </>
      ) : (
        <pre>{thinking}</pre>
      )}
    </div>
  );
}
