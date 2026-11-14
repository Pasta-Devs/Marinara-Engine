import { useRef, type ChangeEvent, type ReactNode } from "react";
import { Check, Download, FolderPlus, Plus, Search, Upload } from "lucide-react";
import { cn } from "../../lib/utils";

type ImportAction =
  | { label: string; title: string; onClick: () => void }
  | { label: string; title: string; accept: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void };

interface LibraryTabToolbarProps {
  create: { label: string; title: string; onClick: () => void };
  importAction: ImportAction;
  exportAction?: { label: string; onClick: () => void; disabled?: boolean };
  select?: { active: boolean; label: string; title: string; onToggle: () => void; disabled?: boolean };
  search: { value: string; placeholder: string; onChange: (value: string) => void };
  /** Rendered next to the search field (the Presets tab's sort dropdown). */
  sort?: ReactNode;
  folder?: { label: string; onCreate: () => void; disabled?: boolean; extra?: ReactNode; helper?: ReactNode };
}

/**
 * The create / import / select row, search field and New Folder row shared by the Presets panel's tabs.
 * Markup is the Presets tab's original toolbar, so all three tabs look the same.
 */
export function LibraryTabToolbar({
  create,
  importAction,
  exportAction,
  select,
  search,
  sort,
  folder,
}: LibraryTabToolbarProps) {
  const secondaryButton = "mari-chrome-control mari-chrome-control--primary flex-1 text-xs";
  const importInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={create.onClick}
          className="mari-panel-gradient-button mari-panel-gradient--presets flex-1 text-xs"
          aria-label={create.label}
          title={create.title}
        >
          <Plus size="0.8125rem" />
        </button>
        {"onChange" in importAction ? (
          <>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className={secondaryButton}
              aria-label={importAction.label}
              title={importAction.title}
            >
              <Download size="0.8125rem" />
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept={importAction.accept}
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
              onChange={importAction.onChange}
            />
          </>
        ) : (
          <button
            type="button"
            onClick={importAction.onClick}
            className={secondaryButton}
            aria-label={importAction.label}
            title={importAction.title}
          >
            <Download size="0.8125rem" />
          </button>
        )}
        {exportAction && (
          <button
            type="button"
            onClick={exportAction.onClick}
            disabled={exportAction.disabled}
            className={secondaryButton}
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
            className={cn(secondaryButton, select.active && "mari-chrome-control--selected")}
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
        {sort}
      </div>

      {folder && (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={folder.onCreate}
              disabled={folder.disabled}
              className="mari-chrome-control mari-chrome-control--small flex-1 justify-start text-[0.6875rem]"
            >
              <FolderPlus size="0.75rem" />
              {folder.label}
            </button>
            {folder.extra}
          </div>
          {folder.helper}
        </div>
      )}
    </>
  );
}
