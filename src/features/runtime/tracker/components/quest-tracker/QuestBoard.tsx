import { Target } from "lucide-react";
import type { ReactNode } from "react";
import type { TrackerPanelSizeProfile } from "../../../../../shared/stores/ui.store";
import type { QuestProgress } from "../../../../../engine/contracts/types/game-state";
import { cn } from "../../../../../shared/lib/utils";
import { AddRowButton, SectionHeader } from "../tracker-data-sidebar.controls";
import { TRACKER_TEXT_ROW } from "../tracker-data-sidebar.constants";
import { getQuestTextLineCount } from "./quest-layout";
import { QuestRow } from "./QuestRow";

export function QuestBoard({
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
  const completedQuests = quests.filter((quest) => quest.completed).length;
  const activeQuests = quests.length - completedQuests;
  const questTextLineCount = getQuestTextLineCount(trackerPanelSizeProfile, quests.length);

  return (
    <div className="relative z-10 overflow-hidden pb-0.5">
      <SectionHeader
        icon={<Target size="0.6875rem" />}
        title="Quest Board"
        badge={`${completedQuests}/${quests.length}`}
        badgeTitle={`${completedQuests} done, ${activeQuests} active`}
        action={action}
        addAction={
          addMode ? <AddRowButton title="Add quest" onClick={onAddQuest} className="h-4 w-4 rounded-sm" /> : undefined
        }
        collapsed={collapsed}
        onToggle={onToggleCollapsed}
      />

      {!collapsed &&
        (quests.length === 0 ? (
          <div className={cn("relative px-1 py-1 text-[var(--foreground)]/35", TRACKER_TEXT_ROW)}>
            Quest board empty.
          </div>
        ) : (
          <div className={cn("relative grid gap-0.5 pt-0.5", quests.length > 1 && "@min-[380px]:grid-cols-2")}>
            {quests.map((quest) => (
              <QuestRow
                key={quest.questEntryId}
                quest={quest}
                onUpdate={(updated) => onUpdateQuest(quest.questEntryId, updated)}
                onRemove={() => onRemoveQuest(quest.questEntryId)}
                deleteMode={deleteMode}
                addMode={addMode}
                textLineCount={questTextLineCount}
              />
            ))}
          </div>
        ))}
    </div>
  );
}
