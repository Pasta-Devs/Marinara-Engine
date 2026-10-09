// ──────────────────────────────────────────────
// Tracker Panel: Agent activity, a collapsible section like the trackers above it
// ──────────────────────────────────────────────
import { Suspense, lazy } from "react";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { withAgentActivityStatus } from "../../../components/agents/AgentActivityIcon";
import { useUIStore } from "../../../stores/ui.store";
import { SectionHeader, TRACKER_SECTION_SHELL_CLASS } from "./controls/SectionControls";
import { TrackerReadabilityVeil } from "./controls/TrackerProfileChrome";

const AgentActivitySection = lazy(async () => {
  const module = await import("../../../components/agents/AgentActivitySection");
  return { default: module.AgentActivitySection };
});

/** Remembered like Chat Settings drawers; starts collapsed so the trackers stay on top. */
const EXPANDED_KEY = "tracker-panel:agent-activity";

export function TrackerAgentActivitySection({ chatId }: { chatId: string }) {
  const { t } = useTranslation();
  const expanded = useUIStore((s) => s.chatSettingsExpandedSections[EXPANDED_KEY] === true);
  const setExpanded = useUIStore((s) => s.setChatSettingsSectionExpanded);

  return (
    <section data-tracker-section="agent-activity" className={TRACKER_SECTION_SHELL_CLASS}>
      <TrackerReadabilityVeil strength="strong" />
      <div className="relative z-10">
        <SectionHeader
          icon={withAgentActivityStatus(chatId, <Sparkles size="0.6875rem" />)}
          title={t("agents.activity.title")}
          collapsed={!expanded}
          onToggle={() => setExpanded(EXPANDED_KEY, !expanded)}
        />
        {expanded && (
          <Suspense fallback={null}>
            <AgentActivitySection chatId={chatId} trackerPanel />
          </Suspense>
        )}
      </div>
    </section>
  );
}
