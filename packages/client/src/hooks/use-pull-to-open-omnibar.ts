import { useCallback, useEffect, useRef, useState } from "react";
import { animate, cancelFrame, frame, motionValue, useReducedMotion, type MotionValue } from "framer-motion";
import {
  PULL_CIRCLE_MAX,
  PULL_CIRCLE_MIN,
  PULL_FINGER_GAP,
  PULL_SIDE_FROM,
  PULL_TAG_GAP,
  createPullRecognizer,
  holdPullGaze,
  pullCirclePath,
  pullCircleTarget,
  pullGazeFrame,
  pullMorphFrame,
  pullOnScreenX,
  pullOpenThreshold,
  pullRemnantPath,
  pullSheetBase,
  pullSheetPath,
  pullTarget,
  setPullHandoff,
  type PullGazeFrame,
  type PullRecognizer,
  type PullTarget,
} from "../lib/pull-to-open";
import { isMobileShellViewport, useUIStore } from "../stores/ui.store";

// Springs as [stiffness, damping], mass 1, ported from the approved prototype.
// Viscous and calm: the sheet never overshoots.
type SpringSpec = readonly [number, number];
const FOLLOW: SpringSpec = [130, 24]; // the circle trails the finger
const BASE: SpringSpec = [90, 20]; // the sheet widens and narrows
const GROW: SpringSpec = [180, 27]; // the circle grows
const SHOW: SpringSpec = [220, 28]; // icon, portrait and small bar appear
const SIDE: SpringSpec = [200, 26]; // search <-> Mari cross-fade
const GLOW: SpringSpec = [120, 18];
const POP: SpringSpec = [240, 13]; // the circle's flex on release
const PINCH: SpringSpec = [85, 19]; // at the threshold the sheet thins and lets go (~0.45 s)
const PINCH_FAST: SpringSpec = [260, 32]; // ... on a release before it let go
const SNAP: SpringSpec = [80, 18]; // below the threshold everything slurps back up
const REM: SpringSpec = [110, 19]; // the freed sheet draws back into the bar
const RECOIL: SpringSpec = [150, 9]; // ... with one faint wobble, like surface tension
const TAIL: SpringSpec = [150, 17]; // the circle pulls in its tail
const OPEN: SpringSpec = [210, 21]; // the circle pops open into the view
const DOCK: SpringSpec = [200, 27]; // the magnifier settles into the search field
const DIP: SpringSpec = [300, 18]; // the arm dip: down about 4 px, a hair back up, still
const TILT: SpringSpec = [160, 14]; // her head leans with a sideways drag and rocks back once
const MORPH: SpringSpec = [190, 24]; // M17: the circle becomes the present Mari (~0.4 s, a hint of overshoot)
/** Soft light from within; a very faint accent around the circle once armed. */
const GLOW_REST = 0.02;
const GLOW_PULL = 0.07;
const GLOW_ARMED = 0.12;
const GLOW_FLARE = 4;
const TINT_ARMED = 8;
/** px/s: at the arm point the circle dips about 4 px and settles once, a felt click without vibration (iOS). */
const ARM_DIP = 140;
/** Past the threshold the sheet holds back: the circle loses this share of the finger's extra travel. */
const RUBBER = 0.55;
/** Her head leans this many degrees at most, against the drag. */
const TILT_MAX = 5;
/** The pop starts at the circle's flex peak, at the latest this long after the release (the dialog mounts meanwhile). */
const POP_DELAY_MS = 130;
/** If the dialog never mounts, the overlay still leaves. */
const HANDOFF_TIMEOUT_MS = 1500;
/** How long the morph waits for her sprite to mount in the (lazy) Mari pane before it gives up. */
const MORPH_WAIT_MS = 2500;
/** Where the pull lands in the opened dialog: the magnifier, or the one Mari on screen now (M17). */
const PULL_LANDING_SELECTOR: Record<PullTarget, string> = {
  search: '[data-mari-pull-target="search"]',
  mari: '[data-mari-pull-target="mari-current"]',
};
/** A desktop drag starts on empty bar space only, never on a control (M18). */
const BAR_CONTROL_SELECTOR = 'button, a, input, select, textarea, [role="button"], [role="menuitem"], [role="tab"]';
/** The magnifier's size in px at the circle's full radius (see `OmnibarPullDrop`). */
export const PULL_ICON_SIZE = 26;

// L8 (slice 28b) deliberately dropped slice 15's "no pull under a modal" guard:
// the omnibar now opens ON TOP of any dialog, and Escape hands focus back to it.
// Which pointer may pull where (touch on a phone, a mouse on desktop) is decided at pointerdown.
function pullBlocked() {
  const ui = useUIStore.getState();
  return ui.omnibarOpen || document.documentElement.hasAttribute("data-mari-software-keyboard-open");
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clamp01 = (value: number) => clamp(value, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const px = (value: number) => Math.round(value * 10) / 10;

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/** Polls once a frame until `find` returns an element, or gives up after `timeout` ms. */
function waitForElement(find: () => HTMLElement | null, timeout: number) {
  return new Promise<HTMLElement | null>((resolve) => {
    const started = performance.now();
    const tick = () => {
      const found = find();
      if (found || performance.now() - started > timeout) resolve(found);
      else requestAnimationFrame(tick);
    };
    tick();
  });
}

/** The sprite's current frame (sheet, size and step) onto the morph's image, so the two match exactly. */
function copySpriteFrame(target: HTMLElement, into: HTMLElement | null | undefined) {
  if (!into) return;
  const frame = target.firstElementChild instanceof HTMLElement ? target.firstElementChild : target;
  const style = getComputedStyle(frame);
  into.style.backgroundImage = style.backgroundImage;
  into.style.backgroundSize = style.backgroundSize;
  into.style.backgroundPosition = style.backgroundPosition;
}

function go(value: MotionValue<number>, to: number, [stiffness, damping]: SpringSpec, velocity = value.getVelocity()) {
  return animate(value, to, {
    type: "spring",
    stiffness,
    damping,
    mass: 1,
    velocity,
    restDelta: 0.01,
    restSpeed: 0.05,
  });
}

/** R8: a mouse pull must not also drag a text selection across the page. Lifted when that pointer comes up. */
function blockTextSelectionUntilRelease() {
  window.getSelection()?.removeAllRanges();
  const root = document.documentElement;
  root.classList.add("mari-pull-no-select");
  const release = () => {
    root.classList.remove("mari-pull-no-select");
    window.removeEventListener("pointerup", release, true);
    window.removeEventListener("pointercancel", release, true);
  };
  window.addEventListener("pointerup", release, true);
  window.addEventListener("pointercancel", release, true);
}

/** What the gesture reads from a pointer event: a React one from the bar, or a native one from the document. */
type PullPointerEvent = Pick<
  PointerEvent,
  "pointerId" | "pointerType" | "isPrimary" | "clientX" | "clientY" | "timeStamp" | "button" | "target"
> & {
  currentTarget: EventTarget | null;
};

/** Marks the bar and the safe-area strip, whose own handlers take their touches. */
const PULL_ZONE_ATTRIBUTE = "data-mari-pull-zone";

/** Elements of the overlay, filled in by `OmnibarPullDrop`. */
export interface PullDropElements {
  glass?: HTMLDivElement | null;
  rim?: SVGSVGElement | null;
  rimClip?: SVGPathElement | null;
  rimEdge?: SVGPathElement | null;
  rimHair?: SVGPathElement | null;
  rimGrad?: SVGLinearGradientElement | null;
  edgeGrad?: SVGLinearGradientElement | null;
  ring?: SVGEllipseElement | null;
  shadow?: HTMLDivElement | null;
  icon?: HTMLDivElement | null;
  portrait?: HTMLDivElement | null;
  /** 45b: her head in the circle; the hook writes `data-gaze`, the CSS picks the sheet frame. */
  head?: HTMLSpanElement | null;
  tag?: HTMLDivElement | null;
  tagSearch?: HTMLSpanElement | null;
  tagMari?: HTMLSpanElement | null;
  chip?: HTMLDivElement | null;
  /** M17: her head in the circle, opening into her sprite where she is in the Mari pane. */
  morph?: HTMLDivElement | null;
  morphPortrait?: HTMLSpanElement | null;
  morphSprite?: HTMLSpanElement | null;
}

export interface PullDropVisuals {
  /** The overlay is mounted only while it is on screen: renders twice per gesture, never per move. */
  shown: boolean;
  /** Reduced motion: only the label near the finger. */
  labelOnly: boolean;
  target: PullTarget;
  armed: boolean;
  els: PullDropElements;
}

/**
 * Pull down on the phone top bar to open the omnibar (left half) or Professor
 * Mari (right half). Spread `handlers` on the bar and the safe-area strip above
 * it and render `visuals` with `OmnibarPullDrop`: a sheet of the bar's own
 * surface stretches down to a circle with a small bar under it, both above the
 * fingertip; past the threshold the sheet lets go of the circle, and on release
 * the circle pops open into the dialog. Moves only touch motion values; one
 * paint per frame writes the DOM.
 */
export function usePullToOpenOmnibar({
  onPullStart,
  onOpen,
}: {
  onPullStart: () => void;
  onOpen: (target: PullTarget) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(false);
  const [labelOnly, setLabelOnly] = useState(false);
  const [target, setTarget] = useState<PullTarget>("search");
  const [armed, setArmed] = useState(false);
  const els = useRef<PullDropElements>({}).current;

  const mv = useRef({
    x: motionValue(0),
    y: motionValue(0),
    radius: motionValue(PULL_CIRCLE_MIN),
    base: motionValue(PULL_CIRCLE_MIN + 20),
    show: motionValue(0),
    tag: motionValue(0),
    side: motionValue(0),
    glow: motionValue(0),
    tint: motionValue(0),
    pop: motionValue(0),
    pinch: motionValue(0),
    rem: motionValue(0),
    tail: motionValue(0),
    open: motionValue(0),
    morph: motionValue(0),
    tilt: motionValue(0),
    /** px added to the circle's y: the arm dip. */
    dip: motionValue(0),
  }).current;

  // Gesture state lives in refs: a move never renders.
  const g = useRef({
    pointerId: -1,
    recognizer: null as PullRecognizer | null,
    threshold: 160,
    originY: 0,
    width: 0,
    height: 0,
    side: null as PullTarget | null,
    mariEnabled: true,
    mode: "idle" as "idle" | "pull" | "snap" | "land",
    detached: false,
    remX: 0,
    remB: 40,
    geom: { cx: 0, cy: 0, radius: 0, base: 0, waistY: 0 },
    landing: null as null | {
      panel: HTMLElement | null;
      from: { x: number; y: number; r: number };
      target: PullTarget;
    },
    follow: null as null | { x: number; fingerY: number; pull: number; armed: boolean },
    followQueued: false,
    /** M17: the circle turning into this sprite; `from` is the circle's head when it started. */
    morph: null as null | { target: HTMLElement; rect: DOMRect; from: { x: number; y: number; r: number } },
    gesture: 0,
    /** 45b: the finger's x, the gaze shown and since when. */
    fingerX: 0,
    gaze: null as null | { frame: PullGazeFrame; since: number },
    /** Reduce ambient effects: her gaze holds still and the pull keeps none of its extra motion. */
    calm: false,
    /** The lean her head is heading for. */
    lean: 0,
  }).current;
  const swallowClickRef = useRef(false);

  // ── Paint: one per frame, straight to the DOM ──────────────────────────
  const paint = useCallback(() => {
    const { glass, rim, rimClip, rimEdge, rimHair, rimGrad, edgeGrad, ring, shadow, icon, portrait, tag } = els;
    if (!glass || !rim) return;
    const landing = g.mode === "land";
    const pop = clamp(mv.pop.get(), -0.6, 0.6);
    const radius = Math.max(2, mv.radius.get());
    const rx = radius * (1 + 0.06 * pop);
    const ry = radius * (1 - 0.05 * pop);
    // The circle follows the finger right up to the screen's side and stays whole on it.
    const cx = landing ? mv.x.get() : pullOnScreenX(mv.x.get(), rx, g.width);
    const cy = mv.y.get() + mv.dip.get();
    // Full width at the screen's sides too: the sheet runs off the edge rather than narrowing.
    const base = Math.max(mv.base.get(), rx + 4);
    const tagHalf = (tag?.offsetWidth ?? 0) / 2;
    const sag = clamp01(mv.y.getVelocity() / 1500);
    const attached = !g.detached && cy + ry > 0;
    const rem = g.detached ? mv.rem.get() : 0;
    const tail = g.detached ? mv.tail.get() : 0;

    // The element's box: the outline plus a little margin.
    const minX = Math.min(cx - rx, attached ? cx - base : Infinity, rem > 0.5 ? g.remX - g.remB : Infinity) - 3;
    const maxX = Math.max(cx + rx, attached ? cx + base : -Infinity, rem > 0.5 ? g.remX + g.remB : -Infinity) + 3;
    const minY = Math.min(attached || rem > 0.5 ? -3 : Infinity, cy - ry - tail) - 3;
    const maxY = cy + ry + 3;
    const origin: [number, number] = [minX, minY];
    let d: string;
    if (attached) {
      const sheet = pullSheetPath({ cx, cy, rx, ry, base, sag, pinch: mv.pinch.get() }, origin);
      d = sheet.d;
      g.geom = { cx, cy, radius, base, waistY: sheet.waistY };
    } else {
      d = pullCirclePath(cx, cy, rx, ry, tail, origin);
      g.geom = { ...g.geom, cx, cy, radius };
    }
    if (rem > 0.5) d += pullRemnantPath(g.remX, g.remB, rem, origin);

    const width = maxX - minX;
    const height = maxY - minY;
    const box = `translate3d(${px(minX)}px, ${px(g.originY + minY)}px, 0)`;
    for (const el of [glass, rim] as Array<HTMLElement | SVGSVGElement>) {
      el.style.transform = box;
      el.style.width = `${px(width)}px`;
      el.style.height = `${px(height)}px`;
    }
    glass.style.clipPath = `path('${d}')`;
    rimClip?.setAttribute("d", d);
    rimEdge?.setAttribute("d", d);
    rimHair?.setAttribute("d", d);

    // Paint, exactly like the top bar where it leaves it: the bar's surface over
    // the app background. Further down the background layer fades away, so the
    // same surface turns into frosted glass over the page. No accent in the body.
    const ex = cx - minX;
    const ey = cy - minY;
    const barY = -minY;
    const glow = Math.max(0, mv.glow.get());
    const tint = Math.max(0, mv.tint.get());
    const solidTo = barY + 4;
    const clearAt = Math.max(solidTo + 24, ey - ry * 0.2);
    glass.style.background =
      `radial-gradient(${px(rx * 0.95)}px ${px(ry * 0.95)}px at ${px(ex)}px ${px(ey - ry * 0.15)}px, rgb(255 255 255 / ${px(glow * 100) / 100}), rgb(255 255 255 / 0)),` +
      (tint > 0.2
        ? `radial-gradient(${px(rx * 1.6)}px ${px(ry * 1.6)}px at ${px(ex)}px ${px(ey)}px, color-mix(in srgb, var(--primary) ${px(tint)}%, transparent), transparent),`
        : "") +
      `radial-gradient(${px(rx)}px ${px(ry)}px at ${px(ex)}px ${px(ey)}px, color-mix(in srgb, var(--card) 30%, transparent) 96%, transparent 100%),` +
      `linear-gradient(to bottom, var(--marinara-topbar-surface) ${px(solidTo)}px, color-mix(in srgb, var(--card) 42%, transparent) ${px(height)}px),` +
      `linear-gradient(to bottom, var(--background) ${px(solidTo)}px, color-mix(in srgb, var(--background) 0%, transparent) ${px(clearAt)}px)`;

    // Rim: soft, brightest along the upper left of the circle, travelling with it. Its light wavers
    // slowly and runs down the sheet to the circle as the pull grows.
    const waver = g.mode !== "idle" && !g.calm;
    const now = performance.now();
    const drift = waver ? Math.sin(now / 900) * 0.35 + Math.sin(now / 2300) * 0.2 : 0;
    const run = waver ? (1 - clamp01(g.follow?.pull ?? 0)) * 1.2 : 0;
    rimGrad?.setAttribute("x1", String(px(ex - rx * (1.4 + drift))));
    rimGrad?.setAttribute("y1", String(px(ey - ry * (2.2 + run))));
    rimGrad?.setAttribute("x2", String(px(ex + rx)));
    rimGrad?.setAttribute("y2", String(px(ey + ry)));
    edgeGrad?.setAttribute("y1", String(px(barY + 1)));
    edgeGrad?.setAttribute("y2", String(px(barY + 18)));
    const grown = clamp01((radius - PULL_CIRCLE_MIN) / 12);
    if (ring) {
      ring.setAttribute("cx", String(px(ex)));
      ring.setAttribute("cy", String(px(ey)));
      ring.setAttribute("rx", String(px(Math.max(0, rx - 0.5))));
      ring.setAttribute("ry", String(px(Math.max(0, ry - 0.5))));
      ring.style.opacity = String(px(grown * 100) / 100);
    }
    rim.style.opacity = String(px((0.55 + 0.35 * clamp01(glow / GLOW_ARMED)) * 100) / 100);

    // A soft shadow under the circle only.
    if (shadow) {
      const depth = 3 + ry * 0.12;
      const blur = 8 + ry * 0.35;
      shadow.style.transform = `translate3d(${px(cx - rx)}px, ${px(g.originY + cy - ry)}px, 0)`;
      shadow.style.width = `${px(rx * 2)}px`;
      shadow.style.height = `${px(ry * 2)}px`;
      shadow.style.boxShadow = `0 ${px(depth)}px ${px(blur)}px -${px(blur * 0.4)}px var(--mari-pull-shadow)`;
      shadow.style.opacity = String(px(grown * 100) / 100);
    }

    // The magnifier or Mari's portrait materializes in the circle; switching sides cross-fades them.
    const t = clamp01(mv.side.get());
    const show = clamp01(mv.show.get());
    const showTag = clamp01(mv.tag.get());
    const y = g.originY + cy;
    const blur = show < 0.99 && !landing ? `blur(${px((1 - show) * 5)}px)` : "";
    if (icon) {
      icon.style.opacity = String(px(show * clamp01(1 - t * 1.6) * 100) / 100);
      icon.style.filter = blur;
      icon.style.transform = `translate3d(${px(cx)}px, ${px(y)}px, 0) translate(-50%, -50%) scale(${px((radius / PULL_CIRCLE_MAX) * 1000) / 1000})`;
    }
    if (portrait) {
      // While she morphs, the morph element carries her head instead.
      portrait.style.opacity = g.morph ? "0" : String(px(show * clamp01(t * 1.6 - 0.6) * 100) / 100);
      portrait.style.filter = blur;
      // She leans a little against a sideways drag and rocks back when it stops.
      const lean = landing || g.calm ? 0 : clamp(-mv.x.getVelocity() / 90, -TILT_MAX, TILT_MAX);
      if (Math.abs(lean - g.lean) > 0.3) {
        g.lean = lean;
        go(mv.tilt, lean, TILT);
      }
      portrait.style.transform = `translate3d(${px(cx)}px, ${px(y)}px, 0) translate(-50%, -50%) scale(${px((Math.max(0, 2 * radius - 8) / 72) * 1000) / 1000}) rotate(${px(clamp(mv.tilt.get(), -TILT_MAX, TILT_MAX))}deg)`;
    }
    // 45b: she looks down at the screen's middle, where the chat or the editor is, from where she is pulled.
    if (els.head && g.mode === "pull" && !g.calm) {
      g.gaze = holdPullGaze(g.gaze, pullGazeFrame(g.fingerX, g.width), performance.now());
      if (els.head.dataset.gaze !== g.gaze.frame) els.head.dataset.gaze = g.gaze.frame;
    }
    // The small bar under the circle, above the finger; only its words change with the side.
    if (tag) {
      tag.style.opacity = landing ? "0" : String(px(showTag * 100) / 100);
      tag.style.transform = `translate3d(${px(pullOnScreenX(cx, tagHalf, g.width))}px, ${px(y + ry + PULL_TAG_GAP)}px, 0) translate(-50%, 0) scale(${px((0.9 + 0.1 * showTag) * 100) / 100})`;
    }
    if (els.tagSearch) els.tagSearch.style.opacity = String(px(clamp01(1 - t * 1.6) * 100) / 100);
    if (els.tagMari) els.tagMari.style.opacity = String(px(clamp01(t * 1.6 - 0.6) * 100) / 100);

    // Pop open: the dialog is revealed from the circle outwards.
    const open = mv.open.get();
    const panel = g.landing?.panel;
    if (landing && panel && open > 0) {
      const { x: fx, y: fy, r: fr } = g.landing!.from;
      const rect = panel.getBoundingClientRect();
      const reach = Math.hypot(Math.max(fx - rect.left, rect.right - fx), Math.max(fy - rect.top, rect.bottom - fy));
      panel.style.clipPath = `circle(${px(lerp(fr, reach, Math.max(0, open)))}px at ${px(fx - rect.left)}px ${px(fy - rect.top)}px)`;
    }

    // M17: the circle opens into the present Mari's sprite box, read every frame so a pane still settling
    // (or a transcript that scrolled it into view) is followed. Transform, opacity and the clip only.
    const morph = g.morph;
    if (morph && els.morph) {
      // A re-render may replace her sprite element mid-flight; follow the new one.
      if (!morph.target.isConnected) {
        morph.target = g.landing?.panel?.querySelector<HTMLElement>(PULL_LANDING_SELECTOR.mari) ?? morph.target;
      }
      const rect = morph.target.isConnected ? morph.target.getBoundingClientRect() : morph.rect;
      morph.rect = rect;
      const f = pullMorphFrame(morph.from, rect, mv.morph.get());
      els.morph.style.transform = `translate3d(${f.x}px, ${f.y}px, 0) scale(${f.scale})`;
      els.morph.style.clipPath = f.clip;
      // Shown by the paint that places it, so it never shows a frame at the corner.
      els.morph.style.opacity = "1";
      if (els.morphPortrait) els.morphPortrait.style.opacity = String(f.portrait);
      if (els.morphSprite) els.morphSprite.style.opacity = String(f.sprite);
    }

    // The sheet lets go once the pinch has closed its waist.
    if (!g.detached && mv.pinch.get() > 0.97 && (g.mode === "pull" || landing)) detach();
    // The wavering rim needs frames while the finger holds still.
    if (waver) frame.render(paint);
  }, [els, g, mv]); // eslint-disable-line react-hooks/exhaustive-deps -- detach is hoisted and stable

  const schedulePaint = useCallback(() => {
    frame.render(paint);
  }, [paint]);

  // The overlay mounts a frame after the pull locks: paint it as soon as it is there.
  useEffect(() => {
    if (shown) schedulePaint();
  }, [shown, schedulePaint]);

  useEffect(() => {
    const offs = Object.values(mv).map((value) => value.on("change", schedulePaint));
    return () => {
      offs.forEach((off) => off());
      cancelFrame(paint);
    };
  }, [mv, paint, schedulePaint]);

  // ── States ─────────────────────────────────────────────────────────────
  function detach() {
    if (g.detached) return;
    g.detached = true;
    g.remX = g.geom.cx;
    g.remB = g.geom.base;
    // Surface tension: the sheet lets go and draws back into the bar; the circle pulls in a short tail.
    mv.rem.set(g.geom.waistY);
    go(mv.rem, 0, g.calm ? REM : RECOIL, 0);
    mv.tail.set(Math.min(22, Math.max(0, g.geom.cy - g.geom.radius - g.geom.waistY) * 0.6));
    go(mv.tail, 0, TAIL, 0);
    mv.pinch.set(1);
  }

  const hide = useCallback(() => {
    g.mode = "idle";
    setShown(false);
    setLabelOnly(false);
    setArmed(false);
  }, [g]);

  const snapBack = useCallback(() => {
    g.recognizer = null;
    if (g.mode !== "pull") return;
    if (reduceMotion) {
      hide();
      return;
    }
    g.mode = "snap";
    const gesture = g.gesture;
    setArmed(false);
    // The whole sheet slides back up into the bar.
    if (!g.detached) go(mv.pinch, 0, SNAP);
    go(mv.radius, PULL_CIRCLE_MIN * 0.6, SNAP);
    go(mv.base, PULL_CIRCLE_MIN + 10, SNAP);
    go(mv.show, 0, SHOW);
    go(mv.tag, 0, SHOW);
    go(mv.glow, 0, SNAP);
    go(mv.tint, 0, SNAP);
    go(mv.y, g.detached ? -PULL_CIRCLE_MAX : 0, SNAP).then(() => {
      if (g.gesture === gesture && g.mode === "snap") hide();
    });
  }, [g, hide, mv, reduceMotion]);

  const land = useCallback(
    (side: PullTarget, velocity: number) => {
      g.recognizer = null;
      g.mode = "land";
      // The circle pops open where it was drawn, not under a finger past the screen's side.
      mv.x.jump(g.geom.cx);
      const gesture = g.gesture;
      if (!g.detached) go(mv.pinch, 1, PINCH_FAST);
      go(mv.side, side === "mari" ? 1 : 0, SIDE);
      setTarget(side);
      // The pop: a flex and a flash of inner light.
      go(mv.glow, mv.glow.get(), GLOW, mv.glow.getVelocity() + GLOW_FLARE * 1.4);
      go(mv.pop, 0, POP, mv.pop.getVelocity() + 4 + clamp(velocity, 0, 2) * 2);
      g.landing = {
        panel: null,
        from: { x: g.geom.cx, y: g.originY + g.geom.cy, r: g.geom.radius },
        target: side,
      };
      document.documentElement.dataset.mariPullLanding = side;

      let mounted = false;
      let delayed = false;
      const finish = () => {
        if (g.gesture !== gesture || g.mode !== "land") return;
        const panel = g.landing?.panel;
        if (panel) panel.style.clipPath = "";
        delete document.documentElement.dataset.mariPullLanding;
        g.landing = null;
        g.morph = null;
        hide();
      };
      const landed = () => g.gesture === gesture && g.mode === "land";
      /**
       * M17: the circle becomes the present Mari, wherever she is in the pane: the live-line sprite, the
       * one resting beside her newest reply, or the arrival sprite (`mari-current`, only ever one). Her
       * head in the circle grows into her sprite box and cross-fades to the same sheet frame; then the
       * real sprite shows under the identical morph, which fades. False when she never appeared.
       */
      const morphInto = async (panel: HTMLElement | null) => {
        const target = await waitForElement(() => {
          const found = panel?.querySelector<HTMLElement>(PULL_LANDING_SELECTOR.mari) ?? null;
          return found && found.getBoundingClientRect().width > 0 ? found : null;
        }, MORPH_WAIT_MS);
        const box = els.morph;
        if (!target || !box || !landed()) return false;
        target.scrollIntoView({ block: "nearest" });
        const rect = target.getBoundingClientRect();
        const head = Math.min(rect.width, rect.height);
        box.style.width = `${rect.width}px`;
        box.style.height = `${rect.height}px`;
        if (els.morphPortrait) {
          els.morphPortrait.style.left = `${(rect.width - head) / 2}px`;
          els.morphPortrait.style.width = `${head}px`;
          els.morphPortrait.style.height = `${head}px`;
        }
        copySpriteFrame(target, els.morphSprite);
        g.morph = {
          target,
          rect,
          from: { x: g.geom.cx, y: g.originY + g.geom.cy, r: Math.max(4, mv.radius.get() - 4) },
        };
        mv.morph.set(0);
        await go(mv.morph, 1, MORPH, 0);
        if (!landed()) return true;
        copySpriteFrame(g.morph?.target ?? target, els.morphSprite);
        // She is there now: her sprite shows under the identical morph (and the arrival plays), then it fades.
        delete document.documentElement.dataset.mariPullLanding;
        box.classList.add("mari-pull-fadeout");
        await wait(220);
        return true;
      };
      const popOpen = () => {
        if (!mounted || !delayed || !landed()) return;
        const panel = g.landing?.panel ?? null;
        mv.open.set(0);
        const opening = go(mv.open, 1, OPEN, 0);
        els.glass?.classList.add("mari-pull-fadeout");
        els.rim?.classList.add("mari-pull-fadeout");
        els.shadow?.classList.add("mari-pull-fadeout");
        els.tag?.classList.add("mari-pull-fadeout");
        if (side === "mari") {
          void morphInto(panel).then((morphed) => Promise.all([opening, morphed ? null : wait(420)]).then(finish));
          return;
        }
        // The magnifier docks in the search field; one scrolled out of view leaves the dialog revealed where it was let go.
        const dock = panel?.querySelector<HTMLElement>(PULL_LANDING_SELECTOR.search)?.getBoundingClientRect();
        if (dock && dock.width > 0 && dock.top >= 0 && dock.bottom <= window.innerHeight) {
          go(mv.x, dock.left + dock.width / 2, DOCK, 0);
          go(mv.y, dock.top + dock.height / 2 - g.originY, DOCK, 0);
          // Sized so the magnifier inside the circle matches the one it lands on.
          go(mv.radius, (dock.width * PULL_CIRCLE_MAX) / PULL_ICON_SIZE, DOCK, 0);
        }
        Promise.all([opening, wait(420)]).then(finish);
      };
      const reveal = () => {
        delayed = true;
        popOpen();
      };
      if (g.calm) window.setTimeout(reveal, POP_DELAY_MS);
      else {
        // The view opens as the flex peaks, so the release and the reveal read as one motion.
        const started = performance.now();
        let top = 0;
        const peak = () => {
          const pop = mv.pop.get();
          if ((pop > 0 && pop < top) || performance.now() - started >= POP_DELAY_MS) return reveal();
          top = Math.max(top, pop);
          requestAnimationFrame(peak);
        };
        requestAnimationFrame(peak);
      }
      if (pullBlocked()) {
        mounted = true;
        finish();
        return;
      }
      // The dialog hands over its panel once it is on screen; the timeout only
      // guards against it never mounting, so the overlay cannot stay over the app.
      setPullHandoff((panel) => {
        if (g.landing) g.landing.panel = panel;
        // Clipped to the circle from its first frame, so the dialog cannot flash open.
        const from = g.landing?.from;
        if (panel && from) {
          const rect = panel.getBoundingClientRect();
          panel.style.clipPath = `circle(${px(from.r)}px at ${px(from.x - rect.left)}px ${px(from.y - rect.top)}px)`;
        }
        mounted = true;
        popOpen();
      });
      onOpen(side);
      window.setTimeout(() => {
        setPullHandoff(null);
        if (!mounted) {
          mounted = true;
          finish();
        }
      }, HANDOFF_TIMEOUT_MS);
    },
    [els, g, hide, mv, onOpen],
  );

  const lock = useCallback(
    (x: number) => {
      g.gesture += 1;
      g.mode = "pull";
      g.detached = false;
      g.side = null;
      g.landing = null;
      g.morph = null;
      g.gaze = null;
      g.fingerX = x;
      g.calm = useUIStore.getState().reduceAmbientEffects;
      g.follow = null;
      g.mariEnabled = useUIStore.getState().commandCenterMariEnabled;
      if (reduceMotion) {
        setLabelOnly(true);
        setShown(true);
        return;
      }
      g.lean = 0;
      for (const key of ["show", "tag", "pop", "pinch", "rem", "tail", "open", "tint", "morph", "tilt", "dip"] as const)
        mv[key].set(0);
      // jump, not set: a set reads as a velocity to the first follow spring and flings the circle away.
      mv.radius.jump(PULL_CIRCLE_MIN * 0.6);
      mv.base.jump(PULL_CIRCLE_MIN + 14);
      mv.x.jump(x);
      mv.y.jump(0);
      mv.side.set(pullTarget(null, x, g.width, g.mariEnabled) === "mari" ? 1 : 0);
      mv.glow.set(0);
      go(mv.glow, GLOW_REST, GLOW);
      for (const el of [els.glass, els.rim, els.shadow, els.tag, els.morph]) el?.classList.remove("mari-pull-fadeout");
      setTarget(pullTarget(null, x, g.width, g.mariEnabled));
      setArmed(false);
      setShown(true);
      schedulePaint();
    },
    [els, g, mv, reduceMotion, schedulePaint],
  );

  const onPointerDown = useCallback(
    (event: PullPointerEvent) => {
      swallowClickRef.current = false;
      if (g.recognizer) {
        // A second finger is not a pull.
        if (g.pointerId !== event.pointerId) snapBack();
        return;
      }
      if (!event.isPrimary || g.mode === "land" || pullBlocked()) return;
      // Touch pulls on a phone; on desktop the mouse drags from empty bar space, never from a control (M18).
      if (event.pointerType === "mouse") {
        const onControl = event.target instanceof Element && event.target.closest(BAR_CONTROL_SELECTOR);
        if (isMobileShellViewport() || event.button !== 0 || onControl) return;
      } else if (event.pointerType !== "touch" || !isMobileShellViewport()) return;
      g.width = window.innerWidth;
      g.height = window.innerHeight;
      g.threshold = pullOpenThreshold(g.height);
      g.pointerId = event.pointerId;
      g.recognizer = createPullRecognizer(event.clientX, event.clientY, event.timeStamp, g.threshold);
      const bar = document.querySelector('[data-component="TopBar"]');
      g.originY = bar?.getBoundingClientRect().bottom ?? 0;
    },
    [g, snapBack],
  );

  const onPointerMove = useCallback(
    (event: PullPointerEvent) => {
      const recognizer = g.recognizer;
      if (!recognizer || g.pointerId !== event.pointerId) return;
      const before = recognizer.step;
      const step = recognizer.move(event.clientX, event.clientY, event.timeStamp);
      if (step === "rejected") {
        g.recognizer = null;
        return;
      }
      if (step === "cancelled") {
        snapBack();
        return;
      }
      if (step === "pending") return;
      if (before === "pending") {
        // From here on the gesture is ours: a pull that began on a button must
        // not press it or start the Home long-press.
        try {
          if (event.currentTarget instanceof Element) event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // The pointer is already gone (or synthetic); moves still bubble here.
        }
        swallowClickRef.current = true;
        if (event.pointerType === "mouse") blockTextSelectionUntilRelease();
        onPullStart();
        lock(event.clientX);
      }
      const armedNow = step === "armed" && before !== "armed";
      const dy = Math.max(0, recognizer.distance);
      const pull = dy / g.threshold;
      const x = clamp(event.clientX, 0, g.width);
      g.fingerX = x;

      // The finger steers; the side is chosen once the pull is under way.
      if (pull >= PULL_SIDE_FROM || step === "armed") {
        const next = pullTarget(g.side, x, g.width, g.mariEnabled);
        if (g.side && next !== g.side) navigator.vibrate?.(6);
        if (next !== g.side) setTarget(next);
        g.side = next;
      } else if (g.side) {
        g.side = null;
      }
      if (armedNow) {
        navigator.vibrate?.(8);
        setArmed(true);
      }

      if (reduceMotion) {
        // No sheet at all: the label sits above the finger and the threshold itself opens.
        const chip = els.chip;
        if (chip) {
          const y = clamp(event.clientY - PULL_FINGER_GAP - 32, g.originY + 6, g.height - 44);
          chip.style.opacity = String(clamp01(pull / 0.25));
          chip.style.transform = `translate3d(${px(clamp(x, 80, g.width - 80))}px, ${px(y)}px, 0) translate(-50%, 0)`;
          chip.style.setProperty("--mari-pull-progress", String(clamp01(pull)));
        }
        if (armedNow) {
          const side = g.side ?? pullTarget(null, x, g.width, g.mariEnabled);
          g.recognizer = null;
          hide();
          if (!pullBlocked()) onOpen(side);
        }
        return;
      }

      // The springs follow once per frame with the newest pointer: re-aiming them on every event (a
      // 1000 Hz mouse, or Playwright's) restarts them from a velocity measured over ~0 ms and flings them.
      g.follow = { x, fingerY: event.clientY - g.originY, pull, armed: step === "armed" };
      if (!g.followQueued) {
        g.followQueued = true;
        frame.update(() => {
          g.followQueued = false;
          const f = g.follow;
          if (g.mode !== "pull" || !f) return;
          const over = g.calm ? 0 : Math.max(0, f.pull - 1) * g.threshold * RUBBER;
          const circle = pullCircleTarget(f.fingerY - over, f.pull);
          go(mv.radius, circle.radius, GROW);
          go(mv.tag, circle.tag, SHOW);
          // The circle grows out of the bar edge and never rises above it.
          go(mv.y, circle.centerY, FOLLOW);
          go(mv.x, f.x, FOLLOW);
          go(mv.show, clamp01((circle.radius - 16) / 10) * clamp01((f.pull - PULL_SIDE_FROM) / 0.2), SHOW);
          go(mv.base, pullSheetBase(circle.radius, f.pull, g.width), BASE);
          if (g.side) go(mv.side, g.side === "mari" ? 1 : 0, SIDE);
          else mv.side.set(pullTarget(null, f.x, g.width, g.mariEnabled) === "mari" ? 1 : 0);
          if (!f.armed) go(mv.glow, GLOW_REST + GLOW_PULL * clamp01(f.pull), GLOW);
        });
      }
      if (armedNow) {
        // A soft flare from within, a faint accent around the circle, and the sheet lets go.
        go(mv.glow, GLOW_ARMED, GLOW, mv.glow.getVelocity() + GLOW_FLARE);
        go(mv.tint, TINT_ARMED, GLOW);
        if (!g.detached) go(mv.pinch, 1, PINCH);
        if (!g.calm) go(mv.dip, 0, DIP, ARM_DIP);
      }
    },
    [els, g, hide, lock, mv, onOpen, onPullStart, reduceMotion, snapBack],
  );

  const onPointerUp = useCallback(
    (event: PullPointerEvent) => {
      const recognizer = g.recognizer;
      if (!recognizer || g.pointerId !== event.pointerId) return;
      if (!recognizer.release(event.timeStamp)) {
        snapBack();
        return;
      }
      const side = g.side ?? pullTarget(null, clamp(event.clientX, 0, g.width), g.width, g.mariEnabled);
      if (reduceMotion) {
        // A flick under reduced motion: open straight away.
        g.recognizer = null;
        hide();
        if (!pullBlocked()) onOpen(side);
        return;
      }
      land(side, recognizer.releaseVelocity(event.timeStamp));
    },
    [g, hide, land, onOpen, reduceMotion, snapBack],
  );

  const onPointerCancel = useCallback(
    (event: PullPointerEvent) => {
      if (g.recognizer && g.pointerId === event.pointerId) snapBack();
    },
    [g, snapBack],
  );

  const onClickCapture = useCallback((event: Pick<MouseEvent, "preventDefault" | "stopPropagation">) => {
    if (!swallowClickRef.current) return;
    swallowClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  // L8: a dialog or the game setup wizard covers the bar, so a pull that starts
  // on the bar's strip lands on the overlay instead. Follow those touches on the
  // document; touch pointers stay captured to where they started, so a pull on
  // the bar itself never reaches these listeners.
  useEffect(() => {
    const covered = (event: Event) =>
      !(event.target instanceof Element && event.target.closest(`[${PULL_ZONE_ATTRIBUTE}]`));
    const down = (event: PointerEvent) => {
      // Any new press ends the swallow, so a pull without a click after it never eats the next tap.
      swallowClickRef.current = false;
      if (event.pointerType !== "touch" || !covered(event)) return;
      const bar = document.querySelector('[data-component="TopBar"]');
      if (bar && event.clientY <= bar.getBoundingClientRect().bottom) onPointerDown(event);
    };
    const move = (event: PointerEvent) => covered(event) && onPointerMove(event);
    const up = (event: PointerEvent) => covered(event) && onPointerUp(event);
    const cancel = (event: PointerEvent) => covered(event) && onPointerCancel(event);
    const click = (event: MouseEvent) => covered(event) && onClickCapture(event);
    // The overlay would scroll under the pull and cancel the pointer.
    const touchMove = (event: TouchEvent) => {
      if (g.recognizer && covered(event)) event.preventDefault();
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", cancel, true);
    document.addEventListener("click", click, true);
    document.addEventListener("touchmove", touchMove, { capture: true, passive: false });
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", cancel, true);
      document.removeEventListener("click", click, true);
      document.removeEventListener("touchmove", touchMove, true);
    };
  }, [g, onClickCapture, onPointerCancel, onPointerDown, onPointerMove, onPointerUp]);

  const visuals: PullDropVisuals = { shown, labelOnly, target, armed, els };
  return {
    handlers: {
      [PULL_ZONE_ATTRIBUTE]: "",
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onClickCapture,
    },
    visuals,
  };
}
