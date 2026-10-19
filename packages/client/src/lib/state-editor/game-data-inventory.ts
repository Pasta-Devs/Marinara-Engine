// ──────────────────────────────────────────────
// Game data inventory (#7743 slice 3): a State Editor edit of the game's item
// stacks, turned into the ops POST /api/game/inventory applies (set, rename,
// give, equip, …). There is no replace-all op, and the turn's tracker copy
// (playerStats.inventory) is never written.
// ──────────────────────────────────────────────
import {
  GAME_INVENTORY_MAX_OPS,
  GAME_INVENTORY_MAX_QUANTITY,
  type GameInventoryOp,
  type GameInventoryStack,
} from "@marinara-engine/shared";
import { stateValuesEqual } from "./state-editor-json";

/** Why an inventory edit can't be sent. `fixed`: a field no op changes (`field` says which). */
export type GameDataInventoryIssue =
  | { kind: "notList" }
  | { kind: "notStack"; index: number }
  | { kind: "unknownStack"; id: string }
  | { kind: "duplicateStack"; id: string }
  | { kind: "fixed"; name: string; field: string }
  | { kind: "quantity"; name: string }
  | { kind: "newStack"; index: number }
  | { kind: "tooMany"; max: number };

/** What an op the editor sent is about, to word a refusal: the stack's name as the player sees it. */
export interface GameDataInventoryOpLabel {
  name: string;
  holder?: string;
}

/** Fields only the game sets: a stack's own name and catalog item, fight leftovers, a fake's truth. */
const FIXED_FIELDS = ["name", "item", "loaded", "charges", "truly"] as const;
/** What an op can change, besides the id it matches by. */
const EDITABLE_FIELDS = new Set(["id", "quantity", "nickname", "holder", "equipped", "bound", "on", ...FIXED_FIELDS]);
/** What a new stack may say: the add op's fields. */
const NEW_STACK_FIELDS = new Set(["name", "item", "quantity", "holder"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const shownName = (stack: { name?: unknown; nickname?: unknown }) =>
  String((typeof stack.nickname === "string" && stack.nickname) || stack.name || "");

const validQuantity = (value: unknown, min: number) =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= GAME_INVENTORY_MAX_QUANTITY;

/** An optional text field read as the op wants it: absent and "" both mean none. */
const optionalText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

/**
 * The ops that turn `opened` (the stacks the editor opened) into `edited`, matched by stack id.
 * A stack left out is set to 0; one without an id is added by name. Order isn't sent: the game keeps
 * its own. `labels` names each op's stack, so a refusal can say which one it was.
 */
export function buildGameInventoryOps(
  opened: GameInventoryStack[],
  edited: unknown,
): { ops: GameInventoryOp[]; labels: GameDataInventoryOpLabel[] } | { issue: GameDataInventoryIssue } {
  if (!Array.isArray(edited)) return { issue: { kind: "notList" } };
  const byId = new Map(opened.map((stack) => [stack.id, stack]));
  const ops: GameInventoryOp[] = [];
  const labels: GameDataInventoryOpLabel[] = [];
  const push = (op: GameInventoryOp, stack: { name?: unknown; nickname?: unknown; holder?: unknown }) => {
    ops.push(op);
    labels.push({
      name: shownName(stack),
      ...(optionalText(stack.holder) ? { holder: optionalText(stack.holder) } : {}),
    });
  };
  const seen = new Set<string>();

  for (const [index, item] of edited.entries()) {
    if (!isRecord(item)) return { issue: { kind: "notStack", index } };
    const id = typeof item.id === "string" ? item.id : undefined;

    if (id === undefined) {
      // A new stack: what the add op takes, nothing more.
      const name = optionalText(item.name);
      const quantity = item.quantity ?? 1;
      if (!name || Object.keys(item).some((field) => !NEW_STACK_FIELDS.has(field)) || !validQuantity(quantity, 1)) {
        return { issue: { kind: "newStack", index } };
      }
      const holder = optionalText(item.holder);
      const itemRef = optionalText(item.item);
      push(
        {
          op: "add",
          name,
          count: quantity as number,
          ...(holder ? { holder } : {}),
          ...(itemRef ? { item: itemRef } : {}),
        },
        item,
      );
      continue;
    }

    const was = byId.get(id);
    if (!was) return { issue: { kind: "unknownStack", id } };
    if (seen.has(id)) return { issue: { kind: "duplicateStack", id } };
    seen.add(id);
    const name = shownName(was);
    for (const field of FIXED_FIELDS) {
      if (!stateValuesEqual(item[field] ?? null, was[field] ?? null)) return { issue: { kind: "fixed", name, field } };
    }
    const unknownField = Object.keys(item).find((field) => !EDITABLE_FIELDS.has(field));
    if (unknownField) return { issue: { kind: "fixed", name, field: unknownField } };
    if (!validQuantity(item.quantity, 0)) return { issue: { kind: "quantity", name } };

    const quantity = item.quantity as number;
    if (quantity !== was.quantity) push({ op: "set", id, quantity }, was);
    if (quantity === 0) continue;
    // A nickname back to none, or to the item's own name, clears it: the rename op sends the own name.
    const nickname = optionalText(item.nickname);
    if (nickname !== optionalText(was.nickname)) push({ op: "rename", id, name: nickname ?? was.name }, was);
    if (Boolean(item.on) !== Boolean(was.on)) push({ op: "switch", id, on: Boolean(item.on) }, was);
    // Off before a move, on after it, so whoever ends up carrying it is the one who wears it.
    if (!item.equipped && was.equipped) push({ op: "unequip", id }, was);
    if (!item.bound && was.bound) push({ op: "unbind", id }, was);
    const holder = optionalText(item.holder);
    if (holder !== optionalText(was.holder))
      push({ op: "give", id, ...(holder ? { to: holder } : {}) }, { ...was, holder });
    if (item.equipped && !was.equipped) push({ op: "equip", id }, { ...was, holder });
    if (item.bound && !was.bound) push({ op: "bind", id }, { ...was, holder });
  }

  for (const stack of opened) {
    if (!seen.has(stack.id)) push({ op: "set", id: stack.id, quantity: 0 }, stack);
  }
  if (ops.length > GAME_INVENTORY_MAX_OPS) return { issue: { kind: "tooMany", max: GAME_INVENTORY_MAX_OPS } };
  return { ops, labels };
}

/** The ops' stacks as the editor opened them, by id: the inventory route checks them where it writes. */
export function gameInventoryOpsExpected(
  opened: GameInventoryStack[],
  ops: GameInventoryOp[],
): Record<string, GameInventoryStack> {
  const touched = new Set(ops.flatMap((op) => ("id" in op && typeof op.id === "string" ? [op.id] : [])));
  return Object.fromEntries(opened.filter((stack) => touched.has(stack.id)).map((stack) => [stack.id, stack]));
}

/** The stacks the ops touch whose stored value changed since the editor opened them (stale). */
export function findGameInventoryStacksChangedSince(
  opened: GameInventoryStack[],
  fresh: GameInventoryStack[],
  ops: GameInventoryOp[],
): string[] {
  const touched = new Set(ops.flatMap((op) => ("id" in op && typeof op.id === "string" ? [op.id] : [])));
  return opened
    .filter((stack) => touched.has(stack.id))
    .filter((stack) => !stateValuesEqual(stack, fresh.find((item) => item.id === stack.id) ?? null))
    .map(shownName);
}
