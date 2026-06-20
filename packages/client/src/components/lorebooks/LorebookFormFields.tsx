// ──────────────────────────────────────────────
// Lorebook Form Fields
// Shared sub-components used by both LorebookEditor (overview tab)
// and LorebookEntryRow (the per-entry inline drawer).
// Extracted from LorebookEditor.tsx so styling stays consistent.
// ──────────────────────────────────────────────
import { useState } from "react";
import { FileText, ToggleLeft, ToggleRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { HelpTooltip } from "../ui/HelpTooltip";
import { MacroTextarea } from "../ui/MacroTextarea";

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
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
        <Icon size="0.8125rem" className="text-amber-400" />
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
            className="flex items-center gap-1 rounded-lg bg-amber-400/15 px-2 py-1 text-[0.6875rem] text-amber-300"
          >
            {key}
            <button
              onClick={() => onChange(keys.filter((_, j) => j !== i))}
              className="ml-0.5 rounded-sm hover:text-[var(--destructive)]"
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
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKey())}
          className="flex-1 rounded-lg bg-[var(--secondary)] px-2 py-1.5 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          placeholder="Type a keyword and press Enter…"
        />
        <button
          onClick={addKey}
          className="rounded-lg bg-[var(--accent)] px-2 py-1.5 text-[0.6875rem] font-medium transition-colors hover:bg-[var(--accent)]/80"
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
    <button
      onClick={() => onChange(!value)}
      title={tooltip}
      className={cn(
        "flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium ring-1 transition-all",
        value
          ? "bg-amber-400/15 text-amber-400 ring-amber-400/30"
          : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-[var(--border)]",
      )}
    >
      {label}
      {value ? <ToggleRight size="1.125rem" /> : <ToggleLeft size="1.125rem" />}
    </button>
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
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        min={min}
        max={max}
        className="w-full rounded-lg bg-[var(--secondary)] px-2 py-1.5 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
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
      className="w-full resize-y rounded-lg bg-[var(--secondary)] p-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
    />
  );
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
