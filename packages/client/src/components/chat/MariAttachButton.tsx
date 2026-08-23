// #5073: the composer attach control for Professor Mari — a paperclip that opens a small menu
// (like Claude's "+") instead of jumping straight to the file picker. Shared by both the floating
// and docked composers so the menu can't drift between them. Mirrors the adjacent connection popover
// (anchored div + outside-click), matching the surrounding composer code.
import { useEffect, useRef, useState } from "react";
import { Loader2, MessageSquareText, Paperclip, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

interface Props {
  onAttachFiles: () => void;
  onAddChatHistory: () => void;
  onViewContext: () => void;
  /** Pending file attachments on the composer (drives the active paperclip state). */
  attachedFileCount: number;
  /** Attached reference-context items on this Mari chat (drives the menu badge). */
  attachedContextCount: number;
  disabled: boolean;
  isReading: boolean;
}

export function MariAttachButton({
  onAttachFiles,
  onAddChatHistory,
  onViewContext,
  attachedFileCount,
  attachedContextCount,
  disabled,
  isReading,
}: Props) {
  const { t: localizeUi } = useTranslation();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all",
          open || attachedFileCount > 0 || attachedContextCount > 0
            ? "bg-foreground/10 text-foreground/75"
            : "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70",
          disabled && "cursor-not-allowed opacity-40",
        )}
        title={localizeUi("ui.chat.homeprofessormarichat.attachMenuLabel")}
        aria-label={localizeUi("ui.chat.homeprofessormarichat.attachMenuLabel")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {isReading ? <Loader2 size="1rem" className="animate-spin" /> : <Paperclip size="1rem" />}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute bottom-full left-0 z-20 mb-2 flex min-w-[15rem] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 text-left shadow-2xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onAttachFiles)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            <Paperclip size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
            {localizeUi("ui.chat.homeprofessormarichat.attachMenuFiles")}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onAddChatHistory)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            <MessageSquareText size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
            {localizeUi("ui.chat.homeprofessormarichat.attachMenuChatHistory")}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onViewContext)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            <Layers size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />
            <span className="min-w-0 flex-1 truncate">
              {localizeUi("ui.chat.homeprofessormarichat.attachMenuViewContext")}
            </span>
            {attachedContextCount > 0 && (
              <span className="shrink-0 rounded-full bg-[var(--primary)]/15 px-1.5 py-0.5 text-[0.625rem] font-semibold text-[var(--primary)]">
                {attachedContextCount}
              </span>
            )}
          </button>
        </div>
      )}
    </>
  );
}
