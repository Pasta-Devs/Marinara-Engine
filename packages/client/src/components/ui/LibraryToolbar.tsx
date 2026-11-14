import { useRef, type ChangeEvent, type ReactNode } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { ArrowUpDown, Check, Download, FolderPlus, Plus, Search, Upload, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

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
   * `extraOptions` adds panel-specific ones after them (Characters' Favorites).
   */
  sort?: {
    value: string;
    label: string;
    onChange: (value: string) => void;
    extraOptions?: { value: string; label: string }[];
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

const SECONDARY_BUTTON = "mari-chrome-control mari-chrome-control--primary flex-1 text-xs";
const FOLDER_BUTTON = "mari-chrome-control mari-chrome-control--small flex-1 justify-start text-[0.6875rem]";
const SEGMENTED_BUTTON =
  "mari-chrome-segmented__button min-w-0 justify-center gap-1 overflow-hidden px-1.5 py-2 text-[0.625rem] leading-normal";

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

  const renderLibraryButton = ({ label, title, icon: Icon, onClick }: LibraryRowButton) => (
    <button type="button" onClick={onClick} className={SEGMENTED_BUTTON} title={title ?? label}>
      <span className="shrink-0 leading-none">
        <Icon size="0.875rem" />
      </span>
      <span className="inline-flex min-h-4 min-w-0 items-center justify-center truncate whitespace-nowrap pb-px leading-normal">
        {label}
      </span>
    </button>
  );

  return (
    <>
      {library &&
        (library.openLibrary ? (
          <div
            className="mari-chrome-segmented mari-chrome-segmented--two"
            data-component={library.dataComponent}
            style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
          >
            {renderLibraryButton(library.download)}
            {renderLibraryButton(library.openLibrary)}
          </div>
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

      <div className="flex gap-2">
        <button
          type="button"
          onClick={create.onClick}
          className={`mari-panel-gradient-button mari-panel-gradient--${tone} flex-1 text-xs`}
          aria-label={create.label}
          title={create.title}
        >
          <Plus size="0.8125rem" />
        </button>
        <button
          type="button"
          onClick={() => {
            // aria-disabled, not disabled, so the title explaining why stays reachable.
            if (importBlocked) return;
            if ("onChange" in importAction) importInputRef.current?.click();
            else importAction.onClick();
          }}
          className={cn(SECONDARY_BUTTON, importBlocked && "cursor-not-allowed grayscale opacity-45")}
          aria-label={importAction.label}
          aria-disabled={importBlocked || undefined}
          title={importAction.disabledReason ?? importAction.title}
        >
          <Download size="0.8125rem" />
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
            className={SECONDARY_BUTTON}
            aria-label={exportAction.label}
            title={exportAction.label}
          >
            <Upload size="0.8125rem" />
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
            <Check size="0.8125rem" />
          </button>
        )}
      </div>

      <div className="flex gap-1.5">
        <div className="relative flex-1">
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
          <div className="relative">
            <select
              value={sort.value}
              onChange={(event) => sort.onChange(event.target.value)}
              className="mari-chrome-field mari-chrome-sort-field mari-accent-animated h-10 appearance-none py-0 pl-2.5 pr-7 text-[0.6875rem] md:h-9"
              title={localizeUi("ui.panels.agentspanel.sortOrder")}
              aria-label={sort.label}
            >
              <option value="custom" title={localizeUi("dragDrop.manualOrderHelp")}>
                {localizeUi("dragDrop.manualOrder")}
              </option>
              <option value="name-asc">{localizeUi("ui.panels.backgroundpicker.aZ")}</option>
              <option value="name-desc">{localizeUi("ui.panels.backgroundpicker.zA")}</option>
              <option value="newest">{localizeUi("ui.panels.backgroundpicker.newest")}</option>
              <option value="oldest">{localizeUi("ui.panels.backgroundpicker.oldest")}</option>
              {sort.extraOptions?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
