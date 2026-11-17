// ──────────────────────────────────────────────
// Store: the guide card showing in the docs viewer (AI basics and Deep dives).
//
// One quest at a time. Starting one opens its guide; the docs viewer (Docs tab or Docs modal) shows the
// card at the quest's passage while that guide is open. Runtime only: a reload ends the tour, and the
// quests stay where they are in Home's lists.
// ──────────────────────────────────────────────
import { create } from "zustand";
import { GUIDE_QUEST_BY_ID } from "../lib/guide-quests";
import { useUIStore } from "./ui.store";

interface GuideCardState {
  /** The quest whose card is showing, if any. */
  questId: string | null;
  /** Bumped on each start, so the viewer scrolls to the passage again even for the same quest. */
  startedAt: number;
  close: () => void;
}

export const useGuideCardStore = create<GuideCardState>()((set) => ({
  questId: null,
  startedAt: 0,
  close: () => set({ questId: null }),
}));

/** Opens a quest's guide with its card. */
export function startGuideQuest(id: string) {
  const quest = GUIDE_QUEST_BY_ID.get(id);
  if (!quest) return;
  useGuideCardStore.setState({ questId: id, startedAt: Date.now() });
  useUIStore.getState().openModal("docs-viewer", { initialDoc: quest.guide });
}
