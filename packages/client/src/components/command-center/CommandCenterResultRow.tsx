import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import { CornerDownLeft, Settings2, type LucideIcon } from "lucide-react";

import type { ResultType } from "@/lib/command-icons";
import { cn } from "@/lib/utils";

import type { CommandCenterMediaKind } from "./CommandCenterMedia";
import { ResultTypeIcon, type ResultTypeFace } from "./ResultTypeIcon";

/** A `[start, end)` span into `title`/`metadata`, for highlighting the matched text. */
export type CommandCenterResultHighlight = readonly [number, number];

export interface CommandCenterResultRowProps {
  id?: string;
  dataResultId?: string;
  title: string;
  /** The span of `title` that matched the search, if any. */
  titleHighlight?: CommandCenterResultHighlight | null;
  metadata: string | null;
  /** The span of `metadata` that matched the search, if any. */
  metadataHighlight?: CommandCenterResultHighlight | null;
  /** Words after the title on line 1: the type, in a mixed list or for a chat's mode. */
  typeLabel?: string;
  /** One short fact at the end of line 1 (a time, a count). On a phone the right column is gone, so it moves here. */
  meta?: string;
  /** Line 3: the text that proves the match, shown only when there is one. */
  excerpt?: string;
  excerptHighlight?: CommandCenterResultHighlight | null;
  tertiaryMetadata?: ReactNode;
  icon: LucideIcon;
  /** What the row is (Q6): badges a portrait, and names the row's kind for anything without one. */
  type?: ResultType;
  /** A chat's participants, stacked in the media slot. */
  faces?: readonly ResultTypeFace[];
  faceCount?: number;
  selected: boolean;
  onSelect: () => void;
  mediaSrc?: string | null;
  mediaKind?: CommandCenterMediaKind;
  avatarCropStyle?: CSSProperties;
  groupClassName?: string;
  /** Title and metadata share one line (a hit under its chat): the title keeps its width, the metadata takes the rest. */
  inline?: boolean;
  accent?: string | null;
  control?: ReactNode;
  /**
   * Content revealed beneath the row itself. The row grows to fit it, so nothing
   * above it moves - which is what lets a preview expand in place instead of
   * taking over the panel.
   */
  expanded?: ReactNode;
  currentChoice?: string;
  enterHint?: string;
  setupStatus?: string;
  onMouseEnter?: MouseEventHandler<HTMLLIElement>;
  onMouseMove?: MouseEventHandler<HTMLLIElement>;
  onMouseLeave?: MouseEventHandler<HTMLLIElement>;
  className?: string;
  style?: CSSProperties;
}

/**
 * Wraps the matched span in a `<mark>` in the theme's accent colour, no
 * background block (slice 79b). Mixed 70/30 with the foreground so it stays
 * readable on the card in dark and light and in user themes: the mix moves
 * toward light text on a dark card and toward dark text on a light one.
 */
function highlightSpan(text: string, range: CommandCenterResultHighlight | null | undefined) {
  if (!range) return text;
  const [start, end] = range;
  if (start < 0 || end <= start || end > text.length) return text;
  return (
    <>
      {text.slice(0, start)}
      <mark className="bg-transparent text-[color-mix(in_srgb,var(--primary)_70%,var(--foreground))]">
        {text.slice(start, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}

export function CommandCenterResultRow({
  id,
  dataResultId,
  title,
  titleHighlight,
  metadata,
  metadataHighlight,
  typeLabel,
  meta,
  excerpt,
  excerptHighlight,
  tertiaryMetadata,
  icon,
  type,
  faces,
  faceCount,
  selected,
  onSelect,
  mediaSrc,
  mediaKind,
  avatarCropStyle,
  groupClassName,
  inline,
  accent,
  control,
  expanded,
  currentChoice,
  enterHint,
  setupStatus,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  className,
  style,
}: CommandCenterResultRowProps) {
  // A hit line under its chat: speaker, excerpt and time share one line.
  const inlineLine = Boolean(inline && metadata && !expanded);
  return (
    <li
      data-result-id={dataResultId}
      data-command-center-result-row
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={style}
      className={cn(
        "group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center rounded-xl transition-colors",
        expanded ? "min-h-14 py-1" : "min-h-14 sm:h-[3.25rem]",
        selected ? "bg-[var(--primary)]/12 ring-1 ring-inset ring-[var(--primary)]/20" : "hover:bg-[var(--accent)]/60",
        groupClassName,
        className,
      )}
    >
      <button
        id={id}
        type="button"
        data-selected={selected || undefined}
        onClick={onSelect}
        // The title names the row; the subtitle (often a long description) only describes it.
        aria-label={title}
        aria-describedby={metadata && id ? `${id}-metadata` : undefined}
        className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl px-2.5 text-left text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
      >
        <ResultTypeIcon
          type={type}
          icon={icon}
          src={mediaSrc}
          kind={mediaKind}
          avatarCropStyle={avatarCropStyle}
          accent={accent}
          faces={faces}
          faceCount={faceCount}
        />
        <span className={cn("min-w-0 leading-tight", inlineLine && "flex items-baseline gap-2")}>
          <span className={cn("flex min-w-0 items-baseline gap-1.5", inlineLine && "max-w-[40%] shrink-0")}>
            <span className="block min-w-0 truncate text-sm font-semibold">{highlightSpan(title, titleHighlight)}</span>
            {typeLabel ? (
              <span className="shrink-0 text-[0.6875rem] text-[var(--muted-foreground)]">{typeLabel}</span>
            ) : null}
            {meta && !inlineLine ? (
              <span className="ml-auto shrink-0 text-[0.6875rem] tabular-nums text-[var(--muted-foreground)] sm:hidden">
                {meta}
              </span>
            ) : null}
          </span>
          {metadata ? (
            <span
              id={id ? `${id}-metadata` : undefined}
              className={cn(
                "block text-xs text-[var(--muted-foreground)]",
                inlineLine ? "min-w-0 flex-1 truncate" : "mt-0.5",
                // Expanded, the line carries the description (max two lines) so the
                // body below never repeats it.
                expanded ? "line-clamp-2 break-words" : "truncate",
              )}
            >
              {highlightSpan(metadata, metadataHighlight)}
            </span>
          ) : null}
          {meta && inlineLine ? (
            <span className="shrink-0 text-[0.6875rem] tabular-nums text-[var(--muted-foreground)] sm:hidden">
              {meta}
            </span>
          ) : null}
          {excerpt && !expanded ? (
            <span className="block truncate text-xs text-[var(--foreground)]/80">
              {highlightSpan(excerpt, excerptHighlight)}
            </span>
          ) : null}
        </span>
        {/* Hidden on mobile when a control (e.g. the lorebook Enabled switch)
            also claims row width: a few chopped characters from the left
            edge of a right-aligned, overflow-hidden line read as broken, and
            the title fitting is what matters there. It comes back once
            there's room (O4 item 1). */}
        <span
          className={cn(
            "min-w-0 items-center justify-end gap-2 truncate text-xs text-[var(--muted-foreground)] sm:flex sm:max-w-48",
            control ? "hidden" : "hidden sm:flex sm:max-w-48",
          )}
        >
          {tertiaryMetadata}
          {currentChoice ? <span className="truncate font-medium">{currentChoice}</span> : null}
          {!control && setupStatus ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <Settings2 className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{setupStatus}</span>
            </span>
          ) : null}
        </span>
      </button>

      {control || enterHint ? (
        <div className="col-start-2 flex min-w-0 max-w-[min(48vw,16rem)] shrink-0 items-center justify-end gap-1 pr-1">
          {!control && enterHint ? (
            <span
              className={cn(
                "items-center gap-1 text-xs text-[var(--muted-foreground)]",
                // Only the selected row says what Enter does, and only where a fine pointer
                // and keyboard are there to press it. A touch user taps, so no row shows the hint.
                selected || expanded ? "hidden [@media(pointer:fine)]:inline-flex" : "hidden",
              )}
            >
              <span className="truncate">{enterHint}</span>
              <CornerDownLeft className="size-3.5 shrink-0" aria-hidden="true" />
            </span>
          ) : null}
          {control}
        </div>
      ) : null}
      {expanded ? (
        // grid-template-rows 0fr -> 1fr opens the body without measuring it; the
        // inner padding indents it to the row's text column (media 2.25rem + gaps).
        <div className="omnibar-row-expansion col-span-2 grid min-w-0">
          <div className="min-h-0 overflow-hidden">
            <div className="pb-2.5 pl-14 pr-3 pt-0.5">{expanded}</div>
          </div>
        </div>
      ) : null}
    </li>
  );
}
