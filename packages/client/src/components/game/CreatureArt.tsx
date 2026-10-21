// A creature's art on a fight's board (design-game-creature-art.md): the creature pack chosen in the
// library, which of its creatures a fighter is, the way it faces, and its frame drawn at its own size,
// bottom centred on its cell. A fighter with no art keeps its token.
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  creatureArtBox,
  creatureArtFrame,
  creatureFacingToward,
  creaturePackSchema,
  findCreatureArt,
  type CreatureArtFor,
  type CreatureFacing,
  type CreaturePack,
  type CreaturePackCreature,
} from "@marinara-engine/shared";
import { api } from "../../lib/api-client";

/** The creature pack chosen in the library, or none (none chosen, none stored, or one that does not read). */
export function useCreaturePack(): CreaturePack | null {
  const { data } = useQuery({
    queryKey: ["game", "creature-pack"],
    queryFn: async () => {
      try {
        const answer = await api.get<{ pack: unknown }>("/game-tile-packs/creatures");
        const parsed = creaturePackSchema.safeParse(answer.pack);
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60_000,
  });
  return data ?? null;
}

/** The creature packs the game's Experience ships (Capability API 1.344), put in place by the game's
 *  screen for the fights it shows. */
export const ExperienceCreaturePacksContext = createContext<readonly CreaturePack[]>([]);

/** Every creature pack a fight draws from: the Experience's own, in its order, then the library's. */
export function useCreaturePacks(): readonly CreaturePack[] {
  const own = useContext(ExperienceCreaturePacksContext);
  const chosen = useCreaturePack();
  return useMemo(() => (chosen ? [...own, chosen] : own), [own, chosen]);
}

/** A fighter's art in the first pack that has it, with that pack. */
export function findCreatureArtIn(
  packs: readonly CreaturePack[],
  who: CreatureArtFor,
): { pack: CreaturePack; creature: CreaturePackCreature } | null {
  for (const pack of packs) {
    const creature = findCreatureArt(pack, who);
    if (creature) return { pack, creature };
  }
  return null;
}

interface Placed {
  id: string;
  x: number;
  y: number;
  side: string;
}

/** Which way each fighter faces: the way it last moved, else toward the other side's fighters. Kept
 *  between renders, so a fighter that stands still keeps facing where it last turned. */
export function useCreatureFacings(
  units: readonly Placed[],
  /** Which fight it is: a new one starts every fighter afresh, even one with an id the last had. */
  fight: string,
): ReadonlyMap<string, CreatureFacing> {
  const last = useRef(new Map<string, { x: number; y: number; facing: CreatureFacing }>());
  const lastFight = useRef(fight);
  const key = units.map((unit) => `${unit.id}:${unit.x},${unit.y}`).join("|");
  // Worked out from what the last committed render remembered, and remembered only once this one
  // commits, so a render React throws away never turns anybody.
  const seen = useMemo(() => {
    const remembered =
      lastFight.current === fight ? last.current : new Map<string, { x: number; y: number; facing: CreatureFacing }>();
    // Only the fighters still on the board are remembered.
    const next = new Map<string, { x: number; y: number; facing: CreatureFacing }>();
    const out = new Map<string, CreatureFacing>();
    for (const unit of units) {
      const before = remembered.get(unit.id);
      let facing: CreatureFacing;
      if (before) facing = creatureFacingToward(unit.x - before.x, unit.y - before.y, before.facing);
      else {
        const others = units.filter((other) => other.side !== unit.side);
        const [cx, cy] = others.length
          ? [
              others.reduce((sum, other) => sum + other.x, 0) / others.length,
              others.reduce((sum, other) => sum + other.y, 0) / others.length,
            ]
          : [unit.x, unit.y + 1];
        facing = creatureFacingToward(cx - unit.x, cy - unit.y, "down");
      }
      next.set(unit.id, { x: unit.x, y: unit.y, facing });
      out.set(unit.id, facing);
    }
    return { out, next };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fight]);
  useEffect(() => {
    last.current = seen.next;
    lastFight.current = fight;
  }, [seen, fight]);
  return seen.out;
}

/** A creature's frame, filling a box one cell wide and placed by its size: absolutely positioned inside
 *  an element that is one cell (`cellFraction` of its width is a cell: a token 0.9 of a cell gives 1/0.9). */
export function CreatureArtFigure({
  pack,
  creature,
  variant,
  facing,
  cellFraction = 1,
  label,
}: {
  pack: CreaturePack;
  creature: CreaturePackCreature;
  variant: number;
  facing: CreatureFacing;
  cellFraction?: number;
  label: string;
}) {
  const frame = creatureArtFrame(pack, creature, variant, facing);
  const sheet = pack.sheets.find((each) => each.id === frame.sheet);
  if (!sheet) return null;
  const box = creatureArtBox(creature);
  const percent = (cells: number) => `${cells * cellFraction * 100}%`;
  // The frame cropped out of its sheet with the background's own size and position, in percentages so it
  // scales with the board.
  const position = (offset: number, sheetSize: number, frameSize: number) =>
    sheetSize > frameSize ? `${(offset / (sheetSize - frameSize)) * 100}%` : "0%";
  return (
    <span
      role="img"
      aria-label={label}
      data-creature-art={creature.id}
      data-facing={facing}
      className="pointer-events-none absolute block [image-rendering:pixelated]"
      style={{
        // Bottom centred on the cell the element stands for.
        left: `calc(50% + ${percent(box.left - 0.5)})`,
        bottom: `calc(50% - ${percent(0.5)})`,
        width: percent(box.width),
        height: percent(box.height),
        backgroundImage: `url("${sheet.png}")`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${(sheet.width / frame.sw) * 100}% ${(sheet.height / frame.sh) * 100}%`,
        backgroundPosition: `${position(frame.sx, sheet.width, frame.sw)} ${position(frame.sy, sheet.height, frame.sh)}`,
      }}
    />
  );
}
