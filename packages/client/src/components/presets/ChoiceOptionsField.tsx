// ──────────────────────────────────────────────
// Choice Options Field
// The options of one preset-style variable as the player sees them: radio
// rows, checkbox rows, a dropdown/listbox, or a one-option on/off switch.
// Shared by the preset choice modal and character onboarding.
// ──────────────────────────────────────────────
import { CheckCircle2, Circle, CheckSquare2, ListChecks, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import { PickerListField } from "../ui/PickerField";
import { Select } from "../ui/Select";

export interface ChoiceFieldOption {
  id: string;
  label: string;
  value: string;
  /** Optional help text under the label (onboarding options). */
  description?: string;
}

export interface ChoiceFieldVariable {
  options: ChoiceFieldOption[];
  multiSelect: boolean;
  displayMode: "auto" | "buttons" | "listbox";
  optionSort: "manual" | "alphabetical";
}

const CHOICE_LISTBOX_AUTO_THRESHOLD = 8;

function getPresentedOptions(variable: ChoiceFieldVariable) {
  if (variable.optionSort !== "alphabetical") return variable.options;
  // A hand-edited imported option can lack a label.
  return [...variable.options].sort((a, b) =>
    String(a.label ?? "").localeCompare(String(b.label ?? ""), undefined, { sensitivity: "base" }),
  );
}

function shouldUseListbox(variable: ChoiceFieldVariable) {
  if (variable.options.length <= 1 && !variable.multiSelect) return false;
  if (variable.displayMode === "buttons") return false;
  if (variable.displayMode === "listbox") return true;
  return variable.options.length >= CHOICE_LISTBOX_AUTO_THRESHOLD;
}

/** The option's help text, then its value unless the value only repeats the label. */
function OptionDetails({ option }: { option: ChoiceFieldOption }) {
  // A hand-edited imported preset option can lack a value or label.
  const value = String(option.value ?? "");
  const repeatsLabel =
    value.trim().toLowerCase() ===
    String(option.label ?? "")
      .trim()
      .toLowerCase();
  return (
    <>
      {option.description && (
        <span className="mt-0.5 block text-[0.6875rem] text-[var(--foreground)]/80">{option.description}</span>
      )}
      {value && !repeatsLabel && (
        <span className="mt-0.5 block line-clamp-2 text-[0.625rem] text-[var(--muted-foreground)]">
          {value.slice(0, 150)}
          {value.length > 150 ? "…" : ""}
        </span>
      )}
    </>
  );
}

/**
 * `selection` holds option keys: a string for single choice, an array for
 * multi-select. `optionKey` says what identifies an option — preset choices
 * store the option value, onboarding stores the option id.
 */
export function ChoiceOptionsField({
  variable,
  selection,
  optionKey,
  onChange,
  allowBooleanToggle = true,
  ariaLabel,
}: {
  variable: ChoiceFieldVariable;
  selection: string | string[] | undefined;
  optionKey: (option: ChoiceFieldOption) => string;
  onChange: (next: string | string[]) => void;
  /** A single non-multi option renders as an on/off switch (preset variables only). */
  allowBooleanToggle?: boolean;
  /** Accessible name for the dropdown/list, usually the question. */
  ariaLabel?: string;
}) {
  const { t } = useTranslation();
  const presentedOptions = getPresentedOptions(variable);
  const listboxMode = shouldUseListbox(variable);
  const selectedKeys = Array.isArray(selection) ? selection : [];
  // A multi-pick value follows the list it was picked from, not the order of clicks (the native select it replaced
  // did too), drops keys no option carries any more, and holds each key once even when an imported list repeats one.
  const inOptionOrder = (keys: readonly string[]) =>
    [...new Set(presentedOptions.map(optionKey))].filter((key) => keys.includes(key));
  const toggle = (key: string) =>
    onChange(
      inOptionOrder(selectedKeys.includes(key) ? selectedKeys.filter((v) => v !== key) : [...selectedKeys, key]),
    );

  return (
    <div className="space-y-1.5">
      {listboxMode && variable.multiSelect ? (
        // A long multi-pick list opens the shared multi-pick window (#9468), as the profile slots do; the picks are
        // listed under the field, each with its remove button.
        <PickerListField
          items={presentedOptions.map((opt) => ({
            id: optionKey(opt),
            label: String(opt.label ?? ""),
            subtitle: opt.description ?? null,
            searchText: opt.description,
          }))}
          selectedIds={selectedKeys}
          onToggle={toggle}
          onAdd={(ids) => onChange(inOptionOrder([...selectedKeys, ...ids]))}
          title={ariaLabel ?? ""}
          ariaLabel={ariaLabel}
          triggerLabel={t("ui.select.chooseOptions")}
          triggerIcon={
            <ListChecks size="0.875rem" aria-hidden="true" className="shrink-0 text-[var(--muted-foreground)]" />
          }
          triggerClassName="mari-preset-native-select w-full rounded-lg bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          removeLabel={(name) => t("chat.settingsProfile.builder.remove", { name })}
          searchLabel={t("ui.select.search")}
          emptyLabel={t("ui.select.empty")}
          noMatchesLabel={t("ui.select.noMatches")}
        />
      ) : listboxMode ? (
        // With nothing picked (e.g. "Write your own"), the field stays blank instead of showing the first option.
        <Select
          label={ariaLabel ?? ""}
          value={typeof selection === "string" ? selection : null}
          onChange={onChange}
          className="mari-preset-native-select w-full rounded-lg bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          options={presentedOptions.map((opt) => ({ value: optionKey(opt), label: String(opt.label ?? "") }))}
        />
      ) : variable.multiSelect ? (
        // ── Multi-select: checkboxes ──
        presentedOptions.map((opt) => {
          const isSelected = selectedKeys.includes(optionKey(opt));
          return (
            <button
              type="button"
              key={opt.id}
              aria-pressed={isSelected}
              onClick={() => toggle(optionKey(opt))}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition-all",
                isSelected ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30" : "hover:bg-[var(--accent)]",
              )}
            >
              {isSelected ? (
                <CheckSquare2 size="0.875rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
              ) : (
                <Square size="0.875rem" className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
              )}
              <div className="min-w-0 flex-1">
                <span className={cn("text-xs font-medium", isSelected && "text-[var(--primary)]")}>{opt.label}</span>
                <OptionDetails option={opt} />
              </div>
            </button>
          );
        })
      ) : allowBooleanToggle && presentedOptions.length === 1 ? (
        // ── Boolean toggle: single option ──
        (() => {
          const opt = presentedOptions[0];
          if (!opt) return null;
          const isOn = selection === optionKey(opt);
          return (
            <SettingsSwitch
              checked={isOn}
              onChange={(checked) => onChange(checked ? optionKey(opt) : "")}
              label={
                <span className="min-w-0 flex-1">
                  <span className={cn("text-xs font-medium", isOn && "text-[var(--primary)]")}>{opt.label}</span>
                  <OptionDetails option={opt} />
                </span>
              }
              labelPosition="start"
              className={cn(
                "w-full justify-between gap-2.5 rounded-lg p-2.5 text-left transition-all",
                isOn ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30" : "hover:bg-[var(--accent)]",
              )}
              labelClassName="min-w-0 flex-1"
            />
          );
        })()
      ) : (
        // ── Single-select: radio-style ──
        presentedOptions.map((opt) => {
          const isSelected = selection === optionKey(opt);
          return (
            <button
              type="button"
              key={opt.id}
              aria-pressed={isSelected}
              onClick={() => onChange(optionKey(opt))}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition-all",
                isSelected ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30" : "hover:bg-[var(--accent)]",
              )}
            >
              {isSelected ? (
                <CheckCircle2 size="0.875rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
              ) : (
                <Circle size="0.875rem" className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
              )}
              <div className="min-w-0 flex-1">
                <span className={cn("text-xs font-medium", isSelected && "text-[var(--primary)]")}>{opt.label}</span>
                <OptionDetails option={opt} />
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}
