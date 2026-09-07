import { Check, Hash, Star, User } from "lucide-react";
import type { AvatarCrop } from "@marinara-engine/shared";
import { useTranslation } from "react-i18next";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { formatEstimatedTokens } from "../../lib/character-token-count";

export type LibraryPreviewCard = {
  id: string;
  name: string;
  title?: string | null;
  meta?: string | null;
  summary: string;
  avatarPath: string | null;
  avatarCrop?: AvatarCrop;
  favorite: boolean;
  active?: boolean;
  tags: string[];
  tokenEstimate: number;
};

/** The Full Library card, also used in the optional home widget. */
export function CardLibraryPreview({
  card,
  kind = "characters",
  isSelected = false,
  compact = false,
  onClick,
}: {
  card: LibraryPreviewCard;
  kind?: "characters" | "personas";
  isSelected?: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  const { t: localizeUi } = useTranslation();
  const placeholderClass =
    kind === "personas" ? "mari-avatar-placeholder--persona" : "mari-avatar-placeholder--character";
  return (
    <button
      type="button"
      data-card-library-card={card.id}
      onClick={onClick}
      className={cn(
        "group flex w-full items-stretch overflow-hidden rounded-[1.25rem] border bg-[var(--card)]/70 text-left shadow-[0_20px_50px_-32px_rgba(15,23,42,0.75)] transition-all hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:shadow-[0_24px_60px_-32px_color-mix(in_srgb,var(--marinara-chat-chrome-accent)_35%,transparent)]",
        compact ? "min-h-0 flex-1" : "sm:flex-col sm:rounded-[1.75rem] sm:hover:-translate-y-0.5",
        isSelected
          ? "border-[var(--marinara-chat-chrome-button-border-active)] ring-1 ring-[var(--marinara-chat-chrome-focus-ring)]"
          : "border-[var(--marinara-chat-chrome-panel-border)]",
      )}
    >
      <div
        data-card-library-avatar
        className={cn(
          "mari-avatar-placeholder relative shrink-0 self-stretch overflow-hidden",
          placeholderClass,
          compact
            ? "min-h-0 w-[28%] max-w-20"
            : "min-h-24 w-24 sm:h-auto sm:min-h-0 sm:w-full sm:self-auto sm:aspect-square",
        )}
      >
        {card.avatarPath ? (
          <img
            src={card.avatarPath}
            alt={card.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            style={getAvatarCropStyle(card.avatarCrop)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--marinara-chat-chrome-panel-title)]">
            <User size="1.5rem" className="sm:h-8 sm:w-8" />
          </div>
        )}
        {card.favorite && (
          <div
            data-character-favorite-indicator="card"
            className={cn(
              "mari-chrome-accent-surface mari-accent-animated mari-chrome-tag absolute inline-flex items-center gap-1 py-1 text-[0.5625rem] font-medium backdrop-blur-sm",
              compact ? "right-1 top-1 px-1" : "right-2 top-2 px-2 sm:right-3 sm:top-3 sm:text-[0.625rem]",
            )}
            title={localizeUi("ui.characters.cardlibrarydetailcard.favorite")}
          >
            <Star size="0.625rem" className="fill-current sm:h-[0.6875rem] sm:w-[0.6875rem]" />{" "}
            {!compact && localizeUi("ui.characters.cardlibrarydetailcard.favorite")}
          </div>
        )}
        {card.active && (
          <div className="mari-chrome-accent-surface mari-chrome-tag absolute right-2 top-2 inline-flex items-center gap-1 px-2 py-1 text-[0.5625rem] font-medium backdrop-blur-sm sm:right-3 sm:top-3 sm:text-[0.625rem]">
            <Check size="0.625rem" /> {localizeUi("ui.characters.lorebooktab.active")}
          </div>
        )}
      </div>

      <div className={cn("flex min-w-0 flex-1 flex-col", compact ? "gap-1 p-2" : "gap-2 p-3 sm:gap-3 sm:p-4")}>
        <div className="min-w-0">
          <div
            className={cn(
              "truncate font-semibold text-[var(--marinara-chat-chrome-panel-title)]",
              compact ? "text-xs" : "text-sm sm:text-base",
            )}
          >
            {card.name}
          </div>
          {card.title && (
            <div className="mt-0.5 truncate text-[0.625rem] italic text-[var(--marinara-chat-chrome-panel-muted)] sm:mt-1 sm:text-[0.6875rem]">
              {card.title}
            </div>
          )}
          {card.meta && (
            <div className="mt-0.5 truncate text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-[var(--marinara-chat-chrome-panel-muted)] sm:mt-1 sm:text-[0.625rem] sm:tracking-[0.18em]">
              {card.meta}
            </div>
          )}
        </div>
        <p
          className={cn(
            "text-[0.6875rem] leading-4 text-[var(--marinara-chat-chrome-panel-muted)]",
            compact ? "line-clamp-2" : "line-clamp-3 sm:line-clamp-4 sm:text-xs sm:leading-5",
          )}
        >
          {card.summary.length > 180 ? card.summary.slice(0, 177).trimEnd() + "..." : card.summary}
        </p>
        {!compact && (
          <div className="mt-auto flex flex-wrap gap-1 sm:gap-1.5">
            <span
              className="mari-chrome-muted-badge gap-1 px-1.5 py-0.5 text-[0.5625rem] sm:px-2 sm:py-1 sm:text-[0.625rem]"
              title={localizeUi(
                "ui.characters.cardlibrarydetailcard.estimatedFromValue1CardTextFieldsActualTokenizerCounts",
                { value1: kind === "personas" ? "persona" : "character" },
              )}
            >
              <Hash size="0.5625rem" /> {formatEstimatedTokens(card.tokenEstimate)}
            </span>
            {card.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="mari-chrome-tag bg-[var(--marinara-chat-chrome-highlight-bg)] px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--marinara-chat-chrome-panel-text)] sm:px-2 sm:py-1 sm:text-[0.625rem]"
              >
                {tag}
              </span>
            ))}
            {card.tags.length > 2 && (
              <span className="mari-chrome-tag bg-[var(--marinara-chat-chrome-button-bg)] px-1.5 py-0.5 text-[0.5625rem] text-[var(--marinara-chat-chrome-panel-muted)] sm:px-2 sm:py-1 sm:text-[0.625rem]">
                +{card.tags.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
