// ──────────────────────────────────────────────
// New layout on phones: the tracker's scene strip
//
// One thin line under the top bar with where and when the scene is and who is
// present. Tapping it opens the Tracker sheet; tapping again closes it.
// ──────────────────────────────────────────────
import { ChevronDown, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTrackerGameState } from "../../features/tracker-panel/hooks/use-tracker-game-state";
import { closeTrackerPanel } from "../../lib/tracker-panel-surface";
import { TRACKER_PANEL_BUBBLE_ID, useFloatingWindowStore } from "../../stores/floating-window.store";

const MAX_FACES = 3;

export function OverhaulMobileTrackerStrip({ chatId }: { chatId: string }) {
  const { t } = useTranslation();
  const { currentGameState } = useTrackerGameState(chatId);
  const open = useFloatingWindowStore((state) => state.open[TRACKER_PANEL_BUBBLE_ID] === true);
  const people = Array.isArray(currentGameState?.presentCharacters) ? currentGameState.presentCharacters : [];
  const scene = [currentGameState?.location, currentGameState?.time, currentGameState?.weather]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .join(" · ");
  const label = t("chat.trackerWindow.title");

  return (
    <button
      type="button"
      className="ovm-trk-strip"
      data-tracker-panel-toggle="strip"
      aria-expanded={open}
      aria-label={scene ? `${label}: ${scene}` : label}
      onClick={() => {
        if (open) closeTrackerPanel();
        else useFloatingWindowStore.getState().openWindow(TRACKER_PANEL_BUBBLE_ID, null, { focus: false });
      }}
    >
      <MapPin size={14} className="ovm-trk-strip__pin" aria-hidden="true" />
      <span className="ovm-trk-strip__scene">{scene || label}</span>
      {people.length > 0 ? (
        <span className="ovm-trk-strip__faces" aria-hidden="true">
          {people.slice(0, MAX_FACES).map((person, index) => (
            <span key={`${person.characterId || person.name}-${index}`} className="ovm-trk-strip__face">
              {person.avatarPath ? (
                <img src={person.avatarPath} alt="" loading="lazy" />
              ) : (
                Array.from(person.emoji || person.name.trim() || "?")[0]
              )}
            </span>
          ))}
          {people.length > MAX_FACES ? (
            <span className="ovm-trk-strip__face ovm-trk-strip__face--more">+{people.length - MAX_FACES}</span>
          ) : null}
        </span>
      ) : null}
      <ChevronDown size={16} className="ovm-trk-strip__chev" aria-hidden="true" />
    </button>
  );
}
