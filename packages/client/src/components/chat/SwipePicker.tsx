import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, List, ListFilter, Search, Shuffle, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Modal } from "../ui/Modal";
import { useMessageSwipes } from "../../hooks/use-chats";
import { greetingBody, parseGreeting, parseGreetings, type GreetingEntry } from "../../lib/character-greetings";
import { cn } from "../../lib/utils";
import { RoleplayMessagePreview } from "./ChatMessage";

interface SwipePickerProps {
  chatId: string;
  messageId: string;
  activeSwipeIndex: number;
  swipeCount: number;
  currentContent: string;
  /** The chat's first message, whose swipes are the card's greetings. */
  greeting: boolean;
  /** Resolves `true` once the switch is saved. */
  onSetActiveSwipe: (index: number) => void | Promise<boolean | undefined>;
  /** Classes of the list button, so it matches the arrows next to it. */
  triggerClassName: string;
}

type Row = GreetingEntry & { index: number; haystack: string; body: string };
/** More chips than this start folded behind the Filters button. */
const OPEN_FILTERS_MAX = 8;

/** Lists below this size get no search box and no fixed height. */
const SEARCH_MIN = 8;
/** Tag positions 4 and later share the last filter group. */
const tagSlot = (position: number) => Math.min(position, 3);
const byTag = (a: string, b: string) =>
  Number(a === "Any") - Number(b === "Any") || a.localeCompare(b, undefined, { numeric: true });
const hasTag = (row: Row, slot: number, value: string) =>
  slot < 3 ? row.tags[slot] === value : row.tags.slice(3).includes(value);

/**
 * Swipe picker for any message. On the chat's first message every alternate greeting is a swipe,
 * so this is also the greeting picker; leading `[tag]` groups in the text become filter chips.
 */
export function SwipePicker({
  chatId,
  messageId,
  activeSwipeIndex,
  swipeCount,
  currentContent,
  greeting,
  onSetActiveSwipe,
  triggerClassName,
}: SwipePickerProps) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<string[][]>([[], [], [], []]);
  const [activeRow, setActiveRow] = useState(0);
  // null = folded only when there are many chips; the Filters button sets it either way.
  // Rows open only after a click or an arrow key, so the list shows whole when the picker opens.
  const [reading, setReading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState<boolean | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollToCurrent = useRef(false);
  const swipes = useMessageSwipes(chatId, messageId, open);

  const rows = useMemo<Row[]>(() => {
    const sorted = [...(swipes.data ?? [])].sort((a, b) => a.index - b.index);
    const entries = parseGreetings(sorted.map((swipe) => swipe.content));
    const tagged = entries.some((entry) => entry.tags.length > 0);
    return entries.map((entry, i) => ({
      ...entry,
      index: sorted[i]!.index,
      body: greetingBody(sorted[i]!.content, tagged),
      haystack: `${entry.tags.join(" ")} ${entry.title} ${entry.preview}`.toLowerCase(),
    }));
  }, [swipes.data]);

  // Prefer the loaded row so tag parsing matches the list (a lone `[OOC]` stays in the title).
  const currentTitle =
    rows.find((row) => row.index === activeSwipeIndex)?.title ||
    parseGreeting(currentContent).title ||
    localizeUi("ui.chat.swipepicker.untitled");

  const groups = useMemo(() => {
    const values = [new Set<string>(), new Set<string>(), new Set<string>(), new Set<string>()];
    for (const row of rows) row.tags.forEach((tag, position) => values[tagSlot(position)]!.add(tag));
    return values.map((set) => [...set].sort(byTag));
  }, [rows]);

  const needle = query.trim().toLowerCase();
  const matches = (row: Row, skipSlot: number) =>
    (!needle || row.haystack.includes(needle)) &&
    filters.every(
      (picked, slot) => slot === skipSlot || !picked.length || picked.some((value) => hasTag(row, slot, value)),
    );

  // Sections by the first tag in card order; keyboard order follows the visual order.
  const bySection = new Map<string, Row[]>();
  for (const row of rows) {
    if (!matches(row, -1)) continue;
    const key = row.tags[0] ?? "";
    bySection.set(key, [...(bySection.get(key) ?? []), row]);
  }
  const sections = [...bySection.entries()].sort(([a], [b]) => Number(!a) - Number(!b) || byTag(a, b));
  const visible = sections.flatMap(([, sectionRows]) => sectionRows);
  const pickedCount = filters.flat().length;
  const large = swipeCount >= SEARCH_MIN;
  const optionId = (row: Row) => `greeting-${messageId}-${row.index}`;

  const moveActive = (next: number, block: ScrollLogicalPosition = "nearest") => {
    if (!visible.length) return;
    const clamped = Math.max(0, Math.min(next, visible.length - 1));
    setActiveRow(clamped);
    setReading(true);
    document.getElementById(optionId(visible[clamped]!))?.scrollIntoView({ block });
  };

  const openPicker = () => {
    setQuery("");
    setFilters([[], [], [], []]);
    setFiltersOpen(null);
    setReading(false);
    setActiveRow(0);
    scrollToCurrent.current = true;
    setOpen(true);
  };

  // On open the current greeting becomes the active row and scrolls into view once the list renders.
  const listCallback = (node: HTMLDivElement | null) => {
    listRef.current = node;
    if (!node || !scrollToCurrent.current) return;
    scrollToCurrent.current = false;
    const current = visible.findIndex((row) => row.index === activeSwipeIndex);
    if (current <= 0) return;
    setActiveRow(current);
    requestAnimationFrame(() =>
      document.getElementById(optionId(visible[current]!))?.scrollIntoView({ block: "center" }),
    );
  };

  const choose = async (row: Row) => {
    setOpen(false);
    if (row.index === activeSwipeIndex) return;
    const previous = activeSwipeIndex;
    if ((await onSetActiveSwipe(row.index)) !== true) return;
    toast.success(
      localizeUi("ui.chat.swipepicker.switched", {
        title: row.title || localizeUi("ui.chat.swipepicker.untitled"),
      }),
      {
        action: { label: localizeUi("ui.chat.swipepicker.undo"), onClick: () => void onSetActiveSwipe(previous) },
      },
    );
  };

  const onListKeyDown = (event: KeyboardEvent) => {
    const steps: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, PageDown: 8, PageUp: -8 };
    if (event.key in steps) {
      event.preventDefault();
      moveActive(activeRow + steps[event.key]!);
    } else if (event.key === "Enter" && visible[activeRow]) {
      event.preventDefault();
      void choose(visible[activeRow]!);
    }
  };

  const toggleTag = (slot: number, value: string) => {
    setFilters((current) =>
      current.map((picked, i) =>
        i !== slot ? picked : picked.includes(value) ? picked.filter((v) => v !== value) : [...picked, value],
      ),
    );
    setActiveRow(0);
  };

  // One wrapping line per tag position, so no group scrolls out of sight.
  const chips = groups.map((values, slot) =>
    values.map((value) => {
      const on = filters[slot]!.includes(value);
      const count = rows.filter((row) => matches(row, slot) && hasTag(row, slot, value)).length;
      return (
        <button
          key={`${slot}-${value}`}
          type="button"
          aria-pressed={on}
          onClick={() => toggleTag(slot, value)}
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs whitespace-nowrap transition-colors max-md:h-9",
            on
              ? "border-[var(--primary)] bg-[var(--primary)] font-semibold text-[var(--primary-foreground)]"
              : "border-[var(--marinara-chat-chrome-panel-border)] hover:bg-[var(--marinara-chat-chrome-highlight-bg)]",
            !on && !count && "opacity-40",
          )}
        >
          {value}
          <span
            className={cn(
              "text-[0.6875rem] tabular-nums",
              on ? "opacity-70" : "text-[var(--marinara-chat-chrome-panel-muted)]",
            )}
          >
            {count}
          </span>
        </button>
      );
    }),
  );
  // Cards with real tags have titles worth scanning; the rest need more text to tell apart.
  const tagged = rows.some((row) => row.tags.length > 0);
  const chipTotal = groups.reduce((total, values) => total + values.length, 0);
  const showFilters = filtersOpen ?? chipTotal <= OPEN_FILTERS_MAX;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={localizeUi(greeting ? "ui.chat.swipepicker.open" : "ui.chat.swipepicker.openSwipe", {
          current: activeSwipeIndex + 1,
          total: swipeCount,
          title: currentTitle,
        })}
        title={currentTitle}
        onClick={(event) => {
          event.stopPropagation();
          openPicker();
        }}
        className={triggerClassName}
      >
        <List size="1.05em" />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={localizeUi(greeting ? "ui.chat.swipepicker.title" : "ui.chat.swipepicker.titleSwipes")}
        width="max-w-lg"
        opaque
        initialFocusRef={large && window.matchMedia("(pointer: fine)").matches ? searchRef : undefined}
        restoreFocusRef={triggerRef}
        panelClassName={large ? "sm:h-[min(85dvh,40rem)] max-sm:h-[85dvh]" : undefined}
      >
        <div className="sticky -top-4 z-10 -mx-5 -mt-4 mb-1 grid gap-2.5 border-b border-[var(--marinara-chat-chrome-panel-divider)] bg-[color:var(--mari-modal-opaque-bg)] bg-[image:linear-gradient(var(--marinara-chat-chrome-panel-bg),var(--marinara-chat-chrome-panel-bg))] px-5 pt-3 pb-3">
          <div className="flex items-center gap-2 text-xs text-[var(--marinara-chat-chrome-panel-muted)]">
            <span className="tabular-nums" aria-live="polite">
              {needle || pickedCount
                ? localizeUi("ui.chat.swipepicker.countFiltered", { shown: visible.length, total: rows.length })
                : localizeUi(greeting ? "ui.chat.swipepicker.count" : "ui.chat.swipepicker.countSwipes", {
                    total: swipeCount,
                  })}
            </span>
            {large && (
              <button
                type="button"
                title={localizeUi("ui.chat.swipepicker.surpriseTitle")}
                onClick={() => {
                  const others = visible
                    .map((row, i) => (row.index === activeSwipeIndex ? -1 : i))
                    .filter((i) => i >= 0);
                  if (others.length) moveActive(others[Math.floor(Math.random() * others.length)]!, "center");
                }}
                className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-lg px-2 transition-colors hover:bg-[var(--marinara-chat-message-action-bg-hover)] hover:text-[var(--marinara-chat-chrome-panel-text)] max-md:h-9"
              >
                <Shuffle size="1em" aria-hidden="true" />
                {localizeUi("ui.chat.swipepicker.surprise")}
              </button>
            )}
          </div>
          {large && (
            <div className="relative">
              <Search
                size="1rem"
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--marinara-chat-chrome-panel-muted)]"
              />
              <input
                ref={searchRef}
                type="search"
                role="combobox"
                aria-expanded="true"
                aria-controls={`greetings-${messageId}`}
                aria-activedescendant={visible[activeRow] ? optionId(visible[activeRow]!) : undefined}
                aria-label={localizeUi(
                  greeting ? "ui.chat.swipepicker.searchLabel" : "ui.chat.swipepicker.searchLabelSwipes",
                )}
                placeholder={localizeUi("ui.chat.swipepicker.searchPlaceholder")}
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveRow(0);
                  listRef.current?.closest(".overflow-y-auto")?.scrollTo({ top: 0 });
                }}
                onKeyDown={onListKeyDown}
                className="h-10 w-full rounded-lg border border-[var(--marinara-chat-chrome-input-border)] bg-[var(--marinara-chat-chrome-input-bg)] pr-9 pl-9 text-base text-[var(--marinara-chat-chrome-panel-text)] placeholder:text-[var(--marinara-chat-chrome-panel-muted)] focus:border-[var(--marinara-chat-chrome-input-border-focus)] focus:ring-2 focus:ring-[var(--marinara-chat-chrome-focus-ring)] focus:outline-none sm:text-sm [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  aria-label={localizeUi("ui.chat.swipepicker.clearSearch")}
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                  className="absolute top-1/2 right-1 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--marinara-chat-chrome-panel-muted)] hover:bg-[var(--marinara-chat-message-action-bg-hover)]"
                >
                  <X size="0.9rem" aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          {chipTotal > 0 && (
            <div className="grid gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-expanded={showFilters}
                  aria-controls={`greeting-filters-${messageId}`}
                  onClick={() => setFiltersOpen(!showFilters)}
                  className={cn(
                    "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors max-md:h-9",
                    pickedCount > 0
                      ? "border-[var(--primary)] text-[var(--primary)]"
                      : "border-[var(--marinara-chat-chrome-panel-border)] hover:bg-[var(--marinara-chat-chrome-highlight-bg)]",
                  )}
                >
                  <ListFilter size="0.9rem" aria-hidden="true" />
                  {localizeUi("ui.chat.swipepicker.filters")}
                  {pickedCount > 0 && <span className="font-semibold tabular-nums">{pickedCount}</span>}
                  <ChevronDown
                    size="0.8rem"
                    aria-hidden="true"
                    className={cn("transition-transform", showFilters && "rotate-180")}
                  />
                </button>
                {!showFilters && pickedCount > 0 && (
                  <span className="min-w-0 truncate text-xs text-[var(--primary)]">{filters.flat().join(" · ")}</span>
                )}
                {pickedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters([[], [], [], []])}
                    className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-[var(--primary)] px-2.5 text-xs font-semibold text-[var(--primary)] max-md:h-9"
                  >
                    <X size="0.8rem" aria-hidden="true" />
                    {localizeUi("ui.chat.swipepicker.clearTags", { count: pickedCount })}
                  </button>
                )}
              </div>
              {showFilters && (
                <div
                  id={`greeting-filters-${messageId}`}
                  role="group"
                  aria-label={localizeUi("ui.chat.swipepicker.filterLabel")}
                  className="grid gap-1.5"
                >
                  {chips
                    .filter((group) => group.length > 0)
                    .map((group, i) => (
                      <div key={i} className="flex flex-wrap gap-1.5">
                        {group}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {swipes.isLoading ? (
          <p className="py-8 text-center text-sm text-[var(--marinara-chat-chrome-panel-muted)]">
            {localizeUi("ui.chat.swipepicker.loading")}
          </p>
        ) : swipes.isError ? (
          <p role="alert" className="py-8 text-center text-sm text-[var(--destructive)]">
            {localizeUi("ui.chat.swipepicker.loadFailed")}
          </p>
        ) : !visible.length ? (
          <div className="grid justify-items-center gap-1 py-10 text-center">
            <span className="text-sm font-semibold">{localizeUi("ui.chat.swipepicker.empty")}</span>
            <span className="text-xs text-[var(--marinara-chat-chrome-panel-muted)]">
              {needle
                ? localizeUi("ui.chat.swipepicker.emptySearch", { query: query.trim() })
                : localizeUi("ui.chat.swipepicker.emptyTags")}
            </span>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {needle && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="mari-chrome-control rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] px-3 py-1.5 text-xs max-md:min-h-11"
                >
                  {localizeUi("ui.chat.swipepicker.clearSearch")}
                </button>
              )}
              {pickedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilters([[], [], [], []])}
                  className="mari-chrome-control rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] px-3 py-1.5 text-xs max-md:min-h-11"
                >
                  {localizeUi("ui.chat.swipepicker.clearTags", { count: pickedCount })}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div
            ref={listCallback}
            id={`greetings-${messageId}`}
            role="listbox"
            tabIndex={large ? -1 : 0}
            aria-label={localizeUi(greeting ? "ui.chat.swipepicker.title" : "ui.chat.swipepicker.titleSwipes")}
            aria-activedescendant={visible[activeRow] ? optionId(visible[activeRow]!) : undefined}
            onKeyDown={onListKeyDown}
            className="-mx-3 outline-none"
          >
            {sections.map(([section, sectionRows]) => (
              <div
                key={section || "-"}
                role="group"
                aria-label={section || (sections.length > 1 ? localizeUi("ui.chat.swipepicker.other") : undefined)}
              >
                {(section || sections.length > 1) && (
                  <div
                    aria-hidden="true"
                    className="px-3 pt-3 pb-1 text-[0.6875rem] font-semibold tracking-wide text-[var(--marinara-chat-chrome-panel-muted)] uppercase"
                  >
                    {section || localizeUi("ui.chat.swipepicker.other")}{" "}
                    <span className="font-normal tracking-normal">{sectionRows.length}</span>
                  </div>
                )}
                {sectionRows.map((row) => {
                  const isCurrent = row.index === activeSwipeIndex;
                  const isActive = visible[activeRow] === row;
                  const isOpen = isActive && reading;
                  return (
                    <div
                      key={row.index}
                      id={optionId(row)}
                      role="option"
                      aria-selected={isCurrent}
                      aria-expanded={isOpen}
                      // First click opens the row to read it; a click on the open row uses it.
                      onClick={() => (isOpen ? void choose(row) : moveActive(visible.indexOf(row)))}
                      className={cn(
                        "relative grid cursor-pointer grid-cols-[2ch_1fr_auto] gap-x-2.5 gap-y-0.5 rounded-lg py-2 pr-3 pl-2 [contain-intrinsic-size:auto_4rem] [content-visibility:auto] hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] max-md:py-2.5",
                        isActive &&
                          "bg-[var(--marinara-chat-chrome-highlight-bg-hover)] ring-1 ring-[var(--marinara-chat-chrome-panel-border)]",
                        isCurrent &&
                          "before:absolute before:top-2.5 before:bottom-2.5 before:left-0 before:w-[3px] before:rounded-full before:bg-[var(--primary)] before:content-['']",
                      )}
                    >
                      <span
                        className={cn(
                          "row-span-3 pt-0.5 text-right text-[0.6875rem] tabular-nums",
                          isCurrent ? "text-[var(--primary)]" : "text-[var(--marinara-chat-chrome-panel-muted)]",
                        )}
                      >
                        {row.index + 1}
                      </span>
                      <span className="line-clamp-2 text-[0.8125rem] leading-snug font-semibold [overflow-wrap:anywhere]">
                        {row.title || localizeUi("ui.chat.swipepicker.untitled")}
                      </span>
                      <span className="pt-px text-[0.6875rem] whitespace-nowrap text-[var(--marinara-chat-chrome-panel-muted)]">
                        {isCurrent ? (
                          <span className="font-semibold text-[var(--primary)]">
                            {localizeUi("ui.chat.swipepicker.current")}
                          </span>
                        ) : (
                          row.tags.slice(1).join(" · ")
                        )}
                      </span>
                      {isOpen && row.body ? (
                        <>
                          <RoleplayMessagePreview
                            content={row.body}
                            className="col-span-2 max-h-[12rem] overflow-hidden text-xs leading-relaxed [mask-image:linear-gradient(to_bottom,black_9rem,transparent_12rem)] [overflow-wrap:anywhere]"
                          />
                          {!isCurrent && (
                            <span className="col-span-2 mt-1.5 inline-flex h-8 w-fit items-center rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)] max-md:h-10 max-md:w-full max-md:justify-center">
                              {localizeUi(
                                greeting ? "ui.chat.swipepicker.useGreeting" : "ui.chat.swipepicker.useSwipe",
                              )}
                            </span>
                          )}
                        </>
                      ) : (
                        row.preview && (
                          <span
                            className={cn(
                              "col-span-2 text-xs leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)] [overflow-wrap:anywhere]",
                              tagged ? "line-clamp-1" : "line-clamp-3",
                            )}
                          >
                            {row.preview}
                          </span>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
