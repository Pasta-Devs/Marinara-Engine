// A party member's temperament is theirs for the whole game (Alyssa 2026-10-31): read once from their
// description, kept on their game card, and the same in every fight until the story changes it.

import {
  characterNamesMatch,
  findNamedEntry,
  gameCardTemperament,
  hasExactNamedEntry,
  normalizeCharacterLookupName,
  partyTemperamentFallback,
  readPartyTemperament,
  withKeptTemperament,
  type CombatAiHints,
  type CombatPartyTemperament,
} from "@marinara-engine/shared";

/**
 * A game card with its temperament kept as the model wrote it at the card's making (game setup, a
 * recruit), or as it was before (a regenerated card): the one it starts with is never rewritten.
 */
export function withCardTemperament(
  card: Record<string, unknown>,
  written: unknown,
  before?: Record<string, unknown> | null,
): Record<string, unknown> {
  const kept = gameCardTemperament(before);
  const current = readPartyTemperament(written) ?? kept?.current;
  const { temperament: _t, temperamentInitial: _i, ...rest } = card;
  if (!current) return rest;
  return { ...rest, temperament: current, temperamentInitial: kept?.initial ?? current };
}

/**
 * The party of a fight's blueprint with every member's own temperament kept over whatever the fight's
 * setup hinted, and the temperaments to write onto cards that had none yet: the hint the setup read
 * from their description where it gave one a party member may have, else one drawn once for the game.
 */
export function keepPartyTemperaments<T extends { name?: unknown; aiHints?: CombatAiHints }>(
  party: readonly T[],
  cards: readonly Record<string, unknown>[],
  gameId: string,
): { party: T[]; fresh: Map<string, CombatPartyTemperament> } {
  const named = cards.filter(
    (card): card is Record<string, unknown> & { name: string } =>
      typeof card.name === "string" && Boolean(card.name.trim()),
  );
  const fresh = new Map<string, CombatPartyTemperament>();
  const kept = party.map((member) => {
    const name = typeof member.name === "string" ? member.name.trim() : "";
    if (!name) return member;
    const card = gameCardFor(named, name);
    // One with no game card (a summoned beast, a unit the fight added) is no party member of the
    // story's: it fights as any combatant does, with its own hints and a draw.
    if (!card) return member;
    // Keyed by the card's own name, so the one drawn is written onto the card it was drawn for.
    const key = normalizeCharacterLookupName(card.name);
    let temperament = gameCardTemperament(card)?.current;
    if (!temperament) {
      temperament =
        fresh.get(key) ??
        readPartyTemperament(member.aiHints?.temperament) ??
        partyTemperamentFallback(gameId, card.name);
      fresh.set(key, temperament);
    }
    return { ...member, aiHints: withKeptTemperament(member.aiHints, temperament) };
  });
  return { party: kept, fresh };
}

/**
 * The game card a fight's party member is, as the client finds it (`findGameCombatCard`): the one
 * named exactly, else the one card a variant of the name matches (a first name, a name without its
 * title). A variant two cards match finds neither, so no card is given another's temperament.
 */
function gameCardFor<T extends { name: string }>(cards: readonly T[], name: string): T | undefined {
  if (hasExactNamedEntry(cards, name, (card) => card.name)) return findNamedEntry(cards, name, (card) => card.name);
  const variants = cards.filter((card) => characterNamesMatch(card.name, name));
  return variants.length === 1 ? variants[0] : undefined;
}

/** The game's cards with the temperaments drawn for them written on, where they still have none. */
export function cardsWithFreshTemperaments(
  cards: readonly Record<string, unknown>[],
  fresh: ReadonlyMap<string, CombatPartyTemperament>,
): { cards: Record<string, unknown>[]; changed: boolean } {
  let changed = false;
  const next = cards.map((card) => {
    if (typeof card.name !== "string" || gameCardTemperament(card)) return card;
    const temperament = fresh.get(normalizeCharacterLookupName(card.name));
    if (!temperament) return card;
    changed = true;
    return { ...card, temperament, temperamentInitial: temperament };
  });
  return { cards: next, changed };
}
