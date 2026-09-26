// Generic editor for a Game Mode ruleset character sheet. Everything it shows comes from the
// ruleset definition: no ruleset ships client code, and nothing here knows a system by name.
// Values are clamped to the ruleset's bounds when they are edited, never when they are read.
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  defaultRulesetSheetBuild,
  evaluateRulesetSheetLive,
  isRulesetItemHidden,
  recomputeScaledRows,
  rulesetCatalogEntriesByRef,
  rulesetCatalogIdsForBuild,
  rulesetSectionGroups,
  rulesetUntrainedRule,
  scaledRowColumns,
  RULESET_CATALOG_ROW_KEY,
  type RulesetCatalogEntriesById,
  type RulesetCatalogPayload,
  type RulesetDefinition,
  type RulesetField,
  type RulesetLayerOptions,
  type RulesetListColumn,
  type RulesetSheetBuild,
  type RulesetSheetEnvelope,
} from "@marinara-engine/shared";
import { RulesetCatalogPicker } from "./RulesetCatalogPicker";
import { RulesetCatalogRefreshModal } from "./RulesetCatalogRefreshModal";
import { rulesetCatalogQuery } from "../../hooks/use-capability-packages";
import { applyCatalogRefresh, planCatalogRefresh, type CatalogRefreshRow } from "../../lib/ruleset-catalog";
import { rulesetCheckValueText } from "../../lib/ruleset-resolution";
import { DraftNumberInput } from "../ui/DraftNumberInput";
import { DraftTextarea } from "../ui/DraftTextarea";

type Scalar = number | string | boolean;
type ListRow = Record<string, Scalar>;

const inputClass =
  "w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs text-[var(--foreground)]";
const labelClass = "text-[0.6875rem] font-medium text-[var(--muted-foreground)]";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** The build an envelope carries, completed with the ruleset's defaults for anything it lacks. */
function readBuild(definition: RulesetDefinition, envelope: RulesetSheetEnvelope | undefined): RulesetSheetBuild {
  const defaults = defaultRulesetSheetBuild(definition);
  const build = envelope?.build;
  if (!build) return defaults;
  return {
    ...build,
    abilities: { ...defaults.abilities, ...build.abilities },
    skills: { ...build.skills },
    saves: { ...build.saves },
    bonuses: { ...build.bonuses },
    fields: { ...defaults.fields, ...build.fields },
    lists: { ...build.lists },
  };
}

function TypedInput({
  spec,
  value,
  onChange,
  ariaLabel,
  disabled = false,
  title,
  describedBy,
}: {
  spec: RulesetField | RulesetListColumn;
  value: Scalar | undefined;
  onChange: (value: Scalar) => void;
  ariaLabel: string;
  /** Set for a cell the ruleset keeps itself. The control stays in place and stops taking edits. */
  disabled?: boolean;
  /** The hint behind such a cell, for a pointer. */
  title?: string;
  /** The id of the visible text that says the same thing. A disabled control cannot be focused, so
   *  a `title` alone never reaches a keyboard or a screen reader. */
  describedBy?: string;
}) {
  if (spec.type === "number") {
    return (
      <DraftNumberInput
        value={
          typeof value === "number" && Number.isFinite(value) ? value : (spec.default ?? clamp(0, spec.min, spec.max))
        }
        onCommit={(next) => onChange(clamp(next, spec.min, spec.max))}
        min={spec.min}
        max={spec.max}
        integer={spec.integer}
        disabled={disabled}
        title={title}
        ariaLabel={ariaLabel}
        ariaDescribedBy={describedBy}
        className={`${inputClass} text-center`}
      />
    );
  }
  if (spec.type === "boolean") {
    return (
      <input
        type="checkbox"
        checked={value === true}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        className="h-4 w-4 accent-[var(--primary)]"
      />
    );
  }
  if (spec.type === "enum") {
    // On purpose the control shows the value the sheet EVALUATES to. A stored string the ruleset
    // no longer offers reads as the default in the sheet math, so showing the stale string beside
    // modifiers computed from the default would misreport them. The stored string itself is left
    // untouched until the user picks a value.
    const current = typeof value === "string" && spec.values.includes(value) ? value : (spec.default ?? spec.values[0]);
    return (
      <select
        value={current}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        className={inputClass}
      >
        {spec.values.map((option) => (
          <option key={option} value={option}>
            {spec.valueLabels?.[option] ?? option}
          </option>
        ))}
      </select>
    );
  }
  if (spec.type === "longtext") {
    return (
      <DraftTextarea
        value={typeof value === "string" ? value : ""}
        onCommit={(next) => onChange(next.slice(0, spec.maxLength))}
        maxLength={spec.maxLength}
        rows={2}
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        className={inputClass}
      />
    );
  }
  const maxLength = spec.type === "text" ? spec.maxLength : 40;
  return (
    <input
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value.slice(0, maxLength))}
      maxLength={maxLength}
      placeholder={spec.type === "dice" ? spec.example : undefined}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      className={inputClass}
    />
  );
}

/** Entries under the section headings the ruleset puts them in, each group drawn by `render`. A sheet
 *  whose entries name no section is drawn exactly as it always was: one group, no heading. */
function SectionedEntries<T extends { id: string; section?: string }>({
  definition,
  entries,
  render,
}: {
  definition: RulesetDefinition;
  entries: readonly T[];
  render: (entries: T[]) => React.ReactNode;
}) {
  const groups = rulesetSectionGroups(definition, entries);
  if (groups.length === 1 && !groups[0]!.section) return <>{render(groups[0]!.entries)}</>;
  return (
    <>
      {groups.map((group) => (
        <div key={group.section ? `section:${group.section.id}` : "none"} className="space-y-1">
          {group.section && <p className={labelClass}>{group.section.label}</p>}
          {render(group.entries)}
        </div>
      ))}
    </>
  );
}

function TrainedRows({
  title,
  entries,
  tiers,
  chosen,
  modifiers,
  bonuses,
  bonusRange,
  definition,
  onTier,
  onBonus,
}: {
  title: string;
  entries: RulesetDefinition["sheet"]["skills"];
  tiers: RulesetDefinition["resolution"]["proficiencyTiers"];
  chosen: Record<string, string>;
  modifiers: Record<string, number>;
  bonuses: Record<string, number>;
  bonusRange: { min: number; max: number };
  definition: RulesetDefinition;
  onTier: (id: string, tier: string) => void;
  onBonus: (id: string, bonus: number) => void;
}) {
  const { t } = useUiTranslation();
  if (entries.length === 0) return null;
  const untrainedTier = definition.resolution.proficiencyTiers[0]!.id;
  const abilityShort = (id: string | undefined) => {
    const ability = definition.sheet.abilities.find((entry) => entry.id === id);
    return ability ? (ability.short ?? ability.label) : "";
  };
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-[var(--foreground)]">{title}</h4>
      <SectionedEntries
        definition={definition}
        entries={entries}
        render={(group) => (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {group.map((entry) => (
              <div
                key={entry.id}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,7rem)_3.25rem_2.25rem] items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1"
              >
                <span className="min-w-0 truncate text-xs text-[var(--foreground)]" title={entry.label}>
                  {entry.label}
                  {entry.ability ? (
                    <span className="ml-1 text-[var(--muted-foreground)]">{abilityShort(entry.ability)}</span>
                  ) : null}
                </span>
                <select
                  value={chosen[entry.id] ?? tiers[0]!.id}
                  onChange={(event) => onTier(entry.id, event.target.value)}
                  aria-label={t("ui.rulesets.sheet.trainingFor", { name: entry.label })}
                  className={inputClass}
                >
                  {[
                    ...tiers,
                    // A stored tier the editor no longer offers still shows as what it is.
                    ...definition.resolution.proficiencyTiers.filter(
                      (tier) =>
                        tier.id === chosen[entry.id] && !tiers.some((offeredTier) => offeredTier.id === tier.id),
                    ),
                  ].map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.label}
                    </option>
                  ))}
                </select>
                <DraftNumberInput
                  value={bonuses[entry.id] ?? 0}
                  onCommit={(next) => onBonus(entry.id, clamp(next, bonusRange.min, bonusRange.max))}
                  min={bonusRange.min}
                  max={bonusRange.max}
                  integer
                  ariaLabel={t("ui.rulesets.sheet.bonusFor", { name: entry.label })}
                  title={t("ui.rulesets.sheet.bonusHint")}
                  className={`${inputClass} text-center`}
                />
                {/* A check the ruleset will not roll untrained has no number to show, and showing one
                    would promise a roll that is refused. */}
                {(chosen[entry.id] ?? untrainedTier) === untrainedTier &&
                rulesetUntrainedRule(definition, entry) === "refuse" ? (
                  <span
                    className="text-right text-xs font-semibold text-[var(--muted-foreground)]"
                    title={t("ui.rulesets.sheet.untrainedRefused")}
                    aria-label={t("ui.rulesets.sheet.untrainedRefusedFor", { name: entry.label })}
                  >
                    —
                  </span>
                ) : (
                  <span className="text-right text-xs font-semibold tabular-nums text-[var(--foreground)]">
                    {rulesetCheckValueText(definition, modifiers[entry.id] ?? 0, t)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      />
    </div>
  );
}

export function RulesetSheetEditor({
  definition,
  layerOptions,
  envelope,
  onChange,
  live,
}: {
  definition: RulesetDefinition;
  /** The pinned game's layer choices, which the catalog picker leaves hidden entries out by. The
   *  character and persona editors edit a sheet outside any game, so they pass nothing and the
   *  picker offers the ruleset's whole catalog. */
  layerOptions?: RulesetLayerOptions;
  envelope: RulesetSheetEnvelope | undefined;
  onChange: (envelope: RulesetSheetEnvelope) => void;
  /** The game's live state for this sheet, so a value that reads a track or a pool shows where it
   *  stands. The character and persona editors have none, and show it where play starts. */
  live?: unknown;
}) {
  const { t } = useUiTranslation();
  const { sheet, resolution } = definition;
  const build = useMemo(() => readBuild(definition, envelope), [definition, envelope]);
  const evaluated = useMemo(() => evaluateRulesetSheetLive(definition, build, live), [definition, build, live]);
  // Which catalog's picker is open. A ruleset that ships none, and a listing that carries none
  // (an older Engine, a stubbed response), simply never offers the button.
  const [pickerId, setPickerId] = useState<string | null>(null);
  // Which list's Refresh review is open.
  const [refreshListId, setRefreshListId] = useState<string | null>(null);
  const catalogs = definition.catalogs ?? [];
  const openPicker = catalogs.find((catalog) => catalog.id === pickerId);

  // The catalogs this sheet's own rows point at, and only those: a build with no picked rows fetches
  // nothing and takes exactly the code path a ruleset without catalogs takes. The query is the
  // picker's and the battle prefetch's, so all three share one cache entry.
  const catalogIds = useMemo(() => rulesetCatalogIdsForBuild(definition, build), [definition, build]);
  const combineCatalogs = useCallback(
    (results: readonly { data: RulesetCatalogPayload | undefined }[]): RulesetCatalogEntriesById => {
      const loaded: RulesetCatalogEntriesById = {};
      results.forEach((result, index) => {
        const catalogId = catalogIds[index];
        // A catalog that is still loading or failed to load simply is not here: nothing is locked
        // and nothing is recomputed from it, which is the same as a ruleset that ships none.
        if (catalogId && result.data) loaded[catalogId] = result.data.entries;
      });
      return loaded;
    },
    [catalogIds],
  );
  const loadedCatalogs = useQueries({
    queries: catalogIds.map((catalogId) => rulesetCatalogQuery(definition.id, catalogId, definition.version)),
    combine: combineCatalogs,
  });

  // Whether the user has changed anything in THIS editor. Opening a sheet must never write to it,
  // so the late recompute below is only for a sheet that is already being edited.
  const editedRef = useRef(false);
  const hintBaseId = useId();

  const commit = (patch: Partial<RulesetSheetBuild>) => {
    editedRef.current = true;
    // The one change path, so every edit leaves the ruleset's own cells right. The helper hands
    // back the very build it was given when nothing scaled changes, which is what today's editor
    // stored, so an ordinary edit behaves exactly as it always has.
    const patched = { ...build, ...patch };
    onChange({ ...envelope, v: sheet.version, build: recomputeScaledRows(definition, patched, loadedCatalogs) });
  };

  // The catalogs can land after the user has already typed. Such a sheet is brought up to date once,
  // here; a sheet that was only opened is left alone, so opening one never writes anything back.
  // Deliberately keyed on the catalogs alone: a later edit carries its own recompute through
  // `commit`, and the recompute is a no-op once it has run, since it returns the same build.
  useEffect(() => {
    if (!editedRef.current) return;
    const next = recomputeScaledRows(definition, build, loadedCatalogs);
    if (next === build) return;
    onChange({ ...envelope, v: sheet.version, build: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedCatalogs]);

  const hidden = (item: Parameters<typeof isRulesetItemHidden>[0]) => isRulesetItemHidden(item, build, definition);
  const offered = (ids: string[] | undefined) =>
    ids ? resolution.proficiencyTiers.filter((tier) => ids.includes(tier.id)) : resolution.proficiencyTiers;

  const sections = [
    ...sheet.sections,
    ...[...sheet.fields, ...sheet.derived, ...sheet.lists]
      .map((item) => item.section)
      .filter((id): id is string => !!id && !sheet.sections.some((section) => section.id === id))
      .filter((id, index, all) => all.indexOf(id) === index)
      .map((id) => ({ id, label: id })),
  ];
  const sectionGroups = [...sections, { id: "", label: t("ui.rulesets.sheet.otherSection") }]
    .map((section) => ({
      section,
      fields: sheet.fields.filter((field) => (field.section ?? "") === section.id && !hidden(field)),
      derived: sheet.derived.filter((entry) => (entry.section ?? "") === section.id && !hidden(entry)),
      lists: sheet.lists.filter((list) => (list.section ?? "") === section.id && !hidden(list)),
    }))
    .filter((group) => group.fields.length + group.derived.length + group.lists.length > 0);

  // The cells the ruleset keeps, by list and then by row index. Built once per build change, with
  // one lookup of the fetched entries shared by every row, and not at all while nothing loaded
  // scales anything.
  const scaledCells = useMemo(() => {
    const byList = new Map<string, Map<number, string[]>>();
    const anyScaled = Object.values(loadedCatalogs).some((entries) =>
      entries.some((entry) => entry.rows?.some((row) => row.scaled)),
    );
    if (!anyScaled) return byList;
    const byRef = rulesetCatalogEntriesByRef(loadedCatalogs);
    for (const list of sheet.lists) {
      const rows = build.lists[list.id];
      if (!Array.isArray(rows)) continue;
      const byIndex = new Map<number, string[]>();
      rows.forEach((row, index) => {
        if (!row || typeof row[RULESET_CATALOG_ROW_KEY] !== "string") return;
        const columns = scaledRowColumns(definition, list.id, row, byRef);
        if (columns.length > 0) byIndex.set(index, columns);
      });
      if (byIndex.size > 0) byList.set(list.id, byIndex);
    }
    return byList;
  }, [build.lists, definition, loadedCatalogs, sheet.lists]);

  // Which picked rows the ruleset now has different text for, gathered per list: one list may be fed
  // by more than one catalog, and a row belongs to exactly one of them.
  const refreshByList = useMemo(() => {
    const byList = new Map<string, CatalogRefreshRow[]>();
    for (const [catalogId, entries] of Object.entries(loadedCatalogs)) {
      for (const plan of planCatalogRefresh(definition, catalogId, entries, build.lists)) {
        const rows = byList.get(plan.listId);
        if (rows) rows.push(...plan.rows);
        else byList.set(plan.listId, [...plan.rows]);
      }
    }
    for (const rows of byList.values()) rows.sort((left, right) => left.index - right.index);
    return byList;
  }, [build.lists, definition, loadedCatalogs]);
  const refreshList = refreshListId ? sheet.lists.find((list) => list.id === refreshListId) : undefined;
  const refreshRows = refreshList ? (refreshByList.get(refreshList.id) ?? []) : [];

  // The row is SPREAD, so a key the editor does not draw survives an edit. That is what keeps the
  // reserved catalog mark on a picked row: a column id can never start with "_", so the mark is
  // never a column and never rendered, and editing or deleting a picked row needs nothing special.
  const updateRow = (listId: string, rows: ListRow[], index: number, columnId: string, value: Scalar) =>
    commit({
      lists: { ...build.lists, [listId]: rows.map((row, i) => (i === index ? { ...row, [columnId]: value } : row)) },
    });

  return (
    <div className="space-y-4">
      {sheet.abilities.length > 0 && (
        <SectionedEntries
          definition={definition}
          entries={sheet.abilities}
          render={(group) => (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {group.map((ability) => (
                <label
                  key={ability.id}
                  className="flex min-w-0 flex-col items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2"
                >
                  <span className={`${labelClass} max-w-full truncate`} title={ability.label}>
                    {ability.short ?? ability.label}
                  </span>
                  <DraftNumberInput
                    value={evaluated.abilityScores[ability.id] ?? ability.default}
                    onCommit={(next) =>
                      commit({ abilities: { ...build.abilities, [ability.id]: clamp(next, ability.min, ability.max) } })
                    }
                    min={ability.min}
                    max={ability.max}
                    integer
                    ariaLabel={ability.label}
                    className={`${inputClass} text-center`}
                  />
                  <span className="text-xs font-semibold tabular-nums text-[var(--foreground)]">
                    {rulesetCheckValueText(definition, evaluated.abilityMods[ability.id] ?? 0, t)}
                  </span>
                </label>
              ))}
            </div>
          )}
        />
      )}

      {sectionGroups.map(({ section, fields, derived, lists }) => (
        <div key={section.id || "other"} className="space-y-2">
          <h4 className="text-xs font-semibold text-[var(--foreground)]">{section.label}</h4>
          {(fields.length > 0 || derived.length > 0) && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {fields.map((field) => (
                <label
                  key={field.id}
                  className={`flex min-w-0 flex-col gap-1 ${field.type === "longtext" ? "col-span-full" : ""}`}
                >
                  <span className={labelClass}>{field.label}</span>
                  <TypedInput
                    spec={field}
                    value={build.fields[field.id]}
                    onChange={(value) => commit({ fields: { ...build.fields, [field.id]: value } })}
                    ariaLabel={field.label}
                  />
                </label>
              ))}
              {derived.map((entry) => (
                <div key={entry.id} className="flex min-w-0 flex-col gap-1">
                  <span className={labelClass}>{entry.label}</span>
                  <span className="rounded-lg border border-dashed border-[var(--border)] px-2 py-1 text-center text-xs font-semibold tabular-nums text-[var(--foreground)]">
                    {evaluated.derived[entry.id] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          )}
          {lists.map((list) => {
            const rows = (Array.isArray(build.lists[list.id]) ? build.lists[list.id] : []) as ListRow[];
            // A catalog of creatures feeds no list, so the picker never offers it anywhere.
            const feeding = catalogs.filter((catalog) => catalog.feeds?.includes(list.id));
            const atLimit = rows.length >= list.maxItems;
            const locked = scaledCells.get(list.id);
            const stale = refreshByList.get(list.id) ?? [];
            return (
              <div key={list.id} className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={labelClass}>
                    {list.label} ({rows.length}/{list.maxItems})
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* One button per catalog that feeds this list, named when there is more than one. */}
                    {feeding.map((catalog) => (
                      <button
                        key={catalog.id}
                        type="button"
                        disabled={atLimit}
                        title={
                          atLimit
                            ? t("game.ruleset.catalog.listFull", { list: list.label, max: list.maxItems })
                            : undefined
                        }
                        onClick={() => setPickerId(catalog.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[0.6875rem] text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-50"
                      >
                        <BookOpen size={12} aria-hidden="true" />
                        {feeding.length > 1
                          ? t("game.ruleset.catalog.addFromNamed", { name: catalog.label })
                          : t("game.ruleset.catalog.addFrom")}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={atLimit}
                      onClick={() =>
                        commit({
                          lists: {
                            ...build.lists,
                            [list.id]: [
                              ...rows,
                              Object.fromEntries(
                                list.columns
                                  .filter((column) => column.default !== undefined)
                                  .map((column) => [column.id, column.default as Scalar]),
                              ),
                            ],
                          },
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[0.6875rem] text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-50"
                    >
                      <Plus size={12} aria-hidden="true" />
                      {t("ui.rulesets.sheet.addRow")}
                    </button>
                  </div>
                </div>
                {/* Deliberately not a live region: it is recounted as the sheet is typed in, and a
                    notice that re-announces on every keystroke is worse than one that waits. */}
                {stale.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
                      {t("ui.rulesets.sheet.refreshNotice", { count: stale.length })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRefreshListId(list.id)}
                      aria-label={t("ui.rulesets.sheet.refreshReviewFor", { list: list.label })}
                      className="rounded-lg border border-[var(--border)] px-2 py-1 text-[0.6875rem] text-[var(--foreground)] hover:bg-[var(--accent)]"
                    >
                      {t("ui.rulesets.sheet.refreshReview")}
                    </button>
                  </div>
                )}
                {rows.map((row, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2"
                  >
                    <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {list.columns.map((column) => {
                        // A cell the ruleset keeps follows this character's own numbers, so it is
                        // shown where it always was and simply does not take edits.
                        const setByRuleset = locked?.get(index)?.includes(column.id) ?? false;
                        const hintId = setByRuleset ? `${hintBaseId}-${list.id}-${index}-${column.id}` : undefined;
                        return (
                          <label
                            key={column.id}
                            className={`flex min-w-0 flex-col gap-0.5 ${column.type === "longtext" ? "col-span-full" : ""}`}
                          >
                            <span className={labelClass}>{column.label}</span>
                            <TypedInput
                              spec={column}
                              value={row[column.id]}
                              onChange={(value) => updateRow(list.id, rows, index, column.id, value)}
                              ariaLabel={`${list.label} ${index + 1}: ${column.label}`}
                              disabled={setByRuleset}
                              title={setByRuleset ? t("ui.rulesets.sheet.scaledHint") : undefined}
                              describedBy={hintId}
                            />
                            {hintId && (
                              <span id={hintId} className="text-[0.625rem] text-[var(--muted-foreground)]">
                                {t("ui.rulesets.sheet.scaledHint")}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        commit({ lists: { ...build.lists, [list.id]: rows.filter((_, i) => i !== index) } })
                      }
                      aria-label={t("ui.rulesets.sheet.removeRow", { list: list.label, index: index + 1 })}
                      className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--destructive)]"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}

      <TrainedRows
        title={t("ui.rulesets.sheet.skills")}
        entries={sheet.skills}
        tiers={offered(sheet.skillTiers)}
        chosen={evaluated.skillTiers}
        modifiers={evaluated.skillMods}
        bonuses={build.bonuses}
        bonusRange={sheet.bonusRange}
        definition={definition}
        onTier={(id, tier) => commit({ skills: { ...build.skills, [id]: tier } })}
        onBonus={(id, bonus) => commit({ bonuses: { ...build.bonuses, [id]: bonus } })}
      />
      <TrainedRows
        title={t("ui.rulesets.sheet.saves")}
        entries={sheet.saves}
        tiers={offered(sheet.saveTiers)}
        chosen={evaluated.saveTiers}
        modifiers={evaluated.saveMods}
        bonuses={build.bonuses}
        bonusRange={sheet.bonusRange}
        definition={definition}
        onTier={(id, tier) => commit({ saves: { ...build.saves, [id]: tier } })}
        onBonus={(id, bonus) => commit({ bonuses: { ...build.bonuses, [id]: bonus } })}
      />

      {openPicker && (
        <RulesetCatalogPicker
          open
          onClose={() => setPickerId(null)}
          definition={definition}
          layerOptions={layerOptions}
          catalog={openPicker}
          build={build}
          // Every list the pick touches moves in ONE envelope change, so a two-list entry can never
          // land half-applied.
          onAdd={(lists) => commit({ lists: { ...build.lists, ...lists } })}
        />
      )}

      {refreshList && refreshRows.length > 0 && (
        <RulesetCatalogRefreshModal
          open
          onClose={() => setRefreshListId(null)}
          listLabel={refreshList.label}
          rows={refreshRows}
          // Every chosen row moves in ONE envelope change, and only the columns that differ are
          // written: everything else the row holds, the catalog mark included, is kept.
          onApply={(chosen) => commit({ lists: { ...build.lists, ...applyCatalogRefresh(build.lists, chosen) } })}
        />
      )}
    </div>
  );
}
