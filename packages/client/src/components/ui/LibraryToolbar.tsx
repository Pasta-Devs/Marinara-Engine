import { useLayoutEffect, useRef, useState, type ChangeEvent, type ReactNode, type RefObject } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { ArrowUpDown, Check, Download, FolderPlus, Plus, Search, Upload, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { librarySortOptions } from "../../lib/library-sort-options";
import { Select } from "./Select";

/** Which panel's gradient the create button uses (`mari-panel-gradient--<tone>`). */
export type LibraryToolbarTone = "characters" | "personas" | "lorebooks" | "agents" | "presets";

interface LibraryRowButton {
  label: string;
  title?: string;
  icon: LucideIcon;
  onClick: () => void;
}

type ImportAction = { label: string; title: string; disabledReason?: string } & (
  { onClick: () => void } | { accept: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void }
);

interface LibraryToolbarProps {
  tone: LibraryToolbarTone;
  /**
   * The row above the actions. One entry renders a full-width button (Agents' Agent Organizer); two render the
   * Download / Open Library segmented row of Characters and Personas.
   */
  library?: {
    download: LibraryRowButton & { badge?: string };
    openLibrary?: LibraryRowButton;
    /** The row's data-component, for e2e and theme hooks (CharacterLibraryActions …). */
    dataComponent?: string;
  };
  create: { label: string; title: string; onClick: () => void };
  importAction: ImportAction;
  exportAction?: { label: string; onClick: () => void; disabled?: boolean };
  select?: { active: boolean; label: string; title: string; onToggle: () => void; disabled?: boolean };
  search: { value: string; placeholder: string; onChange: (value: string) => void };
  /**
   * The sort menu next to the search field. It always offers Manual order, A–Z, Z–A, Newest and Oldest;
   * `extraOptions` adds panel-specific ones after them (Characters' Favorites), and `tokenSort` the size pair
   * (Most tokens, Fewest tokens) after those.
   */
  sort?: {
    value: string;
    label: string;
    onChange: (value: string) => void;
    extraOptions?: { value: string; label: string }[];
    tokenSort?: boolean;
  };
  folder?: {
    label: string;
    onCreate: () => void;
    disabled?: boolean;
    /** A view toggle next to New Folder (the Regexes tab's Execution order, the Functions tab's Manual order). */
    toggle?: { label: string; active: boolean; onToggle: () => void };
    helper?: string;
  };
  /** Panel-specific filters under the folder row (Characters' favorite and tag pills, Agents' mode filter). */
  children?: ReactNode;
}

// The action row (Add, Import, Export, Select): each labelled button takes its content's width plus a share of what is
// left, and they all shrink alike when even the words alone do not fit. `!`: the unlayered .mari-chrome-control sets
// flex-shrink 0 (which .mari-panel-gradient-button does not, so Add alone would shrink) and the unlayered
// .mari-chrome-control--primary and .mari-panel-gradient-button padding beat plain utilities.
export const ACTION_BUTTON_LAYOUT = "min-w-0 flex-auto !shrink !px-2 text-xs";
const ACTION_CONTROL = "mari-chrome-control mari-chrome-control--primary";
const SECONDARY_BUTTON = `${ACTION_CONTROL} ${ACTION_BUTTON_LAYOUT}`;
const FOLDER_BUTTON = "mari-chrome-control mari-chrome-control--small flex-1 justify-start text-[0.6875rem]";
const SEGMENTED_BUTTON =
  "mari-chrome-segmented__button min-w-0 justify-center gap-1 overflow-hidden px-1.5 py-2 text-[0.625rem] leading-normal";

interface SegmentedButton {
  label: string;
  title?: string;
  icon?: LucideIcon;
  onClick: () => void;
  /** A tab of the row (the Presets panel's): its selected state. */
  pressed?: boolean;
}

/** A compact cell's icon and the gap after it, in rem (the Presets panel's four tabs). */
const COMPACT_ICON_REM = 0.75;
const COMPACT_GAP_REM = 0.125;
/** An action button's icon (0.8125rem) and the .mari-chrome-control gap after it (0.375rem). */
const ACTION_ICON_REM = 0.8125;
const ACTION_BESIDE_REM = ACTION_ICON_REM + 0.375;

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/**
 * Whether every label (`[data-fit-label]`) in a row still shows whole with an icon of `besideRem` (the icon and its
 * gap) before it. The font (the system's, or the one picked in Appearance) and the language set the labels' widths,
 * so this measures the text instead of guessing a cut-off width. It reads the room as if the icons were there, so
 * hiding them never changes the answer.
 * - `cells`: the row is a grid of equal cells, and each label must fit its own cell.
 * - `content`: the row is a flex row of buttons sized to their content, and the labelled buttons together, with the
 *   other buttons and the gaps between them, must fit the row's width.
 */
export function useIconsFit(
  rowRef: RefObject<HTMLElement | null>,
  {
    enabled,
    labels,
    besideRem,
    layout,
  }: { enabled: boolean; labels: string; besideRem: number; layout: "cells" | "content" },
) {
  const [fit, setFit] = useState(true);
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!enabled || !row) return;
    const range = document.createRange();
    const textWidth = (label: Element) => {
      range.selectNodeContents(label);
      return range.getBoundingClientRect().width;
    };
    const check = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const beside = rem * besideRem;
      if (layout === "cells") {
        setFit(
          Array.from(row.querySelectorAll("[data-fit-label]")).every((label) => {
            const cell = label.parentElement!;
            const style = getComputedStyle(cell);
            const room = cell.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - beside;
            return textWidth(label) <= room + 0.5;
          }),
        );
        return;
      }
      // Hidden children (the file inputs) take no room.
      const items = Array.from(row.children).filter((child) => child.getClientRects().length > 0);
      const needed = sum(
        items.map((item) => {
          const label = item.querySelector("[data-fit-label]");
          if (!label) return item.getBoundingClientRect().width;
          const style = getComputedStyle(item);
          const frame = ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"] as const;
          return textWidth(label) + beside + sum(frame.map((side) => parseFloat(style[side]) || 0));
        }),
      );
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      setFit(needed + gap * Math.max(0, items.length - 1) <= row.clientWidth + 0.5);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(row);
    // A font picked in Appearance changes the labels' sizes even when the row keeps its own.
    row.querySelectorAll("[data-fit-label]").forEach((label) => observer.observe(label));
    // A web font that arrives late changes the labels' widths.
    void document.fonts?.ready.then(check);
    return () => observer.disconnect();
  }, [rowRef, enabled, labels, besideRem, layout]);
  return fit;
}

/** Whether an action row's icons fit beside their labels (see useIconsFit); Chats' row and LibraryToolbar's share it. */
export function useActionIconsFit(rowRef: RefObject<HTMLElement | null>, labels: string) {
  return useIconsFit(rowRef, { enabled: true, labels, besideRem: ACTION_BESIDE_REM, layout: "content" });
}

/** An action button's content: its icon, while the row has room for it (useActionIconsFit), and its short label. */
export function ActionContent({
  icon: Icon,
  label,
  showIcon,
  iconClassName,
}: {
  icon: LucideIcon;
  label: string;
  showIcon: boolean;
  iconClassName?: string;
}) {
  return (
    <>
      {showIcon ? <Icon size={`${ACTION_ICON_REM}rem`} className={cn("shrink-0", iconClassName)} /> : null}
      <span data-fit-label="" className="min-w-0 truncate">
        {label}
      </span>
    </>
  );
}

/**
 * One long button split by "|": Download | Open Library, and the Presets panel's Prompts | Regexes | Tools |
 * Profiles, so every panel's top row has the same height and look.
 */
export function SegmentedButtons({
  buttons,
  dataComponent,
  groupLabel,
}: {
  buttons: SegmentedButton[];
  dataComponent?: string;
  /** Names the row as a group of tabs. */
  groupLabel?: string;
}) {
  // Narrower cells (the Presets panel's four tabs) get a smaller icon and tighter spacing. Where a label would still
  // be cut short beside its icon, every icon of the row steps aside, so the labels always show whole.
  const compact = buttons.length > 2;
  const rowRef = useRef<HTMLDivElement>(null);
  const iconsFit = useIconsFit(rowRef, {
    enabled: compact && buttons.some((button) => button.icon),
    labels: buttons.map((button) => button.label).join("\n"),
    besideRem: COMPACT_ICON_REM + COMPACT_GAP_REM,
    layout: "cells",
  });
  return (
    <div
      ref={rowRef}
      className={cn("mari-chrome-segmented", buttons.length === 2 && "mari-chrome-segmented--two")}
      data-component={dataComponent}
      role={groupLabel ? "group" : undefined}
      aria-label={groupLabel}
      // The unlayered .mari-chrome-segmented rule beats grid-cols-* utilities.
      style={{ gridTemplateColumns: `repeat(${buttons.length}, minmax(0, 1fr))` }}
    >
      {buttons.map(({ label, title, icon: Icon, onClick, pressed }) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          // `!`: the unlayered .mari-chrome-segmented__button gap beats a plain gap utility.
          className={cn(SEGMENTED_BUTTON, compact && "!gap-0.5 px-0.5")}
          title={title ?? label}
          aria-pressed={pressed}
        >
          {Icon && (!compact || iconsFit) ? (
            <span className="shrink-0 leading-none">
              <Icon size={compact ? `${COMPACT_ICON_REM}rem` : "0.875rem"} />
            </span>
          ) : null}
          <span data-fit-label="" className="min-w-0 truncate pb-px leading-normal">
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * The toolbar every library panel shares (Characters, Personas, Lorebooks, Agents and the Presets panel's tabs):
 * an optional library row, create / import / export / select, search with sort, New Folder, then filters.
 * Rows are typed props rather than slots so a new panel gets the same markup instead of a drifting copy.
 */
export function LibraryToolbar({
  tone,
  library,
  create,
  importAction,
  exportAction,
  select,
  search,
  sort,
  folder,
  children,
}: LibraryToolbarProps) {
  const { t: localizeUi } = useUiTranslation();
  const importInputRef = useRef<HTMLInputElement>(null);
  const importBlocked = Boolean(importAction.disabledReason);
  const actionRowRef = useRef<HTMLDivElement>(null);
  const actionLabels = {
    add: localizeUi("ui.librarytoolbar.add"),
    import: localizeUi("ui.librarytoolbar.import"),
    select: localizeUi("ui.librarytoolbar.select"),
  };
  // The second argument only tells the fit check when to measure again: when a word changes (the language) or a
  // button comes or goes. The words themselves are read from the row.
  const showIcons = useActionIconsFit(
    actionRowRef,
    [actionLabels.add, actionLabels.import, select ? actionLabels.select : "", exportAction ? "export" : ""].join("\n"),
  );

  return (
    <>
      {library &&
        (library.openLibrary ? (
          <SegmentedButtons buttons={[library.download, library.openLibrary]} dataComponent={library.dataComponent} />
        ) : (
          <button
            type="button"
            onClick={library.download.onClick}
            className="mari-chrome-control mari-chrome-control--primary w-full text-xs"
            data-component={library.dataComponent}
            title={library.download.title}
          >
            <library.download.icon size="0.875rem" />
            {library.download.label}
            {library.download.badge && (
              <span className="rounded-md bg-[var(--marinara-chat-chrome-accent,var(--primary))] px-1.5 py-0.5 text-[0.625rem] font-semibold leading-none text-[var(--primary-foreground)]">
                {library.download.badge}
              </span>
            )}
          </button>
        ))}

      {/* Add, Import, Export and Select. Each labelled button shows a short word, and its icon while every word of
          the row still fits beside one; Export keeps only its icon. */}
      <div ref={actionRowRef} className="flex gap-2">
        <button
          type="button"
          onClick={create.onClick}
          className={`mari-panel-gradient-button mari-panel-gradient--${tone} ${ACTION_BUTTON_LAYOUT}`}
          aria-label={create.label}
          title={create.title}
        >
          <ActionContent icon={Plus} label={actionLabels.add} showIcon={showIcons} />
        </button>
        <button
          type="button"
          onClick={() => {
            // aria-disabled, not disabled: the title stays reachable, and the click still reaches the panel's
            // handler so it can say why (Agents shows a toast, the only explanation on touch screens).
            if ("onChange" in importAction) importInputRef.current?.click();
            else importAction.onClick();
          }}
          className={cn(SECONDARY_BUTTON, importBlocked && "cursor-not-allowed grayscale opacity-45")}
          aria-label={importAction.label}
          aria-disabled={importBlocked || undefined}
          title={importAction.disabledReason ?? importAction.title}
        >
          <ActionContent icon={Download} label={actionLabels.import} showIcon={showIcons} />
        </button>
        {"onChange" in importAction && (
          <input
            ref={importInputRef}
            type="file"
            accept={importAction.accept}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={importAction.onChange}
          />
        )}
        {exportAction && (
          <button
            type="button"
            onClick={exportAction.onClick}
            disabled={exportAction.disabled}
            // Icon only, at its own width, so the labelled buttons get the room.
            className={`${ACTION_CONTROL} flex-none !px-3 text-xs`}
            aria-label={exportAction.label}
            title={exportAction.label}
          >
            <Upload size={`${ACTION_ICON_REM}rem`} />
          </button>
        )}
        {select && (
          <button
            type="button"
            onClick={select.onToggle}
            disabled={select.disabled}
            className={cn(SECONDARY_BUTTON, select.active && "mari-chrome-control--selected")}
            aria-label={select.label}
            aria-pressed={select.active}
            title={select.title}
          >
            <ActionContent icon={Check} label={actionLabels.select} showIcon={showIcons} />
          </button>
        )}
      </div>

      <div className="flex gap-1.5">
        <div className="relative min-w-0 flex-1">
          <Search
            size="0.8125rem"
            className="mari-chrome-field-icon pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          />
          <input
            type="text"
            placeholder={search.placeholder}
            aria-label={search.placeholder}
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            className="mari-chrome-field h-10 w-full py-0 pl-8 pr-3 text-xs md:h-9"
          />
        </div>
        {sort && (
          <div className="relative" title={localizeUi("ui.panels.agentspanel.sortOrder")}>
            {/* The sort icon below stands in for the Select's own chevron, so that one is hidden. */}
            <Select
              value={sort.value}
              options={[
                {
                  value: "custom",
                  label: localizeUi("dragDrop.manualOrder"),
                  description: localizeUi("dragDrop.manualOrderHelp"),
                },
                ...librarySortOptions(localizeUi, {
                  az: "name-asc",
                  za: "name-desc",
                  newest: "newest",
                  oldest: "oldest",
                }),
                ...(sort.extraOptions ?? []).map((option) => ({ value: option.value, label: option.label })),
                ...(sort.tokenSort
                  ? librarySortOptions(localizeUi, { mostTokens: "tokens-desc", fewestTokens: "tokens-asc" })
                  : []),
              ]}
              onChange={sort.onChange}
              searchable={false}
              className="mari-chrome-field mari-chrome-sort-field mari-accent-animated h-10 py-0 pl-2.5 pr-7 text-[0.6875rem] md:h-9 [&>svg]:hidden"
              label={sort.label}
            />
            <ArrowUpDown
              size="0.625rem"
              className="mari-chrome-field-icon mari-chrome-sort-icon mari-accent-animated pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
            />
          </div>
        )}
      </div>

      {folder && (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <button type="button" onClick={folder.onCreate} disabled={folder.disabled} className={FOLDER_BUTTON}>
              <FolderPlus size="0.75rem" />
              {folder.label}
            </button>
            {folder.toggle && (
              <button
                type="button"
                aria-pressed={folder.toggle.active}
                onClick={folder.toggle.onToggle}
                className={cn(FOLDER_BUTTON, folder.toggle.active && "mari-chrome-control--selected")}
              >
                <ArrowUpDown size="0.75rem" />
                {folder.toggle.label}
              </button>
            )}
          </div>
          {folder.helper && <p className="mari-folder-helper">{folder.helper}</p>}
        </div>
      )}

      {children}
    </>
  );
}
