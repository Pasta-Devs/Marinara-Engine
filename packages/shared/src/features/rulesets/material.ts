// A priced material (Capability API 1.790): what an entry cast from a sheet needs its user to carry,
// worth so much by the items' own cost. Read the same way in a fight, off what the fight has left of
// the bag, and outside one, off the bag itself: one reading, so what a fight offers is what the Game
// Master's `use` lets through.
//
// Only real items count: a fake passes for what it is not, and what a cast made or lent is no item
// of the bag. Nothing else stands in for it, a focus or a component pouch included.

import type { RulesetCatalogMechanics, RulesetDefinition } from "../../schemas/ruleset.schema.js";
import type { RulesetSheetItem } from "./sheet-math.js";

export type RulesetMaterial = NonNullable<RulesetCatalogMechanics["material"]>;

/** What one of `unit` is worth in the smallest coin of its family, or null for a unit the ruleset
 *  does not have. */
function unitValue(definition: RulesetDefinition, unit: string): number | null {
  for (const family of definition.items?.currencies ?? []) {
    const found = family.units.find((one) => one.id === unit);
    if (found) return found.value;
  }
  return null;
}

/** Whether a held item is one of the material's own. */
function counts(material: RulesetMaterial, held: RulesetSheetItem): boolean {
  if (held.truly || held.made || held.lent || !held.item.cost) return false;
  if (material.items && held.stack && material.items.includes(held.stack.ref)) return true;
  return !!material.tags && !!held.item.tags?.some((tag) => material.tags!.includes(tag));
}

/** The items that make up a priced material, by their place in `items` with how many of each, or
 *  null when what is carried is not worth enough. Kept items are only looked at; a consumed one is
 *  taken as it would be used: the one item worth the least while still enough, else the dearest
 *  first until enough is taken. `used` is how many of each place are gone already (a fight's). */
export function rulesetMaterialFor(
  definition: RulesetDefinition,
  material: RulesetMaterial,
  items: ReadonlyArray<RulesetSheetItem> | undefined,
  used?: Readonly<Record<string, number>>,
): Array<{ index: number; count: number }> | null {
  const need = unitValue(definition, material.worth.unit);
  if (need === null) return null;
  const wanted = material.worth.amount * need;
  const found = (items ?? []).flatMap((held, index) => {
    const left = Math.max(0, held.quantity - (used?.[index] ?? 0));
    const value = held.item.cost ? unitValue(definition, held.item.cost.unit) : null;
    if (!left || value === null || !counts(material, held)) return [];
    return [{ index, left, each: held.item.cost!.amount * value }];
  });
  const one = found.filter((entry) => entry.each >= wanted).sort((a, b) => a.each - b.each || a.index - b.index)[0];
  if (one) return [{ index: one.index, count: 1 }];
  const take: Array<{ index: number; count: number }> = [];
  let got = 0;
  for (const entry of found.filter((one) => one.each > 0).sort((a, b) => b.each - a.each || a.index - b.index)) {
    const count = Math.min(entry.left, Math.ceil((wanted - got) / entry.each));
    take.push({ index: entry.index, count });
    got += count * entry.each;
    if (got >= wanted) return take;
  }
  return null;
}
