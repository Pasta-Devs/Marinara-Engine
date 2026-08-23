import type { CSSProperties } from "react";
import { Volume2, VolumeX, X } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import {
  NEUTRAL_PANEL_CLOSE_BUTTON,
  NEUTRAL_PANEL_CLOSE_ICON_SIZE,
  NEUTRAL_PANEL_SHELL,
} from "../ui/neutral-surface-styles";

interface GameVolumeMixerProps {
  audioMuted: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  ttsVolume: number;
  ambientVolume: number;
  onMasterVolumeChange: (value: number) => void;
  onMusicVolumeChange: (value: number) => void;
  onSfxVolumeChange: (value: number) => void;
  onTtsVolumeChange: (value: number) => void;
  onAmbientVolumeChange: (value: number) => void;
  onToggleMute: () => void;
  onClose: () => void;
  onAudioInteract?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function GameVolumeMixer({
  audioMuted,
  masterVolume,
  musicVolume,
  sfxVolume,
  ttsVolume,
  ambientVolume,
  onMasterVolumeChange,
  onMusicVolumeChange,
  onSfxVolumeChange,
  onTtsVolumeChange,
  onAmbientVolumeChange,
  onToggleMute,
  onClose,
  onAudioInteract,
  className,
  style,
}: GameVolumeMixerProps) {
  const { t: localizeUi } = useUiTranslation();
  const rows = [
    {
      id: "master",
      label: localizeUi("game.toolbar.volume.master"),
      value: masterVolume,
      onChange: onMasterVolumeChange,
    },
    { id: "music", label: localizeUi("game.toolbar.volume.music"), value: musicVolume, onChange: onMusicVolumeChange },
    { id: "sfx", label: localizeUi("game.toolbar.volume.sfx"), value: sfxVolume, onChange: onSfxVolumeChange },
    { id: "tts", label: localizeUi("game.toolbar.volume.tts"), value: ttsVolume, onChange: onTtsVolumeChange },
    {
      id: "ambient",
      label: localizeUi("game.toolbar.volume.ambient"),
      value: ambientVolume,
      onChange: onAmbientVolumeChange,
    },
  ];

  return (
    <div
      data-chat-floating-panel
      className={cn(NEUTRAL_PANEL_SHELL, "w-64 max-w-[calc(100vw-1.5rem)] p-3", className)}
      style={style}
    >
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-[var(--marinara-chat-chrome-panel-divider)] pb-2">
        <span className="text-[0.6875rem] font-semibold uppercase text-[var(--marinara-chat-chrome-panel-muted)]">
          {localizeUi("game.toolbar.volume")}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleMute}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
              audioMuted
                ? "bg-[var(--marinara-chat-chrome-button-bg-active)] text-[var(--marinara-chat-chrome-button-text-active)] ring-1 ring-[var(--marinara-chat-chrome-button-border-active)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)]"
                : "bg-[var(--marinara-chat-chrome-button-bg)] text-[var(--marinara-chat-chrome-button-text)] ring-1 ring-[var(--marinara-chat-chrome-button-border)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]",
            )}
            title={
              audioMuted ? localizeUi("ui.game.gamevolumemixer.unmute") : localizeUi("ui.game.gamevolumemixer.mute")
            }
            aria-label={
              audioMuted ? localizeUi("ui.game.gamevolumemixer.unmute") : localizeUi("ui.game.gamevolumemixer.mute")
            }
          >
            {audioMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={NEUTRAL_PANEL_CLOSE_BUTTON}
            aria-label={localizeUi("ui.game.gamevolumemixer.closeVolume")}
          >
            <X size={NEUTRAL_PANEL_CLOSE_ICON_SIZE} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <label key={row.id} className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-2">
            <span className="truncate text-[0.6875rem] text-[var(--foreground)]/75">{row.label}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={row.value}
              onPointerDown={onAudioInteract}
              onTouchStart={onAudioInteract}
              onInput={(event) => {
                onAudioInteract?.();
                row.onChange(Number(event.currentTarget.value));
              }}
              onChange={(event) => {
                onAudioInteract?.();
                row.onChange(Number(event.target.value));
              }}
              className="h-1.5 w-full cursor-pointer accent-[var(--foreground)]"
            />
            <span className="text-right text-[0.6875rem] tabular-nums text-[var(--muted-foreground)]">{row.value}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
