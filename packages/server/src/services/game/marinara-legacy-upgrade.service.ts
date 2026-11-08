// ──────────────────────────────────────────────
// Game: upgrading a Legacy game to Classic classes (owner 2026-11-06)
//
// A game made without Classic classes keeps its Legacy sheets for as long as its players want. Its
// Journal offers the upgrade: every party member gets one class (the base class of a primary tree the
// player picks, guessed from their card), a secondary tree from their temperament (read from their
// Description when the card has none yet), starting at the top of that class (level 10, owner
// 2026-11-06). Their Legacy stats stay on the card, untouched. One-way: there is no way back.
// ──────────────────────────────────────────────
import {
  COMBAT_PARTY_TEMPERAMENTS,
  gameCardTemperament,
  guessMarinaraArchetype,
  MARINARA_LEGACY_UPGRADE_LEVEL,
  marinaraCanEquip,
  marinaraClass,
  marinaraGameItemPlace,
  marinaraLegacyGearFor,
  marinaraTierForLevel,
  marinaraTrees,
  normalizeCharacterLookupName,
  partyTemperamentFallback,
  readPartyTemperament,
  upgradeMarinaraLegacyCard,
  type CombatPartyTemperament,
  type GameInventoryStack,
  type MarinaraArchetype,
  type MarinaraCardClassic,
  type MarinaraPartyTemperament,
} from "@marinara-engine/shared";
import { withCardTemperament } from "./party-temperament.service.js";

export interface MarinaraLegacyUpgradeMember {
  name: string;
  primary?: MarinaraArchetype;
}

export interface MarinaraLegacyUpgraded {
  name: string;
  level: number;
  primary: MarinaraArchetype;
  secondary: MarinaraArchetype | null;
  temperament: MarinaraPartyTemperament;
  /** Where the temperament came from: kept on the card, read from the Description now, or drawn. */
  temperamentFrom: "card" | "description" | "drawn";
}

type Card = Record<string, unknown> & { name: string };

function partyCards(meta: Record<string, unknown>): Card[] {
  const cards = Array.isArray(meta.gameCharacterCards) ? (meta.gameCharacterCards as Record<string, unknown>[]) : [];
  return cards.filter((card): card is Card => typeof card.name === "string" && Boolean(card.name.trim()));
}

/** Why this game can't be upgraded, or null when it can. */
export function marinaraLegacyUpgradeBlock(meta: Record<string, unknown>): string | null {
  const setup = (meta.gameSetupConfig ?? null) as { marinaraClasses?: unknown } | null;
  if (!setup) return "This game has no setup to upgrade.";
  if (setup.marinaraClasses === true) return "This game already uses MRPG classes.";
  if (meta.gameRuleset) return "A game played with a ruleset keeps its ruleset's sheets.";
  // A fight already under way was set up with Legacy sheets, and classes change only outside battle.
  if (meta.gameActiveState === "combat") return "Finish the fight first: the party upgrades outside battle.";
  if (partyCards(meta).length === 0) return "This game has no party sheets to upgrade yet.";
  return null;
}

/** The party members whose temperament has to be read from their Description first. */
export function marinaraLegacyNeedsTemperament(meta: Record<string, unknown>): Card[] {
  return partyCards(meta).filter((card) => !gameCardTemperament(card));
}

/** The prompt that reads temperaments from the Descriptions (the same rule a new game card follows). */
export function marinaraLegacyTemperamentPrompt(
  cards: readonly Card[],
  descriptions: ReadonlyMap<string, string>,
): { system: string; user: string } {
  const list = COMBAT_PARTY_TEMPERAMENTS.join("|");
  const system = [
    `You read how each character goes about a fight, from who they are in their Description and personality, never from their class alone.`,
    `Give each one temperament, exactly one of: ${list}.`,
    `- reckless: charges in; cautious: guards themselves first; opportunistic: goes for the weak and exposed; protective: shields others; supportive: heals and helps before striking; disciplined: steady, keeps formation; cowardly: avoids danger and flees when hurt; patient: waits for the right moment; methodical: plans, picks the best option; coordinated: fights as a team.`,
    `- arrogant only for the proud who think a fight beneath them until it hurts; cruel only for the sadistic who relish suffering; honourable only for those who fight fair and spare the beaten.`,
    `- Do not mistake negated traits for positive evidence. The values are protocol enums: never translate them.`,
    `Return ONLY a JSON object mapping each name exactly as given to its temperament.`,
  ].join("\n");
  const user = cards
    .map((card) => {
      const library = descriptions.get(normalizeCharacterLookupName(card.name));
      const parts = [
        `## ${card.name}`,
        library ? `Description: ${library.slice(0, 4000)}` : null,
        typeof card.shortDescription === "string" && card.shortDescription
          ? `In this game: ${card.shortDescription}`
          : null,
        typeof card.class === "string" && card.class ? `Class: ${card.class}` : null,
        Array.isArray(card.strengths) && card.strengths.length ? `Strengths: ${card.strengths.join(", ")}` : null,
        Array.isArray(card.weaknesses) && card.weaknesses.length ? `Weaknesses: ${card.weaknesses.join(", ")}` : null,
      ];
      return parts.filter(Boolean).join("\n");
    })
    .join("\n\n");
  return { system, user };
}

/** The temperaments a model answered, by lookup name; anything it got wrong is left out. */
export function readMarinaraLegacyTemperaments(answer: unknown): Map<string, CombatPartyTemperament> {
  const out = new Map<string, CombatPartyTemperament>();
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) return out;
  for (const [name, value] of Object.entries(answer as Record<string, unknown>)) {
    const temperament = readPartyTemperament(value);
    if (temperament) out.set(normalizeCharacterLookupName(name), temperament);
  }
  return out;
}

/** The note an upgraded card keeps its Legacy class and abilities in, as story (owner 2026-11-06). */
export const MARINARA_LEGACY_NOTE = "Before the upgrade";

/**
 * The card's text after the upgrade (owner 2026-11-06): its class names the MRPG class it now fights
 * as, and its Legacy class and abilities move into a note, so the Game Master no longer narrates powers
 * the new class doesn't have. Strengths, weaknesses and the rest stay as they were.
 */
export function withMrpgClassText(
  card: Record<string, unknown>,
  progression: { activeClass: string },
): Record<string, unknown> {
  const label = marinaraClass(progression.activeClass)?.label;
  const oldClass = typeof card.class === "string" ? card.class.trim() : "";
  const abilities = Array.isArray(card.abilities)
    ? card.abilities.filter((one): one is string => typeof one === "string" && Boolean(one.trim()))
    : [];
  const extra =
    card.extra && typeof card.extra === "object" && !Array.isArray(card.extra)
      ? (card.extra as Record<string, string>)
      : {};
  const note = [
    oldClass ? `Legacy class: ${oldClass}.` : "",
    abilities.length ? `Legacy abilities: ${abilities.join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    ...card,
    ...(label ? { class: label } : {}),
    abilities: [],
    extra: note ? { ...extra, [MARINARA_LEGACY_NOTE]: note } : extra,
  };
}

/** One Legacy weapon or armour the upgrade offers an MRPG piece for (owner 2026-11-06). */
export interface MarinaraLegacyGearOffer {
  stackId: string;
  /** The party card that carries it. */
  holder: string;
  /** Its name as the player sees it now, which it keeps as its nickname. */
  from: string;
  /** The MRPG piece it becomes, and that piece's name in this game. */
  id: string;
  slot: "weapon" | "armor";
  to: string;
}

/**
 * The MRPG piece the upgrade offers for each Legacy weapon and armour a party member carries, at the
 * tier of the level the upgrade starts them at. The player's own bag (no holder) is the player card's.
 */
export function marinaraLegacyGearOffers(
  meta: Record<string, unknown>,
  stacks: readonly GameInventoryStack[],
  playerCard: string | null,
): MarinaraLegacyGearOffer[] {
  const place = marinaraGameItemPlace(meta);
  const tier = marinaraTierForLevel(MARINARA_LEGACY_UPGRADE_LEVEL);
  const party = new Map(partyCards(meta).map((card) => [normalizeCharacterLookupName(card.name), card.name]));
  const offers: MarinaraLegacyGearOffer[] = [];
  for (const stack of stacks) {
    if (stack.item || stack.quantity <= 0) continue;
    const holder = party.get(
      stack.holder ? normalizeCharacterLookupName(stack.holder) : normalizeCharacterLookupName(playerCard ?? ""),
    );
    if (!holder) continue;
    const from = stack.nickname ?? stack.name;
    const piece = marinaraLegacyGearFor(from, tier, place) ?? marinaraLegacyGearFor(stack.name, tier, place);
    if (!piece) continue;
    offers.push({ stackId: stack.id, holder, from, id: piece.id, slot: piece.slot, to: piece.name });
  }
  return offers;
}

/** The bags after the accepted offers: each stack becomes its MRPG piece and keeps its Legacy name. */
function withLegacyGearSwapped(
  stacks: readonly GameInventoryStack[],
  offers: readonly MarinaraLegacyGearOffer[],
): GameInventoryStack[] {
  const byStack = new Map(offers.map((offer) => [offer.stackId, offer]));
  return stacks.map((stack) => {
    const offer = byStack.get(stack.id);
    if (!offer) return stack;
    const { nickname: _n, ...rest } = stack;
    const keep = offer.from.trim() && offer.from.trim().toLowerCase() !== offer.to.toLowerCase();
    return { ...rest, name: offer.to, ...(keep ? { nickname: offer.from.trim() } : {}) };
  });
}

/**
 * The metadata patch that upgrades the game: every party card gets its Classic progression and a kept
 * temperament, and the game turns Classic classes on. Call it inside patchMetadata with fresh metadata.
 */
export function applyMarinaraLegacyUpgrade(
  meta: Record<string, unknown>,
  input: {
    gameId: string;
    members: readonly MarinaraLegacyUpgradeMember[];
    /** Temperaments read from Descriptions now, by lookup name. */
    read: ReadonlyMap<string, CombatPartyTemperament>;
    classic: ReadonlyMap<string, MarinaraCardClassic>;
    at: string;
    /** The game's bags, and the gear offers the player took (all of them when absent). */
    gear?: {
      stacks: readonly GameInventoryStack[];
      playerCard: string | null;
      accepted?: readonly string[];
    };
  },
):
  | { patch: Record<string, unknown>; upgraded: MarinaraLegacyUpgraded[]; stacks?: GameInventoryStack[] }
  | { refusal: string } {
  const block = marinaraLegacyUpgradeBlock(meta);
  if (block) return { refusal: block };
  const picked = new Map(input.members.map((one) => [normalizeCharacterLookupName(one.name), one.primary]));
  const offers = input.gear
    ? marinaraLegacyGearOffers(meta, input.gear.stacks, input.gear.playerCard).filter(
        (offer) => !input.gear!.accepted || input.gear!.accepted.includes(offer.stackId),
      )
    : [];
  const upgraded: MarinaraLegacyUpgraded[] = [];
  const cards = (meta.gameCharacterCards as Record<string, unknown>[]).map((card) => {
    if (typeof card.name !== "string" || !card.name.trim()) return card;
    const key = normalizeCharacterLookupName(card.name);
    const kept = gameCardTemperament(card);
    const read = input.read.get(key);
    const temperament = (kept?.initial ??
      read ??
      partyTemperamentFallback(input.gameId, card.name)) as MarinaraPartyTemperament;
    const classic = input.classic.get(key);
    const primary = picked.get(key) ?? classic?.tree ?? guessMarinaraArchetype(card);
    let progression = upgradeMarinaraLegacyCard({
      gameId: input.gameId,
      card: card as unknown as Parameters<typeof upgradeMarinaraLegacyCard>[0]["card"],
      temperament,
      primary,
      ...(classic ? { classic } : {}),
    });
    // They wear the first swapped weapon and armour of theirs their class can use.
    const equipment: { weapon?: string; armor?: string } = {};
    for (const offer of offers) {
      if (normalizeCharacterLookupName(offer.holder) !== key || equipment[offer.slot]) continue;
      if (marinaraCanEquip(progression.activeClass, offer.id, offer.slot)) equipment[offer.slot] = offer.id;
    }
    if (equipment.weapon || equipment.armor)
      progression = { ...progression, equipment: { ...equipment, accessories: [] } };
    upgraded.push({
      name: card.name,
      level: progression.level,
      primary: progression.primary,
      secondary: marinaraTrees(progression.primary, temperament).secondary,
      temperament,
      temperamentFrom: kept ? "card" : read ? "description" : "drawn",
    });
    const withTemperament = kept ? card : withCardTemperament(card, temperament, null);
    return { ...withMrpgClassText(withTemperament, progression), marinara: progression };
  });
  return {
    patch: {
      gameCharacterCards: cards,
      gameSetupConfig: { ...(meta.gameSetupConfig as Record<string, unknown>), marinaraClasses: true },
      gameMarinaraLegacyUpgrade: {
        at: input.at,
        members: upgraded,
        ...(offers.length ? { gear: offers.map(({ holder, from, to }) => ({ holder, from, to })) } : {}),
      },
    },
    upgraded,
    ...(input.gear && offers.length ? { stacks: withLegacyGearSwapped(input.gear.stacks, offers) } : {}),
  };
}
