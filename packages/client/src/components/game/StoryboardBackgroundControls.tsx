import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { CHAT_TOOLBAR_ICON_GAP_CLASS, getChatToolbarButtonClass } from "../chat/ChatToolbarControls";
import { cn } from "../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";

interface StoryboardBackgroundControlsProps {
  mobile?: boolean;
  playing: boolean;
  muted: boolean;
  onReplay: () => void;
  onTogglePlayback: () => void;
  onToggleMute: () => void;
}

export function StoryboardBackgroundControls({
  mobile = false,
  playing,
  muted,
  onReplay,
  onTogglePlayback,
  onToggleMute,
}: StoryboardBackgroundControlsProps) {
  const { t: localizeUi } = useUiTranslation();
  const controlClassName = getChatToolbarButtonClass({ compact: mobile });

  return (
    <div
      data-storyboard-background-controls
      className={cn(
        "flex items-center",
        CHAT_TOOLBAR_ICON_GAP_CLASS,
        mobile ? "" : "rounded-lg bg-black/45 p-1 shadow-sm ring-1 ring-white/10",
      )}
      role="group"
      aria-label={localizeUi("ui.game.storyboardbackgroundcontrols.storyboardBackgroundAnimation")}
    >
      <button
        type="button"
        onClick={onReplay}
        className={controlClassName}
        title={localizeUi("ui.game.storyboardbackgroundcontrols.replayBackgroundAnimation")}
        aria-label={localizeUi("ui.game.storyboardbackgroundcontrols.replayBackgroundAnimation")}
      >
        <RotateCcw size={14} />
      </button>
      <button
        type="button"
        onClick={onTogglePlayback}
        className={controlClassName}
        title={
          playing
            ? localizeUi("ui.game.storyboardbackgroundcontrols.pauseBackgroundAnimation")
            : localizeUi("ui.game.storyboardbackgroundcontrols.playBackgroundAnimation")
        }
        aria-label={
          playing
            ? localizeUi("ui.game.storyboardbackgroundcontrols.pauseBackgroundAnimation")
            : localizeUi("ui.game.storyboardbackgroundcontrols.playBackgroundAnimation")
        }
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <button
        type="button"
        onClick={onToggleMute}
        className={controlClassName}
        title={
          muted
            ? localizeUi("ui.game.storyboardbackgroundcontrols.unmuteBackgroundAnimation")
            : localizeUi("ui.game.storyboardbackgroundcontrols.muteBackgroundAnimation")
        }
        aria-label={
          muted
            ? localizeUi("ui.game.storyboardbackgroundcontrols.unmuteBackgroundAnimation")
            : localizeUi("ui.game.storyboardbackgroundcontrols.muteBackgroundAnimation")
        }
      >
        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
    </div>
  );
}
