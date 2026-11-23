import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ArrowLeft, ChevronDown, ImagePlus, Plus, Upload, X } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { IMAGE_REFERENCE_ROLES, MAX_IMAGE_REFERENCE_PICTURES, type ImageReferenceRole } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { moveImageReference, sentImageReferences } from "../../lib/image-references";

/** A picture the image model is sent, in send order, with what it is for. */
export type PickedImageReference = {
  /** Where it came from, so the chooser can mark it as added: "avatar", "gallery:<id>", "upload:<n>"… */
  key: string;
  url: string;
  label: string;
  role: ImageReferenceRole;
};

/** 4.5rem tiles; phones fit three to a row across the whole width, so a job name like "Likeness" fits. */
const TILE_WIDTH = "w-[4.5rem] max-sm:w-[calc((100%-1rem)/3)]";
const TILE = "aspect-square w-full";
const DRAG_START_DISTANCE = 6;

type DragState = { from: number; over: number; dx: number; dy: number; startX: number; startY: number; moved: boolean };

/**
 * The References row of an image generation window: numbered tiles in send order, each with a job, remove
 * and drag (or arrow keys) to reorder. Pictures past what the connection takes stay, greyed as "Not sent".
 */
export function ImageReferenceRow({
  references,
  onChange,
  limit,
  disabled = false,
  dropActive = false,
  onAdd,
}: {
  references: PickedImageReference[];
  onChange: (next: PickedImageReference[]) => void;
  /** How many the connection sends; null while unknown. */
  limit: number | null;
  disabled?: boolean;
  /** Files are being dragged over the window. */
  dropActive?: boolean;
  onAdd: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const tileRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const count = references.length;
  const unsupported = limit === 0;
  const overLimit = limit !== null && limit > 0 && count > limit;
  const room = MAX_IMAGE_REFERENCE_PICTURES - count;

  const countText = unsupported
    ? localizeUi("ui.ui.imagereferencepicker.notUsed")
    : limit === null
      ? localizeUi("ui.ui.imagereferencepicker.countPicked", { count })
      : overLimit
        ? localizeUi("ui.ui.imagereferencepicker.countSent", { count, limit })
        : localizeUi("ui.ui.imagereferencepicker.countOfLimit", { count, limit });

  const setRole = (index: number, role: ImageReferenceRole) =>
    onChange(references.map((reference, i) => (i === index ? { ...reference, role } : reference)));

  const tileIndexAt = (x: number, y: number): number => {
    let best = -1;
    let bestDistance = Infinity;
    tileRefs.current.forEach((tile, index) => {
      if (!tile || index >= references.length) return;
      const rect = tile.getBoundingClientRect();
      const distance = Math.hypot(rect.left + rect.width / 2 - x, rect.top + rect.height / 2 - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    if (disabled || event.button !== 0) return;
    // A mouse drag would otherwise select the window's text; the tile still takes focus for the arrow keys.
    if (event.pointerType === "mouse") {
      event.preventDefault();
      event.currentTarget.focus();
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ from: index, over: index, dx: 0, dy: 0, startX: event.clientX, startY: event.clientY, moved: false });
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const moved = drag.moved || Math.hypot(dx, dy) > DRAG_START_DISTANCE;
    if (!moved) return;
    const over = tileIndexAt(event.clientX, event.clientY);
    setDrag({ ...drag, dx, dy, moved, over: over < 0 ? drag.over : over });
  };
  const finishDrag = () => {
    if (drag?.moved && drag.over !== drag.from) onChange(moveImageReference(references, drag.from, drag.over));
    setDrag(null);
  };
  const onTileKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step =
      event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : event.key === "ArrowRight" || event.key === "ArrowDown"
          ? 1
          : 0;
    if (!step || disabled) return;
    const to = index + step;
    if (to < 0 || to >= references.length) return;
    event.preventDefault();
    onChange(moveImageReference(references, index, to));
    requestAnimationFrame(() =>
      tileRefs.current[to]?.querySelector<HTMLButtonElement>("[data-reference-move]")?.focus(),
    );
  };

  return (
    <section
      data-image-references=""
      aria-label={localizeUi("ui.ui.imagereferencepicker.references")}
      className={cn(
        "relative space-y-2.5 rounded-lg bg-[var(--secondary)]/60 p-2.5 ring-1 ring-[var(--border)]/60",
        dropActive && "ring-2 ring-[var(--primary)]",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-xs font-medium text-[var(--foreground)]">
          {localizeUi("ui.ui.imagereferencepicker.references")}
        </span>
        <span className="text-[0.6875rem] tabular-nums text-[var(--muted-foreground)] max-sm:text-[13px]">
          {countText}
        </span>
      </div>

      <ol className={cn("flex flex-wrap gap-2", unsupported && count > 0 && "opacity-45 grayscale")}>
        {references.map((reference, index) => {
          const notSent = limit !== null && limit > 0 && index >= limit;
          const dragging = drag?.moved && drag.from === index;
          const dropTarget = drag?.moved && drag.over === index && drag.from !== index;
          return (
            <li
              key={reference.key}
              ref={(node) => {
                tileRefs.current[index] = node;
              }}
              data-reference-tile=""
              data-not-sent={notSent ? "" : undefined}
              className={cn("relative flex flex-col gap-1.5", TILE_WIDTH)}
            >
              <div
                className={cn(
                  "relative overflow-hidden rounded-lg bg-[var(--secondary)] ring-1 ring-[var(--border)]",
                  TILE,
                  dropTarget && "ring-2 ring-[var(--primary)]",
                  dragging && "z-10 shadow-lg ring-2 ring-[var(--primary)]",
                )}
                style={dragging ? { transform: `translate(${drag!.dx}px, ${drag!.dy}px) rotate(-3deg)` } : undefined}
              >
                <button
                  type="button"
                  data-reference-move=""
                  disabled={disabled}
                  aria-label={localizeUi("ui.ui.imagereferencepicker.pictureLabel", {
                    number: index + 1,
                    name: reference.label,
                  })}
                  title={reference.label}
                  onPointerDown={(event) => onPointerDown(event, index)}
                  onPointerMove={onPointerMove}
                  onPointerUp={finishDrag}
                  onPointerCancel={() => setDrag(null)}
                  onKeyDown={(event) => onTileKeyDown(event, index)}
                  className="block h-full w-full cursor-grab touch-none select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--primary)] active:cursor-grabbing disabled:cursor-default"
                >
                  <img
                    src={reference.url}
                    alt=""
                    draggable={false}
                    className={cn("h-full w-full object-cover", notSent && "opacity-35 grayscale")}
                  />
                </button>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1 top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-black/70 px-1 text-[0.625rem] font-semibold tabular-nums text-white"
                >
                  {index + 1}
                </span>
                {notSent && (
                  <span className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 rounded bg-black/80 px-1 py-0.5 text-center text-[0.625rem] font-semibold leading-tight text-white ring-1 ring-[var(--warning)]">
                    {localizeUi("ui.ui.imagereferencepicker.notSent")}
                  </span>
                )}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(references.filter((_, i) => i !== index))}
                  aria-label={localizeUi("ui.ui.imagereferencepicker.remove", { name: reference.label })}
                  title={localizeUi("ui.ui.imagereferencepicker.remove", { name: reference.label })}
                  className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white after:absolute after:-inset-2.5 after:content-[''] disabled:opacity-50 [@media(hover:hover)]:hover:bg-black/90"
                >
                  <X size="0.75rem" />
                </button>
              </div>
              <span className="relative block">
                <select
                  value={reference.role}
                  disabled={disabled}
                  onChange={(event) => setRole(index, event.target.value as ImageReferenceRole)}
                  aria-label={localizeUi("ui.ui.imagereferencepicker.jobLabel", { number: index + 1 })}
                  className={cn(
                    "mari-chrome-field block h-7 min-h-0 w-full appearance-none truncate rounded-md py-0 pl-1.5 pr-5 text-[0.6875rem] max-sm:text-[13px] [@media(pointer:coarse)]:h-11",
                    notSent && "opacity-50",
                  )}
                >
                  {IMAGE_REFERENCE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {localizeUi(`ui.ui.imagereferencepicker.role.${role}`)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size="0.75rem"
                  aria-hidden="true"
                  className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                />
              </span>
            </li>
          );
        })}
        {room > 0 && (
          <li className={cn("flex flex-col", TILE_WIDTH)}>
            <button
              type="button"
              onClick={onAdd}
              disabled={disabled}
              data-reference-add=""
              className={cn(
                "inline-flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border)] text-[0.6875rem] text-[var(--muted-foreground)] transition-colors disabled:opacity-50 max-sm:text-[13px] [@media(hover:hover)]:hover:border-[var(--primary)] [@media(hover:hover)]:hover:text-[var(--foreground)]",
                TILE,
              )}
            >
              <Plus size="1.125rem" className="text-[var(--primary)]" />
              {localizeUi("ui.ui.imagereferencepicker.add")}
            </button>
          </li>
        )}
      </ol>

      {unsupported ? (
        <p
          role="note"
          className="rounded-md bg-[var(--destructive)]/10 px-2.5 py-2 text-[0.6875rem] leading-relaxed text-[var(--foreground)] ring-1 ring-[var(--destructive)]/30 max-sm:text-[13px]"
        >
          {localizeUi("ui.ui.imagereferencepicker.unsupportedNote")}
        </p>
      ) : overLimit ? (
        <div
          role="note"
          data-reference-limit-note=""
          className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[var(--warning)]/12 px-2.5 py-2 ring-1 ring-[var(--warning)]/40"
        >
          <p className="min-w-0 flex-[1_1_14rem] text-[0.6875rem] leading-relaxed text-[var(--foreground)] max-sm:text-[13px]">
            {localizeUi("ui.ui.imagereferencepicker.limitNote", { count: limit })}
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(sentImageReferences(references, limit))}
            className="inline-flex min-h-7 shrink-0 items-center rounded-md bg-[var(--secondary)] px-2.5 text-[0.6875rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] disabled:opacity-50 max-sm:text-[13px] [@media(pointer:coarse)]:min-h-11"
          >
            {localizeUi("ui.ui.imagereferencepicker.removeExtras")}
          </button>
        </div>
      ) : (
        <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)] max-sm:text-[13px]">
          {localizeUi(count === 0 ? "ui.ui.imagereferencepicker.emptyHint" : "ui.ui.imagereferencepicker.hint")}
        </p>
      )}

      {dropActive && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-lg bg-[var(--background)]/90 text-center"
        >
          <span className="text-sm font-semibold text-[var(--primary)]">
            {localizeUi("ui.ui.imagereferencepicker.dropHere")}
          </span>
          <span className="text-[0.6875rem] text-[var(--muted-foreground)] max-sm:text-[13px]">
            {localizeUi("ui.ui.imagereferencepicker.dropRoom", { count: Math.max(0, room) })}
          </span>
        </div>
      )}
    </section>
  );
}

/** A picture the chooser offers. */
export type ImageReferenceSource = Omit<PickedImageReference, "role"> & { role: ImageReferenceRole };

export type ImageReferenceChooserTab = { id: string; label: string; content: ReactNode };

/** The grid of pictures one chooser tab offers; selected ones show their add order. */
export function ImageReferenceGrid({
  sources,
  addedKeys,
  selectedKeys,
  onToggle,
  loading = false,
}: {
  sources: ImageReferenceSource[];
  addedKeys: ReadonlySet<string>;
  selectedKeys: readonly string[];
  onToggle: (source: ImageReferenceSource) => void;
  loading?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  if (!loading && sources.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-[var(--muted-foreground)] max-sm:text-[13px]">
        {localizeUi("ui.ui.imagereferencepicker.noPictures")}
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2" data-reference-grid="">
      {sources.map((source) => {
        const added = addedKeys.has(source.key);
        const order = selectedKeys.indexOf(source.key);
        const selected = order >= 0;
        return (
          <li key={source.key}>
            <button
              type="button"
              disabled={added}
              aria-pressed={selected}
              onClick={() => onToggle(source)}
              title={source.label}
              className={cn(
                "group/source relative block aspect-square w-full overflow-hidden rounded-lg bg-[var(--secondary)] ring-1 ring-[var(--border)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--primary)]",
                selected && "ring-2 ring-[var(--primary)]",
                added && "cursor-default opacity-50",
              )}
            >
              <img src={source.url} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-3 text-left text-[0.625rem] text-white max-sm:text-[11px]">
                {source.label}
              </span>
              {added ? (
                <span className="absolute right-1 top-1 rounded bg-black/75 px-1.5 py-0.5 text-[0.625rem] text-white">
                  {localizeUi("ui.ui.imagereferencepicker.added")}
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[0.625rem] font-semibold",
                    selected
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "bg-black/45 ring-1 ring-white/75",
                  )}
                >
                  {selected ? order + 1 : null}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** The chooser page shown inside the window in place of its form: tabs of pictures, plus the device. */
export function ImageReferenceChooser({
  tabs,
  activeTab,
  onTabChange,
  onBack,
  onChooseFiles,
}: {
  tabs: ImageReferenceChooserTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  onBack: () => void;
  onChooseFiles: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const deviceTab = "device";
  const current = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  return (
    <div className="space-y-3" data-reference-chooser="">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={localizeUi("ui.ui.imagereferencepicker.back")}
          title={localizeUi("ui.ui.imagereferencepicker.back")}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors [@media(hover:hover)]:hover:text-[var(--foreground)] [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
        >
          <ArrowLeft size="1rem" />
        </button>
        <h3 className="text-sm font-medium text-[var(--foreground)]">
          {localizeUi("ui.ui.imagereferencepicker.chooserTitle")}
        </h3>
      </div>
      <div role="tablist" className="flex gap-1 rounded-lg bg-[var(--secondary)] p-1 ring-1 ring-[var(--border)]">
        {[
          ...tabs.map((tab) => ({ id: tab.id, label: tab.label })),
          { id: deviceTab, label: localizeUi("ui.ui.imagereferencepicker.tabDevice") },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "min-h-8 min-w-0 flex-1 truncate rounded-md px-2 text-xs transition-colors max-sm:text-[13px] [@media(pointer:coarse)]:min-h-11",
              activeTab === tab.id
                ? "bg-[var(--background)] font-medium text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] [@media(hover:hover)]:hover:text-[var(--foreground)]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === deviceTab ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[var(--border)] px-4 py-8 text-center">
          <ImagePlus size="1.5rem" className="text-[var(--muted-foreground)]" />
          <p className="max-w-xs text-xs leading-relaxed text-[var(--muted-foreground)] max-sm:text-[13px]">
            {localizeUi("ui.ui.imagereferencepicker.deviceHint")}
          </p>
          <button
            type="button"
            onClick={onChooseFiles}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 text-xs font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] max-sm:text-[13px] [@media(pointer:coarse)]:min-h-11"
          >
            <Upload size="0.875rem" />
            {localizeUi("ui.ui.imagereferencepicker.chooseFiles")}
          </button>
        </div>
      ) : (
        current?.content
      )}
    </div>
  );
}
