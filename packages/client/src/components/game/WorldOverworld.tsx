// ──────────────────────────────────────────────
// Game: the overworld (worldgen W8)
// The game's world drawn as a pixel overworld: its ground, ways and settlements, and the party, which
// walks from settlement to settlement along the world's ways. It runs on the game's clock as Pixelforge's
// world does: while it is in front and the game waits on the player, a game minute passes every five real
// seconds, and a walk passes its days. The next turn tells the Game Master where the party walked.
// ──────────────────────────────────────────────
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { DoorOpen, Footprints, MapPin, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  WORLD_EDGE_PIECE_BY_MASK,
  worldGroundCells,
  worldRoadCells,
  worldEdgePiece,
  worldEdgeMask,
  WORLD_FRINGE_ORDER,
  worldGroundLooks,
  worldSites,
  worldTrip,
  type GameWorld,
  characterFacing,
  characterFrameAt,
  type CharacterFacing,
  type TilePack,
  type WorldPlace,
  worldSeason,
  worldSeasonCells,
  type WorldSeason,
} from "@marinara-engine/shared";
import { useDungeonEnter, useOverworld, useOverworldWalk } from "../../hooks/use-game";
import {
  overworldCamera,
  overworldBaseResolution,
  useOverworldAtlas,
  useOverworldClock,
  type OverworldClockHandle,
} from "../../hooks/use-overworld-view";
import { useGameStateStore } from "../../stores/game-state.store";
import {
  OVERWORLD_TILE,
  cellNoise,
  overworldDarkness,
  paintGround,
  paintParty,
  paintSettlement,
  paintSite,
  paintShore,
  paintWay,
} from "../../lib/overworld-paint";
import { cn } from "../../lib/utils";
import { GAME_SECTION_CLASS } from "../../lib/chat-widget-colors";

/** What the game screen can ask of the overworld: send the real time it has passed so far. */
export type WorldOverworldHandle = OverworldClockHandle;

interface WorldOverworldProps {
  chatId: string;
  game: GameWorld;
  /** Changes after each turn, so where the party is is read again. */
  turnKey: string | null;
  /** The game's clock, as the chat has it. */
  time: { day: number; hour: number; minute: number } | null;
  /** The clock runs: the overworld is in front and the game waits on the player. */
  clockRunning: boolean;
  canWalk: boolean;
  /** The setting's art family, whose tiles the overworld is drawn with when it has them. */
  family?: string;
  /** The game's own tiles (an Experience's map pack), drawn before the setting family's. */
  tilePack?: TilePack | null | "loading";
  /** Opens the town the party is in (worldgen W8b). */
  onEnterTown?: () => void;
  handleRef?: MutableRefObject<WorldOverworldHandle | null>;
}

type Point = { x: number; y: number };

/** Cells a second the party walks on screen, and the shortest and longest a walk is shown for. */
const WALK_CELLS_PER_SECOND = 6;
const WALK_SHORTEST_MS = 1200;
const WALK_LONGEST_MS = 6000;
/** Pixels a press moves before it is a drag of the map rather than a click. */
const DRAG_PIXELS = 6;

const settlementTier = (place: WorldPlace, top: number) =>
  Math.min(3, Math.floor(((place.rank ?? 0) * 3) / Math.max(1, top)));
const centre = (place: WorldPlace): Point => ({
  x: place.at.x * OVERWORLD_TILE + OVERWORLD_TILE / 2,
  y: place.at.y * OVERWORLD_TILE + OVERWORLD_TILE / 2,
});

export function WorldOverworld({
  chatId,
  game,
  turnKey,
  time,
  clockRunning,
  canWalk,
  family,
  tilePack,
  onEnterTown,
  handleRef,
}: WorldOverworldProps) {
  const { t } = useTranslation();
  const { data: overworld } = useOverworld(chatId, turnKey, true);
  const walkMutation = useOverworldWalk();
  const enterMutation = useDungeonEnter();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const walkChipRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const [placesOpen, setPlacesOpen] = useState(false);
  /** Where the view looks, in world pixels; none: at the party. */
  const [lookAt, setLookAt] = useState<Point | null>(null);
  const [walking, setWalking] = useState(false);
  const walkingRef = useRef(false);

  const { world, kit } = game;
  const byId = useMemo(() => new Map(world.places.map((place) => [place.id, place])), [world]);
  const top = Math.max(1, kit.sizes.length - 1);
  const here = overworld?.here ?? null;
  const ruined = useMemo(() => new Set(overworld?.ruined ?? []), [overworld?.ruined]);
  const scale = Math.max(2, Math.min(4, Math.floor(Math.min(size.width / 400, size.height / 260))));
  // The world's sites (a cave, a mine, a ruin out in the world), gone to and into as settlements are.
  // A hidden site is not drawn or listed until the Game Master reveals it; a sealed one is, but closed.
  const hiddenKey = (overworld?.hidden ?? []).join(",");
  const siteIds = useMemo(() => {
    const hidden = new Set(hiddenKey ? hiddenKey.split(",") : []);
    return new Set(
      worldSites(game)
        .map((place) => place.id)
        .filter((id) => !hidden.has(id)),
    );
  }, [game, hiddenKey]);
  const sealed = (id: string) => overworld?.locked?.[id] === "sealed";
  const sealedKey = Object.keys(overworld?.locked ?? {})
    .sort()
    .join(",");
  // Settlements and sites nearest the party first, by the days the way takes; those no way reaches last.
  const settlements = useMemo(() => {
    const days = (place: WorldPlace) =>
      place.id === here ? -1 : here ? (worldTrip(game, here, place.id)?.days ?? Infinity) : 0;
    return world.places
      .filter((place) => place.rank !== undefined || siteIds.has(place.id))
      .map((place) => ({ place, days: days(place) }))
      .sort((a, b) => a.days - b.days || a.place.name.localeCompare(b.place.name));
  }, [game, here, siteIds, world]);

  // ── The clock (Pixelforge's): a game minute every five real seconds while the overworld waits ──
  const { pendingMinutes, flush } = useOverworldClock(chatId, clockRunning, () => walkingRef.current, handleRef);

  const clockMinutes = time ? (time.day * 24 + time.hour) * 60 + time.minute + pendingMinutes : null;
  const darkness = clockMinutes === null ? 0 : overworldDarkness(Math.floor(clockMinutes / 60) % 24, clockMinutes % 60);
  const lit = darkness > 0.25;

  // ── The family's tiles: drawn plain until (and unless) they load ──
  // Drawn in the season of the game's day (seasonal tiles, where the pack has them).
  const drawTile = useOverworldAtlas(family, tilePack, time ? worldSeason(time.day) : undefined);
  // The places the story holds at a season of their own (1.351): each cell drawn in its nearest place's.
  const seasonsKey = JSON.stringify(overworld?.seasons ?? {});
  const heldCells = useMemo(
    () => worldSeasonCells(game, JSON.parse(seasonsKey) as Record<string, WorldSeason>),
    [game, seasonsKey],
  );

  // ── What is drawn once: the ground and its ways, then the settlements ──
  // In world units (16 a cell) at `resolution` canvas pixels a unit (an image pack's detail, as far as
  // the two canvases' size allows).
  const worldSize = { width: world.width * OVERWORLD_TILE, height: world.height * OVERWORLD_TILE };
  const resolution = overworldBaseResolution(
    drawTile,
    2 * worldSize.width * worldSize.height,
    scale * (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1),
  );
  const ground = useMemo(() => {
    const canvas = document.createElement("canvas");
    if (drawTile.loading) return canvas;
    canvas.width = world.width * OVERWORLD_TILE * resolution;
    canvas.height = world.height * OVERWORLD_TILE * resolution;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    ctx.scale(resolution, resolution);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const looks = worldGroundLooks(game);
    const cells = worldGroundCells(world);
    const water = world.terrain.map(
      (id) => (game.kit.terrain?.find((entry) => entry.id === id)?.kind ?? "open") === "water",
    );
    const wet = (x: number, y: number) =>
      x < 0 || y < 0 || x >= world.width || y >= world.height ? true : water[cells[y * world.width + x]!]!;
    const { width, height } = world;
    /** What follows is drawn in the season the story holds the cell at (x, y) in, or the day's. */
    const inSeason = (x: number, y: number) => {
      if (!heldCells) return;
      const at = Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x));
      drawTile.setCellSeason(heldCells[at] ?? undefined);
    };
    // With water edge tiles, a water cell is under-painted with the land most of its neighbours are, and
    // the water itself is drawn by the edge pieces (so a rounded shore shows land under it).
    const waterEdges = drawTile.hasEdges("water");
    const landUnder = (x: number, y: number) => {
      const count = new Map<number, number>();
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const [nx, ny] = [x + dx, y + dy];
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const cell = cells[ny * width + nx]!;
          if (!water[cell]) count.set(cell, (count.get(cell) ?? 0) + 1);
        }
      return [...count].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
    };
    // The look each cell is drawn with (a water cell under its edge pieces: the land under it).
    const drawnLook: string[] = new Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const own = cells[y * width + x]!;
        const cell = waterEdges && water[own] ? (landUnder(x, y) ?? own) : own;
        drawnLook[y * width + x] = looks[cell]!;
        const noise = cellNoise(x, y);
        inSeason(x, y);
        if (!drawTile(ctx, looks[cell]!, x * OVERWORLD_TILE, y * OVERWORLD_TILE, noise(99))) {
          paintGround(ctx, looks[cell]!, x * OVERWORLD_TILE, y * OVERWORLD_TILE, noise);
        }
        if (water[own] && !waterEdges) {
          paintShore(ctx, x * OVERWORLD_TILE, y * OVERWORLD_TILE, {
            n: !wet(x, y - 1),
            s: !wet(x, y + 1),
            w: !wet(x - 1, y),
            e: !wet(x + 1, y),
          });
        }
      }
    }
    // Fringes: where the pack has one for a look, the look spills past its cells onto the ground beside it,
    // taller ground drawn last so it overhangs.
    for (const look of WORLD_FRINGE_ORDER) {
      if (!drawTile.hasFringe(look) || !drawnLook.includes(look)) continue;
      const isLook = (x: number, y: number) => drawnLook[y * width + x] === look;
      for (let y = 0; y <= height; y++)
        for (let x = 0; x <= width; x++) {
          const mask = worldEdgeMask(isLook, x, y, width, height);
          if (mask === 0 || mask === 15) continue;
          inSeason(x, y);
          drawTile.fringe(
            ctx,
            look,
            WORLD_EDGE_PIECE_BY_MASK[mask]!,
            x * OVERWORLD_TILE,
            y * OVERWORLD_TILE,
            (cx, cy) => cellNoise(cx, cy)(99),
            cellNoise(x, y)(79),
          );
        }
    }
    /** A dual-grid pass: every corner of the map whose four cells are partly or wholly the terrain. */
    const edgePass = (terrain: "water" | "road", filled: (x: number, y: number) => boolean) => {
      const rows = drawTile.edgeRows(terrain);
      for (let y = 0; y <= height; y++)
        for (let x = 0; x <= width; x++) {
          const piece = worldEdgePiece(filled, x, y, width, height, rows);
          if (piece < 0) continue;
          inSeason(x, y);
          drawTile.edge(
            ctx,
            terrain,
            piece,
            x * OVERWORLD_TILE,
            y * OVERWORLD_TILE,
            cellNoise(x, y)(terrain === "water" ? 71 : 73),
          );
        }
    };
    if (waterEdges) edgePass("water", (x, y) => water[cells[y * width + x]!]!);
    // Ways over open ground: as road cells with road edge tiles, else drawn as lines.
    const roadEdges = drawTile.hasEdges("road");
    const roads = new Set<number>();
    // Settlements' own cells (from the world, not the list sorted by where the party is, so an arrival
    // never draws the ground again).
    const settled = new Set(
      world.places.filter((place) => place.rank !== undefined).map((place) => place.at.y * width + place.at.x),
    );
    for (const link of world.links) {
      const from = byId.get(link.from);
      const to = byId.get(link.to);
      if (!from || !to) continue;
      const crosses = kit.travel.find((way) => way.id === link.way)?.crosses ?? "open";
      if (roadEdges && crosses === "open") {
        const cellsOn = worldRoadCells(from.at, to.at, (x, y) => wet(x, y) || settled.has(y * width + x));
        for (const { x, y } of cellsOn) roads.add(y * width + x);
        continue;
      }
      paintWay(ctx, from.at, to.at, crosses);
    }
    if (roads.size) edgePass("road", (x, y) => roads.has(y * width + x));
    drawTile.setCellSeason(undefined);
    return canvas;
  }, [byId, drawTile, game, heldCells, kit.travel, resolution, world]);
  const markers = useMemo(() => {
    const canvas = document.createElement("canvas");
    if (drawTile.loading) return canvas;
    canvas.width = world.width * OVERWORLD_TILE * resolution;
    canvas.height = world.height * OVERWORLD_TILE * resolution;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    ctx.scale(resolution, resolution);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    for (const { place } of settlements) {
      const [x, y] = [place.at.x * OVERWORLD_TILE, place.at.y * OVERWORLD_TILE];
      // After dark, a warm glow of lit windows under each place still standing.
      if (lit && !ruined.has(place.id)) {
        const glow = ctx.createRadialGradient(x + 8, y + 9, 1, x + 8, y + 9, 13);
        glow.addColorStop(0, "rgba(255, 196, 90, 0.55)");
        glow.addColorStop(1, "rgba(255, 196, 90, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(x - 6, y - 5, 28, 28);
      }
      if (siteIds.has(place.id)) {
        // A pack's site marker, one of its variants by the place (one per kind of site), else a cave mouth.
        const pick = ([...place.id].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7) % 100) / 100;
        // A sealed site is drawn faded: on the map, but not to be gone to yet.
        ctx.globalAlpha = sealedKey.split(",").includes(place.id) ? 0.45 : 1;
        if (!drawTile(ctx, "site", x, y, pick)) paintSite(ctx, place.at.x, place.at.y);
        ctx.globalAlpha = 1;
        continue;
      }
      const tier = settlementTier(place, top);
      if (!drawTile(ctx, ruined.has(place.id) ? "ruin" : `marker${tier}`, x, y)) {
        paintSettlement(ctx, place.at.x, place.at.y, tier, ruined.has(place.id), lit);
      }
    }
    return canvas;
  }, [drawTile, lit, resolution, ruined, sealedKey, settlements, siteIds, top, world.height, world.width]);

  // Beyond the world's edge, the ground its edge has most of (the sea around an island, open space).
  const beyond = useMemo(() => {
    const looks = worldGroundLooks(game);
    const cells = worldGroundCells(world);
    const count = new Map<string, number>();
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        // The whole border: the top and bottom rows and the first and last columns.
        if (y > 0 && y < world.height - 1 && x > 0 && x < world.width - 1) continue;
        const look = looks[cells[y * world.width + x]!]!;
        count.set(look, (count.get(look) ?? 0) + 1);
      }
    }
    const look = [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? looks[0]!;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = OVERWORLD_TILE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    // Water beyond the edge, with water edge tiles, is their middle piece, as the water inside the map is.
    const lookIndex = looks.indexOf(look as (typeof looks)[number]);
    const wetLook =
      lookIndex >= 0 &&
      (game.kit.terrain?.find((entry) => entry.id === world.terrain[lookIndex])?.kind ?? "open") === "water";
    if (wetLook && drawTile.edge(ctx, "water", WORLD_EDGE_PIECE_BY_MASK[15]!, OVERWORLD_TILE / 2, OVERWORLD_TILE / 2))
      return canvas;
    if (!drawTile(ctx, look, 0, 0)) paintGround(ctx, look as (typeof looks)[number], 0, 0, cellNoise(0, 0));
    return canvas;
  }, [drawTile, game, world]);

  // ── The view: where it looks, kept inside the world ──
  const homeAt = here ? byId.get(here) : undefined;
  const partyRef = useRef<Point | null>(null);
  if (!walkingRef.current) partyRef.current = homeAt ? centre(homeAt) : null;
  /** Which way the party faces: the way it last walked. */
  const facingRef = useRef<CharacterFacing>("down");
  const camera = useCallback(
    (at: Point) => overworldCamera(at, worldSize, size, scale),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [worldSize.width, worldSize.height, scale, size],
  );
  const restingCamera = camera(lookAt ?? partyRef.current ?? { x: worldSize.width / 2, y: worldSize.height / 2 });
  const [cameraX, cameraY] = [restingCamera.x, restingCamera.y];

  const draw = useCallback(
    (cam: Point, frame = 1) => {
      const step = frame !== 1;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || size.width === 0) return;
      const dpr = window.devicePixelRatio || 1;
      const width = Math.round(size.width * dpr);
      const height = Math.round(size.height * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#05060a";
      ctx.fillRect(0, 0, width, height);
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, -cam.x * dpr, -cam.y * dpr);
      const pattern = ctx.createPattern(beyond, "repeat");
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(
          Math.floor(cam.x / scale / OVERWORLD_TILE - 1) * OVERWORLD_TILE,
          Math.floor(cam.y / scale / OVERWORLD_TILE - 1) * OVERWORLD_TILE,
          size.width / scale + OVERWORLD_TILE * 3,
          size.height / scale + OVERWORLD_TILE * 3,
        );
      }
      // Smooth only where the base is shown smaller than it was drawn (an image pack's art).
      ctx.imageSmoothingEnabled = drawTile.image && resolution > scale * dpr;
      ctx.drawImage(ground, 0, 0, ground.width / resolution, ground.height / resolution);
      ctx.drawImage(markers, 0, 0, markers.width / resolution, markers.height / resolution);
      ctx.imageSmoothingEnabled = false;
      const party = partyRef.current;
      if (party) {
        const [x, y] = [Math.round(party.x) - 8, Math.round(party.y) - 14 - (step ? 1 : 0)];
        const drawn = drawTile.character(
          ctx,
          "party",
          Math.round(party.x) - 8,
          Math.round(party.y) - 8,
          facingRef.current,
          frame,
        );
        if (!drawn && !drawTile(ctx, "party", x, y)) paintParty(ctx, x + 1, y + 1, step);
      }
      if (darkness > 0) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = `rgba(40, 52, 120, ${Math.min(0.85, darkness * 1.5)})`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = "source-over";
      }
      if (layerRef.current) layerRef.current.style.transform = `translate(${-cam.x}px, ${-cam.y}px)`;
    },
    [beyond, darkness, drawTile, ground, markers, resolution, scale, size.height, size.width],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!walkingRef.current) draw({ x: cameraX, y: cameraY });
  }, [cameraX, cameraY, draw, here]);
  // When the party is somewhere new, the view goes with it.
  useEffect(() => setLookAt(null), [here]);

  // The walk's frames draw with the latest view (the screen may turn mid-walk) and stop with the overworld.
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const cameraOfRef = useRef(camera);
  cameraOfRef.current = camera;
  const frameRef = useRef<number | null>(null);
  const arrivalRef = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      arrivalRef.current?.();
    },
    [],
  );

  /** Shows a settlement: chosen, and in view. */
  const choose = useCallback(
    (id: string | null) => {
      setSelected(id);
      const place = id ? byId.get(id) : undefined;
      if (place) setLookAt(centre(place));
    },
    [byId],
  );

  // ── Dragging the map to look around ──
  const dragRef = useRef<{ x: number; y: number; from: Point; moved: boolean } | null>(null);
  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (walkingRef.current) return;
    const from = lookAt ?? partyRef.current ?? { x: worldSize.width / 2, y: worldSize.height / 2 };
    dragRef.current = { x: event.clientX, y: event.clientY, from, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_PIXELS) return;
    drag.moved = true;
    setLookAt({ x: drag.from.x - dx / scale, y: drag.from.y - dy / scale });
  };
  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    // A press that did not drag is a click on the open map: the card closes.
    if (drag && !drag.moved) setSelected(null);
  };

  // ── Walking ──
  const route = useMemo(
    () => (here && selected && selected !== here ? worldTrip(game, here, selected) : null),
    [game, here, selected],
  );
  const startWalk = useCallback(
    async (to: string) => {
      if (!canWalk || walkingRef.current) return;
      // Under way from the first click, so a second one while the clock is sent starts nothing.
      walkingRef.current = true;
      await flush();
      let result;
      try {
        result = await walkMutation.mutateAsync({ chatId, to });
      } catch (error) {
        walkingRef.current = false;
        toast.error(error instanceof Error && error.message ? error.message : t("game.overworld.walkFailed"));
        return;
      }
      const points = result.route.path.flatMap((id) => {
        const place = byId.get(id);
        return place ? [centre(place)] : [];
      });
      const lengths = points
        .slice(1)
        .map((point, index) => Math.hypot(point.x - points[index]!.x, point.y - points[index]!.y));
      const total = lengths.reduce((sum, length) => sum + length, 0);
      const duration = Math.min(
        WALK_LONGEST_MS,
        Math.max(WALK_SHORTEST_MS, (total / OVERWORLD_TILE / WALK_CELLS_PER_SECOND) * 1000),
      );
      const fromDay = time?.day ?? 1;
      const fromMinutes = time ? time.hour * 60 + time.minute : 8 * 60;
      walkingRef.current = true;
      setWalking(true);
      setSelected(null);
      setLookAt(null);
      const started = performance.now();
      // The clock as the walk left it, shown once the party arrives (or the overworld closes first).
      arrivalRef.current = () => {
        arrivalRef.current = null;
        const snapshot = useGameStateStore.getState().current;
        if (snapshot?.chatId === chatId) {
          useGameStateStore.getState().setGameState({ ...snapshot, time: result.formatted });
        }
      };
      const frame = (now: number) => {
        const progress = Math.min(1, (now - started) / duration);
        let along = progress * total;
        let at = points[0]!;
        for (let index = 0; index < lengths.length; index++) {
          const length = lengths[index]!;
          if (along <= length || index === lengths.length - 1) {
            const share = length === 0 ? 1 : Math.min(1, along / length);
            const [a, b] = [points[index]!, points[index + 1]!];
            at = { x: a.x + (b.x - a.x) * share, y: a.y + (b.y - a.y) * share };
            // Facing the way the leg goes, by its larger axis.
            facingRef.current = characterFacing(b.x - a.x, b.y - a.y, facingRef.current);
            break;
          }
          along -= length;
        }
        partyRef.current = at;
        if (walkChipRef.current) {
          const day = fromDay + Math.floor((fromMinutes + result.route.days * 24 * 60 * progress) / (24 * 60));
          walkChipRef.current.textContent = t("game.overworld.walking", { day });
        }
        drawRef.current(cameraOfRef.current(at), characterFrameAt(now));
        if (progress < 1) {
          frameRef.current = requestAnimationFrame(frame);
          return;
        }
        frameRef.current = null;
        walkingRef.current = false;
        setWalking(false);
        arrivalRef.current?.();
      };
      frameRef.current = requestAnimationFrame(frame);
    },
    [byId, canWalk, chatId, flush, t, time, walkMutation],
  );

  const tripText = (days: number) =>
    days < 1
      ? t("game.overworld.tripHours", { count: Math.max(1, Math.round(days * 24)) })
      : t("game.overworld.tripDays", { count: Math.round(days * 2) / 2 });
  const sizeLabel = (place: WorldPlace) =>
    kit.sizes.find((entry) => entry.id === place.size)?.label ?? place.size ?? "";
  const placeWords = (place: WorldPlace) =>
    siteIds.has(place.id)
      ? t("game.overworld.siteWords")
      : [sizeLabel(place), ...(ruined.has(place.id) ? [t("game.overworld.ruined")] : [])].join(", ");
  const walkedTo = overworld?.walk ? byId.get(overworld.walk.to) : undefined;
  const chosen = selected ? byId.get(selected) : undefined;
  const cell = OVERWORLD_TILE * scale;
  // The card beside its settlement, kept on screen: below it when the settlement is near the top.
  const cardAt = chosen
    ? (() => {
        const x =
          Math.min(Math.max(chosen.at.x * cell + cell / 2 - restingCamera.x, 120), size.width - 120) + restingCamera.x;
        const below = chosen.at.y * cell - restingCamera.y < 180;
        return { left: x, top: below ? chosen.at.y * cell + cell + 18 : chosen.at.y * cell - 6, below };
      })()
    : null;

  return (
    <>
      <div
        ref={containerRef}
        className="absolute inset-0 z-0 overflow-clip bg-black"
        role="region"
        aria-label={t("game.overworld.region")}
        data-component="WorldOverworld"
        data-tiles={drawTile.loading ? "loading" : drawTile.image ? "image" : "drawn"}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none [image-rendering:pixelated]"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (dragRef.current = null)}
        />
        <div
          ref={layerRef}
          className="absolute left-0 top-0"
          style={{ transform: `translate(${-restingCamera.x}px, ${-restingCamera.y}px)` }}
        >
          {settlements.map(({ place }) => {
            const isHere = place.id === here && !walking;
            const tier = siteIds.has(place.id) ? 0 : settlementTier(place, top);
            const words = placeWords(place);
            return (
              <div
                key={place.id}
                className="absolute"
                style={{ left: place.at.x * cell, top: place.at.y * cell, width: cell, height: cell }}
              >
                <button
                  type="button"
                  onClick={() => choose(selected === place.id ? null : place.id)}
                  onFocus={() => setLookAt(centre(place))}
                  className={cn(
                    // The hit area reaches past the cell, so a small village is easy to tap on a phone.
                    "absolute inset-0 rounded-sm outline-none transition-shadow before:absolute before:-inset-2 before:content-[''] hover:ring-2 hover:ring-white/60 focus-visible:ring-2 focus-visible:ring-white",
                    selected === place.id && "ring-2 ring-[var(--primary)]",
                  )}
                  aria-label={
                    isHere
                      ? t("game.overworld.settlementHere", { name: place.name, size: words })
                      : t("game.overworld.settlement", { name: place.name, size: words })
                  }
                  aria-pressed={selected === place.id}
                />
                {(tier >= 2 || isHere || selected === place.id) && (
                  <span
                    className={cn(
                      "pointer-events-none absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded px-1 text-[0.625rem] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]",
                      isHere && "bg-black/45",
                    )}
                    aria-hidden="true"
                  >
                    {place.name}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* Above the narration: the card, the places and what the walk is doing. Clicks pass between them. */}
      <div className="pointer-events-none absolute inset-0 z-[25] overflow-clip" data-component="WorldOverworld.Chrome">
        {chosen && cardAt && (
          <div
            data-game-section="world-card"
            className={cn(
              GAME_SECTION_CLASS,
              "pointer-events-auto absolute z-10 w-56 -translate-x-1/2 rounded-xl border border-white/15 bg-black/80 p-3 text-xs text-white/85 shadow-xl backdrop-blur-md",
              !cardAt.below && "-translate-y-full",
            )}
            style={{ left: cardAt.left - restingCamera.x, top: cardAt.top - restingCamera.y }}
            data-component="WorldOverworld.Card"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{chosen.name}</div>
                <div className="text-white/55">{placeWords(chosen)}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded p-0.5 text-white/50 hover:text-white"
                aria-label={t("game.overworld.close")}
              >
                <X size={12} />
              </button>
            </div>
            {chosen.id === here ? (
              <>
                <div className="mt-2 text-white/60">{t("game.overworld.here")}</div>
                {siteIds.has(chosen.id) ? (
                  <button
                    type="button"
                    disabled={!canWalk || walking || enterMutation.isPending}
                    onClick={() =>
                      enterMutation.mutate(
                        { chatId, place: chosen.id },
                        {
                          onSuccess: () => setSelected(null),
                          onError: (error) =>
                            toast.error(
                              error instanceof Error && error.message ? error.message : t("game.overworld.enterFailed"),
                            ),
                        },
                      )
                    }
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    <DoorOpen size={13} />
                    {t("game.overworld.enter", { name: chosen.name })}
                  </button>
                ) : (
                  onEnterTown && (
                    <button
                      type="button"
                      disabled={walking}
                      onClick={onEnterTown}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      <DoorOpen size={13} />
                      {t("game.overworld.enter", { name: chosen.name })}
                    </button>
                  )
                )}
              </>
            ) : sealed(chosen.id) ? (
              <div className="mt-2 text-white/60">{t("game.overworld.sealed")}</div>
            ) : route ? (
              <>
                <div className="mt-2">{tripText(route.days)}</div>
                <div className="text-white/55">
                  {t("game.overworld.tripBy", {
                    ways: [
                      ...new Set(
                        route.legs.map((leg) => kit.travel.find((way) => way.id === leg.way)?.label ?? leg.way),
                      ),
                    ].join(", "),
                  })}
                </div>
                <button
                  type="button"
                  disabled={!canWalk || walking || walkMutation.isPending}
                  onClick={() => void startWalk(chosen.id)}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <Footprints size={13} />
                  {t("game.overworld.walk")}
                </button>
              </>
            ) : (
              <div className="mt-2 text-white/60">{t("game.overworld.noWay")}</div>
            )}
          </div>
        )}

        {/* The places, nearest first: the same choice as the map, by keyboard or for a place off screen. */}
        <div className="pointer-events-auto absolute right-3 top-14 z-10 flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={() => setPlacesOpen((open) => !open)}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/65 px-3 py-1.5 text-xs font-semibold text-white/85 shadow-lg backdrop-blur-md transition-colors hover:bg-black/80 hover:text-white"
            aria-expanded={placesOpen}
          >
            <MapPin size={13} />
            {t("game.overworld.places")}
          </button>
          {placesOpen && (
            <ul
              className="max-h-[45vh] w-60 overflow-y-auto rounded-xl border border-white/15 bg-black/80 p-1 text-xs text-white/85 shadow-xl backdrop-blur-md"
              aria-label={t("game.overworld.places")}
            >
              {settlements.map(({ place, days }) => (
                <li key={place.id}>
                  <button
                    type="button"
                    onClick={() => {
                      choose(place.id);
                      setPlacesOpen(false);
                    }}
                    className="flex w-full items-baseline justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/10"
                  >
                    <span className="min-w-0 truncate font-medium text-white">{place.name}</span>
                    <span className="shrink-0 text-[0.625rem] text-white/50">
                      {place.id === here ? t("game.overworld.youAreHere") : Number.isFinite(days) ? tripText(days) : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {walking && (
          <div className="pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white shadow-lg">
            <span ref={walkChipRef} />
          </div>
        )}
        {!walking && walkedTo && (
          <div
            className="pointer-events-none absolute left-1/2 top-16 z-10 max-w-[60%] -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-center text-xs text-white/85 shadow-lg"
            role="status"
          >
            {t("game.overworld.walked", { name: walkedTo.name })}
          </div>
        )}
      </div>
    </>
  );
}
