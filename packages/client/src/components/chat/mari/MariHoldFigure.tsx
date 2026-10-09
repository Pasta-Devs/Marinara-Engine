import { useEffect, useRef, type RefObject } from "react";
import { stepMariPendulum, stepMariSpring, type MariPendulum } from "../../../lib/mari-hold";

/** Height of the held sheet's frame in CSS px; the figure scales from her slot to full size. */
const FIGURE_HEIGHT = 160;

interface MariHoldFigureProps {
  src: string;
  start: { left: number; top: number; height: number };
  pointerRef: RefObject<{ x: number; y: number }>;
  releasing: boolean;
  slotRect: () => { left: number; top: number; height: number } | null;
  dizzy: boolean;
  line: string | null;
  onSettled: () => void;
}

/**
 * Slice 85: the lifted Mari. One fixed element follows the pointer on a spring, swings from its grab
 * point, and springs back to her slot on release. Positions go straight to the style each frame, so
 * React does not re-render while she is held.
 */
export function MariHoldFigure({
  src,
  start,
  pointerRef,
  releasing,
  slotRect,
  dizzy,
  line,
  onSettled,
}: MariHoldFigureProps) {
  const figureRef = useRef<HTMLDivElement>(null);
  const releasingRef = useRef(releasing);
  releasingRef.current = releasing;
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  useEffect(() => {
    const figure = figureRef.current;
    if (!figure) return;
    const width = (FIGURE_HEIGHT * 2) / 3;
    const slotScale = start.height / FIGURE_HEIGHT;
    let x = { x: start.left, v: 0 };
    let y = { x: start.top, v: 0 };
    let scale = { x: slotScale, v: 0 };
    let body: MariPendulum = { angle: 0, omega: 0 };
    let anchor: ReturnType<typeof slotRect> = null;
    let last = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;
      let targetX: number;
      let targetY: number;
      let targetScale: number;
      let stiffness: number;
      let zeta: number;
      if (releasingRef.current) {
        // The slot is read once, on the first released frame.
        anchor ??= slotRect();
        if (!anchor) {
          onSettledRef.current();
          return;
        }
        targetX = anchor.left;
        targetY = anchor.top;
        targetScale = anchor.height / FIGURE_HEIGHT;
        stiffness = 240;
        zeta = 0.72;
      } else {
        const pointer = pointerRef.current;
        targetX = pointer.x;
        targetY = pointer.y;
        targetScale = 1;
        stiffness = 520;
        zeta = 0.62;
      }
      const nextX = stepMariSpring(x, targetX, stiffness, zeta, dt);
      const nextY = stepMariSpring(y, targetY, stiffness, zeta, dt);
      const driveX = (nextX.v - x.v) / dt;
      x = nextX;
      y = nextY;
      scale = stepMariSpring(scale, targetScale, 320, 0.6, dt);
      body = stepMariPendulum(body, driveX, dt);
      const stretch = 1 + Math.max(-0.08, Math.min(0.08, y.v * 0.0006));
      figure.style.transform = `translate3d(${x.x - width / 2}px, ${y.x}px, 0) rotate(${body.angle}rad) scale(${scale.x}, ${scale.x * stretch})`;

      const settled =
        releasingRef.current &&
        Math.abs(x.x - targetX) < 1 &&
        Math.abs(y.x - targetY) < 1 &&
        Math.abs(scale.x - targetScale) < 0.02 &&
        Math.abs(x.v) + Math.abs(y.v) < 8;
      if (settled) {
        onSettledRef.current();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Mounted once per hold: the start spot and the springs belong to this lift.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={figureRef} className="mari-hold-figure" data-dizzy={dizzy ? "true" : undefined} aria-hidden="true">
      <span className="mari-hold-figure__sprite" style={{ backgroundImage: `url("${src}")` }} />
      {dizzy ? (
        <span className="mari-hold-figure__dizzy">
          <span />
          <span />
          <span />
        </span>
      ) : null}
      {line ? <span className="mari-hold-figure__line">{line}</span> : null}
    </div>
  );
}
