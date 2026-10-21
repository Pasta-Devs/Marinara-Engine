// ──────────────────────────────────────────────
// What the overworld and the town views share (worldgen W8): the game's clock running in real time as
// Pixelforge's world does, and a setting family's tiles (its tile pack, W9a).
// ──────────────────────────────────────────────
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  OVERWORLD_SECONDS_PER_GAME_MINUTE,
  tilePackPixels,
  CHARACTER_FACINGS,
  worldWholeEdgeBlocks,
  WORLD_PATTERN_TILE_IDS,
  WORLD_GROUND_LOOK_FALLBACK,
  type WorldGroundLook,
  type WorldSeason,
  type WorldEdgeTerrain,
  type CharacterFacing,
  type ImageCharacter,
  type ImageTile,
  type ImageTilePack,
  type TilePack,
} from "@marinara-engine/shared";
import { ApiError, api } from "../lib/api-client";
import { OVERWORLD_TILE } from "../lib/overworld-paint";
import { useAdvanceTime } from "./use-game";

/** Tiles to a row on the canvas a pack is laid out on. */
const ATLAS_COLUMNS = 8;

/** What the game screen can ask of the view in front: send the real time it has passed so far. */
export interface OverworldClockHandle {
  flush: () => Promise<void>;
}

/** Real-time minutes sent together (Pixelforge saves its clock at most every thirty seconds). */
const FLUSH_MINUTES = 6;

/** The clock while a view is in front: a game minute every five real seconds while `running` and not
 *  `held()`, sent in batches, when the page hides, when the view closes, and when the game screen asks. */
export function useOverworldClock(
  chatId: string,
  running: boolean,
  held: () => boolean,
  handleRef?: MutableRefObject<OverworldClockHandle | null>,
) {
  const advance = useAdvanceTime();
  const advanceRef = useRef(advance.mutateAsync);
  advanceRef.current = advance.mutateAsync;
  const heldRef = useRef(held);
  heldRef.current = held;
  const [pendingMinutes, setPendingMinutes] = useState(0);
  const pendingRef = useRef(0);

  const flush = useCallback(
    async (keepalive = false) => {
      const minutes = pendingRef.current;
      if (minutes < 1) return;
      pendingRef.current = 0;
      setPendingMinutes(0);
      try {
        await advanceRef.current({ chatId, minutes, keepalive });
      } catch {
        // A minute the server did not take is a minute lost, never a broken game.
      }
    },
    [chatId],
  );
  useEffect(() => {
    if (handleRef) handleRef.current = { flush: () => flush() };
    return () => {
      if (handleRef) handleRef.current = null;
    };
  }, [flush, handleRef]);
  useEffect(() => {
    if (!running) return;
    let seconds = 0;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || heldRef.current()) return;
      seconds += 1;
      if (seconds < OVERWORLD_SECONDS_PER_GAME_MINUTE) return;
      seconds = 0;
      pendingRef.current += 1;
      setPendingMinutes(pendingRef.current);
      if (pendingRef.current >= FLUSH_MINUTES) void flush();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, flush]);
  useEffect(() => {
    const onHidden = () => {
      // Kept alive too: the page may be unloading, and a later pagehide finds nothing left to send.
      if (document.visibilityState === "hidden") void flush(true);
    };
    const onPageHide = () => void flush(true);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
      void flush();
    };
  }, [flush]);
  return { pendingMinutes, flush };
}

// ── Tile packs (worldgen W9a) ──

/** The stored tile packs, the families with a built-in pack, and the pack each family is drawn with. */
export interface TilePackLibrary {
  packs: Array<{ id: string; name: string; family: string; version: number; tilePackVersion?: 1 | 2 }>;
  builtIn: string[];
  selection: Record<string, string>;
}

export const tilePackKeys = {
  library: ["game", "tile-packs"] as const,
  pack: (family: string, chosen: string | null, version: number | null) =>
    ["game", "tile-packs", "pack", family, chosen, version] as const,
};

export function useTilePackLibrary() {
  return useQuery({
    queryKey: tilePackKeys.library,
    queryFn: () => api.get<TilePackLibrary>("/game-tile-packs"),
    // Read again when a view opens: a pack may have been saved from Pixelforge meanwhile.
    staleTime: 0,
  });
}

/** Draws a family's tile at (x, y), the variant by `pick` (0..1); false while the tiles load, when the
 *  family has none, or when it lacks that tile, so the caller draws it plain. A tile of one cell fills
 *  the 16-unit cell at (x, y). A sprite of an image pack (several cells) is drawn that many cells big,
 *  its bottom row on the cell and centred across it, or fills `box` (in units, from (x, y)) when given,
 *  as a building fills its lot. */
export type OverworldTileDrawer = ((
  ctx: CanvasRenderingContext2D,
  id: string,
  x: number,
  y: number,
  pick?: number,
  box?: { w: number; h: number },
) => boolean) & {
  /** How many canvas pixels a unit is worth drawing at: 1 for a drawn pack, the image pack's cell size
   *  over 16 for an image pack, so a base canvas made that much bigger keeps its detail. */
  resolution: number;
  /** Whether the pack has this tile, drawn whole as a sprite of more than one cell. */
  sprite: (id: string) => { w: number; h: number } | null;
  /** An image pack (art scaled down: drawn smooth when shrunk), not a drawn one. */
  image: boolean;
  /** Still on its way (the game's own tiles, or an image pack's sheets decoding): draw nothing yet. */
  loading: boolean;
  /**
   * Draws a person (by id) or the party walking, from the image pack's characters: the frame (0, 1 or 2:
   * step, stand, step) of the row it faces, standing on the cell at (x, y), or lying on it (asleep). False
   * when the pack has no character for them, so the caller draws the `folk` or `party` tile instead.
   */
  character: (
    ctx: CanvasRenderingContext2D,
    who: "party" | { person: string },
    x: number,
    y: number,
    facing?: CharacterFacing,
    frame?: number,
    lying?: boolean,
  ) => boolean;
  /** Whether the pack has edge tiles for a terrain (water, road, street, square). */
  hasEdges: (terrain: WorldEdgeTerrain) => boolean;
  /** Whether the pack has a fringe for a ground look (or for the look it stands in for). */
  hasFringe: (look: string) => boolean;
  /**
   * Spills a look's own ground past its cells onto its neighbours around the corner at (x, y) (in units): the
   * look drawn over the four cells meeting there (`pickAt` the variant a cell draws, as the ground does), seen
   * through the fringe's mask for `piece` (a plain edge piece, by the corner's mask).
   */
  fringe: (
    ctx: CanvasRenderingContext2D,
    look: string,
    piece: number,
    x: number,
    y: number,
    pickAt: (cx: number, cy: number) => number,
    pick?: number,
  ) => boolean;
  /** How long every one of a terrain's edge blocks is (4, 6 with slants, 30 with curves; 0 for none), for
   *  worldEdgePiece. */
  edgeRows: (terrain: WorldEdgeTerrain) => number;
  /**
   * Draws an edge block's piece (worldEdgePiece) centred on the corner at (x, y) (in units, where four cells
   * meet), from the variant `pick` (0..1) chooses. False when the pack has none for the terrain.
   */
  edge: (
    ctx: CanvasRenderingContext2D,
    terrain: WorldEdgeTerrain,
    piece: number,
    x: number,
    y: number,
    pick?: number,
  ) => boolean;
};

/** The walking look an Experience gives its own people (Capability API 1.346): a character of its map
 *  pack's tiles, by person id. Provided by the game; empty everywhere else. */
export const ExperiencePeopleSpritesContext = createContext<ReadonlyMap<string, string>>(new Map());

/** The tiles a family is drawn with: the pack chosen for it, else the Engine's own for the family, laid
 *  out once on a canvas. A family with neither is drawn plain. */
/** `own`: the game's own tiles (an Experience's map pack), drawn instead of the family's; "loading" while
 *  they are still on their way, so the family's are never fetched and drawn first. */
export function useOverworldAtlas(
  family: string | undefined,
  own?: TilePack | null | "loading",
  season?: WorldSeason,
): OverworldTileDrawer {
  const { data: library, isPending: libraryPending } = useTilePackLibrary();
  const peopleSprites = useContext(ExperiencePeopleSpritesContext);
  const chosen = (family && library?.selection[family]) || null;
  // By version, so a pack saved again is drawn anew.
  const version = (chosen && library?.packs.find((pack) => pack.id === chosen)?.version) || null;
  const builtIn = Boolean(family && library?.builtIn.includes(family));
  const { data: fetched, isError: fetchFailed } = useQuery({
    queryKey: tilePackKeys.pack(family ?? "", chosen, version),
    queryFn: async () => {
      if (chosen) {
        // A chosen pack that is gone or no longer reads (404) falls back to the built-in one; any other
        // failure is thrown, so the query retries rather than keeping the fallback under this pack's key.
        const stored = await api
          .get<{ pack: TilePack }>(`/game-tile-packs/pack?id=${encodeURIComponent(chosen)}`)
          .catch((error: unknown) => {
            if (error instanceof ApiError && error.status === 404) return null;
            throw error;
          });
        if (stored) return stored.pack;
      }
      if (!builtIn) return null;
      return (await api.get<{ pack: TilePack }>(`/game-tile-packs/builtin/${encodeURIComponent(family!)}`)).pack;
    },
    // A game with its own tiles (an Experience's map pack, worldgen W9e) draws with them.
    enabled: Boolean(family && library) && !own,
    staleTime: Infinity,
  });
  const pack = own === "loading" ? null : (own ?? fetched);
  const drawn = pack && pack.tilePackVersion !== 2 ? pack : null;
  const image = pack && pack.tilePackVersion === 2 ? pack : null;
  const atlas = useMemo(() => {
    if (!drawn) return null;
    const ids = Object.keys(drawn.tiles);
    const total = ids.reduce((sum, id) => sum + drawn.tiles[id]!.length, 0);
    const canvas = document.createElement("canvas");
    canvas.width = ATLAS_COLUMNS * OVERWORLD_TILE;
    canvas.height = Math.max(1, Math.ceil(total / ATLAS_COLUMNS)) * OVERWORLD_TILE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const index: Record<string, number[]> = {};
    let next = 0;
    for (const id of ids) {
      index[id] = drawn.tiles[id]!.map((rows) => {
        const at = next++;
        const data = new ImageData(tilePackPixels(drawn, rows), OVERWORLD_TILE, OVERWORLD_TILE);
        ctx.putImageData(data, (at % ATLAS_COLUMNS) * OVERWORLD_TILE, Math.floor(at / ATLAS_COLUMNS) * OVERWORLD_TILE);
        return at;
      });
    }
    return { canvas, index };
  }, [drawn]);
  // An image pack's tiles, copied out of its decoded sheets into one compact atlas (only the cells its
  // tiles use), so the sheets themselves are not kept. Until they are in, the drawer says it is loading
  // and nothing is drawn, never the code-drawn look first.
  // The pack's id and version, and a fingerprint of its tiles and sheets: two packs that share an id and a
  // version (two Experiences' map packs, a package installed again) are never drawn from one atlas.
  // Kept per pack: the fingerprint reads every sheet, and the view renders on each drag and clock tick.
  const imageKey = useMemo(() => (image ? `${image.id}@${image.version}#${imageFingerprint(image)}` : null), [image]);
  const [compact, setCompact] = useState<{ key: string; atlas: ImageAtlas } | null>(null);
  useEffect(() => {
    if (!image || !imageKey) return;
    let live = true;
    void buildImageAtlas(image)
      .then((atlas) => {
        if (live) setCompact({ key: imageKey, atlas });
      })
      .catch(() => {
        // Sheets that do not decode leave the pack drawn plain.
        if (live) setCompact({ key: imageKey, atlas: { canvas: null, tiles: {}, size: image.tileSize } });
      });
    return () => {
      live = false;
    };
    // The key stands for the pack: the same pack read again is not decoded again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageKey]);
  const ready = image && compact?.key === imageKey ? compact.atlas : null;
  return useMemo(() => {
    // A look the pack has no tile for (a newer forest) draws the one it stands in for.
    const fallbackOf = (id: string) => WORLD_GROUND_LOOK_FALLBACK[id as WorldGroundLook];
    // A tile's seasonal variant (`<id>@<season>`) in its season, where the pack has one.
    const seasonal = <T>(tiles: Record<string, T> | undefined, id: string) =>
      (season ? tiles?.[`${id}@${season}`] : undefined) ?? tiles?.[id];
    const variantOf = <T>(variants: readonly T[] | undefined, pick: number) =>
      variants?.length ? variants[Math.min(variants.length - 1, Math.floor(pick * variants.length))]! : null;
    if (image) {
      const size = image.tileSize;
      const patterns = new Set<string>(WORLD_PATTERN_TILE_IDS);
      const draw = ((ctx, id, x, y, pick = 0, box) => {
        const variants = seasonal(ready?.tiles, id) ?? seasonal(ready?.tiles, fallbackOf(id) ?? "");
        // Ground drawn as a pattern: its cell for this position (x and y are whole cells in units here).
        const pattern = !box && patterns.has(id) ? variants?.find((each) => each.w > 1 || each.h > 1) : undefined;
        if (pattern && ready?.canvas) {
          const [cx, cy] = [Math.round(x / OVERWORLD_TILE), Math.round(y / OVERWORLD_TILE)];
          const [px, py] = [((cx % pattern.w) + pattern.w) % pattern.w, ((cy % pattern.h) + pattern.h) % pattern.h];
          ctx.drawImage(
            ready.canvas,
            pattern.sx + px * size,
            pattern.sy + py * size,
            size,
            size,
            x,
            y,
            OVERWORLD_TILE,
            OVERWORLD_TILE,
          );
          return true;
        }
        const tile = ready?.canvas ? variantOf(variants, pick) : null;
        if (!tile || !ready?.canvas) return false;
        const [dw, dh] = box
          ? fitInside(tile.w * OVERWORLD_TILE, tile.h * OVERWORLD_TILE, box.w, box.h)
          : [tile.w * OVERWORLD_TILE, tile.h * OVERWORLD_TILE];
        // A sprite stands on its cell, centred across it; in a box, at the box's bottom, centred.
        const [dx, dy] = box
          ? [x + (box.w - dw) / 2, y + box.h - dh]
          : [x + (OVERWORLD_TILE - dw) / 2, y + OVERWORLD_TILE - dh];
        ctx.drawImage(ready.canvas, tile.sx, tile.sy, tile.w * size, tile.h * size, dx, dy, dw, dh);
        return true;
      }) as OverworldTileDrawer;
      draw.resolution = size / OVERWORLD_TILE;
      draw.image = true;
      draw.loading = !ready;
      draw.sprite = (id) => {
        if (patterns.has(id)) return null;
        const tile = seasonal(image.tiles, id)?.[0];
        return tile && ((tile.w ?? 1) > 1 || (tile.h ?? 1) > 1) ? { w: tile.w ?? 1, h: tile.h ?? 1 } : null;
      };
      // The party wears the first character it may; townsfolk one of theirs, by who they are (the party's
      // own left out when there are others), so a person always wears the same one.
      const people = ready?.characters ?? [];
      const partyCharacter = people.find((each) => each.for.includes("party"));
      const folkAll = people.filter((each) => each.for.includes("folk"));
      const folk = folkAll.length > 1 ? folkAll.filter((each) => each !== partyCharacter) : folkAll;
      draw.character = (ctx, who, x, y, facing = "down", frame = 1, lying = false) => {
        const own = who === "party" ? undefined : peopleSprites.get(who.person);
        const dressed = own ? people.find((each) => each.id === own) : undefined;
        const chosen =
          who === "party"
            ? partyCharacter
            : (dressed ?? (folk.length ? folk[characterPick(who.person) % folk.length] : undefined));
        const sheet = ready?.charactersCanvas;
        if (!chosen || !sheet) return false;
        const [fw, fh] = [chosen.w * size, chosen.h * size];
        const row = CHARACTER_FACINGS.indexOf(lying ? "down" : facing);
        const [sx, sy] = [chosen.sx + Math.min(2, Math.max(0, frame)) * fw, chosen.sy + row * fh];
        const [dw, dh] = [chosen.w * OVERWORLD_TILE, chosen.h * OVERWORLD_TILE];
        if (lying) {
          // On their side across the cell, as small as it takes to lie within it.
          const scale = OVERWORLD_TILE / Math.max(dw, dh);
          ctx.save();
          ctx.translate(x + OVERWORLD_TILE / 2, y + OVERWORLD_TILE / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.drawImage(sheet, sx, sy, fw, fh, (-dw * scale) / 2, (-dh * scale) / 2, dw * scale, dh * scale);
          ctx.restore();
          return true;
        }
        ctx.drawImage(sheet, sx, sy, fw, fh, x + (OVERWORLD_TILE - dw) / 2, y + OVERWORLD_TILE - dh, dw, dh);
        return true;
      };
      draw.hasEdges = (terrain) => Boolean(ready?.edges?.[`edge_${terrain}`]?.length);
      draw.edgeRows = (terrain) => {
        const variants = ready?.edges?.[`edge_${terrain}`];
        return variants?.length ? Math.min(...variants.map((block) => block.length / 4)) : 0;
      };
      const fringeOf = (look: string) =>
        seasonal(ready?.edges, `fringe_${look}`) ?? seasonal(ready?.edges, `fringe_${fallbackOf(look) ?? ""}`);
      draw.hasFringe = (look) => Boolean(fringeOf(look)?.length);
      let through: HTMLCanvasElement | null = null;
      draw.fringe = (ctx, look, piece, x, y, pickAt, pick = 0) => {
        const variants = fringeOf(look);
        if (!variants?.length || piece < 0 || !ready?.canvas) return false;
        const at = variants[Math.min(variants.length - 1, Math.floor(pick * variants.length))]?.[piece];
        if (!at) return false;
        through ??= document.createElement("canvas");
        if (through.width !== size) through.width = through.height = size;
        const tctx = through.getContext("2d");
        if (!tctx) return false;
        const half = OVERWORLD_TILE / 2;
        tctx.setTransform(1, 0, 0, 1, 0, 0);
        tctx.globalCompositeOperation = "source-over";
        tctx.clearRect(0, 0, size, size);
        // The four cells meeting at the corner, in units, so a pattern lines up with the ground around it.
        tctx.setTransform(
          size / OVERWORLD_TILE,
          0,
          0,
          size / OVERWORLD_TILE,
          (half - x) * (size / OVERWORLD_TILE),
          (half - y) * (size / OVERWORLD_TILE),
        );
        const [cx, cy] = [Math.round(x / OVERWORLD_TILE), Math.round(y / OVERWORLD_TILE)];
        for (const [dx, dy] of [
          [-1, -1],
          [0, -1],
          [-1, 0],
          [0, 0],
        ] as const)
          draw(tctx, look, (cx + dx) * OVERWORLD_TILE, (cy + dy) * OVERWORLD_TILE, pickAt(cx + dx, cy + dy));
        tctx.setTransform(1, 0, 0, 1, 0, 0);
        tctx.globalCompositeOperation = "destination-in";
        tctx.drawImage(ready.canvas, at.sx, at.sy, size, size, 0, 0, size, size);
        tctx.globalCompositeOperation = "source-over";
        ctx.drawImage(through, x - half, y - half, OVERWORLD_TILE, OVERWORLD_TILE);
        return true;
      };
      draw.edge = (ctx, terrain, piece, x, y, pick = 0) => {
        const variants = ready?.edges?.[`edge_${terrain}`];
        if (!variants?.length || piece < 0 || !ready?.canvas) return false;
        const at = variants[Math.min(variants.length - 1, Math.floor(pick * variants.length))]?.[piece];
        if (!at) return false;
        const half = OVERWORLD_TILE / 2;
        ctx.drawImage(ready.canvas, at.sx, at.sy, size, size, x - half, y - half, OVERWORLD_TILE, OVERWORLD_TILE);
        return true;
      };
      return draw;
    }
    const draw = ((ctx, id, x, y, pick = 0) => {
      const at = variantOf(seasonal(atlas?.index, id) ?? seasonal(atlas?.index, fallbackOf(id) ?? ""), pick);
      if (!atlas || at === null) return false;
      const sx = (at % ATLAS_COLUMNS) * OVERWORLD_TILE;
      const sy = Math.floor(at / ATLAS_COLUMNS) * OVERWORLD_TILE;
      ctx.drawImage(atlas.canvas, sx, sy, OVERWORLD_TILE, OVERWORLD_TILE, x, y, OVERWORLD_TILE, OVERWORLD_TILE);
      return true;
    }) as OverworldTileDrawer;
    draw.resolution = 1;
    draw.image = false;
    // Still finding out which pack to draw with (the library, or a pack chosen from it), so an image pack
    // is never preceded by the drawn look.
    draw.loading =
      own === "loading" ||
      (!own && Boolean(family) && (libraryPending || (Boolean(chosen) && !fetched && !fetchFailed)));
    draw.sprite = () => null;
    draw.character = () => false;
    draw.hasEdges = () => false;
    draw.hasFringe = () => false;
    draw.fringe = () => false;
    draw.edgeRows = () => 0;
    draw.edge = () => false;
    return draw;
  }, [atlas, chosen, family, fetchFailed, fetched, image, libraryPending, own, peopleSprites, ready, season]);
}

/** Canvas pixels per unit for a view's base canvases (the ground and buildings drawn once): an image
 *  pack's cell size over 16, but no more than the view shows them at, and small enough that the view's
 *  base canvases (`units`, their total area in units) stay under 16 megapixels together, as a phone's
 *  browser allows. 1 for a drawn pack. */
export function overworldBaseResolution(drawTile: OverworldTileDrawer, units: number, shown: number): number {
  if (!drawTile.image) return 1;
  const most = Math.sqrt(16_000_000 / Math.max(1, units));
  return Math.max(1, Math.min(drawTile.resolution, Math.ceil(shown), Math.floor(most)));
}

/** A short fingerprint of an image pack's tiles and sheets (FNV-1a over its tiles and a sample of each
 *  sheet's data), so a pack changed under the same id and version is decoded again. */
function imageFingerprint(pack: ImageTilePack): string {
  let hash = 0x811c9dc5;
  const mix = (text: string, step = 1) => {
    for (let at = 0; at < text.length; at += step) hash = Math.imul(hash ^ text.charCodeAt(at), 0x01000193);
  };
  mix(JSON.stringify(pack.tiles));
  mix(JSON.stringify(pack.characters ?? []));
  for (const sheet of pack.sheets) {
    mix(`${sheet.id}:${sheet.png.length}`);
    mix(sheet.png, 97);
  }
  return (hash >>> 0).toString(36);
}

/** A width and height scaled to fit inside a box, keeping their proportions. */
function fitInside(width: number, height: number, boxWidth: number, boxHeight: number): [number, number] {
  const scale = Math.min(boxWidth / width, boxHeight / height);
  return [width * scale, height * scale];
}

interface ImageAtlas {
  canvas: HTMLCanvasElement | null;
  /** Each tile's variants: where it is on the atlas, and its cells across and down. */
  tiles: Record<string, Array<{ sx: number; sy: number; w: number; h: number }>>;
  size: number;
  /** Each edge tile's variants, each its sixteen pieces (extruded by a pixel, so smoothing never
   *  pulls in a neighbouring piece): where each piece's own pixels start on the atlas. */
  edges?: Record<string, Array<Array<{ sx: number; sy: number }>>>;
  /** The characters' walking blocks, on a canvas of their own (so many big blocks never crowd the
   *  tiles out), each where it is and its frame's cells. */
  charactersCanvas?: HTMLCanvasElement | null;
  characters?: Array<{ id: string; sx: number; sy: number; w: number; h: number; for: Array<"party" | "folk"> }>;
}

/** A person's pick among the characters: a hash of their id, salted so it is not where they stand. */
const characterPick = (personId: string) =>
  [...`look:${personId}`].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

/** An image pack's tiles copied onto one canvas, packed in rows: the sheets are decoded, read once and
 *  let go. */
async function buildImageAtlas(pack: ImageTilePack): Promise<ImageAtlas> {
  const size = pack.tileSize;
  const images = new Map<string, HTMLImageElement>(
    await Promise.all(
      pack.sheets.map(async (sheet) => {
        const element = new Image();
        element.src = sheet.png;
        await element.decode();
        return [sheet.id, element] as const;
      }),
    ),
  );
  const ROW = 2048;
  const placed: Array<{ id: string; index: number; tile: ImageTile; sx: number; sy: number }> = [];
  let [x, y, rowHeight] = [0, 0, 0];
  // Edge tiles' pieces, each on its own with a pixel of its own edge around it.
  const pieces: Array<{ id: string; index: number; piece: number; tile: ImageTile; sx: number; sy: number }> = [];
  for (const [id, variants] of Object.entries(pack.tiles)) {
    variants.forEach((tile, index) => {
      if (id.startsWith("edge_") || id.startsWith("fringe_")) {
        for (let piece = 0; piece < 4 * (tile.h ?? 4); piece++) {
          if (x + size + 2 > ROW) [x, y, rowHeight] = [0, y + rowHeight, 0];
          pieces.push({ id, index, piece, tile, sx: x + 1, sy: y + 1 });
          x += size + 2;
          rowHeight = Math.max(rowHeight, size + 2);
        }
        return;
      }
      const [w, h] = [(tile.w ?? 1) * size, (tile.h ?? 1) * size];
      if (x + w > ROW) [x, y, rowHeight] = [0, y + rowHeight, 0];
      placed.push({ id, index, tile, sx: x, sy: y });
      x += w;
      rowHeight = Math.max(rowHeight, h);
    });
  }
  // Larger than a browser can hold on one canvas: drawn plain rather than invisibly.
  if (y + rowHeight > 8192) return { canvas: null, tiles: {}, size };
  const canvas = document.createElement("canvas");
  canvas.width = ROW;
  canvas.height = Math.max(1, y + rowHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) return { canvas: null, tiles: {}, size };
  const tiles: ImageAtlas["tiles"] = {};
  for (const { id, index, tile, sx, sy } of placed) {
    const source = images.get(tile.sheet);
    if (!source) continue;
    const [w, h] = [tile.w ?? 1, tile.h ?? 1];
    ctx.drawImage(source, tile.x * size, tile.y * size, w * size, h * size, sx, sy, w * size, h * size);
    (tiles[id] ??= [])[index] = { sx, sy, w, h };
  }
  const edges: NonNullable<ImageAtlas["edges"]> = {};
  for (const { id, index, piece, tile, sx, sy } of pieces) {
    const source = images.get(tile.sheet);
    if (!source) continue;
    const [px, py] = [(tile.x + (piece % 4)) * size, (tile.y + Math.floor(piece / 4)) * size];
    ctx.drawImage(source, px, py, size, size, sx, sy, size, size);
    // The piece's own edge pixels, one more each side (and its corner pixels at the corners), copied from the
    // sheet: copying them from the atlas itself would read the canvas back once a piece, which with a few
    // hundred pieces took minutes.
    const last = size - 1;
    ctx.drawImage(source, px, py, 1, size, sx - 1, sy, 1, size);
    ctx.drawImage(source, px + last, py, 1, size, sx + size, sy, 1, size);
    ctx.drawImage(source, px, py, size, 1, sx, sy - 1, size, 1);
    ctx.drawImage(source, px, py + last, size, 1, sx, sy + size, size, 1);
    ctx.drawImage(source, px, py, 1, 1, sx - 1, sy - 1, 1, 1);
    ctx.drawImage(source, px + last, py, 1, 1, sx + size, sy - 1, 1, 1);
    ctx.drawImage(source, px, py + last, 1, 1, sx - 1, sy + size, 1, 1);
    ctx.drawImage(source, px + last, py + last, 1, 1, sx + size, sy + size, 1, 1);
    ((edges[id] ??= [])[index] ??= [])[piece] = { sx, sy };
  }
  // Only whole blocks are drawn (a variant whose sheet did not load is left out, not drawn with holes).
  for (const id of Object.keys(edges)) {
    const whole = worldWholeEdgeBlocks(edges[id]!);
    if (whole.length) edges[id] = whole;
    else delete edges[id];
  }
  // The characters' blocks (3 frames by 4 rows each), packed the same way on their own canvas.
  let charactersCanvas: HTMLCanvasElement | null = null;
  const characters: NonNullable<ImageAtlas["characters"]> = [];
  if (pack.characters?.length) {
    const blocks: Array<{ character: ImageCharacter; sx: number; sy: number; w: number; h: number }> = [];
    let [cx, cy, crow] = [0, 0, 0];
    for (const character of pack.characters) {
      const [w, h] = [character.w ?? 1, character.h ?? 2];
      const [bw, bh] = [3 * w * size, 4 * h * size];
      if (cx + bw > ROW) [cx, cy, crow] = [0, cy + crow, 0];
      blocks.push({ character, sx: cx, sy: cy, w, h });
      cx += bw;
      crow = Math.max(crow, bh);
    }
    if (cy + crow <= 8192) {
      charactersCanvas = document.createElement("canvas");
      charactersCanvas.width = ROW;
      charactersCanvas.height = Math.max(1, cy + crow);
      const cctx = charactersCanvas.getContext("2d");
      for (const { character, sx, sy, w, h } of blocks) {
        const source = images.get(character.sheet);
        if (!source || !cctx) continue;
        const [bw, bh] = [3 * w * size, 4 * h * size];
        cctx.drawImage(source, character.x * size, character.y * size, bw, bh, sx, sy, bw, bh);
        characters.push({ id: character.id, sx, sy, w, h, for: character.for ?? ["party", "folk"] });
      }
    }
  }
  images.clear();
  return { canvas, tiles, size, charactersCanvas, characters, edges };
}

/** The view's offset in screen pixels so `at` (world pixels) sits at the middle across and a little above
 *  the middle down (the narration sits at the bottom), kept inside the map; the view may go past its
 *  bottom edge by almost half a screen so nothing on it is under the narration. */
export function overworldCamera(
  at: { x: number; y: number },
  map: { width: number; height: number },
  view: { width: number; height: number },
  scale: number,
) {
  const axis = (mapPx: number, viewPx: number, look: number, share: number, past: number) =>
    mapPx * scale <= viewPx
      ? Math.round((mapPx * scale - viewPx) / 2)
      : Math.round(Math.min(Math.max(0, look * scale - viewPx * share), mapPx * scale - viewPx + past));
  return {
    x: axis(map.width, view.width, at.x, 0.5, 0),
    y: axis(map.height, view.height, at.y, 0.4, view.height * 0.45),
  };
}

/** Draws a family with a stored pack, or (null) with its own again. */
export function useChooseTilePack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { family: string; packId: string | null }) =>
      api.put<{ selection: Record<string, string> }>("/game-tile-packs/selection", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: tilePackKeys.library }),
  });
}

/** Imports a tile pack file. */
export function useImportTilePack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (definition: string) =>
      api.post<{ status: "added" | "unchanged"; pack: { id: string; name: string; version: number }; notes: string[] }>(
        "/game-tile-packs/import",
        { definition },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: tilePackKeys.library }),
  });
}

/** Removes every version of a stored pack. */
export function useRemoveTilePack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (packId: string) =>
      api.delete<{ removed: number }>(`/game-tile-packs?id=${encodeURIComponent(packId)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["game", "tile-packs"] }),
  });
}
