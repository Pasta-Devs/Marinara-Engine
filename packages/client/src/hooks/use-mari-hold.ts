import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { isMariFling, isMariShaken, MARI_DIZZY_MS, MARI_HOLD_DELAY_MS, resolveMariPress } from "../lib/mari-hold";
import { achievementKeys, trackAchievementEvent } from "./use-achievements";
import { useReducedAmbientEffects } from "./use-reduced-ambient-effects";

/** `held` and `releasing` drive the figure; `hop`, `bounce` and `landed` are one-shot slot motions. */
export type MariHoldMotion = "idle" | "pending" | "held" | "releasing" | "hop" | "bounce" | "landed";

interface MariHoldOptions {
  /** The element that wraps the slot. Its first element child is the art that lifts. */
  wrapperRef: RefObject<HTMLElement | null>;
  /** A tap that never lifts her. Without it, a slot that is not a button still hops on a tap when `hopOnTap`. */
  onTap?: () => void;
  hopOnTap?: boolean;
}

interface MariPress {
  id: number;
  type: string;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startedAt: number;
  timer: number;
  lifted: boolean;
  stop: () => void;
}

const HOP_MS = 420;
const BOUNCE_MS = 320;
const LINE_MS = 1_400;

/** Slice 85: a press-and-hold on Mari's art. Tap keeps its normal action; a hold lifts her off her slot. */
export function useMariHold({ wrapperRef, onTap, hopOnTap = false }: MariHoldOptions) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const reduced = useReducedAmbientEffects();
  const [motion, setMotionState] = useState<MariHoldMotion>("idle");
  const [figureStart, setFigureStart] = useState<{ left: number; top: number; height: number } | null>(null);
  const [line, setLine] = useState<string | null>(null);
  const [dizzy, setDizzy] = useState(false);
  /** Reduced motion: where her line shows, since no figure carries it. */
  const [bounceAt, setBounceAt] = useState<{ left: number; top: number } | null>(null);
  const motionRef = useRef<MariHoldMotion>("idle");
  const pressRef = useRef<MariPress | null>(null);
  const timersRef = useRef<number[]>([]);
  const suppressClickRef = useRef(false);
  const pointerRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, at: 0 });
  const shakeRef = useRef({ flips: [] as number[], dir: 0, x: 0 });
  const optionsRef = useRef({ onTap, hopOnTap, reduced, t });
  optionsRef.current = { onTap, hopOnTap, reduced, t };

  /** The lifted art's rest spot: top-centre and height, read once when she is released. */
  const slotRect = () => {
    const rect = wrapperRef.current?.firstElementChild?.getBoundingClientRect();
    return rect ? { left: rect.left + rect.width / 2, top: rect.top, height: rect.height } : null;
  };

  const setMotion = (next: MariHoldMotion) => {
    motionRef.current = next;
    setMotionState(next);
  };
  const later = (ms: number, fn: () => void) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  const stopPress = () => {
    const press = pressRef.current;
    if (!press) return;
    window.clearTimeout(press.timer);
    press.stop();
    pressRef.current = null;
  };

  const hop = () => {
    setMotion("hop");
    later(HOP_MS, () => setMotion("idle"));
  };

  const release = () => {
    stopPress();
    const { vx, vy } = pointerRef.current;
    if (isMariFling(Math.hypot(vx, vy))) {
      setLine(optionsRef.current.t("mari.hold.fling", "Wheee!"));
      later(LINE_MS, () => setLine(null));
    }
    setMotion("releasing");
  };

  const becomeDizzy = () => {
    shakeRef.current.flips = [];
    setDizzy(true);
    setLine(optionsRef.current.t("mari.hold.dizzy", "Whoa… the room is spinning."));
    later(MARI_DIZZY_MS, () => {
      setDizzy(false);
      if (motionRef.current === "held") setLine(optionsRef.current.t("home.assistant.dragPrompt"));
    });
  };

  const lift = () => {
    const press = pressRef.current;
    if (!press) return;
    window.clearTimeout(press.timer);
    press.lifted = true;
    suppressClickRef.current = true;
    if (press.type !== "mouse") navigator.vibrate?.(8);
    // Slice 85: the first lift anywhere unlocks "Please Handle With Care".
    void trackAchievementEvent("prof_mari_dragged", { keepalive: true })
      .catch(() => undefined)
      .finally(() => void queryClient.invalidateQueries({ queryKey: achievementKeys.all }));
    if (optionsRef.current.reduced) {
      // Reduced motion: no follow, no figure. A small bounce in place and her line.
      setMotion("bounce");
      setBounceAt(slotRect());
      setLine(optionsRef.current.t("home.assistant.dragPrompt"));
      later(BOUNCE_MS, () => setMotion("idle"));
      later(LINE_MS * 2, () => {
        setLine(null);
        setBounceAt(null);
      });
      return;
    }
    setFigureStart(slotRect() ?? { left: press.startX, top: press.startY, height: 56 });
    pointerRef.current = { x: press.lastX, y: press.lastY, vx: 0, vy: 0, at: performance.now() };
    shakeRef.current = { flips: [], dir: 0, x: press.lastX };
    setLine(optionsRef.current.t("home.assistant.dragPrompt"));
    setMotion("held");
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || motionRef.current !== "idle") return;
    if (pressRef.current) stopPress();
    suppressClickRef.current = false;

    const onMove = (move: PointerEvent) => {
      const press = pressRef.current;
      if (!press || move.pointerId !== press.id) return;
      press.lastX = move.clientX;
      press.lastY = move.clientY;
      const travelPx = Math.hypot(move.clientX - press.startX, move.clientY - press.startY);
      if (motionRef.current === "pending") {
        const step = resolveMariPress({
          pointerType: press.type,
          travelPx,
          heldMs: performance.now() - press.startedAt,
        });
        if (step === "lift") lift();
        else if (step === "scroll") {
          stopPress();
          setMotion("idle");
        }
        return;
      }
      if (motionRef.current !== "held") return;
      const now = performance.now();
      const pointer = pointerRef.current;
      const dt = Math.max(1, now - pointer.at) / 1000;
      pointer.vx = 0.6 * ((move.clientX - pointer.x) / dt) + 0.4 * pointer.vx;
      pointer.vy = 0.6 * ((move.clientY - pointer.y) / dt) + 0.4 * pointer.vy;
      pointer.x = move.clientX;
      pointer.y = move.clientY;
      pointer.at = now;
      // Shake: each reversal of a real horizontal move (3 px or more) is a flip.
      const shake = shakeRef.current;
      const dx = move.clientX - shake.x;
      if (Math.abs(dx) >= 3) {
        const dir = Math.sign(dx);
        if (shake.dir !== 0 && dir !== shake.dir) shake.flips.push(now);
        shake.flips = shake.flips.filter((at) => now - at <= 900);
        shake.dir = dir;
        shake.x = move.clientX;
        if (isMariShaken(shake.flips, now)) becomeDizzy();
      }
    };
    const onUp = (up: PointerEvent) => {
      const press = pressRef.current;
      if (!press || up.pointerId !== press.id) return;
      if (press.lifted) {
        if (!optionsRef.current.reduced) release();
        else stopPress();
        return;
      }
      stopPress();
      setMotion("idle");
      if (optionsRef.current.hopOnTap) hop();
      optionsRef.current.onTap?.();
    };
    const onCancel = (cancel: PointerEvent) => {
      const press = pressRef.current;
      if (!press || cancel.pointerId !== press.id) return;
      if (press.lifted && !optionsRef.current.reduced) release();
      else {
        stopPress();
        setMotion("idle");
      }
    };
    const onKey = (key: KeyboardEvent) => {
      if (key.key === "Escape" && motionRef.current === "held") release();
    };
    // Touch: once she is lifted, the page must not scroll under her finger.
    const blockScroll = (touch: TouchEvent) => {
      if (pressRef.current?.lifted) touch.preventDefault();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchmove", blockScroll, { passive: false });
    const press: MariPress = {
      id: event.pointerId,
      type: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      startedAt: performance.now(),
      timer: 0,
      lifted: false,
      stop: () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("touchmove", blockScroll);
      },
    };
    press.timer = window.setTimeout(() => {
      const current = pressRef.current;
      if (!current || current !== press || motionRef.current !== "pending") return;
      const step = resolveMariPress({
        pointerType: current.type,
        travelPx: Math.hypot(current.lastX - current.startX, current.lastY - current.startY),
        heldMs: MARI_HOLD_DELAY_MS,
      });
      if (step === "lift") lift();
    }, MARI_HOLD_DELAY_MS);
    pressRef.current = press;
    setMotion("pending");
  };

  /** A hard hit on a viewport edge: two direction flips toward dizzy, and her bonk line. */
  const smash = () => {
    const now = performance.now();
    const shake = shakeRef.current;
    shake.flips = [...shake.flips, now, now].filter((at) => now - at <= 900);
    if (isMariShaken(shake.flips, now)) {
      becomeDizzy();
      return;
    }
    const bonk = optionsRef.current.t("mari.hold.bonk", "Ow! The walls are not soft.");
    setLine(bonk);
    later(LINE_MS, () =>
      setLine((current) => (current === bonk ? optionsRef.current.t("home.assistant.dragPrompt") : current)),
    );
  };

  const onClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
    // The click that ends a lift is not a tap on the door; swallow it. A keyboard click (detail 0)
    // always passes: a release away from her slot never clicks it, so the flag can still be set.
    if (!suppressClickRef.current || event.detail === 0) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  /** Called by the figure once the release spring has settled back in the slot. */
  const settle = () => {
    setFigureStart(null);
    setDizzy(false);
    setLine(null);
    setMotion("landed");
    later(HOP_MS, () => setMotion("idle"));
  };

  useEffect(() => {
    return () => {
      stopPress();
      clearTimers();
    };
    // Unmount only: the press and timers are owned by this instance.
  }, []);

  return {
    motion,
    figureStart,
    line,
    dizzy,
    bounceAt,
    pointerRef,
    settle,
    smash,
    slotRect,
    handlers: { onPointerDown, onClickCapture },
  };
}
