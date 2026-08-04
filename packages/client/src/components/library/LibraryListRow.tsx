import { Check, Hash, MessageCircle, Pencil, Star, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatEstimatedTokens } from "../../lib/character-token-count";
import type { LibraryItem } from "../../lib/library/library-item";
import { cn, getAvatarCropStyle } from "../../lib/utils";

type LibraryListRowProps = {
  item: LibraryItem;
  previewSelected: boolean;
  selectionMode?: boolean;
  bulkSelected?: boolean;
  onSelect: (id: string) => void;
  onToggleSelected?: (id: string) => void;
  onEdit: (id: string) => void;
  onChat?: (item: LibraryItem) => void;
};

function formatUpdatedAt(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

export function LibraryListRow({
  item,
  previewSelected,
  selectionMode = false,
  bulkSelected = false,
  onSelect,
  onToggleSelected,
  onEdit,
  onChat,
}: LibraryListRowProps) {
  const { t, i18n } = useTranslation();
  const singular = item.kind === "character" ? "character" : "persona";
  const updatedAt = formatUpdatedAt(item.updatedAt, i18n.resolvedLanguage ?? i18n.language);
  const placeholderClass =
    item.kind === "character" ? "mari-avatar-placeholder--character" : "mari-avatar-placeholder--persona";

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-[var(--card)]/78 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.9)] transition-[border-color,box-shadow,background-color] duration-150",
        (selectionMode ? bulkSelected : previewSelected)
          ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] shadow-[0_18px_44px_-30px_color-mix(in_srgb,var(--marinara-chat-chrome-accent)_38%,transparent)]"
          : "border-[var(--marinara-chat-chrome-panel-border)] hover:border-[var(--marinara-chat-chrome-button-border-hover)]",
      )}
    >
      <div className="flex min-w-0 items-stretch">
        <button
          type="button"
          onClick={() => (selectionMode ? onToggleSelected?.(item.id) : onSelect(item.id))}
          role={selectionMode ? "checkbox" : undefined}
          aria-checked={selectionMode ? bulkSelected : undefined}
          aria-pressed={selectionMode ? undefined : previewSelected}
          aria-label={
            selectionMode
              ? t(
                  bulkSelected
                    ? "ui.characters.characterlibraryview.deselectValue1"
                    : "ui.characters.characterlibraryview.selectValue1",
                  { value1: item.name },
                )
              : undefined
          }
          className={cn(
            "grid min-w-0 flex-1 gap-3 p-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] sm:gap-4 sm:p-3",
            selectionMode
              ? "grid-cols-[1.25rem_4.5rem_minmax(0,1fr)] sm:grid-cols-[1.25rem_5rem_minmax(11rem,0.85fr)_minmax(14rem,1.45fr)] lg:grid-cols-[1.25rem_5rem_minmax(12rem,0.9fr)_minmax(16rem,1.5fr)_9rem]"
              : "grid-cols-[4.5rem_minmax(0,1fr)] sm:grid-cols-[5rem_minmax(11rem,0.85fr)_minmax(14rem,1.45fr)] lg:grid-cols-[5rem_minmax(12rem,0.9fr)_minmax(16rem,1.5fr)_9rem]",
          )}
        >
          {selectionMode && (
            <span
              aria-hidden="true"
              className={cn(
                "flex h-5 w-5 self-center items-center justify-center rounded border-2 transition-colors",
                bulkSelected
                  ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-button-text-active)]"
                  : "border-[var(--muted-foreground)]/40 bg-[var(--secondary)] text-transparent",
              )}
            >
              <Check size="0.75rem" />
            </span>
          )}
          <div
            className={cn(
              "mari-avatar-placeholder relative h-[4.5rem] w-[4.5rem] overflow-hidden rounded-lg sm:h-20 sm:w-20",
              placeholderClass,
            )}
          >
            {item.avatarPath ? (
              <img
                src={item.avatarPath}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
                style={getAvatarCropStyle(item.avatarCrop)}
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[var(--marinara-chat-chrome-panel-title)]">
                <User size="1.5rem" aria-hidden="true" />
              </span>
            )}
            {(item.favorite || item.active) && (
              <span className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--card)] text-[var(--marinara-chat-chrome-accent)] shadow-sm ring-1 ring-[var(--marinara-chat-chrome-panel-border)]">
                {item.favorite ? (
                  <Star size="0.75rem" className="fill-current" aria-hidden="true" />
                ) : (
                  <Check size="0.75rem" aria-hidden="true" />
                )}
                <span className="sr-only">
                  {item.favorite
                    ? t("ui.characters.cardlibrarydetailcard.favorite")
                    : t("ui.characters.lorebooktab.active")}
                </span>
              </span>
            )}
          </div>

          <div className="min-w-0 self-center">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-[var(--marinara-chat-chrome-panel-title)] sm:text-base">
                {item.name}
              </h2>
              {!selectionMode && previewSelected && (
                <Check
                  size="0.875rem"
                  className="shrink-0 text-[var(--marinara-chat-chrome-accent)]"
                  aria-hidden="true"
                />
              )}
            </div>
            {item.title && (
              <p className="mt-0.5 truncate text-xs text-[var(--marinara-chat-chrome-panel-muted)]">{item.title}</p>
            )}
            {item.meta && (
              <p className="mt-1 truncate text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-[var(--marinara-chat-chrome-panel-muted)]">
                {item.meta}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:hidden">
              <span className="mari-chrome-muted-badge gap-1 px-2 py-1 text-[0.625rem]">
                <Hash size="0.625rem" aria-hidden="true" /> {formatEstimatedTokens(item.tokenEstimate)}
              </span>
              {item.tags.slice(0, 1).map((tag) => (
                <span
                  key={tag}
                  className="max-w-24 truncate rounded-full bg-[var(--marinara-chat-chrome-button-bg)] px-2 py-1 text-[0.625rem] text-[var(--marinara-chat-chrome-panel-text)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div
            className={cn(
              "min-w-0 self-center border-t border-[var(--marinara-chat-chrome-panel-divider)] pt-2.5 sm:col-span-1 sm:border-t-0 sm:pt-0",
              selectionMode ? "col-span-3" : "col-span-2",
            )}
          >
            <p className="line-clamp-2 text-xs leading-5 text-[var(--marinara-chat-chrome-panel-text)] sm:line-clamp-3 sm:text-[0.8125rem]">
              {item.summary}
            </p>
            <div className="mt-2 hidden flex-wrap gap-1.5 sm:flex">
              {item.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="max-w-32 truncate rounded-full bg-[var(--marinara-chat-chrome-button-bg)] px-2 py-1 text-[0.625rem] font-medium text-[var(--marinara-chat-chrome-panel-text)]"
                >
                  {tag}
                </span>
              ))}
              {item.tags.length > 3 && (
                <span className="rounded-full bg-[var(--marinara-chat-chrome-button-bg)] px-2 py-1 text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]">
                  +{item.tags.length - 3}
                </span>
              )}
            </div>
          </div>

          <div className="hidden min-w-0 self-center lg:block">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--marinara-chat-chrome-panel-text)]">
              <Hash size="0.75rem" className="text-[var(--marinara-chat-chrome-panel-muted)]" aria-hidden="true" />
              {formatEstimatedTokens(item.tokenEstimate)}
            </div>
            {updatedAt && (
              <p className="mt-1.5 text-[0.6875rem] leading-4 text-[var(--marinara-chat-chrome-panel-muted)]">
                {t("ui.characters.characterlibraryview.updatedValue1", { value1: updatedAt })}
              </p>
            )}
          </div>
        </button>

        {!selectionMode && (
          <div className="flex w-12 shrink-0 flex-col items-center justify-center gap-1 border-l border-[var(--marinara-chat-chrome-panel-divider)] bg-[var(--background)]/35 p-1 sm:w-14">
            {onChat && (
              <button
                type="button"
                onClick={() => onChat(item)}
                className="mari-chrome-control mari-chrome-control--primary h-10 w-10 rounded-lg p-0 transition-transform active:scale-[0.96]"
                aria-label={t("ui.characters.characterlibraryview.chatWithValue1", { value1: item.name })}
                title={t("ui.characters.characterlibraryview.chatNow")}
              >
                <MessageCircle size="0.875rem" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onEdit(item.id)}
              className="mari-chrome-control h-10 w-10 rounded-lg p-0 transition-transform active:scale-[0.96]"
              aria-label={t("ui.characters.characterlibraryview.editValue1Value2", {
                value1: singular,
                value2: item.name,
              })}
              title={t("ui.characters.characterlibraryview.editValue1", { value1: singular })}
            >
              <Pencil size="0.875rem" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
