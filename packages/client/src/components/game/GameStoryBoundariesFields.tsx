import { useEffect, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { MacroTextarea } from "../ui/MacroTextarea";
import {
  GAME_CONTENT_BOUNDARIES_MAX_CHARS,
  type GameStoryStyle,
  type GameViolenceLevel,
} from "@marinara-engine/shared";

export interface GameStorySettings {
  storyStyle: GameStoryStyle;
  /** Null follows the game's rating (offered only with `followRatingOption`). */
  violence: GameViolenceLevel | null;
  contentBoundaries: string;
}

interface GameStoryBoundariesFieldsProps {
  value: GameStorySettings;
  /** Called with what changed. The boundaries text is sent when its box loses focus. */
  onChange: (patch: Partial<GameStorySettings>) => void;
  compact?: boolean;
  /** Offer "Follow rating" for violence, for a prompt preset that is used with either rating. */
  followRatingOption?: boolean;
}

const STYLES: GameStoryStyle[] = ["standard", "gentle"];
const VIOLENCE: GameViolenceLevel[] = ["mild", "serious", "graphic"];

/**
 * Story style, violence level and the player's content boundaries: the setup wizard and the game's
 * prompt settings show the same three fields.
 */
export function GameStoryBoundariesFields({
  value,
  onChange,
  compact,
  followRatingOption,
}: GameStoryBoundariesFieldsProps) {
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

  // In the setup wizard each field is its own row, label first, like the content rating above it, so a
  // layout that puts labels in a column of their own lines these up with the rest.
  const row = compact ? "" : "flex flex-col gap-1.5";
  const rowLabel = compact ? cn(label, "mb-1.5") : label;
  const rowHelp = compact ? cn(help, "mt-1") : help;
  const commitBoundaries = () => {
    if (boundariesDraft.trim() !== value.contentBoundaries.trim()) {
      onChange({ contentBoundaries: boundariesDraft.trim() });
    }
  };
  const fields = (
    <>
      <div className={row}>
        <label id="game-story-style-label" className={rowLabel}>
          {localizeUi("ui.game.storyStyle.label")}
        </label>
        <div className="flex gap-1.5" role="radiogroup" aria-labelledby="game-story-style-label">
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
        <p className={cn(rowHelp, "m-0")}>{localizeUi(`ui.game.storyStyle.${value.storyStyle}Help`)}</p>
      </div>

      <div className={row}>
        <label id="game-violence-label" className={rowLabel}>
          {localizeUi("ui.game.violence.label")}
        </label>
        <div className="flex gap-1.5" role="radiogroup" aria-labelledby="game-violence-label">
          {followRatingOption && (
            <button
              type="button"
              role="radio"
              aria-checked={value.violence === null}
              onClick={() => value.violence !== null && onChange({ violence: null })}
              className={pill(value.violence === null)}
            >
              {localizeUi("ui.game.violence.followRating")}
            </button>
          )}
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
        <p className={cn(rowHelp, "m-0")}>{localizeUi("ui.game.violence.help")}</p>
      </div>

      <div className={row}>
        <label htmlFor={compact ? "game-content-boundaries" : undefined} className={rowLabel}>
          {localizeUi("ui.game.contentBoundaries.label")}
        </label>
        <div>
          {compact ? (
            <textarea
              id="game-content-boundaries"
              value={boundariesDraft}
              onChange={(event) => setBoundariesDraft(event.target.value)}
              onBlur={commitBoundaries}
              maxLength={GAME_CONTENT_BOUNDARIES_MAX_CHARS}
              rows={3}
              placeholder={localizeUi("ui.game.contentBoundaries.placeholder")}
              className="w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs leading-relaxed text-[var(--foreground)] outline-none ring-1 ring-transparent transition-all focus:ring-[var(--primary)]/40"
            />
          ) : (
            // In a game, the same field as Extra instructions above it.
            <MacroTextarea
              value={boundariesDraft}
              onChange={setBoundariesDraft}
              onBlur={commitBoundaries}
              onExpandedClose={commitBoundaries}
              title={localizeUi("ui.game.contentBoundaries.label")}
              ariaLabel={localizeUi("ui.game.contentBoundaries.label")}
              placeholder={localizeUi("ui.game.contentBoundaries.placeholder")}
              rows={3}
              maxLength={GAME_CONTENT_BOUNDARIES_MAX_CHARS}
              showMacroReference={false}
              className="mari-chrome-field min-h-[5rem] w-full !rounded-md px-3 py-2 pr-8 text-xs leading-relaxed"
            />
          )}
          <p className={cn(rowHelp, "m-0")}>{localizeUi("ui.game.contentBoundaries.help")}</p>
        </div>
      </div>
    </>
  );
  return compact ? fields : <div className="flex flex-col gap-3">{fields}</div>;
}
