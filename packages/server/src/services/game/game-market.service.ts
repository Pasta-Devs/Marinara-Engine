// Markets (#6917, #6934): the place a scene is in, the market day there, and the market a Game
// Master's buys and sales are answered at.
import {
  answeredGamePlaces,
  defaultRulesetSheetBuild,
  evaluateRulesetSheetLive,
  gameInventoryNameKey,
  gameMarketDayStart,
  lastGamePlace,
  readResolvedInventoryTags,
  rulesetMarketStockKey,
  rulesetMarketInspectKey,
  normalizeCharacterLookupName,
  resolveRulesetValueRef,
  rulesetMarketPlace,
  rulesetMarketQuoter,
  rulesetSheetItems,
  type GameInventoryMarket,
  type GameInventoryStack,
  type GamePlace,
  type RulesetItemBook,
  type RulesetLiveStates,
  type RulesetMarketDay,
  type RulesetSpotter,
  type WorldKitItems,
  readWorldLedger,
  type WorldLedgerCarry,
  type WorldLedgerEntry,
  worldLedgerCarry,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { parseExtra } from "../generation/prompt-attachments.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { createGameWorldSnapshotsStorage } from "../storage/game-world-snapshots.storage.js";
import type { ResolvedGameRuleset } from "./ruleset-registry.service.js";
import { gameRulesetLayerOptions, readMetadata } from "./game-inventory.service.js";
import { loadGameRulesetSheetContext } from "./ruleset-sheet-turn.service.js";

/** The Game Master's own replies before the telling a regeneration replaces, oldest first. */
export interface GameRepliesBefore {
  /** Since the latest conversation start, as the Game Master's own context is scoped: what the place,
   *  and the history asked for, are read from. */
  scoped: string[];
  /** All of them: what the world's ledger is read from (worldgen W4), since a conversation start
   *  scopes what the model reads, not what the story did to the world. */
  all: string[];
  /** What earlier sessions carried in (W10-0), read first in `all` as one reply; null in a first session. */
  carried: WorldLedgerCarry | null;
  /** The player's message the reply answers: the last one before it (worldgen W10, a fight's recap). */
  player: string | null;
  /** The world's ledger to fold (worldgen W4): from the living world earlier sessions left (W11) when the
   *  session keeps one, then this session's replies; else every reply in `all`. */
  ledger: WorldLedgerEntry[];
  /** For each of `scoped`, the market place its turn was at when the world put the party there and no
   *  place tag began a day (`GAME_MARKET_PLACE_EXTRA` on the reply), else null. */
  marketPlaces: Array<string | null>;
  /** For each of `scoped`, the reply's message id (null for what earlier sessions carried in). */
  replyIds: Array<string | null>;
}

/** The reply's extra that says which world-set market place its turn was at (`gameMarketDayFor`). */
export const GAME_MARKET_PLACE_EXTRA = "gameMarketPlace";

/** A Game Master's own reply: an assistant message that is not a party's turn (a tag a party's model
 *  echoes never counts for the world), as a tag a player types never does. */
export function isGameMasterReply(message: { role: string; content: unknown }): message is {
  role: string;
  content: string;
} {
  return (
    message.role === "assistant" &&
    typeof message.content === "string" &&
    !message.content.trimStart().startsWith("[party-turn]")
  );
}

export async function gameRepliesBefore(db: DB, chatId: string, replacing?: string | null): Promise<GameRepliesBefore> {
  const chats = createChatsStorage(db);
  const [messages, chat, fold] = await Promise.all([
    chats.listMessages(chatId),
    chats.getById(chatId),
    createGameWorldSnapshotsStorage(db).getFold(chatId),
  ]);
  const end = replacing ? messages.findIndex((message) => message.id === replacing) : -1;
  const before = end >= 0 ? messages.slice(0, end) : messages;
  // Each session is its own chat: what the earlier ones did to the world comes first, as one reply.
  const meta = readMetadata(chat?.metadata);
  const carried = worldLedgerCarry(meta.gameLedgerCarry);
  const all: string[] = carried?.tags ? [carried.tags] : [];
  const places: Array<string | null> = carried?.tags ? [null] : [];
  const ids: Array<string | null> = carried?.tags ? [null] : [];
  let scopedFrom = all.length;
  let player: string | null = null;
  // A world given to a game made without one (worldgen W12) starts after the message it was given at: the
  // replies before it are of no place in the world, nor of its ledger.
  const startsAfter = typeof meta.gameWorldStartsAfter === "string" ? meta.gameWorldStartsAfter : null;
  let started = !startsAfter || !before.some((message) => message.id === startsAfter);
  for (const message of before) {
    if (!started) {
      started = message.id === startsAfter;
      continue;
    }
    if (parseExtra(message.extra).isConversationStart === true) scopedFrom = all.length;
    if (message.role === "user" && typeof message.content === "string") player = message.content;
    if (isGameMasterReply(message)) {
      all.push(message.content);
      const stamp = parseExtra(message.extra)[GAME_MARKET_PLACE_EXTRA];
      places.push(typeof stamp === "string" ? stamp : null);
      ids.push(message.id);
      // Answered: a later reply answers only what the player writes after it.
      if (message.content.trim()) player = null;
    }
  }
  const own = all.slice(carried?.tags ? 1 : 0);
  const ledger = fold ? [{ from: fold }, ...readWorldLedger(own)] : readWorldLedger(all);
  return {
    scoped: all.slice(scopedFrom),
    all,
    carried,
    player,
    ledger,
    marketPlaces: places.slice(scopedFrom),
    replyIds: ids.slice(scopedFrom),
  };
}

/**
 * The Game Master's own replies before a reply, as the player sees them (each its active swipe), from
 * the latest conversation start on, as the Game Master's own context is scoped; a regeneration reads
 * only what came before the telling it replaces. A tag a player types is never read.
 */
async function gameMasterReplies(db: DB, chatId: string, replacing?: string | null): Promise<string[]> {
  return (await gameRepliesBefore(db, chatId, replacing)).scoped;
}

/** The place the chat's scene is in before a reply: the last place tag the Engine answered in the Game
 *  Master's replies (`gameMasterReplies`). Null when none was said. */
export async function gamePlaceBefore(db: DB, chatId: string, replacing?: string | null): Promise<GamePlace | null> {
  return lastGamePlace(await gameMasterReplies(db, chatId, replacing));
}

/**
 * The market place a turn is at when the world put the party there and no place tag began a day there
 * (`world|<name>|<size>`), from the Game Master's replies before it and the reply's own answered place
 * tags; undefined when a place tag's day is the one in force. Saved on each such reply
 * (`GAME_MARKET_PLACE_EXTRA`), so the market day there runs across turns.
 */
export function gameMarketWorldPlace(
  texts: readonly string[],
  reply: string | undefined,
  inForce: GamePlace | null | undefined,
): string | undefined {
  const begun = gameMarketDayStart(answeredGamePlaces(reply === undefined ? texts : [...texts, reply]))?.mark.place;
  if (!inForce?.name || gameInventoryNameKey(inForce.name) === gameInventoryNameKey(begun?.name ?? ""))
    return undefined;
  return `world|${gameInventoryNameKey(inForce.name)}|${inForce.size ?? ""}`;
}

/**
 * The place a reply happens at and its market day (#6934): from the Game Master's replies before it
 * (`gameMasterReplies`), then the reply's own answered place tags, if given. The day is named by the
 * chat, the place tag that began it and that place, so the same day always rolls the same shelf; what
 * it saw are the buys and sales the Engine answered after that tag, before the reply (the reply's own
 * are counted as it is read). A sale's worth is read back off its price in the book's coins.
 */
export async function gameMarketDayFor(
  db: DB,
  chatId: string,
  replacing: string | null | undefined,
  reply: string | undefined,
  book: Pick<RulesetItemBook, "coinNamed" | "coins">,
  /** Where the game's world has put the party (worldgen W7/W8), when it says. */
  inForce?: GamePlace | null,
): Promise<{ place: GamePlace | null; day: RulesetMarketDay; worldPlace?: string }> {
  const replies = await gameRepliesBefore(db, chatId, replacing);
  const texts = replies.scoped;
  const marks = answeredGamePlaces(reply === undefined ? texts : [...texts, reply]);
  const start = gameMarketDayStart(marks);
  const bought = new Map<string, number>();
  const stockBought = new Map<string, number>();
  const paidOut = new Map<string, number>();
  const warned = new Set<string>();
  const inspected = new Set<string>();
  // What the replies from `from` on bought and sold (the first read from `offset` on), the fakes'
  // buys held for a warning, and who inspected which seller's ware (1.802).
  const count = (from: { text: number; end: number }) => {
    texts.forEach((text, index) => {
      if (index < from.text) return;
      const since = index === from.text ? text.slice(from.end) : text;
      for (const tag of readResolvedInventoryTags(since)) {
        if (tag.action === "buy" && !tag.ok && tag.reason === "held" && tag.seller)
          warned.add(rulesetMarketStockKey(tag.seller, tag.item));
        if (tag.action === "inspect" && tag.ok && tag.seller && tag.who && tag.found)
          inspected.add(rulesetMarketInspectKey(tag.who, tag.seller, tag.item));
        if (!tag.ok) continue;
        if (tag.action === "buy") {
          const key = tag.stock ? rulesetMarketStockKey(tag.seller ?? "", tag.item) : gameInventoryNameKey(tag.item);
          const counts = tag.stock ? stockBought : bought;
          counts.set(key, (counts.get(key) ?? 0) + tag.count);
        }
        if (tag.action === "sell" && tag.price) {
          const said = /^(\d+)\s+(.+)$/.exec(tag.price.trim());
          const coin = said ? book.coinNamed?.(said[2]!) : undefined;
          const family = coin ? book.coins.find((each) => each.item === coin.coin.item)?.coin?.family : undefined;
          if (said && coin && family) {
            paidOut.set(family, (paidOut.get(family) ?? 0) + Number(said[1]) * coin.coin.value);
          }
        }
      }
    });
  };
  const begun = start?.mark.place;
  // The world may have put the party somewhere no place tag began a day (the map's location): the
  // market there keeps a day of its own, from the first of the replies in a row whose turns were there
  // (each says so in its extra) to now, and counts what they bought and sold. A turn anywhere else, or a
  // place tag's day, ends it, so coming back is a new day.
  const worldPlace = gameMarketWorldPlace(texts, reply, inForce);
  if (inForce && worldPlace) {
    let first = texts.length;
    while (first > 0 && replies.marketPlaces[first - 1] === worldPlace) first -= 1;
    // A place tag answered inside the run began a day of its own: the run starts after it.
    const lastTag = marks.at(-1);
    if (lastTag && lastTag.text >= first && lastTag.text < texts.length) first = lastTag.text + 1;
    count({ text: first, end: 0 });
    return {
      place: inForce,
      // Named by the reply before the run (it is there before and after each turn of the day, so a reply
      // deleted inside the run does not move it), or the start when the run is the first.
      day: {
        key: `${chatId}|${worldPlace}|${replies.replyIds[first - 1] ?? "start"}`,
        bought,
        stockBought,
        paidOut,
        warned,
        inspected,
      },
      worldPlace,
    };
  }
  if (start) count(start.mark);
  return {
    place: inForce ?? marks.at(-1)?.place ?? null,
    day: {
      key: start ? `${chatId}|${start.ordinal}|${begun?.name ?? ""}|${begun?.size ?? ""}` : "",
      bought,
      stockBought,
      paidOut,
      warned,
      inspected,
    },
  };
}

/**
 * A maker of the market a Game Master's buys and sales are answered at, for a game whose ruleset
 * declares one (a fresh market for each reading of a reply, since a market counts what the reply buys
 * and sells): the place in
 * force, the ruleset's prices and sellers, and each buyer's sheet for a seller's `only`, read as an
 * item's check is (the player's card for no name or the player's own, a member's own card by name, and
 * a blank sheet for someone with none), with what they carry at that tag and `live`, the turn's own live state (the
 * one its items are used with, never a replaced telling's). Undefined for a ruleset without a market.
 */
export async function loadGameMarket(
  db: DB,
  chatId: string,
  resolved: ResolvedGameRuleset | null | undefined,
  book: RulesetItemBook,
  place: GamePlace | null,
  live: RulesetLiveStates | null | undefined,
  day?: RulesetMarketDay,
): Promise<(() => GameInventoryMarket) | undefined> {
  if (resolved?.status !== "ok" || !resolved.definition.items?.market) return undefined;
  const { definition } = resolved;
  const market = resolved.definition.items.market;
  const context = await loadGameRulesetSheetContext(db, chatId, resolved);
  const same = (a: string, b: string) => normalizeCharacterLookupName(a) === normalizeCharacterLookupName(b);
  const cards = context?.cards ?? [];
  const player =
    (context?.playerName ? cards.find((card) => same(card.name, context.playerName!)) : undefined) ?? cards[0];
  const meets = (
    only: { value: Parameters<typeof resolveRulesetValueRef>[2]; atLeast: number },
    who: string | undefined,
    stacks: readonly GameInventoryStack[],
  ) => {
    const own = who ? cards.find((card) => same(card.name, who)) : undefined;
    const isPlayer = who ? (own ? own === player : !!context?.playerName && same(who, context.playerName)) : true;
    const card = own ?? (isPlayer ? player : undefined);
    const name = card?.name ?? who ?? "";
    const build = card?.build ?? defaultRulesetSheetBuild(definition);
    const held = rulesetSheetItems({ itemOf: book.itemOf }, stacks, isPlayer ? undefined : name);
    const evaluated = evaluateRulesetSheetLive(definition, build, live?.[normalizeCharacterLookupName(name)], held);
    return resolveRulesetValueRef(definition, build, only.value, evaluated) >= only.atLeast;
  };
  const at = place?.size ? (rulesetMarketPlace(market, place.size) ?? null) : null;
  const layerOptions = gameRulesetLayerOptions(resolved);
  // Who may spot a fake (1.802): every card, the player's first, each with their own bag and live state.
  const spotter = (card: (typeof cards)[number]): RulesetSpotter => ({
    name: card.name,
    build: card.build,
    live: live?.[normalizeCharacterLookupName(card.name)],
    holder: card === player ? undefined : card.name,
  });
  const spotters = [...(player ? [player] : []), ...cards.filter((card) => card !== player)].map(spotter);
  const spotting = {
    spotters,
    spotterOf: (who: string | undefined) => {
      if (!who) return spotters[0] && player ? spotters[0] : undefined;
      if (context?.playerName && same(who, context.playerName)) return player ? spotters[0] : undefined;
      return spotters.find((each) => same(each.name, who));
    },
    seed: chatId,
  };
  return () => rulesetMarketQuoter(definition, book, at, meets, layerOptions, day, spotting);
}

/**
 * The market of a game with no ruleset, from its setting kit's money and shop (worldgen W6b): the same
 * quoter at the place in force, with no seller to ask anything of the buyer. Undefined when the kit
 * has no market.
 */
export function loadGameKitMarket(
  kitItems: WorldKitItems,
  book: RulesetItemBook,
  place: GamePlace | null,
): GameInventoryMarket | undefined {
  const market = kitItems.definition.items?.market;
  if (!market) return undefined;
  const at = place?.size ? (rulesetMarketPlace(market, place.size) ?? null) : null;
  return rulesetMarketQuoter(kitItems.definition, book, at, () => true);
}
