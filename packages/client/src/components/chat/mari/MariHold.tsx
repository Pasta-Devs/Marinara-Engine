import { useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMariHold } from "../../../hooks/use-mari-hold";
import { FIGURE_HEIGHT, MariHoldFigure } from "./MariHoldFigure";
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
              onSmash={hold.smash}
            />,
            document.body,
          )
        : null}
      {hold.bounceAt && hold.line
        ? createPortal(
            // Reduced motion: she only bounces in her slot, so her line stands alone above it.
            <div
              className="mari-hold-figure"
              style={
                {
                  "--mari-x": `${hold.bounceAt.left}px`,
                  transform: `translate3d(${hold.bounceAt.left - FIGURE_HEIGHT / 3}px, ${hold.bounceAt.top}px, 0)`,
                } as CSSProperties
              }
              aria-hidden="true"
            >
              <span className="mari-hold-figure__line">{hold.line}</span>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
