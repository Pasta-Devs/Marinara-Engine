import { CheckCircle2, Plus, Target, X } from "lucide-react";
import type { QuestProgress } from "../../../../../engine/contracts/types/game-state";
import { cn } from "../../../../../shared/lib/utils";
import {
  addQuestObjective,
  removeQuestObjective,
  toggleQuestObjectiveCompletion,
  updateQuestObjectiveText,
} from "../../../world-state/index";
import { TRACKER_BAR } from "../tracker-data-sidebar.constants";
import { InlineEdit } from "../tracker-data-sidebar.controls";
import { visibleText } from "../tracker-display.helpers";
import { QuestObjectiveRow } from "./QuestObjectiveRow";
import { getQuestTextWrapClass, type QuestTextLineCount } from "./quest-layout";
import "./QuestRow.css";

export function QuestRow({
  quest,
  onUpdate,
  onRemove,
  deleteMode = false,
  addMode = false,
  textLineCount = 1,
}: {
  quest: QuestProgress;
  onUpdate?: (quest: QuestProgress) => void;
  onRemove?: () => void;
  deleteMode?: boolean;
  addMode?: boolean;
  textLineCount?: QuestTextLineCount;
}) {
  const completed = quest.objectives.filter((objective) => objective.completed).length;
  const totalObjectives = quest.objectives.length;
  const completionPercent = quest.completed ? 100 : totalObjectives > 0 ? (completed / totalObjectives) * 100 : 0;
  const completionLabel = totalObjectives > 0 ? `${completed}/${totalObjectives}` : quest.completed ? "done" : "open";
  const objectiveGridColumns = deleteMode
    ? "grid-cols-[0.875rem_minmax(0,1fr)_1rem]"
    : "grid-cols-[0.875rem_minmax(0,1fr)]";
  const questTitle = visibleText(quest.name, "Quest");
  const wrapsText = textLineCount > 1;
  const previewLineCount: 2 | 3 | undefined = textLineCount === 1 ? undefined : textLineCount;
  const wrapClass = getQuestTextWrapClass(textLineCount);
  const updateObjective = (index: number, nextText: string) => {
    if (!onUpdate) return;
    onUpdate(updateQuestObjectiveText(quest, index, nextText));
  };
  const toggleObjective = (index: number) => {
    if (!onUpdate) return;
    onUpdate(toggleQuestObjectiveCompletion(quest, index));
  };
  const removeObjective = (index: number) => {
    if (!onUpdate) return;
    onUpdate(removeQuestObjective(quest, index));
  };
  const addObjective = () => {
    if (!onUpdate) return;
    onUpdate(addQuestObjective(quest));
  };
  return (
    <article className={cn("group/quest tracker-quest-row", quest.completed && "tracker-quest-row--completed")}>
      <div className="tracker-quest-row__top-rule" />
      <div
        className={cn(
          "relative grid min-h-5 grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-1 px-1 py-0.5",
          deleteMode && "grid-cols-[1rem_minmax(0,1fr)_auto_1rem]",
        )}
      >
        {onUpdate && (
          <button
            type="button"
            onClick={() => onUpdate({ ...quest, completed: !quest.completed })}
            className={cn("tracker-quest-row__toggle", quest.completed && "tracker-quest-row__toggle--completed")}
            title={quest.completed ? "Mark incomplete" : "Mark complete"}
            aria-label={quest.completed ? "Mark quest incomplete" : "Mark quest complete"}
          >
            {quest.completed ? <CheckCircle2 size="0.75rem" /> : <Target size="0.75rem" />}
          </button>
        )}
        {!onUpdate && (
          <span className={cn("tracker-quest-row__status", quest.completed && "tracker-quest-row__toggle--completed")}>
            {quest.completed ? <CheckCircle2 size="0.75rem" /> : <Target size="0.75rem" />}
          </span>
        )}
        {onUpdate ? (
          <InlineEdit
            value={quest.name}
            onSave={(name) => onUpdate({ ...quest, name: name || "Quest" })}
            placeholder="Quest"
            title={`Quest: ${questTitle}`}
            showEditHint={false}
            fitPreview={!wrapsText}
            previewLineCount={previewLineCount}
            editHintMode={wrapsText ? "overlay" : "inline"}
            className={cn(
              "tracker-quest-row__title-edit",
              wrapsText ? "tracker-quest-row__title-edit--wrapped" : "tracker-quest-row__title-edit--single-line",
              quest.completed && "tracker-quest-row__title-edit--completed",
            )}
          />
        ) : (
          <div
            className={cn(
              "tracker-quest-row__title-static",
              wrapClass,
              quest.completed && "tracker-quest-row__title-static--completed",
            )}
          >
            {questTitle}
          </div>
        )}
        <span className="tracker-quest-row__count">{completionLabel}</span>
        {onRemove && deleteMode && (
          <button
            type="button"
            onClick={onRemove}
            className="tracker-quest-row__remove"
            title="Remove quest"
            aria-label="Remove quest"
          >
            <X size="0.625rem" />
          </button>
        )}
      </div>

      <div className={cn("tracker-quest-row__progress", TRACKER_BAR)}>
        <div
          className={cn(
            "tracker-quest-row__progress-fill",
            quest.completed && "tracker-quest-row__progress-fill--complete",
          )}
          style={{ transform: `scaleX(${completionPercent / 100})` }}
        />
      </div>

      {(quest.objectives.length > 0 || (onUpdate && addMode)) && (
        <div className="tracker-quest-row__objective-list">
          <span
            className={cn(
              "tracker-quest-row__objective-connector",
              addMode
                ? "tracker-quest-row__objective-connector--long"
                : "tracker-quest-row__objective-connector--short",
            )}
          />
          {quest.objectives.map((objective, index) => (
            <QuestObjectiveRow
              key={objective.objectiveId || `${objective.text}-${index}`}
              objective={objective}
              objectiveGridColumns={objectiveGridColumns}
              previewLineCount={previewLineCount}
              wrapClass={wrapClass}
              wrapsText={wrapsText}
              onToggle={onUpdate ? () => toggleObjective(index) : undefined}
              onUpdate={onUpdate ? (text) => updateObjective(index, text) : undefined}
              onRemove={onUpdate ? () => removeObjective(index) : undefined}
              deleteMode={deleteMode}
            />
          ))}
          {onUpdate && addMode && (
            <button
              type="button"
              onClick={addObjective}
              className="tracker-quest-row__add-objective"
              title="Add objective"
              aria-label="Add objective"
            >
              <Plus size="0.625rem" className="justify-self-center" />
              <span className="truncate font-medium">Objective</span>
            </button>
          )}
        </div>
      )}
    </article>
  );
}
