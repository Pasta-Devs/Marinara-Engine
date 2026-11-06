// ──────────────────────────────────────────────
// A creature's art in a fight (design-game-creature-art.md): which of a creature pack's creatures a
// fighter is (its bestiary entry first, then its name), which of its looks it wears (the same one every
// time), which way it faces, and how big it is drawn. Never read by a fight's rules.
// ──────────────────────────────────────────────
import type { CreatureFacing, CreaturePack, CreaturePackCreature } from "../world/creature-pack.js";
import { rulesetAirborne } from "../ruleset-combat/grid.js";
import type { RulesetCombatant } from "../ruleset-combat/types.js";
import type { TacticalGrid } from "./types.js";

/** A name or a ref as a Game Master writes it: case and punctuation set aside, as a bestiary is searched. */
function plainly(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** A name without a trailing number: "Goblin 2" is a goblin. Trimmed by hand, not by a regular
 *  expression, so a long run of digits costs one pass. */
function plainName(name: string): string {
  let end = name.trimEnd().length;
  const digitsEnd = end;
  while (end > 0 && name.charCodeAt(end - 1) >= 48 && name.charCodeAt(end - 1) <= 57) end--;
  if (end === digitsEnd) return plainly(name);
  if (end > 0 && name[end - 1] === "#") end--;
  return plainly(name.slice(0, end));
}

/** Whether a fight's ruleset is the one a three-part ref names: its id, or its id under a community
 *  namespace ("someone:5e-2014"). */
function sameRuleset(rulesetId: string | undefined, named: string): boolean {
  if (!rulesetId) return false;
  const wanted = named.toLowerCase();
  const id = rulesetId.toLowerCase();
  return id === wanted || id.endsWith(`:${wanted}`) || id.endsWith(`/${wanted}`);
}

export interface CreatureArtFor {
  /** A ruleset fighter's bestiary entry, when it was made from one. */
  /** `from`: the lender's ruleset and catalog, for a creature out of a borrowed catalog (1.220). */
  creature?: { catalogId: string; entryId: string; from?: { ruleset: string; catalog: string } };
  /** The fight's ruleset, for a ref that names one. */
  rulesetId?: string;
  /** Its name in the fight ("Goblin 2"). */
  name: string;
}

/** The pack's creature a fighter is: the one whose `match` names its bestiary entry, else its name, else
 *  none. The pack's order breaks a tie. */
export function findCreatureArt(
  pack: CreaturePack | null | undefined,
  who: CreatureArtFor,
): CreaturePackCreature | null {
  if (!pack) return null;
  if (who.creature) {
    const { catalogId, entryId, from } = who.creature;
    // A borrowed creature is drawn as the lender's: its art names the lender's ruleset and catalog.
    const rulesetId = from ? from.ruleset : who.rulesetId;
    const two = plainly(`${from ? from.catalog : catalogId}/${entryId}`);
    for (const creature of pack.creatures)
      for (const ref of creature.match) {
        const parts = ref.split("/");
        if (parts.length === 2 && plainly(ref) === two) return creature;
        if (parts.length === 3 && sameRuleset(rulesetId, parts[0]!) && plainly(`${parts[1]}/${parts[2]}`) === two)
          return creature;
      }
  }
  const name = plainName(who.name);
  if (!name) return null;
  for (const creature of pack.creatures)
    for (const ref of creature.match) if (!ref.includes("/") && plainly(ref) === name) return creature;
  return null;
}

/** Which of a creature's looks a fighter wears: the same one for the same fight and fighter, so two
 *  goblins can look different and each keeps its look. */
export function creatureArtVariant(creature: CreaturePackCreature, fightKey: string, unitId: string): number {
  let hash = 0x811c9dc5;
  for (const char of `${fightKey}|${unitId}`) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return hash % creature.variants.length;
}

/** The way a fighter faces after moving or striking by (dx, dy) on the board (y grows downward): the
 *  greater of the two, ties to the side-on facing; no change for no move. */
export function creatureFacingToward(dx: number, dy: number, previous: CreatureFacing): CreatureFacing {
  if (dx === 0 && dy === 0) return previous;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

/** Where a creature's frame is drawn over its cell, in cells: its own size, bottom centred on the cell,
 *  so a Large creature stands over its neighbours (a fight's footprints are its rules', not the art's). */
export function creatureArtBox(creature: Pick<CreaturePackCreature, "w" | "h">): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  return { left: (1 - creature.w) / 2, top: 1 - creature.h, width: creature.w, height: creature.h };
}

/** A frame's top-left pixel on its sheet: the facing's row, the standing frame of a walking block. In the
 *  air (`flying`), the frame `step` of its flying block for its look, when it has one (1.352). */
export function creatureArtFrame(
  pack: Pick<CreaturePack, "tileSize">,
  creature: CreaturePackCreature,
  variant: number,
  facing: CreatureFacing,
  step: 0 | 1 | 2 = 1,
  flying = false,
): { sheet: string; sx: number; sy: number; sw: number; sh: number } {
  const at = Math.max(0, Math.min(creature.variants.length - 1, variant));
  const fly = flying && creature.fly ? (creature.fly[at] ?? creature.fly[0]!) : null;
  const look = fly ?? creature.variants[at]!;
  const row = ["down", "left", "right", "up"].indexOf(facing);
  const column = fly || creature.frames === 3 ? step : 0;
  const [sw, sh] = [creature.w * pack.tileSize, creature.h * pack.tileSize];
  return { sheet: look.sheet, sx: look.x * pack.tileSize + column * sw, sy: look.y * pack.tileSize + row * sh, sw, sh };
}

/**
 * Whether a ruleset fighter is shown flying (1.352): it is in the air (its `airborne` flag, 1.354), up
 * above the ground, or a flier with no walk, which never lands. Art
 * only: never read by the fight's rules.
 */
export function rulesetCombatantFlying(grid: TacticalGrid | undefined, combatant: RulesetCombatant): boolean {
  if (!(combatant.speeds?.fly ?? 0)) return false;
  return Boolean(combatant.airborne || combatant.speed <= 0 || rulesetAirborne(grid, combatant));
}
