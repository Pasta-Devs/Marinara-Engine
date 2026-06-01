import { ChevronDown, FlaskConical, X } from "lucide-react";
import { cn } from "../../../../../shared/lib/utils";

export function LorebookKeywordTestPanel({
  open,
  text,
  previewActive,
  previewMatchCount,
  enabledEntryCount,
  onOpenChange,
  onTextChange,
}: {
  open: boolean;
  text: string;
  previewActive: boolean;
  previewMatchCount: number;
  enabledEntryCount: number;
  onOpenChange: (open: boolean) => void;
  onTextChange: (text: string) => void;
}) {
  return (
    <div className="rounded-xl bg-[var(--secondary)]/60 ring-1 ring-[var(--border)]">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-colors hover:bg-[var(--accent)]/30"
        aria-expanded={open}
      >
        <FlaskConical size="0.8125rem" className="shrink-0 text-amber-400" />
        <span className="flex-1">Keyword test</span>
        {previewActive && (
          <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[0.625rem] font-medium text-emerald-300 ring-1 ring-emerald-400/25">
            {previewMatchCount} match{previewMatchCount === 1 ? "" : "es"}
          </span>
        )}
        <ChevronDown
          size="0.8125rem"
          className={cn(
            "shrink-0 text-[var(--muted-foreground)] transition-transform",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
      </button>
      {open && (
        <div className="space-y-2 border-t border-[var(--border)] px-3 py-3">
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
            Paste sample chat text and entries whose keys would trigger get an emerald accent and a &quot;Would
            activate&quot; chip. Constant entries are flagged separately because they activate regardless of text. Out
            of scope: timing, probability, character/persona filters, and semantic matching.
          </p>
          <div className="relative">
            <textarea
              value={text}
              onChange={(event) => onTextChange(event.target.value)}
              placeholder="Paste a paragraph or sample messages here…"
              rows={4}
              className="w-full resize-y rounded-xl bg-[var(--background)] px-3 py-2 pr-8 text-xs ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            {text && (
              <button
                type="button"
                onClick={() => onTextChange("")}
                className="absolute right-2 top-2 rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                title="Clear keyword test"
                aria-label="Clear keyword test"
              >
                <X size="0.75rem" />
              </button>
            )}
          </div>
          {previewActive && (
            <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
              {previewMatchCount === 0
                ? "No entries would activate on this text."
                : `${previewMatchCount} of ${enabledEntryCount} enabled entr${
                    enabledEntryCount === 1 ? "y" : "ies"
                  } would activate.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
