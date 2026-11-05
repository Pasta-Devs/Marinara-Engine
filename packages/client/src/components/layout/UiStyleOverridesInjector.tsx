// ──────────────────────────────────────────────
// UiStyleOverridesInjector: applies the user's saved (and in-progress) region
// restyling as one <style> tag, and hosts the full-screen element picker.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useUIStore } from "../../stores/ui.store";
import { sanitizeAppCss } from "../../lib/theme-css";
import { UiStyleEditorCard } from "./UiStyleEditorCard";
import {
  UI_STYLE_TARGETS,
  buildUiStyleOverridesCss,
  resolveUiStyleTarget,
  type UiStyleOverrides,
  type UiStyleTargetId,
} from "../../lib/ui-style-overrides";

const STYLE_ELEMENT_ID = "marinara-ui-style-overrides";
const OVERLAY_ATTRIBUTE = "data-ui-style-overlay";

interface PickHit {
  id: UiStyleTargetId;
  rect: { top: number; left: number; width: number; height: number };
}

function probeTarget(x: number, y: number): PickHit | null {
  const element = document.elementsFromPoint(x, y).find((candidate) => !candidate.closest(`[${OVERLAY_ATTRIBUTE}]`));
  const id = resolveUiStyleTarget((element as HTMLElement | undefined) ?? null);
  if (!id || !element) return null;
  const selector = UI_STYLE_TARGETS.find((target) => target.id === id)?.selector;
  const region = selector ? element.closest(selector) : null;
  if (!region) return null;
  const rect = region.getBoundingClientRect();
  return { id, rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height } };
}

function UiStylePickOverlay() {
  const { t } = useTranslation();
  const setPickMode = useUIStore((s) => s.setUiStylePickMode);
  const setSelectedTarget = useUIStore((s) => s.setUiStyleSelectedTarget);
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

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      if (frame) window.cancelAnimationFrame(frame);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [reprobe, setPickMode]);

  const label = hit ? t(UI_STYLE_TARGETS.find((target) => target.id === hit.id)?.labelKey ?? "") : "";

  // ponytail: the overlay probes the main document only, so detached/pop-out windows are not pickable
  // (the region dropdown is the path there); upgrade path is a per-window overlay host.
  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("settings.appearance.uiStyles.pickElement")}
      tabIndex={-1}
      {...{ [OVERLAY_ATTRIBUTE]: "" }}
      className="fixed inset-0 cursor-crosshair outline-none"
      style={{ zIndex: "calc(var(--mari-layer-omnibar) + 2)" }}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => {
        pointerRef.current = { x: event.clientX, y: event.clientY };
        reprobe();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const picked = probeTarget(event.clientX, event.clientY);
        if (!picked) return;
        setSelectedTarget(picked.id);
        setPickMode(false);
      }}
    >
      {hit && (
        <>
          <div
            className="pointer-events-none fixed rounded-sm border-2 border-[var(--primary)] bg-[var(--primary)]/15"
            style={{ top: hit.rect.top, left: hit.rect.left, width: hit.rect.width, height: hit.rect.height }}
          />
          <div
            className="pointer-events-none fixed rounded-md bg-[var(--primary)] px-2 py-0.5 text-[0.6875rem] font-semibold text-[var(--primary-foreground)] shadow-lg"
            style={{ top: Math.max(4, hit.rect.top - 24), left: Math.max(4, hit.rect.left) }}
          >
            {label}
          </div>
        </>
      )}
      <div className="fixed left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-black/80 px-3 py-1.5 text-xs text-white shadow-lg">
        <span className="pointer-events-none">{t("settings.appearance.uiStyles.pickHint")}</span>
        <button
          type="button"
          className="rounded-md bg-white/15 px-2 py-0.5 hover:bg-white/25"
          onClick={(event) => {
            event.stopPropagation();
            setPickMode(false);
          }}
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
  const editedTarget = UI_STYLE_TARGETS.find((target) => target.id === selectedTarget);

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

  if (pickMode) return <UiStylePickOverlay />;
  return editedTarget ? <UiStyleEditorCard key={editedTarget.id} target={editedTarget} /> : null;
}
