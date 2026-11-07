// ──────────────────────────────────────────────
// Game: what a won Classic Marinara fight drops (marinara-items.ts tables, in a game)
//
// The bridge between the item tables and a running game: which setting a game's items come from (its
// kit, else its genre), and the loot of a won fight from the foes the party beat, as named stacks for
// the inventory and gold in the setting's own coin. Pure: the server adds what this returns.
// ──────────────────────────────────────────────

import type { MarinaraFighter } from "./marinara-combat.js";
import { marinaraBestiarySetting, marinaraEnemyFamily } from "./marinara-bestiary.js";
import {
  MARINARA_ACCESSORY_SLOTS,
  MARINARA_ITEM_SETTINGS,
  marinaraAllItemIds,
  marinaraCanEquip,
  marinaraGearBonus,
  marinaraItem,
  marinaraItemInPlace,
  marinaraItemName,
  marinaraItemPlace,
  marinaraItemPrice,
  marinaraPriceInCoin,
  marinaraRollLoot,
  marinaraRollSteal,
  marinaraShopCatalog,
  marinaraTierForLevel,
  type MarinaraEquipment,
  type MarinaraFoeRank,
  type MarinaraItemPlace,
  type MarinaraItemSetting,
} from "./marinara-items.js";
import { gameWorldKitFromMetadata, type WorldKit } from "../schemas/world-kit.schema.js";
import { worldKitArtFamily } from "./world/art-family.js";

/** Where a game's items come from: its starter kit, else its own kit's art family, else its genre. */
export function marinaraGameItemPlace(metadata: Record<string, unknown> | null | undefined): MarinaraItemPlace {
  const kit = gameWorldKitFromMetadata(metadata);
  if (kit) {
    const byId = marinaraItemPlace(kit.id);
    if (byId.setting) return byId;
    const family = worldKitArtFamily(kit);
    if (family && (MARINARA_ITEM_SETTINGS as readonly string[]).includes(family))
      return { setting: family as MarinaraItemSetting };
  }
  const setup = (metadata?.gameSetupConfig ?? undefined) as { genre?: unknown } | undefined;
  const genre = typeof setup?.genre === "string" ? setup.genre : null;
  return marinaraItemPlace(marinaraBestiarySetting(null, genre));
}

/** A coin of the game's money: its inventory item, its name for one, and its worth in the smallest coin. */
export interface MarinaraLootCoin {
  item: string;
  name: string;
  value: number;
}

/** One line the inventory adds: a named stack, or coins of the game's money by their item. */
export interface MarinaraLootLine {
  name: string;
  count: number;
  item?: string;
}

/**
 * What a fight leaves the party: each robbed foe's stolen thing (Steal), and on a win each beaten foe
 * rolls by its rank, its bestiary family and its own level's tier. Beaten is down, or out of the fight
 * alive (`left`, as the director keeps them): one that surrendered hands over everything, one that fled
 * (`fled` ids) only half its gold, dropped as it ran. Gold comes in the game's coins (largest first)
 * when it has money, else as "Coins". `equipment` is the party's, for the best gold charm. Seeded, so a
 * step saved twice drops the same thing.
 */
export function marinaraVictoryLoot(input: {
  fighters: readonly MarinaraFighter[];
  left?: readonly MarinaraFighter[];
  fled?: readonly string[];
  place: MarinaraItemPlace;
  seed: string;
  coins?: readonly MarinaraLootCoin[];
  equipment?: ReadonlyArray<MarinaraEquipment | null | undefined>;
}): { lines: MarinaraLootLine[]; gold: number; items: string[] } {
  const party = input.fighters.filter((fighter) => fighter.side === "party");
  // A treasure foe that got away takes its windfall with it.
  const away = (input.left ?? []).filter((fighter) => fighter.side === "enemy" && !fighter.dummy && !fighter.windfall);
  const fled = new Set(input.fled ?? []);
  const beaten = [
    ...input.fighters.filter((fighter) => fighter.side === "enemy" && fighter.hp <= 0 && !fighter.dummy),
    ...away,
  ];
  const robbed = [...input.fighters, ...away].filter(
    (fighter) => fighter.side === "enemy" && fighter.stolenBy && !fighter.dummy,
  );
  if (!beaten.length && !robbed.length) return { lines: [], gold: 0, items: [] };
  const partyLevel = party.length
    ? party.reduce((sum, fighter) => sum + fighter.level, 0) / party.length
    : beaten.reduce((sum, fighter) => sum + fighter.level, 0) / beaten.length;
  const goldPct = Math.max(0, ...(input.equipment ?? []).map((gear) => marinaraGearBonus(gear).effects.goldPct ?? 0));
  const rolled = beaten.length
    ? marinaraRollLoot({
        tier: marinaraTierForLevel(partyLevel),
        foes: beaten.map((fighter) => {
          const family = fighter.familyId ? marinaraEnemyFamily(fighter.familyId) : undefined;
          return {
            rank: (fighter.tier ?? "standard") as MarinaraFoeRank,
            tier: marinaraTierForLevel(fighter.level),
            ...(fighter.familyId ? { family: fighter.familyId } : {}),
            // A beast, spirit or machine carries no purse; a foe the bestiary doesn't know is taken as a person.
            ...(family && family.kind !== "humanoid" ? { carriesCoin: false } : {}),
            ...(fled.has(fighter.id) ? { fled: true } : {}),
            ...(fighter.windfall ? { coinScale: fighter.windfall.gold } : {}),
          };
        }),
        place: input.place,
        seed: input.seed,
        goldPct,
      })
    : { items: [], gold: 0 };
  // What Steal took (marinara-combat.ts), each robbed foe's one thing, kept whether it fell or not.
  const loot = { items: [...rolled.items], gold: rolled.gold };
  for (const foe of robbed) {
    const taken =
      foe.stolen ??
      marinaraRollSteal({
        tier: marinaraTierForLevel(foe.level),
        rank: (foe.tier ?? "standard") as MarinaraFoeRank,
        place: input.place,
        ...(foe.familyId ? { family: foe.familyId } : {}),
        seed: `${input.seed}:${foe.id}`,
      });
    if ("item" in taken) loot.items.push(taken.item);
    else loot.gold += taken.gold;
  }
  const counts = new Map<string, number>();
  for (const id of loot.items) {
    const name = marinaraItemName(id, input.place);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const lines: MarinaraLootLine[] = [...counts].map(([name, count]) => ({ name, count }));
  let left = marinaraPriceInCoin(loot.gold, input.place);
  const coins = [...(input.coins ?? [])].sort((a, b) => b.value - a.value);
  if (coins.length) {
    for (const coin of coins) {
      const count = Math.floor(left / coin.value);
      if (count > 0) lines.push({ name: coin.name, item: coin.item, count });
      left -= count * coin.value;
    }
  } else if (left > 0) lines.push({ name: "Coins", count: left });
  return { lines, gold: loot.gold, items: loot.items };
}

// ── Equipping from the bag ──

/** A piece of gear the party owns: its item id, its name in the bag, and how many the bag holds. */
export interface MarinaraOwnedGear {
  id: string;
  name: string;
  count: number;
  slot: "weapon" | "armor" | "accessory";
}

/**
 * The gear in the party's bags, read by name: a stack whose own name is a weapon's, armour's or
 * accessory's name in this place (as loot names them). A stack the player renamed still counts by its
 * own name.
 */
export function marinaraOwnedGear(
  stacks: ReadonlyArray<{ name: string; quantity: number }>,
  place: MarinaraItemPlace,
): MarinaraOwnedGear[] {
  const byName = new Map<string, { id: string; slot: MarinaraOwnedGear["slot"] }>();
  for (const id of marinaraAllItemIds()) {
    const item = marinaraItem(id)!;
    if (item.kind === "consumable" || !marinaraItemInPlace(id, place)) continue;
    const slot = item.kind === "armour" ? "armor" : item.kind;
    byName.set(marinaraItemName(id, place).toLowerCase(), { id, slot });
  }
  const owned = new Map<string, MarinaraOwnedGear>();
  for (const stack of stacks) {
    const found = byName.get(stack.name.trim().toLowerCase());
    if (!found || stack.quantity <= 0) continue;
    const had = owned.get(found.id);
    owned.set(found.id, {
      id: found.id,
      name: had?.name ?? stack.name,
      count: (had?.count ?? 0) + stack.quantity,
      slot: found.slot,
    });
  }
  return [...owned.values()];
}

const equippedIds = (equipment: MarinaraEquipment | null | undefined): string[] => [
  ...(equipment?.weapon ? [equipment.weapon] : []),
  ...(equipment?.armor ? [equipment.armor] : []),
  ...(equipment?.accessories ?? []),
];

/**
 * Why a party member can't wear this equipment, or null when they can: every piece must fit their
 * class and slot, and the party must own one for everyone wearing it (two can't share one sword).
 */
export function marinaraEquipRefusal(input: {
  classId: string;
  equipment: MarinaraEquipment;
  owned: readonly MarinaraOwnedGear[];
  /** What the rest of the party wears. */
  others: ReadonlyArray<MarinaraEquipment | null | undefined>;
}): string | null {
  const { equipment } = input;
  if ((equipment.accessories?.length ?? 0) > MARINARA_ACCESSORY_SLOTS)
    return `Only ${MARINARA_ACCESSORY_SLOTS} accessories can be worn.`;
  const pieces: Array<[string, "weapon" | "armor" | "accessory"]> = [
    ...(equipment.weapon ? [[equipment.weapon, "weapon"] as [string, "weapon"]] : []),
    ...(equipment.armor ? [[equipment.armor, "armor"] as [string, "armor"]] : []),
    ...(equipment.accessories ?? []).map((id) => [id, "accessory"] as [string, "accessory"]),
  ];
  const wanted = new Map<string, number>();
  for (const [id, slot] of pieces) {
    if (!marinaraItem(id)) return `${id} is not an item.`;
    if (!marinaraCanEquip(input.classId, id, slot)) return `${id} can't be used in this class's ${slot} slot.`;
    wanted.set(id, (wanted.get(id) ?? 0) + 1);
  }
  for (const other of input.others)
    for (const id of equippedIds(other)) if (wanted.has(id)) wanted.set(id, wanted.get(id)! + 1);
  for (const [id, count] of wanted) {
    const have = input.owned.find((gear) => gear.id === id)?.count ?? 0;
    if (have < count)
      return have ? `The party has only ${have} of that, already worn.` : "The party doesn't have that.";
  }
  return null;
}

/** The equipment left wearable after a class change: anything the new class can't use comes off. */
export function marinaraEquipmentForClass(
  classId: string,
  equipment: MarinaraEquipment | undefined,
): MarinaraEquipment | undefined {
  if (!equipment) return undefined;
  const weapon =
    equipment.weapon && marinaraCanEquip(classId, equipment.weapon, "weapon") ? equipment.weapon : undefined;
  const armor = equipment.armor && marinaraCanEquip(classId, equipment.armor, "armor") ? equipment.armor : undefined;
  const accessories = (equipment.accessories ?? []).filter((id) => marinaraCanEquip(classId, id, "accessory"));
  return {
    ...(weapon ? { weapon } : {}),
    ...(armor ? { armor } : {}),
    ...(accessories.length ? { accessories } : {}),
  };
}

// ── Shops ──

/**
 * A game's setting kit, with the item tables' wares on its shop when the game uses Classic Marinara
 * classes (`gameSetupConfig.marinaraClasses`): consumables, gear its members' classes can wear and
 * accessories for the party's tier (its members' average level), named in the setting and priced in its money, each from the smallest
 * place that sells it (a hamlet the kit's first size, a town its second, a city its last). Every other
 * game's kit is returned as it is, so its market is unchanged. A kit with no money has no market.
 */
export function marinaraGameWorldKit(metadata: Record<string, unknown> | null | undefined): WorldKit | null {
  const kit = gameWorldKitFromMetadata(metadata);
  const setup = (metadata?.gameSetupConfig ?? undefined) as { marinaraClasses?: unknown } | undefined;
  if (!kit?.money || setup?.marinaraClasses !== true || metadata?.gameRuleset != null) return kit;
  const cards = Array.isArray(metadata?.gameCharacterCards) ? (metadata!.gameCharacterCards as unknown[]) : [];
  const levels = cards.flatMap((card) => {
    const level = (card as { marinara?: { level?: unknown } } | null)?.marinara?.level;
    return typeof level === "number" && Number.isFinite(level) && level >= 1 ? [level] : [];
  });
  const level = levels.length ? levels.reduce((sum, value) => sum + value, 0) / levels.length : 1;
  const wearers = cards.flatMap((card) => {
    const classId = (card as { marinara?: { activeClass?: unknown } } | null)?.marinara?.activeClass;
    return typeof classId === "string" ? [classId] : [];
  });
  const place = marinaraGameItemPlace(metadata);
  const last = Math.max(0, kit.sizes.length - 1);
  const from = { small: 0, town: Math.min(1, last), city: last } as const;
  const taken = new Set((kit.shop ?? []).map((thing) => thing.name.trim().toLowerCase()));
  const wares = marinaraShopCatalog(marinaraTierForLevel(level), place, wearers).flatMap(({ id, size }) => {
    const marks = marinaraItemPrice(id);
    const name = marinaraItemName(id, place);
    if (marks === null || taken.has(name.toLowerCase())) return [];
    taken.add(name.toLowerCase());
    return [{ name, price: Math.max(1, marinaraPriceInCoin(marks, place)), from: from[size] }];
  });
  return { ...kit, shop: [...(kit.shop ?? []), ...wares] };
}
