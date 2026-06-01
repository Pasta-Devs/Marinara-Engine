import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { cn } from "../../../../shared/lib/utils";
import { visibleText } from "./tracker-display.helpers";
import "./WorldEditableTile.css";

export function WorldTileShell({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("tracker-world-tile-shell", className)} title={label}>
      <div className="tracker-world-tile-shell__wash" />
      <div className="tracker-world-tile-shell__top-rule" />
      <div className="tracker-world-tile-shell__bottom-rule" />
      <span className="sr-only">{label}</span>
      <div className="relative z-[1] h-full min-w-0">{children}</div>
    </div>
  );
}

export function WorldRenderedEdit({
  label,
  value,
  onSave,
  placeholder,
  className,
  inputClassName,
  showEditHint = true,
  editHintClassName,
  children,
}: {
  label: string;
  value: string | null | undefined;
  onSave?: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  showEditHint?: boolean;
  editHintClassName?: string;
  children: ReactNode;
}) {
  const currentValue = value === null || value === undefined ? "" : String(value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);
  const title = `${label}: ${visibleText(value)}`;

  useEffect(() => {
    if (!editing) setDraft(currentValue);
  }, [currentValue, editing]);

  useEffect(() => {
    if (!editing) return;
    committedRef.current = false;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    const trimmed = draft.trim();
    if (trimmed !== currentValue) onSave?.(trimmed);
    setEditing(false);
  };

  if (!onSave) {
    return (
      <div className={cn("h-full min-w-0", className)} title={title}>
        {children}
      </div>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") {
            committedRef.current = true;
            setDraft(currentValue);
            setEditing(false);
          }
        }}
        onBlur={commit}
        className={cn("tracker-world-edit-input", inputClassName)}
        placeholder={placeholder ?? `Set ${label.toLowerCase()}`}
        aria-label={label}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title={title}
      aria-label={`${title}. Click to edit.`}
      className={cn("tracker-world-edit-button", className)}
    >
      {children}
      {showEditHint && (
        <span className={cn("tracker-world-edit-hint", editHintClassName)} aria-hidden="true">
          <Pencil size="0.5rem" />
        </span>
      )}
    </button>
  );
}
