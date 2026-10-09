// ──────────────────────────────────────────────
// Agent activity's icon: a spinner while the chat's agents work, and a dot after
// one fails, until Agent activity has been on screen (#7322)
//
// It wraps each surface's own icon (Chat Settings, the Trackers window, the
// Tracker Panel), so the drawer, its popped-out window and its bubble all show
// it. Themes style `.mari-agent-activity-icon`.
// ──────────────────────────────────────────────
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { selectUnseenAgentFailureCount, useAgentStore } from "../../stores/agent.store";

function AgentActivityIcon({ chatId, icon }: { chatId: string; icon: ReactNode }) {
  const { t } = useTranslation();
  const running = useAgentStore((s) => s.processingChatIds.includes(chatId));
  const failed = useAgentStore((s) => selectUnseenAgentFailureCount(s, chatId));
  return (
    <span
      data-running={running ? "true" : undefined}
      data-failed={failed > 0 ? "true" : undefined}
      // The spinner takes the icon's place and size.
      className={cn(
        "mari-agent-activity-icon relative inline-flex shrink-0",
        running && "[&>svg:first-child]:invisible",
      )}
    >
      {icon}
      {running && <Loader2 aria-hidden="true" className="absolute inset-0 h-full w-full motion-safe:animate-spin" />}
      {failed > 0 && (
        // The theme's accent held steady: a failure never pulses with Accent Pulse.
        <span
          aria-hidden="true"
          className="mari-agent-activity-icon__dot pointer-events-none absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--marinara-app-accent-static)]"
        />
      )}
      {running && <span className="sr-only">{t("chat.agentsRunning")}</span>}
      {failed > 0 && <span className="sr-only">{t("agents.activity.failed", { count: failed })}</span>}
    </span>
  );
}

/**
 * A surface's Agent activity icon with its status. A call rather than a tag, so the chat window icon
 * regression still sees each surface's own icon.
 */
export function withAgentActivityStatus(chatId: string, icon: ReactNode): ReactNode {
  return <AgentActivityIcon chatId={chatId} icon={icon} />;
}
