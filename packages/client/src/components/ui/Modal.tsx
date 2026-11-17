// ──────────────────────────────────────────────
// Reusable animated modal shell
// Uses CSS animations instead of framer-motion to
// avoid double-animation under React.StrictMode.
// ──────────────────────────────────────────────
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  NEUTRAL_PANEL_HEADER,
  PHONE_BOTTOM_SHEET_CLASS,
  SHEET_CLOSE_BUTTON_CLASS,
  SHEET_GRABBER_CLASS,
  NEUTRAL_PANEL_SCROLL_AREA,
  NEUTRAL_PANEL_SHELL,
  NEUTRAL_PANEL_TITLE,
} from "./neutral-surface-styles";
import { InsideModalContext } from "./modal-context";
import { useDialogFocusScope } from "../../hooks/use-dialog-focus-scope";
import { useBackdropDismiss } from "../../hooks/use-backdrop-dismiss";
import { useBackDismiss } from "../../hooks/use-back-dismiss";
import { isBrowserExtensionUi } from "../../lib/chat-floating-ui-events";
import { registerModalOverlay, type ModalOverlayRegistration } from "../../lib/modal-overlay-registry";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { useUIStore } from "../../stores/ui.store";
import { useTranslation as useUiTranslation } from "react-i18next";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Id of the element that names the dialog (e.g. a `titleSlot` heading); replaces the plain-text label. */
  labelledBy?: string;
  /** Fade in without the small scale-up, for content that is measured or panned (image viewers). */
  fadeOnly?: boolean;
  /** Identifies the dialog to tests and browser extensions; defaults to "Modal". */
  dataComponent?: string;
  /** Shown in the header instead of the title text; `title` still names the dialog. */
  titleSlot?: ReactNode;
  children: ReactNode;
  /** Width class, e.g. "max-w-md", "max-w-lg" */
  width?: string;
  contentRef?: Ref<HTMLDivElement>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  focusScopePortalSelector?: string;
  chatFloatingPanel?: boolean;
  /** Below the sm breakpoint, fill the viewport edge-to-edge like a window instead of floating as a padded bubble. */
  mobileFullscreen?: boolean;
  /** Optional feature-local classes applied to the full panel, including its header. */
  panelClassName?: string;
  /** Optional feature-local classes applied to the scrollable content area. */
  contentClassName?: string;
  /** Optional feature-local style variables applied to the full panel. */
  panelStyle?: CSSProperties;
  closeDisabled?: boolean;
  /** Phone sheet closes on a downward pull and shows a grab handle. Turn off where closing loses work (review, running generation). */
  pullToClose?: boolean;
  /** Actions pinned under the scrolling content; main action first, stacked full-width on phones. */
  footer?: ReactNode;
  closeButtonClassName?: string;
  /** Hide the header bar; `title` still names the dialog. For sheets that cannot be closed. */
  hideHeader?: boolean;
  /** Show the backdrop at full strength at once, for a modal that replaces another one without a bright gap. */
  instantBackdrop?: boolean;
  /** Solid panel surface and no backdrop blur (Connections windows); other modals keep the translucent chrome. */
  opaque?: boolean;
  /** Let drag hit-testing reach content behind the modal while keeping the panel interactive. */
  dragThrough?: boolean;
  /** Keep surrounding libraries interactive, without a backdrop or focus trap. */
  modeless?: boolean;
  /** Always open on the omnibar's layer, above every other app overlay (app dialogs, even over a package screen). */
  topLayer?: boolean;
  /** Stacking: `default`; `omnibar` = the omnibar's layer (same as `topLayer`); `top` = one above the omnibar, for dialogs opened from inside it. */
  layer?: "default" | "omnibar" | "top";
  /** `blur` (default) dims and blurs; `dark` dims more, for image viewers; `solid` = `opaque`; `none` shows no backdrop (an outside tap still closes). */
  backdrop?: "blur" | "dark" | "solid" | "none";
}

const NO_DOCKED_SIDEBAR = { left: 0, right: 0 };

/**
 * The docked sidebar's width on each side, measured from the shell's one slot while a modeless dialog is open, so the
 * dialog stays clear of it frame by frame as it slides or is dragged wider. AppShell's published insets wait for the
 * slide or drag to pause, because writing them restyles the whole app. In sheet mode (phones, tablets) there is no
 * slot, so both edges keep their 16px.
 */
function useDockedSidebarInset(enabled: boolean) {
  const [inset, setInset] = useState(NO_DOCKED_SIDEBAR);
  useLayoutEffect(() => {
    if (!enabled) return;
    let slot: HTMLElement | null = null;
    let frame = 0;
    const measure = () => {
      const current = document.querySelector<HTMLElement>('[data-component="SidebarSlot"]');
      if (current !== slot) {
        sizes.disconnect();
        sides.disconnect();
        if (current) {
          sizes.observe(current);
          sides.observe(current, { attributes: true, attributeFilter: ["data-sidebar-side"] });
        }
        slot = current;
      }
      const width = current ? Math.round(current.getBoundingClientRect().width) : 0;
      const onLeft = current?.dataset.sidebarSide === "left";
      setInset((previous) =>
        previous.left === (onLeft ? width : 0) && previous.right === (onLeft ? 0 : width)
          ? previous
          : { left: onLeft ? width : 0, right: onLeft ? 0 : width },
      );
    };
    const sizes = new ResizeObserver(measure);
    const sides = new MutationObserver(measure);
    // A window resize can switch the shell between docked and sheet: measure after it has rendered.
    const onResize = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("resize", onResize);
    return () => {
      sizes.disconnect();
      sides.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [enabled]);
  return enabled ? inset : NO_DOCKED_SIDEBAR;
}

export function Modal({
  open,
  onClose,
  title,
  labelledBy,
  fadeOnly = false,
  dataComponent = "Modal",
  titleSlot,
  children,
  width = "max-w-md",
  contentRef,
  initialFocusRef,
  restoreFocusRef,
  focusScopePortalSelector,
  chatFloatingPanel = false,
  mobileFullscreen = false,
  panelClassName,
  contentClassName,
  panelStyle,
  closeDisabled = false,
  pullToClose = true,
  footer,
  closeButtonClassName,
  hideHeader = false,
  instantBackdrop = false,
  opaque = false,
  dragThrough = false,
  modeless = false,
  topLayer = false,
  layer = topLayer ? "omnibar" : "default",
  backdrop = opaque ? "solid" : "blur",
}: ModalProps) {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  const localizedTitle = localize(title);
  const dockedSidebar = useDockedSidebarInset(modeless);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Track mounted state separately so we can play the exit animation
  // before actually removing the DOM nodes.
  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState<"enter" | "exit" | null>(null);
  // A dialog the omnibar or Mari opens (a confirm, say) must not land beneath them.
  const [overOmnibar, setOverOmnibar] = useState(false);
  const enterRafRef = useRef<number | null>(null);
  const backdropDismiss = useBackdropDismiss(onClose, closeDisabled);
  const overlayRegistrationRef = useRef<ModalOverlayRegistration | null>(null);
  useDialogFocusScope(
    open && mounted,
    panelRef,
    initialFocusRef,
    restoreFocusRef,
    focusScopePortalSelector,
    () => overlayRegistrationRef.current?.isTopmost() ?? true,
    !modeless,
  );
  // Hardware / gesture back closes the topmost modal. While closing is disabled
  // the press is absorbed rather than ignored, matching Escape: an in-flight
  // operation must not be interrupted by backgrounding the app.
  useBackDismiss(open, () => {
    if (!closeDisabled) onClose();
  });

  useEffect(() => {
    if (enterRafRef.current !== null) {
      cancelAnimationFrame(enterRafRef.current);
      enterRafRef.current = null;
    }

    if (open) {
      setMounted(true);
      setOverOmnibar(useUIStore.getState().omnibarOpen);
      // Start enter animation on next frame so the DOM is present
      enterRafRef.current = requestAnimationFrame(() => {
        setAnimating("enter");
      });
    } else if (mounted) {
      // Reduced motion has no fade (globals.css), so there is no transitionend to wait for.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setMounted(false);
        setAnimating(null);
      } else {
        setAnimating("exit");
      }
    }

    return () => {
      if (enterRafRef.current !== null) {
        cancelAnimationFrame(enterRafRef.current);
        enterRafRef.current = null;
      }
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Register as an open overlay, in opening order. Two readers: screens that
  // draw their own full-page shell learn that a dialog is stacked above them,
  // and the Escape listener below asks whether THIS dialog is the topmost one,
  // since every open Modal hears the same keypress and none stops propagation.
  useEffect(() => {
    if (!open) return;
    const registration = registerModalOverlay();
    overlayRegistrationRef.current = registration;
    return () => {
      registration.release();
      overlayRegistrationRef.current = null;
    };
  }, [open]);

  // Close on Escape, but only the topmost open dialog: a confirm opened over a
  // settings dialog must not take the settings dialog down with it.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      // Escape while an IME is composing cancels the composition first.
      if (e.isComposing) return;
      // A browser extension's card (Grammarly's) takes Escape for itself; it must not close this dialog.
      if (isBrowserExtensionUi(e.target)) return;
      if (!modeless) {
        if (e.key !== "Escape" || closeDisabled) return;
        if (!overlayRegistrationRef.current?.isTopmost()) return;
        onClose();
        return;
      }
      if (e.key !== "Escape" || closeDisabled) return;
      if (!overlayRegistrationRef.current?.isTopmost()) return;
      // Sidebar keys belong to the sidebar; drag/menu cancellation may also consume Escape.
      if (e.defaultPrevented) return;
      const panel = panelRef.current;
      const targetInside = e.target instanceof Node && panel?.contains(e.target);
      if (!targetInside && !panel?.contains(document.activeElement)) return;
      onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose, closeDisabled, modeless]);

  // Remove from DOM after exit animation completes. A reopen during the exit (focus is already back on the opener)
  // keeps it: the late transitionend or the fallback below must not unmount an open dialog.
  const handleAnimationEnd = () => {
    if (animating === "exit" && !open) {
      setMounted(false);
      setAnimating(null);
    }
  };

  // Fallback: browsers skip CSS transitions in hidden tabs, so transitionend
  // may never fire when a modal is closed programmatically while the tab is
  // backgrounded (e.g. a game starting auto-closes its setup). Without this
  // the overlay stays mounted forever and blocks clicks.
  useEffect(() => {
    if (animating !== "exit" || open) return;
    const timer = setTimeout(() => {
      setMounted(false);
      setAnimating(null);
    }, 400);
    return () => clearTimeout(timer);
  }, [animating, open]);

  // Phone sheet: pull down to close. Native listeners because React's touchmove is passive.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !mounted || !panel || !pullToClose || closeDisabled || mobileFullscreen || modeless || dragThrough)
      return;
    if (!window.matchMedia("(max-width: 639px)").matches) return;
    let startX = 0;
    let startY = 0;
    let startT = 0;
    let dy = 0;
    let tracking = false;
    let dragging = false;
    let prevTransition = "";
    const onStart = (e: TouchEvent) => {
      tracking = false;
      if (e.touches.length !== 1) return;
      const target = e.target as Element;
      if (target.closest("input, textarea, select, [contenteditable='true']")) return;
      // Only from the top: any scroller between the finger and the panel must be scrolled up.
      for (let el: Element | null = target; el && el !== panel; el = el.parentElement) if (el.scrollTop > 0) return;
      tracking = true;
      dragging = false;
      dy = 0;
      startX = e.touches[0]!.clientX;
      startY = e.touches[0]!.clientY;
      startT = e.timeStamp;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const d = e.touches[0]!.clientY - startY;
      if (!dragging) {
        if (d < 0 || Math.abs(e.touches[0]!.clientX - startX) > d) {
          tracking = false; // upward or sideways: leave it to scrolling
          return;
        }
        if (d < 8) return;
        dragging = true;
        prevTransition = panel.style.transition;
        panel.style.transition = "none";
      }
      e.preventDefault();
      dy = Math.max(0, d - 8);
      panel.style.transform = `translateY(${dy}px)`;
    };
    const onEnd = (e: TouchEvent) => {
      tracking = false;
      if (!dragging) return;
      dragging = false;
      panel.style.transition = prevTransition;
      const pulled = panel.style.transform; // browser read-back, so a fractional dy still matches
      if (dy > panel.offsetHeight * 0.25 || dy / Math.max(1, e.timeStamp - startT) > 0.4) {
        onCloseRef.current();
        // A guarded close (e.g. "Discard changes?") may keep the sheet open: then snap back.
        window.setTimeout(() => {
          if (panel.style.transform === pulled) panel.style.transform = "";
        }, 300);
      } else {
        panel.style.transform = "";
      }
    };
    panel.addEventListener("touchstart", onStart, { passive: true });
    panel.addEventListener("touchmove", onMove, { passive: false });
    panel.addEventListener("touchend", onEnd);
    panel.addEventListener("touchcancel", onEnd);
    return () => {
      panel.removeEventListener("touchstart", onStart);
      panel.removeEventListener("touchmove", onMove);
      panel.removeEventListener("touchend", onEnd);
      panel.removeEventListener("touchcancel", onEnd);
    };
  }, [open, mounted, pullToClose, closeDisabled, mobileFullscreen, modeless, dragThrough]);

  // Render in the same commit as `open`: a modal that replaces another must not leave a frame with neither.
  if (!mounted && !open) return null;

  const isEntering = animating === "enter";
  const backdropShown = isEntering || (instantBackdrop && animating !== "exit");
  // Below `sm` a plain dialog is a bottom sheet; full-screen, modeless and drag-through ones keep their shape.
  const sheet = !mobileFullscreen && !modeless && !dragThrough;
  const phoneSheet = sheet && window.matchMedia("(max-width: 639px)").matches;
  const pullClose = phoneSheet && pullToClose && !closeDisabled;

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal={modeless ? undefined : true}
      aria-label={labelledBy ? undefined : localizedTitle}
      aria-labelledby={labelledBy}
      data-chat-floating-panel={chatFloatingPanel ? "true" : undefined}
      data-component={dataComponent}
      className={`mari-modal${backdrop === "solid" ? " mari-modal--opaque" : ""} fixed inset-x-0 top-[var(--mari-visual-viewport-offset-top,0px)] h-[var(--mari-visual-viewport-height,100dvh)] ${layer === "top" ? "z-[calc(var(--mari-layer-omnibar)+1)]" : overOmnibar || layer === "omnibar" ? "z-(--mari-layer-omnibar)" : "z-[10000]"} flex items-center justify-center ${sheet ? "max-sm:items-end max-sm:p-0! max-sm:pt-[calc(env(safe-area-inset-top)+2.5rem)]!" : ""} ${dragThrough || modeless || animating === "exit" ? "pointer-events-none" : ""} ${modeless ? "pt-16! sm:pl-[var(--dialog-left)]! sm:pr-[var(--dialog-right)]!" : ""} ${
        mobileFullscreen
          ? "p-0 sm:p-4 sm:pl-[max(1rem,var(--mari-safe-area-inset-left))] sm:pr-[max(1rem,var(--mari-safe-area-inset-right))]"
          : "p-3 max-md:pt-[max(0.75rem,env(safe-area-inset-top))] max-md:pb-[max(0.75rem,var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom)))] sm:p-4 sm:pl-[max(1rem,var(--mari-safe-area-inset-left))] sm:pr-[max(1rem,var(--mari-safe-area-inset-right))]"
      }`}
      style={{
        ...(modeless
          ? ({
              // A modeless dialog stays clear of the docked sidebar, on whichever side it is (useDockedSidebarInset).
              "--dialog-left": `${dockedSidebar.left + 16}px`,
              "--dialog-right": `${dockedSidebar.right + 16}px`,
            } as CSSProperties)
          : {}),
        opacity: backdropShown ? 1 : 0,
        transition: "opacity 150ms ease-out",
      }}
      onTransitionEnd={handleAnimationEnd}
      {...(modeless ? {} : backdropDismiss)}
    >
      {/* Backdrop */}
      {!modeless && (
        <div
          data-backdrop-dismiss-surface="true"
          className={`mari-modal-backdrop absolute inset-0 ${backdrop === "dark" ? "bg-black/80" : backdrop === "none" ? "" : "bg-black/55 backdrop-blur-[2px]"}`}
          style={{
            opacity: backdropShown ? 1 : 0,
            transition: "opacity 150ms ease-out",
          }}
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`mari-modal-panel ${NEUTRAL_PANEL_SHELL} relative flex w-full flex-col ${dragThrough || modeless ? "pointer-events-auto" : ""} ${modeless ? "max-h-[calc(var(--mari-visual-viewport-height,100dvh)-5rem)]!" : ""} ${width} max-h-[calc(var(--mari-visual-viewport-height,100dvh)-1.5rem)] sm:max-h-[min(calc(var(--mari-visual-viewport-height,100dvh)*0.9),52rem)]${
          mobileFullscreen
            ? " max-sm:h-full max-sm:max-h-none max-sm:max-w-none max-sm:rounded-none max-sm:border-0 max-sm:pt-[env(safe-area-inset-top)] max-sm:pb-[var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom))]"
            : ""
        } ${sheet ? PHONE_BOTTOM_SHEET_CLASS : ""} ${panelClassName ?? ""}`}
        style={{
          ...panelStyle,
          // The shell's unlayered message-in keyframe would override this inline slide on phones.
          animation: phoneSheet || fadeOnly ? "none" : undefined,
          opacity: isEntering ? 1 : 0,
          // Settle at `none`: an identity transform keeps the entire image library in a composited layer.
          transform: isEntering
            ? undefined
            : phoneSheet
              ? "translateY(100%)"
              : fadeOnly
                ? undefined
                : "scale(0.97) translateY(6px)",
          transition: phoneSheet
            ? "opacity 150ms ease-out, transform 220ms cubic-bezier(0.32, 0.72, 0, 1)"
            : "opacity 150ms ease-out, transform 150ms ease-out",
        }}
      >
        {pullClose && <div aria-hidden="true" className={`${SHEET_GRABBER_CLASS} sm:hidden`} />}
        {/* Header */}
        {!hideHeader && (
          <div
            className={`shrink-0 flex items-center justify-between ${NEUTRAL_PANEL_HEADER} ${sheet && !titleSlot ? "max-sm:relative max-sm:min-h-13 max-sm:justify-center max-sm:px-12" : ""}`}
          >
            {titleSlot ?? (
              <h2
                className={`${NEUTRAL_PANEL_TITLE} ${sheet ? "max-sm:justify-center max-sm:text-center max-sm:text-[17px]" : ""}`}
              >
                {localizedTitle}
              </h2>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={closeDisabled}
              aria-label={localizeUi("ui.ui.modal.value1Value2", { value1: localize("Close"), value2: localizedTitle })}
              className={`flex shrink-0 items-center justify-center rounded-lg p-1.5 text-[var(--marinara-chat-chrome-panel-muted)] transition-colors max-md:h-9 max-md:w-9 [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:w-9 hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] hover:text-[var(--marinara-chat-chrome-highlight-text)] disabled:cursor-wait disabled:opacity-40 ${sheet ? SHEET_CLOSE_BUTTON_CLASS : "max-sm:after:absolute max-sm:after:-inset-1 max-sm:after:content-['']"} ${sheet && !titleSlot ? "max-sm:absolute max-sm:right-3 max-sm:top-1/2 max-sm:-translate-y-1/2" : "max-sm:relative"} ${closeButtonClassName ?? ""}`}
            >
              <X size="1rem" />
            </button>
          </div>
        )}

        {/* Content */}
        <div
          ref={contentRef}
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 ${NEUTRAL_PANEL_SCROLL_AREA} ${contentClassName ?? ""}`}
        >
          <InsideModalContext.Provider value>{children}</InsideModalContext.Provider>
        </div>
        {footer && (
          <div className="flex shrink-0 flex-row-reverse items-center justify-start gap-2 border-t border-[var(--marinara-chat-chrome-panel-divider)] px-5 py-3 max-sm:flex-col max-sm:items-stretch max-sm:px-4 max-sm:[&>button]:min-h-12 max-sm:[&>button]:justify-center">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
