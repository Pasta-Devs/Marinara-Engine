// ──────────────────────────────────────────────
// One per-chat editor shown either as its classic window or, in the new layout, as a page inside
// Chat settings (see subpage.ts). The editor passes the same props it gave its Modal; with `asPage`
// its body and footer render into the drawer's page instead, under the drawer's own header.
// ──────────────────────────────────────────────
import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Modal } from "../../components/ui/Modal";
import { cn } from "../../lib/utils";
import { useChatSettingsSubpage, type ChatSettingsSubpageGuard } from "./subpage";

type ModalProps = ComponentProps<typeof Modal>;

interface ChatSettingsEditorSurfaceProps extends ModalProps {
  /** New layout: render as the open page inside Chat settings instead of a window. */
  asPage?: boolean;
  /** Buttons for the page header (beside the title). Windows ignore it. */
  pageActions?: ReactNode;
  /** Unsaved-edits check for the page's back button, closing Chat settings and switching chats. */
  leaveGuard?: ChatSettingsSubpageGuard;
  /** Extra classes on the page body. */
  pageBodyClassName?: string;
}

export function ChatSettingsEditorSurface({
  asPage = false,
  pageActions,
  leaveGuard,
  pageBodyClassName,
  ...modalProps
}: ChatSettingsEditorSurfaceProps) {
  const slot = useChatSettingsSubpage((state) => state.slot);
  const actionsSlot = useChatSettingsSubpage((state) => state.actionsSlot);
  const setGuard = useChatSettingsSubpage((state) => state.setGuard);
  // The latest guard, so the store's copy never calls a stale closure.
  const guardRef = useRef(leaveGuard);
  guardRef.current = leaveGuard;
  const pageOpen = asPage && modalProps.open;
  const hasGuard = !!leaveGuard;
  useEffect(() => {
    if (!pageOpen || !hasGuard) return;
    setGuard({
      isDirty: () => guardRef.current?.isDirty() ?? false,
      confirmLeave: () => guardRef.current?.confirmLeave() ?? Promise.resolve(true),
    });
    return () => setGuard(null);
  }, [hasGuard, pageOpen, setGuard]);

  if (!asPage) return <Modal {...modalProps} />;
  if (!modalProps.open || !slot) return null;
  return (
    <>
      {createPortal(
        <>
          <div
            data-component={modalProps.dataComponent ?? "ChatSettingsEditorPage"}
            className={cn("ov-cs-sub__body @container", pageBodyClassName)}
          >
            {modalProps.children}
          </div>
          {modalProps.footer ? <div className="ov-cs-sub__foot">{modalProps.footer}</div> : null}
        </>,
        slot,
      )}
      {pageActions && actionsSlot ? createPortal(pageActions, actionsSlot) : null}
    </>
  );
}
