// ──────────────────────────────────────────────
// Lorebook Form Fields
// Shared sub-components used by both LorebookEditor (overview tab)
// and LorebookEntryRow (the per-entry inline drawer).
// Extracted from LorebookEditor.tsx so styling stays consistent.
// ──────────────────────────────────────────────
import { useState } from "react";
import { FileText } from "lucide-react";
import { cn } from "../../lib/utils";
import { HelpTooltip } from "../ui/HelpTooltip";
import { MacroTextarea } from "../ui/MacroTextarea";
import { DraftNumberInput } from "../ui/DraftNumberInput";
import { SettingsSwitch } from "../panels/settings/SettingControls";

export function FieldGroup({
  label,
  icon: Icon,
  help,
  children,
}: {
  label: string;
  icon: typeof FileText;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--marinara-editor-muted)]">
        <Icon size="0.8125rem" className="mari-chrome-accent-icon mari-accent-animated" />
        {label}
        {help && <HelpTooltip text={help} />}
      </div>
      {children}
    </div>
  );
}

export function KeysEditor({ keys, onChange }: { keys: string[]; onChange: (keys: string[]) => void }) {
  const [input, setInput] = useState("");

  const addKey = () => {
    const trimmed = input.trim();
    if (trimmed && !keys.includes(trimmed)) {
      onChange([...keys, trimmed]);
      setInput("");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {keys.map((key, i) => (
          <span
            key={i}
            className="mari-editor-chip mari-editor-chip--accent px-2 py-1 text-[0.6875rem]"
          >
            {key}
            <button
              onClick={() => onChange(keys.filter((_, j) => j !== i))}
              className="ml-0.5 rounded-sm text-[var(--marinara-editor-muted)] hover:text-[var(--destructive)]"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={addKey}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKey())}
          className="mari-editor-field flex-1 px-2 py-1.5 text-xs"
          placeholder="Type a keyword, press Enter, or click away…"
        />
        <button
          type="button"
          onClick={addKey}
          className="mari-editor-action mari-editor-action--compact px-2 py-1.5 text-[0.6875rem]"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function ToggleButton({
  label,
  value,
  onChange,
  tooltip,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  tooltip?: string;
}) {
  return (
    <SettingsSwitch
      label={label}
      checked={value}
      onChange={onChange}
      title={tooltip}
      className={cn(
        "w-full justify-between rounded-lg px-2.5 py-2 text-xs font-medium ring-1",
        value
          ? "mari-chrome-accent-surface mari-accent-animated"
          : "mari-editor-field text-[var(--marinara-editor-muted)]",
      )}
      labelClassName="text-xs"
      labelPosition="start"
    />
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-[0.6875rem] text-[var(--muted-foreground)]">{label}</label>
      <DraftNumberInput
        value={value}
        onCommit={(nextValue) => onChange(nextValue)}
        min={min}
        max={max}
        selectOnFocus
        className="mari-editor-field w-full px-2 py-1.5 text-xs"
      />
    </div>
  );
}

/** Textarea with an expand button that opens a fullscreen modal editor. */
export function ExpandableTextarea({
  value,
  onChange,
  onBlur,
  onCommit,
  rows,
  placeholder,
  title,
  showMacroReference = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  onCommit?: () => void;
  rows?: number;
  placeholder?: string;
  title?: string;
  showMacroReference?: boolean;
}) {
  return (
    <MacroTextarea
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      onExpandedClose={onCommit}
      rows={rows ?? 6}
      placeholder={placeholder}
      title={title ?? "Edit"}
      showMacroReference={showMacroReference}
      className="mari-editor-field w-full resize-y p-2.5 text-sm"
    />
  );
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
