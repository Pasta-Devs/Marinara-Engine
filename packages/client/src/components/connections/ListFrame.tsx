// ──────────────────────────────────────────────
// ListFrame — the shell around a list of rows: the search field, the scroll area, its arrow keys
// and the one status line (loading, empty, no match). The pickers, the switcher and the Move
// dialog all draw it; ListHeading also stands alone where a list has its own shell. The search
// field is ui/SearchInput.
// ──────────────────────────────────────────────
import { type HTMLAttributes, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { cn } from "../../lib/utils";
import { findScrollParent } from "../../lib/panel-virtual-list";

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
  /** Usually a SearchInput, with any buttons that sit beside it. */
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
    // A virtual list mounts rows near the view only, so DOM order is not list order: ask the row's own list for its neighbour.
    const row = from?.closest<HTMLElement>("[data-index]");
    const list = row?.parentElement?.hasAttribute("data-virtual-list") ? row.parentElement : null;
    const step = down ? 1 : -1;
    const want = row && list ? Number(row.dataset.index) + step : -1;
    if (list && want >= 0 && want < Number(list.dataset.count)) {
      const scroller = findScrollParent(row!);
      let tries = 10;
      const go = () => {
        const el = list.querySelector<HTMLElement>(`[data-index="${want}"]`)?.querySelector<HTMLElement>(option);
        if (el) el.focus();
        else if (tries-- > 0 && scroller) {
          scroller.scrollBy({ top: step * row!.offsetHeight });
          requestAnimationFrame(go);
        }
      };
      go();
      return;
    }
    const next = options[index + step];
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
