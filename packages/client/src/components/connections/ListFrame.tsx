// ──────────────────────────────────────────────
// ListFrame — the shell around a list of rows: the search field, the scroll area, its arrow keys
// and the one status line (loading, empty, no match). The pickers, the switcher and the Move
// dialog all draw it; ListSearch and ListHeading also stand alone where a list has its own shell.
// ──────────────────────────────────────────────
import {
  useRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { FOCUS } from "./ModelRow";

/** The search field: an icon, the input and, once there is text, a clear button. Escape clears the text first. */
export function ListSearch({
  value,
  onChange,
  label,
  inputRef,
  onKeyDown,
  className,
  ...input
}: {
  value: string;
  onChange: (value: string) => void;
  /** Read by screen readers; the placeholder can say more. */
  label: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className" | "type"> & {
    [key: `data-${string}`]: string | boolean | undefined;
  }) {
  const { t } = useTranslation();
  const ownRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? ownRef;
  return (
    <div
      className={cn(
        "mari-chrome-field flex min-h-11 min-w-0 items-center rounded-lg text-foreground/55 focus-within:ring-1 focus-within:ring-[var(--ring)] md:min-h-9 [@media(pointer:coarse)]:min-h-11",
        className,
      )}
    >
      <label className="flex min-w-0 flex-1 items-center gap-2 self-stretch ps-2.5 pe-2.5">
        <Search size="0.875rem" className="shrink-0" aria-hidden />
        <span className="sr-only">{label}</span>
        <input
          ref={ref}
          type="search"
          data-list-search
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
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
          className="min-w-0 flex-1 bg-transparent py-1.5 text-base text-foreground outline-none placeholder:text-foreground/40 md:text-xs [&::-webkit-search-cancel-button]:appearance-none"
        />
      </label>
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            ref.current?.focus();
          }}
          aria-label={t("connections.list.clearSearch")}
          title={t("connections.list.clearSearch")}
          className={cn(
            "-ms-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:text-foreground md:h-9 md:w-9 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11",
            FOCUS,
          )}
        >
          <X size="0.875rem" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** A small heading over a group of rows, such as "Recent" or "All models". */
export function ListHeading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("px-3 pb-0.5 pt-2 text-[0.6875rem] font-medium text-foreground/45", className)}>{children}</p>
  );
}

/** One status line under the rows: loading, nothing yet or no match. */
export function ListStatus({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p role="status" className={cn("px-3 py-3 text-center text-[0.6875rem] text-foreground/50", className)}>
      {children}
    </p>
  );
}

export function ListFrame({
  search,
  header,
  status,
  option,
  listRef,
  className,
  listClassName,
  aside,
  children,
  ...list
}: {
  /** Usually a ListSearch, with any buttons that sit beside it. */
  search?: ReactNode;
  /** Filters and notes between the search and the rows; they do not scroll. */
  header?: ReactNode;
  /** The line under the rows; a string gets the ListStatus look. */
  status?: ReactNode;
  /** Selector of the focusable rows: turns on ↑/↓ from the search through the rows and back. */
  option?: string;
  listRef?: Ref<HTMLDivElement>;
  className?: string;
  /** Padding and height of the scroll area. */
  listClassName?: string;
  /** A column beside the rows, such as the model details. */
  aside?: ReactNode;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "className" | "children"> & {
    [key: `data-${string}`]: string | boolean | undefined;
  }) {
  // Arrows walk the options; ↓ in the search goes to the first, ↑ from the first goes back to the search.
  // A control beside an option in its ModelRow (a star) walks from that option.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!option || event.defaultPrevented || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    if (event.nativeEvent.isComposing) return;
    const target = event.target as HTMLElement;
    const options = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(option));
    const input = event.currentTarget.querySelector<HTMLInputElement>("[data-list-search]");
    const down = event.key === "ArrowDown";
    if (target === input) {
      if (!down || !options[0]) return;
      event.preventDefault();
      options[0].focus();
      return;
    }
    const from = target.closest<HTMLElement>(option) ?? target.closest(".mari-connection-model")?.querySelector(option);
    const index = from ? options.indexOf(from as HTMLElement) : -1;
    if (index < 0) return;
    event.preventDefault();
    const next = options[index + (down ? 1 : -1)];
    if (next) next.focus();
    else if (!down) input?.focus();
  };
  return (
    <div className={cn("flex min-h-0 min-w-0 flex-col", className)} onKeyDown={onKeyDown}>
      {search}
      {header}
      <div className="flex min-h-0 flex-1">
        <div
          ref={listRef}
          {...list}
          className={cn("min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain", listClassName)}
        >
          {children}
          {typeof status === "string" ? <ListStatus>{status}</ListStatus> : status}
        </div>
        {aside}
      </div>
    </div>
  );
}
