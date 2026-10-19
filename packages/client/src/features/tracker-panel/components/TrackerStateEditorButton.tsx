// ──────────────────────────────────────────────
// The State Editor's door in the trackers: the control in a tracker window's title bar
//
// Shown in the Trackers window and in every tracker popped out into a window of its own, so the
// editor is reachable from wherever the trackers are read. `mari-window__control` keeps it the same
// size and colour as the window's other buttons (pin, lock, close).
// ──────────────────────────────────────────────
import { Braces } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { GameStateEditorSectionId } from "../../../lib/state-editor/game-state-editor-source";
import { useUIStore } from "../../../stores/ui.store";

export function TrackerStateEditorButton({
  chatId,
  sectionId,
}: {
  chatId: string;
  /** The section this window's tracker edits, so the editor opens on it instead of the first one. */
  sectionId?: GameStateEditorSectionId;
}) {
  const { t } = useTranslation();
  const label = t("ui.trackerPanel.trackersidebarheader.openStateEditor");
  return (
    <button
      type="button"
      data-tracker-window-control="state-editor"
      aria-label={label}
      title={label}
      className="mari-window__control"
      onClick={() => useUIStore.getState().openModal("game-state-editor", { chatId, initialSectionId: sectionId })}
    >
      <Braces size="0.875rem" />
    </button>
  );
}
