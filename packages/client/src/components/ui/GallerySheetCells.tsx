// ──────────────────────────────────────────────
// GallerySheetCells — the cut step of a generated sticker / emoji sheet: the
// background is removed, every sticker is found by its outline and becomes its
// own picture (trimmed, sized), and the user picks which to keep, renames them,
// recuts one with a box on the sheet, or adds one the finder missed.
// ──────────────────────────────────────────────
import { useCallback, useMemo, useRef, useState } from "react";
import { Check, Crop, Plus, RotateCcw } from "lucide-react";
import { Spinner } from "./Spinner";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import { api } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import {
  cropGallerySheetBox,
  detectGallerySheetPieces,
  fitGallerySheetSet,
  gallerySheetGridBoxes,
  isBlankGallerySheetImage,
  keyOutGallerySheetBackground,
  readImageSize,
  type GallerySheetBox,
  type GallerySheetKind,
  type GallerySheetPiece,
} from "../../lib/gallery-sheet-cut";
import { slugifyCustomName } from "../../lib/custom-emoji";
import { GallerySheetBoxEditor } from "./GallerySheetBoxEditor";

/** One sticker or emoji ready to save: its `:name:` and its picture. */
export type GallerySheetCut = { name: string; dataUrl: string };

type SheetCell = {
  id: string;
  name: string;
  /** Where the piece sits on the sheet; a recut starts from it. */
  box: GallerySheetBox;
  /** The piece as cut from the keyed sheet, before fitting; a recut refits the whole set from these. */
  piece: string;
  image: string;
  selected: boolean;
};

type CutSource = { sheet: string; grid: { cols: number; rows: number }; names: string[] };

/** The sheet with its background removed, which the pieces and every recut are taken from. */
type KeyedSheet = { dataUrl: string; width: number; height: number };

/** Which cell the box editor is open for: an existing one, or a new one being added. */
export type GallerySheetEditTarget = number | "new";

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
  const [editTarget, setEditTarget] = useState<GallerySheetEditTarget | null>(null);
  const [keyedSheet, setKeyedSheet] = useState<KeyedSheet | null>(null);
  const sourceRef = useRef<CutSource | null>(null);
  const cellsRef = useRef<SheetCell[]>([]);
  cellsRef.current = cells;
  const runRef = useRef(0);

  const runCut = useCallback(
    async (source: CutSource) => {
      const run = ++runRef.current;
      sourceRef.current = source;
      setBusy(true);
      setEditTarget(null);
      try {
        // Stickers and emoji are always cut out. The flat green screen is keyed out from the edges first;
        // only a sheet whose backdrop wasn't flat goes to the server's remover (which keys colour everywhere,
        // so it would also eat a sticker's own green), and the edge key then tidies what that left.
        let keyed = await keyOutGallerySheetBackground(source.sheet);
        if (!keyed.clean) {
          try {
            const [removed] = await removeBackgrounds([source.sheet]);
            if (removed && removed !== source.sheet) keyed = await keyOutGallerySheetBackground(removed);
          } catch {
            // The remover is unavailable: keep what the edge key managed.
          }
        }
        const size = await readImageSize(keyed.dataUrl);
        const expected = source.names.length;
        // Image models rarely keep to an even grid, so find each sticker by its outline. When that finds far
        // fewer than asked for (stickers touching, or the backdrop wouldn't come off), fall back to the grid.
        let pieces = await detectGallerySheetPieces(keyed.dataUrl, expected);
        if (!pieces || pieces.length < Math.ceil(expected / 2)) {
          const boxes = gallerySheetGridBoxes(size.width, size.height, source.grid.cols, source.grid.rows, expected);
          pieces = await Promise.all(
            boxes.map(async (box): Promise<GallerySheetPiece> => ({
              box,
              dataUrl: await cropGallerySheetBox(keyed.dataUrl, box),
            })),
          );
        }
        const images = await fitGallerySheetSet(
          pieces.map((piece) => piece.dataUrl),
          kind,
        );
        if (run !== runRef.current) return;
        setKeyedSheet({ dataUrl: keyed.dataUrl, ...size });
        setCells((previous) =>
          images.map((image, index) => ({
            id: `${run}-${index}`,
            // A re-cut keeps names and picks made so far.
            name: previous[index]?.name ?? source.names[index] ?? `${kind}_${index + 1}`,
            box: pieces[index]!.box,
            piece: pieces[index]!.dataUrl,
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
      setKeyedSheet(null);
      return runCut({ sheet, grid, names });
    },
    [runCut],
  );

  const reset = useCallback(() => {
    runRef.current++;
    sourceRef.current = null;
    setCells([]);
    setKeyedSheet(null);
    setBusy(false);
    setEditTarget(null);
  }, []);

  const recut = useCallback(() => {
    if (!sourceRef.current) return;
    // Cells stay until the new cut lands, so names and keep/skip picks carry over by position.
    void runCut(sourceRef.current);
  }, [runCut]);

  const update = useCallback((index: number, patch: Partial<SheetCell>) => {
    setCells((previous) => previous.map((cell, i) => (i === index ? { ...cell, ...patch } : cell)));
  }, []);

  /** Cut a box the user placed on the sheet: recut an existing piece, or add a new one. */
  const applyBox = useCallback(
    async (target: GallerySheetEditTarget, box: GallerySheetBox) => {
      if (!keyedSheet) return;
      const run = runRef.current;
      // Everything inside the box, then trimmed to what is drawn, so a loose box keeps the sticker's size.
      const cropped = await cropGallerySheetBox(keyedSheet.dataUrl, box);
      if (await isBlankGallerySheetImage(cropped)) {
        toast.error(localizeUi("ui.ui.gallerysheetcells.boxEmpty"));
        return;
      }
      // The set shares one scale and baseline, so a recut refits every piece (a bigger piece shrinks the rest).
      const current = cellsRef.current;
      const pieces = current.map((cell) => cell.piece);
      if (target === "new") pieces.push(cropped);
      else pieces[target] = cropped;
      const images = await fitGallerySheetSet(pieces, kind);
      if (run !== runRef.current) return;
      setCells((previous) => {
        const next: SheetCell[] = previous.map((cell, index) => ({ ...cell, image: images[index] ?? cell.image }));
        if (target === "new") {
          next.push({
            id: `${run}-added-${Date.now()}`,
            name: `${kind}_${previous.length + 1}`,
            box,
            piece: cropped,
            image: images[images.length - 1]!,
            selected: true,
          });
        } else if (next[target]) {
          next[target] = { ...next[target]!, box, piece: cropped, selected: true };
        }
        return next;
      });
      setEditTarget(null);
    },
    [keyedSheet, kind, localizeUi],
  );

  const selectedItems = useMemo<GallerySheetCut[]>(() => {
    const chosen = cells.filter((cell) => cell.selected);
    const slugs = uniqueSlugs(chosen.map((cell) => cell.name));
    return chosen.map((cell, index) => ({ name: slugs[index]!, dataUrl: cell.image }));
  }, [cells]);

  return {
    cells,
    busy,
    editTarget,
    setEditTarget,
    keyedSheet,
    cut,
    recut,
    reset,
    update,
    applyBox,
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
  const { cells, busy, editTarget, keyedSheet } = state;
  const selectedCount = cells.filter((cell) => cell.selected).length;
  const editCell = typeof editTarget === "number" ? cells[editTarget] : undefined;
  // A new piece starts as a box in the middle of the sheet, about one grid cell big.
  const newBox = keyedSheet
    ? {
        x: keyedSheet.width * 0.375,
        y: keyedSheet.height * 0.375,
        width: keyedSheet.width * 0.25,
        height: keyedSheet.height * 0.25,
      }
    : null;
  const addLabel = localizeUi(
    kind === "emoji" ? "ui.ui.gallerysheetcells.addEmoji" : "ui.ui.gallerysheetcells.addSticker",
  );

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
          onClick={() => state.setEditTarget(editTarget === "new" ? null : "new")}
          disabled={disabled || busy || !keyedSheet}
          aria-pressed={editTarget === "new"}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs text-[var(--muted-foreground)] transition-colors disabled:opacity-50 max-sm:min-h-11 max-sm:text-[13px] [@media(hover:hover)]:hover:text-[var(--foreground)]"
        >
          <Plus size="0.8125rem" />
          {addLabel}
        </button>
        <button
          type="button"
          onClick={state.recut}
          disabled={disabled || busy}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs text-[var(--muted-foreground)] transition-colors disabled:opacity-50 max-sm:min-h-11 max-sm:text-[13px] [@media(hover:hover)]:hover:text-[var(--foreground)]"
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
          <Spinner size="sm" />
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
                  onClick={() => state.setEditTarget(editTarget === index ? null : index)}
                  disabled={disabled || !keyedSheet}
                  aria-pressed={editTarget === index}
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

      {keyedSheet && editTarget !== null && (editCell || editTarget === "new") && (
        <GallerySheetBoxEditor
          key={editCell ? editCell.id : "new"}
          sheet={keyedSheet.dataUrl}
          sheetSize={keyedSheet}
          initialBox={editCell ? editCell.box : newBox!}
          title={
            editCell
              ? localizeUi("ui.ui.gallerysheetcells.boxTitle", { name: editCell.name || Number(editTarget) + 1 })
              : addLabel
          }
          onApply={(box) => state.applyBox(editTarget, box)}
          onClose={() => state.setEditTarget(null)}
        />
      )}
    </section>
  );
}
