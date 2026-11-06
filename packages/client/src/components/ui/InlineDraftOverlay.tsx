import type { CSSProperties } from "react";
import { draftSegments, type ComposerMark } from "../../lib/composer-triggers";
import { cn } from "../../lib/utils";

/**
 * InlineGhostText plus marks: a decorative layer behind a plain textarea that paints a background
 * under chosen character ranges (`@` references) while the textarea keeps drawing the glyphs.
 * All text here is transparent and a mark may only paint (background, shadow, underline), never change
 * layout, or the marks would drift from the typed text. `className` must repeat the field's own font,
 * padding and border classes, as for InlineGhostText.
 */
export function InlineDraftOverlay({
  value,
  suffix,
  marks,
  className,
  multiline,
  scrollLeft = 0,
  scrollTop = 0,
  style,
  hint,
  onAccept,
}: {
  value: string;
  suffix: string;
  marks: ComposerMark[];
  className?: string;
  multiline?: boolean;
  scrollLeft?: number;
  scrollTop?: number;
  /** Extra inline styles, e.g. a field's computed font and padding when classes can't be repeated. */
  style?: CSSProperties;
  /** Draws the suffix as a small hint pill ("Tab to link") instead of grey completion text. */
  hint?: boolean;
  /** Makes the suffix tappable. Called on pointer down, so the field never loses focus. */
  onAccept?: () => void;
}) {
  if (!suffix && marks.length === 0) return null;
  return (
    <div
      aria-hidden="true"
      data-component="InlineDraftOverlay"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden text-transparent",
        multiline ? "whitespace-pre-wrap break-words" : "whitespace-pre",
        className,
      )}
      style={multiline ? { ...style, transform: `translate(${-scrollLeft}px, ${-scrollTop}px)` } : style}
    >
      {draftSegments(value, marks).map((segment, index) =>
        segment.tone ? (
          <span key={index} className={`mari-composer-mark mari-composer-mark--${segment.tone}`}>
            {segment.text}
          </span>
        ) : (
          segment.text
        ),
      )}
      {suffix ? (
        <span
          className={cn(
            // A hint is not text that will be typed in, so it reads as a pill. It only follows the text,
            // so its own size and margin can't move the marks before it.
            // `whitespace-nowrap` keeps it whole: it wraps to the next line as one pill or not at all.
            hint
              ? "ml-1.5 whitespace-nowrap rounded bg-[var(--accent)]/60 px-1.5 text-[0.75em] text-[var(--muted-foreground)]"
              : "text-[var(--muted-foreground)]/55",
            onAccept && "pointer-events-auto relative cursor-pointer after:absolute after:content-['']",
            // Right padding cancelled by margin widens the tap target without moving the text,
            // and an invisible ::after stretches it to a 44px-tall touch target.
            onAccept &&
              !hint &&
              "-mr-2 rounded-r py-1 pr-2 after:inset-x-0 after:-inset-y-2 pointer-coarse:bg-[var(--accent)]/60",
            // The pill is small text, so its hit area reaches past it on every side.
            onAccept && hint && "after:-inset-x-2 after:-inset-y-3",
          )}
          onPointerDown={
            onAccept
              ? (event) => {
                  // A right or middle click is not an accept.
                  if (event.button !== 0) return;
                  // Without this the tap blurs the field first, which clears the suggestion.
                  event.preventDefault();
                  onAccept();
                }
              : undefined
          }
        >
          {suffix}
        </span>
      ) : null}
    </div>
  );
}
