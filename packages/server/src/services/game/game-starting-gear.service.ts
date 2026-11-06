// Starting gear (Capability API 1.78): the player takes a ruleset's gear into one character's bag,
// never on its own, once for each of the gear's groups (a class's gear beside a background's), or
// again when they say so. What the gear adds is worked out by the shared resolver from the ruleset
// and the game's item book, never from what the screen sent: a pick must be one of its line's list.
import {
  applyGameInventoryOps,
  gameInventoryBagKey,
  defaultRulesetSheetBuild,
  normalizeCharacterLookupName,
  readRulesetSheetEnvelope,
  resolveRulesetStartingGear,
  rulesetStartingGearKind,
  rulesetStartingGearTakenBy,
  rulesetStartingGearEquips,
  rulesetStartingGearUnheld,
  type GameInventoryEngineOp,
  type GameInventoryOp,
  type GameInventoryStack,
  type RulesetStartingGearAdd,
  type RulesetStartingGearRefusal,
  type RulesetStartingGearSelection,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { roomHostIdentity } from "../multiplayer/generation-policy.js";
import { resolveChatUserIdentity } from "../chat-user-identity.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import {
  commitGameInventoryChange,
  gameRulesetLayerOptions,
  loadGameInventoryItemBook,
  readMetadata,
} from "./game-inventory.service.js";
import { rollDieSecurely } from "./dice-rng.js";
import { loadRulesetRegistry, resolveGameRuleset } from "./ruleset-registry.service.js";

/** The gear each bag has taken, by bag key ("" for the player's own) and gear id. */
export type GameStartingGearTaken = Record<string, string[]>;
export const GAME_STARTING_GEAR_TAKEN_KEY = "gameStartingGearTaken";

export function readGameStartingGearTaken(raw: unknown): GameStartingGearTaken {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  // Built from entries, so a bag key such as "__proto__" stays a key; read it with
  // rulesetStartingGearTakenBy.
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).flatMap(([key, ids]) => {
      if (!Array.isArray(ids)) return [];
      // The newest forty: a kit just taken is never the one dropped.
      const kept = ids.filter((id): id is string => typeof id === "string" && id.length <= 64).slice(-40);
      return kept.length > 0 ? [[key, kept]] : [];
    }),
  );
}

export type GameStartingGearRefusal =
  RulesetStartingGearRefusal | "no-gear" | "unknown-holder" | "taken" | "too-heavy" | "refused";

export type GameStartingGearOutcome =
  | {
      ok: true;
      inventory: GameInventoryStack[];
      added: Array<{ name: string; count: number }>;
      dropped: string[];
      taken: GameStartingGearTaken;
      playerStats?: unknown;
    }
  | { ok: false; status: 404 | 409; error: string; reason: GameStartingGearRefusal };

export async function takeGameStartingGear(
  db: DB,
  input: {
    chatId: string;
    holder?: string;
    selection: RulesetStartingGearSelection;
    again?: boolean;
    /** Free edit: all of it goes in, past what its bearer can carry, who is then over their limit. */
    pastLimit?: boolean;
  },
): Promise<GameStartingGearOutcome> {
  const refuse = (status: 404 | 409, reason: GameStartingGearRefusal, error: string): GameStartingGearOutcome => ({
    ok: false,
    status,
    error,
    reason,
  });
  const chat = await createChatsStorage(db).getById(input.chatId);
  if (!chat) return refuse(404, "no-gear", "Chat not found");
  const metadata = readMetadata(chat.metadata);
  if (metadata.gameRuleset == null) return refuse(409, "no-gear", "This game plays by no ruleset");
  const resolved = resolveGameRuleset(metadata, await loadRulesetRegistry(db));
  if (resolved.status !== "ok" || !resolved.definition.items?.startingGear) {
    return refuse(409, "no-gear", "This game's ruleset has no starting gear");
  }
  const { definition } = resolved;

  const identity =
    roomHostIdentity() ??
    (await resolveChatUserIdentity(createCharactersStorage(db), {
      personaId: chat.personaId,
      personaCharacterId: chat.personaCharacterId,
      mode: chat.mode,
    }));
  const playerName = identity?.name ?? null;
  const playerKey = playerName ? normalizeCharacterLookupName(playerName) : "";
  // Whose bag: the player's own, or one party member's by the name their card has, read from the
  // metadata the write holds, so a rename cannot land between the check and the write.
  const bagOf = (
    current: Record<string, unknown>,
  ): { holder: string | undefined; who: string } | { refused: GameStartingGearRefusal; error: string } => {
    const cards = (Array.isArray(current.gameCharacterCards) ? current.gameCharacterCards : [])
      .map((card) => (card && typeof card === "object" ? (card as { name?: unknown }).name : undefined))
      .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
      .map((name) => name.trim());
    const playerCard =
      (playerKey ? cards.find((name) => normalizeCharacterLookupName(name) === playerKey) : undefined) ?? cards[0];
    if (input.holder === undefined) return { holder: undefined, who: playerCard ?? playerName ?? "the player" };
    const named = cards.find(
      (name) => normalizeCharacterLookupName(name) === normalizeCharacterLookupName(input.holder!),
    );
    if (!named) return { refused: "unknown-holder", error: `Nobody in the party is named ${input.holder}` };
    return named === playerCard ? { holder: undefined, who: named } : { holder: named, who: named };
  };

  const book = await loadGameInventoryItemBook(db, { metadata, resolved, playerName }, "player");
  if (!book) return refuse(409, "no-gear", "This game's items could not be read");
  // Coins read off the holder's sheet or rolled (1.157) are worked out once, here, as the gear is taken.
  const metaCards = (Array.isArray(metadata.gameCharacterCards) ? metadata.gameCharacterCards : []).filter(
    (card: unknown): card is { name: string; rulesetSheet?: unknown } =>
      !!card && typeof card === "object" && typeof (card as { name?: unknown }).name === "string",
  );
  const holderCard =
    input.holder !== undefined
      ? metaCards.find(
          (card) => normalizeCharacterLookupName(card.name) === normalizeCharacterLookupName(input.holder!),
        )
      : (metaCards.find((card) => !!playerKey && normalizeCharacterLookupName(card.name) === playerKey) ??
        metaCards[0]);
  const holderBuild = holderCard ? readRulesetSheetEnvelope(definition, holderCard.rulesetSheet)?.build : undefined;
  const resolution = resolveRulesetStartingGear(
    definition,
    book,
    input.selection,
    gameRulesetLayerOptions(resolved),
    undefined,
    { build: holderBuild ?? defaultRulesetSheetBuild(definition), rollDie: rollDieSecurely },
  );
  if (!resolution.ok) return refuse(409, resolution.reason, resolution.detail);
  const { gear } = resolution;
  const kind = rulesetStartingGearKind(definition, gear.id);

  type Value =
    | { refused: GameStartingGearRefusal; error: string }
    | { taken: GameStartingGearTaken; adds: RulesetStartingGearAdd[] };
  const committed = await commitGameInventoryChange<Value>(db, input.chatId, (stacks, current) => {
    const bag = bagOf(current);
    if ("refused" in bag) return { stacks, journal: [], value: bag };
    const { holder, who } = bag;
    const bagKey = gameInventoryBagKey(holder);
    const taken = readGameStartingGearTaken(current[GAME_STARTING_GEAR_TAKEN_KEY]);
    const takenHere = rulesetStartingGearTakenBy(taken, bagKey);
    const already = takenHere.find((id) => rulesetStartingGearKind(definition, id) === kind);
    if (already && !input.again) {
      return {
        stacks,
        journal: [],
        value: { refused: "taken", error: `${who} has already taken starting gear of this kind` },
      };
    }
    // What the bag already holds of what is worn is not taken twice, unless the gear is taken again on
    // purpose (laptop 2026-10-26: the Game Master's shield, then the kit's).
    const { adds, held } = input.again
      ? { adds: resolution.adds, held: [] as string[] }
      : rulesetStartingGearUnheld(resolution.adds, stacks, holder, book);
    const ops: GameInventoryEngineOp[] = adds.map((add) => ({
      op: "add",
      name: add.name,
      ...(add.item ? { item: add.item } : {}),
      count: add.count,
      ...(holder ? { holder } : {}),
      log: true,
      ...(input.pastLimit ? { pastLimit: true as const } : {}),
    }));
    const added = applyGameInventoryOps(stacks, ops, undefined, book);
    // All of it or none of it: gear half in the bag is not what the player chose.
    for (const [index, result] of added.results.entries()) {
      const name = adds[index]!.name;
      if (!result.ok) {
        const reason = result.reason === "too-heavy" ? "too-heavy" : "refused";
        return {
          stacks,
          journal: [],
          value: {
            refused: reason,
            error:
              reason === "too-heavy" ? `${who} cannot carry ${name} as well` : `${name} could not go into ${who}'s bag`,
          },
        };
      }
      if (result.left) {
        return {
          stacks,
          journal: [],
          value: { refused: "too-heavy", error: `${who} cannot carry all of ${name} as well` },
        };
      }
    }
    // Armor and a shield go on as they are taken, where their slots are free, and each of several put
    // on alike (two shortswords, one in each hand); one that does not fit stays in the bag.
    const equips: GameInventoryOp[] = rulesetStartingGearEquips(
      adds,
      added.results.map((result) => (result?.ok ? result.id : undefined)),
    );
    const worn = equips.length > 0 ? applyGameInventoryOps(added.stacks, equips, undefined, book) : added;
    const next: GameStartingGearTaken = {
      ...taken,
      // Taken again, it is taken too: the marker keeps every gear the bag has taken.
      [bagKey]: [...takenHere.filter((id) => id !== gear.id), gear.id].slice(-40),
    };
    // Written as the bag writes a stack: "Handaxe x2".
    const list = adds.map((add) => (add.count > 1 ? `${add.name} x${add.count}` : add.name)).join(", ");
    const content = [
      ...(list ? [`${who} took ${list}.`] : []),
      ...(held.length > 0 ? [`${who} already had ${held.join(", ")}.`] : []),
    ].join(" ");
    return {
      stacks: worn.stacks,
      journal: added.journal,
      events: [{ title: `Starting gear: ${gear.label}`, content }],
      metadata: { [GAME_STARTING_GEAR_TAKEN_KEY]: next },
      value: { taken: next, adds },
    };
  });
  if (!committed) return refuse(404, "no-gear", "Chat not found");
  if ("refused" in committed.value) return refuse(409, committed.value.refused, committed.value.error);
  return {
    ok: true,
    inventory: committed.stacks,
    added: committed.value.adds.map((add) => ({ name: add.name, count: add.count })),
    dropped: resolution.dropped,
    taken: committed.value.taken,
    ...(committed.playerStats ? { playerStats: committed.playerStats } : {}),
  };
}
