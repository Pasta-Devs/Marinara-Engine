// The picker behind the inventory's "From the ruleset": every item the game's ruleset lists,
// searchable and filterable the way the sheet editor's catalog picker is, with what each item is
// shown before it is picked. Each item picked goes into the bag the inventory has open, one of each.
//
// Nothing here is shaped to one system: every label comes from the ruleset (its item categories,
// rarities, tags, stats and currencies), from the catalog's own filters, or from a localization key.
import { useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  artIconFor,
  defaultRulesetSheetBuild,
  type RulesetDefinition,
  type RulesetItemBook,
  type RulesetItemBookEntry,
  type RulesetItemEffectFact,
  type RulesetItemFacts,
  rulesetTagWords,
} from "@marinara-engine/shared";
import { ArtIcon } from "./ArtIcon";
import { useRulesetCatalog } from "../../hooks/use-capability-packages";
import { useRulesetDefinitionText } from "../../hooks/use-ruleset-text";
import { RULESET_TEXT_AS_IS, type RulesetText } from "../../lib/ruleset-text";
import {
  CATALOG_FILTER_ANY,
  CATALOG_VISIBLE_LIMIT,
  catalogFilterViews,
  filterCatalogEntries,
} from "../../lib/ruleset-catalog";
import { Modal } from "../ui/Modal";
import { GAME_DIALOG_CLASS } from "../../lib/chat-widget-colors";

const inputClass =
  "w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs text-[var(--foreground)]";
const labelClass = "text-[0.6875rem] font-medium text-[var(--muted-foreground)]";
const chipClass =
  "rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[0.625rem] text-[var(--muted-foreground)]";

/** An item's stats as one line: "Damage 1d6 · Reach close". A yes-or-no stat that is yes is its label. */
export function rulesetItemStatsLine(facts: RulesetItemFacts, rt: RulesetText = RULESET_TEXT_AS_IS): string {
  return facts.stats
    .map((stat) => (stat.text !== undefined ? `${rt(stat.label)} ${rulesetWords(stat.text, rt)}` : rt(stat.label)))
    .join(" · ");
}

/** The ruleset's own words in the player's language: a whole phrase when it has one, else each of a
 *  list's words. A number or a die has none, so it stays as written. */
function rulesetWords(value: string, rt: RulesetText): string {
  const whole = rt(value);
  if (whole !== value || !value.includes(", ")) return whole;
  return value.split(", ").map(rt).join(", ");
}

/** `t` with every word handed to it read in the ruleset's own translation: an item line is the UI's
 *  sentence around the ruleset's English names (a damage type, a save, a unit, a coin). */
function withRulesetWords(t: TFunction, rt: RulesetText): TFunction {
  if (rt === RULESET_TEXT_AS_IS) return t;
  const translate = (key: unknown, options?: unknown) =>
    (t as unknown as (key: unknown, options?: unknown) => string)(
      key,
      options && typeof options === "object"
        ? Object.fromEntries(
            Object.entries(options).map(([name, value]) => [
              name,
              typeof value === "string" ? rulesetWords(value, rt) : value,
            ]),
          )
        : options,
    );
  return translate as unknown as TFunction;
}

/** A fight effect's localized words, by effect id. The ones about the holder's own checks, saves and
 *  attacks are said as leans on those instead. */
const FIGHT_EFFECT_KEYS: Record<string, string> = {
  "attacks-against-advantage": "ui.game.gameinventory.effectAttacksAgainstAdvantage",
  "attacks-against-disadvantage": "ui.game.gameinventory.effectAttacksAgainstDisadvantage",
  "attacks-against-adjacent-advantage": "ui.game.gameinventory.effectAttacksAgainstAdjacentAdvantage",
  "attacks-against-far-disadvantage": "ui.game.gameinventory.effectAttacksAgainstFarDisadvantage",
  "attacks-against-no-advantage": "ui.game.gameinventory.effectAttacksAgainstNoAdvantage",
  "attacks-from-adjacent-critical": "ui.game.gameinventory.effectAttacksFromAdjacentCritical",
  "criticals-against-normal": "ui.game.gameinventory.effectCriticalsAgainstNormal",
  "cannot-act": "ui.game.gameinventory.effectCannotAct",
  "cannot-react": "ui.game.gameinventory.effectCannotReact",
  "speed-zero": "ui.game.gameinventory.effectSpeedZero",
  "resist-all": "ui.game.gameinventory.effectResistAll",
};

/** A weapon's attack, in two lines: what it adds to hit and deals ("Attack (Act): Brawn + 1 to hit,
 *  1d6 + Brawn cut damage"), then how far it reaches and carries and what it deals with a hand free.
 *  Empty for an item that is no weapon. */
function rulesetItemAttackLines(facts: RulesetItemFacts, t: TFunction, rt: RulesetText): string[] {
  const attack = facts.attack;
  if (!attack) return [];
  const toHit = attack.proficiency
    ? t("ui.game.gameinventory.attackProficiency", { toHit: attack.toHit })
    : attack.toHit;
  const damage = attack.type
    ? t("ui.game.gameinventory.attackTyped", { damage: attack.damage, type: attack.type })
    : attack.damage;
  const first =
    attack.target !== undefined
      ? t("ui.game.gameinventory.attackAt", { budget: attack.budget, toHit, target: attack.target, damage })
      : t("ui.game.gameinventory.attack", { budget: attack.budget, toHit, damage });
  const distance = (value: number) => (attack.unit ? `${value} ${attack.unit}` : String(value));
  const second = [
    attack.reach !== undefined ? t("ui.game.gameinventory.attackReach", { distance: distance(attack.reach) }) : "",
    attack.range
      ? attack.range.long !== undefined
        ? t("ui.game.gameinventory.attackRangeLong", {
            normal: attack.range.normal,
            long: distance(attack.range.long),
          })
        : t("ui.game.gameinventory.attackRange", { distance: distance(attack.range.normal) })
      : "",
    attack.versatile ? t("ui.game.gameinventory.attackVersatile", { dice: attack.versatile }) : "",
  ].filter(Boolean);
  const third = [
    attack.ammo
      ? t(attack.ammo.recover ? "ui.game.gameinventory.attackAmmoRecover" : "ui.game.gameinventory.attackAmmo", {
          count: attack.ammo.per,
          what: attack.ammo.what,
          percent: Math.round((attack.ammo.recover ?? 0) * 100),
        })
      : "",
    attack.clip ? t("ui.game.gameinventory.attackClip", { max: attack.clip.max, budget: attack.clip.reload }) : "",
  ].filter(Boolean);
  const signed = (value: number) => (value > 0 ? `+${value}` : String(value));
  const modes = (attack.modes ?? []).map((mode) => {
    const parts = [
      mode.ammo !== undefined ? t("ui.game.gameinventory.modeShots", { count: mode.ammo }) : "",
      mode.toHit !== undefined ? t("ui.game.gameinventory.modeToHit", { change: signed(mode.toHit) }) : "",
      mode.target !== undefined ? t("ui.game.gameinventory.modeTarget", { change: signed(mode.target) }) : "",
      mode.targets !== undefined ? t("ui.game.gameinventory.modeTargets", { count: mode.targets }) : "",
    ].filter(Boolean);
    return parts.length
      ? t("ui.game.gameinventory.modeWith", { label: mode.label, parts: parts.join(", ") })
      : mode.label;
  });
  const fourth = [
    attack.offHand ? t("ui.game.gameinventory.attackOffHand", { budget: attack.offHand.budget }) : "",
    attack.floor !== undefined ? t("ui.game.gameinventory.attackFloor", { floor: attack.floor }) : "",
    ...(attack.plus ?? []).map((clause) =>
      [
        t("ui.game.gameinventory.attackPlus", { amount: clause.amount }),
        clause.type ? rt(clause.type) : "",
        clause.against ? t("ui.game.gameinventory.attackPlusAgainst", { what: clause.against.join(", ") }) : "",
        clause.critical ? t("ui.game.gameinventory.attackPlusCritical") : "",
        clause.toggled ? t("ui.game.gameinventory.attackPlusToggled", { label: clause.toggled }) : "",
        clause.save
          ? t(
              clause.save.onSuccess === "half"
                ? "ui.game.gameinventory.attackPlusSaveHalf"
                : "ui.game.gameinventory.attackPlusSaveNone",
              { save: clause.save.save, difficulty: clause.save.difficulty },
            )
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    ),
    ...(attack.onHit ?? []).map((entry) =>
      [
        entry.rounds !== undefined
          ? t("ui.game.gameinventory.attackOnHitRounds", {
              condition: entry.condition,
              atLeast: entry.atLeast,
              rounds: entry.rounds,
            })
          : t("ui.game.gameinventory.attackOnHit", { condition: entry.condition, atLeast: entry.atLeast }),
        entry.save
          ? t("ui.game.gameinventory.attackOnHitSave", { save: entry.save.save, difficulty: entry.save.difficulty })
          : "",
        entry.saveEnds
          ? t(
              entry.saveEnds.at === "turn-start"
                ? "ui.game.gameinventory.attackOnHitSaveEndsStart"
                : entry.saveEnds.at === "damaged"
                  ? "ui.game.gameinventory.attackOnHitSaveEndsDamaged"
                  : "ui.game.gameinventory.attackOnHitSaveEndsEnd",
              { save: entry.saveEnds.save, difficulty: entry.saveEnds.difficulty },
            )
          : "",
      ]
        .filter(Boolean)
        .join(", "),
    ),
  ].filter(Boolean);
  return [
    first,
    ...(second.length ? [second.join(", ")] : []),
    ...(third.length ? [third.join(", ")] : []),
    ...(modes.length ? [t("ui.game.gameinventory.attackModes", { modes: modes.join(", ") })] : []),
    ...(fourth.length ? [fourth.join(", ")] : []),
  ];
}

/** A use's save: "Steel save of 7 for half", or without its number where the item does not give it. */
function rulesetItemUseSaveText(save: NonNullable<NonNullable<RulesetItemFacts["use"]>["save"]>, t: TFunction): string {
  const saved =
    save.difficulty !== undefined
      ? t("ui.game.gameinventory.useSaveOf", { save: save.save, difficulty: save.difficulty })
      : t("ui.game.gameinventory.useSave", { save: save.save });
  if (save.onSuccess === "half") return t("ui.game.gameinventory.useSaveHalf", { save: saved });
  if (save.onSuccess === "negates") return t("ui.game.gameinventory.useSaveNegates", { save: saved });
  return saved;
}

/** What using an item does, in one line: "Use (Action): heals 1d4+1, used up". Empty for an item
 *  nobody uses. */
function rulesetItemUseLine(facts: RulesetItemFacts, t: TFunction): string {
  const use = facts.use;
  if (!use) return "";
  const distance = (value: number) =>
    use.unit ? t("game.ruleset.catalog.mechanics.distance", { value, unit: use.unit }) : String(value);
  const parts = [
    use.kind === "heal" && use.amount ? t("ui.game.gameinventory.useHeals", { amount: use.amount }) : "",
    use.kind !== "heal" && use.amount
      ? use.type
        ? t("ui.game.gameinventory.useDamageTyped", { amount: use.amount, type: use.type })
        : t("ui.game.gameinventory.useDamage", { amount: use.amount })
      : "",
    use.toHit
      ? use.target !== undefined
        ? t("ui.game.gameinventory.useToHitAt", { toHit: use.toHit, target: use.target })
        : t("ui.game.gameinventory.useToHit", { toHit: use.toHit })
      : "",
    use.save ? rulesetItemUseSaveText(use.save, t) : "",
    use.applies?.length ? t("ui.game.gameinventory.useApplies", { conditions: use.applies.join(", ") }) : "",
    use.temporary ? t("ui.game.gameinventory.useTemporary", { amount: use.temporary }) : "",
    use.restore ? t("ui.game.gameinventory.useRestore", { amount: use.restore.amount, pool: use.restore.pool }) : "",
    use.range !== undefined ? t("game.ruleset.catalog.mechanics.range", { distance: distance(use.range) }) : "",
    use.area
      ? t("game.ruleset.catalog.mechanics.area", {
          shape: t(`game.ruleset.catalog.shape.${use.area.shape}`),
          distance: distance(use.area.size),
        })
      : "",
    use.consumes ? t("ui.game.gameinventory.useConsumes") : "",
    use.concentration ? t("game.ruleset.catalog.mechanics.concentration") : "",
    use.zone ? t("ui.game.gameinventory.useZone", { count: use.zone.rounds }) : "",
    use.ends
      ? use.ends.count !== undefined && use.ends.count < use.ends.conditions.length
        ? t("game.ruleset.catalog.mechanics.endsSome", {
            count: use.ends.count,
            conditions: use.ends.conditions.join(", "),
          })
        : t("game.ruleset.catalog.mechanics.ends", { conditions: use.ends.conditions.join(", ") })
      : "",
    use.stabilizes ? t("game.ruleset.catalog.mechanics.stabilizes") : "",
    use.revives
      ? t("game.ruleset.catalog.mechanics.revives", {
          count: use.revives.withinRounds,
          amount: use.revives.health,
        })
      : "",
    use.charges ? t("ui.game.gameinventory.useCharges", { cost: use.charges.cost, max: use.charges.max }) : "",
    use.charges?.recharge?.after?.days
      ? t("ui.game.gameinventory.useRechargeAfterDays", { days: use.charges.recharge.after.days })
      : "",
    use.charges?.recharge?.after?.hours
      ? t("ui.game.gameinventory.useRechargeAfterHours", { hours: use.charges.recharge.after.hours })
      : "",
    use.charges?.recharge?.rests.length
      ? use.charges.recharge.amount === "max"
        ? t("ui.game.gameinventory.useRechargeAll", { rests: use.charges.recharge.rests.join(", ") })
        : t("ui.game.gameinventory.useRecharge", {
            amount: use.charges.recharge.amount,
            rests: use.charges.recharge.rests.join(", "),
          })
      : "",
    use.charges?.breaksOn
      ? t(
          use.charges.breaksOn.atMost === 1
            ? "ui.game.gameinventory.useBreaksOnOne"
            : "ui.game.gameinventory.useBreaksOnFaces",
          { die: use.charges.breaksOn.die, atMost: use.charges.breaksOn.atMost },
        )
      : "",
    use.gate
      ? use.gate.unless
        ? t("ui.game.gameinventory.useGateUnless", {
            check: use.gate.check,
            difficulty: use.gate.difficulty ?? "?",
            what: rulesetSheetValueWords(use.gate.unless, t),
            atLeast: use.gate.unless.atLeast,
          })
        : t("ui.game.gameinventory.useGate", { check: use.gate.check, difficulty: use.gate.difficulty ?? "?" })
      : "",
  ].filter(Boolean);
  return use.budget
    ? t("ui.game.gameinventory.use", { budget: use.budget, does: parts.join(", ") })
    : t("ui.game.gameinventory.useFree", { does: parts.join(", ") });
}

/** A value off the sheet an item reads, in words: "Wits modifier", "Charm items", or its label. */
function rulesetSheetValueWords(value: { what: string; of?: "modifier" | "items" }, t: TFunction): string {
  if (value.of === "modifier") return t("ui.game.gameinventory.requiresModifier", { name: value.what });
  if (value.of !== "items") return value.what;
  return value.what
    ? t("ui.game.gameinventory.requiresItemsOf", { name: value.what })
    : t("ui.game.gameinventory.requiresItems");
}

/** One effect in the player's language, shared by items, sheets and battle details. */
export function rulesetEffectPhrase(fact: RulesetItemEffectFact, t: TFunction): string {
  // The ruleset's own words for it (1.378).
  if (fact.label) return fact.label;
  const names = fact.names
    .map((name, index) =>
      fact.except?.[index]?.length
        ? t("game.ruleset.hides.except", { type: name, tags: rulesetTagWords(undefined, fact.except[index]!) })
        : name,
    )
    .join(", ");
  if ("effect" in fact.change)
    return t(FIGHT_EFFECT_KEYS[fact.change.effect] ?? "ui.game.gameinventory.effectFight", {
      effect: fact.change.effect,
    });
  if ("hide" in fact.change) {
    const key =
      fact.change.hide === "resist"
        ? "ui.game.gameinventory.effectResist"
        : fact.change.hide === "vulnerable"
          ? "ui.game.gameinventory.effectVulnerable"
          : "ui.game.gameinventory.effectImmune";
    return t(key, { names });
  }
  if (fact.damage) {
    const scope = [
      fact.damage.attacks && fact.damage.attacks !== "any"
        ? t(`ui.game.gameinventory.damageAttack.${fact.damage.attacks}`)
        : "",
      fact.damage.blow ? t(`ui.game.gameinventory.damageBlow.${fact.damage.blow}`) : "",
      fact.damage.ability ? t("ui.game.gameinventory.damageAbility", { name: fact.damage.ability }) : "",
      fact.damage.type,
      fact.damage.fromSource ? t("ui.game.gameinventory.damageSource") : "",
    ]
      .filter(Boolean)
      .join(", ");
    if ("criticalDice" in fact.change)
      return (
        t("ui.game.gameinventory.damageCriticalDice", { count: fact.change.criticalDice }) +
        (scope ? ` (${scope})` : "")
      );
    const change =
      "times" in fact.change
        ? t(fact.change.times === 0.5 ? "ui.game.gameinventory.damageHalf" : "ui.game.gameinventory.damageDouble")
        : "value" in fact.change
          ? fact.change.value
          : "";
    return (
      t(fact.to === "damage-taken" ? "ui.game.gameinventory.damageTaken" : "ui.game.gameinventory.damageDealt", {
        change,
      }) + (scope ? ` (${scope})` : "")
    );
  }
  if (fact.to === "health-max") return t("ui.game.gameinventory.effectHealthMaxHalf");
  if ("times" in fact.change) {
    return t(
      fact.change.times === 0.5 ? "ui.game.gameinventory.effectSpeedHalf" : "ui.game.gameinventory.effectSpeedDouble",
    );
  }
  if (fact.to === "speed" && "value" in fact.change) {
    return t("ui.game.gameinventory.effectSpeed", { change: fact.change.value });
  }
  if ("floor" in fact.change) return t("ui.game.gameinventory.effectDefenseFloor", { value: fact.change.floor });
  if (fact.to === "defense" && "value" in fact.change) {
    return names
      ? t("ui.game.gameinventory.effectDefenseNamed", { change: fact.change.value, names })
      : t("ui.game.gameinventory.effectDefense", { change: fact.change.value });
  }
  if ("atLeast" in fact.change) {
    return t("ui.game.gameinventory.effectAbilitySet", { names, value: fact.change.atLeast });
  }
  if (fact.to === "ability" && "value" in fact.change) {
    return t("ui.game.gameinventory.effectAbilityAdd", { names, change: fact.change.value });
  }
  if ("fails" in fact.change) return t("ui.game.gameinventory.effectFailsSaves", { names });
  const change =
    "mode" in fact.change
      ? t(
          fact.change.mode === "advantage"
            ? "ui.game.gameinventory.effectAdvantage"
            : "ui.game.gameinventory.effectDisadvantage",
        )
      : "value" in fact.change
        ? fact.change.value
        : "";
  if (fact.to === "checks") {
    return names
      ? t("ui.game.gameinventory.effectOnNamedChecks", { change, names })
      : t("ui.game.gameinventory.effectOnChecks", { change });
  }
  if (fact.to === "attacks") return t("ui.game.gameinventory.effectOnAttacks", { change });
  if (fact.to === "attacks-taken") return t("ui.game.gameinventory.effectOnAttacksTaken", { change });
  if (fact.to === "save-difficulty") return t("ui.game.gameinventory.effectSaveDifficulty", { change });
  if (fact.to === "checks-taken") {
    return names
      ? t("ui.game.gameinventory.effectOnNamedChecksTaken", { change, names })
      : t("ui.game.gameinventory.effectOnChecksTaken", { change });
  }
  const save = names
    ? t("ui.game.gameinventory.effectOnNamedSaves", { change, names })
    : t("ui.game.gameinventory.effectOnSaves", { change });
  if (!fact.against) return save;
  const against = [...fact.against.names, ...(fact.against.magic ? [t("ui.game.gameinventory.effectMagic")] : [])].join(
    t("ui.game.gameinventory.effectAgainstOr"),
  );
  return t("ui.game.gameinventory.effectAgainst", { effect: save, against });
}

export function rulesetItemEffectLines(
  facts: RulesetItemFacts,
  localize: TFunction,
  rt: RulesetText = RULESET_TEXT_AS_IS,
): string[] {
  const t = withRulesetWords(localize, rt);
  const phrase = (fact: RulesetItemEffectFact) => rulesetEffectPhrase(fact, t);
  const useLine = rulesetItemUseLine(facts, t);
  return [
    ...rulesetItemAttackLines(facts, t, rt),
    ...(useLine ? [useLine] : []),
    ...(facts.toggle ? [t("ui.game.gameinventory.toggleLine", { ...facts.toggle })] : []),
    ...(["worn", "carried"] as const).flatMap((when) =>
      facts[when]?.length
        ? [
            t(when === "worn" ? "ui.game.gameinventory.whileWorn" : "ui.game.gameinventory.whileCarried", {
              effects: facts[when]!.map(phrase).join("; "),
            }),
          ]
        : [],
    ),
    ...(facts.requires ?? []).map((need) =>
      t("ui.game.gameinventory.requires", {
        what: rulesetSheetValueWords(need, t),
        atLeast: need.atLeast,
        effects: need.otherwise.map(phrase).join("; "),
      }),
    ),
  ];
}

/** The picker's list of the ruleset's coins, beside its catalogs. */
const COINS_LIST = ":coins";

export function RulesetItemPicker({
  open,
  onClose,
  definition,
  book,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  /** The ruleset the game plays by, with its layers on. */
  definition: RulesetDefinition;
  /** The game's items (`useRulesetItemBook`), which already leaves out what a layer hides. */
  book: RulesetItemBook;
  /** The items picked, one of each, for one change. */
  onAdd: (picks: RulesetItemBookEntry[]) => void;
}) {
  const { t } = useUiTranslation();
  // The ruleset's own words in the player's language, as the sheet editor's picker shows them.
  const rt = useRulesetDefinitionText(definition);
  const searchRef = useRef<HTMLInputElement>(null);
  const catalogs = useMemo(
    () => (definition.catalogs ?? []).filter((catalog) => catalog.holds === "items"),
    [definition.catalogs],
  );
  const [catalogId, setCatalogId] = useState(catalogs[0]?.id ?? "");
  // The ruleset's coins are offered beside its catalogs, as one more list: no catalog id has a colon.
  const coinsChosen = catalogId === COINS_LIST && book.coins.length > 0;
  const catalog = coinsChosen ? undefined : (catalogs.find((each) => each.id === catalogId) ?? catalogs[0]);
  const lists = [
    ...catalogs.map((each) => ({ id: each.id, label: rt(each.label) })),
    ...(book.coins.length > 0 ? [{ id: COINS_LIST, label: t("game.ruleset.items.coins") }] : []),
  ];
  const [search, setSearch] = useState("");
  // Null until the user touches a filter, like the sheet editor's picker.
  const [chosen, setChosen] = useState<Record<string, string> | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  // The same cached query the book was built from: only its loading and failure are read here.
  const query = useRulesetCatalog(definition.id, catalog?.id ?? "", definition.version, open && Boolean(catalog));
  const items = useMemo(
    () =>
      coinsChosen ? [...book.coins] : book.entries.filter((each) => each.catalogId === catalog?.id && !each.service),
    [book, catalog, coinsChosen],
  );
  const entries = useMemo(() => items.map((each) => each.entry), [items]);
  const build = useMemo(() => defaultRulesetSheetBuild(definition), [definition]);
  const views = useMemo(
    () => (catalog ? catalogFilterViews(catalog, entries, definition, build) : []),
    [build, catalog, definition, entries],
  );
  const starts = useMemo(() => Object.fromEntries(views.map((view) => [view.filter.id, view.start])), [views]);
  const active = chosen ?? starts;
  const matches = useMemo(() => {
    const shown = new Set(filterCatalogEntries(entries, views, search, active));
    // Found by its name as shown too.
    const needle = search.trim().toLowerCase();
    const named = needle ? new Set(filterCatalogEntries(entries, views, "", active)) : null;
    return items.filter(
      (each) => shown.has(each.entry) || (named?.has(each.entry) && rt(each.name).toLowerCase().includes(needle)),
    );
  }, [active, entries, items, rt, search, views]);
  const visible = matches.slice(0, CATALOG_VISIBLE_LIMIT);

  const toggle = (item: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(item)) next.add(item);
      return next;
    });
  const picks = [...book.entries, ...book.coins].filter((each) => selected.has(each.item));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("game.ruleset.items.pickerTitle")}
      width="max-w-2xl"
      mobileFullscreen
      panelClassName={GAME_DIALOG_CLASS}
      initialFocusRef={searchRef}
      contentClassName="flex flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
            <span className={labelClass}>{t("game.ruleset.catalog.searchLabel")}</span>
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("game.ruleset.items.searchPlaceholder")}
              className={inputClass}
            />
          </label>
          {lists.length > 1 && (
            <label className="flex min-w-0 basis-36 flex-col gap-1">
              <span className={labelClass}>{t("game.ruleset.items.catalog")}</span>
              <select
                value={coinsChosen ? COINS_LIST : (catalog?.id ?? "")}
                onChange={(event) => {
                  setCatalogId(event.target.value);
                  setChosen(null);
                }}
                className={inputClass}
              >
                {lists.map((each) => (
                  <option key={each.id} value={each.id}>
                    {each.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {views.map((view) => (
            <label key={view.filter.id} className="flex min-w-0 basis-36 flex-col gap-1">
              <span className={labelClass}>{rt(view.filter.label)}</span>
              <select
                value={active[view.filter.id] ?? CATALOG_FILTER_ANY}
                onChange={(event) => setChosen({ ...active, [view.filter.id]: event.target.value })}
                className={inputClass}
              >
                <option value={CATALOG_FILTER_ANY}>{t("game.ruleset.catalog.filterAny")}</option>
                {view.options.map((option) => (
                  <option key={option} value={option}>
                    {rt(option)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        {query.isPending && items.length === 0 ? (
          <p className="flex items-center gap-2 py-6 text-xs text-[var(--muted-foreground)]">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            {t("game.ruleset.catalog.loading")}
          </p>
        ) : query.isError && items.length === 0 ? (
          <div className="space-y-2 py-4">
            <p role="alert" className="text-xs text-[var(--destructive)]">
              {t("game.ruleset.catalog.loadFailed")}
            </p>
            <button type="button" onClick={() => void query.refetch()} className="mari-chrome-control text-xs">
              {t("game.ruleset.catalog.retry")}
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className="py-6 text-xs text-[var(--muted-foreground)]">{t("game.ruleset.items.empty")}</p>
        ) : (
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
            {visible.length === 0 && (
              <p className="py-6 text-xs text-[var(--muted-foreground)]">{t("game.ruleset.catalog.noMatches")}</p>
            )}
            {visible.map((each) => {
              const { facts } = each;
              const kind = [facts.category, facts.rarity, ...facts.tags].filter((word): word is string => !!word);
              const stats = rulesetItemStatsLine(facts, rt);
              return (
                <label
                  key={each.item}
                  className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(each.item)}
                    onChange={() => toggle(each.item)}
                    aria-label={rt(each.name)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
                  />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <ArtIcon
                        ids={[
                          each.entry.icon,
                          artIconFor({ catalog: each.catalogId, entry: each.entry.id, item: true }),
                          artIconFor({ item: each.name }),
                        ]}
                        className="h-5 w-5"
                      />
                      <span className="text-xs font-medium text-[var(--foreground)]">{rt(each.name)}</span>
                      {kind.map((word) => (
                        <span key={word} className={chipClass}>
                          {rt(word)}
                        </span>
                      ))}
                    </span>
                    {each.summary && (
                      <span className="block text-[0.6875rem] text-[var(--muted-foreground)]">{rt(each.summary)}</span>
                    )}
                    {stats && <span className="block text-[0.6875rem] text-[var(--foreground)]">{stats}</span>}
                    {rulesetItemEffectLines(facts, t, rt).map((line) => (
                      <span key={line} className="block text-[0.6875rem] text-[var(--foreground)]">
                        {line}
                      </span>
                    ))}
                    {(facts.cost || each.stack) && (
                      <span className="block text-[0.6875rem] text-[var(--muted-foreground)]">
                        {[
                          facts.cost ? withRulesetWords(t, rt)("game.ruleset.items.cost", facts.cost) : null,
                          each.stack ? t("game.ruleset.items.stack", { max: each.stack }) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
            {matches.length > visible.length && (
              <p className="pt-1 text-[0.6875rem] text-[var(--muted-foreground)]">
                {t("game.ruleset.catalog.showingFirst", { shown: visible.length })}
              </p>
            )}
          </div>
        )}

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-2">
          <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {t("game.ruleset.catalog.selected", { count: selected.size })}
          </span>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={onClose} className="mari-chrome-control mari-chrome-control--small text-xs">
              {t("game.ruleset.catalog.cancel")}
            </button>
            <button
              type="button"
              disabled={picks.length === 0}
              onClick={() => {
                onAdd(picks);
                onClose();
              }}
              className="mari-chrome-control mari-chrome-control--primary mari-chrome-control--small text-xs"
            >
              {t("game.ruleset.items.confirm", { count: picks.length })}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
