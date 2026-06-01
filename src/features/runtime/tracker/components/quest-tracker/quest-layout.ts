import type { TrackerPanelSizeProfile } from "../../../../../shared/stores/ui.store";

export type QuestTextLineCount = 1 | 2 | 3;

export function getQuestTextLineCount(profile: TrackerPanelSizeProfile, questCount: number): QuestTextLineCount {
  if (profile === "expanded") return questCount <= 1 ? 3 : 2;
  if (profile === "standard") return 2;
  return questCount <= 1 ? 2 : 1;
}

export function getQuestTextWrapClass(lineCount: QuestTextLineCount) {
  if (lineCount === 3) return "tracker-quest-row__text--wrap-3";
  if (lineCount === 2) return "tracker-quest-row__text--wrap-2";
  return "tracker-quest-row__text--single-line";
}
