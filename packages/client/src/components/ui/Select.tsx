// ──────────────────────────────────────────────
// Select: the app's dropdown, in place of a native <select> (#9400). The field opens the shared
// picker window (a popover on desktop, a sheet on a phone, a popover inside a Modal) with the
// options as pick rows, and a search box only for longer lists. On the closed field the arrow keys
// step through the options and a letter jumps to the next one starting with it, like a native select.
// ──────────────────────────────────────────────
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { SELECT_SEARCH_MIN, stepSelectOption, typeAheadSelectOption } from "../../lib/select-options";
import { PickerChevron, useFieldWindow } from "./PickerField";
import { PickerFolderList } from "./PickerFolderList";
import { PickerWindow } from "./PickerWindow";

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  /** Second line under the label. */
  description?: string;
  icon?: ReactNode;
  /** Greys the option out, with this as its second line. */
  disabledReason?: string;
  /** Consecutive options with the same group sit under a header; the header is not an option. */
  group?: string;
};

export type SelectProps<T extends string> = {
  /** The picked value; null, or a value no option has, shows the placeholder. */
  value: T | null;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  /** The field's visible label: names the field and titles the window. */
  label: string;
  /** Field text when nothing is picked ("Choose what to change…"). */
  placeholder?: string;
  /** The field look of the surface it sits in. */
  className?: string;
  disabled?: boolean;
  id?: string;
  /** Hover text on the trigger. */
  title?: string;
  /** Id of the element that describes the field, set on the trigger. */
  "aria-describedby"?: string;
  /** A search box above the options. Defaults to on from SELECT_SEARCH_MIN options. */
  searchable?: boolean;
  /** Receives the trigger button, e.g. for a Modal's initialFocusRef. */
  buttonRef?: RefObject<HTMLButtonElement | null>;
};

export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  placeholder,
  className,
  disabled,
  id,
  title,
  "aria-describedby": ariaDescribedBy,
  searchable,
  buttonRef,
}: SelectProps<T>) {
  const { t } = useTranslation();
  const { open, triggerRef, close, toggle } = useFieldWindow(disabled);
  const selected = options.find((option) => option.value === value);
  // Re-picking the current option is no change, as with a native select.
  const pick = (next: T | undefined) => {
    if (next !== undefined && next !== value) onChange(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (open || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      // Alt+Down opens the list, as on a native select.
      if (event.altKey) toggle();
      else pick(stepSelectOption(options, value, event.key === "ArrowDown" ? 1 : -1));
    } else if (!event.altKey && event.key.length === 1 && event.key !== " ") {
      pick(typeAheadSelectOption(options, value, event.key));
    }
  };

  const withSearch = searchable ?? options.length >= SELECT_SEARCH_MIN;
  return (
    <>
      <button
        ref={(node) => {
          triggerRef.current = node;
          if (buttonRef) buttonRef.current = node;
        }}
        id={id}
        type="button"
        role="combobox"
        aria-label={label}
        aria-describedby={ariaDescribedBy}
        title={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-value={value ?? ""}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={onKeyDown}
        className={cn(className, "flex items-center justify-between gap-2 text-left")}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-[var(--muted-foreground)]")}>
          {selected?.label ?? placeholder ?? ""}
        </span>
        <PickerChevron open={open} />
      </button>
      {open && (
        <PickerWindow title={label} anchorRef={triggerRef} onClose={close} hug={!withSearch}>
          <PickerFolderList
            items={options.map((option) => ({
              id: option.value,
              label: option.label,
              subtitle: option.description,
              // The search also finds an option by its description (a language by its English name).
              searchText: option.description,
              icon: option.icon,
              disabledReason: option.disabledReason,
              group: option.group,
            }))}
            folders={[]}
            selectedIds={value === null ? [] : [value]}
            onToggle={(next) => {
              pick(next as T);
              close();
            }}
            searchable={withSearch}
            listLabel={label}
            searchLabel={t("ui.select.search")}
            emptyLabel={t("ui.select.empty")}
            noMatchesLabel={t("ui.select.noMatches")}
          />
        </PickerWindow>
      )}
    </>
  );
}
