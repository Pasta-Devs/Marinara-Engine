import { CheckCircle2, Circle, X } from "lucide-react";
import type { QuestProgress } from "../../../../../engine/contracts/types/game-state";
import { cn } from "../../../../../shared/lib/utils";
import { InlineEdit } from "../tracker-data-sidebar.controls";
import { visibleText } from "../tracker-display.helpers";

type QuestObjective = QuestProgress["objectives"][number];

export function QuestObjectiveRow({
  objective,
  objectiveGridColumns,
  previewLineCount,
  wrapClass,
  wrapsText,
  onRemove,
  onToggle,
  onUpdate,
  deleteMode,
}: {
  objective: QuestObjective;
  objectiveGridColumns: string;
  previewLineCount: 2 | 3 | undefined;
  wrapClass: string;
  wrapsText: boolean;
  onRemove?: () => void;
  onToggle?: () => void;
  onUpdate?: (text: string) => void;
  deleteMode: boolean;
}) {
  return (
    <div
      className={cn(
        "tracker-quest-objective-row",
        wrapsText ? "tracker-quest-objective-row--wrapped" : "tracker-quest-objective-row--single-line",
        objectiveGridColumns,
      )}
    >
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "tracker-quest-objective-row__toggle",
            wrapsText && "tracker-quest-objective-row__toggle--wrapped",
            objective.completed && "tracker-quest-objective-row__toggle--completed",
          )}
          title={objective.completed ? "Mark incomplete" : "Mark complete"}
          aria-label={objective.completed ? "Mark objective incomplete" : "Mark objective complete"}
        >
          {objective.completed ? <CheckCircle2 size="0.6875rem" /> : <Circle size="0.6875rem" />}
        </button>
      ) : objective.completed ? (
        <span className="tracker-quest-objective-row__status tracker-quest-objective-row__status--completed">
          <CheckCircle2 size="0.6875rem" />
        </span>
      ) : (
        <span className="tracker-quest-objective-row__status">
          <Circle size="0.6875rem" />
        </span>
      )}
      {onUpdate ? (
        <InlineEdit
          value={objective.text}
          onSave={(text) => onUpdate(text || "Objective")}
          placeholder="Objective"
          title={`Objective: ${visibleText(objective.text, "Objective")}`}
          showEditHint={false}
          previewLineCount={previewLineCount}
          editHintMode={wrapsText ? "overlay" : "inline"}
          className={cn(
            "tracker-quest-objective-row__edit",
            wrapsText
              ? "tracker-quest-objective-row__edit--wrapped"
              : "tracker-quest-objective-row__edit--single-line",
            objective.completed && "tracker-quest-objective-row__edit--completed",
          )}
        />
      ) : (
        <span
          className={cn(
            "tracker-quest-objective-row__text",
            wrapClass,
            objective.completed && "tracker-quest-objective-row__text--completed",
          )}
        >
          {visibleText(objective.text, "Objective")}
        </span>
      )}
      {onRemove && deleteMode && (
        <button
          type="button"
          onClick={onRemove}
          className="tracker-quest-objective-row__remove"
          title="Remove objective"
          aria-label="Remove objective"
        >
          <X size="0.5rem" />
        </button>
      )}
    </div>
  );
}
