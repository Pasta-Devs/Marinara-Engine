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
  defaultRulesetSheetBuild,
  type RulesetDefinition,
  type RulesetItemBook,
  type RulesetItemBookEntry,
  type RulesetItemEffectFact,
  type RulesetItemFacts,
} from "@marinara-engine/shared";
import { useRulesetCatalog } from "../../hooks/use-capability-packages";
import {
  CATALOG_FILTER_ANY,
  CATALOG_VISIBLE_LIMIT,
  catalogFilterViews,
  filterCatalogEntries,
} from "../../lib/ruleset-catalog";
import { Modal } from "../ui/Modal";

const inputClass =
  "w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs text-[var(--foreground)]";
const labelClass = "text-[0.6875rem] font-medium text-[var(--muted-foreground)]";
const chipClass =
  "rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[0.625rem] text-[var(--muted-foreground)]";

/** An item's stats as one line: "Damage 1d6 · Reach close". A yes-or-no stat that is yes is its label. */
export function rulesetItemStatsLine(facts: RulesetItemFacts): string {
  return facts.stats.map((stat) => (stat.text !== undefined ? `${stat.label} ${stat.text}` : stat.label)).join(" · ");
}

/** A fight effect's localized words, by effect id. The ones about the holder's own checks, saves and
 *  attacks are said as leans on those instead. */
const FIGHT_EFFECT_KEYS: Record<string, string> = {
  "attacks-against-advantage": "ui.game.gameinventory.effectAttacksAgainstAdvantage",
  "attacks-against-disadvantage": "ui.game.gameinventory.effectAttacksAgainstDisadvantage",
  "attacks-against-adjacent-advantage": "ui.game.gameinventory.effectAttacksAgainstAdjacentAdvantage",
  "attacks-against-far-disadvantage": "ui.game.gameinventory.effectAttacksAgainstFarDisadvantage",
  "attacks-from-adjacent-critical": "ui.game.gameinventory.effectAttacksFromAdjacentCritical",
  "cannot-act": "ui.game.gameinventory.effectCannotAct",
  "cannot-react": "ui.game.gameinventory.effectCannotReact",
  "speed-zero": "ui.game.gameinventory.effectSpeedZero",
  "resist-all": "ui.game.gameinventory.effectResistAll",
};

/** A weapon's attack, in two lines: what it adds to hit and deals ("Attack (Act): Brawn + 1 to hit,
 *  1d6 + Brawn cut damage"), then how far it reaches and carries and what it deals with a hand free.
 *  Empty for an item that is no weapon. */
function rulesetItemAttackLines(facts: RulesetItemFacts, t: TFunction): string[] {
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
  return [first, ...(second.length ? [second.join(", ")] : [])];
}

/** What an item does while worn, and while only carried, one line each: "While worn: -1 on Sneak
 *  checks". Empty when it does nothing either way. */
export function rulesetItemEffectLines(facts: RulesetItemFacts, t: TFunction): string[] {
  const phrase = (fact: RulesetItemEffectFact) => {
    const names = fact.names.join(", ");
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
    if ("times" in fact.change) {
      return t(
        fact.change.times === 0.5 ? "ui.game.gameinventory.effectSpeedHalf" : "ui.game.gameinventory.effectSpeedDouble",
      );
    }
    if (fact.to === "speed" && "value" in fact.change) {
      return t("ui.game.gameinventory.effectSpeed", { change: fact.change.value });
    }
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
        : fact.change.value;
    if (fact.to === "checks") {
      return names
        ? t("ui.game.gameinventory.effectOnNamedChecks", { change, names })
        : t("ui.game.gameinventory.effectOnChecks", { change });
    }
    if (fact.to === "attacks") return t("ui.game.gameinventory.effectOnAttacks", { change });
    return names
      ? t("ui.game.gameinventory.effectOnNamedSaves", { change, names })
      : t("ui.game.gameinventory.effectOnSaves", { change });
  };
  return [
    ...rulesetItemAttackLines(facts, t),
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
        what:
          need.of === "modifier"
            ? t("ui.game.gameinventory.requiresModifier", { name: need.what })
            : need.of === "items"
              ? need.what
                ? t("ui.game.gameinventory.requiresItemsOf", { name: need.what })
                : t("ui.game.gameinventory.requiresItems")
              : need.what,
        atLeast: need.atLeast,
        effects: need.otherwise.map(phrase).join("; "),
      }),
    ),
  ];
}

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
  const searchRef = useRef<HTMLInputElement>(null);
  const catalogs = useMemo(
    () => (definition.catalogs ?? []).filter((catalog) => catalog.holds === "items"),
    [definition.catalogs],
  );
  const [catalogId, setCatalogId] = useState(catalogs[0]?.id ?? "");
  const catalog = catalogs.find((each) => each.id === catalogId) ?? catalogs[0];
  const [search, setSearch] = useState("");
  // Null until the user touches a filter, like the sheet editor's picker.
  const [chosen, setChosen] = useState<Record<string, string> | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  // The same cached query the book was built from: only its loading and failure are read here.
  const query = useRulesetCatalog(definition.id, catalog?.id ?? "", definition.version, open && Boolean(catalog));
  const items = useMemo(() => book.entries.filter((each) => each.catalogId === catalog?.id), [book, catalog]);
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
    return items.filter((each) => shown.has(each.entry));
  }, [active, entries, items, search, views]);
  const visible = matches.slice(0, CATALOG_VISIBLE_LIMIT);

  const toggle = (item: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(item)) next.add(item);
      return next;
    });
  const picks = book.entries.filter((each) => selected.has(each.item));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("game.ruleset.items.pickerTitle")}
      width="max-w-2xl"
      mobileFullscreen
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
          {catalogs.length > 1 && (
            <label className="flex min-w-0 basis-36 flex-col gap-1">
              <span className={labelClass}>{t("game.ruleset.items.catalog")}</span>
              <select
                value={catalog?.id ?? ""}
                onChange={(event) => {
                  setCatalogId(event.target.value);
                  setChosen(null);
                }}
                className={inputClass}
              >
                {catalogs.map((each) => (
                  <option key={each.id} value={each.id}>
                    {each.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {views.map((view) => (
            <label key={view.filter.id} className="flex min-w-0 basis-36 flex-col gap-1">
              <span className={labelClass}>{view.filter.label}</span>
              <select
                value={active[view.filter.id] ?? CATALOG_FILTER_ANY}
                onChange={(event) => setChosen({ ...active, [view.filter.id]: event.target.value })}
                className={inputClass}
              >
                <option value={CATALOG_FILTER_ANY}>{t("game.ruleset.catalog.filterAny")}</option>
                {view.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
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
              const stats = rulesetItemStatsLine(facts);
              return (
                <label
                  key={each.item}
                  className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(each.item)}
                    onChange={() => toggle(each.item)}
                    aria-label={each.name}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
                  />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium text-[var(--foreground)]">{each.name}</span>
                      {kind.map((word) => (
                        <span key={word} className={chipClass}>
                          {word}
                        </span>
                      ))}
                    </span>
                    {each.summary && (
                      <span className="block text-[0.6875rem] text-[var(--muted-foreground)]">{each.summary}</span>
                    )}
                    {stats && <span className="block text-[0.6875rem] text-[var(--foreground)]">{stats}</span>}
                    {rulesetItemEffectLines(facts, t).map((line) => (
                      <span key={line} className="block text-[0.6875rem] text-[var(--foreground)]">
                        {line}
                      </span>
                    ))}
                    {(facts.cost || each.stack) && (
                      <span className="block text-[0.6875rem] text-[var(--muted-foreground)]">
                        {[
                          facts.cost ? t("game.ruleset.items.cost", facts.cost) : null,
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
