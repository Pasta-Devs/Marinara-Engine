/**
 * The Game Master's `[inventory: ...]` tags, applied to the stacks.
 *
 * The server calls this once for the reply it saves. Every tag becomes one resolved tag per item,
 * carrying what really happened, so the Game Master reads its refusals back next turn and the client
 * only has to announce what the tags say. Pure: the caller saves the stacks and the journal.
 */
import { normalizeCharacterLookupName } from "./character-lookup-name.js";
import {
  applyGameInventoryOps,
  type GameInventoryJournalEntry,
  type GameInventoryOp,
  type GameInventoryOpResult,
} from "./game-inventory-ops.js";
import {
  gameInventoryBagKey,
  gameInventoryCountItems,
  gameInventoryGiveRefusal,
  gameInventoryItemId,
  gameInventoryItemsNamed,
  giveFromGameInventoryNamed,
  wearGameInventoryStack,
  type GameInventoryBagRef,
  type GameInventoryItemRules,
  type GameInventoryStack,
} from "./game-inventory-stacks.js";
import {
  createInventoryTagRegex,
  parseInventoryTagBody,
  serializeInventoryTag,
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
  | { ok: true; stacks: GameInventoryStack[]; journal: GameInventoryJournalEntry[]; line: string }
  | { ok: false; reason: string };

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
  return former ? { ok: true, bag: { holder: former } } : { ok: false, reason: "unknown-character" };
}

export interface GameInventoryTagsOutcome {
  content: string;
  stacks: GameInventoryStack[];
  journal: GameInventoryJournalEntry[];
  /** How many tags were found, answered or not. Zero means the reply changed nothing here. */
  tags: number;
}

function outcomeOf(result: GameInventoryOpResult | undefined): InventoryTagOutcome {
  if (!result) return { ok: false, reason: "refused" };
  return result.ok
    ? { ok: true, count: result.count ?? 0, now: result.now ?? 0 }
    : { ok: false, reason: result.reason };
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
): GameInventoryTagsOutcome {
  let current = stacks;
  const journal: GameInventoryJournalEntry[] = [];
  let tags = 0;

  const apply = (ops: GameInventoryOp[]): GameInventoryOpResult[] => {
    const outcome = applyGameInventoryOps(current, ops, newId, rules);
    current = outcome.stacks;
    journal.push(...outcome.journal);
    return outcome.results;
  };

  /** Putting on, taking off, binding or unbinding up to `count` of the item a name finds in one bag,
   *  one at a time, each on a stack not already so. `now` is how many of it that bag has so after. */
  const wearNamed = (
    wear: "equip" | "unequip" | "bind" | "unbind",
    item: string,
    count: number,
    bag: GameInventoryBagRef,
  ): InventoryTagOutcome => {
    const flag = wear === "equip" || wear === "unequip" ? "equipped" : "bound";
    const on = wear === "equip" || wear === "bind";
    const items = gameInventoryItemsNamed(current, item, bag);
    const mine = (stack: GameInventoryStack) =>
      items.has(gameInventoryItemId(stack)) && gameInventoryBagKey(stack.holder) === gameInventoryBagKey(bag.holder);
    if (!current.some(mine)) return { ok: false, reason: "none-held" };
    // What goes together is kept together: putting on prefers the item already bound, binding the
    // one already worn; taking off and unbinding leave the other state alone where they can.
    const other = flag === "equipped" ? "bound" : "equipped";
    const rank = (stack: GameInventoryStack) => (Boolean(stack[other]) === on ? 0 : 1);
    let done = 0;
    while (done < count) {
      const stack = current
        .filter((each) => mine(each) && Boolean(each[flag]) !== on)
        .sort((a, b) => rank(a) - rank(b))[0];
      if (!stack) break;
      const worn = wearGameInventoryStack(current, stack.id, wear, newId, rules);
      if (!worn) break;
      if ("refused" in worn) {
        if (done === 0) return { ok: false, reason: worn.refused };
        break;
      }
      current = worn.stacks;
      done += 1;
    }
    const now = current.reduce((total, stack) => total + (mine(stack) && stack[flag] ? stack.quantity : 0), 0);
    return { ok: true, count: done, now };
  };

  const next = content.replace(createInventoryTagRegex(), (_whole, body: string) => {
    tags += 1;
    // Past the cap a tag is answered as refused rather than left as written, so a result the Game
    // Master wrote itself can never read as something that happened.
    if (tags > MAX_INVENTORY_TAGS) return refuseTagBody(body, "too-many");
    const request = parseInventoryTagBody(body);
    if (!request) return serializeInventoryTag({ raw: body.trim() }, { ok: false, reason: "unreadable" });

    const who = resolveGameInventoryHolder(request.who, party, current);
    const to = request.action === "give" ? resolveGameInventoryHolder(request.to, party, current) : null;
    return request.items
      .map((item) => {
        const shown = {
          action: request.action,
          item,
          count: request.count,
          ...(request.who ? { who: request.who } : {}),
          ...(request.to ? { to: request.to } : {}),
        };
        if (!who.ok) return serializeInventoryTag(shown, { ok: false, reason: who.reason });
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
          // Into whose bag it was said to go; with nobody named, into the shared view, which a ruleset
          // that says what everyone carries fills by who can carry it, the player first.
          const [result] = apply([
            who.bag
              ? { op: "add", name: item, ...ref, count: request.count, holder: who.bag.holder, log: true }
              : { op: "add", name: item, ...ref, count: request.count, among: ["", ...party.members], log: true },
          ]);
          if (!result?.ok) return serializeInventoryTag(shown, outcomeOf(result), note);
          // One answer per bag it went into, saying whose when nobody was named (the player's says
          // nobody), and one for what nobody could carry. The first carries what was changed.
          const answers = result.placed
            ? result.placed.map((share, index) =>
                serializeInventoryTag(
                  { action: request.action, item, count: share.count, ...(share.holder ? { who: share.holder } : {}) },
                  { ok: true, count: share.count, now: share.now },
                  index === 0 ? note : undefined,
                ),
              )
            : [serializeInventoryTag(shown, outcomeOf(result), note)];
          if (result.left) {
            answers.push(
              serializeInventoryTag(
                { action: request.action, item, count: result.left, ...(request.who ? { who: request.who } : {}) },
                { ok: false, reason: "too-heavy" },
              ),
            );
          }
          return answers.join(" ");
        }
        if (
          request.action === "equip" ||
          request.action === "unequip" ||
          request.action === "bind" ||
          request.action === "unbind"
        ) {
          return serializeInventoryTag(shown, wearNamed(request.action, item, request.count, who.bag ?? {}));
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
              used = true;
              break;
            }
            if (!used) break;
          }
          if (lines.length === 0) return serializeInventoryTag(shown, { ok: false, reason: refused ?? "none-held" });
          return serializeInventoryTag(
            shown,
            { ok: true, count: lines.length, now: gameInventoryCountItems(current, items, who.bag ?? {}) },
            lines.join(" "),
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

  return { content: next, stacks: current, journal, tags };
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
  return content.replace(createInventoryTagRegex(), (_whole, body: string) => refuseTagBody(body, reason));
}
