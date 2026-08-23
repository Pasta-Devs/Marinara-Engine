import { CheckCircle2, Lock, Plus, Target, Unlock, X } from "lucide-react";
import {
  isTrackerFieldLocked,
  removeTrackerFieldLockPrefix,
  questObjectiveTrackerLockKey,
  questObjectiveTrackerLockPrefix,
  questTrackerLockKey,
  renameTrackerFieldLockPrefix,
  type QuestProgress,
} from "@marinara-engine/shared";
import { cn } from "../../../../../lib/utils";
import { TRACKER_BAR } from "../../../lib/tracker-panel.constants";
import { visibleText } from "../../../lib/tracker-display";
import { InlineEdit } from "../../controls/InlineControls";
import { useTrackerLockContext } from "../../TrackerLockContext";
import { getQuestTextWrapClass, type QuestTextLineCount } from "./quest-layout";
import { QuestObjectiveRow } from "./QuestObjectiveRow";
import { useTranslation as useUiTranslation } from "react-i18next";

const QUEST_CARD_CLASS =
  "group/quest relative mx-1 overflow-hidden rounded-sm border border-[var(--border)]/30 bg-[var(--tracker-panel-card-background,color-mix(in_srgb,var(--background)_22%,transparent))] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_5%,transparent)]";
const QUEST_CARD_TOP_RULE_CLASS = "pointer-events-none absolute inset-x-0 top-0 h-px bg-[var(--foreground)]/10";
const QUEST_HEADER_CLASS = "relative grid min-h-5 grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-1 px-1 py-0.5";
const QUEST_HEADER_DELETE_CLASS = "grid-cols-[1rem_minmax(0,1fr)_auto_1rem]";
const QUEST_TOGGLE_BUTTON_CLASS =
  "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-emerald-400/65 transition-colors hover:bg-emerald-400/10 hover:text-emerald-300";
const QUEST_STATIC_ICON_CLASS = "flex h-4 w-4 shrink-0 items-center justify-center text-emerald-400/65";
const QUEST_TITLE_EDIT_CLASS =
  "w-full min-w-0 overflow-hidden px-0.5 py-0 text-[0.75rem] font-semibold text-[var(--foreground)]/92 hover:bg-[var(--accent)]/20";
const QUEST_TITLE_EDIT_WRAPPED_CLASS = "min-h-5 py-0.5 leading-[1.12]";
const QUEST_TITLE_EDIT_SINGLE_LINE_CLASS = "h-5 leading-5";
const QUEST_TITLE_TEXT_CLASS = "min-w-0 text-[0.75rem] font-semibold";
const QUEST_COMPLETION_BADGE_CLASS =
  "shrink-0 rounded-sm border border-[var(--border)]/32 bg-[var(--background)]/18 px-1 py-0.5 text-[0.5625rem] font-semibold uppercase leading-none tabular-nums text-[var(--foreground)]/68";
const QUEST_REMOVE_BUTTON_CLASS =
  "flex h-4 w-4 items-center justify-center rounded-sm text-[var(--destructive)] transition-all hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border)] active:scale-90";
const QUEST_PROGRESS_TRACK_CLASS = cn("relative mx-1 overflow-hidden bg-[var(--border)]/28", TRACKER_BAR);
const QUEST_PROGRESS_FILL_CLASS = "h-full rounded-[1px] transition-[width] duration-200";
const OBJECTIVE_LIST_CLASS = "relative mx-1 mb-0.5 mt-0.5 grid gap-px pl-4";
const OBJECTIVE_RAIL_CLASS = "pointer-events-none absolute left-[0.4375rem] top-1 w-px bg-[var(--border)]/28";
const ADD_OBJECTIVE_BUTTON_CLASS =
  "relative grid h-4 w-full grid-cols-[0.875rem_minmax(0,1fr)] items-center gap-1 rounded-[2px] px-0.5 text-left text-[0.6875rem] leading-4 text-[var(--foreground)]/35 transition-colors hover:bg-[var(--foreground)]/8 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border)]";

export function QuestRow({
  quest,
  questIndex,
  onUpdate,
  onRemove,
  deleteMode = false,
  addMode = false,
  textLineCount = 1,
}: {
  quest: QuestProgress;
  questIndex: number;
  onUpdate?: (quest: QuestProgress) => void;
  onRemove?: () => void;
  deleteMode?: boolean;
  addMode?: boolean;
  textLineCount?: QuestTextLineCount;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { fieldLocks, lockMode, onToggleFieldLock, onUpdateFieldLocks } = useTrackerLockContext();
  const completed = quest.objectives.filter((objective) => objective.completed).length;
  const totalObjectives = quest.objectives.length;
  const completionPercent = quest.completed ? 100 : totalObjectives > 0 ? (completed / totalObjectives) * 100 : 0;
  const completionLabel = totalObjectives > 0 ? `${completed}/${totalObjectives}` : quest.completed ? "done" : "open";
  const objectiveGridColumns = deleteMode
    ? "grid-cols-[0.875rem_minmax(0,1fr)_1rem]"
    : "grid-cols-[0.875rem_minmax(0,1fr)]";
  const questTitle = visibleText(quest.name, "Quest");
  const questCompletedLockKey = questTrackerLockKey(quest, questIndex, "completed");
  const questNameLockKey = questTrackerLockKey(quest, questIndex, "name");
  const questCompletedLocked = isTrackerFieldLocked(fieldLocks, questCompletedLockKey);
  const wrapsText = textLineCount > 1;
  const previewLineCount: 2 | 3 | undefined = textLineCount === 1 ? undefined : textLineCount;
  const wrapClass = getQuestTextWrapClass(textLineCount);
  const updateObjective = (index: number, nextText: string) => {
    if (!onUpdate) return;
    const previousObjective = quest.objectives[index];
    const nextObjectives = [...quest.objectives];
    nextObjectives[index] = { ...nextObjectives[index]!, text: nextText };
    if (previousObjective && previousObjective.text !== nextText) {
      onUpdateFieldLocks?.((locks) =>
        renameTrackerFieldLockPrefix(
          locks,
          questObjectiveTrackerLockPrefix(quest, questIndex, previousObjective, index),
          questObjectiveTrackerLockPrefix(quest, questIndex, nextObjectives[index]!, index),
        ),
      );
    }
    onUpdate({ ...quest, objectives: nextObjectives });
  };
  const toggleObjective = (index: number) => {
    if (!onUpdate) return;
    const nextObjectives = [...quest.objectives];
    nextObjectives[index] = { ...nextObjectives[index]!, completed: !nextObjectives[index]!.completed };
    onUpdate({ ...quest, objectives: nextObjectives });
  };
  const removeObjective = (index: number) => {
    if (!onUpdate) return;
    onUpdateFieldLocks?.((locks) =>
      removeTrackerFieldLockPrefix(
        locks,
        questObjectiveTrackerLockPrefix(quest, questIndex, quest.objectives[index]!, index),
      ),
    );
    onUpdate({ ...quest, objectives: quest.objectives.filter((_, objectiveIndex) => objectiveIndex !== index) });
  };
  const addObjective = () => {
    if (!onUpdate) return;
    onUpdate({ ...quest, objectives: [...quest.objectives, { text: "New objective", completed: false }] });
  };

  return (
    <article className={cn(QUEST_CARD_CLASS, quest.completed && "opacity-75")}>
      <div className={QUEST_CARD_TOP_RULE_CLASS} />
      <div className={cn(QUEST_HEADER_CLASS, deleteMode && QUEST_HEADER_DELETE_CLASS)}>
        {onUpdate && (
          <button
            type="button"
            onClick={() =>
              lockMode
                ? onToggleFieldLock?.(questCompletedLockKey)
                : onUpdate({ ...quest, completed: !quest.completed })
            }
            className={cn(
              QUEST_TOGGLE_BUTTON_CLASS,
              quest.completed && !lockMode && "text-emerald-300",
              questCompletedLocked && "ring-1 ring-emerald-300/35",
            )}
            title={
              lockMode
                ? questCompletedLocked
                  ? localizeUi("ui.trackerPanel.questrow.unlockQuestCompletion")
                  : localizeUi("ui.trackerPanel.questrow.lockQuestCompletion")
                : quest.completed
                  ? localizeUi("ui.chat.questcardeditable.markIncomplete")
                  : localizeUi("ui.chat.questcardeditable.markComplete")
            }
            aria-label={
              lockMode
                ? questCompletedLocked
                  ? localizeUi("ui.trackerPanel.questrow.unlockQuestCompletion")
                  : localizeUi("ui.trackerPanel.questrow.lockQuestCompletion")
                : quest.completed
                  ? localizeUi("ui.trackerPanel.questrow.markQuestIncomplete")
                  : localizeUi("ui.trackerPanel.questrow.markQuestComplete")
            }
            aria-pressed={lockMode ? questCompletedLocked : undefined}
          >
            {lockMode ? (
              questCompletedLocked ? (
                <Lock size="0.75rem" />
              ) : (
                <Unlock size="0.75rem" />
              )
            ) : quest.completed ? (
              <CheckCircle2 size="0.75rem" />
            ) : (
              <Target size="0.75rem" />
            )}
          </button>
        )}
        {!onUpdate && (
          <span className={QUEST_STATIC_ICON_CLASS}>
            {quest.completed ? <CheckCircle2 size="0.75rem" /> : <Target size="0.75rem" />}
          </span>
        )}
        {onUpdate ? (
          <InlineEdit
            value={quest.name}
            onSave={(name) => onUpdate({ ...quest, name: name || "Quest" })}
            placeholder={localizeUi("ui.trackerPanel.questrow.quest")}
            title={localizeUi("ui.trackerPanel.questrow.questValue1", { value1: questTitle })}
            showEditHint={false}
            fitPreview={!wrapsText}
            previewLineCount={previewLineCount}
            className={cn(
              QUEST_TITLE_EDIT_CLASS,
              wrapsText ? QUEST_TITLE_EDIT_WRAPPED_CLASS : QUEST_TITLE_EDIT_SINGLE_LINE_CLASS,
              quest.completed && "line-through opacity-60",
            )}
            locked={isTrackerFieldLocked(fieldLocks, questNameLockKey)}
            lockMode={lockMode}
            onToggleLock={() => onToggleFieldLock?.(questNameLockKey)}
          />
        ) : (
          <div
            className={cn(
              QUEST_TITLE_TEXT_CLASS,
              wrapsText ? cn(wrapClass, "leading-[1.12]") : "truncate",
              quest.completed && "text-[var(--muted-foreground)] line-through",
            )}
          >
            {questTitle}
          </div>
        )}
        <span className={QUEST_COMPLETION_BADGE_CLASS}>{completionLabel}</span>
        {onRemove && deleteMode && (
          <button
            type="button"
            onClick={onRemove}
            className={QUEST_REMOVE_BUTTON_CLASS}
            title={localizeUi("ui.trackerPanel.questrow.removeQuest")}
            aria-label={localizeUi("ui.trackerPanel.charactertrackercard.removeValue1", {
              value1: visibleText(quest.name, "quest"),
            })}
          >
            <X size="0.625rem" />
          </button>
        )}
      </div>

      <div className={QUEST_PROGRESS_TRACK_CLASS}>
        <div
          className={cn(QUEST_PROGRESS_FILL_CLASS, quest.completed ? "bg-emerald-300/85" : "bg-emerald-400/70")}
          style={{ width: `${completionPercent}%` }}
        />
      </div>

      {(quest.objectives.length > 0 || (onUpdate && addMode)) && (
        <div className={OBJECTIVE_LIST_CLASS}>
          <span className={cn(OBJECTIVE_RAIL_CLASS, addMode ? "bottom-4" : "bottom-1")} />
          {quest.objectives.map((objective, index) => (
            <QuestObjectiveRow
              key={`${objective.text}-${index}`}
              objective={objective}
              deleteMode={deleteMode}
              objectiveGridColumns={objectiveGridColumns}
              previewLineCount={previewLineCount}
              wrapClass={wrapClass}
              wrapsText={wrapsText}
              onToggle={onUpdate ? () => toggleObjective(index) : undefined}
              onUpdateText={onUpdate ? (text) => updateObjective(index, text) : undefined}
              onRemove={onUpdate && deleteMode ? () => removeObjective(index) : undefined}
              textLockKey={questObjectiveTrackerLockKey(quest, questIndex, objective, "text", index)}
              completedLockKey={questObjectiveTrackerLockKey(quest, questIndex, objective, "completed", index)}
            />
          ))}
          {onUpdate && addMode && (
            <button
              type="button"
              onClick={addObjective}
              className={ADD_OBJECTIVE_BUTTON_CLASS}
              title={localizeUi("ui.trackerPanel.questrow.addObjective")}
              aria-label={localizeUi("ui.trackerPanel.questrow.addObjective")}
            >
              <Plus size="0.625rem" className="justify-self-center" />
              <span className="truncate font-medium">{localizeUi("ui.trackerPanel.questobjectiverow.objective")}</span>
            </button>
          )}
        </div>
      )}
    </article>
  );
}
