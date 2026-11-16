// ──────────────────────────────────────────────
// GallerySheetCells — the cut step of a generated sticker / emoji sheet: every
// cell becomes its own picture (background removed, trimmed, sized), and the
// user picks which to keep, renames them, or crops one by hand before saving.
// ──────────────────────────────────────────────
import { useCallback, useMemo, useRef, useState } from "react";
import { Check, Crop, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import { api } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import {
  fitGallerySheetCell,
  keyOutGallerySheetBackground,
  sliceGallerySheet,
  type GallerySheetKind,
} from "../../lib/gallery-sheet-cut";
import { slugifyCustomName } from "../../lib/custom-emoji";
import { SpriteFrameEditor } from "./SpriteFrameEditor";

/** One sticker or emoji ready to save: its `:name:` and its picture. */
export type GallerySheetCut = { name: string; dataUrl: string };

type SheetCell = {
  id: string;
  name: string;
  /** The untrimmed cell (background already removed when that is on); hand crops start from it. */
  source: string;
  image: string;
  selected: boolean;
};

type CutSource = { sheet: string; grid: { cols: number; rows: number }; names: string[] };

const CLEANUP_CHUNK_SIZE = 4;

async function removeBackgrounds(cells: string[]): Promise<string[]> {
  const cleaned: string[] = [];
  for (let start = 0; start < cells.length; start += CLEANUP_CHUNK_SIZE) {
    const chunk = cells.slice(start, start + CLEANUP_CHUNK_SIZE);
    const result = await api.post<{ cells: Array<{ base64?: string }> }>("/sprites/cleanup", {
      cleanupStrength: 35,
      engine: "auto",
      cells: chunk.map((base64, index) => ({ expression: `cell_${start + index}`, base64 })),
    });
    cleaned.push(
      ...chunk.map((original, index) => {
        const base64 = result.cells[index]?.base64;
        return base64 ? `data:image/png;base64,${base64}` : original;
      }),
    );
  }
  return cleaned;
}

/** Names unique within the batch, as `:slug:` names the gallery label accepts. */
function uniqueSlugs(names: string[]): string[] {
  const used = new Map<string, number>();
  return names.map((name, index) => {
    const base = slugifyCustomName(name) || `sticker_${index + 1}`;
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    return seen === 0 ? base : `${base.slice(0, 29)}_${seen + 1}`;
  });
}

export function useGallerySheetCells(kind: GallerySheetKind) {
  const { t: localizeUi } = useUiTranslation();
  const [cells, setCells] = useState<SheetCell[]>([]);
  const [busy, setBusy] = useState(false);
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const sourceRef = useRef<CutSource | null>(null);
  const runRef = useRef(0);

  const runCut = useCallback(
    async (source: CutSource) => {
      const run = ++runRef.current;
      sourceRef.current = source;
      setBusy(true);
      setCropIndex(null);
      try {
        const sliced = await sliceGallerySheet(source.sheet, source.grid.cols, source.grid.rows, source.names.length);
        // Stickers and emoji are always cut out. The flat green screen is keyed out from the edges first;
        // only a cell whose backdrop wasn't flat goes to the server's remover (which keys colour everywhere,
        // so it would also eat a sticker's own green), and the edge key then tidies what that left.
        const keyed = await Promise.all(sliced.map((cell) => keyOutGallerySheetBackground(cell)));
        const sources = keyed.map((cell) => cell.dataUrl);
        const messy = keyed.flatMap((cell, index) => (cell.clean ? [] : [index]));
        if (messy.length > 0) {
          try {
            const removed = await removeBackgrounds(messy.map((index) => sliced[index]!));
            const tidied = await Promise.all(removed.map((cell) => keyOutGallerySheetBackground(cell)));
            messy.forEach((index, i) => {
              sources[index] = tidied[i]!.dataUrl;
            });
          } catch {
            // The remover is unavailable: keep what the edge key managed.
          }
        }
        const images = await Promise.all(sources.map((cell) => fitGallerySheetCell(cell, kind)));
        if (run !== runRef.current) return;
        setCells((previous) =>
          images.map((image, index) => ({
            id: `${run}-${index}`,
            // A re-cut keeps names and picks made so far.
            name: previous[index]?.name ?? source.names[index] ?? "",
            source: sources[index]!,
            image,
            selected: previous[index]?.selected ?? true,
          })),
        );
      } catch {
        if (run === runRef.current) toast.error(localizeUi("ui.ui.gallerysheetcells.cutFailed"));
      } finally {
        if (run === runRef.current) setBusy(false);
      }
    },
    [kind, localizeUi],
  );

  const cut = useCallback(
    (sheet: string, grid: { cols: number; rows: number }, names: string[]) => {
      setCells([]);
      return runCut({ sheet, grid, names });
    },
    [runCut],
  );

  const reset = useCallback(() => {
    runRef.current++;
    sourceRef.current = null;
    setCells([]);
    setBusy(false);
    setCropIndex(null);
  }, []);

  const recut = useCallback(() => {
    if (!sourceRef.current) return;
    setCells([]);
    void runCut(sourceRef.current);
  }, [runCut]);

  const update = useCallback((index: number, patch: Partial<SheetCell>) => {
    setCells((previous) => previous.map((cell, i) => (i === index ? { ...cell, ...patch } : cell)));
  }, []);

  const applyCrop = useCallback(
    async (index: number, cropped: string) => {
      // Trim again inside the hand-cut frame, so a crop that only drops a neighbour's edge keeps the size.
      const image = await fitGallerySheetCell(cropped, kind);
      update(index, { image, selected: true });
      setCropIndex(null);
    },
    [kind, update],
  );

  const selectedItems = useMemo<GallerySheetCut[]>(() => {
    const chosen = cells.filter((cell) => cell.selected);
    const slugs = uniqueSlugs(chosen.map((cell) => cell.name));
    return chosen.map((cell, index) => ({ name: slugs[index]!, dataUrl: cell.image }));
  }, [cells]);

  return {
    cells,
    busy,
    cropIndex,
    setCropIndex,
    cut,
    recut,
    reset,
    update,
    applyCrop,
    selectedItems,
  };
}

export type GallerySheetCellsState = ReturnType<typeof useGallerySheetCells>;

// A light/dark check pattern so see-through stickers read as cut out in every theme.
const CHECKER_STYLE = {
  // One conic gradient: four linear ones cost noticeably more to paint in Safari.
  backgroundImage: "repeating-conic-gradient(rgb(128 128 128 / 0.18) 0% 25%, transparent 0% 50%)",
  backgroundSize: "12px 12px",
} as const;

export function GallerySheetCells({
  state,
  kind,
  disabled,
}: {
  state: GallerySheetCellsState;
  kind: GallerySheetKind;
  disabled?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { cells, busy, cropIndex } = state;
  const selectedCount = cells.filter((cell) => cell.selected).length;
  const cropCell = cropIndex !== null ? cells[cropIndex] : undefined;

  return (
    <section className="space-y-3 border-t border-[var(--border)] pt-3" data-gallery-sheet-cells="">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h3 className="mr-auto text-xs font-semibold text-[var(--foreground)]">
          {localizeUi(
            kind === "emoji" ? "ui.ui.gallerysheetcells.emojiTitle" : "ui.ui.gallerysheetcells.stickersTitle",
            { selected: selectedCount, total: cells.length },
          )}
        </h3>
        <button
          type="button"
          onClick={state.recut}
          disabled={disabled || busy}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:opacity-50 max-sm:min-h-11 max-sm:text-[13px]"
          title={localizeUi("ui.ui.gallerysheetcells.recutHint")}
        >
          <RotateCcw size="0.8125rem" />
          {localizeUi("ui.ui.gallerysheetcells.recut")}
        </button>
      </div>
      <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)] max-sm:text-[13px]">
        {localizeUi(kind === "emoji" ? "ui.ui.gallerysheetcells.hintEmoji" : "ui.ui.gallerysheetcells.hintSticker")}
      </p>

      {busy && cells.length === 0 ? (
        <div className="flex min-h-24 items-center justify-center gap-2 rounded-lg bg-[var(--secondary)] text-xs text-[var(--muted-foreground)]">
          <Loader2 size="0.875rem" className="animate-spin" />
          {localizeUi("ui.ui.gallerysheetcells.cutting")}
        </div>
      ) : (
        <ul
          className={cn(
            "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5",
            busy && "pointer-events-none opacity-60",
          )}
        >
          {cells.map((cell, index) => (
            <li
              key={cell.id}
              className={cn(
                "min-w-0 space-y-1.5 rounded-lg bg-[var(--secondary)]/60 p-1.5 ring-1",
                cell.selected ? "ring-[var(--primary)]" : "ring-[var(--border)]/60 [&_img]:opacity-40",
              )}
            >
              <div className="relative">
                <button
                  type="button"
                  onClick={() => state.update(index, { selected: !cell.selected })}
                  disabled={disabled}
                  aria-pressed={cell.selected}
                  aria-label={localizeUi("ui.ui.gallerysheetcells.keep", { name: cell.name || index + 1 })}
                  className="block aspect-square w-full overflow-hidden rounded-md ring-1 ring-[var(--border)]/60"
                  style={CHECKER_STYLE}
                >
                  <img src={cell.image} alt="" className="h-full w-full object-contain" />
                </button>
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute left-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-md ring-1",
                    cell.selected
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] ring-transparent"
                      : "bg-[var(--card)] text-transparent ring-[var(--border)]",
                  )}
                >
                  <Check size="0.75rem" />
                </span>
                <button
                  type="button"
                  onClick={() => state.setCropIndex(cropIndex === index ? null : index)}
                  disabled={disabled}
                  title={localizeUi("ui.ui.gallerysheetcells.crop")}
                  aria-label={localizeUi("ui.ui.gallerysheetcells.crop")}
                  className="absolute bottom-1 right-1 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-black/55 text-white ring-1 ring-white/15 transition-colors max-sm:h-9 max-sm:w-9 [@media(hover:hover)]:hover:bg-black/75"
                >
                  <Crop size="0.8125rem" />
                </button>
              </div>
              <input
                type="text"
                value={cell.name}
                onChange={(event) => state.update(index, { name: event.target.value })}
                disabled={disabled}
                aria-label={localizeUi("ui.ui.gallerysheetcells.name")}
                className="mari-chrome-field h-7 w-full rounded-md px-1.5 py-0 text-center text-[0.6875rem] max-sm:min-h-9 max-sm:text-base"
              />
            </li>
          ))}
        </ul>
      )}

      {cropCell && cropIndex !== null && (
        <SpriteFrameEditor
          key={cropCell.id}
          imageUrl={cropCell.source}
          label={cropCell.name}
          onApply={(cropped) => state.applyCrop(cropIndex, cropped)}
          onClose={() => state.setCropIndex(null)}
        />
      )}
    </section>
  );
}
