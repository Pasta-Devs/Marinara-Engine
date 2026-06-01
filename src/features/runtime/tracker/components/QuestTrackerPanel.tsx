import type { ReactNode } from "react";
import type { QuestProgress } from "../../../../engine/contracts/types/game-state";
import type { TrackerPanelSizeProfile } from "../../../../shared/stores/ui.store";
import { TrackerReadabilityVeil } from "./tracker-data-sidebar.controls";
import { QuestBoard } from "./quest-tracker/QuestBoard";

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
  onUpdateQuest: (questEntryId: string, quest: QuestProgress) => void;
  onRemoveQuest: (questEntryId: string) => void;
  deleteMode: boolean;
  addMode: boolean;
  trackerPanelSizeProfile: TrackerPanelSizeProfile;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  return (
    <section className="relative z-10 overflow-hidden border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_6%,transparent)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_4%,transparent)]">
      <TrackerReadabilityVeil />
      {!collapsed && (
        <div className="pointer-events-none absolute inset-x-1 bottom-1 top-6 z-0 opacity-[0.1] [background-image:radial-gradient(circle,color-mix(in_srgb,var(--foreground)_42%,transparent)_1px,transparent_1.25px)] [background-size:5px_5px]" />
      )}
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
