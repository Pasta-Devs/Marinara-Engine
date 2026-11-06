// A ruleset's items in the Engine's own fights (Classic and Tactical), for a ruleset that does not
// resolve its fights itself (#6905). A model used to guess what every item does when a fight began;
// one of the ruleset's items already says it in its `use`, so that is what the fight reads, on the
// same scale the combat bridge reads a catalog entry's numbers. An item of the ruleset that cannot be
// used is not offered, and the model only guesses for the items that are not the ruleset's.

import type { CombatItemEffect } from "../../types/combat-encounter.js";
import { rulesetChargesStart } from "../ruleset-combat/dice.js";
import {
  gameInventoryDrawRefusal,
  gameInventoryFightEffects,
  gameInventoryFightLines,
  gameInventoryNameKey,
  gameInventoryWearMet,
  gameInventoryWearNeeds,
  type GameInventoryFightLine,
  type GameInventoryItemRules,
  type GameInventoryStack,
} from "../../utils/game-inventory-stacks.js";
import { AVERAGE_AMOUNT_PER_POWER, averageAmount } from "./combat-bridge.js";
import {
  rulesetItemGateDifficulty,
  rulesetItemGateText,
  rulesetItemUseDoes,
  type RulesetItemBook,
  type RulesetItemBookEntry,
} from "./item-book.js";

/** The share of its maximum health that one typical hit takes in the Engine's own fights, whose
 *  combatants carry around 60 hit points and deal 11 to 15 a hit (see `carryHealthShare`). An item that
 *  heals or harms `AVERAGE_AMOUNT_PER_POWER` on average, as a basic weapon does, is one such hit. */
const TYPICAL_HIT_SHARE = 0.22;

/**
 * What one of the ruleset's items does in the Engine's own fights, from its `use`, under the name the
 * fight lists it by; null for an item those fights cannot use. A heal heals and an attack harms, by the
 * share of the target's maximum health its dice come to, with its damage type as the element; the
 * first condition it puts on becomes a status by the ruleset's own name, and a buff or debuff is that
 * status alone. An item used up is spent; one that holds charges spends them (#6909); one that is
 * neither stays. A gate is rolled by the server when the item is used. What the Engine's fights have
 * no place for (a roll to hit, a save, an area, temporary points, a pool restored) is left to the
 * description, as the combat bridge leaves it for a catalog entry.
 */
export function rulesetItemFightEffect(
  name: string,
  read: (Pick<RulesetItemBookEntry, "entry" | "facts"> & Partial<Pick<RulesetItemBookEntry, "drawOnUse">>) | undefined,
): CombatItemEffect | null {
  const item = read?.entry.item;
  const use = item?.use;
  const said = read?.facts.use;
  if (!item || !use || !said) return null;
  // A charge it cannot count, or a gate whose difficulty it cannot say, is a use the Engine cannot
  // make, as the Use button refuses it.
  if (use.charges !== undefined && !said.charges) return null;
  if (use.gate && rulesetItemGateDifficulty(item, use.gate) === undefined) return null;
  const average = averageAmount(use.amount);
  const power =
    average === null
      ? undefined
      : Math.min(1, Math.max(0.05, Math.round((average / AVERAGE_AMOUNT_PER_POWER) * TYPICAL_HIT_SHARE * 100) / 100));
  const condition = said.applies?.[0];
  // Nothing the Engine could do: a heal with no amount, or an attack with neither harm nor a condition.
  if (use.kind === "heal" && power === undefined) return null;
  if (use.kind === "attack" && power === undefined && !condition) return null;
  const applied = use.applies?.[0];
  const rounds = applied && typeof applied.duration === "object" ? applied.duration.rounds : undefined;
  const helps = use.kind === "heal" || use.kind === "buff";
  // Drawn as it is used (1.808): used while only carried, and put on as it is used.
  const draws = read?.drawOnUse === true;
  const wear = gameInventoryWearNeeds({ ...item, drawOnUse: draws });
  return {
    name,
    target: use.targets ?? (helps ? "ally" : "enemy"),
    type: use.kind === "attack" ? (power === undefined ? "status" : "damage") : use.kind,
    description:
      [
        ...rulesetItemUseDoes(said),
        said.charges ? `spends ${said.charges.cost} of ${said.charges.max} charges` : "",
        said.gate ? rulesetItemGateText(said.gate) : "",
      ]
        .filter(Boolean)
        .join(", ") || name,
    ...(power !== undefined && (use.kind === "heal" || use.kind === "attack") ? { power } : {}),
    ...(use.damageType ? { element: use.damageType } : {}),
    ...(condition ? { status: { name: condition, emoji: helps ? "✨" : "💢", duration: rounds ?? 2 } } : {}),
    consumes: use.consumes === true,
    ...(said.charges
      ? {
          charges: {
            cost: said.charges.cost,
            max: said.charges.max,
            ...(said.charges.rolled ? { rolled: said.charges.rolled } : {}),
          },
        }
      : {}),
    ...(wear.equipped || wear.bound ? { wear } : {}),
    ...(draws ? { draws: true as const } : {}),
    ruleset: true,
  };
}

/**
 * The lines one of the Engine's fights offers once what each item does is known, on the server and on
 * the screen alike. Without `rulesetItems` (a game with no ruleset items) every item is offered. With
 * it, one of the ruleset's items is offered only when an effect the Engine worked out says what it
 * does, only from the stacks it may be used from (worn and bound where it asks it), and one that holds
 * charges only while a use is left, counted in uses rather than items; the rest are offered while the
 * ruleset leaves Game Mode's own items on.
 */
export function gameFightOffers(
  stacks: readonly GameInventoryStack[],
  effects: readonly CombatItemEffect[],
  rulesetItems: { native: boolean } | undefined,
  /** The ruleset's items with the slots every character has: one drawn as it is used (1.808) is
   *  offered only from a stack that could be drawn now. Without them, every such stack is. */
  rules?: GameInventoryItemRules,
): GameInventoryFightLine[] {
  const lines = gameInventoryFightLines(stacks);
  if (!rulesetItems) return lines;
  return lines.flatMap((line) => {
    if (!line.item) return rulesetItems.native ? [line] : [];
    const effect = effects.find(
      (each) => each.ruleset && gameInventoryNameKey(each.name) === gameInventoryNameKey(line.name),
    );
    if (!effect) return [];
    // Only the stacks it may be used from: worn and bound where the item asks it. A fake counts as
    // what it passes for (1.79).
    // One drawn as it is used (1.808), only where it could be drawn: not past a shield in the hand it needs.
    const usable = stacks.filter(
      (stack) =>
        stack.item === line.item &&
        gameInventoryWearMet(stack, effect.wear) &&
        (!effect.draws || !gameInventoryDrawRefusal(stacks, stack, rules)),
    );
    // A stack without a count of its own is full, and no stack holds more than its item's most.
    const charges = effect.charges;
    const uses = charges
      ? usable.reduce(
          (total, stack) =>
            total +
            Math.floor(
              Math.min(charges.max, stack.charges ?? rulesetChargesStart(charges, charges.max, stack.id)) /
                charges.cost,
            ),
          0,
        )
      : usable.reduce((total, stack) => total + stack.quantity, 0);
    return uses > 0 ? [{ ...line, quantity: uses }] : [];
  });
}

/**
 * The items one of the Engine's fights offers, and what each does: the ruleset's own items by their
 * `use` (and not at all when they have none), and the rest by what a model guessed, while the ruleset
 * leaves Game Mode's own items on. A guess no plain item takes is dropped (so one made for the
 * ruleset's items is), and so is any guess that claims to be the ruleset's. Without a book (a game
 * with no ruleset items) every item is guessed at, as before.
 */
export function gameFightItems(
  stacks: readonly GameInventoryStack[],
  book: (Pick<RulesetItemBook, "itemOf"> & Partial<GameInventoryItemRules>) | undefined,
  native: boolean,
  guessed: readonly CombatItemEffect[],
): { lines: GameInventoryFightLine[]; effects: CombatItemEffect[] } {
  const all = gameInventoryFightLines(stacks);
  const worked = book
    ? all.flatMap((line) => {
        // A fake is offered as what it passes for; what one use of it does is `gameFightUseEffect`'s.
        const effect = line.item ? rulesetItemFightEffect(line.name, book.itemOf(line.item)) : null;
        return effect ? [effect] : [];
      })
    : [];
  const lines = gameFightOffers(
    stacks,
    worked,
    book ? { native } : undefined,
    book?.slots ? (book as GameInventoryItemRules) : undefined,
  );
  const guesses = guessed.filter((effect) => !effect.ruleset);
  const plain = lines.filter((line) => !line.item || !book);
  const matched = gameInventoryFightEffects(plain, guesses);
  // With ruleset items, only a guess one of the plain items takes is kept: a guess made for one of the
  // ruleset's items is gone, and a plain item that shares its name keeps its own, whichever of the two
  // is listed first. Without them, every guess is kept, as before.
  const plainNames = new Set(plain.map((line) => gameInventoryNameKey(line.name)));
  return {
    lines,
    effects: [
      ...worked,
      ...(book ? matched.filter((effect) => plainNames.has(gameInventoryNameKey(effect.name))) : matched),
    ],
  };
}

/**
 * What one use of a fight's line does, when the stack it comes out of (`gameInventoryFightSpendStack`)
 * is a fake (1.79): what its true item does, aimed as the line was; and where its true item does
 * nothing a fight can use, the use is spent for nothing, and the log says what it really was. Unchanged
 * for any other stack. The use is spent as the line's is, and the inventory's journal names it truly.
 */
export function gameFightUseEffect(
  effect: CombatItemEffect,
  stack: Pick<GameInventoryStack, "truly"> | undefined,
  book: Pick<RulesetItemBook, "itemOf">,
): CombatItemEffect {
  if (!stack?.truly) return effect;
  const read = book.itemOf(stack.truly);
  const name = read?.name ?? stack.truly;
  const truly = rulesetItemFightEffect(effect.name, read);
  if (!truly) return { ...effect, failed: `It was really ${name}, and it did nothing.` };
  const { charges: _charges, wear: _wear, draws: _draws, consumes: _consumes, ...does } = truly;
  return {
    ...does,
    target: effect.target,
    description: effect.description,
    ...(effect.consumes !== undefined ? { consumes: effect.consumes } : {}),
    ...(effect.charges ? { charges: effect.charges } : {}),
    ...(effect.wear ? { wear: effect.wear } : {}),
    ...(effect.draws ? { draws: effect.draws } : {}),
  };
}
