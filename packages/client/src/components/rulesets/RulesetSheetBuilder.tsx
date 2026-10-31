// The guided builder (Capability API 1.86): a ruleset's `sheet.builder` as steps across the top, each
// with the choices it still waits on, Back and Next that never block, and the character as it stands
// beside them. Everything it writes goes through the shared builder, which keeps the build the one
// sheet the rest of the Engine reads and takes back what an unpicked entry gave.
import { Check, ChevronLeft, ChevronRight, Dices, Minus, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  applyRulesetBuilder,
  withRulesetPlanMemoIn,
  rulesetBuilderAbilityIds,
  rulesetBuilderAllocations,
  rulesetBuilderSpending,
  rulesetBuilderSpendAction,
  rulesetBuilderAbilitySlots,
  rulesetBuilderEntrySlots,
  rulesetBuilderBaseScores,
  rulesetBuilderCatalogIds,
  rulesetBuilderOptions,
  rulesetBuilderStartingGearOptions,
  rulesetBuilderPickAdded,
  rulesetBuilderPicks,
  rulesetBuilderMarkRows,
  rulesetBuilderMarkCount,
  rulesetBuilderMarked,
  rulesetBuilderPickReason,
  rulesetBuilderInactiveChoices,
  rulesetBuilderStepVisible,
  rulesetBuilderStepCount,
  rulesetBuilderRemaining,
  rulesetBuilderFillRows,
  rulesetBuilderNewRow,
  rulesetBuilderOwnRows,
  rulesetBuilderRowsMin,
  rulesetBuilderInitialize,
  rulesetBuilderRoll,
  rulesetBuilderRollScoresInOrder,
  rulesetCreationDiceText,
  rulesetBuilderActiveProfile,
  rulesetBuilderPickPrice,
  rulesetBuilderRowPrice,
  rulesetBuilderInitializePreview,
  rulesetBuilderConstraintFailures,
  RULESET_CATALOG_ROW_KEY,
  rulesetBuilderShownFields,
  rulesetBuilderTrainedSlots,
  rulesetBuilderMethod,
  rulesetSheetBuildIsBlank,
  rulesetBuilderEntryHeld,
  listRulesetLivePools,
  defaultRulesetSheetBuild,
  isRulesetItemHidden,
  evaluateRulesetSheet,
  rulesetPointBuySpent,
  type DiceRollResult,
  type RulesetBuilderAbilitySlot,
  type RulesetBuilderCatalogLimits,
  type RulesetBuilderChoiceReason,
  type RulesetBuilderMethod,
  type RulesetBuilderState,
  type RulesetBuilderStep,
  type RulesetBuilderEntrySlot,
  type RulesetCatalogEntry,
  type RulesetBuilderTrainedSlot,
  type RulesetCatalogEntriesById,
  type RulesetCatalogPayload,
  type RulesetDefinition,
  type RulesetLayerOptions,
  type RulesetSheetBuild,
  type RulesetBuilderRatingTarget,
  rulesetListRollNotation,
  workOutRulesetListRow,
} from "@marinara-engine/shared";
import { rulesetCatalogQuery } from "../../hooks/use-capability-packages";
import { rulesetPoolLevels, rulesetSheetAttacks } from "../../lib/ruleset-sheet-view";
import { api } from "../../lib/api-client";
import { visibleCatalogEntries } from "../../lib/ruleset-catalog";
import { rulesetCheckValueText } from "../../lib/ruleset-resolution";
import { useRulesetText } from "../../lib/ruleset-text";
import { DraftNumberInput } from "../ui/DraftNumberInput";
import { clamp, inputClass, labelClass, rulesetPickCount, TypedInput } from "./RulesetTypedInput";
import { RollCellButton, rollRulesetCell } from "./RulesetRollCellButton";

/** A bonus with its sign, as a sheet prints one. */
const signed = (value: number) => (value > 0 ? `+${value}` : String(value));

/** A choice that builds on training held (5e's Expertise) while nothing it may pick is trained yet:
 *  every candidate is refused as untrained, so it waits on an earlier step rather than misconfigured. */
const heldWaiting = (slot: RulesetBuilderTrainedSlot) =>
  slot.held !== undefined && slot.from.length > 0 && slot.from.every((id) => slot.disabled?.[id] === "untrained");

type StepOf<K extends RulesetBuilderStep["kind"]> = Extract<RulesetBuilderStep, { kind: K }>;

const chipClass =
  "rounded-lg border px-2 py-1 text-[0.6875rem] transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const chipOn = "border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--foreground)]";
const chipOff = "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]";
const buttonClass =
  "inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[0.6875rem] text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-50";

const reasonKey: Record<RulesetBuilderChoiceReason, string> = {
  excluded: "ui.rulesets.builder.reasonExcluded",
  trained: "ui.rulesets.builder.reasonTrained",
  untrained: "ui.rulesets.builder.reasonUntrained",
  distinct: "ui.rulesets.builder.reasonDistinct",
  quota: "ui.rulesets.builder.reasonQuota",
  pyramid: "ui.rulesets.builder.reasonPyramid",
  unavailable: "ui.rulesets.builder.reasonUnavailable",
  unaffordable: "ui.rulesets.builder.reasonUnaffordable",
};

function ChoiceConstraints({
  limits,
  labelOf,
}: {
  limits: RulesetBuilderCatalogLimits;
  labelOf: (id: string) => string;
}) {
  const { t } = useUiTranslation();
  return (
    <div className="space-y-1 text-[0.6875rem] text-[var(--muted-foreground)]">
      {limits.quotas?.map((quota, index) => (
        <p key={index}>
          {t(quota.min === quota.max ? "ui.rulesets.builder.quotaExact" : "ui.rulesets.builder.quotaRange", {
            filter: labelOf(quota.filter),
            value: quota.value,
            min: quota.min,
            max: quota.max,
          })}
        </p>
      ))}
      {limits.distinctBy && <p>{t("ui.rulesets.builder.distinctBy", { filter: labelOf(limits.distinctBy) })}</p>}
      {limits.quotaBelow && <p>{t("ui.rulesets.builder.pyramid", { filter: labelOf(limits.quotaBelow.filter) })}</p>}
    </div>
  );
}

/** A choice of `count` among `from`, as toggles: a full choice takes no more until one is let go. A
 *  choice that repeats (1.93) adds one each press, and takes one back with the chip's minus. */
function ChoiceSlot({
  title,
  slot,
  labelOf,
  onChange,
  atCap,
  held,
  filterLabelOf = (id) => id,
  infoOf,
}: {
  title: string;
  slot: RulesetBuilderAbilitySlot | RulesetBuilderTrainedSlot | RulesetBuilderEntrySlot;
  labelOf: (id: string) => string;
  onChange: (chosen: string[]) => void;
  /** Whether an option already stands at the choice's cap (1.96), so it takes no more. */
  atCap?: (id: string) => boolean;
  /** Whether the sheet already has it from somewhere else (a dwarf's Dwarvish), so it is no pick. */
  held?: (id: string) => boolean;
  filterLabelOf?: (id: string) => string;
  /** What an option is, for its Info (laptop class builds 2026-10-24): a Fighting Style's summary, as
   *  a catalog step's card shows it. */
  infoOf?: (id: string) => string | undefined;
}) {
  const { t } = useUiTranslation();
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const infoDomId = useId();
  const full = slot.chosen.length >= slot.count;
  const repeat = "repeat" in slot && !!slot.repeat;
  const left = Math.max(
    0,
    (repeat || slot.unresolved ? slot.count : Math.min(slot.count, slot.from.length)) - slot.chosen.length,
    slot.missing ?? 0,
  );
  const stored = slot.stored ?? slot.chosen;
  const inactive = [...new Set(rulesetBuilderInactiveChoices(slot))];
  return (
    <fieldset className="space-y-1.5 rounded-lg border border-[var(--border)] p-2">
      <legend className="px-1 text-[0.6875rem] font-semibold text-[var(--foreground)]">
        {slot.replacement ? t("ui.rulesets.builder.replacement", { title }) : title}{" "}
        <span className="font-normal text-[var(--muted-foreground)]">
          {t("ui.rulesets.builder.remaining", { count: left })}
        </span>
      </legend>
      <ChoiceConstraints limits={slot} labelOf={filterLabelOf} />
      {slot.unresolved &&
        left > 0 &&
        !slot.from.some((id) => !slot.disabled?.[id] && (repeat || !slot.chosen.includes(id))) && (
          <p role="status" className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {t("ui.rulesets.builder.notConfigured")}
          </p>
        )}
      {inactive.length > 0 && (
        <div className="space-y-1">
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("ui.rulesets.builder.inactiveChoices")}</p>
          {inactive.map((id) => (
            <button
              key={id}
              type="button"
              className={`${chipClass} ${chipOff}`}
              onClick={() => onChange(stored.filter((each) => each !== id))}
            >
              {t("ui.rulesets.builder.removeInactive", { name: labelOf(id) })}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {slot.from.map((id) => {
          const on = slot.chosen.includes(id);
          if (repeat) {
            const times = slot.chosen.filter((each) => each === id).length;
            return (
              <span key={id} className="inline-flex items-center gap-0.5">
                <button
                  type="button"
                  aria-pressed={times > 0}
                  disabled={full || !!atCap?.(id) || !!slot.disabled?.[id]}
                  onClick={() => onChange([...stored, id])}
                  className={`${chipClass} ${times > 0 ? chipOn : chipOff}`}
                >
                  {times > 1 ? t("ui.rulesets.builder.pickedTimes", { name: labelOf(id), count: times }) : labelOf(id)}
                </button>
                {times > 0 && (
                  <button
                    type="button"
                    aria-label={t("ui.rulesets.builder.takeBackOne", { name: labelOf(id) })}
                    onClick={() => {
                      const at = stored.lastIndexOf(id);
                      onChange(stored.filter((_, index) => index !== at));
                    }}
                    className={`${chipClass} ${chipOff}`}
                  >
                    <Minus size={10} aria-hidden="true" />
                  </button>
                )}
              </span>
            );
          }
          const known = !on && !!held?.(id);
          const info = infoOf?.(id);
          return (
            <span key={id} className="inline-flex items-start gap-0.5">
              <button
                type="button"
                aria-pressed={on}
                disabled={!on && (full || known || !!atCap?.(id) || !!slot.disabled?.[id])}
                onClick={() =>
                  onChange(on ? stored.filter((each) => each !== id) : [...stored.filter((each) => each !== id), id])
                }
                className={`${chipClass} ${on ? chipOn : chipOff}`}
              >
                {labelOf(id)}
                {known ? (
                  <span className="block font-normal">{t("ui.rulesets.builder.alreadyKnown")}</span>
                ) : (
                  !on &&
                  slot.disabled?.[id] && <span className="block font-normal">{t(reasonKey[slot.disabled[id]!])}</span>
                )}
              </button>
              {info && (
                <button
                  type="button"
                  aria-expanded={openInfo === id}
                  aria-controls={infoDomId}
                  aria-label={t("ui.rulesets.builder.infoFor", { name: labelOf(id) })}
                  onClick={() => setOpenInfo(openInfo === id ? null : id)}
                  className={`${chipClass} ${chipOff}`}
                >
                  {t("ui.rulesets.builder.info")}
                </button>
              )}
            </span>
          );
        })}
      </div>
      {openInfo && infoOf?.(openInfo) && (
        <div id={infoDomId} className="space-y-1 text-[0.6875rem] text-[var(--muted-foreground)]">
          <p className="font-semibold text-[var(--foreground)]">{labelOf(openInfo)}</p>
          <p>{infoOf(openInfo)}</p>
        </div>
      )}
    </fieldset>
  );
}

/** A catalog step offering more than this many entries is searched by name. */
const CATALOG_SEARCH_FROM = 12;
export function RulesetSheetBuilder({
  definition,
  layerOptions,
  build: rawBuild,
  state: rawState,
  evaluated: rawEvaluated,
  onApply,
  outsideGame = false,
  gearNote = false,
}: {
  definition: RulesetDefinition;
  layerOptions?: RulesetLayerOptions;
  build: RulesetSheetBuild;
  state: RulesetBuilderState;
  evaluated: ReturnType<typeof evaluateRulesetSheet>;
  /** The build with the choices applied, and the choices: one envelope change. */
  onApply: (build: RulesetSheetBuild, state: RulesetBuilderState) => void;
  /** Shown outside a game: what the sheet has to spend at its most, as the All fields tab shows it. */
  outsideGame?: boolean;
  /** Armor and weapons wait on a game's Starting gear, so armor class here counts none worn. */
  gearNote?: boolean;
}) {
  const { t } = useUiTranslation();
  // The ruleset's own words in the player's language (1.811): shown only, never written to the sheet.
  const rt = useRulesetText();
  const builder = definition.sheet.builder!;
  const [stepId, setStepId] = useState(builder.steps[0]!.id);
  const [freeEdit, setFreeEdit] = useState(false);
  // A rows step's "roll all" (hit point rolls) while its throws are out, and whether one failed.
  const [allRolling, setAllRolling] = useState(false);
  const [rollAllFailed, setRollAllFailed] = useState(false);
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  /** What a long catalog step is narrowed to, by name: a wizard's spells. */
  const [searches, setSearches] = useState<Record<string, string>>({});
  // The steps the player asked to take more than one in (a second class).
  const [moreWanted, setMoreWanted] = useState<ReadonlySet<string>>(() => new Set());
  /** An entry's facts in one line before its description: what its row says in words besides its
   *  name (a spell's school, casting time, range and components). */
  const entryStatLine = (entry: RulesetCatalogEntry): string => {
    const first = entry.rows?.[0];
    if (!first) return "";
    const list = definition.sheet.lists.find((one) => one.id === first.list);
    if (!list) return "";
    const nameColumn =
      definition.gm.sheetSummary.lists.find((one) => one.list === list.id)?.nameColumn ??
      list.columns.find((column) => column.type === "text")?.id;
    return (
      list.columns
        // Short words only: a feature's prose (a race's Speed row, first of every race) is its own Info.
        .filter((column) => column.type === "text" && column.id !== nameColumn)
        .flatMap((column) => {
          const value = first.values[column.id];
          return typeof value === "string" && value.trim() ? [rt(value.trim())] : [];
        })
        .join(" · ")
    );
  };
  const [rolling, setRolling] = useState(false);
  const [rollFailed, setRollFailed] = useState(false);

  // Every catalog the steps read, loaded before anything is applied: a pick whose catalog has not
  // arrived would grant nothing, which would take back what it gave.
  const catalogIds = useMemo(() => rulesetBuilderCatalogIds(definition), [definition]);
  const combine = useCallback(
    (results: readonly { data: RulesetCatalogPayload | undefined; isError: boolean }[]) => {
      // Picks are read against the whole catalog, so an entry this game's layers hide still counts for
      // what it gave; only what is offered is narrowed by them.
      const loaded: RulesetCatalogEntriesById = {};
      const visible = new Map<string, Set<string>>();
      results.forEach((result, index) => {
        const catalogId = catalogIds[index]!;
        if (result.data) {
          loaded[catalogId] = result.data.entries;
          visible.set(
            catalogId,
            new Set(visibleCatalogEntries(definition, layerOptions, catalogId, result.data.entries).map((e) => e.id)),
          );
        }
      });
      return {
        catalogs: loaded,
        visible,
        ready: results.every((result) => !!result.data),
        failed: results.some((result) => result.isError),
      };
    },
    [catalogIds, definition, layerOptions],
  );
  const { catalogs, visible, ready, failed } = useQueries({
    queries: catalogIds.map((catalogId) => rulesetCatalogQuery(definition.id, catalogId, definition.version)),
    combine,
  });

  // A character made some other way is described first: picks record what it already is and change
  // nothing, until the player says the picks should change the sheet.
  const describing =
    rawState.describing ?? (rawState.applied === undefined && !rulesetSheetBuildIsBlank(definition, rawBuild));
  const state = useMemo(() => ({ ...rawState, describing }), [describing, rawState]);
  // A new character the builder has not written to yet is shown as the builder would make it (its
  // default method's scores, say), and nothing is stored until the player changes something.
  const preview = useMemo(
    () =>
      ready && !describing && rawState.applied === undefined
        ? applyRulesetBuilder(definition, rawBuild, state, catalogs)
        : null,
    [catalogs, definition, describing, rawBuild, rawState.applied, ready, state],
  );
  const build = preview?.build ?? rawBuild;
  const evaluated = useMemo(
    () => (preview ? evaluateRulesetSheet(definition, preview.build) : rawEvaluated),
    [definition, preview, rawEvaluated],
  );
  // Its attacks as a fight works them out, for the summary.
  const attacks = useMemo(
    () => (ready ? rulesetSheetAttacks(definition, build, undefined, undefined, catalogs) : []),
    [build, catalogs, definition, ready],
  );
  const increases = (preview?.state ?? rawState).applied?.increases ?? {};
  // What the reads below see: the preview's state (its method, once the builder starts the sheet).
  const shownState = useMemo(() => (preview ? { ...preview.state, describing } : state), [describing, preview, state]);

  // The reads below see one sheet until it changes: each works it out once for all of them, render
  // after render, rather than every read and every entry on a step working it out afresh.
  const memo = useMemo(
    () => new Map<unknown, unknown>(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [build, shownState, state, catalogs, definition, evaluated],
  );
  const read = useCallback(<T,>(plan: () => T): T => withRulesetPlanMemoIn(memo, plan), [memo]);

  const steps = useMemo(
    () => builder.steps.filter((step) => rulesetBuilderStepVisible(definition, step, build)),
    [build, builder.steps, definition],
  );
  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === stepId),
  );
  const step = steps[activeIndex] ?? builder.steps[0]!;
  const remaining = useMemo(
    () => (ready ? read(() => rulesetBuilderRemaining(definition, build, shownState, catalogs)) : {}),
    [build, catalogs, definition, read, ready, shownState],
  );
  const failedRules = useMemo(() => rulesetBuilderConstraintFailures(definition, build), [build, definition]);
  const abilitySlots = useMemo(
    () => (ready ? read(() => rulesetBuilderAbilitySlots(definition, shownState, catalogs, build)) : []),
    [build, catalogs, definition, read, ready, shownState],
  );
  const trainedSlots = useMemo(
    () => (ready ? read(() => rulesetBuilderTrainedSlots(definition, shownState, catalogs, build)) : []),
    [build, catalogs, definition, read, ready, shownState],
  );
  const allocations = useMemo(
    () => (ready ? read(() => rulesetBuilderAllocations(definition, build, shownState, catalogs)) : []),
    [build, catalogs, definition, read, ready, shownState],
  );
  const spending = useMemo(
    () => (ready ? read(() => rulesetBuilderSpending(definition, build, shownState, catalogs)) : []),
    [build, catalogs, definition, read, ready, shownState],
  );
  const entrySlots = useMemo(
    () => (ready ? read(() => rulesetBuilderEntrySlots(definition, shownState, catalogs, build)) : []),
    [build, catalogs, definition, read, ready, shownState],
  );
  // The steps that ask this character anything, which are the ones walked through: a wizard is never
  // shown Pact Boon or Fighting Style. A choices step none of whose picks gives a choice asks nothing,
  // nor does a catalog step that takes none, offers none and holds none. The open step always shows.
  const asked = useMemo(
    () =>
      steps.filter((each) => {
        if (!ready || each.id === step.id) return true;
        if (each.kind === "choices") return entrySlots.some((slot) => slot.stepId === each.id);
        if (each.kind !== "catalog") return true;
        if ((shownState.picks?.[each.id]?.length ?? 0) > 0) return true;
        if (!each.takesAll && rulesetBuilderStepCount(definition, each, build).max === 0) return false;
        return read(() => rulesetBuilderOptions(definition, each, shownState, catalogs, build)).length > 0;
      }),
    [build, catalogs, definition, entrySlots, read, ready, shownState, step.id, steps],
  );
  const askedIndex = Math.max(
    0,
    asked.findIndex((each) => each.id === step.id),
  );

  // The sheet as it stands now, for the dice, which land after an await: the render that threw them may
  // be stale by then.
  const latest = useRef({ build: rawBuild, state });
  latest.current = { build: rawBuild, state };
  const update = (next: RulesetBuilderState) => {
    if (!ready) return;
    const applied = applyRulesetBuilder(
      definition,
      latest.current.build,
      { ...next, describing: next.describing ?? describing },
      catalogs,
    );
    onApply(applied.build, applied.state);
  };
  const infoBaseId = useId();

  // A rows step that asks for a count of rows (1.799, 5e's hit point rolls: one per level after 1st)
  // starts with that many when it is shown, each as "add row" makes it; it never takes a row away,
  // and a row the player removes there stays removed until the step is shown again. A character being
  // described is not written to by looking at it. 5e ship-readiness re-test 2026-10-24.
  useEffect(() => {
    if (!ready || describing || step.kind !== "rows" || !step.countFrom) return;
    const filled = rulesetBuilderFillRows(definition, step, latest.current.build, build);
    if (filled === latest.current.build) return;
    const applied = applyRulesetBuilder(definition, filled, latest.current.state, catalogs);
    onApply(applied.build, applied.state);
    // Only when the step is shown (or the catalogs it waits on arrive), not on each edit made there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id, ready, describing]);

  const abilityLabel = (id: string) => rt(definition.sheet.abilities.find((ability) => ability.id === id)?.label ?? id);
  const skillLabel = (id: string) => rt(definition.sheet.skills.find((skill) => skill.id === id)?.label ?? id);
  const saveLabel = (id: string) => rt(definition.sheet.saves.find((save) => save.id === id)?.label ?? id);

  const slotsHere = (
    <>
      {abilitySlots
        .filter((slot) => slot.stepId === step.id)
        .map((slot) => (
          <ChoiceSlot
            key={slot.key}
            title={
              t("ui.rulesets.builder.chooseScores", {
                from: rt(slot.entry?.label ?? step.label),
                count: slot.count,
                amount: signed(slot.amount),
              }) +
              (slot.partialFrom === undefined
                ? ""
                : ` ${t("ui.rulesets.builder.choosePartial", { from: signed(slot.partialFrom), amount: signed(slot.amount) })}`)
            }
            slot={slot}
            labelOf={abilityLabel}
            atCap={
              slot.upTo === undefined
                ? undefined
                : (id) =>
                    (build.abilities[id] ??
                      definition.sheet.abilities.find((ability) => ability.id === id)?.default ??
                      0) +
                      slot.amount >
                    slot.upTo!
            }
            onChange={(chosen) => update({ ...state, abilityChoices: { ...state.abilityChoices, [slot.key]: chosen } })}
          />
        ))}
      {/* A choice that builds on training already held (5e's Expertise) is said before its skills
          are picked, so a player knows it is coming; it opens as soon as there is something to build on. */}
      {trainedSlots
        .filter((slot) => slot.stepId === step.id && heldWaiting(slot))
        .map((slot) => (
          <p key={slot.key} className="text-xs text-[var(--muted-foreground)]">
            {t("ui.rulesets.builder.heldWaiting", {
              from: rt(slot.entry?.label ?? step.label),
              count: slot.count,
              what: t(slot.what === "skills" ? "ui.rulesets.builder.heldSkills" : "ui.rulesets.builder.heldSaves"),
            })}
          </p>
        ))}
      {trainedSlots
        // A choice the picks already answer in full (1.104) has nothing left to offer.
        .filter((slot) => slot.stepId === step.id && (slot.unresolved || slot.from.length > 0) && !heldWaiting(slot))
        .map((slot) => (
          <ChoiceSlot
            key={slot.key}
            title={t(slot.what === "skills" ? "ui.rulesets.builder.chooseSkills" : "ui.rulesets.builder.chooseSaves", {
              from: rt(slot.entry?.label ?? step.label),
              count: slot.count,
            })}
            slot={slot}
            labelOf={slot.what === "skills" ? skillLabel : saveLabel}
            onChange={(chosen) => update({ ...state, trainedChoices: { ...state.trainedChoices, [slot.key]: chosen } })}
          />
        ))}
      {entrySlots
        .filter((slot) => slot.stepId === step.id)
        .map((slot) => (
          <ChoiceSlot
            key={slot.key}
            title={t("ui.rulesets.builder.chooseEntries", {
              from: rt(slot.entry?.label ?? step.label),
              count: slot.count,
            })}
            slot={slot}
            filterLabelOf={(id) =>
              rt(
                definition.catalogs
                  ?.find((catalog) => catalog.id === slot.catalog)
                  ?.filters?.find((filter) => filter.id === id)?.label ?? id,
              )
            }
            labelOf={(id) => rt((catalogs[slot.catalog] ?? []).find((entry) => entry.id === id)?.label ?? id)}
            infoOf={(id) => {
              const summary = (catalogs[slot.catalog] ?? []).find((entry) => entry.id === id)?.summary;
              return summary && rt(summary);
            }}
            held={(id) => {
              const entry = (catalogs[slot.catalog] ?? []).find((one) => one.id === id);
              return !!entry && rulesetBuilderEntryHeld(definition, build, slot.catalog, entry);
            }}
            onChange={(chosen) => update({ ...state, entryChoices: { ...state.entryChoices, [slot.key]: chosen } })}
          />
        ))}
    </>
  );

  // What a priced step's pool has left (1.159), and a warning while it is overspent.
  const pricedPool = (poolId: string | undefined) => {
    if (!poolId) return null;
    const pool = spending.find((each) => each.id === poolId);
    const label = rt(builder.pools?.find((each) => each.id === poolId)?.label ?? poolId);
    if (!pool) return null;
    return (
      <p
        className={`text-[0.6875rem] ${pool.invalid ? "text-[var(--marinara-app-accent-static)]" : "text-[var(--muted-foreground)]"}`}
        role={pool.invalid ? "alert" : undefined}
      >
        {pool.invalid
          ? t("ui.rulesets.builder.pricedOver", { pool: label })
          : t("ui.rulesets.builder.pricedRemaining", {
              pool: label,
              remaining: pool.remaining ?? "—",
              budget: pool.budget ?? "—",
            })}
      </p>
    );
  };

  const catalogStep = (current: StepOf<"catalog">) =>
    // Every entry is weighed against the same sheet: one pass of reads for them all.
    read(() => {
      const picked = rulesetBuilderPicks(definition, current.id, state, catalogs, build).map((entry) => entry.id);
      const shown = visible.get(current.catalog);
      const offered = rulesetBuilderOptions(definition, current, state, catalogs, build);
      const offeredIds = new Set(offered.map((entry) => entry.id));
      const inactive = (state.picks?.[current.id] ?? []).filter((id) => !picked.includes(id));
      const options = [
        ...offered,
        ...(catalogs[current.catalog] ?? []).filter(
          (entry) => inactive.includes(entry.id) && !offeredIds.has(entry.id),
        ),
      ].filter((entry) => picked.includes(entry.id) || !shown || shown.has(entry.id));
      // An entry picked at another step on the same catalog is that step's.
      const elsewhere = new Map<string, string>();
      for (const other of builder.steps) {
        if (other.kind !== "catalog" || other.id === current.id || other.catalog !== current.catalog) continue;
        for (const entry of rulesetBuilderPicks(definition, other.id, state, catalogs, build))
          elsewhere.set(entry.id, rt(other.label));
      }
      const toggle = (id: string) => {
        const on = (state.picks?.[current.id] ?? []).includes(id);
        // Against every stored pick, so one the sheet has fallen below (`upTo`) is kept, not dropped.
        const stored = state.picks?.[current.id] ?? [];
        // A pick of an `exclusive` group (1.94) replaces the step's other pick of that group.
        const next = on ? stored.filter((each) => each !== id) : rulesetBuilderPickAdded(current, stored, id, catalogs);
        update({ ...state, picks: { ...state.picks, [current.id]: next } });
      };
      // A count read off the sheet (1.90) moves with the character; the step's own max otherwise. A
      // step that takes one and may take more (a class, then a second) offers one until the player
      // asks for another, so nobody multiclasses by accident.
      const counted = rulesetBuilderStepCount(definition, current, build);
      const oneFirst =
        !current.takesAll && counted.max > 1 && counted.min <= 1 && picked.length <= 1 && !moreWanted.has(current.id);
      const most = oneFirst ? 1 : counted.max;
      // A long list is searched by name, and each entry says what tells it apart from the rest: a
      // spell's level and school, where the offered spells are not all one level or school.
      const searching = options.length > CATALOG_SEARCH_FROM;
      const query = searching ? (searches[current.id] ?? "").trim().toLowerCase() : "";
      const listed = query
        ? options.filter(
            (entry) =>
              picked.includes(entry.id) ||
              entry.label.toLowerCase().includes(query) ||
              rt(entry.label).toLowerCase().includes(query),
          )
        : options;
      const telling = (definition.catalogs?.find((catalog) => catalog.id === current.catalog)?.filters ?? []).filter(
        (filter) =>
          (filter.type === "number" || filter.type === "text") &&
          new Set(options.map((entry) => entry.filters?.[filter.id])).size > 1,
      );
      const tellsApart = (entry: (typeof options)[number]) =>
        telling
          .flatMap((filter) => {
            const value = entry.filters?.[filter.id];
            if (value === undefined || value === "" || Array.isArray(value)) return [];
            // A value written as an id ("multiclass", "bard") is for the steps to match on, not words.
            if (typeof value === "string" && /^[a-z0-9_-]+$/u.test(value)) return [];
            return [filter.type === "number" ? `${rt(filter.label)} ${value}` : rt(String(value))];
          })
          .join(" · ");
      if (options.length === 0 && inactive.length === 0) {
        return (
          <p className="text-xs text-[var(--muted-foreground)]">
            {current.within && rulesetBuilderPicks(definition, current.within.step, state, catalogs, build).length === 0
              ? t("ui.rulesets.builder.pickEarlier")
              : (current.quotas || current.distinctBy || current.quotaBelow || current.when || current.requiredWhen) &&
                  (remaining[current.id] ?? 0) > 0
                ? t("ui.rulesets.builder.notConfigured")
                : current.within
                  ? t("ui.rulesets.builder.pickEarlier")
                  : t("ui.rulesets.builder.noOptions")}
          </p>
        );
      }
      return (
        <div className="space-y-2">
          <ChoiceConstraints
            limits={current}
            labelOf={(id) =>
              rt(
                definition.catalogs
                  ?.find((catalog) => catalog.id === current.catalog)
                  ?.filters?.find((filter) => filter.id === id)?.label ?? id,
              )
            }
          />
          {inactive.length > 0 && (
            <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
              {t("ui.rulesets.builder.inactiveChoices")}
            </p>
          )}
          {inactive
            .filter((id) => !options.some((entry) => entry.id === id))
            .map((id) => (
              <button key={id} type="button" className={buttonClass} onClick={() => toggle(id)}>
                {t("ui.rulesets.builder.removeInactive", {
                  name: rt((catalogs[current.catalog] ?? []).find((entry) => entry.id === id)?.label ?? id),
                })}
              </button>
            ))}
          {pricedPool(current.pool)}
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {current.takesAll
              ? t("ui.rulesets.builder.takesAll", { count: picked.length })
              : most === 0
                ? t("ui.rulesets.builder.pickNoneYet", { picked: picked.length })
                : t("ui.rulesets.builder.pickCount", { count: most, picked: picked.length })}
          </p>
          {oneFirst && picked.length === 1 && (
            <button
              type="button"
              className={buttonClass}
              onClick={() => setMoreWanted(new Set([...moreWanted, current.id]))}
            >
              {t("ui.rulesets.builder.addAnother", { step: rt(current.label) })}
            </button>
          )}
          {searching && (
            <input
              type="search"
              value={searches[current.id] ?? ""}
              onChange={(event) => setSearches({ ...searches, [current.id]: event.target.value })}
              placeholder={t("ui.rulesets.builder.search", { count: options.length })}
              aria-label={t("ui.rulesets.builder.search", { count: options.length })}
              className={inputClass}
            />
          )}
          {searching && listed.length === 0 && (
            <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("ui.rulesets.builder.noMatch")}</p>
          )}
          {/* Each card keeps its own height, so one opened for its Info never stretches its neighbour. */}
          <ul className="grid items-start gap-1.5 sm:grid-cols-2">
            {listed.map((entry) => {
              const on = picked.includes(entry.id);
              const stored = (state.picks?.[current.id] ?? []).includes(entry.id);
              const reason = !on
                ? rulesetBuilderPickReason(definition, current, state, catalogs, build, entry.id)
                : undefined;
              const takenAt = on ? undefined : elsewhere.get(entry.id);
              // A pick that only replaces the step's pick of its own group (1.94) never makes it fuller.
              const replaces =
                !!entry.exclusive &&
                options.some((other) => other.exclusive === entry.exclusive && picked.includes(other.id));
              // Taken without asking (1.766): only a choice within an `exclusive` group is the player's.
              const locked = !!current.takesAll && !entry.exclusive;
              // Already on the sheet from somewhere else (a domain spell a later step grants): no pick.
              // A step that names its pick in a field (a class, a race) is held only by that pick: a
              // Paladin's armour rows are a Fighter's too, and do not make a Fighter one.
              const known =
                !on &&
                !stored &&
                takenAt === undefined &&
                !current.field &&
                rulesetBuilderEntryHeld(definition, build, current.catalog, entry);
              const full =
                locked ||
                (!current.takesAll && !on && !replaces && (counted.max > 1 || most === 0) && picked.length >= most) ||
                takenAt !== undefined ||
                known;
              const infoId = `${current.id}:${entry.id}`;
              const infoDomId = `${infoBaseId}-${current.id}-${entry.id}`;
              return (
                <li
                  key={entry.id}
                  className={`flex flex-col gap-1 rounded-lg border p-2 ${on ? "border-[var(--primary)]" : "border-[var(--border)]"} bg-[var(--card)]`}
                >
                  {/* The buttons wrap below a long name rather than squeezing it to a letter a line. */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-[6rem] flex-1 break-words text-xs font-semibold text-[var(--foreground)]">
                      {rt(entry.label)}
                      {tellsApart(entry) && (
                        <span className="block text-[0.625rem] font-normal text-[var(--muted-foreground)]">
                          {tellsApart(entry)}
                        </span>
                      )}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      {current.pool && (
                        <span className="text-[0.625rem] tabular-nums text-[var(--muted-foreground)]">
                          {t("ui.rulesets.builder.pricedCost", {
                            cost: rulesetBuilderPickPrice(current, entry) ?? "—",
                          })}
                        </span>
                      )}
                      {entry.summary && (
                        <button
                          type="button"
                          aria-expanded={openInfo === infoId}
                          aria-controls={infoDomId}
                          onClick={() => setOpenInfo(openInfo === infoId ? null : infoId)}
                          aria-label={t("ui.rulesets.builder.infoFor", { name: rt(entry.label) })}
                          className={`${chipClass} ${chipOff}`}
                        >
                          {t("ui.rulesets.builder.info")}
                        </button>
                      )}
                      <button
                        type="button"
                        aria-pressed={on}
                        disabled={locked || (!stored && (full || !!reason))}
                        onClick={() => toggle(entry.id)}
                        aria-label={
                          !on && known
                            ? t("ui.rulesets.builder.alreadyKnownName", { name: rt(entry.label) })
                            : t(stored ? "ui.rulesets.builder.unpick" : "ui.rulesets.builder.pick", {
                                name: rt(entry.label),
                              })
                        }
                        className={`${chipClass} ${on ? chipOn : chipOff}`}
                      >
                        {on ? (
                          // Removing it says so, not only a tick (laptop 2026-10-26).
                          <span className="inline-flex items-center gap-1">
                            <Check size={12} aria-hidden="true" />
                            {t("ui.rulesets.builder.remove")}
                          </span>
                        ) : known ? (
                          t("ui.rulesets.builder.alreadyKnown")
                        ) : stored ? (
                          t("ui.rulesets.builder.removeInactive", { name: rt(entry.label) })
                        ) : (
                          t("ui.rulesets.builder.select")
                        )}
                      </button>
                    </div>
                  </div>
                  {reason && <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t(reasonKey[reason])}</p>}
                  {takenAt && (
                    <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                      {t("ui.rulesets.builder.pickedAt", { step: takenAt })}
                    </p>
                  )}
                  {openInfo === infoId && entry.summary && (
                    <div id={infoDomId} className="space-y-1 text-[0.6875rem] text-[var(--muted-foreground)]">
                      {entryStatLine(entry) && <p className="text-[var(--foreground)]">{entryStatLine(entry)}</p>}
                      <p>{rt(entry.summary)}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {slotsHere}
        </div>
      );
    });

  const fieldsStep = (current: StepOf<"fields">) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {rulesetBuilderShownFields(definition, current, build).map((id) => {
        const field = definition.sheet.fields.find((each) => each.id === id);
        if (!field) return null;
        let spec = field;
        if (field.type === "number" && current.total?.fields.includes(id)) {
          const others = current.total.fields.reduce((sum, otherId) => {
            const value = build.fields[otherId];
            return sum + (otherId !== id && typeof value === "number" ? value : 0);
          }, 0);
          spec = { ...field, max: Math.max(field.min, Math.min(field.max, current.total.max - others)) };
        }
        return (
          <label key={id} className={`flex min-w-0 flex-col gap-1 ${field.type === "longtext" ? "col-span-full" : ""}`}>
            <span className={labelClass}>{rt(field.label)}</span>
            <TypedInput
              spec={spec}
              pick={rulesetPickCount(definition, build, spec)}
              value={build.fields[id]}
              onChange={(value) =>
                // A value the builder answers for, changed here, is still the builder's: a later pick
                // that no longer asks for it takes it back.
                {
                  const typed = { ...rawBuild, fields: { ...rawBuild.fields, [id]: value } };
                  // A sheet the builder has not written to yet takes its picks with the first change.
                  if (!rawState.applied) {
                    if (!ready) return;
                    const applied = applyRulesetBuilder(definition, typed, state, catalogs);
                    onApply({ ...applied.build, fields: { ...applied.build.fields, [id]: value } }, applied.state);
                    return;
                  }
                  if (!ready) return;
                  // Applied again on the new value, which a step's `upTo` may read (a lower level). One the
                  // builder answers for is marked typed over, so the next run keeps it rather than
                  // writing its own answer back (a class level reset to 1 on every click).
                  const owned =
                    id in rawState.applied.fields
                      ? {
                          ...state,
                          applied: {
                            ...rawState.applied,
                            typedFields: [...new Set([...(rawState.applied.typedFields ?? []), id])],
                          },
                        }
                      : state;
                  const applied = applyRulesetBuilder(definition, typed, owned, catalogs);
                  onApply(applied.build, applied.state);
                }
              }
              ariaLabel={rt(field.label)}
            />
          </label>
        );
      })}
    </div>
  );

  // Creation rolls (1.162): thrown once on the player's word and kept with their dice. Reopening
  // shows what was rolled; only a step that allows it rolls again.
  const rollStep = (current: StepOf<"roll">) => {
    const made = state.rolls?.[current.id] ?? {};
    const throwRoll = async (id: string) => {
      const spec = current.rolls.find((each) => each.id === id);
      if (!spec || !ready || describing) return;
      setRolling(true);
      setRollFailed(false);
      try {
        const dice = async (count: number, sides: number) =>
          (await api.post<{ result: DiceRollResult }>("/game/dice/roll", { notation: `${count}d${sides}` })).result
            .rolls;
        const sets: number[][] = [];
        for (let i = 0; i < (spec.gain ? 1 : (spec.best ?? 1)); i++)
          sets.push(await dice(spec.dice.count, spec.dice.sides));
        const gain = spec.gain ? await dice(spec.gain.count, spec.gain.sides) : undefined;
        const applied = applyRulesetBuilder(definition, latest.current.build, latest.current.state, catalogs);
        const rolled = rulesetBuilderRoll(definition, applied.build, applied.state, current.id, id, sets, gain);
        onApply(rolled.build, rolled.state);
      } catch {
        setRollFailed(true);
      } finally {
        setRolling(false);
      }
    };
    return (
      <div className="space-y-2">
        {describing && (
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {t("ui.rulesets.builder.initializeDescribing")}
          </p>
        )}
        <ul className="space-y-1.5">
          {current.rolls.map((spec) => {
            const record = made[spec.id];
            return (
              <li
                key={spec.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 text-xs"
              >
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{rt(spec.label)}</span>{" "}
                  <span className="text-[var(--muted-foreground)]">
                    {spec.gain
                      ? t("ui.rulesets.builder.rollImprove", {
                          dice: rulesetCreationDiceText(spec.dice),
                          gain: rulesetCreationDiceText(spec.gain),
                        })
                      : spec.best
                        ? t("ui.rulesets.builder.rollBest", {
                            dice: rulesetCreationDiceText(spec.dice),
                            count: spec.best,
                          })
                        : rulesetCreationDiceText(spec.dice)}
                  </span>
                </span>
                {record && (
                  <span className="tabular-nums text-[0.6875rem] text-[var(--muted-foreground)]">
                    {t("ui.rulesets.builder.rollResult", {
                      faces: record.sets.map((set) => set.join("+")).join(" / "),
                      value: record.written,
                    })}
                    {record.gained && ` ${t("ui.rulesets.builder.rollGained", { faces: record.gained.join("+") })}`}
                  </span>
                )}
                {(!record || current.retry) && (
                  <button
                    type="button"
                    disabled={rolling || describing}
                    onClick={() => void throwRoll(spec.id)}
                    className={buttonClass}
                  >
                    <Dices size={12} aria-hidden="true" />
                    {record ? t("ui.rulesets.builder.rollAgainOne") : t("ui.rulesets.builder.rollOne")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {rollFailed && (
          <span role="status" className="text-[0.625rem] text-[var(--marinara-app-accent-static)]">
            {t("ui.rulesets.sheet.rollFailed")}
          </span>
        )}
      </div>
    );
  };

  // Starting values (1.158): written once on the player's word, never again by reopening. A sheet that
  // has changed since shows what setting again would replace.
  const initializeStep = (current: StepOf<"initialize">) => {
    const shown = rulesetBuilderInitializePreview(definition, build, shownState, catalogs, current.id);
    if (!shown) return null;
    const text = (value: unknown) =>
      value === undefined || value === null || value === ""
        ? "—"
        : typeof value === "boolean"
          ? value
            ? "✓"
            : "✗"
          : String(value);
    const confirm = () => {
      if (!ready || describing) return;
      const applied = applyRulesetBuilder(definition, latest.current.build, state, catalogs);
      const written = rulesetBuilderInitialize(definition, applied.build, applied.state, catalogs, current.id);
      onApply(written.build, written.state);
    };
    return (
      <div className="space-y-2">
        <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
          {describing ? t("ui.rulesets.builder.initializeDescribing") : t("ui.rulesets.builder.initializeIntro")}
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[var(--muted-foreground)]">
              <th className="py-1 pr-2 font-normal">{t("ui.rulesets.builder.initializeField")}</th>
              <th className="py-1 pr-2 font-normal">{t("ui.rulesets.builder.initializeNow")}</th>
              <th className="py-1 font-normal">
                {shown.done ? t("ui.rulesets.builder.initializeWritten") : t("ui.rulesets.builder.initializeNext")}
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {shown.rows.map((row) => (
              <tr key={row.field} className="border-t border-[var(--border)]">
                <td className="py-1 pr-2">{rt(row.label)}</td>
                <td className="py-1 pr-2">{text(row.now)}</td>
                <td className="py-1">
                  {shown.done
                    ? text(row.written)
                    : row.next === null
                      ? t("ui.rulesets.builder.initializeUnknown")
                      : text(row.next)}
                  {shown.done && row.next !== null && row.next !== row.written && (
                    <span className="ml-1 text-[var(--muted-foreground)]">
                      {t("ui.rulesets.builder.initializeWouldBe", { value: text(row.next) })}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.changed && (
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {t("ui.rulesets.builder.initializeChanged")}
          </p>
        )}
        <button type="button" disabled={describing} onClick={confirm} className={buttonClass}>
          <Check size={12} aria-hidden="true" />
          {shown.done ? t("ui.rulesets.builder.initializeAgain") : t("ui.rulesets.builder.initializeSet")}
        </button>
      </div>
    );
  };

  // Named rows (1.154): the player's own rows are edited where they sit in the list, so two rows with
  // the same name stay two rows. Rows a pick wrote are shown and left to the pick.
  // Rows already on a list, marked to tick one of their columns (1.767): a wizard's prepared spells.
  const markStep = (current: StepOf<"mark">) => {
    const list = definition.sheet.lists.find((each) => each.id === current.list);
    const name = list?.columns.find((column) => column.type === "text")?.id;
    const rows = rulesetBuilderMarkRows(current, build);
    const marked = rulesetBuilderMarked(definition, current.id, state, build);
    const most = Math.min(rulesetBuilderMarkCount(definition, current, build), rows.length);
    const toggle = (ref: string) => {
      const stored = state.marks?.[current.id] ?? [];
      const next = marked.includes(ref) ? stored.filter((each) => each !== ref) : [...marked, ref];
      update({ ...state, marks: { ...state.marks, [current.id]: next } });
    };
    return (
      <div className="space-y-1.5">
        <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
          {rows.length === 0
            ? t("ui.rulesets.builder.markNone")
            : t("ui.rulesets.builder.markCount", { count: most, marked: marked.length })}
        </p>
        <ul className="space-y-1">
          {rows.map(({ ref, row }) => {
            const on = marked.includes(ref);
            return (
              <li key={ref}>
                <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--foreground)]">
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!on && marked.length >= most}
                    onChange={() => toggle(ref)}
                  />
                  {String((name && row[name]) || ref)}
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const rowsStep = (current: StepOf<"rows">) => {
    const list = definition.sheet.lists.find((each) => each.id === current.list);
    if (!list) return null;
    const columns = current.columns
      ? list.columns.filter((column) => current.columns!.includes(column.id))
      : list.columns;
    const rawRows = Array.isArray(rawBuild.lists[list.id]) ? rawBuild.lists[list.id]! : [];
    const own = rulesetBuilderOwnRows(rawBuild, list.id);
    const picked = (Array.isArray(build.lists[list.id]) ? build.lists[list.id]! : []).filter(
      (row) => row?.[RULESET_CATALOG_ROW_KEY] !== undefined,
    );
    const limit = Math.min(current.max ?? list.maxItems, list.maxItems);
    const full = own.length >= limit || rawRows.length >= list.maxItems;
    const write = (rows: RulesetSheetBuild["lists"][string]) => {
      if (!ready) return;
      const applied = applyRulesetBuilder(
        definition,
        { ...rawBuild, lists: { ...rawBuild.lists, [list.id]: rows } },
        state,
        catalogs,
      );
      onApply(applied.build, applied.state);
    };
    const blank = (cell: unknown) => cell === undefined || cell === "";
    // The player's own rows' rolled cells still empty that know what to throw (a hit point roll).
    const rollable = own.flatMap(({ row, index }) =>
      columns.flatMap((column) => {
        if (column.type !== "number" || !column.roll || !blank(row[column.id])) return [];
        const notation = rulesetListRollNotation(definition, build, column, row, evaluated);
        return notation ? [{ index, column: column.id, notation, min: column.min, max: column.max }] : [];
      }),
    );
    const complete = own.filter(({ row }) => !(current.required ?? []).some((id) => blank(row[id]))).length;
    // The rows the step waits on: its min, or what its countFrom asks for when that is more (1.799).
    const wanted = rulesetBuilderRowsMin(definition, current, build);
    // A catalog to copy rows from (1.159): each copy is the player's own row, priced on its own.
    const copies = current.from
      ? (catalogs[current.from] ?? []).flatMap((entry) => {
          const values = entry.rows?.find((row) => row.list === list.id)?.values;
          return values ? [{ id: entry.id, label: entry.label, values }] : [];
        })
      : [];
    return (
      <div className="space-y-2">
        {pricedPool(current.pool)}
        {wanted > 0 && (
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {t("ui.rulesets.builder.rowsCount", { count: complete, min: wanted })}
          </p>
        )}
        {own.length === 0 && picked.length === 0 && (
          <p className="text-xs text-[var(--muted-foreground)]">{t("ui.rulesets.builder.rowsEmpty")}</p>
        )}
        {picked.map((row, index) => (
          <div
            key={`picked-${index}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-dashed border-[var(--border)] p-2 text-xs"
          >
            {columns
              .filter((column) => !blank(row[column.id]))
              .map((column) => (
                <span key={column.id} className="min-w-0">
                  <span className="text-[var(--muted-foreground)]">{rt(column.label)}:</span> {String(row[column.id])}
                </span>
              ))}
            <span className="ml-auto text-[0.625rem] text-[var(--muted-foreground)]">
              {t("ui.rulesets.builder.rowsFromPick")}
            </span>
          </div>
        ))}
        {own.map(({ row, index }, position) => (
          <div
            key={index}
            className="flex items-start gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2"
          >
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 sm:grid-cols-3">
              {columns.map((column) => {
                const needed = current.required?.includes(column.id) ?? false;
                return (
                  <label
                    key={column.id}
                    className={`flex min-w-0 flex-col gap-0.5 ${column.type === "longtext" ? "col-span-full" : ""}`}
                  >
                    <span className={labelClass}>
                      {rt(column.label)}
                      {needed && blank(row[column.id]) && (
                        <span className="ml-1 text-[var(--marinara-app-accent-static)]">
                          {t("ui.rulesets.builder.rowsRequired")}
                        </span>
                      )}
                    </span>
                    <TypedInput
                      spec={column}
                      value={row[column.id]}
                      onChange={(value) =>
                        write(
                          rawRows.map((each, i) =>
                            i === index ? workOutRulesetListRow(list, { ...each, [column.id]: value }) : each,
                          ),
                        )
                      }
                      ariaLabel={`${rt(list.label)} ${position + 1}: ${rt(column.label)}`}
                      disabled={column.type === "number" && !!column.sum}
                    />
                    {/* A rolled cell (1.85) is thrown with the Engine's dice here as on All fields. */}
                    {column.type === "number" && column.roll && (
                      <RollCellButton
                        notation={rulesetListRollNotation(definition, build, column, row, evaluated)}
                        ariaLabel={`${rt(list.label)} ${position + 1}: ${rt(column.label)}`}
                        onRolled={(total) =>
                          write(
                            rawRows.map((each, i) =>
                              i === index
                                ? workOutRulesetListRow(list, {
                                    ...each,
                                    [column.id]: clamp(total, column.min, column.max),
                                  })
                                : each,
                            ),
                          )
                        }
                      />
                    )}
                  </label>
                );
              })}
            </div>
            {current.pool && (
              <span className="shrink-0 pt-1 text-[0.625rem] tabular-nums text-[var(--muted-foreground)]">
                {t("ui.rulesets.builder.pricedCost", { cost: rulesetBuilderRowPrice(current, row, evaluated.derived) })}
              </span>
            )}
            <button
              type="button"
              onClick={() => write(rawRows.filter((_, i) => i !== index))}
              aria-label={t("ui.rulesets.sheet.removeRow", { list: rt(list.label), index: position + 1 })}
              className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--marinara-app-accent-static)]"
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={full}
          onClick={() => write([...rawRows, rulesetBuilderNewRow(definition, current)])}
          className={buttonClass}
        >
          <Plus size={12} aria-hidden="true" />
          {t("ui.rulesets.sheet.addRow")}
        </button>
        {rollable.length > 1 && (
          <button
            type="button"
            disabled={allRolling}
            onClick={() => {
              setAllRolling(true);
              setRollAllFailed(false);
              // Every empty rolled cell at once, written together, so no throw overwrites another.
              void Promise.all(rollable.map((cell) => rollRulesetCell(cell.notation)))
                .then((totals) => {
                  const next = [...rawRows];
                  rollable.forEach((cell, n) => {
                    next[cell.index] = workOutRulesetListRow(list, {
                      ...next[cell.index],
                      [cell.column]: clamp(totals[n]!, cell.min, cell.max),
                    });
                  });
                  write(next);
                })
                .catch(() => setRollAllFailed(true))
                .finally(() => setAllRolling(false));
            }}
            className={`${buttonClass} ml-2`}
          >
            {t("ui.rulesets.builder.rollAll", { count: rollable.length })}
          </button>
        )}
        {rollAllFailed && (
          <span role="status" className="ml-2 text-[0.625rem] text-[var(--marinara-app-accent-static)]">
            {t("ui.rulesets.sheet.rollFailed")}
          </span>
        )}
        {copies.length > 0 && (
          <select
            value=""
            disabled={full}
            aria-label={t("ui.rulesets.builder.rowsFromCatalog")}
            onChange={(event) => {
              const entry = copies.find((each) => each.id === event.target.value);
              if (entry) write([...rawRows, { ...entry.values }]);
            }}
            className={`${inputClass} ml-2 inline-block w-auto max-w-full`}
          >
            <option value="">{t("ui.rulesets.builder.rowsFromCatalog")}</option>
            {copies.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {rt(entry.label)}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  };

  const abilitiesStep = (current: StepOf<"abilities">) => {
    const ids = rulesetBuilderAbilityIds(definition, current);
    const methods = (["pointBuy", "standardArray", "roll", "rolls", "manual"] as const).filter(
      (method) => current.methods[method] !== undefined,
    );
    const method = rulesetBuilderMethod(definition, shownState);
    const base = rulesetBuilderBaseScores(definition, shownState);
    const pointBuy = current.methods.pointBuy;
    const spent = method === "pointBuy" && pointBuy ? rulesetPointBuySpent(pointBuy, base, ids) : null;
    const values = method === "standardArray" ? (current.methods.standardArray ?? []) : (state.rolled ?? []);
    const takenBy = new Map<number, string>();
    for (const id of ids) {
      const index = state.assign?.[id];
      if (index !== undefined && !takenBy.has(index)) takenBy.set(index, id);
    }
    const choose = (next: RulesetBuilderMethod) => update({ ...state, method: next });
    // Scores rolled in order (1.162): every score its own group's dice, never moved.
    const rollInOrder = async () => {
      const groups = current.methods.rolls;
      if (!groups) return;
      setRolling(true);
      setRollFailed(false);
      try {
        const faces: Record<string, number[]> = {};
        for (const group of groups)
          for (const id of group.abilities) {
            const { result } = await api.post<{ result: DiceRollResult }>("/game/dice/roll", {
              notation: `${group.dice.count}d${group.dice.sides}`,
            });
            faces[id] = result.rolls;
          }
        update(rulesetBuilderRollScoresInOrder(definition, { ...latest.current.state, assign: {} }, faces));
      } catch {
        setRollFailed(true);
      } finally {
        setRolling(false);
      }
    };
    const roll = async () => {
      const spec = current.methods.roll;
      if (!spec) return;
      setRolling(true);
      setRollFailed(false);
      try {
        const totals: number[] = [];
        for (let i = 0; i < ids.length; i++) {
          const { result } = await api.post<{ result: DiceRollResult }>("/game/dice/roll", {
            notation: `${spec.count}d${spec.sides}`,
          });
          const kept = [...result.rolls].sort((a, b) => b - a).slice(0, spec.keep);
          totals.push(kept.reduce((sum, value) => sum + value, 0));
        }
        update({ ...latest.current.state, method: "roll", rolled: totals, assign: {} });
      } catch {
        // Nothing is written when the dice did not come back, and the step says so.
        setRollFailed(true);
      } finally {
        setRolling(false);
      }
    };
    return (
      <div className="space-y-2">
        {describing && (
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("ui.rulesets.builder.describingScores")}</p>
        )}
        <div role="radiogroup" aria-label={t("ui.rulesets.builder.method")} className="flex flex-wrap gap-1.5">
          {methods.map((each) => (
            <button
              key={each}
              type="button"
              role="radio"
              aria-checked={method === each}
              disabled={describing}
              tabIndex={method === each || (!method && each === methods[0]) ? 0 : -1}
              onClick={() => choose(each)}
              onKeyDown={(event) => {
                const by =
                  event.key === "ArrowRight" || event.key === "ArrowDown"
                    ? 1
                    : event.key === "ArrowLeft" || event.key === "ArrowUp"
                      ? -1
                      : 0;
                if (!by) return;
                event.preventDefault();
                const next = methods[(methods.indexOf(each) + by + methods.length) % methods.length]!;
                choose(next);
                (
                  event.currentTarget.parentElement?.querySelector(`[data-method="${next}"]`) as HTMLElement | null
                )?.focus();
              }}
              data-method={each}
              className={`${chipClass} ${method === each ? chipOn : chipOff}`}
            >
              {t(`ui.rulesets.builder.methods.${each}`)}
            </button>
          ))}
        </div>
        {method === "pointBuy" && pointBuy && (
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]" role="status">
            {spent === null
              ? t("ui.rulesets.builder.pointsOffTable")
              : t("ui.rulesets.builder.pointsLeft", { left: pointBuy.budget - spent, budget: pointBuy.budget })}
          </p>
        )}
        {method === "roll" && current.methods.roll && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={rolling} onClick={() => void roll()} className={buttonClass}>
              <Dices size={12} aria-hidden="true" />
              {t(state.rolled?.length ? "ui.rulesets.builder.rollAgain" : "ui.rulesets.builder.rollScores", {
                notation: `${current.methods.roll.count}d${current.methods.roll.sides}`,
                keep: current.methods.roll.keep,
              })}
            </button>
            {state.rolled?.length ? (
              <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
                {t("ui.rulesets.builder.rolled", { values: state.rolled.join(", ") })}
              </span>
            ) : null}
            {rollFailed && (
              <span role="status" className="text-[0.625rem] text-[var(--marinara-app-accent-static)]">
                {t("ui.rulesets.sheet.rollFailed")}
              </span>
            )}
          </div>
        )}
        {method === "rolls" && current.methods.rolls && (
          <div className="space-y-1">
            <button type="button" disabled={rolling} onClick={() => void rollInOrder()} className={buttonClass}>
              <Dices size={12} aria-hidden="true" />
              {t(state.rolledBy ? "ui.rulesets.builder.rollInOrderAgain" : "ui.rulesets.builder.rollInOrder")}
            </button>
            <ul className="text-[0.6875rem] text-[var(--muted-foreground)]">
              {current.methods.rolls.map((group, index) => (
                <li key={index}>
                  {group.abilities
                    .map((id) => rt(definition.sheet.abilities.find((each) => each.id === id)?.short ?? id))
                    .join(", ")}
                  {": "}
                  {rulesetCreationDiceText(group.dice)}
                  {group.abilities.some((id) => state.rolledBy?.[id]) &&
                    ` (${group.abilities
                      .map((id) => state.rolledBy?.[id])
                      .filter(Boolean)
                      .map((each) => `${each!.faces.join("+")} → ${each!.total}`)
                      .join("; ")})`}
                </li>
              ))}
            </ul>
            {rollFailed && (
              <span role="status" className="text-[0.625rem] text-[var(--marinara-app-accent-static)]">
                {t("ui.rulesets.sheet.rollFailed")}
              </span>
            )}
          </div>
        )}
        {method && !describing && (
          <div className="space-y-1">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,6.5rem)_2.5rem_2.5rem_2.5rem] gap-1.5 text-[0.625rem] text-[var(--muted-foreground)]">
              <span />
              <span>{t("ui.rulesets.builder.base")}</span>
              <span className="text-center">{t("ui.rulesets.builder.bonus")}</span>
              <span className="text-center">{t("ui.rulesets.builder.total")}</span>
              <span className="text-center">{t("ui.rulesets.builder.mod")}</span>
            </div>
            {ids.map((id) => {
              const ability = definition.sheet.abilities.find((each) => each.id === id)!;
              const increase = increases[id] ?? 0;
              let control: React.ReactNode;
              if (method === "pointBuy" && pointBuy) {
                const score = base[id] ?? pointBuy.costs[0]![0];
                const costOf = (value: number) => pointBuy.costs.find(([each]) => each === value)?.[1];
                const up = costOf(score + 1);
                const now = costOf(score) ?? 0;
                const canUp = up !== undefined && spent !== null && spent - now + up <= pointBuy.budget;
                const set = (value: number) => update({ ...state, base: { ...base, [id]: value } });
                control = (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={costOf(score - 1) === undefined}
                      onClick={() => set(score - 1)}
                      aria-label={t("ui.rulesets.builder.lower", { name: rt(ability.label) })}
                      className={`${chipClass} ${chipOff} px-1.5`}
                    >
                      <Minus size={12} aria-hidden="true" />
                    </button>
                    <span className="w-6 text-center text-xs tabular-nums text-[var(--foreground)]">{score}</span>
                    <button
                      type="button"
                      disabled={!canUp}
                      onClick={() => set(score + 1)}
                      aria-label={t("ui.rulesets.builder.raise", { name: rt(ability.label) })}
                      className={`${chipClass} ${chipOff} px-1.5`}
                    >
                      <Plus size={12} aria-hidden="true" />
                    </button>
                  </div>
                );
              } else if (method === "manual") {
                const manual = current.methods.manual;
                const min = typeof manual === "object" ? manual.min : ability.min;
                const max = typeof manual === "object" ? manual.max : ability.max;
                control = (
                  <DraftNumberInput
                    value={base[id] ?? (build.abilities[id] ?? ability.default) - increase}
                    onCommit={(next) => update({ ...state, base: { ...base, [id]: clamp(next, min, max) } })}
                    min={min}
                    max={max}
                    integer
                    ariaLabel={t("ui.rulesets.builder.baseFor", { name: rt(ability.label) })}
                    className={`${inputClass} text-center`}
                  />
                );
              } else {
                const index = state.assign?.[id];
                control = (
                  <select
                    value={index !== undefined && takenBy.get(index) === id ? String(index) : ""}
                    disabled={values.length === 0}
                    onChange={(event) => {
                      const assign = { ...state.assign };
                      if (event.target.value === "") delete assign[id];
                      else {
                        const chosen = Number(event.target.value);
                        // The value moves here from whichever score had it.
                        for (const [other, at] of Object.entries(assign)) if (at === chosen) delete assign[other];
                        assign[id] = chosen;
                      }
                      update({ ...state, assign });
                    }}
                    aria-label={t("ui.rulesets.builder.baseFor", { name: rt(ability.label) })}
                    className={inputClass}
                  >
                    <option value="">{t("ui.rulesets.builder.unassigned")}</option>
                    {values.map((value, valueIndex) => (
                      <option key={valueIndex} value={String(valueIndex)}>
                        {takenBy.has(valueIndex) && takenBy.get(valueIndex) !== id
                          ? t("ui.rulesets.builder.valueTaken", {
                              value,
                              by: rt(
                                definition.sheet.abilities.find((each) => each.id === takenBy.get(valueIndex))?.short ??
                                  "",
                              ),
                            })
                          : String(value)}
                      </option>
                    ))}
                  </select>
                );
              }
              return (
                <div
                  key={id}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,6.5rem)_2.5rem_2.5rem_2.5rem] items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1"
                >
                  <span className="min-w-0 truncate text-xs text-[var(--foreground)]" title={rt(ability.label)}>
                    {/* A phone's row is narrow: the short name there, the full one where it fits. */}
                    <span className="sm:hidden">{rt(ability.short ?? ability.label)}</span>
                    <span className="hidden sm:inline">{ability.label}</span>
                  </span>
                  {control}
                  <span className="text-center text-xs tabular-nums text-[var(--muted-foreground)]">
                    {increase !== 0 ? signed(increase) : ""}
                  </span>
                  <span className="text-center text-xs font-semibold tabular-nums text-[var(--foreground)]">
                    {evaluated.abilityScores[id] ?? ability.default}
                  </span>
                  <span className="text-center text-xs tabular-nums text-[var(--foreground)]">
                    {rulesetCheckValueText(definition, evaluated.abilityMods[id] ?? 0, t)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {slotsHere}
      </div>
    );
  };

  const allocateStep = (current: StepOf<"allocate">) => {
    const saved = state.allocations?.[current.id] ?? {};
    const change = (next: typeof saved) =>
      update({ ...state, allocations: { ...state.allocations, [current.id]: next } });
    const priorityLabel = (index: number, budget: number) =>
      t(
        index === 0
          ? "ui.rulesets.builder.priorityPrimary"
          : index === 1
            ? "ui.rulesets.builder.prioritySecondary"
            : index === 2
              ? "ui.rulesets.builder.priorityTertiary"
              : "ui.rulesets.builder.priorityNumber",
        { budget, number: index + 1 },
      );
    return (
      <div className="space-y-4">
        <p className="text-xs text-[var(--muted-foreground)]">{t("ui.rulesets.builder.allocationHint")}</p>
        {current.groups.map((group) => {
          const allocation = allocations.find((each) => each.stepId === current.id && each.groupId === group.id);
          if (!allocation) return null;
          const assigned = saved.priorities?.[group.id];
          return (
            <fieldset key={group.id} className="min-w-0 space-y-2">
              <legend className="text-xs font-semibold text-[var(--foreground)]">{rt(group.label)}</legend>
              {current.priorities && (
                <label className={labelClass}>
                  {t("ui.rulesets.builder.priorityFor", { name: rt(group.label) })}
                  <select
                    className={inputClass}
                    value={assigned ?? ""}
                    aria-label={t("ui.rulesets.builder.priorityFor", { name: rt(group.label) })}
                    onChange={(event) => {
                      const priorities = { ...saved.priorities };
                      if (event.target.value === "") delete priorities[group.id];
                      else {
                        const index = Number(event.target.value);
                        for (const [other, slot] of Object.entries(priorities)) {
                          if (other !== group.id && slot === index) {
                            if (assigned !== undefined) priorities[other] = assigned;
                            else delete priorities[other];
                          }
                        }
                        priorities[group.id] = index;
                      }
                      change({ ...saved, priorities });
                    }}
                  >
                    <option value="">{t("ui.rulesets.builder.unassigned")}</option>
                    {current.priorities.map((budget, index) => (
                      <option key={index} value={index}>
                        {priorityLabel(index, budget)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p role="status" className="text-[0.6875rem] text-[var(--muted-foreground)]">
                {allocation.notConfigured
                  ? t("ui.rulesets.builder.allocationNotConfigured")
                  : allocation.budget === null
                    ? t("ui.rulesets.builder.assignPriority")
                    : t("ui.rulesets.builder.pointsLeft", { left: allocation.remaining, budget: allocation.budget })}
              </p>
              <div className="divide-y divide-[var(--border)]">
                {allocation.rows.map((row) => {
                  const target = row.target;
                  const label =
                    "ability" in target
                      ? abilityLabel(target.ability)
                      : "field" in target
                        ? rt(definition.sheet.fields.find((field) => field.id === target.field)?.label ?? target.field)
                        : "skill" in target
                          ? skillLabel(target.skill)
                          : "save" in target
                            ? saveLabel(target.save)
                            : t("ui.rulesets.builder.ratingBonus", {
                                name: definition.sheet.skills.some((skill) => skill.id === target.bonus)
                                  ? skillLabel(target.bonus)
                                  : saveLabel(target.bonus),
                              });
                  const buy = (count: number) => change({ ...saved, bought: { ...saved.bought, [row.key]: count } });
                  const invalid =
                    row.total !== null &&
                    row.min !== null &&
                    row.max !== null &&
                    (row.total < row.min || row.total > row.max);
                  return (
                    <div key={row.key} className="space-y-1.5 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 text-xs text-[var(--foreground)]">{label}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className={`${chipClass} ${chipOff} min-h-9 min-w-9`}
                            disabled={row.stored <= 0}
                            onClick={() => buy(Math.max(0, row.stored - 1))}
                            aria-label={t("ui.rulesets.builder.lower", { name: label })}
                          >
                            <Minus size={12} aria-hidden="true" />
                          </button>
                          <span className="text-xs tabular-nums text-[var(--foreground)]">{row.total ?? "?"}</span>
                          <button
                            type="button"
                            className={`${chipClass} ${chipOff} min-h-9 min-w-9`}
                            disabled={!row.canAdd || row.override !== undefined}
                            onClick={() => buy(row.stored + 1)}
                            aria-label={t("ui.rulesets.builder.raise", { name: label })}
                          >
                            <Plus size={12} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[0.6875rem] tabular-nums text-[var(--muted-foreground)]">
                        {t("ui.rulesets.builder.ratingBreakdown", {
                          base: row.base ?? "?",
                          free: row.free,
                          bought: row.bought,
                          total: row.total ?? "?",
                        })}
                      </p>
                      <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                        {t("ui.rulesets.builder.ratingBounds", { min: row.min ?? "?", max: row.max ?? "?" })}
                      </p>
                      {row.inactive && row.stored > 0 && (
                        <div className="flex flex-wrap items-center gap-2 text-[0.6875rem] text-[var(--muted-foreground)]">
                          <span>{t("ui.rulesets.builder.inactiveDots", { count: row.stored })}</span>
                          <button type="button" className={buttonClass} onClick={() => buy(0)}>
                            {t("ui.rulesets.builder.clearInactiveDots", { name: label })}
                          </button>
                        </div>
                      )}
                      {invalid && (
                        <p role="status" className="text-[0.6875rem] text-[var(--muted-foreground)]">
                          {t("ui.rulesets.builder.ratingOutsideBounds")}
                        </p>
                      )}
                      {row.override !== undefined && (
                        <p role="status" className="text-[0.6875rem] text-[var(--muted-foreground)]">
                          {t("ui.rulesets.builder.ratingOverride", { value: row.override })}
                        </p>
                      )}
                      {current.annotations && (
                        <label className={labelClass}>
                          {t("ui.rulesets.builder.ratingNote", { name: label })}
                          <input
                            className={inputClass}
                            type="text"
                            maxLength={1000}
                            value={saved.notes?.[row.key] ?? ""}
                            onChange={(event) =>
                              change({ ...saved, notes: { ...saved.notes, [row.key]: event.target.value } })
                            }
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    );
  };

  const spendStep = (current: StepOf<"spend">) => {
    const pool = spending.find((pool) => pool.id === current.pool);
    const spec = builder.pools?.find((pool) => pool.id === current.pool);
    if (!pool || !spec) return null;
    const act = (offerId: string, action: "buy" | "refund" | "reprice" | "reduce", stepId = current.id) =>
      update(rulesetBuilderSpendAction(definition, build, shownState, catalogs, stepId, offerId, action));
    // What a rating is called and what the sheet holds for it, for trades and owned levels (1.164).
    const targetOf = (target: RulesetBuilderRatingTarget): { label: string; value: unknown } => {
      if ("ability" in target)
        return {
          label: rt(definition.sheet.abilities.find((each) => each.id === target.ability)?.label ?? target.ability),
          value: build.abilities[target.ability],
        };
      if ("field" in target)
        return {
          label: rt(definition.sheet.fields.find((each) => each.id === target.field)?.label ?? target.field),
          value: build.fields[target.field],
        };
      const id = "skill" in target ? target.skill : "save" in target ? target.save : target.bonus;
      const entry = [...definition.sheet.skills, ...definition.sheet.saves].find((each) => each.id === id);
      return { label: rt(entry?.label ?? id), value: undefined };
    };
    return (
      <div className="space-y-3">
        <p role="status" className="text-xs tabular-nums text-[var(--muted-foreground)]">
          {pool.budget === null
            ? t("ui.rulesets.builder.spendNotConfigured")
            : t("ui.rulesets.builder.spendPool", {
                name: rt(spec.label),
                budget: pool.budget,
                spent: pool.spent,
                credit: pool.credit,
                left: pool.remaining,
              })}
        </p>
        <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("ui.rulesets.builder.spendHint")}</p>
        {!!spec.creditLimit && (
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {t("ui.rulesets.builder.spendCreditLimit", { limit: spec.creditLimit })}
          </p>
        )}
        {spec.caps?.map((cap, index) => (
          <p key={index} className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {t("ui.rulesets.builder.spendCreditCap", { filter: cap.filter, limit: cap.maxCredit })}
          </p>
        ))}
        {pool.invalid && (
          <div role="status" className="space-y-2 text-xs text-[var(--muted-foreground)]">
            <p>{t("ui.rulesets.builder.spendInactive")}</p>
            <p>
              {t("ui.rulesets.builder.spendPreview", {
                cost: pool.rows.every((row) => row.preview !== null)
                  ? pool.rows.reduce((sum, row) => sum + row.preview!, 0)
                  : "?",
              })}
            </p>
            <button
              type="button"
              className={buttonClass}
              disabled={!pool.canReprice}
              onClick={() => act(current.offers[0]!.id, "reprice")}
            >
              {t("ui.rulesets.builder.spendReprice")}
            </button>
          </div>
        )}
        <div className="divide-y divide-[var(--border)]">
          {pool.rows
            .filter((row) => row.stepId === current.id || (row.inactive && row.purchases.length > 0))
            .map((row) => (
              <div key={row.stepId + "/" + row.offer.id} className="space-y-1.5 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 text-xs text-[var(--foreground)]">{rt(row.offer.label)}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={buttonClass}
                      disabled={!row.purchases.length}
                      onClick={() => act(row.offer.id, "refund", row.stepId)}
                      aria-label={t("ui.rulesets.builder.spendRefundFor", { name: rt(row.offer.label) })}
                    >
                      {t("ui.rulesets.builder.spendRefund", { cost: row.purchases.at(-1)?.paid ?? 0 })}
                    </button>
                    <button
                      type="button"
                      className={buttonClass}
                      disabled={!row.canBuy}
                      onClick={() => act(row.offer.id, "buy", row.stepId)}
                      aria-label={t("ui.rulesets.builder.spendBuyFor", { name: rt(row.offer.label) })}
                    >
                      {row.offer.exchange
                        ? t("ui.rulesets.builder.spendTrade", {
                            units: row.offer.exchange.units,
                            from: targetOf(row.offer.exchange.from).label,
                            gain: row.offer.exchange.gain,
                          })
                        : t(
                            row.offer.direction === "both"
                              ? "ui.rulesets.builder.spendRaise"
                              : "ui.rulesets.builder.spendBuy",
                            {
                              cost: row.next?.paid ?? "?",
                            },
                          )}
                    </button>
                    {row.offer.direction === "both" && (
                      <button
                        type="button"
                        className={buttonClass}
                        disabled={!row.canReduce}
                        onClick={() => act(row.offer.id, "reduce", row.stepId)}
                        aria-label={t("ui.rulesets.builder.spendReduceFor", { name: rt(row.offer.label) })}
                      >
                        {t("ui.rulesets.builder.spendReduce", { cost: row.reduce?.paid ?? "?" })}
                      </button>
                    )}
                  </div>
                </div>
                {row.offer.exchange && (
                  <p className="text-[0.6875rem] tabular-nums text-[var(--muted-foreground)]">
                    {t("ui.rulesets.builder.spendTradeLine", {
                      from: targetOf(row.offer.exchange.from).label,
                      donor: row.donor ?? "?",
                      floor: row.offer.exchange.floor,
                      to: targetOf(row.offer.target).label,
                      total: row.total ?? "?",
                      max: row.max,
                    })}
                  </p>
                )}
                {row.offer.effect === "ownership" &&
                  row.purchases.length > 0 &&
                  typeof targetOf(row.offer.target).value === "number" &&
                  (targetOf(row.offer.target).value as number) > (row.total ?? 0) && (
                    <p className="text-[0.6875rem] tabular-nums text-[var(--muted-foreground)]">
                      {t("ui.rulesets.builder.spendOwned", {
                        level: row.total ?? "?",
                        shown: targetOf(row.offer.target).value as number,
                      })}
                    </p>
                  )}
                <p className="text-[0.6875rem] tabular-nums text-[var(--muted-foreground)]">
                  {t("ui.rulesets.builder.spendBreakdown", {
                    base: row.base ?? "?",
                    bought: (row.total ?? 0) - (row.base ?? 0),
                    total: row.total ?? "?",
                    cost: row.spent,
                  })}
                </p>
                <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                  {t("ui.rulesets.builder.ratingBounds", { min: row.min, max: row.max })}
                </p>
                {"unpriced" in row.offer.cost && (
                  <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                    {t("ui.rulesets.builder.spendUnpriced")}
                  </p>
                )}
                {row.offer.allowedRatings && (
                  <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                    {t("ui.rulesets.builder.spendAllowed", { ratings: row.offer.allowedRatings.join(", ") })}
                  </p>
                )}
                {row.unavailable && (
                  <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                    {t("ui.rulesets.builder.spendUnavailable")}
                  </p>
                )}
                {row.purchases.length > 0 && (
                  <details className="text-[0.6875rem] text-[var(--muted-foreground)]">
                    <summary className="cursor-pointer">{t("ui.rulesets.builder.spendLedger")}</summary>
                    <ul>
                      {row.purchases.map((purchase, index) => (
                        <li key={index}>{t("ui.rulesets.builder.spendLine", { ...purchase })}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {row.inactive && (
                  <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                    {t("ui.rulesets.builder.spendInactiveLine")}
                  </p>
                )}
                {row.override !== undefined && (
                  <p role="status" className="text-[0.6875rem] text-[var(--muted-foreground)]">
                    {t("ui.rulesets.builder.ratingOverride", { value: row.override })}
                  </p>
                )}
              </div>
            ))}
        </div>
      </div>
    );
  };

  const trainedStep = () => {
    // Each one at the tier it is trained to where that is above the first (Expertise), whether the
    // picks gave it outright or a choice built on them.
    const tiers = definition.resolution.proficiencyTiers;
    const rank = (tier: string) => tiers.findIndex((each) => each.id === tier);
    const named = new Map<string, { label: string; tier: string }>();
    for (const what of ["skills", "saves"] as const) {
      for (const [id, tier] of Object.entries(state.applied?.[what] ?? {}))
        named.set(`${what}:${id}`, { label: what === "skills" ? skillLabel(id) : saveLabel(id), tier });
    }
    for (const slot of trainedSlots) {
      for (const id of slot.chosen) {
        const key = `${slot.what}:${id}`;
        const was = named.get(key);
        if (was ? rank(slot.tier) > rank(was.tier) : rank(slot.tier) > 1)
          named.set(key, { label: slot.what === "skills" ? skillLabel(id) : saveLabel(id), tier: slot.tier });
      }
    }
    const fixed = [...named.values()].map(({ label, tier }) =>
      rank(tier) > 1 ? `${label} (${rt(tiers[rank(tier)]!.label)})` : label,
    );
    return (
      <div className="space-y-2">
        {fixed.length > 0 && (
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {t("ui.rulesets.builder.trainedNow", { names: fixed.join(", ") })}
          </p>
        )}
        {slotsHere}
        {trainedSlots.every((slot) => slot.stepId !== step.id || (!slot.unresolved && slot.from.length === 0)) && (
          <p className="text-xs text-[var(--muted-foreground)]">{t("ui.rulesets.builder.nothingToChoose")}</p>
        )}
      </div>
    );
  };

  const choicesStep = () => (
    <div className="space-y-2">
      {slotsHere}
      {entrySlots.every((slot) => slot.stepId !== step.id) && (
        <p className="text-xs text-[var(--muted-foreground)]">{t("ui.rulesets.builder.nothingToChoose")}</p>
      )}
    </div>
  );

  const gearStep = (current: StepOf<"startingGear">) => {
    const gear = rulesetBuilderStartingGearOptions(definition, current, build, freeEdit);
    return (
      <div className="space-y-1.5">
        <p className="text-xs text-[var(--muted-foreground)]">{t("ui.rulesets.builder.gearHint")}</p>
        {current.strict && (
          <label className="flex items-center gap-2 text-xs text-[var(--foreground)]">
            <input type="checkbox" checked={freeEdit} onChange={(event) => setFreeEdit(event.target.checked)} />
            {t("ui.rulesets.builder.freeEditGear")}
          </label>
        )}
        {current.strict && !freeEdit && gear.length === 0 && (
          <p className="text-xs text-[var(--muted-foreground)]">{t("ui.rulesets.builder.noOptions")}</p>
        )}
        <ul className="space-y-1">
          {gear.map((gear) => (
            <li key={gear.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs">
              <span className="font-semibold text-[var(--foreground)]">{rt(gear.label)}</span>
              {gear.summary && <span className="ml-1 text-[var(--muted-foreground)]">{rt(gear.summary)}</span>}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const trainedNames = (what: "skills" | "saves") => {
    const tiers = evaluated[what === "skills" ? "skillTiers" : "saveTiers"];
    const untrained = definition.resolution.proficiencyTiers[0]!.id;
    return Object.entries(tiers)
      .filter(([, tier]) => tier !== untrained)
      .map(([id]) => (what === "skills" ? skillLabel(id) : saveLabel(id)));
  };
  // The character as the summary shows it: what the steps wrote, then what the ruleset's own sheet
  // summary names (the numbers a player checks at a glance, such as armor class and speed). A number a
  // fields step asks for is left out while it still stands at its default, so ten class levels at 0
  // never crowd the scores.
  const summary = definition.gm.sheetSummary;
  const restingPools = outsideGame ? listRulesetLivePools(definition, build) : [];
  const poolLevels = outsideGame ? rulesetPoolLevels(definition, build, evaluated) : {};
  const fieldById = new Map(definition.sheet.fields.map((field) => [field.id, field]));
  const blankFields = defaultRulesetSheetBuild(definition).fields;
  const shownFields = [
    ...builder.steps.flatMap((each) =>
      each.kind === "catalog" && each.field
        ? [{ id: each.field, always: true }]
        : each.kind === "fields"
          ? each.fields.map((id) => ({ id, always: false }))
          : [],
    ),
    ...summary.fields.map((id) => ({ id, always: true })),
  ]
    .filter((entry, index, all) => all.findIndex((other) => other.id === entry.id) === index)
    .flatMap(({ id, always }) => {
      const field = fieldById.get(id);
      const value = build.fields[id];
      if (!field || value === undefined || value === "" || isRulesetItemHidden(field, build, definition)) return [];
      if (!always && field.type === "number" && value === blankFields[id]) return [];
      const text = field.type === "enum" ? rt(field.valueLabels?.[String(value)] ?? String(value)) : String(value);
      return [{ id, label: field.label, text }];
    });
  const shownDerived = summary.derived.flatMap((id) => {
    const entry = definition.sheet.derived.find((each) => each.id === id);
    const value = evaluated.derived[id];
    if (!entry || value === undefined || isRulesetItemHidden(entry, build, definition)) return [];
    // A bonus the ruleset marks as one (1.378) reads with its sign: a spell attack of "+5".
    return [{ id, label: entry.label, text: entry.signed && value > 0 ? `+${value}` : String(value) }];
  });

  return (
    <div className="space-y-3">
      <nav aria-label={t("ui.rulesets.builder.steps")}>
        <ol className="flex flex-wrap gap-1.5">
          {asked.map((each, index) => {
            const left = remaining[each.id] ?? 0;
            // A step is said to be done only once every step before it is: one that has nothing to
            // choose yet because its choices come from a class not picked is waiting, not finished.
            const waiting = asked.slice(0, index).some((before) => (remaining[before.id] ?? 0) > 0);
            return (
              <li key={each.id}>
                <button
                  type="button"
                  aria-current={each.id === step.id ? "step" : undefined}
                  onClick={() => setStepId(each.id)}
                  className={`${chipClass} inline-flex items-center gap-1 ${each.id === step.id ? chipOn : chipOff}`}
                >
                  {rt(each.label)}
                  {ready && left > 0 ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="rounded-full bg-[var(--primary)] px-1.5 text-[0.625rem] font-semibold text-[var(--primary-foreground)]"
                      >
                        {left}
                      </span>
                      <span className="sr-only">{t("ui.rulesets.builder.remaining", { count: left })}</span>
                    </>
                  ) : ready && waiting ? (
                    <span className="sr-only">{t("ui.rulesets.builder.waiting")}</span>
                  ) : ready ? (
                    <>
                      <Check size={12} aria-hidden="true" />
                      <span className="sr-only">{t("ui.rulesets.builder.done")}</span>
                    </>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {builder.profiles && (
        <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
          {t("ui.rulesets.builder.profile", {
            name: rt(rulesetBuilderActiveProfile(definition, build)?.label ?? t("ui.rulesets.builder.profileNone")),
          })}
        </p>
      )}
      {describing && ready && (
        <div
          role="note"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5"
        >
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("ui.rulesets.builder.describing")}</p>
          <button type="button" onClick={() => update({ ...state, describing: false })} className={buttonClass}>
            {t("ui.rulesets.builder.describingDone")}
          </button>
        </div>
      )}
      {ready && !rulesetSheetBuildIsBlank(definition, rawBuild) && (
        <button
          type="button"
          onClick={() => {
            // Everything typed and picked goes, so it is asked first.
            if (!window.confirm(t("ui.rulesets.builder.startOverConfirm"))) return;
            setMoreWanted(new Set());
            onApply(defaultRulesetSheetBuild(definition), {});
          }}
          className={buttonClass}
        >
          {t("ui.rulesets.builder.startOver")}
        </button>
      )}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <section
          aria-label={steps.length ? rt(step.label) : t("ui.rulesets.builder.steps")}
          className="min-w-0 space-y-2"
        >
          {steps.length > 0 && <h4 className="text-xs font-semibold text-[var(--foreground)]">{rt(step.label)}</h4>}
          {ready && failedRules.some((rule) => rule.step === step.id) && (
            <ul role="status" className="space-y-0.5 text-[0.6875rem] text-[var(--marinara-app-accent-static)]">
              {failedRules
                .filter((rule) => rule.step === step.id)
                .map((rule) => (
                  <li key={rule.id}>{rt(rule.label)}</li>
                ))}
            </ul>
          )}
          {steps.length === 0 ? (
            <p className="text-xs text-[var(--muted-foreground)]">{t("ui.rulesets.builder.noApplicableSteps")}</p>
          ) : failed ? (
            <p role="alert" className="text-xs text-[var(--marinara-app-accent-static)]">
              {t("ui.rulesets.builder.loadFailed")}
            </p>
          ) : !ready ? (
            <p className="text-xs text-[var(--muted-foreground)]">{t("ui.rulesets.builder.loading")}</p>
          ) : step.kind === "catalog" ? (
            catalogStep(step)
          ) : step.kind === "fields" ? (
            fieldsStep(step)
          ) : step.kind === "abilities" ? (
            abilitiesStep(step)
          ) : step.kind === "spend" ? (
            spendStep(step)
          ) : step.kind === "allocate" ? (
            allocateStep(step)
          ) : step.kind === "rows" ? (
            rowsStep(step)
          ) : step.kind === "mark" ? (
            markStep(step)
          ) : step.kind === "initialize" ? (
            initializeStep(step)
          ) : step.kind === "roll" ? (
            rollStep(step)
          ) : step.kind === "trained" ? (
            trainedStep()
          ) : step.kind === "choices" ? (
            choicesStep()
          ) : (
            gearStep(step)
          )}
          <div className="flex justify-between gap-2 pt-1">
            <button
              type="button"
              disabled={askedIndex === 0}
              onClick={() => setStepId(asked[askedIndex - 1]!.id)}
              className={buttonClass}
            >
              <ChevronLeft size={12} aria-hidden="true" />
              {t("ui.rulesets.builder.back")}
            </button>
            <button
              type="button"
              disabled={askedIndex >= asked.length - 1}
              onClick={() => setStepId(asked[askedIndex + 1]!.id)}
              className={buttonClass}
            >
              {t("ui.rulesets.builder.next")}
              <ChevronRight size={12} aria-hidden="true" />
            </button>
          </div>
        </section>

        <aside
          aria-label={t("ui.rulesets.builder.summary")}
          className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2"
        >
          <h4 className="text-xs font-semibold text-[var(--foreground)]">{t("ui.rulesets.builder.summary")}</h4>
          {shownFields.length > 0 && (
            <dl className="space-y-0.5 text-[0.6875rem]">
              {shownFields.map((entry) => (
                <div key={entry.id} className="flex justify-between gap-2">
                  <dt className="min-w-0 break-words text-[var(--muted-foreground)]">{rt(entry.label)}</dt>
                  <dd className="min-w-0 break-words text-right text-[var(--foreground)]">{entry.text}</dd>
                </div>
              ))}
            </dl>
          )}
          {definition.sheet.abilities.length > 0 && (
            <div className="grid grid-cols-3 gap-1">
              {definition.sheet.abilities.map((ability) => (
                <div key={ability.id} className="rounded border border-[var(--border)] px-1 py-0.5 text-center">
                  <div className="text-[0.625rem] text-[var(--muted-foreground)]">
                    {rt(ability.short ?? ability.label)}
                  </div>
                  <div className="text-xs font-semibold tabular-nums text-[var(--foreground)]">
                    {evaluated.abilityScores[ability.id] ?? ability.default}
                  </div>
                  <div className="text-[0.625rem] tabular-nums text-[var(--muted-foreground)]">
                    {rulesetCheckValueText(definition, evaluated.abilityMods[ability.id] ?? 0, t)}
                  </div>
                </div>
              ))}
            </div>
          )}
          {shownDerived.length > 0 && (
            <dl className="grid grid-cols-2 gap-1 text-[0.6875rem]">
              {shownDerived.map((entry) => (
                <div key={entry.id} className="rounded border border-[var(--border)] px-1.5 py-0.5">
                  <dt className="break-words text-[0.625rem] leading-tight text-[var(--muted-foreground)]">
                    {rt(entry.label)}
                  </dt>
                  <dd className="text-xs font-semibold tabular-nums text-[var(--foreground)]">{entry.text}</dd>
                </div>
              ))}
            </dl>
          )}
          {outsideGame && restingPools.length > 0 && (
            <dl className="grid grid-cols-2 gap-1 text-[0.6875rem]" aria-label={t("ui.rulesets.sheet.pools")}>
              {restingPools.map((pool) => (
                <div key={pool.key} className="rounded border border-dashed border-[var(--border)] px-1.5 py-0.5">
                  <dt className="break-words text-[0.625rem] leading-tight text-[var(--muted-foreground)]">
                    {rt(pool.label)}
                    {poolLevels[pool.key] !== undefined &&
                      ` · ${t("game.ruleset.sheet.poolLevel", { level: poolLevels[pool.key]! })}`}
                  </dt>
                  <dd className="text-xs font-semibold tabular-nums text-[var(--foreground)]">
                    {/* A tally counts uses (1.801), as the game sheet says it (ship readiness 2026-10-25:
                        Relentless Rage read "20"). */}
                    {pool.tally
                      ? t("game.ruleset.sheet.tallyUsed", { count: 0 })
                      : pool.start === "empty"
                        ? t("ui.rulesets.sheet.poolStartsEmpty", { max: pool.max })
                        : pool.max}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {gearNote && (
            <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("ui.rulesets.sheet.gearInGame")}</p>
          )}
          {/* Its attacks as a fight works them out (laptop class builds 2026-10-24): Unarmed Strike,
              and Martial Arts' Dexterity on a quarterstaff. */}
          {attacks.length > 0 && (
            <p className="text-[0.6875rem] text-[var(--foreground)]">
              <span className="text-[var(--muted-foreground)]">{t("game.ruleset.sheet.attacks")}: </span>
              {attacks
                .map(
                  (attack) =>
                    `${rt(attack.label)}${attack.toHit !== undefined ? ` ${attack.toHit >= 0 ? "+" : ""}${attack.toHit}` : ""}${attack.damage ? ` (${attack.damage})` : ""}`,
                )
                .join(", ")}
            </p>
          )}
          {(["saves", "skills"] as const).map((what) => {
            const names = trainedNames(what);
            return names.length > 0 ? (
              <p key={what} className="text-[0.6875rem] text-[var(--foreground)]">
                <span className="text-[var(--muted-foreground)]">
                  {t(what === "skills" ? "ui.rulesets.sheet.skills" : "ui.rulesets.sheet.saves")}:
                </span>{" "}
                {names.join(", ")}
              </p>
            ) : null;
          })}
        </aside>
      </div>
    </div>
  );
}
