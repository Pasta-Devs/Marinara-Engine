// ──────────────────────────────────────────────
// Agents running: a small dot shown while the chat's agents work
//
// Sits on the Chat Settings topbar button (described through `id`) and in the
// Trackers window header (`inline`, labelled itself). It pulses unless motion is
// reduced. Themes style `.mari-agents-running-dot`.
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

const DOT_CLASS =
  "mari-agents-running-dot pointer-events-none h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--marinara-chat-chrome-button-text-active,var(--primary))] motion-safe:animate-pulse";

export function AgentsRunningDot({
  id,
  inline = false,
  className,
}: {
  id?: string;
  inline?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const label = t("chat.agentsRunning");
  if (inline) {
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        data-agents-running
        className={cn(DOT_CLASS, "inline-block", className)}
      />
    );
  }
  // A button's dot: the button points at the hidden text with aria-describedby.
  return (
    <span data-agents-running className={cn(DOT_CLASS, "absolute", className)}>
      <span id={id} className="sr-only">
        {label}
      </span>
    </span>
  );
}
