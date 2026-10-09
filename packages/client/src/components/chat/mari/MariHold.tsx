import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMariHold } from "../../../hooks/use-mari-hold";
import { MariHoldFigure } from "./MariHoldFigure";
import "./mari-hold.css";

/**
 * Slice 85: wraps one Mari art slot. A tap keeps the slot's own action; a press that holds lifts her
 * off the slot, and she springs back on release. The wrapper is `display: contents`, so the layout
 * stays as it was.
 */
export function MariHold({
  heldSrc,
  onTap,
  hopOnTap,
  children,
}: {
  heldSrc: string;
  onTap?: () => void;
  hopOnTap?: boolean;
  children: ReactNode;
}) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const hold = useMariHold({ wrapperRef, onTap, hopOnTap });
  return (
    <>
      <span
        ref={wrapperRef}
        className="mari-hold-slot contents"
        data-mari-hold={hold.motion}
        onPointerDown={hold.handlers.onPointerDown}
        onClickCapture={hold.handlers.onClickCapture}
        onContextMenu={(event) => {
          // A long press on touch opens the context menu; she is held, not right-clicked.
          if (hold.motion !== "idle") event.preventDefault();
        }}
      >
        {children}
      </span>
      {hold.figureStart
        ? createPortal(
            <MariHoldFigure
              src={heldSrc}
              start={hold.figureStart}
              pointerRef={hold.pointerRef}
              releasing={hold.motion === "releasing"}
              slotRect={hold.slotRect}
              dizzy={hold.dizzy}
              line={hold.line}
              onSettled={hold.settle}
            />,
            document.body,
          )
        : null}
    </>
  );
}
