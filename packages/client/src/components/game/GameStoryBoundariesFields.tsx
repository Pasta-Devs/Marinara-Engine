import { useEffect, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import {
  GAME_CONTENT_BOUNDARIES_MAX_CHARS,
  type GameStoryStyle,
  type GameViolenceLevel,
} from "@marinara-engine/shared";

export interface GameStorySettings {
  storyStyle: GameStoryStyle;
  violence: GameViolenceLevel;
  contentBoundaries: string;
}

interface GameStoryBoundariesFieldsProps {
  value: GameStorySettings;
  /** Called with what changed. The boundaries text is sent when its box loses focus. */
  onChange: (patch: Partial<GameStorySettings>) => void;
  compact?: boolean;
}

const STYLES: GameStoryStyle[] = ["standard", "gentle"];
const VIOLENCE: GameViolenceLevel[] = ["mild", "serious", "graphic"];

/**
 * Story style, violence level and the player's content boundaries: the setup wizard and the game's
 * prompt settings show the same three fields.
 */
export function GameStoryBoundariesFields({ value, onChange, compact }: GameStoryBoundariesFieldsProps) {
  const { t: localizeUi } = useUiTranslation();
  const [boundariesDraft, setBoundariesDraft] = useState(value.contentBoundaries);
  useEffect(() => setBoundariesDraft(value.contentBoundaries), [value.contentBoundaries]);
  // The same label, help and choice styles as the content rating beside them (wizard) or the prompt
  // settings around them (in a game).
  const label = compact
    ? "block text-xs font-medium text-[var(--foreground)]"
    : "text-[0.6875rem] font-medium text-[var(--muted-foreground)]";
  const help = compact
    ? "text-[0.575rem] text-[var(--muted-foreground)]"
    : "text-[0.575rem] leading-relaxed text-[var(--muted-foreground)]";
  const pill = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1 text-xs transition-colors",
      active
        ? "bg-[var(--primary)]/20 text-[var(--primary)] ring-1 ring-[var(--primary)]/40"
        : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className={label}>{localizeUi("ui.game.storyStyle.label")}</span>
        <div className="flex gap-1.5" role="radiogroup" aria-label={localizeUi("ui.game.storyStyle.label")}>
          {STYLES.map((style) => (
            <button
              key={style}
              type="button"
              role="radio"
              aria-checked={value.storyStyle === style}
              onClick={() => value.storyStyle !== style && onChange({ storyStyle: style })}
              className={pill(value.storyStyle === style)}
            >
              {localizeUi(`ui.game.storyStyle.${style}`)}
            </button>
          ))}
        </div>
        <span className={help}>{localizeUi(`ui.game.storyStyle.${value.storyStyle}Help`)}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={label}>{localizeUi("ui.game.violence.label")}</span>
        <div className="flex gap-1.5" role="radiogroup" aria-label={localizeUi("ui.game.violence.label")}>
          {VIOLENCE.map((level) => (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={value.violence === level}
              onClick={() => value.violence !== level && onChange({ violence: level })}
              className={pill(value.violence === level)}
            >
              {localizeUi(`ui.game.violence.${level}`)}
            </button>
          ))}
        </div>
        <span className={help}>{localizeUi("ui.game.violence.help")}</span>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={label}>{localizeUi("ui.game.contentBoundaries.label")}</span>
        <textarea
          value={boundariesDraft}
          onChange={(event) => setBoundariesDraft(event.target.value)}
          onBlur={() => {
            if (boundariesDraft.trim() !== value.contentBoundaries.trim()) {
              onChange({ contentBoundaries: boundariesDraft.trim() });
            }
          }}
          maxLength={GAME_CONTENT_BOUNDARIES_MAX_CHARS}
          rows={3}
          placeholder={localizeUi("ui.game.contentBoundaries.placeholder")}
          className="w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs leading-relaxed text-[var(--foreground)] outline-none ring-1 ring-transparent transition-all focus:ring-[var(--primary)]/40"
        />
        <span className={help}>{localizeUi("ui.game.contentBoundaries.help")}</span>
      </label>
    </div>
  );
}
