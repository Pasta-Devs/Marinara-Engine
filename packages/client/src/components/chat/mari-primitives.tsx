import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Sparkles } from "lucide-react";

import { cn } from "../../lib/utils";

/**
 * Small layout primitives shared by Professor Mari's workspace. Turns use
 * `TranscriptRow`, controls use `.mari-chrome-control`, and a risky prompt
 * is a `MariCard`.
 *
 * Direction A (`docs/development/mockups/mari-v3/index.html`): text first,
 * chrome last. See `docs/development/omnibar-concept.md` R41-R48.
 */

/** R43: one muted line. Colour is its only variation. */
export function MariNote({
  tone = "muted",
  children,
  className,
  ...rest
}: {
  tone?: "muted" | "accent" | "danger";
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("mari-note", className)} data-tone={tone} {...rest}>
      {children}
    </p>
  );
}

/**
 * R42: a risky prompt (delete, install, sensitive file). One neutral hairline; `media` is a small icon
 * tile, red-tinted only for `danger`. `actions` is a quiet `.mari-link` secondary, then one `.mari-btn`
 * primary. Slice 71: `needsYou` marks a card where nothing happens until you choose - an accent edge and
 * a "Needs you" kicker - and `then` says what each button does, beside them.
 */
export function MariCard({
  variant = "default",
  needsYou = false,
  then,
  media,
  title,
  meta,
  actions,
  children,
  className,
  ...rest
}: {
  variant?: "default" | "danger";
  needsYou?: boolean;
  then?: ReactNode;
  media?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLElement>, "title">) {
  const { t } = useTranslation();
  const actionRow = actions ? <div className="mari-card__actions">{actions}</div> : null;
  return (
    <section
      className={cn("mari-card", className)}
      data-variant={variant}
      data-needs-you={needsYou ? "true" : undefined}
      {...rest}
    >
      {needsYou ? (
        <p className="mari-card__kicker">
          <span className="mari-card__dot" aria-hidden="true" />
          {t("mari.needsYou.kicker")}
        </p>
      ) : null}
      <div className="mari-card__head">
        {media ? <span className="mari-card__media">{media}</span> : null}
        <div className="min-w-0">
          <p className="mari-card__title">{title}</p>
          {meta ? <p className="mari-card__meta">{meta}</p> : null}
        </div>
      </div>
      {children ? <div className="mari-card__body">{children}</div> : null}
      {then && actionRow ? (
        <div className="mari-card__foot">
          <p className="mari-card__then">{then}</p>
          {actionRow}
        </div>
      ) : (
        actionRow
      )}
    </section>
  );
}

/**
 * R10 (cards v5, `docs/development/mockups/mari-v5`): rows that stack share ONE inset group: one
 * hairline, one radius, dividers inset to the text edge. `head` is a short sentence-case label above
 * it ("Needs your OK", "Changed", "Next"); `cols` sets two rows side by side once the group is 36rem
 * wide. An empty group draws nothing.
 */
export function MariList({
  head,
  cols = false,
  children,
  className,
  ...rest
}: {
  head?: ReactNode;
  cols?: boolean;
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  const list = (
    <div className={cn("mari-list", className)} {...rest}>
      {cols ? <div className="mari-list__cols">{children}</div> : children}
    </div>
  );
  if (!head) return list;
  return (
    <>
      <p className="mari-list__head">{head}</p>
      {list}
    </>
  );
}

/** What a tap on a row does: `open` opens the thing now (›), `ask` asks Mari (a gold ✦). */
export type MariRowTrail = "open" | "ask";

/**
 * R10: the one card anatomy, as a row of a `MariList`: slot · title · one muted fact · one trailing
 * thing. The fact never repeats what the slot already says (the type). A button when `onClick` is set.
 */
export function MariRow({
  slot,
  title,
  badge,
  fact,
  trail,
  trailLabel,
  hint,
  state,
  compact = false,
  className,
  ...button
}: {
  slot: ReactNode;
  title: ReactNode;
  /** A small capsule after the title ("New"). */
  badge?: ReactNode;
  fact?: ReactNode;
  trail?: MariRowTrail | ReactNode;
  /** Screen-reader and tooltip text for the trailing glyph ("Opens now", "Asks Mari"). */
  trailLabel?: string;
  /** The row's tooltip (a reference's description). */
  hint?: string;
  state?: "selected" | "busy" | "failed";
  /** One line (title, then the fact) in a narrow group; references only. */
  compact?: boolean;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title" | "slot">) {
  const trailNode =
    trail === "open" ? (
      <ChevronRight aria-hidden="true" />
    ) : trail === "ask" ? (
      <Sparkles className="mari-row__spark" aria-hidden="true" />
    ) : (
      trail
    );
  const content = (
    <>
      <span className="mari-row__slot" aria-hidden="true">
        {slot}
      </span>
      <span className="mari-row__text">
        <span className="mari-row__title">
          <span>{title}</span>
          {badge}
        </span>
        {fact ? <span className="mari-row__fact">{fact}</span> : null}
      </span>
      {trailNode ? (
        <span className="mari-row__trail" title={trailLabel}>
          {trailNode}
          {trailLabel ? <span className="sr-only">{trailLabel}</span> : null}
        </span>
      ) : null}
    </>
  );
  const rowClass = cn("mari-row", !fact && !compact && "mari-row--one");
  return (
    <div className={cn("mari-list__item", compact && "mari-list__item--compact", className)} data-state={state}>
      {button.onClick ? (
        <button type="button" className={rowClass} title={hint} {...button}>
          {content}
        </button>
      ) : (
        <div className={rowClass} title={hint} role={button.role}>
          {content}
        </div>
      )}
    </div>
  );
}
