// ──────────────────────────────────────────────
// UiStyleOverridesInjector: applies the user's saved (and in-progress) region
// and block restyling as one <style> tag, and hosts the full-screen element picker.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { isMobileShellViewport, useUIStore } from "../../stores/ui.store";
import { sanitizeAppCss } from "../../lib/theme-css";
import { UiStyleEditorCard } from "./UiStyleEditorCard";
import {
  buildUiStyleOverridesCss,
  getUiStyleTarget,
  resolveUiStyleChain,
  UI_STYLE_EDITOR_ATTRIBUTE,
  uiStyleTargetLabel,
  type UiStyleOverrides,
  type UiStyleTargetId,
} from "../../lib/ui-style-overrides";

const STYLE_ELEMENT_ID = "marinara-ui-style-overrides";
/** Events that must not reach the page while picking; touch and wheel scrolling stay native. */
const SWALLOWED_EVENTS = [
  "pointerdown",
  "pointerup",
  "pointerover",
  "pointerout",
  "mouseup",
  "mouseover",
  "mouseout",
  "dblclick",
  "auxclick",
  "touchstart",
  "touchmove",
  "touchend",
] as const;
/** Outlines drawn for the other blocks a pick would restyle; the count still covers all of them. */
const MAX_SIBLING_OUTLINES = 60;

type Box = { top: number; left: number; width: number; height: number };
type Point = { x: number; y: number };

interface PickHit {
  /** Outermost first; the last level is the one a click picks. */
  chain: UiStyleTargetId[];
  rect: Box;
  /** Blocks only: every other element with the class, and how many there are. */
  siblings: Box[];
  count: number;
}

function toBox(element: Element): Box {
  const rect = element.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function isOnScreen({ top, left, width, height }: Box): boolean {
  return (
    width > 0 &&
    height > 0 &&
    top < window.innerHeight &&
    left < window.innerWidth &&
    top + height > 0 &&
    left + width > 0
  );
}

function probeTarget(x: number, y: number): PickHit | null {
  const element = document
    .elementsFromPoint(x, y)
    .find((candidate) => !candidate.closest(`[${UI_STYLE_EDITOR_ATTRIBUTE}]`));
  const chain = resolveUiStyleChain((element as HTMLElement | undefined) ?? null);
  const target = getUiStyleTarget(chain.at(-1));
  const picked = target && element ? element.closest(target.selector) : null;
  if (!target || !picked) return null;
  const all = target.className ? Array.from(document.querySelectorAll(target.selector)) : [picked];
  const siblings = all
    .filter((other) => other !== picked)
    .map(toBox)
    .filter(isOnScreen)
    .slice(0, MAX_SIBLING_OUTLINES);
  return { chain, rect: toBox(picked), siblings, count: all.length };
}

function UiStylePickOverlay({ onPick }: { onPick: (chain: UiStyleTargetId[], point: Point) => void }) {
  const { t } = useTranslation();
  const setPickMode = useUIStore((s) => s.setUiStylePickMode);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const [hit, setHit] = useState<PickHit | null>(null);

  const reprobe = useCallback(() => {
    const pointer = pointerRef.current;
    setHit(pointer ? probeTarget(pointer.x, pointer.y) : null);
  }, []);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    rootRef.current?.focus({ preventScroll: true });

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        reprobe();
      });
    };
    // The overlay lets pointers through so the page scrolls under a finger or wheel; these window
    // capture listeners keep every press and click from reaching the controls underneath instead.
    const fromOverlay = (event: Event) => event.target instanceof Node && !!rootRef.current?.contains(event.target);
    const swallow = (event: Event) => {
      if (!fromOverlay(event)) event.stopPropagation();
    };
    // No focus, text selection, menus or default actions underneath.
    const cancel = (event: Event) => {
      if (fromOverlay(event)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const onPointerMove = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
      schedule();
      swallow(event);
    };
    const onClick = (event: MouseEvent) => {
      if (fromOverlay(event)) return;
      cancel(event);
      const picked = probeTarget(event.clientX, event.clientY);
      if (!picked) return;
      onPick(picked.chain, { x: event.clientX, y: event.clientY });
      setPickMode(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        // Keep keyboard focus on the overlay so Enter/Space cannot activate controls underneath.
        event.preventDefault();
        return;
      }
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setPickMode(false);
    };
    const cursor = document.createElement("style");
    cursor.textContent = "*{cursor:crosshair!important}";
    document.head.appendChild(cursor);

    const passive = { capture: true, passive: true };
    for (const type of SWALLOWED_EVENTS) window.addEventListener(type, swallow, passive);
    window.addEventListener("pointermove", onPointerMove, passive);
    window.addEventListener("mousedown", cancel, true);
    window.addEventListener("contextmenu", cancel, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      for (const type of SWALLOWED_EVENTS) window.removeEventListener(type, swallow, passive);
      window.removeEventListener("pointermove", onPointerMove, passive);
      window.removeEventListener("mousedown", cancel, true);
      window.removeEventListener("contextmenu", cancel, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      if (frame) window.cancelAnimationFrame(frame);
      cursor.remove();
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [onPick, reprobe, setPickMode]);

  const label = hit
    ? hit.chain
        .map((id) => getUiStyleTarget(id))
        .filter((target) => target !== null)
        .map((target) => uiStyleTargetLabel(target, t))
        .join(" › ")
    : "";
  const reach =
    hit && hit.chain.at(-1)?.startsWith("class:") ? t("settings.appearance.uiStyles.reach", { count: hit.count }) : "";

  // ponytail: the overlay probes the main document only, so detached/pop-out windows are not pickable
  // (the region dropdown is the path there); upgrade path is a per-window overlay host.
  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("settings.appearance.uiStyles.pickElement")}
      tabIndex={-1}
      {...{ [UI_STYLE_EDITOR_ATTRIBUTE]: "" }}
      className="pointer-events-none fixed inset-0 outline-none"
      style={{ zIndex: "calc(var(--mari-layer-omnibar) + 2)" }}
    >
      {hit && (
        <>
          {hit.siblings.map((box, index) => (
            <div
              key={index}
              className="pointer-events-none fixed rounded-sm border border-dashed border-[var(--primary)]/70"
              style={box}
            />
          ))}
          <div
            className="pointer-events-none fixed rounded-sm border-2 border-[var(--primary)] bg-[var(--primary)]/15"
            style={{ top: hit.rect.top, left: hit.rect.left, width: hit.rect.width, height: hit.rect.height }}
          />
          <div
            className="pointer-events-none fixed rounded-md bg-[var(--primary)] px-2 py-0.5 text-[0.6875rem] font-semibold text-[var(--primary-foreground)] shadow-lg"
            style={{ top: Math.max(4, hit.rect.top - 24), left: Math.max(4, hit.rect.left) }}
          >
            {label}
            {reach && <span className="font-normal opacity-85"> · {reach}</span>}
          </div>
        </>
      )}
      <div className="fixed left-1/2 top-3 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-lg bg-black/80 px-3 py-1.5 text-xs text-white shadow-lg">
        <span className="truncate">
          {t(
            isMobileShellViewport()
              ? "settings.appearance.uiStyles.pickHintTouch"
              : "settings.appearance.uiStyles.pickHint",
          )}
        </span>
        <button
          type="button"
          className="pointer-events-auto shrink-0 rounded-md bg-white/15 px-2 py-0.5 hover:bg-white/25"
          onClick={() => setPickMode(false)}
        >
          {t("settings.appearance.uiStyles.cancelPick")}
        </button>
      </div>
    </div>,
    document.body,
  );
}

export function UiStyleOverridesInjector() {
  const { saved, preview, pickMode, selectedTarget } = useUIStore(
    useShallow((s) => ({
      saved: s.uiStyleOverrides,
      preview: s.uiStylePreview,
      pickMode: s.uiStylePickMode,
      selectedTarget: s.uiStyleSelectedTarget,
    })),
  );
  const setSelectedTarget = useUIStore((s) => s.setUiStyleSelectedTarget);
  const editedTarget = getUiStyleTarget(selectedTarget);
  // The levels of the last pick, for the card's breadcrumb; a region opened from settings has none.
  const [picked, setPicked] = useState<{ chain: UiStyleTargetId[]; point: Point }>({
    chain: [],
    point: { x: 0, y: 0 },
  });
  const onPick = useCallback(
    (chain: UiStyleTargetId[], point: Point) => {
      setPicked({ chain, point });
      setSelectedTarget(chain.at(-1) ?? null);
    },
    [setSelectedTarget],
  );

  const css = useMemo(() => {
    const effective: UiStyleOverrides = preview ? { ...saved, [preview.target]: preview.override ?? undefined } : saved;
    return sanitizeAppCss(buildUiStyleOverridesCss(effective));
  }, [saved, preview]);

  // ponytail: injected into the main document only; detached windows keep the theme's own look.
  useEffect(() => {
    let style = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
    if (!css) {
      style?.remove();
      return;
    }
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ELEMENT_ID;
    }
    style.textContent = css;
    // Re-append so these rules stay after any theme or extension style added since.
    document.head.appendChild(style);
  }, [css]);

  useEffect(() => () => document.getElementById(STYLE_ELEMENT_ID)?.remove(), []);

  if (pickMode) return <UiStylePickOverlay onPick={onPick} />;
  if (!editedTarget) return null;
  const fromPick = picked.chain.includes(editedTarget.id);
  return (
    <UiStyleEditorCard
      key={editedTarget.id}
      target={editedTarget}
      levels={fromPick ? picked.chain : [editedTarget.id]}
      anchor={fromPick ? picked.point : null}
    />
  );
}
