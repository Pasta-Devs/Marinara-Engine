/**
 * Paying with a ruleset's coins (#6901). Coins are stacks (`coin:<unit>`), so a purse is the coins in
 * one bag, and paying changes those stacks.
 *
 * A price is paid inside the one family of coins it is named in, never across families. The largest
 * coins go first, as many as fit the price without going over; what is still owed is paid by breaking
 * the smallest coin left that covers it, and the change comes back in the family's smaller coins,
 * largest first. So 5 gold is paid with 3 gold and 20 of 30 silver, and 1 silver out of 10 gold leaves
 * 9 gold and 9 silver. Pure: the caller saves the stacks.
 */
import {
  gameInventoryBagKey,
  newGameInventoryStackId,
  type GameInventoryCoin,
  type GameInventoryStack,
} from "./game-inventory-stacks.js";

/** How many of each coin changed hands, by name: what was handed over, and what came back as change. */
export interface GameInventoryPayment {
  paid: Array<{ name: string; count: number }>;
  change: Array<{ name: string; count: number }>;
}

/** What one bag's coins of a family are worth, in the family's smallest coin. */
export function gameInventoryCoinWorth(
  stacks: readonly GameInventoryStack[],
  holder: string | undefined,
  family: readonly GameInventoryCoin[],
): number {
  const bag = gameInventoryBagKey(holder);
  return family.reduce(
    (sum, coin) =>
      sum +
      coin.value *
        stacks
          .filter((stack) => stack.item === coin.item && gameInventoryBagKey(stack.holder) === bag)
          .reduce((count, stack) => count + stack.quantity, 0),
    0,
  );
}

/**
 * Pay `owed` (in the family's smallest coin) out of one bag's coins of `family` (every coin of it,
 * largest first). Refused when the bag's coins of that family are worth less.
 */
export function payGameInventoryCoins(
  stacks: readonly GameInventoryStack[],
  holder: string | undefined,
  family: readonly GameInventoryCoin[],
  owed: number,
  /** The coins change comes back in where they make it: those prices are written in (laptop pass 6,
   *  2026-10-26: an inn's change came back in electrum, a coin no 5e price uses). */
  changeIn?: readonly string[],
): ({ ok: true; stacks: GameInventoryStack[] } & GameInventoryPayment) | { ok: false; reason: "cannot-afford" } {
  const bag = gameInventoryBagKey(holder);
  const mine = (stack: GameInventoryStack, coin: GameInventoryCoin) =>
    stack.item === coin.item && gameInventoryBagKey(stack.holder) === bag;
  const held = new Map(
    family.map((coin) => [coin.item, stacks.filter((stack) => mine(stack, coin)).reduce((n, s) => n + s.quantity, 0)]),
  );
  if (gameInventoryCoinWorth(stacks, holder, family) < owed) return { ok: false, reason: "cannot-afford" };
  const largestFirst = [...family].sort((a, b) => b.value - a.value);
  const taken = new Map<string, number>();
  let left = owed;
  for (const coin of largestFirst) {
    const count = Math.min(held.get(coin.item) ?? 0, Math.floor(left / coin.value));
    if (count > 0) taken.set(coin.item, count);
    left -= count * coin.value;
  }
  const given = new Map<string, number>();
  if (left > 0) {
    // Every coin still held is worth more than what is left, so the smallest of them covers it.
    const broken = [...largestFirst]
      .reverse()
      .find((coin) => (held.get(coin.item) ?? 0) - (taken.get(coin.item) ?? 0) > 0)!;
    taken.set(broken.item, (taken.get(broken.item) ?? 0) + 1);
    // The change is worth less than the coin broken, so it comes back in smaller coins only: the
    // usual ones where they make it, else any.
    const owedBack = broken.value - left;
    const makeChange = (coins: readonly GameInventoryCoin[]) => {
      const back = new Map<string, number>();
      let change = owedBack;
      for (const coin of coins) {
        const count = Math.floor(change / coin.value);
        if (count > 0) back.set(coin.item, count);
        change -= count * coin.value;
      }
      return change === 0 ? back : undefined;
    };
    const usual = changeIn ? largestFirst.filter((coin) => changeIn.includes(coin.item)) : undefined;
    for (const [item, count] of (usual && makeChange(usual)) || makeChange(largestFirst)!) given.set(item, count);
  }
  // The coins handed over come off the bag's stacks of them, first stack first.
  const owedOf = new Map(taken);
  let next: GameInventoryStack[] = stacks.flatMap((stack) => {
    const due = stack.item ? (owedOf.get(stack.item) ?? 0) : 0;
    if (due === 0 || gameInventoryBagKey(stack.holder) !== bag) return [stack];
    const off = Math.min(due, stack.quantity);
    owedOf.set(stack.item!, due - off);
    return stack.quantity - off > 0 ? [{ ...stack, quantity: stack.quantity - off }] : [];
  });
  // And the change as new stacks. The bag never still holds a coin given as change: every coin smaller
  // than the one broken was paid over whole, or it would have been broken instead.
  for (const coin of largestFirst) {
    const count = given.get(coin.item) ?? 0;
    if (count === 0) continue;
    next = [
      ...next,
      {
        id: newGameInventoryStackId(next),
        name: coin.name,
        item: coin.item,
        quantity: count,
        ...(holder ? { holder } : {}),
      },
    ];
  }
  const named = (counts: Map<string, number>) =>
    largestFirst.flatMap((coin) => {
      const count = counts.get(coin.item) ?? 0;
      return count > 0 ? [{ name: coin.name, count }] : [];
    });
  return { ok: true, stacks: next, paid: named(taken), change: named(given) };
}

/**
 * Pay `owed` out of several bags in turn (laptop playtest 2026-10-25: "the party's coin" took it all
 * from one purse, or refused): out of the first alone where it can, else each bag's coins of `family`
 * in turn, the first first, until it is paid. Refused when all of them together are worth less.
 */
export function payGameInventoryCoinsTogether(
  stacks: readonly GameInventoryStack[],
  holders: ReadonlyArray<string | undefined>,
  family: readonly GameInventoryCoin[],
  owed: number,
  changeIn?: readonly string[],
): ({ ok: true; stacks: GameInventoryStack[] } & GameInventoryPayment) | { ok: false; reason: "cannot-afford" } {
  const [first, ...rest] = holders;
  const alone = payGameInventoryCoins(stacks, first, family, owed, changeIn);
  if (alone.ok || rest.length === 0) return alone;
  const total = holders.reduce((sum, holder) => sum + gameInventoryCoinWorth(stacks, holder, family), 0);
  if (total < owed) return { ok: false, reason: "cannot-afford" };
  let current: GameInventoryStack[] = [...stacks];
  let left = owed;
  const paid = new Map<string, number>();
  const change = new Map<string, number>();
  for (const holder of holders) {
    if (left <= 0) break;
    const share = Math.min(left, gameInventoryCoinWorth(current, holder, family));
    if (share <= 0) continue;
    const part = payGameInventoryCoins(current, holder, family, share, changeIn);
    if (!part.ok) return part;
    current = part.stacks;
    left -= share;
    for (const each of part.paid) paid.set(each.name, (paid.get(each.name) ?? 0) + each.count);
    for (const each of part.change) change.set(each.name, (change.get(each.name) ?? 0) + each.count);
  }
  const listed = (counts: Map<string, number>) => [...counts].map(([name, count]) => ({ name, count }));
  return { ok: true, stacks: current, paid: listed(paid), change: listed(change) };
}
