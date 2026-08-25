import type { ReactNode } from "react";
import type { QuestProgress } from "@marinara-engine/shared";
import type { TrackerPanelSizeProfile } from "../../../../../stores/ui.store";
import { TrackerReadabilityVeil } from "../../controls/TrackerProfileChrome";
import { TRACKER_SECTION_SHELL_CLASS } from "../../controls/SectionControls";
import { QuestBoard } from "./QuestBoard";

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
      <TrackerReadabilityVeil strength="strong" />
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
