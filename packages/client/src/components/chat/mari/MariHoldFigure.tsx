import { useEffect, useRef, type RefObject } from "react";
import {
  isNewMariSmash,
  mariFigureExtent,
  mariHandVelocity,
  mariThrowPeak,
  stepMariPendulum,
  stepMariSpring,
  stepMariWall,
  type MariHandSample,
  type MariPendulum,
  type MariSpring,
  type MariThrow,
} from "../../../lib/mari-hold";

/** Height of the held sheet's frame in CSS px; the figure scales from her slot to full size. */
export const FIGURE_HEIGHT = 160;

interface MariHoldFigureProps {
  src: string;
  start: { left: number; top: number; height: number };
  pointerRef: RefObject<{ x: number; y: number }>;
  releasing: boolean;
  slotRect: () => { left: number; top: number; height: number } | null;
  dizzy: boolean;
  line: string | null;
  onSettled: () => void;
  onSmash: () => void;
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
  onSmash,
}: MariHoldFigureProps) {
  const figureRef = useRef<HTMLDivElement>(null);
  const releasingRef = useRef(releasing);
  releasingRef.current = releasing;
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  const onSmashRef = useRef(onSmash);
  onSmashRef.current = onSmash;

  useEffect(() => {
    const figure = figureRef.current;
    if (!figure) return;
    const width = (FIGURE_HEIGHT * 2) / 3;
    const slotScale = start.height / FIGURE_HEIGHT;
    let x = { x: start.left, v: 0 };
    let y = { x: start.top, v: 0 };
    let scale = { x: slotScale, v: 0 };
    let body: MariPendulum = { angle: 0, omega: 0 };
    // Squash on each axis: a smash on a vertical wall squashes her vertically, and the reverse.
    let squashX: MariSpring = { x: 0, v: 0 };
    let squashY: MariSpring = { x: 0, v: 0 };
    // A wall pinning the grab point takes the hand's push, so the push does not swing her.
    let pinnedX = false;
    let pinnedY = false;
    let bonkTimer = 0;
    const hand: MariHandSample[] = [];
    let throwX: MariThrow = { v: 0, at: 0 };
    let throwY: MariThrow = { v: 0, at: 0 };
    // The last smash per axis: the bounce of one hit must not bonk (and count toward dizzy) again.
    let smashedX = { side: 0, at: -Infinity };
    let smashedY = { side: 0, at: -Infinity };
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
      const accel = { x: (nextX.v - x.v) / dt, y: (nextY.v - y.v) / dt };
      x = nextX;
      y = nextY;
      scale = stepMariSpring(scale, targetScale, 320, 0.6, dt);
      if (releasingRef.current) {
        // Released: she swings upright on the release spring, so she never lands upside down.
        const upright = stepMariSpring({ x: body.angle, v: body.omega }, 0, 240, 0.72, dt);
        body = { angle: upright.x, omega: upright.v };
      } else {
        body = stepMariPendulum(body, { x: pinnedX ? 0 : accel.x, y: pinnedY ? 0 : accel.y }, dt);
      }
      squashX = stepMariSpring(squashX, 0, 700, 0.3, dt);
      squashY = stepMariSpring(squashY, 0, 700, 0.3, dt);
      const stretch = 1 + Math.max(-0.08, Math.min(0.08, y.v * 0.0006));
      // Squash only shrinks her along the wall, so her size here is the largest she is drawn at.
      const sx = scale.x * (1 - Math.max(0, squashX.x));
      const sy = scale.x * stretch * (1 - Math.max(0, squashY.x));
      if (!releasingRef.current) {
        // The viewport edges are walls for her whole figure: rotation, scale and squash included.
        const extent = mariFigureExtent(body.angle, width, FIGURE_HEIGHT, sx, sy);
        // A hit is judged by the hand's fastest recent speed: the pivot trails a flick and reaches the edge
        // after the finger has stopped on it, so its own speed reads slow.
        hand.push({ x: targetX, y: targetY, at: now });
        const handV = mariHandVelocity(hand);
        throwX = mariThrowPeak(throwX, handV.x, now);
        throwY = mariThrowPeak(throwY, handV.y, now);
        const wallX = stepMariWall(x, extent.left, extent.right, window.innerWidth, throwX.v);
        const wallY = stepMariWall(y, extent.top, extent.bottom, window.innerHeight, throwY.v);
        pinnedX = wallX.spring.x !== x.x;
        pinnedY = wallY.spring.x !== y.x;
        // A wall pushes her back inside, so the push's sign is the wall's side, opposite to it.
        const sideX = -Math.sign(wallX.spring.x - x.x);
        const sideY = -Math.sign(wallY.spring.x - y.x);
        const newSmashX = wallX.smash && isNewMariSmash(smashedX, sideX, now);
        const newSmashY = wallY.smash && isNewMariSmash(smashedY, sideY, now);
        if (wallX.smash) smashedX = { side: sideX, at: now };
        if (wallY.smash) smashedY = { side: sideY, at: now };
        x = wallX.spring;
        y = wallY.spring;
        if (newSmashX) squashX = { x: 0.22, v: 0 };
        if (newSmashY) squashY = { x: 0.22, v: 0 };
        if (newSmashX || newSmashY) {
          onSmashRef.current();
          figure.dataset.bonk = "true";
          window.clearTimeout(bonkTimer);
          bonkTimer = window.setTimeout(() => delete figure.dataset.bonk, 480);
        }
      }
      // Her line stays on screen: the CSS clamps it against this centre.
      figure.style.setProperty("--mari-x", `${x.x}px`);
      figure.style.transform = `translate3d(${x.x - width / 2}px, ${y.x}px, 0) rotate(${body.angle}rad) scale(${sx}, ${sy})`;

      const settled =
        releasingRef.current &&
        Math.abs(x.x - targetX) < 1 &&
        Math.abs(y.x - targetY) < 1 &&
        Math.abs(scale.x - targetScale) < 0.02 &&
        Math.abs(body.angle) < 0.02 &&
        Math.abs(x.v) + Math.abs(y.v) < 8;
      if (settled) {
        onSettledRef.current();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(bonkTimer);
    };
    // Mounted once per hold: the start spot and the springs belong to this lift.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={figureRef} className="mari-hold-figure" data-dizzy={dizzy ? "true" : undefined} aria-hidden="true">
      <span className="mari-hold-figure__sprite" style={{ backgroundImage: `url("${src}")` }} />
      <span className="mari-hold-figure__stars" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
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
