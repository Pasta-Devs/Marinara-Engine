/**
 * Items drawn as they are used (Capability API 1.808, laptop v3 2026-10-26: a carried Longbow was never
 * offered as an attack in a fight).
 *
 *   - `items.drawOnUse` names categories or tags. An item of one of them that takes slots is used while
 *     only carried: the Use button, a fight's item menu and a ruleset fight's attacks all take it.
 *   - It still takes its slots only while it is on, and is put on only where they are free: two
 *     weapons in two hands leave no room to equip a third.
 *   - Using it puts it on as a free swap: the fewest other drawn-as-used items in its slots are put
 *     away. Nothing else (a buckler, gauntlets, a cursed weapon) ever is: then the use is refused.
 *   - In a ruleset fight it is taken in hand as the In hand row takes it (playtest 2026-10-26: a
 *     Longsword drawn past Shield and Shortsword left all three in hand by the next fight): what it
 *     replaces is put away, the fight says so in the line the row's draw says, the menu is read again,
 *     and the bag holds two in hand for the next fight. The turn's free interaction stays unspent.
 *   - A ruleset without it is unchanged. Checked at import, and the install gate asks for 1.808.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyRulesetCombatChoice,
  applyRulesetFightItemChanges,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  drawGameInventoryFightItem,
  drawGameInventoryStack,
  gameFightItems,
  gameInventoryDrawPlan,
  gameInventoryUsableStack,
  gameInventoryWearNeeds,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetFightItemChanges,
  rulesetInHand,
  rulesetItemBook,
  rulesetItemFightEffect,
  rulesetItemUseLine,
  rulesetSheetItems,
  supportedCapabilityApi,
  useRulesetItemOutsideFight,
  wearGameInventoryStack,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-draw-on-use-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 808);
  const emberText = readFileSync(
    fileURLToPath(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url)),
    "utf8",
  );
  // Ember Roads has two hands. A buckler (not drawn as it is used) and a knife whose use mends its user
  // are added; its axe, spear and bow are weapons, the bow two-handed, its gauntlets armor in both hands.
  const ember = (drawOnUse?: unknown, edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(emberText) as Record<string, any>;
    if (drawOnUse !== undefined) doc.items.drawOnUse = drawOnUse;
    const outfitter = doc.catalogs.find((catalog: { id: string }) => catalog.id === "outfitter");
    const axe = outfitter.entries.find((entry: { id: string }) => entry.id === "hand-axe");
    outfitter.entries.push(
      {
        id: "buckler",
        label: "Buckler",
        item: { category: "armor", rarity: "common", stats: { bulk: 1, guard: 1 }, slots: { hands: 1 } },
      },
      {
        id: "mending-knife",
        label: "Mending knife",
        item: {
          category: "weapon",
          rarity: "common",
          stats: { bulk: 1, damage: "1d4", swing: "brawn", reach: "close" },
          slots: { hands: 1 },
          attack: { ...axe.item.attack, range: undefined },
          use: { kind: "heal", budget: "act", range: 0, targets: "self", amount: { flat: 1 } },
        },
      },
    );
    edit(doc);
    return JSON.parse(JSON.stringify(doc));
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, `imports cleanly: ${result.ok ? "" : result.issues.join("; ")}`);
    return result.definition;
  };
  const entriesOf = (definition: RulesetDefinition): Record<string, RulesetCatalogEntry[]> =>
    Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.entries && catalog.holds !== "rows" ? [[catalog.id, catalog.entries]] : [],
      ),
    );
  const drawing = parsed(ember({ categories: ["weapon"] }));
  const plain = parsed(ember());
  const bookOf = (definition: RulesetDefinition) =>
    rulesetItemBook(definition, entriesOf(definition), { actor: "player" });
  const book = bookOf(drawing);
  const plainBook = bookOf(plain);
  const names: Record<string, string> = {
    axe: "Hand axe",
    spear: "Boar spear",
    bow: "Hunting bow",
    buckler: "Buckler",
    knife: "Mending knife",
    gauntlets: "Ox-hide gauntlets",
    arrows: "Arrows",
  };
  const refs: Record<string, string> = {
    axe: "outfitter/hand-axe",
    spear: "outfitter/boar-spear",
    bow: "outfitter/hunting-bow",
    buckler: "outfitter/buckler",
    knife: "outfitter/mending-knife",
    gauntlets: "outfitter/ox-hide-gauntlets",
    arrows: "outfitter/arrows",
  };
  /** Ada's bag: each named item one of, `+` for on. */
  const bag = (...held: string[]): GameInventoryStack[] =>
    held.map((one) => {
      const on = one.endsWith("+");
      const key = on ? one.slice(0, -1) : one;
      return {
        id: key,
        name: names[key]!,
        item: refs[key]!,
        quantity: key === "arrows" ? 10 : 1,
        ...(on ? { equipped: true as const } : {}),
      };
    });
  const worn = (stacks: readonly GameInventoryStack[]) =>
    stacks
      .filter((stack) => stack.equipped)
      .map((stack) => stack.id)
      .sort();
  const user = { name: "Ada", build: defaultRulesetSheetBuild(drawing), live: undefined };

  // ── Usable while carried ──
  {
    assert.equal(book.itemOf(refs.axe!)?.drawOnUse, true, "a weapon is drawn as it is used");
    assert.equal(book.itemOf(refs.buckler!)?.drawOnUse, undefined, "armor is not");
    assert.equal(book.itemOf(refs.arrows!)?.drawOnUse, undefined, "nor is what takes no slot");
    assert.deepEqual(gameInventoryWearNeeds(book.itemOf(refs.axe!)!), {}, "nothing has to be worn first");
    assert.equal(gameInventoryUsableStack(bag("axe")[0]!, book), true, "a carried axe is usable");
    assert.equal(gameInventoryUsableStack(bag("buckler")[0]!, book), false, "a carried buckler is not");
    // A fight's item menu offers the carried knife, whose effect asks nothing worn and says it draws.
    const effect = rulesetItemFightEffect(names.knife!, book.itemOf(refs.knife!))!;
    assert.equal(effect.wear, undefined);
    assert.equal(effect.draws, true);
    const offered = gameFightItems(bag("knife"), book, true, []);
    assert.deepEqual(
      offered.lines.map((line) => line.name),
      [names.knife],
    );
  }

  // ── Equipping is still held to the slots ──
  {
    const two = bag("axe+", "spear+", "bow");
    assert.deepEqual(wearGameInventoryStack(two, "bow", "equip", undefined, book), { refused: "no-slot" });
    const bowOn = bag("bow+", "axe");
    assert.deepEqual(wearGameInventoryStack(bowOn, "axe", "equip", undefined, book), { refused: "no-slot" });
    const shielded = bag("buckler+", "axe+", "spear");
    assert.deepEqual(wearGameInventoryStack(shielded, "spear", "equip", undefined, book), { refused: "no-slot" });
  }

  // ── Using it draws it as a free swap ──
  {
    const stacks = bag("axe+", "spear+", "knife");
    const used = useRulesetItemOutsideFight({
      definition: drawing,
      itemOf: book.itemOf,
      stacks,
      stackId: "knife",
      user,
      roll: () => 3,
    });
    assert.ok(used.ok, `the knife is used: ${used.ok ? "" : used.reason}`);
    assert.deepEqual(worn(used.stacks), ["knife", "spear"], "the first weapon in its hand is put away");
    assert.deepEqual(used.said.drawn, { stowed: [names.axe] });
    assert.match(rulesetItemUseLine(used.said), /Mending knife is drawn, and Hand axe put away\./);
    // Already in hand: nothing moves.
    const again = useRulesetItemOutsideFight({
      definition: drawing,
      itemOf: book.itemOf,
      stacks: used.stacks,
      stackId: "knife",
      user,
      roll: () => 3,
    });
    assert.ok(again.ok);
    assert.deepEqual(worn(again.stacks), ["knife", "spear"]);
    assert.equal(again.said.drawn, undefined);
    // A free hand: nothing put away.
    const free = drawGameInventoryStack(bag("axe+", "knife"), "knife", book);
    assert.ok(free && !("refused" in free));
    assert.deepEqual(worn(free.stacks), ["axe", "knife"]);
    assert.deepEqual(free.stowed, []);
    // A two-handed bow puts away both weapons, the fewest it can.
    const both = drawGameInventoryStack(bag("axe+", "spear+", "bow"), "bow", book);
    assert.ok(both && !("refused" in both));
    assert.deepEqual(worn(both.stacks), ["bow"]);
    assert.deepEqual(both.stowed, [names.axe, names.spear]);
    // One of a larger stack is drawn into a stack of its own.
    const pair: GameInventoryStack[] = [{ id: "axes", name: names.axe!, item: refs.axe!, quantity: 2 }];
    const one = drawGameInventoryStack(pair, "axes", book);
    assert.ok(one && !("refused" in one));
    assert.deepEqual(
      one.stacks.map((stack) => [stack.quantity, stack.equipped === true]),
      [
        [1, false],
        [1, true],
      ],
    );
  }

  // ── Never past what is not drawn as it is used: the use is refused ──
  {
    // The buckler holds one hand: the axe in the other may go, but the bow needs both.
    const shielded = bag("buckler+", "axe+", "bow");
    assert.deepEqual(drawGameInventoryStack(shielded, "bow", book), { refused: "hands-full", by: [names.buckler] });
    const knifeShielded = drawGameInventoryStack(bag("buckler+", "axe+", "knife"), "knife", book);
    assert.ok(knifeShielded && !("refused" in knifeShielded));
    assert.deepEqual(worn(knifeShielded.stacks), ["buckler", "knife"], "the axe goes, the buckler stays");
    // Gauntlets in both hands: the knife cannot be drawn, so it is not used, and nothing changes.
    const gloved = bag("gauntlets+", "knife");
    const refused = useRulesetItemOutsideFight({
      definition: drawing,
      itemOf: book.itemOf,
      stacks: gloved,
      stackId: "knife",
      user,
      roll: () => 3,
    });
    assert.deepEqual(refused, { ok: false, reason: "slots-full", heldBy: [names.gauntlets] });
    // Nor offered in a fight's item menu, and a fight's use by name is refused too.
    assert.deepEqual(gameFightItems(gloved, book, true, []).lines, []);
    assert.deepEqual(drawGameInventoryFightItem(gloved, names.knife!, book), {
      refused: "hands-full",
      by: [names.gauntlets],
    });
    const fightDrawn = drawGameInventoryFightItem(bag("axe+", "spear+", "knife"), names.knife!, book);
    assert.ok(!("refused" in fightDrawn));
    assert.deepEqual(worn(fightDrawn.stacks), ["knife", "spear"]);
    // A cursed weapon stays on, as armor does; the fewest are chosen among the rest.
    const slots = { hands: 2 };
    const weapon = (worn: boolean, kept = false, hands = 1) => ({
      slots: { hands },
      quantity: 1,
      worn,
      drawOnUse: true,
      kept,
    });
    assert.deepEqual(gameInventoryDrawPlan([weapon(true, true), weapon(true), weapon(false, false, 2)], 2, slots), {
      blockedBy: [0],
    });
    assert.deepEqual(gameInventoryDrawPlan([weapon(true, true), weapon(true), weapon(false)], 2, slots), {
      stow: [1],
    });
    assert.deepEqual(gameInventoryDrawPlan([weapon(false, false, 3)], 0, slots), { blockedBy: [] }, "too few hands");
  }

  // ── A ruleset fight offers a carried weapon's attack, and draws it ──
  {
    const fight = (definition: RulesetDefinition, stacks: GameInventoryStack[]) =>
      createRulesetEncounter({
        definition,
        seed: 5,
        roller: () => 4,
        combatants: [
          {
            id: "ada",
            name: "Ada",
            side: "party",
            build: defaultRulesetSheetBuild(definition),
            items: rulesetSheetItems(bookOf(definition), stacks, undefined),
          },
          {
            id: "foe",
            name: "Foe",
            side: "enemy",
            block: { health: 60, defense: 1, initiativeModifier: -20, actions: [] },
          },
        ],
      });
    const optionIds = (definition: RulesetDefinition, state: ReturnType<typeof fight>) =>
      rulesetCombatOptions(definition, state, "ada").map((option) => option.id);
    // The bow is the first thing in the bag, nothing on: its attack is offered.
    const stacks = bag("bow", "arrows", "axe+", "spear+");
    const start = fight(drawing, stacks);
    assert.ok(optionIds(drawing, start).includes("item:0"), "the carried bow is offered");
    const step = applyRulesetCombatChoice(
      drawing,
      start,
      { actorId: "ada", optionId: "item:0", targetIds: ["foe"] },
      () => 4,
    );
    assert.equal(
      step.events.some((event) => event.type === "refused"),
      false,
      "the bow shoots",
    );
    assert.deepEqual(rulesetCombatant(step.state, "ada")!.drawn, { 0: true, 2: false, 3: false });
    const changes = rulesetFightItemChanges(start, step.state);
    const written = applyRulesetFightItemChanges(stacks, changes)!;
    assert.deepEqual(worn(written.stacks), ["bow"], "the bow is drawn, both weapons put away");
    assert.equal(written.stacks.find((stack) => stack.id === "arrows")!.quantity, 9, "an arrow was shot");
    // Behind gauntlets it cannot be drawn, so it is not offered.
    assert.equal(optionIds(drawing, fight(drawing, bag("bow", "arrows", "gauntlets+"))).includes("item:0"), false);
    // Without the option, a carried bow is never offered.
    assert.equal(optionIds(plain, fight(plain, bag("bow", "arrows"))).includes("item:0"), false);
  }

  // ── A ruleset fight takes it in hand as the In hand row does: what it replaces is put away ──
  {
    // Kaela's hands: a shield (the buckler) and a shortsword (the axe), a longsword (the spear) carried.
    const en = JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../../packages/client/src/localization/locales/en.json", import.meta.url)),
        "utf8",
      ),
    ) as Record<string, string>;
    const line = (key: string, params: Record<string, string>) =>
      en[`game.combat.ruleset.event.${key}`]!.replace(/\{\{\s*(\w+)\s*\}\}/gu, (_, name: string) => params[name] ?? "");
    const fight = (stacks: GameInventoryStack[]) =>
      createRulesetEncounter({
        definition: drawing,
        seed: 5,
        roller: () => 4,
        combatants: [
          {
            id: "ada",
            name: "Ada",
            side: "party",
            build: defaultRulesetSheetBuild(drawing),
            items: rulesetSheetItems(book, stacks, undefined),
          },
          {
            id: "foe",
            name: "Foe",
            side: "enemy",
            block: { health: 60, defense: 1, initiativeModifier: -20, actions: [] },
          },
        ],
      });
    const holding = (state: ReturnType<typeof fight>) =>
      rulesetInHand(drawing, rulesetCombatant(state, "ada")!)!.holding.map((one) => one.name);
    const stacks = bag("spear", "buckler+", "axe+");
    const start = fight(stacks);
    assert.deepEqual(holding(start), [names.buckler, names.axe]);
    assert.ok(
      rulesetCombatOptions(drawing, start, "ada").some((option) => option.id === "item:0"),
      "spear offered",
    );
    const step = applyRulesetCombatChoice(
      drawing,
      start,
      { actorId: "ada", optionId: "item:0", targetIds: ["foe"] },
      () => 4,
    );
    assert.equal(
      step.events.some((event) => event.type === "refused"),
      false,
    );
    // The draw is said ahead of the blow, as the row's draw says it.
    assert.deepEqual(step.events[0], { type: "drew", actorId: "ada", label: names.spear, stowed: [names.axe] });
    assert.equal(
      line("drewStowing", { actor: "Ada", item: names.spear!, stowed: names.axe! }),
      "Ada takes Boar spear in hand, putting away Hand axe.",
    );
    const ada = rulesetCombatant(step.state, "ada")!;
    assert.deepEqual(ada.drawn, { 0: true, 2: false }, "the shortsword is put away");
    assert.deepEqual(holding(step.state), [names.spear, names.buckler], "two in two hands");
    assert.equal(ada.flags.pickedUp ?? false, false, "a free swap: the free interaction stays theirs");
    // The fight it was given is untouched.
    assert.equal(rulesetCombatant(start, "ada")!.drawn, undefined);
    // Written to the bag, the next fight holds the same two.
    const written = applyRulesetFightItemChanges(stacks, rulesetFightItemChanges(start, step.state))!;
    assert.deepEqual(worn(written.stacks), ["buckler", "spear"]);
    assert.deepEqual(holding(fight(written.stacks)), [names.spear, names.buckler], "next fight: two in hand");
    // Struck with again, nothing more is drawn or said.
    const again = applyRulesetCombatChoice(
      drawing,
      step.state,
      { actorId: "ada", optionId: "item:0", targetIds: ["foe"] },
      () => 4,
    );
    assert.equal(
      again.events.some((event) => event.type === "drew"),
      false,
    );
    // A free hand: drawn with nothing put away, and said so.
    const free = applyRulesetCombatChoice(
      drawing,
      fight(bag("spear", "buckler+")),
      { actorId: "ada", optionId: "item:0", targetIds: ["foe"] },
      () => 4,
    );
    assert.deepEqual(free.events[0], { type: "drew", actorId: "ada", label: names.spear, stowed: [] });
    assert.deepEqual(holding(free.state), [names.spear, names.buckler]);
  }

  // ── Without the option, nothing changes ──
  {
    assert.equal(plainBook.itemOf(refs.axe!)?.drawOnUse, undefined);
    assert.deepEqual(gameInventoryWearNeeds(plainBook.itemOf(refs.axe!)!), { equipped: true });
    assert.equal(gameInventoryUsableStack(bag("axe")[0]!, plainBook), false);
    const notWorn = useRulesetItemOutsideFight({
      definition: plain,
      itemOf: plainBook.itemOf,
      stacks: bag("axe+", "spear+", "knife"),
      stackId: "knife",
      user,
      roll: () => 3,
    });
    assert.deepEqual(notWorn, { ok: false, reason: "not-worn" });
    assert.deepEqual(gameFightItems(bag("knife"), plainBook, true, []).lines, []);
    const unchanged = bag("axe+", "knife");
    const same = drawGameInventoryStack(unchanged, "knife", plainBook);
    assert.ok(same && !("refused" in same));
    assert.equal(same.stacks, unchanged);
  }

  // ── Checked at import, and the install gate ──
  {
    const unknown = parseRulesetDefinition(ember({ categories: ["sword"] }));
    assert.equal(unknown.ok, false);
    if (!unknown.ok) assert.match(unknown.issues.join("; "), /Unknown item category "sword"/);
    const empty = parseRulesetDefinition(ember({}));
    assert.equal(empty.ok, false, "it names categories, tags or both");
    parsed(ember({ tags: ["ranged", "thrown"] }));
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      id: "ember-roads",
      name: "Ember Roads",
      version: "1.0.0",
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const gate =
      "A ruleset whose items are drawn as they are used (items.drawOnUse) requires schemaVersion 2 and capabilityApi 1.808 or newer";
    const withIt = ember({ categories: ["weapon"] });
    assert.equal(getCapabilityPackageInstallIssue(manifest(807) as never, withIt), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(808) as never, withIt), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(807) as never, ember()), gate);
  }

  console.log(
    "Drawn on use: a carried weapon is used and offered in a fight, drawn as a free swap, never past a buckler, and a ruleset without it is unchanged.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
