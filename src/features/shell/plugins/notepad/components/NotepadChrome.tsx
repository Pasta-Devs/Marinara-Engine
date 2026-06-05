import type { ReactNode } from "react";
import type { StatusTone } from "../types";

export function statusToneClass(tone: StatusTone): string {
  if (tone === "ok") return "me-notes-status--ok";
  if (tone === "error") return "me-notes-status--error";
  return "me-notes-status--muted";
}

export function NotepadBrand({ heading = false }: { heading?: boolean }) {
  const content = (
    <>
      <img
        src="/favicon.png"
        alt=""
        draggable={false}
        aria-hidden="true"
        className="h-4 w-4 shrink-0 rounded-full border border-[var(--primary)]/35 bg-[var(--background)]/60 p-px shadow-sm"
      />
      <span className="min-w-0 truncate font-bold leading-tight text-[var(--foreground)]">Notes</span>
    </>
  );

  return heading ? (
    <h2 className="flex min-w-0 items-center gap-1.5">{content}</h2>
  ) : (
    <span className="flex min-w-0 items-center gap-1.5">{content}</span>
  );
}

export function ToolbarButton({
  title,
  disabled,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="me-notes-toolbar-button"
    >
      {children}
    </button>
  );
}
