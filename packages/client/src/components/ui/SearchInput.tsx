import { useEffect, useRef, type InputHTMLAttributes, type RefObject } from "react";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { Spinner } from "./Spinner";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]";

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || !!target.closest("input, textarea, select"));
}

/** The search field: an icon, the input and, once there is text, a clear button. Escape clears the text first. */
export function SearchInput({
  value,
  onChange,
  label,
  inputRef,
  onKeyDown,
  className,
  size = "default",
  resultCount,
  busy,
  slashShortcut,
  ...input
}: {
  value: string;
  onChange: (value: string) => void;
  /** Read by screen readers; the placeholder can say more. */
  label: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
  /** `compact` for dense toolbars and side panes. */
  size?: "default" | "compact";
  /** Shown as "4 found" / "None found" while there is text. */
  resultCount?: number;
  /** Shows a spinner in place of the icon while results load. */
  busy?: boolean;
  /** The page's main search: "/" anywhere outside a text field focuses it. Use once per page. */
  slashShortcut?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className" | "type" | "size"> & {
    [key: `data-${string}`]: string | boolean | undefined;
  }) {
  const { t } = useTranslation();
  const ownRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? ownRef;

  useEffect(() => {
    if (!slashShortcut) return;
    const onSlash = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      const field = ref.current;
      // Hidden fields (closed panel, collapsed toolbar) have no layout box.
      if (!field || field.getClientRects().length === 0) return;
      event.preventDefault();
      field.focus();
    };
    document.addEventListener("keydown", onSlash);
    return () => document.removeEventListener("keydown", onSlash);
  }, [slashShortcut, ref]);

  const status =
    value && resultCount !== undefined
      ? resultCount === 0
        ? t("search.field.noneFound")
        : t("search.field.found", { count: resultCount })
      : null;
  const compact = size === "compact";

  return (
    <div
      className={cn(
        "mari-chrome-field group flex min-w-0 items-center text-foreground/55 focus-within:border-[var(--marinara-chat-chrome-input-border-focus)] focus-within:shadow-[0_0_0_0.125rem_var(--marinara-chat-chrome-focus-ring)]",
        compact ? "min-h-9 md:min-h-8" : "min-h-11 md:min-h-9 [@media(pointer:coarse)]:min-h-11",
        className,
      )}
    >
      <label
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 self-stretch ps-2.5 pe-2.5",
          compact ? "min-h-9 md:min-h-8" : "min-h-11 md:min-h-9 [@media(pointer:coarse)]:min-h-11",
        )}
      >
        {busy ? <Spinner size="sm" /> : <Search size="0.875rem" className="shrink-0" aria-hidden />}
        <span className="sr-only">{label}</span>
        <input
          ref={ref}
          type="search"
          data-list-search
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-keyshortcuts={slashShortcut ? "/" : undefined}
          {...input}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (event.defaultPrevented || event.key !== "Escape" || !value) return;
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            // Only a field with text keeps Escape; an empty one lets the dialog or menu close.
            event.preventDefault();
            event.stopPropagation();
            onChange("");
          }}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-base text-foreground outline-none placeholder:text-foreground/40 md:text-xs [&::-webkit-search-cancel-button]:hidden"
        />
      </label>
      {slashShortcut && !value && (
        <kbd
          title={t("search.field.shortcutHint")}
          className="me-2.5 hidden shrink-0 rounded border border-[var(--border)] px-1.5 font-mono text-[0.625rem] leading-4 text-foreground/45 group-focus-within:hidden [@media(pointer:fine)]:inline"
        >
          /
        </kbd>
      )}
      {status && (
        <span
          role="status"
          className="shrink-0 whitespace-nowrap pe-2.5 text-[0.6875rem] tabular-nums text-foreground/50"
        >
          {status}
        </span>
      )}
      {value && (
        <button
          type="button"
          // A tap must not take the focus, or the phone keyboard closes. Not onPointerDown: WebKit then drops the click.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onChange("");
            ref.current?.focus();
          }}
          aria-label={t("connections.list.clearSearch")}
          title={t("connections.list.clearSearch")}
          className={cn(
            "-ms-2.5 flex shrink-0 items-center justify-center rounded-lg hover:text-foreground",
            compact ? "h-8 w-8" : "h-11 w-11 md:h-9 md:w-9 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11",
            FOCUS,
          )}
        >
          <X size="0.875rem" aria-hidden />
        </button>
      )}
    </div>
  );
}
