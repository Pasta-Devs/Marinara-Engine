// ──────────────────────────────────────────────
// UiStyleEditorCard: the floating editor for one picked interface region or block.
// Edits preview live and only persist on Save (like TrackerCardColorSettings).
// Desktop: a draggable card placed beside the region. Phone: a sheet docked at the
// bottom, or at the top when the edited part sits in the lower half.
// ──────────────────────────────────────────────
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, GripVertical, MousePointerClick, Save, X } from "lucide-react";
import { MOBILE_SHELL_MEDIA_QUERY, isMobileShellViewport, useUIStore } from "../../stores/ui.store";
import {
  UI_STYLE_LIMITS,
  UI_STYLE_EDITOR_ATTRIBUTE,
  UI_STYLE_SHADOWS,
  getUiStyleTarget,
  normalizeUiStyleOverride,
  savedUiStyleTargets,
  serializeUiStyleOverride,
  uiStyleTargetLabel,
  type UiStyleOverride,
  type UiStyleShadow,
  type UiStyleTarget,
  type UiStyleTargetId,
} from "../../lib/ui-style-overrides";
import { ColorPicker } from "../ui/ColorPicker";
import { cn } from "../../lib/utils";
import {
  SETTINGS_BUTTON_CLASS,
  SETTINGS_COMPACT_PRIMARY_BUTTON_CLASS,
  SETTINGS_ICON_BUTTON_CLASS,
} from "../panels/settings/SettingControls";
import { UiStylePartSelect } from "../panels/settings/UiStyleSettings";

type ColorKey = "background" | "color" | "borderColor";
type NumberKey = "borderRadius" | "borderWidth" | "opacity" | "blur" | "fontSize";

const COLOR_FIELDS: { key: ColorKey; labelKey: string; gradient?: boolean }[] = [
  { key: "background", labelKey: "settings.appearance.uiStyles.background", gradient: true },
  { key: "color", labelKey: "settings.appearance.uiStyles.textColor" },
  { key: "borderColor", labelKey: "settings.appearance.uiStyles.borderColor" },
];

/** `fallback` is only where the slider rests while the property is unset ("Default"). */
const NUMBER_FIELDS: { key: NumberKey; labelKey: string; unit: string; fallback: number }[] = [
  { key: "borderRadius", labelKey: "settings.appearance.uiStyles.borderRadius", unit: "px", fallback: 8 },
  { key: "borderWidth", labelKey: "settings.appearance.uiStyles.borderWidth", unit: "px", fallback: 1 },
  { key: "opacity", labelKey: "settings.appearance.uiStyles.opacity", unit: "%", fallback: 100 },
  { key: "blur", labelKey: "settings.appearance.uiStyles.blur", unit: "px", fallback: 0 },
  { key: "fontSize", labelKey: "settings.appearance.uiStyles.fontSize", unit: "px", fallback: 14 },
];

const SHADOW_IDS = Object.keys(UI_STYLE_SHADOWS) as UiStyleShadow[];
const ROW_CLASS =
  "grid min-w-0 items-center gap-1.5 rounded-md bg-[var(--background)]/24 px-1.5 py-1 ring-1 ring-[var(--border)]/25";
const ROW_LABEL_CLASS = "truncate text-[0.5625rem] font-semibold text-[var(--foreground)]/80";
const HINT_CLASS = "text-[0.625rem] text-[var(--muted-foreground)]";

const MARGIN = 12;
const CHECKERBOARD: CSSProperties = {
  backgroundImage: "repeating-conic-gradient(var(--border) 0% 25%, transparent 0% 50%)",
  backgroundSize: "0.5rem 0.5rem",
};

interface Size {
  width: number;
  height: number;
}
interface Point {
  x: number;
  y: number;
}

function clampPoint(point: Point, { width, height }: Size): Point {
  return {
    x: Math.max(MARGIN, Math.min(point.x, window.innerWidth - width - MARGIN)),
    y: Math.max(MARGIN, Math.min(point.y, window.innerHeight - height - MARGIN)),
  };
}

/** Matches on the page, never the editor's own controls (a block class can name those too). */
function pageMatches(selector: string): Element[] {
  return Array.from(document.querySelectorAll(selector)).filter(
    (element) => !element.closest(`[${UI_STYLE_EDITOR_ATTRIBUTE}]`),
  );
}

/**
 * What the card says about the screen. A block restyles every element with its class, across the app,
 * so it says how far it reaches here. A part only says when it is not on this screen; a pop-up or toast
 * is absent until it opens. An open chat paints its own background over the app's, so the whole-app
 * part offers the chat's surface part instead.
 */
function scanScreen(id: UiStyleTargetId): { reach: number | null; chatSurfaceId?: UiStyleTargetId } {
  const target = getUiStyleTarget(id);
  if (!target) return { reach: null };
  const reach = target.className
    ? pageMatches(target.selector).length
    : target.transient || document.querySelector(target.selector)
      ? null
      : 0;
  const chatSurfaceId =
    id === "app"
      ? (["conversation-surface", "roleplay-surface"] as const).find((surface) => {
          const part = getUiStyleTarget(surface);
          return part && document.querySelector(part.selector);
        })
      : undefined;
  return { reach, chatSurfaceId };
}

/** The match under the pick point (a block class matches many), else the first one. */
function anchorRect(selector: string, anchor: Point | null): DOMRect | undefined {
  const rects = pageMatches(selector).map((element) => element.getBoundingClientRect());
  const under =
    anchor &&
    rects.find(
      (rect) => anchor.x >= rect.left && anchor.x <= rect.right && anchor.y >= rect.top && anchor.y <= rect.bottom,
    );
  return under || rects[0];
}

/** Phone: dock the sheet at the top when the part's visible middle is in the lower half, so it stays in view. */
function dockAtTop(region: DOMRect | undefined): boolean {
  if (!region || region.width <= 0 || region.height <= 0) return false;
  const top = Math.max(region.top, 0);
  const bottom = Math.min(region.bottom, window.innerHeight);
  return bottom > top && (top + bottom) / 2 > window.innerHeight / 2;
}

/** Beside the region when there is room to its right or left, else the viewport's top-right corner. */
function placeCard(size: Size, region: DOMRect | undefined): Point {
  const topRight = { x: window.innerWidth - size.width - MARGIN, y: MARGIN };
  const visible =
    region &&
    region.width > 0 &&
    region.height > 0 &&
    region.right > 0 &&
    region.left < window.innerWidth &&
    region.bottom > 0 &&
    region.top < window.innerHeight;
  if (!visible) return clampPoint(topRight, size);
  if (region.right + MARGIN + size.width <= window.innerWidth - MARGIN) {
    return clampPoint({ x: region.right + MARGIN, y: region.top }, size);
  }
  if (region.left - MARGIN - size.width >= MARGIN) {
    return clampPoint({ x: region.left - MARGIN - size.width, y: region.top }, size);
  }
  return clampPoint(topRight, size);
}

function StyleChip({ style }: { style: UiStyleOverride }) {
  const { t } = useTranslation();
  return (
    <span
      aria-hidden="true"
      className="grid h-6 w-10 shrink-0 place-items-center overflow-hidden text-[0.625rem] font-semibold ring-1 ring-[var(--border)]"
      style={{
        background: style.background,
        color: style.color ?? "var(--foreground)",
        borderRadius: Math.min(style.borderRadius ?? 6, 12),
        ...(style.borderColor && { border: `1px solid ${style.borderColor}` }),
        ...(style.shadow && { boxShadow: UI_STYLE_SHADOWS[style.shadow] }),
      }}
    >
      {t("settings.appearance.uiStyles.sampleText")}
    </span>
  );
}

// The card remounts per part (keyed by target), so switching with its select would drop keyboard focus.
let refocusPartSelect = false;

/** `levels`: what the pick could restyle, outermost first; the card's breadcrumb switches between them. */
export function UiStyleEditorCard({
  target,
  levels,
  anchor,
}: {
  target: UiStyleTarget;
  levels: UiStyleTargetId[];
  /** Where the pick landed, so the card follows the element tapped rather than the class's first match. */
  anchor: Point | null;
}) {
  const { t } = useTranslation();
  const saved = useUIStore((s) => s.uiStyleOverrides);
  const saveOverride = useUIStore((s) => s.saveUiStyleOverride);
  const setPickMode = useUIStore((s) => s.setUiStylePickMode);
  const setSelectedTarget = useUIStore((s) => s.setUiStyleSelectedTarget);
  const setPreview = useUIStore((s) => s.setUiStylePreview);

  const regionName = uiStyleTargetLabel(target, t);
  const crumbs = levels.map((id) => getUiStyleTarget(id)).filter((level) => level !== null);
  // Rescanned as the page changes (a panel opens, a chat closes), throttled to one scan a frame.
  const [screen, setScreen] = useState(() => scanScreen(target.id));
  useEffect(() => {
    let frame = 0;
    const observer = new MutationObserver(() => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const next = scanScreen(target.id);
        setScreen((current) =>
          current.reach === next.reach && current.chatSurfaceId === next.chatSurfaceId ? current : next,
        );
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [target.id]);
  const { reach } = screen;
  const chatSurface = getUiStyleTarget(screen.chatSurfaceId);
  const savedOverride = saved[target.id] ?? null;
  // The card is keyed to its region, so the edit never outlives it.
  const [edit, setEdit] = useState<UiStyleOverride | null>(null);
  const draft: UiStyleOverride = edit ?? savedOverride ?? {};
  const dirty = serializeUiStyleOverride(draft) !== serializeUiStyleOverride(savedOverride);
  const [panel, setPanel] = useState<ColorKey | "copy" | null>(null);
  const copySources = savedUiStyleTargets(saved).filter((other) => other.id !== target.id);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<Point | null>(null);
  const [pos, setPos] = useState<Point | null>(null);
  const [mobile, setMobile] = useState(isMobileShellViewport);
  const [dockTop, setDockTop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(MOBILE_SHELL_MEDIA_QUERY);
    const sync = () => setMobile(isMobileShellViewport());
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // The live preview mirrors the draft and ends with the card.
  useEffect(() => {
    setPreview(dirty ? { target: target.id, override: draft } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `draft` changes only with `edit` or `saved`
  }, [target.id, dirty, edit, saved, setPreview]);
  useEffect(() => () => setPreview(null), [setPreview]);

  useLayoutEffect(() => {
    if (refocusPartSelect) cardRef.current?.querySelector("select")?.focus();
    refocusPartSelect = false;
  }, []);

  // Place once beside the region; afterwards keep the card inside the viewport as it resizes.
  // Phone: pick the sheet's edge once, so it never jumps while editing.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const region = anchorRect(target.selector, anchor);
    if (mobile) setDockTop(dockAtTop(region));
    else setPos(placeCard(card.getBoundingClientRect(), region));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- placed once per card; the anchor is fixed for its life
  }, [mobile, target.selector]);
  useEffect(() => {
    const card = cardRef.current;
    if (!card || mobile) return;
    const reclamp = () =>
      setPos((current) => {
        if (!current) return current;
        const next = clampPoint(current, card.getBoundingClientRect());
        return next.x === current.x && next.y === current.y ? current : next;
      });
    const observer = new ResizeObserver(reclamp);
    observer.observe(card);
    window.addEventListener("resize", reclamp);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", reclamp);
    };
  }, [mobile]);

  const requestClose = () => {
    if (dirty && !window.confirm(t("settings.appearance.uiStyles.discardConfirm"))) return;
    setPreview(null);
    setSelectedTarget(null);
  };
  const closeRef = useRef(requestClose);
  closeRef.current = requestClose;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || useUIStore.getState().uiStylePickMode) return;
      // Only when focus is in the card or nowhere, so Escape still belongs to other dialogs.
      const origin = event.target as Node | null;
      if (origin !== document.body && !(origin && cardRef.current?.contains(origin))) return;
      event.preventDefault();
      closeRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const updateField = (key: keyof UiStyleOverride, value: string | number | undefined) => {
    const next = { ...draft };
    if (value === undefined || value === "") delete next[key];
    else (next as Record<string, string | number>)[key] = value;
    setEdit(next);
  };
  const handleSave = () => {
    saveOverride(target.id, draft);
    setEdit(null);
    setPreview(null);
  };
  const handleResetRegion = () => {
    saveOverride(target.id, null);
    setEdit(null);
    setPreview(null);
  };
  const handlePickAnother = () => {
    setSelectedTarget(null);
    setPickMode(true);
  };
  const copyFrom = (style: UiStyleOverride) => {
    setEdit({ ...style });
    setPanel(null);
  };

  const onDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card || mobile || event.button !== 0 || (event.target as HTMLElement).closest("button, select")) return;
    const rect = card.getBoundingClientRect();
    dragRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    const grab = dragRef.current;
    if (card && grab) {
      setPos(clampPoint({ x: event.clientX - grab.x, y: event.clientY - grab.y }, card.getBoundingClientRect()));
    }
  };
  const onDragEnd = () => {
    dragRef.current = null;
  };

  return createPortal(
    <div
      ref={cardRef}
      role="dialog"
      aria-label={regionName}
      {...{ [UI_STYLE_EDITOR_ATTRIBUTE]: "" }}
      // `--sidebar` is the opaque shell surface; `--card` is translucent and the page would show through.
      className={cn(
        "fixed flex flex-col border border-[var(--border)] bg-[var(--sidebar)] text-[var(--foreground)] shadow-2xl",
        !mobile
          ? "max-h-[80vh] w-[20rem] max-w-[calc(100vw-1.5rem)] rounded-xl"
          : dockTop
            ? "inset-x-0 top-0 max-h-[55vh] rounded-b-2xl pt-[env(safe-area-inset-top)]"
            : "inset-x-0 bottom-0 max-h-[55vh] rounded-t-2xl pb-[var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom))]",
      )}
      // One layer under the pick overlay, which must stay on top for "Pick on screen".
      style={{
        zIndex: "calc(var(--mari-layer-omnibar) + 1)",
        ...(!mobile && { left: pos?.x ?? 0, top: pos?.y ?? 0, visibility: pos ? "visible" : "hidden" }),
      }}
    >
      <div
        className={cn(
          "flex shrink-0 items-center gap-1 border-b border-[var(--border)] px-2 py-1.5 select-none",
          !mobile && "cursor-grab touch-none active:cursor-grabbing",
        )}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        {!mobile && <GripVertical size="0.875rem" className="shrink-0 text-[var(--muted-foreground)]" />}
        <UiStylePartSelect
          value={target.id}
          onChange={(id) => {
            refocusPartSelect = true;
            setSelectedTarget(id);
          }}
          disabled={dirty}
          className="min-w-0 text-xs font-semibold"
        />
        <button
          type="button"
          onClick={handlePickAnother}
          disabled={dirty}
          aria-label={t("settings.appearance.uiStyles.pickAnother")}
          title={t("settings.appearance.uiStyles.pickAnother")}
          className={SETTINGS_ICON_BUTTON_CLASS}
        >
          <MousePointerClick size="0.75rem" />
        </button>
        <button
          type="button"
          onClick={requestClose}
          aria-label={t("settings.appearance.uiStyles.closeEditor")}
          title={t("settings.appearance.uiStyles.closeEditor")}
          className={SETTINGS_ICON_BUTTON_CLASS}
        >
          <X size="0.75rem" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5">
        {dirty && <p className={HINT_CLASS}>{t("settings.appearance.uiStyles.saveOrRevertFirst")}</p>}
        <div className="flex min-w-0 items-center gap-2">
          <StyleChip style={draft} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {crumbs.length > 1 && (
              <nav
                aria-label={t("settings.appearance.uiStyles.levels")}
                className="flex min-w-0 flex-wrap items-center gap-x-0.5 text-xs"
              >
                {crumbs.map((level, index) => {
                  const current = level.id === target.id;
                  return (
                    <span key={level.id} className="flex min-w-0 max-w-full items-center gap-0.5">
                      {index > 0 && (
                        <span aria-hidden="true" className="text-[var(--muted-foreground)]">
                          ›
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedTarget(level.id)}
                        disabled={current || dirty}
                        aria-current={current ? "true" : undefined}
                        title={uiStyleTargetLabel(level, t)}
                        className={cn(
                          "min-w-0 truncate rounded px-1 py-0.5",
                          current
                            ? "font-semibold text-[var(--foreground)]"
                            : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:hover:bg-transparent",
                        )}
                      >
                        {uiStyleTargetLabel(level, t)}
                      </button>
                    </span>
                  );
                })}
              </nav>
            )}
            {reach !== null && (
              <p className={HINT_CLASS}>
                {reach > 0
                  ? t("settings.appearance.uiStyles.reach", { count: reach })
                  : t("settings.appearance.uiStyles.notOnScreen")}
              </p>
            )}
          </div>
        </div>
        {chatSurface && (
          <div className="flex min-w-0 flex-col items-start gap-1">
            <p className={HINT_CLASS}>{t("settings.appearance.uiStyles.chatCoversApp")}</p>
            <button
              type="button"
              onClick={() => setSelectedTarget(chatSurface.id)}
              disabled={dirty}
              className={SETTINGS_BUTTON_CLASS}
            >
              {t("settings.appearance.uiStyles.styleChatSurface", { part: uiStyleTargetLabel(chatSurface, t) })}
            </button>
          </div>
        )}
        <div className="grid grid-cols-3 gap-1.5">
          {COLOR_FIELDS.map((field) => {
            const value = draft[field.key];
            const label = t(field.labelKey);
            return (
              <button
                key={field.key}
                type="button"
                aria-expanded={panel === field.key}
                title={t("settings.appearance.uiStyles.swatchTitle", {
                  label,
                  value: value || t("settings.appearance.uiStyles.themeDefault"),
                })}
                onClick={() => setPanel(panel === field.key ? null : field.key)}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-1.5 transition-colors hover:border-[var(--primary)]/40",
                  panel === field.key && "border-[var(--primary)]/50 ring-1 ring-[var(--primary)]/25",
                )}
              >
                <span
                  className="h-6 w-full rounded-md ring-1 ring-[var(--border)]"
                  style={value ? { background: value } : CHECKERBOARD}
                />
                <span className="w-full truncate text-center text-[0.625rem] text-[var(--muted-foreground)]">
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {COLOR_FIELDS.map(
          (field) =>
            panel === field.key && (
              <ColorPicker
                key={field.key}
                compact
                panelOnly
                gradient={field.gradient}
                label={t(field.labelKey)}
                value={draft[field.key] ?? ""}
                onChange={(value) => updateField(field.key, value)}
                helpText={
                  draft[field.key] && !normalizeUiStyleOverride({ [field.key]: draft[field.key] })
                    ? t("settings.appearance.uiStyles.invalidColor")
                    : undefined
                }
                emptyText={t("settings.appearance.uiStyles.themeDefault")}
                clearLabel={t("settings.appearance.uiStyles.useDefault")}
              />
            ),
        )}

        <div className="grid min-w-0 gap-1">
          {NUMBER_FIELDS.map((field) => {
            const value = draft[field.key];
            const [min, max] = UI_STYLE_LIMITS[field.key];
            const label = t(field.labelKey);
            const valueText =
              value === undefined ? t("settings.appearance.uiStyles.themeDefault") : String(value) + field.unit;
            return (
              <div key={field.key} className={cn(ROW_CLASS, "grid-cols-[5rem_minmax(0,1fr)_3rem_1.5rem]")}>
                <span className={ROW_LABEL_CLASS} title={label}>
                  {label}
                </span>
                <input
                  type="range"
                  aria-label={label}
                  min={min}
                  max={max}
                  value={value ?? field.fallback}
                  onChange={(event) => updateField(field.key, Number(event.target.value))}
                  className="h-1.5 w-full min-w-0 cursor-pointer accent-[var(--primary)]"
                />
                <span className="justify-self-end font-mono text-[0.5625rem] tabular-nums text-[var(--muted-foreground)]">
                  {valueText}
                </span>
                <button
                  type="button"
                  aria-label={t("settings.appearance.uiStyles.useDefault")}
                  title={t("settings.appearance.uiStyles.useDefault")}
                  onClick={() => updateField(field.key, undefined)}
                  disabled={value === undefined}
                  className={SETTINGS_ICON_BUTTON_CLASS}
                >
                  <X size="0.75rem" />
                </button>
                {field.key === "blur" && !!value && (
                  <span className="col-span-full text-[0.5625rem] text-[var(--muted-foreground)]">
                    {t("settings.appearance.uiStyles.blurHint")}
                  </span>
                )}
              </div>
            );
          })}
          <div className={cn(ROW_CLASS, "grid-cols-[5rem_minmax(0,1fr)_1.5rem]")}>
            <span className={ROW_LABEL_CLASS}>{t("settings.appearance.uiStyles.shadow")}</span>
            <div role="group" aria-label={t("settings.appearance.uiStyles.shadow")} className="grid grid-cols-5 gap-1">
              {SHADOW_IDS.map((id) => {
                const name = t(`settings.appearance.uiStyles.shadows.${id}`);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={draft.shadow === id}
                    aria-label={name}
                    title={name}
                    onClick={() => updateField("shadow", id)}
                    className={cn(
                      // A fixed light well, so a dark shadow reads in either theme (like the checkerboard).
                      "grid h-7 place-items-center rounded-md bg-neutral-200 ring-1 ring-[var(--border)] transition-shadow hover:ring-[var(--primary)]/50",
                      draft.shadow === id && "ring-2 ring-[var(--primary)]",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="h-3.5 w-5 rounded-sm bg-white"
                      style={{ boxShadow: UI_STYLE_SHADOWS[id] }}
                    />
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              aria-label={t("settings.appearance.uiStyles.useDefault")}
              title={t("settings.appearance.uiStyles.useDefault")}
              onClick={() => updateField("shadow", undefined)}
              disabled={draft.shadow === undefined}
              className={SETTINGS_ICON_BUTTON_CLASS}
            >
              <X size="0.75rem" />
            </button>
          </div>
        </div>

        <button
          type="button"
          aria-expanded={panel === "copy"}
          onClick={() => setPanel(panel === "copy" ? null : "copy")}
          disabled={copySources.length === 0}
          className={cn(SETTINGS_BUTTON_CLASS, "w-full justify-between")}
        >
          <span className="truncate">{t("settings.appearance.uiStyles.copyFrom")}</span>
          <ChevronDown
            size="0.75rem"
            className={cn("shrink-0 transition-transform", panel === "copy" && "rotate-180")}
          />
        </button>

        {copySources.length === 0 && <p className={HINT_CLASS}>{t("settings.appearance.uiStyles.copyFromEmpty")}</p>}
        {panel === "copy" && (
          <div className="grid max-h-36 min-w-0 gap-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--secondary)]/55 p-1">
            {copySources.map((other) => (
              <button
                key={other.id}
                type="button"
                onClick={() => copyFrom(saved[other.id] ?? {})}
                className="flex min-w-0 items-center gap-2 rounded-md p-1 text-left text-[0.6875rem] hover:bg-[var(--accent)]"
              >
                <StyleChip style={saved[other.id] ?? {}} />
                <span className="min-w-0 truncate">{uiStyleTargetLabel(other, t)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-1 border-t border-[var(--border)] px-2.5 py-2">
        {dirty && (
          <span className="mr-auto text-[0.625rem] text-[var(--muted-foreground)]">
            {t("settings.appearance.uiStyles.unsavedPreview")}
          </span>
        )}
        <button
          type="button"
          onClick={handleResetRegion}
          disabled={!savedOverride && !dirty}
          className={SETTINGS_BUTTON_CLASS}
        >
          {t("settings.appearance.uiStyles.resetRegion")}
        </button>
        <button type="button" onClick={() => setEdit(null)} disabled={!dirty} className={SETTINGS_BUTTON_CLASS}>
          {t("settings.appearance.uiStyles.revert")}
        </button>
        <button type="button" onClick={handleSave} disabled={!dirty} className={SETTINGS_COMPACT_PRIMARY_BUTTON_CLASS}>
          <Save size="0.75rem" />
          {t("settings.appearance.uiStyles.save")}
        </button>
      </div>
    </div>,
    document.body,
  );
}
