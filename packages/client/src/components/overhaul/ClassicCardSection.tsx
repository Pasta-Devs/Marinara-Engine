// ──────────────────────────────────────────────
// UI overhaul: the MRPG half of a card's Game Mode section (owner's pick 2026-11-05, mockup "Card B")
//
// MRPG stats are rolled fresh for every game, so the card holds no numbers: only the starting tree
// (or Auto, read from the card's text) and up to two stats the character is strong in and one they
// are weak in, which lean the hidden growth. The roleplay stats sit in their own section (owner
// 2026-11-07: they are not Game Mode).
//
// Owner 2026-11-07: set up as a guided builder like the ruleset one, one question a step. Once
// finished, the card shows the character as a new game starts them, with Edit to run the builder
// again. Every pick saves as it is made, so leaving halfway loses nothing.
// ──────────────────────────────────────────────
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MARINARA_ARCHETYPES,
  MARINARA_ARCHETYPE_BASES,
  MARINARA_ARCHETYPE_ROWS,
  MARINARA_CLASSIC_STRONG_PICKS,
  MARINARA_STATS,
  marinaraArchetypeInText,
  marinaraBaseClass,
  marinaraFightHpMultiplier,
  marinaraMaxMp,
  marinaraMaxStamina,
  readMarinaraCardClassic,
  type MarinaraArchetype,
  type MarinaraCardClassic,
  type MarinaraStat,
} from "@marinara-engine/shared";
import { Check, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { cn } from "../../lib/utils";

type BuilderStep = "tree" | "strong" | "weak" | "review";

export function ClassicCardSection({
  value,
  onChange,
  description,
}: {
  /** What the card stores (extensions.classic, or personaStats.classic). */
  value: unknown;
  /** Called with undefined once nothing is picked, so the card stores no empty record. */
  onChange: (next: MarinaraCardClassic | undefined) => void;
  /** The card text an Auto starting tree is read from. */
  description: string;
}) {
  const { t } = useTranslation();
  const classic = readMarinaraCardClassic(value) ?? {};
  // A card made before the builder that already has picks counts as built.
  const built = !!(classic.built || classic.tree || classic.strong?.length || classic.weak);
  const [editing, setEditing] = useState(!built);
  const [step, setStep] = useState<BuilderStep>("tree");
  const guessed = marinaraArchetypeInText(description);
  const tree: MarinaraArchetype = classic.tree ?? guessed ?? "blade";
  const strong = classic.strong ?? [];
  const save = (next: MarinaraCardClassic) => onChange(readMarinaraCardClassic(next));
  const treeName = (one: MarinaraArchetype) => t(`game.combat.marinara.archetype.${one}`);
  const statName = (stat: MarinaraStat) => t(`game.combat.marinara.card.statName.${stat}`);
  const autoNote = guessed
    ? t("game.combat.marinara.card.autoGuess", { tree: treeName(guessed) })
    : t("game.combat.marinara.card.autoNone", { tree: treeName("blade") });

  const steps: BuilderStep[] = ["tree", "strong", "weak", "review"];
  const at = Math.max(0, steps.indexOf(step));
  const stepLabel = (one: BuilderStep) => t(`game.combat.marinara.card.step.${one}`);
  // What each step holds now, under its name in the step list.
  const stepValue = (one: BuilderStep): string | null => {
    if (one === "tree") return classic.tree ? treeName(classic.tree) : t("game.combat.marinara.card.auto");
    if (one === "strong")
      return strong.length ? strong.map(statName).join(", ") : t("game.combat.marinara.card.nonePicked");
    if (one === "weak") return classic.weak ? statName(classic.weak) : t("game.combat.marinara.card.nonePicked");
    return null;
  };

  const toggleStrong = (stat: MarinaraStat) => {
    let next = strong.includes(stat) ? strong.filter((one) => one !== stat) : [...strong, stat];
    // A third pick replaces the oldest, so a tap always does what it shows.
    if (next.length > MARINARA_CLASSIC_STRONG_PICKS) next = next.slice(next.length - MARINARA_CLASSIC_STRONG_PICKS);
    save({ ...classic, strong: next, ...(classic.weak === stat ? { weak: undefined } : {}) });
  };
  const toggleWeak = (stat: MarinaraStat) =>
    save({
      ...classic,
      weak: classic.weak === stat ? undefined : stat,
      strong: strong.filter((one) => one !== stat),
    });

  const finish = () => {
    save({ ...classic, built: true });
    setEditing(false);
  };
  const edit = () => {
    setStep("tree");
    setEditing(true);
  };

  // What a new game starts them as: the base class of the tree at level 1, before any growth.
  const start = MARINARA_ARCHETYPE_BASES[tree].start;
  const preview: Array<{ key: string; label: string; amount: number; lean?: "strong" | "weak"; resource?: true }> = [
    ...MARINARA_STATS.map((stat) => ({
      key: stat,
      label: t(`game.combat.marinara.stat.${stat}`),
      amount: stat === "hp" ? Math.round(start.hp * marinaraFightHpMultiplier(1)) : start[stat],
      lean: strong.includes(stat) ? ("strong" as const) : classic.weak === stat ? ("weak" as const) : undefined,
    })),
    { key: "mp", label: t("game.combat.marinara.sheet.resource.mp"), amount: marinaraMaxMp(start), resource: true },
    {
      key: "stamina",
      label: t("game.combat.marinara.sheet.resource.stamina"),
      amount: marinaraMaxStamina(start),
      resource: true,
    },
  ];
  const leanTag = (lean: "strong" | "weak") => t(`game.combat.marinara.card.lean.${lean}`);

  const statGrid = (
    <div className="ov-classic__stats" role="list" aria-label={t("game.combat.marinara.card.preview")}>
      {preview.map((entry) => (
        <div
          key={entry.key}
          role="listitem"
          className={cn("ov-classic__stat", entry.lean && `is-${entry.lean}`, entry.resource && "is-resource")}
        >
          <small>{entry.label}</small>
          <b>{entry.amount}</b>
          {entry.lean ? <em>{leanTag(entry.lean)}</em> : null}
        </div>
      ))}
    </div>
  );

  // The tree's base class usually shares its name; it is named only when it differs.
  const baseName = marinaraBaseClass(tree).label;
  const row = t(`game.combat.marinara.row.${MARINARA_ARCHETYPE_ROWS[tree]}`);
  const identity = (
    <div className="ov-classic__identity">
      <div className="ov-classic__tree-name">
        <b>{treeName(tree)}</b>
        <span>
          {baseName === treeName(tree)
            ? t("game.combat.marinara.card.levelRow", { row })
            : t("game.combat.marinara.card.previewClass", { name: baseName, row })}
        </span>
      </div>
      {classic.tree ? null : (
        <p>
          {t("game.combat.marinara.card.auto")} · {autoNote}
        </p>
      )}
    </div>
  );

  if (!editing) {
    return (
      <div className="ov-classic" data-component="ClassicCardSection" data-view="summary">
        <div className="ov-classic__head">
          <div className="ov-sheet__eyebrow">
            <span>{t("game.combat.marinara.card.title")}</span>
            <small>· {t("game.combat.marinara.card.note")}</small>
          </div>
          <button type="button" className="ov-classic__edit" onClick={edit}>
            <Pencil size={13} aria-hidden="true" />
            {t("game.combat.marinara.card.edit")}
          </button>
        </div>
        <div className="ov-classic__card">
          <div className="ov-classic__label">
            <span>{t("game.combat.marinara.card.preview")}</span>
          </div>
          {identity}
          {statGrid}
          <p className="ov-classic__help">{t("game.combat.marinara.card.help")}</p>
        </div>
      </div>
    );
  }

  const statTiles = (kind: "strong" | "weak") =>
    MARINARA_STATS.map((stat) => {
      const on = kind === "strong" ? strong.includes(stat) : classic.weak === stat;
      const other = kind === "weak" && strong.includes(stat);
      return (
        <button
          key={stat}
          type="button"
          aria-pressed={on}
          className={cn("ov-classic__choice", kind === "weak" && "is-weak")}
          onClick={() => (kind === "strong" ? toggleStrong(stat) : toggleWeak(stat))}
        >
          <span className="ov-classic__choice-top">
            <b>{statName(stat)}</b>
            {on ? <Check size={14} aria-hidden="true" /> : other ? <em>{leanTag("strong")}</em> : null}
          </span>
          <small>{t(`game.combat.marinara.card.statHint.${stat}`)}</small>
        </button>
      );
    });

  const body =
    step === "tree" ? (
      <div className="ov-classic__trees" role="radiogroup" aria-label={stepLabel("tree")}>
        <button
          type="button"
          role="radio"
          aria-checked={!classic.tree}
          className="ov-classic__choice is-auto"
          onClick={() => save({ ...classic, tree: undefined })}
        >
          <span className="ov-classic__choice-top">
            <b>{t("game.combat.marinara.card.auto")}</b>
            {!classic.tree ? <Check size={14} aria-hidden="true" /> : null}
          </span>
          <small>{autoNote}</small>
        </button>
        {MARINARA_ARCHETYPES.map((one) => (
          <button
            key={one}
            type="button"
            role="radio"
            aria-checked={classic.tree === one}
            className="ov-classic__choice"
            onClick={() => save({ ...classic, tree: one })}
          >
            <span className="ov-classic__choice-top">
              <b>{treeName(one)}</b>
              {classic.tree === one ? <Check size={14} aria-hidden="true" /> : null}
            </span>
            <small>{t(`game.combat.marinara.card.role.${one}`)}</small>
          </button>
        ))}
      </div>
    ) : step === "strong" ? (
      <div className="ov-classic__choices">{statTiles("strong")}</div>
    ) : step === "weak" ? (
      <div className="ov-classic__choices">{statTiles("weak")}</div>
    ) : (
      <div className="ov-classic__card">
        {identity}
        {statGrid}
      </div>
    );

  return (
    <div className="ov-classic" data-component="ClassicCardSection" data-view="builder">
      <div className="ov-classic__head">
        <div className="ov-sheet__eyebrow">
          <span>{t("game.combat.marinara.card.title")}</span>
          <small>· {t("game.combat.marinara.card.note")}</small>
        </div>
        {built ? (
          <button type="button" className="ov-classic__edit" onClick={finish}>
            {t("game.combat.marinara.card.done")}
          </button>
        ) : null}
      </div>

      <nav aria-label={t("game.combat.marinara.card.steps")}>
        <ol className="ov-classic__steps">
          {steps.map((one, index) => {
            const shown = stepValue(one);
            return (
              <li key={one}>
                <button
                  type="button"
                  aria-current={one === step ? "step" : undefined}
                  className={cn("ov-classic__stepper", index < at && "is-past")}
                  onClick={() => setStep(one)}
                >
                  <span className="ov-classic__step-text">
                    <b>{stepLabel(one)}</b>
                    {shown ? <small>{shown}</small> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="ov-classic__panel" aria-label={stepLabel(step)}>
        <header className="ov-classic__ask">
          <h4>{t(`game.combat.marinara.card.ask.${step}`)}</h4>
          <p>{t(`game.combat.marinara.card.askHint.${step}`, { count: MARINARA_CLASSIC_STRONG_PICKS })}</p>
        </header>
        {body}
        <div className="ov-classic__nav">
          <button type="button" className="ov-classic__btn" disabled={at === 0} onClick={() => setStep(steps[at - 1]!)}>
            <ChevronLeft size={14} aria-hidden="true" />
            {t("game.combat.marinara.card.back")}
          </button>
          <span className="ov-classic__count">
            {t("game.combat.marinara.card.stepOf", { at: at + 1, total: steps.length })}
          </span>
          {step === "review" ? (
            <button type="button" className="ov-classic__btn is-primary" onClick={finish}>
              <Check size={14} aria-hidden="true" />
              {t("game.combat.marinara.card.finish")}
            </button>
          ) : (
            <button type="button" className="ov-classic__btn is-primary" onClick={() => setStep(steps[at + 1]!)}>
              {t("game.combat.marinara.card.next")}
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
