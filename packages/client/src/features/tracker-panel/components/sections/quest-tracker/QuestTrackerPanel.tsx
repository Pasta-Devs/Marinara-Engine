import type { ReactNode } from "react";
import type { QuestProgress } from "@marinara-engine/shared";
import type { TrackerPanelSizeProfile } from "../../../../../stores/ui.store";
import { TrackerReadabilityVeil } from "../../controls/TrackerProfileChrome";
import { TRACKER_SECTION_SHELL_CLASS } from "../../controls/SectionControls";
import { QuestBoard } from "./QuestBoard";

const QUEST_PANEL_TEXTURE_CLASS =
  "pointer-events-none absolute inset-x-1 bottom-1 top-6 z-0 opacity-[0.1] [background-image:radial-gradient(circle,color-mix(in_srgb,var(--foreground)_42%,transparent)_1px,transparent_1.25px)] [background-size:5px_5px]";

export function QuestTrackerPanel({
  quests,
  action,
  onAddQuest,
  onUpdateQuest,
  onRemoveQuest,
  deleteMode,
  addMode,
  trackerPanelSizeProfile,
  collapsed = false,
  onToggleCollapsed,
}: {
  quests: QuestProgress[];
  action?: ReactNode;
  onAddQuest: () => void;
  onUpdateQuest: (index: number, quest: QuestProgress) => void;
  onRemoveQuest: (index: number) => void;
  deleteMode: boolean;
  addMode: boolean;
  trackerPanelSizeProfile: TrackerPanelSizeProfile;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  return (
    <section className={TRACKER_SECTION_SHELL_CLASS}>
      <TrackerReadabilityVeil />
      {!collapsed && <div className={QUEST_PANEL_TEXTURE_CLASS} />}
      <QuestBoard
        quests={quests}
        action={action}
        onAddQuest={onAddQuest}
        onUpdateQuest={onUpdateQuest}
        onRemoveQuest={onRemoveQuest}
        deleteMode={deleteMode}
        addMode={addMode}
        trackerPanelSizeProfile={trackerPanelSizeProfile}
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
      />
    </section>
  );
}
