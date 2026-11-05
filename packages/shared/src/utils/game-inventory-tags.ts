/**
 * The Game Master's `[inventory: ...]` tags, applied to the stacks.
 *
 * The server calls this once for the reply it saves. Every tag becomes one resolved tag per item,
 * carrying what really happened, so the Game Master reads its refusals back next turn and the client
 * only has to announce what the tags say. Pure: the caller saves the stacks and the journal.
 */
import { normalizeCharacterLookupName, uniqueCharacterKeyFor } from "./character-lookup-name.js";
import {
  applyGameInventoryOps,
  type GameInventoryJournalEntry,
  type GameInventoryOp,
  type GameInventoryOpResult,
} from "./game-inventory-ops.js";
import {
  gameInventoryAddedItem,
  gameInventoryBagKey,
  gameInventoryCountItems,
  gameInventoryGiveRefusal,
  gameInventoryItemId,
  gameInventoryItemsNamed,
  giveFromGameInventoryNamed,
  wearGameInventoryStack,
  type GameInventoryBagRef,
  type GameInventoryCoin,
  type GameInventoryItemRules,
  type GameInventoryStack,
  gameInventoryFoldStandIn,
  gameInventoryStackKind,
  gameInventoryStackNamed,
  revealGameInventoryFake,
  releaseGameInventoryUnmetBindings,
  markGameInventoryInspected,
} from "./game-inventory-stacks.js";
import { createSkillCheckTagRegex, parseSkillCheckTagBody } from "./skill-check-tag.js";
import { payGameInventoryCoinsTogether, type GameInventoryPayment } from "./game-inventory-coins.js";
import {
  createInventoryTagRegex,
  createLootTagRegex,
  parseInventoryTagBody,
  parseLootTagBody,
  readResolvedInventoryTags,
  serializeInventoryTag,
  serializeLootTag,
  type InventoryTagOutcome,
} from "./inventory-command-tag.js";

/** Who can carry things in this game. */
/** Uses one of the ruleset's items for whoever carries the stack, outside a fight: what it does to
 *  them lands on their sheet, and the stacks come back spent. The server keeps the sheets, so it
 *  supplies this; without it an inventory tag cannot use anything. */
export type GameInventoryItemUser = (
  stacks: readonly GameInventoryStack[],
  stackId: string,
) =>
  | {
      ok: true;
      stacks: GameInventoryStack[];
      journal: GameInventoryJournalEntry[];
      line: string;
      /** A fake used was shown for what it truly is first (1.79): its true name. */
      revealed?: string;
    }
  | { ok: false; reason: string };

/** Why a market will not sell (#6917): no market in this ruleset, no place said, a level, item or seller
 *  it does not know, an item with no price or not sold at a place this size, or a seller who will not
 *  sell to this buyer. */
export type GameInventoryMarketRefusal =
  | "no-market"
  | "no-place"
  | "unknown-level"
  | "unknown-item"
  | "not-for-sale"
  | "not-here"
  | "no-seller"
  | "not-to-you"
  /** None left today of what the place or a seller's stock keeps (#6934). */
  | "sold-out"
  /** Nobody here buys it back, or the market buys nothing back. */
  | "not-bought"
  /** The place's sellers have paid out today's purse. */
  | "purse-spent";

/** What a buy costs at the place the party is in, worked out by the Engine; the server builds it from
 *  the ruleset's market, the place and the buyers' sheets. */
export interface GameInventoryMarket {
  quote(request: {
    item: string;
    count: number;
    level?: string;
    seller?: string;
    who?: string;
    /** The stacks as the reply's tags have left them so far, which a seller's `only` reads. */
    stacks: readonly GameInventoryStack[];
  }):
    | {
        ok: true;
        /** The item bought, and its name. */
        item: string;
        name: string;
        /** Bought and never carried: buying it only pays. */
        service: boolean;
        /** The coins of the family it is paid in, and how much, in the family's smallest coin. */
        family: readonly GameInventoryCoin[];
        owed: number;
        /** The price as said: "36 Shilling". */
        price: string;
        level: string;
        seller?: string;
        /** Out of the seller's stock today. */
        stock?: true;
        /** A fake a dishonest seller passed off (Capability API 1.79): what it truly is. The buyer
         *  gets it as `item`, and the stack keeps this. */
        truly?: string;
        /** Someone else in the party noticed it is a fake (1.802): the buy waits for their warning. */
        held?: { who: string; says: string };
      }
    | { ok: false; reason: GameInventoryMarketRefusal };
  /** One character's look at an item before trusting it (1.802): `stack` when it is in their bag, else
   *  a seller's ware here. `with` names a way of seeing through fakes, cast on it. Without it nothing
   *  is inspected. */
  inspect?(request: {
    item: string;
    who?: string;
    seller?: string;
    with?: string;
    stack?: GameInventoryStack;
    stacks: readonly GameInventoryStack[];
  }):
    | {
        ok: true;
        found: "fake" | "named" | "genuine" | "unsure";
        /** Who looked, by their card's name. */
        by: string;
        line: string;
        check?: { label: string; total: number; dc: number; rolls: number[] };
        seller?: string;
        revealed?: { item: string; name: string };
      }
    | { ok: false; reason: string };
  /** What a seller here pays for `count` of an item (#6934). Without it nothing is sold back. */
  sale?(request: {
    item: string;
    count: number;
    seller?: string;
    who?: string;
    stacks: readonly GameInventoryStack[];
    /** The stack sold is a fake: what it truly is, which an honest buyer spots (1.79). */
    truly?: string;
  }):
    | {
        ok: true;
        item: string;
        name: string;
        /** The coins of the family it is paid in, which one, and how much, in its smallest coin. */
        family: readonly GameInventoryCoin[];
        familyId: string;
        worth: number;
        price: string;
        /** The coin the price is said in: the seller pays in it and smaller, never in bigger ones. */
        paidIn?: string;
        /** The coins it is paid out in where they make the sum: those some price is written in. */
        payIn?: readonly string[];
        seller?: string;
        /** An honest buyer spotted a fake: what it truly is, which it now is, sold at that worth. */
        revealed?: { item: string; name: string };
      }
    | { ok: false; reason: GameInventoryMarketRefusal; revealed?: { item: string; name: string } };
  /** Counts what the reply bought or sold, so its later tags see what is left today. */
  record?(
    done:
      | { buy: { name: string; count: number; seller?: string; stock?: boolean } }
      | { sell: { familyId: string; worth: number } }
      /** A fake's buy held for a warning (1.802): asked again today, it goes through. */
      | { warned: { seller: string; name: string } },
  ): void;
}

export interface GameInventoryParty {
  /** The player's own character's name, when it is known. */
  player?: string;
  /** Every other party member's name, as their card has it. */
  members: readonly string[];
}

/** The most tags one reply may carry before the rest are left unapplied. */
export const MAX_INVENTORY_TAGS = 40;

export type GameInventoryHolderLookup =
  | { ok: true; bag: GameInventoryBagRef | undefined }
  | { ok: false; reason: "unknown-character" | "ambiguous-character" };

/**
 * The bag a `who=` or `to=` names, matched the way a sheet command's `who` is: case, accents and
 * punctuation aside. The player's own name is the player's bag; `party`, or no name at all, names no
 * bag in particular (`bag` undefined). Somebody who has left the party but still holds something can
 * still be named.
 */
export function resolveGameInventoryHolder(
  name: string | undefined,
  party: GameInventoryParty,
  stacks: readonly GameInventoryStack[] = [],
): GameInventoryHolderLookup {
  const key = name ? normalizeCharacterLookupName(name) : "";
  if (!key || key === "party") return { ok: true, bag: undefined };
  if (party.player && normalizeCharacterLookupName(party.player) === key) return { ok: true, bag: {} };
  // Two members of one name are two people, so neither can be told apart from the other.
  const members = party.members.filter((member) => normalizeCharacterLookupName(member) === key);
  if (members.length > 1) return { ok: false, reason: "ambiguous-character" };
  if (members.length === 1) return { ok: true, bag: { holder: members[0]! } };
  const former = stacks.find((stack) => stack.holder && normalizeCharacterLookupName(stack.holder) === key)?.holder;
  if (former) return { ok: true, bag: { holder: former } };
  // A shorter name only one member answers to, or the name with a nickname written inside it, as a
  // sheet command's `who=` is read (cheap-GM playtest 2026-10-26).
  const everyone = [...(party.player ? [party.player] : []), ...party.members];
  const short = uniqueCharacterKeyFor(
    everyone.map((member) => normalizeCharacterLookupName(member)),
    name!,
  );
  if (short !== null) {
    if (party.player && normalizeCharacterLookupName(party.player) === short) return { ok: true, bag: {} };
    const member = party.members.find((one) => normalizeCharacterLookupName(one) === short);
    if (member) return { ok: true, bag: { holder: member } };
  }
  return { ok: false, reason: "unknown-character" };
}

export interface GameInventoryTagsOutcome {
  content: string;
  stacks: GameInventoryStack[];
  journal: GameInventoryJournalEntry[];
  /** How many tags were found, answered or not. Zero means the reply changed nothing here. */
  tags: number;
}

/** What a payment handed over and got back, for the Game Master: "Paid with Crown ×1; Shilling ×2 back." */
function paymentNote(paid: GameInventoryPayment): string {
  const listed = (coins: GameInventoryPayment["paid"]) => {
    const each = coins.map((coin) => `${coin.name} ×${coin.count}`);
    return each.length > 1 ? `${each.slice(0, -1).join(", ")} and ${each.at(-1)}` : each.join("");
  };
  return `Paid with ${listed(paid.paid)}${paid.change.length ? `; ${listed(paid.change)} back` : ""}.`;
}

function outcomeOf(result: GameInventoryOpResult | undefined): InventoryTagOutcome {
  if (!result) return { ok: false, reason: "refused" };
  return result.ok
    ? { ok: true, count: result.count ?? 0, now: result.now ?? 0 }
    : { ok: false, reason: result.reason };
}

/** An item's name with case and a plural ending aside ("Torches" and "torch" are "torch"): how an add
 *  and a later give in one reply, or a player's words and the item book, are matched. */
export function gameInventoryNameStem(name: string): string {
  return name.trim().toLowerCase().replace(/s$/, "").replace(/e$/, "");
}

/** A bag as tags in one reply name it; nobody named is the same bag each time. */
function inventoryBagKey(name: string | undefined): string {
  return (name ?? "").trim().toLowerCase();
}

/**
 * Every tag in the reply, in order, each on the stacks the one before it left. A `result` the Game
 * Master wrote itself is ignored, as it is on a sheet command: it only ever asks, and the Engine
 * answers. The server runs this on the text a turn generated, never on a reply already saved.
 */
export function applyGameInventoryTags(
  content: string,
  stacks: GameInventoryStack[],
  party: GameInventoryParty,
  newId?: () => string,
  /** What the game's ruleset says about its items: a name that is one of them adds that item. */
  rules?: GameInventoryItemRules,
  /** Uses one of the ruleset's items, for `action="use"`. */
  useItem?: GameInventoryItemUser,
  /** Rolls one of the ruleset's loot tables, for `[loot:]`: what it dropped, or null for a table the
   *  ruleset does not have. Without it a loot tag is refused. */
  loot?: (table: string) => ReadonlyArray<{ item: string; name: string; count: number }> | null,
  /** The place the party is in and what it sells, for `action="buy"` (#6917). Without it a buy is
   *  refused. */
  market?: GameInventoryMarket,
): GameInventoryTagsOutcome {
  // What was put in the player's own name before is the player's bag (2026-10-23 playtest): a save
  // from before a persona-less party's first card played as the player keeps its gear in reach.
  let current = party.player ? gameInventoryFoldStandIn(stacks, party.player) : stacks;
  const journal: GameInventoryJournalEntry[] = [];
  let tags = 0;

  const apply = (ops: GameInventoryOp[]): GameInventoryOpResult[] => {
    const outcome = applyGameInventoryOps(current, ops, newId, rules);
    current = outcome.stacks;
    journal.push(...outcome.journal);
    return outcome.results;
  };

  /** An add into the bag named (`named` as the Game Master wrote it, `bag` as it was found), or with
   *  nobody named into the shared view, which a ruleset that says what everyone carries fills by who can
   *  carry it, the player first. Answered as one resolved add per bag it went into, saying whose when
   *  nobody was named (the player's says nobody), and one for what nobody could carry; the first carries
   *  what was changed. */
  const addAnswered = (
    item: string,
    ref: { item?: string },
    count: number,
    named: string | undefined,
    bag: GameInventoryBagRef | undefined,
    note?: string,
    action: "add" | "earn" = "add",
    /** Minutes of game time it lasts before it vanishes (1.760). */
    lasts?: number,
  ): string => {
    const vanishes = lasts ? { lasts } : {};
    const [result] = apply([
      bag
        ? { op: "add", name: item, ...ref, count, holder: bag.holder, log: true, ...vanishes }
        : { op: "add", name: item, ...ref, count, among: ["", ...party.members], log: true, ...vanishes },
    ]);
    const shown = { action, item, count, ...(named ? { who: named } : {}), ...vanishes };
    if (!result?.ok) return serializeInventoryTag(shown, outcomeOf(result), note);
    const answers = result.placed
      ? result.placed.map((share, index) =>
          serializeInventoryTag(
            { action, item, count: share.count, ...(share.holder ? { who: share.holder } : {}), ...vanishes },
            { ok: true, count: share.count, now: share.now },
            index === 0 ? note : undefined,
          ),
        )
      : [serializeInventoryTag(shown, outcomeOf(result), note)];
    if (result.left) {
      answers.push(
        serializeInventoryTag(
          { action, item, count: result.left, ...(named ? { who: named } : {}) },
          { ok: false, reason: "too-heavy" },
        ),
      );
    }
    return answers.join(" ");
  };

  /** Putting on, taking off, binding or unbinding up to `count` of the item a name finds in one bag,
   *  one at a time, each on a stack not already so. `now` is how many of it that bag has so after. */
  const wearNamed = (
    wear: "equip" | "unequip" | "bind" | "unbind",
    item: string,
    count: number,
    bag: GameInventoryBagRef,
  ): { outcome: InventoryTagOutcome; revealed?: string; note?: string } => {
    const flag = wear === "equip" || wear === "unequip" ? "equipped" : "bound";
    const on = wear === "equip" || wear === "bind";
    let items = gameInventoryItemsNamed(current, item, bag);
    const mine = (stack: GameInventoryStack) =>
      items.has(gameInventoryItemId(stack)) && gameInventoryBagKey(stack.holder) === gameInventoryBagKey(bag.holder);
    // Else the ruleset's item the name finds, held under that item's own name: a "Wooden Shield" added
    // as 5e's Shield is put on by the name it was given by (laptop 2026-10-26).
    if (!current.some(mine)) {
      const ruled = rules?.itemNamed(item)?.item;
      if (ruled) items = new Set([ruled]);
    }
    if (!current.some(mine)) return { outcome: { ok: false, reason: "none-held" } };
    // What goes together is kept together: putting on prefers the item already bound, binding the
    // one already worn; taking off and unbinding leave the other state alone where they can.
    const other = flag === "equipped" ? "bound" : "equipped";
    const rank = (stack: GameInventoryStack) => (Boolean(stack[other]) === on ? 0 : 1);
    let done = 0;
    let revealed: string | undefined;
    while (done < count) {
      const stack = current
        .filter((each) => mine(each) && Boolean(each[flag]) !== on)
        .sort((a, b) => rank(a) - rank(b))[0];
      if (!stack) break;
      const worn = wearGameInventoryStack(current, stack.id, wear, newId, rules);
      if (!worn) break;
      if ("refused" in worn) {
        if (done === 0) return { outcome: { ok: false, reason: worn.refused } };
        break;
      }
      current = worn.stacks;
      done += 1;
      // A fake bound is found out, as what it truly is (1.79).
      if (wear === "bind" && stack.truly) revealed ??= rules?.itemOf(stack.truly)?.name ?? stack.truly;
    }
    const now = current.reduce((total, stack) => total + (mine(stack) && stack[flag] ? stack.quantity : 0), 0);
    // Worn and not bound, an item that works only bound does nothing yet: said, so the Game Master
    // binds it rather than narrate its magic (5e ship-readiness re-test 2026-10-24).
    const unbound =
      wear === "equip" &&
      done > 0 &&
      current.some(
        (stack) => mine(stack) && stack.equipped && !stack.bound && !!stack.item && !!rules?.itemOf(stack.item)?.binds,
      );
    return {
      outcome: { ok: true, count: done, now },
      ...(revealed ? { revealed } : {}),
      ...(unbound ? { note: "It does nothing until it is bound too: give it action bind." } : {}),
    };
  };

  // An add the same reply then gives or removes from the same bag made the item out of nothing to have
  // it to hand over (2026-10-26 eval: told no torch exists, a model adds one and gives it on). Those
  // items of those adds, by tag index, are refused as having no source; one written with a `source` or
  // `from` says where it came from and stands.
  const conjured = new Map<number, Set<string>>();
  const requests = [...content.matchAll(createInventoryTagRegex())].map((match) => ({
    request: parseInventoryTagBody(match[1] ?? ""),
    sourced: /\b(?:source|from)\s*=/i.test(match[1] ?? ""),
    story: /\bsource\s*=\s*["']?story\b/i.test(match[1] ?? ""),
  }));
  requests.forEach(({ request, sourced }, index) => {
    if (request?.action !== "add" || request.to || sourced) return;
    const later = new Set<string>();
    for (const { request: other } of requests.slice(index + 1)) {
      const handsOn =
        other && (other.action === "give" || other.action === "remove" || (other.action === "add" && other.to));
      if (!handsOn || inventoryBagKey(other.who) !== inventoryBagKey(request.who)) continue;
      for (const item of other.items) later.add(gameInventoryNameStem(item));
    }
    const made = new Set(request.items.map(gameInventoryNameStem).filter((item) => later.has(item)));
    if (made.size > 0) conjured.set(index, made);
  });

  // The bags a payment was refused for in this reply: what they then add with no `source` was bought
  // with money they did not have, and is refused too (laptop room playtest 2026-10-30: tools came into
  // a bag after "cannot-afford").
  const unpaid = new Set<string>();
  // The checks this reply failed, where they sit and whose they are: what that bag then adds with no
  // `source` was made or found on a roll it lost, and is refused (laptop room playtest 2026-10-30: a
  // pouch came out of a failed leatherworking check written before its roll).
  const failedChecks = [...content.matchAll(createSkillCheckTagRegex())].flatMap((match) => {
    const check = parseSkillCheckTagBody(match[1] ?? "");
    return check?.resolvedResult && !check.resolvedResult.success
      ? [{ at: match.index ?? 0, bag: inventoryBagKey(check.who) }]
      : [];
  });
  const next = content.replace(createInventoryTagRegex(), (_whole, body: string, offset: number) => {
    tags += 1;
    const tagIndex = tags - 1;
    // Past the cap a tag is answered as refused rather than left as written, so a result the Game
    // Master wrote itself can never read as something that happened.
    if (tags > MAX_INVENTORY_TAGS) return refuseTagBody(body, "too-many");
    const parsed = parseInventoryTagBody(body);
    if (!parsed) return serializeInventoryTag({ raw: body.trim() }, { ok: false, reason: "unreadable" });
    // An add that names who it goes to hands on what `who` holds: it is a give.
    const request = parsed.action === "add" && parsed.to ? { ...parsed, action: "give" as const } : parsed;

    const who = resolveGameInventoryHolder(request.who, party, current);
    // who="party" pays out of everyone's purse, the player's first, then each member's in turn.
    const payers = (holder: string | undefined): Array<string | undefined> =>
      request.who && normalizeCharacterLookupName(request.who) === "party" ? [undefined, ...party.members] : [holder];
    // A buyer named buys out of their own purse first and then the party's: the Game Master never
    // writes who="party" for a buy (laptop pass 5 2026-10-26: "Hessa buys with the party's coin"
    // refused with 62 gp in Brannoc's purse).
    const buyers = (holder: string | undefined): Array<string | undefined> =>
      request.who
        ? [
            ...new Set([
              ...payers(holder),
              ...[undefined, ...party.members].filter(
                (one) => gameInventoryBagKey(one) !== gameInventoryBagKey(holder),
              ),
            ]),
          ]
        : payers(holder);
    const to = request.action === "give" ? resolveGameInventoryHolder(request.to, party, current) : null;
    // One item whose name holds a comma is that item, not a list (#8271: "Rope, hempen (50 feet)"
    // bought as "Rope" and "hempen (50 feet)"); and so is each such item in a list, the longest run of
    // parts that names one first (laptop 2026-10-25: "Rope, hempen (50 feet), Lantern, hooded").
    const known = (name: string) => {
      const held = gameInventoryItemsNamed(current, name);
      return (
        !!rules?.itemNamed(name) ||
        !!rules?.coinNamed?.(name) ||
        current.some((stack) => held.has(gameInventoryItemId(stack)))
      );
    };
    const named: string[] = [];
    if (request.whole && known(request.whole)) named.push(request.whole);
    else
      for (let from = 0; from < request.items.length;) {
        let to = request.items.length;
        while (to - from > 1 && !known(request.items.slice(from, to).join(", "))) to -= 1;
        named.push(request.items.slice(from, to).join(", "));
        from = to;
      }
    return named
      .map((written) => {
        // An item written by its ref is read by its name from here on, so a stack of it is found as
        // a name finds it, a fake among them (#8271); unless that name finds another item first,
        // when the ref stays as written.
        const byRef = rules?.itemNamed(written);
        const item =
          byRef && byRef.item === written.trim() && rules?.itemNamed(byRef.name)?.item === byRef.item
            ? byRef.name
            : written;
        const shown = {
          action: request.action,
          item,
          count: request.count,
          ...(request.who ? { who: request.who } : {}),
          ...(request.to ? { to: request.to } : {}),
        };
        if (!who.ok) return serializeInventoryTag(shown, { ok: false, reason: who.reason });
        if (request.action === "add" && conjured.get(tagIndex)?.has(gameInventoryNameStem(item))) {
          return serializeInventoryTag(shown, { ok: false, reason: "no-source" });
        }
        if (request.action === "add" && unpaid.has(inventoryBagKey(request.who)) && !requests[tagIndex]?.sourced) {
          return serializeInventoryTag(shown, { ok: false, reason: "unpaid" });
        }
        if (
          request.action === "add" &&
          !requests[tagIndex]?.sourced &&
          failedChecks.some((check) => check.at < offset && check.bag === inventoryBagKey(request.who))
        ) {
          return serializeInventoryTag(shown, { ok: false, reason: "check-failed" });
        }
        if (request.action === "add") {
          // A proposal first makes the item of the ruleset it describes, or finds the one of that name
          // already made, and the answer says what the Engine changed. Without a ruleset to invent in,
          // its parts are ignored and the name is added as it always was.
          const invented =
            request.proposal && rules?.invent ? rules.invent({ name: item, ...request.proposal }, current) : undefined;
          if (invented && "refused" in invented) {
            return serializeInventoryTag(shown, { ok: false, reason: invented.refused });
          }
          const note = invented?.notes.join(" ") || undefined;
          const ref = invented ? { item: invented.item } : {};
          // An item a use spends comes into a bag only by a way the Engine checks (a buy, a loot roll, a
          // won fight, a give), never by the Game Master's word (cheap-GM playtest 2026-10-26: a potion
          // "from the captain's belt", added from nowhere, then healed).
          const adds = invented?.item ?? gameInventoryAddedItem(current, item, who.bag?.holder, rules)?.item;
          if (adds && rules?.sourcedOnly?.(adds) && !requests[tagIndex]?.story) {
            return serializeInventoryTag(shown, { ok: false, reason: "no-source" });
          }
          return addAnswered(item, ref, request.count, request.who, who.bag, note, "add", request.lasts);
        }
        if (
          request.action === "equip" ||
          request.action === "unequip" ||
          request.action === "bind" ||
          request.action === "unbind"
        ) {
          const worn = wearNamed(request.action, item, request.count, who.bag ?? {});
          return serializeInventoryTag(
            { ...shown, ...(worn.revealed ? { revealed: worn.revealed } : {}) },
            worn.outcome,
            worn.note,
          );
        }
        if (request.action === "use") {
          if (!useItem) return serializeInventoryTag(shown, { ok: false, reason: "cannot-use" });
          // Each use on a stack of the item in who's own bag that can be used, the first such first.
          const items = gameInventoryItemsNamed(current, item, who.bag ?? {});
          const mine = (stack: GameInventoryStack) =>
            items.has(gameInventoryItemId(stack)) &&
            gameInventoryBagKey(stack.holder) === gameInventoryBagKey(who.bag?.holder);
          if (!current.some(mine)) return serializeInventoryTag(shown, { ok: false, reason: "none-held" });
          const lines: string[] = [];
          let refused: string | undefined;
          let revealed: string | undefined;
          let lastUsed: string | undefined;
          for (let done = 0; done < request.count; done++) {
            let used = false;
            for (const stack of current.filter(mine)) {
              const outcome = useItem(current, stack.id);
              if (!outcome.ok) {
                refused ??= outcome.reason;
                continue;
              }
              current = outcome.stacks;
              journal.push(...outcome.journal);
              lines.push(outcome.line);
              revealed ??= outcome.revealed;
              lastUsed = stack.id;
              used = true;
              break;
            }
            // A use that found a fake out was a use of the fake: the rest of the count is not moved
            // onto the real thing it passed for (1.79).
            if (!used || revealed) break;
          }
          if (lines.length === 0) return serializeInventoryTag(shown, { ok: false, reason: refused ?? "none-held" });
          const revealedItems = (stacks: readonly GameInventoryStack[], id: string | undefined) => {
            const left = revealed && id ? stacks.find((stack) => stack.id === id) : undefined;
            return left ? new Set([gameInventoryItemId(left)]) : undefined;
          };
          return serializeInventoryTag(
            { ...shown, ...(revealed ? { revealed } : {}) },
            {
              ok: true,
              count: lines.length,
              // A fake found out is counted as what it really is, as its line says ("1 left").
              now: gameInventoryCountItems(current, revealedItems(current, lastUsed) ?? items, who.bag ?? {}),
            },
            lines.join(" "),
          );
        }
        if (request.action === "pay" || request.action === "earn") {
          // Money is the ruleset's coins, a stack of each per bag. An earning is an add of that coin;
          // a payment comes out of one bag inside the coin's own family, with change.
          const named = rules?.coinNamed?.(item);
          if (!rules?.coinNamed) return serializeInventoryTag(shown, { ok: false, reason: "no-currencies" });
          if (!named) return serializeInventoryTag(shown, { ok: false, reason: "unknown-coin" });
          const coin = named.coin;
          if (request.action === "earn") {
            return addAnswered(coin.name, { item: coin.item }, request.count, request.who, who.bag, undefined, "earn");
          }
          const holder = who.bag?.holder;
          const paid = payGameInventoryCoinsTogether(
            current,
            payers(holder),
            named.family,
            request.count * coin.value,
            named.usual,
          );
          const answered = { ...shown, item: coin.name };
          if (!paid.ok) {
            unpaid.add(inventoryBagKey(request.who));
            return serializeInventoryTag(answered, { ok: false, reason: paid.reason });
          }
          current = paid.stacks;
          // The journal says what was spent and what came back as change.
          journal.push(
            ...paid.paid.map((each) => ({ item: each.name, action: "used" as const, quantity: each.count })),
            ...paid.change.map((each) => ({ item: each.name, action: "acquired" as const, quantity: each.count })),
          );
          const now = current
            .filter(
              (stack) => stack.item === coin.item && gameInventoryBagKey(stack.holder) === gameInventoryBagKey(holder),
            )
            .reduce((sum, stack) => sum + stack.quantity, 0);
          const note = paymentNote(paid);
          return serializeInventoryTag(answered, { ok: true, count: request.count, now }, note);
        }
        if (request.action === "buy") {
          // The Engine prices it at the place the party is in, takes the price out of the buyer's
          // purse as a payment is, and puts the item in their bag; a service only pays. Either both
          // happen or neither does.
          if (!market) return serializeInventoryTag(shown, { ok: false, reason: "no-market" });
          const asked = {
            ...shown,
            ...(request.level ? { level: request.level } : {}),
            ...(request.seller ? { seller: request.seller } : {}),
          };
          const quote = market.quote({
            item,
            count: request.count,
            ...(request.level ? { level: request.level } : {}),
            ...(request.seller ? { seller: request.seller } : {}),
            ...(request.who ? { who: request.who } : {}),
            stacks: current,
          });
          if (!quote.ok) return serializeInventoryTag(asked, { ok: false, reason: quote.reason });
          const answered = {
            ...asked,
            item: quote.name,
            level: quote.level,
            ...(quote.seller ? { seller: quote.seller } : {}),
          };
          // Someone in the party noticed it is a fake (1.802): nothing is paid yet, and asked again
          // today it goes through.
          if (quote.held && quote.seller) {
            market.record?.({ warned: { seller: quote.seller, name: quote.name } });
            return serializeInventoryTag(
              answered,
              { ok: false, reason: "held" },
              `${quote.held.who} noticed: ${quote.held.says}`,
            );
          }
          const holder = who.bag?.holder;
          const paid = payGameInventoryCoinsTogether(
            current,
            buyers(holder),
            quote.family,
            quote.owed,
            quote.family[0] ? rules?.coinNamed?.(quote.family[0].name)?.usual : undefined,
          );
          if (!paid.ok) {
            unpaid.add(inventoryBagKey(request.who));
            return serializeInventoryTag(answered, { ok: false, reason: paid.reason });
          }
          let after = paid.stacks;
          const bought: GameInventoryJournalEntry[] = [];
          let now = 0;
          if (!quote.service) {
            const added = applyGameInventoryOps(
              paid.stacks,
              [
                {
                  op: "add",
                  name: quote.name,
                  item: quote.item,
                  count: request.count,
                  holder,
                  log: true,
                  ...(quote.truly ? { truly: quote.truly } : {}),
                },
              ],
              newId,
              rules,
            );
            const [result] = added.results;
            if (!result?.ok) return serializeInventoryTag(answered, outcomeOf(result));
            // Paid for in full, so delivered in full: what does not fit leaves the whole buy undone.
            if ((result.left ?? 0) > 0) return serializeInventoryTag(answered, { ok: false, reason: "too-heavy" });
            after = added.stacks;
            bought.push(...added.journal);
            now = result.now ?? 0;
          }
          current = after;
          journal.push(
            ...paid.paid.map((each) => ({ item: each.name, action: "used" as const, quantity: each.count })),
            ...paid.change.map((each) => ({ item: each.name, action: "acquired" as const, quantity: each.count })),
            ...bought,
          );
          market.record?.({
            buy: {
              name: quote.name,
              count: request.count,
              ...(quote.seller ? { seller: quote.seller } : {}),
              ...(quote.stock ? { stock: true } : {}),
            },
          });
          // Something free takes no coin at all.
          const note = paid.paid.length ? paymentNote(paid) : undefined;
          return serializeInventoryTag(
            { ...answered, price: quote.price, ...(quote.stock ? { stock: true as const } : {}) },
            { ok: true, count: request.count, now },
            note,
          );
        }
        if (request.action === "sell") {
          // A seller here pays for it in its own coins, up to what the place pays out in a day: it
          // leaves the seller's bag and the coins come in, largest first, or nothing happens (#6934).
          if (!market?.sale) return serializeInventoryTag(shown, { ok: false, reason: "no-market" });
          // One sale of `count` of the kind `offered` is: a fake is offered for what it seems, which an
          // honest buyer sees through (1.79).
          const sellOnce = (count: number, offered: GameInventoryStack | undefined): string => {
            const asked = { ...shown, count, ...(request.seller ? { seller: request.seller } : {}) };
            const sale = market.sale!({
              item,
              count,
              ...(request.seller ? { seller: request.seller } : {}),
              ...(request.who ? { who: request.who } : {}),
              stacks: current,
              ...(offered?.truly ? { truly: offered.truly } : {}),
            });
            // Seen through, it is what it truly is from now on, sold or not.
            if (sale.revealed && offered) current = revealGameInventoryFake(current, offered.id, rules);
            const seen = sale.revealed ? { revealed: sale.revealed.name } : {};
            if (!sale.ok) return serializeInventoryTag({ ...asked, ...seen }, { ok: false, reason: sale.reason });
            const answered = { ...asked, item: sale.name, ...(sale.seller ? { seller: sale.seller } : {}), ...seen };
            const holder = who.bag?.holder;
            // Only stacks of the kind the sale was priced by: a fake is never sold with the real thing it
            // passes for, nor the real thing with a fake (1.79).
            const sold = offered && current.find((stack) => stack.id === offered.id);
            const kind = sold ? gameInventoryStackKind(sold) : undefined;
            const taken = applyGameInventoryOps(
              current,
              [
                {
                  op: "take",
                  name: sale.name,
                  count,
                  from: who.bag ?? {},
                  as: "sold",
                  ...(kind ? { kind } : {}),
                },
              ],
              newId,
              rules,
            );
            const [took] = taken.results;
            if (!took?.ok) return serializeInventoryTag(answered, outcomeOf(took));
            if (took.count !== count) return serializeInventoryTag(answered, { ok: false, reason: "none-held" });
            let left = sale.worth;
            const coinOps: GameInventoryOp[] = [];
            // In the coin the price is said in and smaller (laptop playtest 2026-10-25: a 60 gold sale
            // came in as 6 platinum).
            const top = sale.family.find((coin) => coin.item === sale.paidIn)?.value ?? Number.POSITIVE_INFINITY;
            // And in the coins prices are written in, where those make the sum (no electrum for a Mace).
            const usual = sale.family.filter((coin) => !sale.payIn || sale.payIn.includes(coin.item));
            const makes = (coins: readonly GameInventoryCoin[]) =>
              coins.reduce((rest, coin) => (coin.value > top ? rest : rest % coin.value), sale.worth) === 0;
            for (const coin of makes(usual) ? usual : sale.family) {
              if (coin.value > top) continue;
              const count = Math.floor(left / coin.value);
              if (count < 1) continue;
              left -= count * coin.value;
              coinOps.push({ op: "add", name: coin.name, item: coin.item, count, holder, log: true });
            }
            // Never pay less than the purse is charged.
            if (left > 0) return serializeInventoryTag(answered, { ok: false, reason: "not-for-sale" });
            const paid = applyGameInventoryOps(taken.stacks, coinOps, newId, rules);
            if (paid.results.some((result) => !result.ok || (result.left ?? 0) > 0)) {
              return serializeInventoryTag(answered, { ok: false, reason: "too-heavy" });
            }
            current = paid.stacks;
            journal.push(...taken.journal, ...paid.journal);
            market.record?.({ sell: { familyId: sale.familyId, worth: sale.worth } });
            return serializeInventoryTag({ ...answered, price: sale.price }, { ok: true, count, now: took.now ?? 0 });
          };
          // The stack the name finds, and the kinds of it in that bag. A count past what the first kind
          // holds, where the bag holds another kind of it too (four real Dust and a fake), is sold kind
          // by kind, each priced on its own.
          const first = gameInventoryStackNamed(current, item, who.bag ?? {});
          const ids = gameInventoryItemsNamed(current, item, who.bag ?? {});
          const kinds = new Map<string, { stack: GameInventoryStack; held: number }>();
          for (const stack of current) {
            if (!ids.has(gameInventoryItemId(stack))) continue;
            if (gameInventoryBagKey(stack.holder) !== gameInventoryBagKey(who.bag?.holder)) continue;
            const kind = gameInventoryStackKind(stack);
            const had = kinds.get(kind);
            if (had) had.held += stack.quantity;
            else kinds.set(kind, { stack, held: stack.quantity });
          }
          const firstKind = first ? kinds.get(gameInventoryStackKind(first)) : undefined;
          if (!first || !firstKind || firstKind.held >= request.count || kinds.size < 2)
            return sellOnce(request.count, first);
          const total = [...kinds.values()].reduce((sum, kind) => sum + kind.held, 0);
          if (total < request.count) return sellOnce(request.count, first);
          const parts: string[] = [];
          let remaining = request.count;
          for (const kind of [firstKind, ...[...kinds.values()].filter((each) => each !== firstKind)]) {
            if (remaining <= 0) break;
            const count = Math.min(remaining, kind.held);
            const said = sellOnce(count, current.find((stack) => stack.id === kind.stack.id) ?? kind.stack);
            parts.push(said);
            // The first refusal ends it: what was sold stays sold, and the refusal says why the rest was not.
            if (!readResolvedInventoryTags(said)[0]?.ok) break;
            remaining -= count;
          }
          return parts.join(" ");
        }
        if (request.action === "inspect") {
          // A look at an item before trusting it (1.802): the inspector's own stack of it, else a
          // seller's ware. What it found is kept on the stack: suspect, or shown for what it is.
          if (!market?.inspect) return serializeInventoryTag(shown, { ok: false, reason: "cannot-inspect" });
          const stack = gameInventoryStackNamed(current, item, who.bag ?? {}, true);
          const looked = market.inspect({
            item,
            ...(request.who ? { who: request.who } : {}),
            ...(request.seller ? { seller: request.seller } : {}),
            ...(request.with ? { with: request.with } : {}),
            ...(stack ? { stack } : {}),
            stacks: current,
          });
          const asked = {
            ...shown,
            ...(request.seller && !stack ? { seller: request.seller } : {}),
          };
          if (!looked.ok) return serializeInventoryTag(asked, { ok: false, reason: looked.reason });
          const answered = {
            ...asked,
            who: looked.by,
            ...(looked.seller && !stack ? { seller: looked.seller } : {}),
            found: looked.found,
            ...(looked.revealed ? { revealed: looked.revealed.name } : {}),
          };
          if (stack) {
            current = markGameInventoryInspected(current, stack.id, looked.by, {
              tried: !request.with,
              suspect: looked.found === "fake",
            });
            if (looked.found === "named") current = revealGameInventoryFake(current, stack.id, rules);
          }
          const now = stack ? (current.find((each) => each.id === stack.id)?.quantity ?? stack.quantity) : 0;
          return serializeInventoryTag(answered, { ok: true, count: 1, now }, looked.line);
        }
        if (request.action === "reveal") {
          // A fake shown for what it truly is (1.79): the stack the name finds in who's bag becomes its
          // true item. Anything else is already what it seems, and nothing changes.
          const fake = gameInventoryStackNamed(current, item, who.bag ?? {}, true);
          if (!fake) return serializeInventoryTag(shown, { ok: false, reason: "none-held" });
          if (!fake.truly) return serializeInventoryTag(shown, { ok: true, count: 0, now: fake.quantity });
          const trueName = rules?.itemOf(fake.truly)?.name ?? fake.truly;
          current = revealGameInventoryFake(current, fake.id, rules);
          return serializeInventoryTag(
            { ...shown, revealed: trueName },
            { ok: true, count: fake.quantity, now: fake.quantity },
          );
        }
        if (request.action === "remove") {
          const [result] = apply([
            { op: "take", name: item, count: request.count, ...(who.bag ? { from: who.bag } : {}), as: "lost" },
          ]);
          return serializeInventoryTag(shown, outcomeOf(result));
        }
        // A give names who receives it, and a receiver nobody can find leaves the item where it is.
        // It comes out of who's own bag, the player's when who is left out: never out of somebody
        // the Game Master did not name.
        if (!to || !to.ok)
          return serializeInventoryTag(shown, { ok: false, reason: to && !to.ok ? to.reason : "no-recipient" });
        if (!to.bag) return serializeInventoryTag(shown, { ok: false, reason: "no-recipient" });
        // Nobody is handed more than they can carry: weighed by what would really move, which is no
        // more than the giver holds.
        const from = who.bag ?? {};
        const named = gameInventoryItemsNamed(current, item, from);
        const first = current.find(
          (stack) =>
            named.has(gameInventoryItemId(stack)) &&
            gameInventoryBagKey(stack.holder) === gameInventoryBagKey(from.holder),
        );
        const moving = Math.min(request.count, gameInventoryCountItems(current, named, from));
        const heavy = first && gameInventoryGiveRefusal(current, first, to.bag.holder, moving, rules);
        if (heavy) return serializeInventoryTag(shown, { ok: false, reason: heavy });
        // Stack by stack, so the item stays the same item and a nickname stays on its stack.
        // The items it names are settled first, and counted by item in the receiver's bag, where the
        // name may be a nickname nothing there carries.
        const items = gameInventoryItemsNamed(current, item, who.bag ?? {});
        const handed = giveFromGameInventoryNamed(
          current,
          item,
          request.count,
          who.bag ?? {},
          to.bag.holder,
          newId,
          rules,
        );
        if (handed.given === 0) return serializeInventoryTag(shown, { ok: false, reason: "none-held" });
        current = handed.stacks;
        return serializeInventoryTag(shown, {
          ok: true,
          count: handed.given,
          now: gameInventoryCountItems(current, items, to.bag),
        });
      })
      .join(" ");
  });

  // Then each loot tag, on the stacks the inventory tags left: what it dropped is answered as the
  // inventory's own resolved adds, so the screen announces it and the Game Master reads it back as it
  // reads any add; a tag that dropped nothing, or was refused, keeps its own place.
  const looted = next.replace(createLootTagRegex(), (_whole, body: string) => {
    tags += 1;
    if (tags > MAX_INVENTORY_TAGS) return serializeLootTag({ raw: body.trim() }, "too-many");
    const request = parseLootTagBody(body);
    if (!request) return serializeLootTag({ raw: body.trim() }, "unreadable");
    if (!loot) return serializeLootTag(request, "no-loot-tables");
    const who = resolveGameInventoryHolder(request.who, party, current);
    if (!who.ok) return serializeLootTag(request, who.reason);
    const drops = loot(request.table);
    if (!drops) return serializeLootTag(request, "unknown-loot-table");
    if (drops.length === 0) return serializeLootTag(request);
    return drops.map((drop) => addAnswered(drop.name, { item: drop.item }, drop.count, request.who, who.bag)).join(" ");
  });
  // A binding whose needed items went elsewhere, or came off, is undone (1.313).
  return { content: looted, stacks: releaseGameInventoryUnmetBindings(current, rules), journal, tags };
}

/** One tag body answered as refused: one tag per item it names, or its sanitized text when it names
 *  none. */
function refuseTagBody(body: string, reason: string): string {
  const request = parseInventoryTagBody(body);
  if (!request) return serializeInventoryTag({ raw: body.trim() }, { ok: false, reason });
  return request.items
    .map((item) =>
      serializeInventoryTag(
        {
          action: request.action,
          item,
          count: request.count,
          ...(request.who ? { who: request.who } : {}),
          ...(request.to ? { to: request.to } : {}),
        },
        { ok: false, reason },
      ),
    )
    .join(" ");
}

/**
 * Every inventory tag in `content` answered as refused, for a reply whose tags the Engine could not
 * carry out at all. Whatever the tags said, they then say that nothing happened, which is true.
 */
export function refuseGameInventoryTags(content: string, reason: string): string {
  return content
    .replace(createInventoryTagRegex(), (_whole, body: string) => refuseTagBody(body, reason))
    .replace(createLootTagRegex(), (_whole, body: string) => {
      const request = parseLootTagBody(body);
      return serializeLootTag(request ?? { raw: body.trim() }, reason);
    });
}

/** A reply's inventory tags without a `source="story"` the Game Master wrote: only the Engine marks an
 *  Experience's own gift, which an item only a checked source may add is still given by. */
export function dropForgedStorySources(content: string): string {
  return content.replace(createInventoryTagRegex(), (tag) =>
    tag.replace(/\s*\bsource\s*=\s*(["']?)story\1(?=[\s\]])/gi, ""),
  );
}

/** The line a won fight's recap names what dropped on, already in the bags. */
export const GAME_LOOT_GIVEN_LINE = "Loot (already in the party's bags): ";

/** The line a fight's recap asks the Game Master for a reward on, where nothing dropped. It is for
 *  the Game Master alone. */
export const GAME_REWARD_PROMPT_LINE =
  'Rewards: If a reward is narratively appropriate, decide it now and add it with [inventory: action="add" item="..."].';

/** A fight's recap as the player is shown it: without the line that asks the Game Master for a
 *  reward (cheap-GM playtest 2026-10-26: the Combat Result card read "Rewards: If a reward is
 *  narratively appropriate, decide it now…"). Recaps saved before keep their own wording of it. */
export function stripGameRewardPromptLine(recap: string): string {
  return recap
    .split("\n")
    .filter((line) => !line.trim().startsWith("Rewards: If a reward is narratively appropriate"))
    .join("\n");
}

/**
 * A reply's adds and earns of what a won fight already dropped, taken out once each: the recap the
 * reply answers says the loot is in the bags, and an add of it again counted it twice (laptop playtest
 * 2026-10-25: "Found: Staff, gold pieces ×15", then the next turn earned the 15 gold and a second
 * Staff). Only one that names a drop of the recap, at its count, goes; anything else stays.
 */
export function dropGameLootRepeats(reply: string, recap: string): string {
  const at = recap.indexOf(GAME_LOOT_GIVEN_LINE);
  if (at < 0) return reply;
  const line = recap
    .slice(at + GAME_LOOT_GIVEN_LINE.length)
    .split("\n")[0]!
    .trim();
  if (!line) return reply;
  // Each drop as the recap counts it: "Staff", "gold pieces ×15". A name may hold a comma ("Crossbow,
  // heavy"), so a drop is found where its own words are, not by splitting the line.
  let left = `, ${line.toLowerCase()},`;
  return reply.replace(/\[inventory:([^\][]*)\]/gi, (tag, body: string) => {
    const attributes = new Map<string, string>();
    for (const match of body.matchAll(/(\w+)="([^"]*)"/g)) attributes.set(match[1]!.toLowerCase(), match[2]!);
    const action = attributes.get("action")?.toLowerCase();
    const item = attributes.get("item")?.trim().toLowerCase();
    if ((action !== "add" && action !== "earn") || !item || attributes.has("result")) return tag;
    const count = Number(attributes.get("count") ?? 1);
    const drop = `, ${count > 1 ? `${item} ×${count}` : item},`;
    const found = left.indexOf(drop);
    if (found < 0) return tag;
    left = `${left.slice(0, found)},${left.slice(found + drop.length)}`;
    return "";
  });
}
