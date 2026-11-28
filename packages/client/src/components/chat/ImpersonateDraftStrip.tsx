import { Drama, RotateCcw, Square, Undo2 } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import type { ImpersonateDraft } from "../../stores/impersonate-draft.store";

interface ImpersonateDraftStripProps {
  draft: ImpersonateDraft;
  onRedo: () => void;
  onUndo: () => void;
  onStop: () => void;
  className?: string;
}

const STRIP_BUTTON =
  "inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[0.6875rem] font-medium text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:min-h-7";

/** The line above the message box while Impersonate writes, or has written, a draft there. */
export function ImpersonateDraftStrip({ draft, onRedo, onUndo, onStop, className }: ImpersonateDraftStripProps) {
  const { t: localizeUi } = useUiTranslation();
  const writing = draft.status === "writing";
  return (
    <div
      data-impersonate-draft={draft.status}
      role="status"
      aria-live="polite"
      className={cn(
        "mari-chat-style-surface flex min-w-0 items-center gap-2 rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--card)]/85 py-1 pl-2.5 pr-1 backdrop-blur-xl",
        className,
      )}
    >
      <Drama size="0.875rem" className={cn("shrink-0 text-foreground/55", writing && "animate-pulse")} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[0.6875rem] text-foreground/70">
        {writing ? (
          localizeUi("ui.chat.impersonateDraft.writing")
        ) : (
          <>
            {localizeUi("ui.chat.impersonateDraft.ready")}
            {/* Phones keep the short label whole; the hint fits from tablet width up. */}
            <span className="hidden sm:inline"> {localizeUi("ui.chat.impersonateDraft.readyHint")}</span>
          </>
        )}
      </span>
      {writing ? (
        <button
          type="button"
          onClick={onStop}
          className={STRIP_BUTTON}
          title={localizeUi("ui.chat.impersonateDraft.stopHint")}
        >
          <Square size="0.6875rem" aria-hidden />
          {localizeUi("ui.chat.impersonateDraft.stop")}
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={onRedo}
            className={STRIP_BUTTON}
            title={localizeUi("ui.chat.impersonateDraft.redoHint")}
          >
            <RotateCcw size="0.75rem" aria-hidden />
            {localizeUi("ui.chat.impersonateDraft.redo")}
          </button>
          <button
            type="button"
            onClick={onUndo}
            className={STRIP_BUTTON}
            title={localizeUi("ui.chat.impersonateDraft.undoHint")}
          >
            <Undo2 size="0.75rem" aria-hidden />
            {localizeUi("ui.chat.impersonateDraft.undo")}
          </button>
        </>
      )}
    </div>
  );
}
