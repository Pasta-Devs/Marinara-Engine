// Game: Inventory Panel
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  DndContext,
  type DragEndEvent,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  Backpack,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Gift,
  Link2,
  Minus,
  Package,
  Plus,
  Power,
  Scissors,
  Search,
  Shirt,
  Wand2,
  X,
} from "lucide-react";
import {
  artIconFor,
  gameInventoryBagKey,
  rulesetStartingGearKind,
  rulesetStartingGearTakenBy,
  gameInventoryBearerStatus,
  gameInventoryOverLimit,
  gameInventoryWeightText,
  gameInventoryItemId,
  gameInventoryStackLabel,
  rulesetMoreUsesOf,
  rulesetOwnUsesMax,
  rulesetChargesStart,
  rulesetFoundStored,
  type GameInventoryBearerStatus,
  type GameInventoryWear,
  type RulesetDefinition,
  type RulesetItemBook,
  type RulesetItemBookEntry,
  type RulesetItemBookSheets,
  type RulesetLayerOptions,
  type RulesetStartingGearSelection,
} from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { isModalOverlayOpen } from "../../lib/modal-overlay-registry";
import { GAME_SECTION_CLASS } from "../../lib/chat-widget-colors";
import { defaultInventorySplitSize, parseInventoryAmount, parseInventoryCount } from "../../lib/game-inventory-amount";
import { useTranslation as useUiTranslation } from "react-i18next";
import { RulesetItemPicker, rulesetItemEffectLines, rulesetItemStatsLine } from "./RulesetItemPicker";
import { useRulesetDefinitionText } from "../../hooks/use-ruleset-text";
import type { RulesetText } from "../../lib/ruleset-text";
import { StartingGearPicker, type StartingGearTaken } from "./StartingGearPicker";
import { ArtIcon } from "./ArtIcon";

/** One stack. Two stacks may hold the same item, so a stack is told apart by its id, never its name. */
export interface InventoryItem {
  id: string;
  /** The item's own name; which item a stack is follows it, never the nickname. */
  name: string;
  /** What the player calls this stack instead, shown in place of the own name. */
  nickname?: string;
  /** The ruleset item it is, "<catalog>/<entry>". Absent for a plain item. */
  item?: string;
  quantity: number;
  /** The party member who carries it. Absent for the player's own character. */
  holder?: string;
  /** Worn by whoever carries it; a worn stack is one item. */
  equipped?: true;
  /** Bound to whoever carries it; a bound stack is one item. */
  bound?: true;
  /** What a weapon with a clip has loaded, as a fight left it. Absent reads as full. */
  loaded?: number;
  /** What an item that holds charges has left, as a fight left it. Absent reads as full. */
  charges?: number;
  /** What is left of its further uses that count their own (1.519), by place. Absent reads as full. */
  usesLeft?: Record<string, number>;
  /** What it stores to be cast later (1.524), as a fight left it. */
  storedEntries?: Array<{ entry: string; label?: string; level: number }>;
  /** An item with a switch turned on, as the player or a fight left it (1.170). Only ever one item. */
  on?: true;
  /** The form an item with forms is in (1.575), from 1; absent as it was made. Only ever one item. */
  form?: number;
  /** Who looked it over and thinks it is a fake (1.802), while it is still called what it passes for. */
  suspect?: string;
}

/** One party member's bag: `holder` as a stack has it (absent for the player), and the name shown. */
export interface InventoryBag {
  holder?: string;
  name: string;
}

/** The shared view, or one bag by its key (`gameInventoryBagKey`, the player's is ""). */
type InventoryView = { kind: "all" } | { kind: "bag"; key: string };

interface GameInventoryProps {
  items: InventoryItem[];
  /** Whose bags there are, the player's first. With more than one, the screen shows a tab per bag
   *  beside the shared view, and stacks can be given from one to another. */
  bags?: InventoryBag[];
  open: boolean;
  onClose: () => void;
  /** Called when the user adds an item by name, into the open tab's bag (the player's from the shared
   *  view): onto that bag's stack of the item when it has one. Resolves to the stack it went onto. */
  onAddItem?: (name: string, holder?: string, among?: readonly string[]) => Promise<string | null> | string | null;
  /** The items the game's ruleset lists (`useRulesetItemBook`), with the ruleset they are read
   *  against. With both, a stack of one shows what it is, and the Add row offers them in a picker;
   *  a ruleset that takes only its own items (`freeform: "refuse"`) offers only the picker. */
  itemBook?: RulesetItemBook;
  rulesetDefinition?: RulesetDefinition;
  /** Called with the items picked from the ruleset, one of each, into the open tab's bag. Resolves to
   *  the stack the last one went onto. */
  onAddRulesetItems?: (
    picks: RulesetItemBookEntry[],
    holder?: string,
    among?: readonly string[],
  ) => Promise<string | null> | string | null;
  /** Who an item added in the shared view may go to, in the order they are asked (the player's bag is
   *  ""). In a ruleset that says what everyone carries, the server picks among them; otherwise an item
   *  added there goes to the player. */
  placeAmong?: readonly string[];
  /** Called when the user puts an item on or takes it off, binds or unbinds it. Resolves to the stack
   *  it is in afterwards (one item of a larger stack is taken into its own). */
  onWearItem?: (stackId: string, wear: GameInventoryWear) => Promise<string | null> | string | null;
  /** Called when the user turns an item with a switch on or off (1.170). Resolves to the stack's id. */
  onSwitchItem?: (stackId: string, on: boolean) => Promise<string | null> | string | null;
  /** Called when the user turns an item into another of its forms (1.575), 0 as it was made. Resolves
   *  to the stack's id. */
  onFormItem?: (stackId: string, form: number) => Promise<string | null> | string | null;
  /** Called when the user wants to use an item during input phase */
  onUseItem?: (stackId: string, itemName: string, more?: number, lasts?: number) => void;
  /** Called when the user wants a ruleset item looked over before trusting it (1.802), during input
   *  phase; offered only by a ruleset whose fakes can be spotted. */
  onInspectItem?: (stackId: string, itemName: string) => void;
  /** Called when the user gives a stack a nickname, or its own name back. Resolves to the stack's id. */
  onRenameItem?: (stackId: string, nextName: string) => Promise<string | null> | string | null;
  /** Called when the user sets a stack's count: the +1 and -1 buttons, or a typed amount. 0 removes it. */
  onSetItemQuantity?: (stackId: string, quantity: number) => void | Promise<void>;
  /** Called when the user splits part of a stack into a new one. Resolves to the new stack's id. */
  onSplitItem?: (stackId: string, size: number) => Promise<string | null> | string | null;
  /** Called when the user drops a stack onto another stack of the same item. */
  onMergeItems?: (fromId: string, intoId: string) => void | Promise<void>;
  /** Called when the user gives some or all of a stack to another bag (the player's without `to`).
   *  Resolves to the stack that received it. */
  onGiveItem?: (stackId: string, to: string | undefined, count?: number) => Promise<string | null> | string | null;
  /** Called when the user drags one stack onto another item to swap their places. */
  onSwapItems?: (firstId: string, secondId: string) => void | Promise<void>;
  /** Whether the player can interact (input phase) */
  canInteract?: boolean;
  /** The ruleset's starting gear (Capability API 1.78): what each bag has taken, each character's
   *  sheet, the game's layers, whose bags it may go into (by bag key: the party members with a card),
   *  and how to take some. With it, a row offers the gear while a bag has some kind left. */
  startingGear?: {
    taken: StartingGearTaken;
    sheets?: RulesetItemBookSheets;
    layerOptions?: RulesetLayerOptions | null;
    holders: ReadonlySet<string>;
    onTake: (
      holder: string | undefined,
      selection: RulesetStartingGearSelection,
      again: boolean,
      pastLimit?: boolean,
    ) => Promise<boolean>;
  };
}

const ITEMS_PER_PAGE = 20;

/** Fields that keep Escape for themselves: in the window's own, it resets a name or drops a split or give. */
const KEEPS_ESCAPE_SELECTOR =
  "textarea, select, [contenteditable='true'], input:not([type='checkbox'], [type='radio'], [type='range'], [type='button'], [type='submit'], [type='reset'], [type='color'], [type='file'])";

/** A drop's change is fire-and-forget: whoever handles it says what went wrong, and a rejection it
 *  did not catch is not left unhandled here. */
/** How long what a use makes may last (Capability API 1.760), each a button of its own picked by its
 *  place from 1, when there are several to pick from; one plain button otherwise. */
function lastsPicks(
  lasts: ReadonlyArray<{ label?: string; minutes: number }> | undefined,
): Array<{ label: string; at: number } | undefined> {
  if (!lasts || lasts.length < 2) return [undefined];
  return lasts.map((one, n) => ({ label: one.label ?? String(n + 1), at: n + 1 }));
}

function settle(result: unknown): void {
  void Promise.resolve(result).catch(() => undefined);
}

export function GameInventory({
  items,
  bags = [],
  open,
  onClose,
  onAddItem,
  itemBook,
  rulesetDefinition,
  onAddRulesetItems,
  placeAmong,
  onWearItem,
  onSwitchItem,
  onFormItem,
  onUseItem,
  onInspectItem,
  onRenameItem,
  onSetItemQuantity,
  onSplitItem,
  onMergeItems,
  onGiveItem,
  onSwapItems,
  canInteract,
  startingGear,
}: GameInventoryProps) {
  const { t: localizeUi } = useUiTranslation();
  const rulesetText = useRulesetDefinitionText(rulesetDefinition ?? { id: "", version: 0 });
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  // What was typed as a new name, kept with the stack and name it was typed for.
  const [renameTyped, setRenameTyped] = useState<{ key: string; text: string } | null>(null);
  const [renamePending, setRenamePending] = useState(false);
  const [addPending, setAddPending] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [amountPending, setAmountPending] = useState(false);
  // What was typed into the amount field, kept with the stack and count it was typed for.
  const [amountTyped, setAmountTyped] = useState<{ key: string; text: string } | null>(null);
  const [splitDraft, setSplitDraft] = useState<string | null>(null);
  const [splitPending, setSplitPending] = useState(false);
  const [giveDraft, setGiveDraft] = useState<{ to: string; count: string } | null>(null);
  const [givePending, setGivePending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  const [view, setView] = useState<InventoryView>({ kind: "all" });
  const [pageIndex, setPageIndex] = useState(0);

  // Tabs only when somebody besides the player could carry something.
  const showBags = bags.length > 1;
  const bagByKey = useMemo(() => new Map(bags.map((bag) => [gameInventoryBagKey(bag.holder), bag])), [bags]);
  const bagName = (holder: string | undefined) =>
    bagByKey.get(gameInventoryBagKey(holder))?.name ?? holder ?? bags[0]?.name ?? "";
  // A tab whose bag is gone (its member left and carries nothing) falls back to the shared view.
  const activeView = useMemo<InventoryView>(
    () => (showBags && (view.kind === "all" || bagByKey.has(view.key)) ? view : { kind: "all" }),
    [bagByKey, showBags, view],
  );
  const visibleItems = useMemo(
    () =>
      activeView.kind === "all" ? items : items.filter((item) => gameInventoryBagKey(item.holder) === activeView.key),
    [activeView, items],
  );
  const activeBag = activeView.kind === "bag" ? bagByKey.get(activeView.key) : undefined;

  // Mouse: 4px distance threshold so quick clicks still select.
  // Touch: 200ms hold within 5px so swipe-to-scroll still works on mobile.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleItemClick = useCallback((item: InventoryItem) => {
    setSelectedItem((prev) => (prev === item.id ? null : item.id));
  }, []);

  const handleUse = useCallback(
    (stackId: string, itemName: string, more?: number, lasts?: number) => {
      onUseItem?.(stackId, itemName, more, lasts);
      setSelectedItem(null);
    },
    [onUseItem],
  );

  // Clear selection if the selected stack was removed, or is not in the tab that is open.
  useEffect(() => {
    if (selectedItem && !visibleItems.some((i) => i.id === selectedItem)) {
      setSelectedItem(null);
    }
  }, [visibleItems, selectedItem]);

  const selectedInventoryItem = selectedItem ? (visibleItems.find((item) => item.id === selectedItem) ?? null) : null;
  const pageCount = Math.max(1, Math.ceil(visibleItems.length / ITEMS_PER_PAGE));
  const pageStart = pageIndex * ITEMS_PER_PAGE;
  const pageItems = visibleItems.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  // Worked out while rendering, like the amount below, so a name typed right after picking a stack
  // is never overwritten by the pick catching up.
  const selectedLabel = selectedInventoryItem ? gameInventoryStackLabel(selectedInventoryItem) : "";
  const renameKey = selectedInventoryItem ? `${selectedInventoryItem.id}:${selectedLabel}` : "";
  const renameDraft = renameTyped && renameTyped.key === renameKey ? renameTyped.text : selectedLabel;
  const setRenameDraft = useCallback((text: string) => setRenameTyped({ key: renameKey, text }), [renameKey]);

  // The amount field shows the stack as it stands whenever it changes or another stack is picked, and
  // a split in progress is dropped with it. Worked out while rendering rather than reset afterwards,
  // so an amount typed right after picking a stack is never overwritten by that pick catching up.
  const selectedStackId = selectedInventoryItem?.id;
  const selectedQuantity = selectedInventoryItem?.quantity;
  const amountKey = selectedInventoryItem ? `${selectedInventoryItem.id}:${selectedInventoryItem.quantity}` : "";
  const amountDraft =
    amountTyped && amountTyped.key === amountKey
      ? amountTyped.text
      : selectedQuantity === undefined
        ? ""
        : String(selectedQuantity);
  const setAmountDraft = useCallback((text: string) => setAmountTyped({ key: amountKey, text }), [amountKey]);
  useEffect(() => {
    setSplitDraft(null);
    setGiveDraft(null);
  }, [selectedStackId]);

  useEffect(() => {
    setPageIndex((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  // Escape closes the window, as its X does. Read in the capture phase, before a picker `Modal` above
  // it takes the same press from its `document` listener and drops out of the overlay registry, so a
  // press that closes the picker leaves the window open. Claimed, so a window the game sits in stays.
  // The latest `onClose` is read at the press, so a new one each render does not re-add the listener.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing || event.defaultPrevented || isModalOverlayOpen()) return;
      if (event.target instanceof Element && event.target.closest(KEEPS_ESCAPE_SELECTOR)) return;
      event.preventDefault();
      onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  useEffect(() => {
    if (!selectedItem) return;
    const selectedIndex = visibleItems.findIndex((item) => item.id === selectedItem);
    if (selectedIndex >= 0) {
      setPageIndex(Math.floor(selectedIndex / ITEMS_PER_PAGE));
    }
  }, [visibleItems, selectedItem]);

  const handleRename = useCallback(
    async (item: InventoryItem) => {
      if (!onRenameItem) return;

      const nextName = renameDraft.trim().replace(/\s+/g, " ");
      if (!nextName || nextName === gameInventoryStackLabel(item)) return;

      setRenamePending(true);
      try {
        const resolvedId = await onRenameItem(item.id, nextName);
        if (resolvedId) {
          setSelectedItem(resolvedId);
        }
      } finally {
        setRenamePending(false);
      }
    },
    [onRenameItem, renameDraft],
  );

  const activeHolder = activeBag?.holder;
  // Starting gear: offered wherever the ruleset has some, and named as taken once every kind of it is
  // in the bag in view (any bag, in the shared view), when it can still be taken again.
  const gearKinds = useMemo(
    () =>
      rulesetDefinition
        ? new Set(
            (rulesetDefinition.items?.startingGear ?? []).map((each) =>
              rulesetStartingGearKind(rulesetDefinition, each.id),
            ),
          )
        : new Set<string>(),
    [rulesetDefinition],
  );
  const gearOffered = Boolean(startingGear && itemBook && gearKinds.size > 0);
  // Gear goes into the player's bag or a party member's with a card, which the server checks too.
  const gearBags = useMemo(() => {
    const allowed = bags.filter((bag) => !bag.holder || startingGear?.holders.has(gameInventoryBagKey(bag.holder)));
    return allowed.length > 0 ? allowed : [{ name: "" }];
  }, [bags, startingGear?.holders]);
  const kindsTaken = (holder: string | undefined) =>
    new Set(
      rulesetStartingGearTakenBy(startingGear?.taken ?? {}, gameInventoryBagKey(holder)).map((id) =>
        rulesetDefinition ? rulesetStartingGearKind(rulesetDefinition, id) : id,
      ),
    );
  const gearBagInView =
    activeBag && gearBags.find((bag) => gameInventoryBagKey(bag.holder) === gameInventoryBagKey(activeBag.holder));
  const gearLeft = (activeBag ? (gearBagInView ? [gearBagInView] : []) : gearBags).some((bag) => {
    const taken = kindsTaken(bag.holder);
    return [...gearKinds].some((kind) => !taken.has(kind));
  });
  // From the shared view, an addition is put wherever it can be carried; from a tab, into that bag.
  const addAmong = activeView.kind === "all" && itemBook?.bearer ? placeAmong : undefined;
  const handleAdd = useCallback(async () => {
    const name = newItemName.trim().replace(/\s+/g, " ");
    if (!onAddItem || !name) return;

    setAddPending(true);
    try {
      const addedStackId = await onAddItem(name, activeHolder, addAmong);
      if (addedStackId) {
        setNewItemName("");
        setSelectedItem(addedStackId);
      }
    } finally {
      setAddPending(false);
    }
  }, [activeHolder, addAmong, newItemName, onAddItem]);

  const handleAddRulesetItems = useCallback(
    async (picks: RulesetItemBookEntry[]) => {
      if (!onAddRulesetItems || picks.length === 0) return;
      setAddPending(true);
      try {
        const addedStackId = await onAddRulesetItems(picks, activeHolder, addAmong);
        if (addedStackId) setSelectedItem(addedStackId);
      } finally {
        setAddPending(false);
      }
    },
    [activeHolder, addAmong, onAddRulesetItems],
  );
  const [wearPending, setWearPending] = useState(false);
  const handleWear = useCallback(
    async (item: InventoryItem, wear: GameInventoryWear) => {
      if (!onWearItem) return;
      setWearPending(true);
      try {
        const wornId = await onWearItem(item.id, wear);
        if (wornId) setSelectedItem(wornId);
      } finally {
        setWearPending(false);
      }
    },
    [onWearItem],
  );
  const handleSwitch = useCallback(
    async (item: InventoryItem) => {
      if (!onSwitchItem) return;
      setWearPending(true);
      try {
        const switchedId = await onSwitchItem(item.id, item.on !== true);
        if (switchedId) setSelectedItem(switchedId);
      } finally {
        setWearPending(false);
      }
    },
    [onSwitchItem],
  );
  const handleForm = useCallback(
    async (item: InventoryItem, form: number) => {
      if (!onFormItem) return;
      setWearPending(true);
      try {
        const formedId = await onFormItem(item.id, form);
        if (formedId) setSelectedItem(formedId);
      } finally {
        setWearPending(false);
      }
    },
    [onFormItem],
  );
  // What the bag in view carries and wears against what its bearer can: the player's own in the
  // shared view when there are no other bags.
  const bindingLabel = rulesetDefinition?.items?.binding?.label;
  const statusOf = (holder: string | undefined) =>
    itemBook && (itemBook.bearer || itemBook.slots) ? gameInventoryBearerStatus(items, holder, itemBook) : undefined;
  const bagStatus = activeBag ? statusOf(activeBag.holder) : !showBags ? statusOf(undefined) : undefined;
  /** The coins in view, family by family, largest first, with their worth in the family's smallest. */
  const purse = useMemo(() => {
    const families = new Map<
      string,
      {
        id: string;
        label: string;
        worth: number;
        smallest: string;
        coins: Array<{ name: string; count: number; value: number }>;
      }
    >();
    for (const coin of itemBook?.coins ?? []) {
      const family = coin.coin!.family;
      const known = families.get(family) ?? {
        id: family,
        label: coin.facts.category,
        worth: 0,
        smallest: coin.name,
        coins: [],
      };
      if (coin.coin!.value === 1) known.smallest = coin.name;
      const count = visibleItems
        .filter((item) => item.item === coin.item)
        .reduce((sum, item) => sum + item.quantity, 0);
      if (count > 0) known.coins.push({ name: coin.name, count, value: coin.coin!.value });
      known.worth += count * coin.coin!.value;
      families.set(family, known);
    }
    return [...families.values()]
      .filter((family) => family.coins.length > 0)
      .map((family) => ({ ...family, coins: family.coins.sort((a, b) => b.value - a.value) }));
  }, [itemBook, visibleItems]);
  // The picker is offered only with something to offer; a ruleset that takes only its own items has
  // no typed-in name to add.
  const picksItems = Boolean(itemBook && rulesetDefinition && onAddRulesetItems);
  const typesItems = Boolean(onAddItem) && itemBook?.plain !== "refuse";
  const selectedRulesetItem =
    selectedInventoryItem?.item && itemBook ? itemBook.itemOf(selectedInventoryItem.item) : undefined;

  const setQuantity = useCallback(
    async (item: InventoryItem, quantity: number) => {
      if (!onSetItemQuantity || quantity === item.quantity) return;
      setAmountPending(true);
      try {
        await onSetItemQuantity(item.id, quantity);
      } finally {
        setAmountPending(false);
      }
    },
    [onSetItemQuantity],
  );

  /** What was typed into the amount field: a count, or +N / -N. Emptying a stack of more than one asks
   *  first, since that is the whole pile gone in one keystroke. Enter disables the field while it
   *  saves, which blurs it, and the confirmation takes focus too: one commit runs at a time, so neither
   *  commits the same amount again. */
  const amountCommitting = useRef(false);
  const commitAmount = useCallback(
    async (item: InventoryItem) => {
      if (amountCommitting.current) return;
      const next = parseInventoryAmount(amountDraft, item.quantity);
      if (next === null || next === item.quantity) {
        setAmountDraft(String(item.quantity));
        return;
      }
      amountCommitting.current = true;
      try {
        if (
          next === 0 &&
          item.quantity > 1 &&
          !window.confirm(
            localizeUi("ui.game.gameinventory.removeAllValue1Confirm", {
              count: item.quantity,
              value1: gameInventoryStackLabel(item),
            }),
          )
        ) {
          setAmountDraft(String(item.quantity));
          return;
        }
        setAmountDraft(String(next));
        await setQuantity(item, next);
      } finally {
        amountCommitting.current = false;
      }
    },
    [amountDraft, localizeUi, setAmountDraft, setQuantity],
  );

  const commitSplit = useCallback(
    async (item: InventoryItem) => {
      if (!onSplitItem || splitDraft === null) return;
      const size = parseInventoryCount(splitDraft, item.quantity - 1);
      if (size === null) return;
      setSplitPending(true);
      try {
        const newStackId = await onSplitItem(item.id, size);
        if (newStackId) setSplitDraft(null);
      } finally {
        setSplitPending(false);
      }
    },
    [onSplitItem, splitDraft],
  );

  /** Some or all of the selected stack to the bag picked in the give row. */
  const commitGive = useCallback(
    async (item: InventoryItem) => {
      if (!onGiveItem || giveDraft === null) return;
      const count = parseInventoryCount(giveDraft.count, item.quantity);
      if (count === null) return;
      const receiver = bags.find((bag) => gameInventoryBagKey(bag.holder) === giveDraft.to);
      if (!receiver || gameInventoryBagKey(receiver.holder) === gameInventoryBagKey(item.holder)) return;
      setGivePending(true);
      try {
        const receivedId = await onGiveItem(item.id, receiver.holder, count < item.quantity ? count : undefined);
        if (receivedId) {
          setGiveDraft(null);
          // Followed into the shared view when the open tab no longer holds it.
          if (activeView.kind === "bag" && activeView.key !== giveDraft.to) setSelectedItem(null);
          else setSelectedItem(receivedId);
        }
      } finally {
        setGivePending(false);
      }
    },
    [activeView, bags, giveDraft, onGiveItem],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      // Stacks are found by id, so a list that changed during the drag never swaps the wrong pair.
      const fromId = event.active.data.current?.id;
      const from = typeof fromId === "string" ? visibleItems.find((item) => item.id === fromId) : undefined;
      if (!from) return;
      // Onto a bag's tab: the whole stack is given to whoever that is.
      const over = event.over?.data.current as { id?: string; bag?: string } | undefined;
      if (typeof over?.bag === "string") {
        const receiver = bags.find((bag) => gameInventoryBagKey(bag.holder) === over.bag);
        if (onGiveItem && receiver && over.bag !== gameInventoryBagKey(from.holder)) {
          settle(onGiveItem(from.id, receiver.holder));
        }
        return;
      }
      const toId = over?.id;
      if (typeof toId !== "string" || toId === from.id) return;
      // Onto another stack of the same item, the two become one; onto anything else, they swap places.
      const to = visibleItems.find((item) => item.id === toId);
      if (!to) return;
      if (onMergeItems && gameInventoryItemId(from) === gameInventoryItemId(to)) {
        settle(onMergeItems(from.id, to.id));
        return;
      }
      if (onSwapItems) settle(onSwapItems(from.id, to.id));
    },
    [bags, visibleItems, onGiveItem, onMergeItems, onSwapItems],
  );

  if (!open) return null;

  const slots: Array<InventoryItem | null> = [];
  for (let i = 0; i < ITEMS_PER_PAGE; i++) {
    slots.push(pageItems[i] ?? null);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={localizeUi("ui.game.gamecharactersheet.inventory")}
      className="fixed inset-y-0 z-[80] flex items-center justify-center bg-black/70 p-3 pb-[max(var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom)),0.75rem)] pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-sm sm:p-4"
      style={{
        left: "var(--mari-chat-ui-inset-left, 0px)",
        right: "var(--mari-chat-ui-inset-right, 0px)",
      }}
    >
      <div
        data-game-section="inventory"
        className={cn(
          GAME_SECTION_CLASS,
          "relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-white/10 bg-black shadow-[0_0_40px_rgba(0,0,0,0.8)] supports-[height:100dvh]:max-h-[85dvh]",
        )}
      >
        {/* Header */}
        <div
          data-phone-toast-header
          className="flex items-center justify-between border-b border-white/8 bg-white/[0.02] px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <Package size={15} className="text-amber-400/80" />
            <h2 className="text-sm font-semibold tracking-wide text-white/90">
              {localizeUi("ui.game.gamecharactersheet.inventory")}
            </h2>
            <span className="rounded bg-white/8 px-1.5 py-0.5 text-[0.6rem] tabular-nums text-white/80">
              {visibleItems.length}{" "}
              {visibleItems.length === 1
                ? localizeUi("ui.game.gameinventory.item")
                : localizeUi("ui.panels.importsettings.items")}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label={localizeUi("ui.game.gameinventory.closeInventory")}
            title={localizeUi("ui.game.gameinventory.closeInventory")}
            className="rounded p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
          >
            <X size={14} />
          </button>
        </div>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          {/* Bags: the shared view, then one tab per party member. A stack dropped on a tab is given. */}
          {showBags && (
            <div className="overflow-x-auto border-b border-white/8 px-3 py-2 scrollbar-hide [-webkit-overflow-scrolling:touch]">
              <div className="flex w-max min-w-full gap-1">
                <button
                  type="button"
                  onClick={() => setView({ kind: "all" })}
                  aria-pressed={activeView.kind === "all"}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.625rem] font-medium transition-colors",
                    activeView.kind === "all"
                      ? "bg-white/10 text-white/85"
                      : "text-white/50 hover:bg-white/5 hover:text-white/70",
                  )}
                >
                  {localizeUi("ui.game.gameinventory.all")}
                </button>
                {bags.map((bag) => {
                  const key = gameInventoryBagKey(bag.holder);
                  return (
                    <BagTab
                      key={key || "player"}
                      bagKey={key}
                      name={bag.name}
                      active={activeView.kind === "bag" && activeView.key === key}
                      dropEnabled={Boolean(onGiveItem)}
                      onSelect={() => setView({ kind: "bag", key })}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* What the bag in view carries and wears against what its bearer can; in the shared view with
              several bags, each bag's load. */}
          {bagStatus && <BearerStatusLine status={bagStatus} bindingLabel={bindingLabel} unit={itemBook?.weightUnit} />}
          {!bagStatus && activeView.kind === "all" && showBags && itemBook?.bearer && (
            <div className="flex flex-wrap gap-1 border-b border-white/8 px-3 py-1.5">
              {bags.map((bag) => {
                const status = statusOf(bag.holder);
                if (!status || status.encumberedAbove === undefined) return null;
                return (
                  <span
                    key={gameInventoryBagKey(bag.holder) || "player"}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[0.6rem] tabular-nums",
                      status.encumbered ? "bg-amber-500/15 text-amber-300" : "bg-white/8 text-white/70",
                    )}
                  >
                    {localizeUi("ui.game.gameinventory.bagLoad", {
                      who: bag.name,
                      load: roundLoad(status.load),
                      max: gameInventoryWeightText(status.encumberedAbove, itemBook?.weightUnit),
                    })}
                  </span>
                );
              })}
            </div>
          )}

          {/* The coins in view, family by family, and what they are worth: the purse of the bag in view,
              or the whole party's in the shared view. */}
          {purse.length > 0 && (
            <div className="flex flex-wrap gap-1 border-b border-white/8 px-3 py-1.5">
              {purse.map((family) => (
                <span
                  key={family.id}
                  className="rounded bg-white/8 px-1.5 py-0.5 text-[0.6rem] tabular-nums text-white/70"
                >
                  {localizeUi("ui.game.gameinventory.purse", {
                    family: family.label,
                    coins: family.coins
                      .map((coin) => `${coin.name} ${localizeUi("ui.panels.imagedimensionrow.x")}${coin.count}`)
                      .join(", "),
                    worth: family.worth,
                    smallest: family.smallest,
                  })}
                </span>
              ))}
            </div>
          )}

          {/* Item list */}
          <div className="flex-1 overflow-y-auto p-3">
            {visibleItems.length > 0 ? (
              <>
                {pageCount > 1 && (
                  <div className="mb-2 flex items-center justify-between gap-2 text-[0.625rem] text-white/45">
                    <button
                      onClick={() => setPageIndex((page) => Math.max(0, page - 1))}
                      disabled={pageIndex === 0}
                      className="flex h-6 w-6 items-center justify-center rounded border border-white/8 bg-white/[0.03] transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
                      title={localizeUi("ui.game.gameinventory.previousInventoryPage")}
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <span className="tabular-nums">
                      {localizeUi("ui.game.gameinventory.page")} {pageIndex + 1} / {pageCount}
                    </span>
                    <button
                      onClick={() => setPageIndex((page) => Math.min(pageCount - 1, page + 1))}
                      disabled={pageIndex >= pageCount - 1}
                      className="flex h-6 w-6 items-center justify-center rounded border border-white/8 bg-white/[0.03] transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
                      title={localizeUi("ui.game.gameinventory.nextInventoryPage")}
                    >
                      <ChevronRight size={12} />
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-5 gap-1.5">
                  {slots.map((item, i) => {
                    const globalIndex = pageStart + i;
                    return (
                      <InventorySlot
                        key={`slot-${globalIndex}`}
                        item={item}
                        globalIndex={globalIndex}
                        holderName={showBags && activeView.kind === "all" && item ? bagName(item.holder) : undefined}
                        bindingLabel={bindingLabel}
                        icons={item ? stackIcons(item, itemBook) : undefined}
                        selected={Boolean(item && selectedItem === item.id)}
                        reorderEnabled={Boolean(onSwapItems || onMergeItems || onGiveItem)}
                        onClick={() => item && handleItemClick(item)}
                      />
                    );
                  })}
                </div>
              </>
            ) : activeBag && items.length > 0 ? (
              <div className="flex min-h-40 flex-col items-center justify-center rounded border border-dashed border-white/10 bg-white/[0.02] px-4 text-center">
                <Package size={18} className="mb-2 text-white/25" />
                <div className="text-[0.75rem] font-medium text-white/55">
                  {localizeUi("ui.game.gameinventory.bagEmpty", { value1: activeBag.name })}
                </div>
              </div>
            ) : (
              <div className="flex min-h-40 flex-col items-center justify-center rounded border border-dashed border-white/10 bg-white/[0.02] px-4 text-center">
                <Package size={18} className="mb-2 text-white/25" />
                <div className="text-[0.75rem] font-medium text-white/55">
                  {localizeUi("ui.game.gameinventory.inventoryEmpty")}
                </div>
                <div className="mt-1 text-[0.65rem] text-white/35">
                  {localizeUi("ui.game.gameinventory.addAnItemToStartTrackingSupplies")}
                </div>
              </div>
            )}
          </div>
        </DndContext>

        {/* Action bar */}
        {(selectedItem || typesItems || picksItems) && (
          <div className="border-t border-white/8 bg-white/[0.02] px-4 py-2.5">
            {selectedInventoryItem && (
              <div className="mb-2 whitespace-normal break-words text-[0.7rem] font-medium text-white/60 [overflow-wrap:anywhere]">
                {selectedLabel}
                {selectedInventoryItem.nickname && (
                  <span className="ml-1.5 font-normal text-white/40">
                    {localizeUi("ui.game.gameinventory.ownNameValue1", { value1: selectedInventoryItem.name })}
                  </span>
                )}
                {showBags && (
                  <span className="ml-1.5 font-normal text-white/40">
                    {localizeUi("ui.game.gameinventory.carriedBy", { value1: bagName(selectedInventoryItem.holder) })}
                  </span>
                )}
                {selectedInventoryItem.suspect && (
                  <span className="ml-1.5 rounded border border-red-500/25 bg-red-500/10 px-1 font-normal text-red-300">
                    {localizeUi("ui.game.gameinventory.suspectValue1", { value1: selectedInventoryItem.suspect })}
                  </span>
                )}
              </div>
            )}
            {selectedRulesetItem && (
              <RulesetItemDetails
                details={selectedRulesetItem}
                rt={rulesetText}
                bound={selectedInventoryItem?.bound === true}
                loaded={selectedInventoryItem?.loaded}
                charges={selectedInventoryItem?.charges}
                usesLeft={selectedInventoryItem?.usesLeft}
                stackId={selectedInventoryItem?.id}
                storedEntries={selectedInventoryItem?.storedEntries}
              />
            )}
            {onRenameItem && selectedInventoryItem && (
              <div className="mb-2.5 flex gap-1.5">
                <input
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setRenameDraft(selectedLabel);
                    }
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleRename(selectedInventoryItem);
                    }
                  }}
                  disabled={renamePending}
                  className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[0.7rem] text-white/85 outline-none transition-colors focus:border-amber-400/40"
                  aria-label={localizeUi("ui.game.gameinventory.nicknameValue1", {
                    value1: selectedInventoryItem.name,
                  })}
                  title={localizeUi("ui.game.gameinventory.nicknameHint")}
                  placeholder={selectedInventoryItem.name}
                />
                <button
                  onClick={() => void handleRename(selectedInventoryItem)}
                  disabled={renamePending || !renameDraft.trim() || renameDraft.trim() === selectedLabel}
                  className="flex shrink-0 items-center justify-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[0.7rem] font-semibold text-amber-300 transition-colors hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Check size={12} />
                  {localizeUi("ui.noodle.noodlehome.save")}
                </button>
              </div>
            )}
            {onSplitItem && selectedInventoryItem && splitDraft !== null && (
              <div className="mb-2.5 flex items-center gap-1.5">
                <label
                  htmlFor="game-inventory-split-size"
                  className="min-w-0 flex-1 text-[0.65rem] leading-tight text-white/55"
                >
                  {localizeUi("ui.game.gameinventory.splitHowMany", { max: selectedInventoryItem.quantity - 1 })}
                </label>
                <input
                  id="game-inventory-split-size"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={selectedInventoryItem.quantity - 1}
                  value={splitDraft}
                  autoFocus
                  onChange={(e) => setSplitDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setSplitDraft(null);
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void commitSplit(selectedInventoryItem);
                    }
                  }}
                  disabled={splitPending}
                  className="w-16 rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[0.7rem] tabular-nums text-white/85 outline-none transition-colors focus:border-amber-400/40"
                />
                <button
                  onClick={() => void commitSplit(selectedInventoryItem)}
                  disabled={
                    splitPending || parseInventoryCount(splitDraft, selectedInventoryItem.quantity - 1) === null
                  }
                  className="flex shrink-0 items-center justify-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[0.7rem] font-semibold text-amber-300 transition-colors hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Scissors size={12} />
                  {localizeUi("ui.game.gameinventory.split")}
                </button>
                <button
                  onClick={() => setSplitDraft(null)}
                  className="rounded p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
                  aria-label={localizeUi("ui.game.gameinventory.cancelSplit")}
                  title={localizeUi("ui.game.gameinventory.cancelSplit")}
                >
                  <X size={12} />
                </button>
              </div>
            )}
            {onGiveItem && selectedInventoryItem && giveDraft !== null && (
              <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                <label htmlFor="game-inventory-give-to" className="text-[0.65rem] leading-tight text-white/55">
                  {localizeUi("ui.game.gameinventory.giveTo")}
                </label>
                <select
                  id="game-inventory-give-to"
                  value={giveDraft.to}
                  onChange={(e) => setGiveDraft((draft) => (draft ? { ...draft, to: e.target.value } : draft))}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setGiveDraft(null);
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void commitGive(selectedInventoryItem);
                    }
                  }}
                  disabled={givePending}
                  className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[0.7rem] text-white/85 outline-none transition-colors focus:border-amber-400/40"
                >
                  {bags
                    .filter(
                      (bag) => gameInventoryBagKey(bag.holder) !== gameInventoryBagKey(selectedInventoryItem.holder),
                    )
                    .map((bag) => (
                      <option key={gameInventoryBagKey(bag.holder) || "player"} value={gameInventoryBagKey(bag.holder)}>
                        {bag.name}
                      </option>
                    ))}
                </select>
                {selectedInventoryItem.quantity > 1 && (
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={selectedInventoryItem.quantity}
                    value={giveDraft.count}
                    onChange={(e) => setGiveDraft((draft) => (draft ? { ...draft, count: e.target.value } : draft))}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setGiveDraft(null);
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void commitGive(selectedInventoryItem);
                      }
                    }}
                    disabled={givePending}
                    aria-label={localizeUi("ui.game.gameinventory.giveHowMany", {
                      max: selectedInventoryItem.quantity,
                    })}
                    title={localizeUi("ui.game.gameinventory.giveHowMany", { max: selectedInventoryItem.quantity })}
                    className="w-16 rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[0.7rem] tabular-nums text-white/85 outline-none transition-colors focus:border-amber-400/40"
                  />
                )}
                <button
                  onClick={() => void commitGive(selectedInventoryItem)}
                  disabled={
                    givePending || parseInventoryCount(giveDraft.count, selectedInventoryItem.quantity) === null
                  }
                  className="flex shrink-0 items-center justify-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[0.7rem] font-semibold text-amber-300 transition-colors hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Gift size={12} />
                  {localizeUi("ui.game.gameinventory.give")}
                </button>
                <button
                  onClick={() => setGiveDraft(null)}
                  className="rounded p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
                  aria-label={localizeUi("ui.game.gameinventory.cancelGive")}
                  title={localizeUi("ui.game.gameinventory.cancelGive")}
                >
                  <X size={12} />
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {selectedInventoryItem && onSetItemQuantity && (
                <div
                  className="flex h-7 shrink-0 items-center overflow-hidden rounded border border-white/8 bg-white/[0.03]"
                  aria-label={localizeUi("ui.game.gameinventory.value1AmountControls", {
                    value1: selectedLabel,
                  })}
                >
                  <button
                    type="button"
                    onClick={() => void setQuantity(selectedInventoryItem, selectedInventoryItem.quantity - 1)}
                    disabled={amountPending}
                    className="flex h-full w-7 items-center justify-center text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={
                      selectedInventoryItem.quantity > 1
                        ? localizeUi("ui.game.gameinventory.decreaseValue1Amount", {
                            value1: selectedLabel,
                          })
                        : localizeUi("ui.game.gameinventory.deleteValue1", { value1: selectedLabel })
                    }
                    title={
                      selectedInventoryItem.quantity > 1
                        ? localizeUi("ui.game.gameinventory.decreaseAmount")
                        : localizeUi("ui.game.gameinventory.deleteItem")
                    }
                  >
                    <Minus size={12} />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amountDraft}
                    onChange={(e) => setAmountDraft(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onBlur={() => void commitAmount(selectedInventoryItem)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setAmountDraft(String(selectedInventoryItem.quantity));
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void commitAmount(selectedInventoryItem);
                      }
                    }}
                    disabled={amountPending}
                    aria-label={localizeUi("ui.game.gameinventory.value1Amount", {
                      value1: selectedLabel,
                    })}
                    title={localizeUi("ui.game.gameinventory.amountHint")}
                    className="h-full w-14 border-x border-white/8 bg-transparent px-1 text-center text-[0.7rem] font-semibold tabular-nums text-white/80 outline-none focus:bg-white/[0.05]"
                  />
                  <button
                    type="button"
                    onClick={() => void setQuantity(selectedInventoryItem, selectedInventoryItem.quantity + 1)}
                    disabled={amountPending}
                    className="flex h-full w-7 items-center justify-center text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={localizeUi("ui.game.gameinventory.increaseValue1Amount", {
                      value1: selectedLabel,
                    })}
                    title={localizeUi("ui.game.gameinventory.increaseAmount")}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              )}
              {selectedInventoryItem && onSplitItem && selectedInventoryItem.quantity > 1 && splitDraft === null && (
                <button
                  type="button"
                  onClick={() => {
                    setGiveDraft(null);
                    setSplitDraft(String(defaultInventorySplitSize(selectedInventoryItem.quantity)));
                  }}
                  className="flex h-7 shrink-0 items-center justify-center gap-1 rounded border border-white/8 bg-white/[0.03] px-2 text-[0.7rem] text-white/70 transition-colors hover:bg-white/[0.06]"
                  aria-label={localizeUi("ui.game.gameinventory.splitValue1", { value1: selectedLabel })}
                  title={localizeUi("ui.game.gameinventory.splitStack")}
                >
                  <Scissors size={12} />
                  {localizeUi("ui.game.gameinventory.split")}
                </button>
              )}
              {selectedInventoryItem && onGiveItem && showBags && giveDraft === null && (
                <button
                  type="button"
                  onClick={() => {
                    const receiver = bags.find(
                      (bag) => gameInventoryBagKey(bag.holder) !== gameInventoryBagKey(selectedInventoryItem.holder),
                    );
                    if (receiver) {
                      setSplitDraft(null);
                      setGiveDraft({
                        to: gameInventoryBagKey(receiver.holder),
                        count: String(selectedInventoryItem.quantity),
                      });
                    }
                  }}
                  className="flex h-7 shrink-0 items-center justify-center gap-1 rounded border border-white/8 bg-white/[0.03] px-2 text-[0.7rem] text-white/70 transition-colors hover:bg-white/[0.06]"
                  aria-label={localizeUi("ui.game.gameinventory.giveValue1", { value1: selectedLabel })}
                  title={localizeUi("ui.game.gameinventory.giveValue1", { value1: selectedLabel })}
                >
                  <Gift size={12} />
                  {localizeUi("ui.game.gameinventory.give")}
                </button>
              )}
              {selectedInventoryItem && selectedRulesetItem?.slots && onWearItem && (
                <button
                  type="button"
                  aria-pressed={selectedInventoryItem.equipped === true}
                  disabled={wearPending}
                  onClick={() =>
                    void handleWear(selectedInventoryItem, selectedInventoryItem.equipped ? "unequip" : "equip")
                  }
                  className={cn(
                    "flex h-7 shrink-0 items-center justify-center gap-1 rounded border px-2 text-[0.7rem] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    selectedInventoryItem.equipped
                      ? "border-amber-500/20 bg-amber-500/10 font-semibold text-amber-300 hover:bg-amber-500/15"
                      : "border-white/8 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]",
                  )}
                  title={localizeUi("ui.game.gameinventory.equippedHint")}
                >
                  <Shirt size={12} />
                  {localizeUi("ui.game.gameinventory.equipped")}
                </button>
              )}
              {selectedInventoryItem && selectedRulesetItem?.binds && onWearItem && (
                <button
                  type="button"
                  aria-pressed={selectedInventoryItem.bound === true}
                  disabled={wearPending}
                  onClick={() =>
                    void handleWear(selectedInventoryItem, selectedInventoryItem.bound ? "unbind" : "bind")
                  }
                  className={cn(
                    "flex h-7 shrink-0 items-center justify-center gap-1 rounded border px-2 text-[0.7rem] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    selectedInventoryItem.bound
                      ? "border-amber-500/20 bg-amber-500/10 font-semibold text-amber-300 hover:bg-amber-500/15"
                      : "border-white/8 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]",
                  )}
                  title={localizeUi("ui.game.gameinventory.boundHint")}
                >
                  <Link2 size={12} />
                  {bindingLabel ?? localizeUi("ui.game.gameinventory.bound")}
                </button>
              )}
              {selectedInventoryItem &&
                selectedRulesetItem?.toggle &&
                selectedInventoryItem.quantity === 1 &&
                onSwitchItem && (
                  <button
                    type="button"
                    aria-pressed={selectedInventoryItem.on === true}
                    disabled={wearPending}
                    onClick={() => void handleSwitch(selectedInventoryItem)}
                    className={cn(
                      "flex h-7 shrink-0 items-center justify-center gap-1 rounded border px-2 text-[0.7rem] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      selectedInventoryItem.on
                        ? "border-amber-500/20 bg-amber-500/10 font-semibold text-amber-300 hover:bg-amber-500/15"
                        : "border-white/8 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]",
                    )}
                    title={localizeUi("ui.game.gameinventory.switchHint")}
                  >
                    <Power size={12} />
                    {selectedRulesetItem.toggle.label}
                  </button>
                )}
              {/* Its forms (1.575): what it is as made, then each other form. */}
              {selectedInventoryItem &&
                selectedRulesetItem?.forms &&
                selectedInventoryItem.quantity === 1 &&
                onFormItem &&
                selectedRulesetItem.forms.map((label, form) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={(selectedInventoryItem.form ?? 0) === form}
                    disabled={wearPending || (selectedInventoryItem.form ?? 0) === form}
                    onClick={() => void handleForm(selectedInventoryItem, form)}
                    className={cn(
                      "flex h-7 shrink-0 items-center justify-center gap-1 rounded border px-2 text-[0.7rem] transition-colors disabled:cursor-not-allowed",
                      (selectedInventoryItem.form ?? 0) === form
                        ? "border-amber-500/20 bg-amber-500/10 font-semibold text-amber-300"
                        : "border-white/8 bg-white/[0.03] text-white/70 hover:bg-white/[0.06] disabled:opacity-40",
                    )}
                    title={localizeUi("ui.game.gameinventory.formHint")}
                  >
                    {label}
                  </button>
                ))}
              {selectedInventoryItem &&
                canInteract &&
                onUseItem &&
                // What it makes lasting as long as its user picks (1.760): one button for each.
                lastsPicks(selectedRulesetItem?.entry.item?.use?.makesItems?.lasts).map((pick) => (
                  <button
                    key={pick?.label ?? "use"}
                    onClick={() =>
                      // A nickname is said with the item's own name, in the "Nickname (Name)" form the Game
                      // Master's inventory block uses, so it knows what it is.
                      handleUse(
                        selectedInventoryItem.id,
                        `${
                          selectedInventoryItem.nickname
                            ? `${selectedLabel} (${selectedInventoryItem.name})`
                            : selectedLabel
                        }${pick ? `: ${pick.label}` : ""}`,
                        undefined,
                        pick?.at,
                      )
                    }
                    className="flex flex-1 items-center justify-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 py-1.5 text-[0.7rem] font-semibold text-amber-400 transition-colors hover:bg-amber-500/15"
                  >
                    <Wand2 size={12} />
                    {pick ? pick.label : localizeUi("ui.agents.agenteditor.use")}
                  </button>
                ))}
              {selectedInventoryItem && selectedInventoryItem.item && canInteract && onInspectItem && (
                <button
                  type="button"
                  onClick={() => {
                    onInspectItem(
                      selectedInventoryItem.id,
                      selectedInventoryItem.nickname
                        ? `${selectedLabel} (${selectedInventoryItem.name})`
                        : selectedLabel,
                    );
                    setSelectedItem(null);
                  }}
                  className="flex h-7 shrink-0 items-center justify-center gap-1 rounded border border-white/8 bg-white/[0.03] px-2 text-[0.7rem] text-white/70 transition-colors hover:bg-white/[0.06]"
                  title={localizeUi("ui.game.gameinventory.inspectHint")}
                >
                  <Search size={12} />
                  {localizeUi("ui.game.gameinventory.inspect")}
                </button>
              )}
              {/* Its further uses (Capability API 1.519), each its own button. */}
              {selectedInventoryItem &&
                canInteract &&
                onUseItem &&
                (selectedRulesetItem?.entry.item?.use || selectedRulesetItem?.entry.item?.moreUsesRolled) &&
                selectedRulesetItem.entry.item.moreUses?.map((more, n) => {
                  // A count rolled to none for this stack (1.746) is never offered.
                  const item = selectedRulesetItem.entry.item!;
                  const at = more.usesOf ? rulesetMoreUsesOf(item, more) : n;
                  const counted = at >= 0 ? item.moreUses?.[at]?.uses : undefined;
                  if (counted && rulesetOwnUsesMax(counted, selectedInventoryItem.id, at + 1, item.moreUsesRolled) < 1)
                    return null;
                  return lastsPicks(more.use?.makesItems?.lasts).map((pick) => (
                    <button
                      key={`${more.label}-${pick?.label ?? ""}`}
                      onClick={() =>
                        handleUse(
                          selectedInventoryItem.id,
                          `${selectedLabel}: ${more.label}${pick ? ` (${pick.label})` : ""}`,
                          n + 1,
                          pick?.at,
                        )
                      }
                      className="flex flex-1 items-center justify-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 py-1.5 text-[0.7rem] font-semibold text-amber-400 transition-colors hover:bg-amber-500/15"
                    >
                      <Wand2 size={12} />
                      {pick
                        ? localizeUi("game.inventory.actionWithPick", { label: more.label, pick: pick.label })
                        : more.label}
                    </button>
                  ));
                })}
            </div>
            {(typesItems || picksItems) && (
              <div className={cn("flex gap-1.5", selectedInventoryItem && "mt-2.5")}>
                {typesItems && (
                  <>
                    <input
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setNewItemName("");
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleAdd();
                        }
                      }}
                      disabled={addPending}
                      aria-label={localizeUi("ui.game.gameinventory.newItemName")}
                      placeholder={localizeUi("ui.game.gameinventory.itemName")}
                      className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[0.7rem] text-white/85 outline-none transition-colors focus:border-amber-400/40"
                    />
                    <button
                      onClick={() => void handleAdd()}
                      disabled={addPending || !newItemName.trim()}
                      className="flex shrink-0 items-center justify-center gap-1 rounded border border-white/8 bg-white/[0.03] px-2 py-1.5 text-[0.7rem] text-white/70 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus size={12} />
                      {localizeUi("ui.characters.metadatatab.add")}
                    </button>
                  </>
                )}
                {picksItems && (
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    disabled={addPending}
                    className={cn(
                      "flex shrink-0 items-center justify-center gap-1 rounded border border-white/8 bg-white/[0.03] px-2 py-1.5 text-[0.7rem] text-white/70 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40",
                      !typesItems && "flex-1",
                    )}
                    title={localizeUi("ui.game.gameinventory.fromRulesetHint")}
                  >
                    <BookOpen size={12} />
                    {localizeUi("ui.game.gameinventory.fromRuleset")}
                  </button>
                )}
              </div>
            )}
            {gearOffered && (
              <button
                type="button"
                onClick={() => setGearOpen(true)}
                disabled={addPending}
                className="mt-1.5 flex w-full items-center justify-center gap-1 rounded border border-white/8 bg-white/[0.03] px-2 py-1.5 text-[0.7rem] text-white/70 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                title={localizeUi("game.ruleset.startingGear.buttonHint")}
              >
                <Backpack size={12} />
                {gearLeft
                  ? localizeUi("game.ruleset.startingGear.button")
                  : localizeUi("game.ruleset.startingGear.buttonTaken")}
              </button>
            )}
          </div>
        )}
      </div>
      {gearOpen && startingGear && rulesetDefinition && itemBook && (
        <StartingGearPicker
          open
          onClose={() => setGearOpen(false)}
          definition={rulesetDefinition}
          layerOptions={startingGear.layerOptions}
          book={itemBook}
          bags={gearBags}
          holder={gearBagInView ? activeHolder : undefined}
          stacks={items}
          sheets={startingGear.sheets}
          taken={startingGear.taken}
          onTake={startingGear.onTake}
        />
      )}
      {picksItems && pickerOpen && (
        <RulesetItemPicker
          open
          onClose={() => setPickerOpen(false)}
          definition={rulesetDefinition!}
          book={itemBook!}
          onAdd={(picks) => void handleAddRulesetItems(picks)}
        />
      )}
    </div>
  );
}

/** A load as it is shown: at most two decimals, for weights like a quarter of a pound. */
function roundLoad(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** One bag's load against what its bearer carries, its bound items and the slots its worn items take. */
function BearerStatusLine({
  status,
  bindingLabel,
  unit,
}: {
  status: GameInventoryBearerStatus;
  bindingLabel?: string;
  /** What weights are counted in (1.791). */
  unit?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const chip = "rounded bg-white/8 px-1.5 py-0.5 text-[0.6rem] tabular-nums text-white/70";
  return (
    <div className="flex flex-wrap gap-1 border-b border-white/8 px-3 py-1.5">
      {status.encumberedAbove !== undefined && (
        <span className={cn(chip, status.encumbered && "bg-amber-500/15 text-amber-300")}>
          {status.limit !== undefined
            ? localizeUi("ui.game.gameinventory.loadWithLimit", {
                load: roundLoad(status.load),
                max: gameInventoryWeightText(status.encumberedAbove, unit),
                limit: gameInventoryWeightText(status.limit, unit),
              })
            : localizeUi("ui.game.gameinventory.load", {
                load: roundLoad(status.load),
                max: gameInventoryWeightText(status.encumberedAbove, unit),
              })}
          {status.encumbered && ` · ${localizeUi("ui.game.gameinventory.encumbered")}`}
          {/* Past what they can carry at all (Free edit's heavy starting gear). */}
          {gameInventoryOverLimit(status) && ` · ${localizeUi("ui.game.gameinventory.overLimit")}`}
        </span>
      )}
      {status.bindingMax !== undefined && (
        <span className={chip}>
          {localizeUi("ui.game.gameinventory.slotUse", {
            label: bindingLabel ?? localizeUi("ui.game.gameinventory.bound"),
            used: status.bound,
            count: status.bindingMax,
          })}
        </span>
      )}
      {status.slots.map((slot) => (
        <span key={slot.id} className={chip}>
          {localizeUi("ui.game.gameinventory.slotUse", { label: slot.label, used: slot.used, count: slot.count })}
        </span>
      ))}
    </div>
  );
}

/** What a ruleset item is: its category, rarity and tags, its stats, what it is, and how many one
 *  stack of it holds. One that binds says who may bind it, and once bound, whether it is cursed. */
function RulesetItemDetails({
  details,
  bound,
  loaded,
  charges,
  usesLeft,
  stackId,
  storedEntries,
  rt,
}: {
  details: RulesetItemBookEntry;
  /** The ruleset's own words in the player's language. */
  rt: RulesetText;
  bound: boolean;
  loaded?: number;
  charges?: number;
  usesLeft?: Record<string, number>;
  /** Its stack, whose own rolled counts it reads (1.536). */
  stackId?: string;
  storedEntries?: Array<{ entry: string; label?: string; level: number }>;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { facts } = details;
  const clip = facts.attack?.clip;
  const chargesMax = facts.use?.charges?.max;
  const heldStored =
    storedEntries ??
    (details.entry.item?.stores?.found ? rulesetFoundStored(details.entry.item.stores, stackId) : undefined);
  const binds = details.entry.item?.binds;
  const kind = [facts.category, facts.rarity, ...facts.tags].filter((word): word is string => !!word);
  const stats = rulesetItemStatsLine(facts, rt);
  return (
    <div className="mb-2.5 space-y-1">
      <div className="flex flex-wrap gap-1">
        {kind.map((word) => (
          <span key={word} className="rounded bg-white/8 px-1.5 py-0.5 text-[0.6rem] text-white/80">
            {rt(word)}
          </span>
        ))}
      </div>
      {stats && <div className="text-[0.65rem] leading-tight text-white/70">{stats}</div>}
      {rulesetItemEffectLines(facts, localizeUi, rt).map((line) => (
        <div key={line} className="text-[0.65rem] leading-tight text-white/70">
          {line}
        </div>
      ))}
      {clip && (
        <div className="text-[0.65rem] leading-tight text-white/70">
          {localizeUi("ui.game.gameinventory.loaded", { now: Math.min(loaded ?? clip.max, clip.max), max: clip.max })}
        </div>
      )}
      {chargesMax !== undefined && (
        <div className="text-[0.65rem] leading-tight text-white/70">
          {localizeUi("ui.game.gameinventory.chargesLeft", {
            // Found with rolled charges (1.573) until something changed them.
            now: Math.min(charges ?? rulesetChargesStart(facts.use!.charges!, chargesMax, stackId), chargesMax),
            max: chargesMax,
          })}
        </div>
      )}
      {details.entry.item?.moreUses?.map((more, n) => {
        if (!more.uses) return null;
        const most = rulesetOwnUsesMax(more.uses, stackId, n + 1, details.entry.item?.moreUsesRolled);
        return (
          <div key={more.label} className="text-[0.65rem] leading-tight text-white/70">
            {localizeUi("ui.game.gameinventory.usesLeft", {
              label: more.label,
              now: Math.min(usesLeft?.[String(n + 1)] ?? most, most),
              max: most,
            })}
          </div>
        );
      })}
      {/* What it stores to be cast later (1.524): a Ring of Spell Storing's spells, or what it was found
          holding (1.576) until a fight changed them. */}
      {details.entry.item?.stores && (
        <div className="text-[0.65rem] leading-tight text-white/70">
          {heldStored?.length
            ? localizeUi("ui.game.gameinventory.stored", {
                entries: heldStored
                  .map((one) => `${one.label ?? one.entry.slice(one.entry.indexOf("/") + 1)} (${one.level})`)
                  .join(", "),
                levels: heldStored.reduce((total, one) => total + one.level, 0),
                max: details.entry.item.stores.levels,
              })
            : localizeUi("ui.game.gameinventory.storedNone", { max: details.entry.item.stores.levels })}
        </div>
      )}
      {details.summary && <div className="text-[0.65rem] leading-tight text-white/55">{details.summary}</div>}
      {details.invented && (
        <div className="text-[0.65rem] leading-tight text-white/45">
          <div>{localizeUi("ui.game.gameinventory.invented")}</div>
          {details.invented.notes.length > 0 && (
            <details className="mt-0.5">
              <summary className="cursor-pointer">{localizeUi("ui.game.gameinventory.inventedChanges")}</summary>
              <ul className="mt-0.5 space-y-0.5 pl-2">
                {details.invented.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {details.stack !== undefined && (
        <div className="text-[0.65rem] leading-tight text-white/45">
          {localizeUi("ui.game.gameinventory.stackHolds", { max: details.stack })}
        </div>
      )}
      {binds?.restriction && <div className="text-[0.65rem] leading-tight text-white/45">{binds.restriction}</div>}
      {bound && binds?.cursed && (
        <div className="text-[0.65rem] font-semibold leading-tight text-amber-300">
          {localizeUi("ui.game.gameinventory.cursed")}
        </div>
      )}
    </div>
  );
}

/** One bag's tab. Also where a dragged stack is dropped to give it to whoever carries that bag. */
function BagTab({
  bagKey,
  name,
  active,
  dropEnabled,
  onSelect,
}: {
  bagKey: string;
  name: string;
  active: boolean;
  dropEnabled: boolean;
  onSelect: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { setNodeRef, isOver } = useDroppable({
    id: `bag-drop-${bagKey || "player"}`,
    data: { bag: bagKey },
    disabled: !dropEnabled,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-label={localizeUi("ui.game.gameinventory.bagOfValue1", { value1: name })}
      title={dropEnabled ? localizeUi("ui.game.gameinventory.dropToGiveValue1", { value1: name }) : undefined}
      className={cn(
        "flex max-w-[9rem] shrink-0 items-center gap-1.5 truncate rounded-md px-2.5 py-1.5 text-[0.625rem] font-medium transition-colors",
        active ? "bg-white/10 text-white/85" : "text-white/50 hover:bg-white/5 hover:text-white/70",
        isOver && "ring-2 ring-amber-400/60",
      )}
    >
      <span className="truncate">{name}</span>
    </button>
  );
}

interface InventorySlotProps {
  item: InventoryItem | null;
  globalIndex: number;
  /** Who carries the stack, shown in the shared view. */
  holderName?: string;
  /** The ruleset's word for bound, said of a bound stack. */
  bindingLabel?: string;
  /** The icons it may be drawn with, best first (1.338); its first letter when the pack has none. */
  icons?: ReadonlyArray<string | null>;
  selected: boolean;
  reorderEnabled: boolean;
  onClick: () => void;
}

/** The icons a stack may be drawn with, best first (1.338): its ruleset item's own, the one named by its
 *  entry, then the one named by its own name. */
function stackIcons(stack: InventoryItem, itemBook: RulesetItemBook | undefined): Array<string | null> {
  const cut = stack.item?.indexOf("/") ?? -1;
  const entry = stack.item ? itemBook?.itemOf(stack.item) : undefined;
  return [
    entry?.entry.icon ?? null,
    stack.item && cut > 0
      ? artIconFor({ catalog: stack.item.slice(0, cut), entry: stack.item.slice(cut + 1), item: true })
      : null,
    artIconFor({ item: stack.name }),
  ];
}

function InventorySlot({
  item,
  globalIndex,
  holderName,
  bindingLabel,
  icons,
  selected,
  reorderEnabled,
  onClick,
}: InventorySlotProps) {
  const { t: localizeUi } = useUiTranslation();
  const label = item ? gameInventoryStackLabel(item) : "";
  // A worn or bound stack says so, after its name.
  const marks = item
    ? [
        item.equipped ? localizeUi("ui.game.gameinventory.worn") : null,
        item.bound ? (bindingLabel ?? localizeUi("ui.game.gameinventory.bound")) : null,
      ].filter((mark): mark is string => Boolean(mark))
    : [];
  const enabled = reorderEnabled && Boolean(item);
  const slotData = { id: item?.id };
  const {
    setNodeRef: setDragRef,
    attributes,
    listeners,
    isDragging,
  } = useDraggable({ id: `slot-drag-${globalIndex}`, data: slotData, disabled: !enabled });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `slot-drop-${globalIndex}`,
    data: slotData,
    disabled: !enabled,
  });
  const setRefs = useCallback(
    (node: HTMLButtonElement | null) => {
      setDragRef(node);
      setDropRef(node);
    },
    [setDragRef, setDropRef],
  );

  return (
    <button
      ref={setRefs}
      {...attributes}
      {...listeners}
      onClick={onClick}
      disabled={!item}
      title={
        item
          ? [
              item.quantity > 1
                ? localizeUi("ui.game.inventoryslot.value1Value2", { value1: label, value2: item.quantity })
                : label,
              ...marks,
              holderName ? localizeUi("ui.game.gameinventory.carriedBy", { value1: holderName }) : null,
            ]
              .filter(Boolean)
              .join(" ")
          : undefined
      }
      aria-label={
        item
          ? [
              item.quantity > 1
                ? localizeUi("ui.game.inventoryslot.value1XValue2", { value1: label, value2: item.quantity })
                : label,
              ...marks,
              holderName ? localizeUi("ui.game.gameinventory.carriedBy", { value1: holderName }) : null,
            ]
              .filter(Boolean)
              .join(", ")
          : undefined
      }
      aria-pressed={enabled ? isDragging : undefined}
      className={cn(
        "group relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded border transition-all",
        // touch-action: none lets the TouchSensor activate without browser scroll-gestures stealing the touch.
        // Scrolling the inventory panel is still possible by touching the modal background / pagination row.
        enabled && "touch-none",
        item
          ? selected
            ? "border-amber-500/50 bg-amber-500/10 shadow-[inset_0_0_12px_rgba(245,158,11,0.08)]"
            : "border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]"
          : "cursor-default border-white/5 bg-white/[0.015]",
        enabled && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
        isOver && !isDragging && "border-amber-400/70 ring-2 ring-amber-400/60",
      )}
    >
      {item && (item.equipped || item.bound) && (
        <span aria-hidden="true" className="absolute right-0.5 top-0.5 flex gap-0.5 text-amber-300/90">
          {item.equipped && <Shirt size={9} />}
          {item.bound && <Link2 size={9} />}
        </span>
      )}
      {item && holderName && (
        <span
          aria-hidden="true"
          className="absolute left-0.5 top-0.5 max-w-[calc(100%-0.25rem)] truncate rounded bg-white/15 px-1 text-[0.5rem] font-semibold leading-tight text-white/75"
        >
          {holderName}
        </span>
      )}
      {item && (
        <>
          <ArtIcon
            ids={icons ?? []}
            className="h-8 w-8"
            fallback={
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gradient-to-b from-white/8 to-white/[0.02] text-sm font-bold text-amber-400/80 ring-1 ring-white/8">
                {label.charAt(0).toUpperCase()}
              </div>
            }
          />
          <div className="mt-1 flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center px-1">
            <div className="flex max-h-full min-h-0 w-full min-w-0 flex-col items-center gap-0.5 overflow-hidden max-md:overflow-y-auto max-md:overscroll-contain max-md:touch-pan-y">
              <span className="block w-full whitespace-normal break-words text-center text-[0.58rem] font-medium leading-tight text-white/80 [overflow-wrap:anywhere]">
                {label}
              </span>
              {item.quantity > 1 && (
                <span className="shrink-0 rounded bg-white/15 px-1.5 py-0.5 text-[0.55rem] font-semibold tabular-nums text-white">
                  {localizeUi("ui.panels.imagedimensionrow.x")}
                  {item.quantity}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </button>
  );
}
