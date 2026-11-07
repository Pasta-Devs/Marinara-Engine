// ──────────────────────────────────────────────
// UI overhaul, touch screens: long-press a list row for its actions
//
// The same action sheet as Delete message: the row's name on top, its actions
// (Pin, Rename, Delete for chats) as rows, Cancel on its own. Works with swipe
// gestures off, so a row's actions are always one long-press away (panel 3,
// PP2, PT2, PT3).
// ──────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import type { SwipeAction } from "./SwipeActionsRow";

export function RowActionSheet({
  title,
  actions,
  onClose,
}: {
  title: string;
  actions: SwipeAction[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    cancelRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <>
      <div className="ovm-action-sheet-scrim" aria-hidden="true" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="ovm-action-sheet" data-row-action-sheet>
        <div className="ovm-action-sheet__group">
          <div className="ovm-action-sheet__head">
            <strong>{title}</strong>
          </div>
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              className={cn(action.tone === "danger" && "is-danger")}
              onClick={() => {
                onClose();
                action.onSelect();
              }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
        <div className="ovm-action-sheet__group">
          <button ref={cancelRef} type="button" className="is-cancel" onClick={onClose}>
            {t("chat.delete.dialog.cancel")}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
