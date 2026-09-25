// The picker behind "Add from catalog": everything a ruleset's catalog offers, searchable and
// filterable, with the rows a pick would write named before it is made.
//
// Nothing here is shaped to one system. Every label comes from the catalog, from the ruleset's own
// lists and pools, or from a localization key, and the entries themselves are read from the ruleset
// this sheet is being edited against.
import { useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { TFunction } from "i18next";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  isRulesetItemHidden,
  type RulesetCatalogEntry,
  type RulesetCatalogHeader,
  type RulesetDefinition,
  type RulesetLayerOptions,
  type RulesetSheetBuild,
} from "@marinara-engine/shared";
import { rulesetBattleCatalogIds } from "../../lib/ruleset-combat-bridge";
import { useRulesetCatalog } from "../../hooks/use-capability-packages";
import { ApiError } from "../../lib/api-client";
import {
  CATALOG_FILTER_ANY,
  CATALOG_VISIBLE_LIMIT,
  catalogEntryAlreadyAdded,
  catalogEntryFilterTexts,
  catalogFilterViews,
  catalogMechanicsLabels,
  filterCatalogEntries,
  formatCatalogMechanics,
  planCatalogAddition,
  visibleCatalogEntries,
  type CatalogListRow,
} from "../../lib/ruleset-catalog";
import { Modal } from "../ui/Modal";

/** The header as the picker needs it: where the entries live is the hook's business, not this one's. */
export type RulesetCatalogHeaderView = Omit<RulesetCatalogHeader, "entries" | "asset">;

const inputClass =
  "w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs text-[var(--foreground)]";
const labelClass = "text-[0.6875rem] font-medium text-[var(--muted-foreground)]";
const chipClass =
  "rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[0.625rem] text-[var(--muted-foreground)]";

/** The server's own words for a refusal, plus the first few reasons a 422 carries, so a catalog
 *  file the Engine cannot read says what is wrong with it instead of just failing. */
function describeCatalogError(error: unknown, fallback: string): { message: string; issues: string[] } {
  if (!(error instanceof ApiError)) return { message: fallback, issues: [] };
  const payload = error.payload as { issues?: unknown } | undefined;
  const issues = Array.isArray(payload?.issues)
    ? payload.issues.filter((issue): issue is string => typeof issue === "string").slice(0, 3)
    : [];
  return { message: error.message.trim() || fallback, issues };
}

/** The values one entry carries for the catalog's declared filters, as small chips. Deduplicated,
 *  because two filters may well name the same word and one chip says it once. A bare number says
 *  nothing on its own, so a number filter's chip carries the filter's label too. */
function entryChips(entry: RulesetCatalogEntry, catalog: RulesetCatalogHeaderView, t: TFunction): string[] {
  const chips = new Set<string>();
  for (const filter of catalog.filters ?? []) {
    for (const text of catalogEntryFilterTexts(entry, filter.id)) {
      chips.add(
        filter.type === "number" ? t("game.ruleset.catalog.filterChip", { label: filter.label, value: text }) : text,
      );
    }
  }
  return [...chips];
}

export function RulesetCatalogPicker({
  open,
  onClose,
  definition,
  layerOptions,
  catalog,
  build,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  definition: RulesetDefinition;
  /** The pinned game's layer choices. A layer may declare that a catalog's entries are out of play
   *  under it, and those are not offered here. Nothing is hidden when no game is pinned. */
  layerOptions?: RulesetLayerOptions;
  catalog: RulesetCatalogHeaderView;
  build: RulesetSheetBuild;
  /** The lists that change, each with its full new rows, for one commit. */
  onAdd: (lists: Record<string, CatalogListRow[]>) => void;
}) {
  const { t } = useUiTranslation();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  // Null until the user touches a filter: the starting values depend on entries that arrive later.
  const [chosen, setChosen] = useState<Record<string, string> | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const query = useRulesetCatalog(definition.id, catalog.id, definition.version, open);
  // Narrowed before anything else reads them, so a filter never offers a value only a hidden entry
  // carries and the match count is the count of entries that can really be picked. The query itself
  // is untouched, which is what keeps Refresh from ruleset and the scaled columns whole.
  const entries = useMemo(
    () => visibleCatalogEntries(definition, layerOptions, catalog.id, query.data?.entries ?? []),
    [catalog.id, definition, layerOptions, query.data],
  );

  const views = useMemo(
    () => catalogFilterViews(catalog, entries, definition, build),
    [build, catalog, definition, entries],
  );
  const starts = useMemo(() => Object.fromEntries(views.map((view) => [view.filter.id, view.start])), [views]);
  const active = chosen ?? starts;

  const matches = useMemo(() => filterCatalogEntries(entries, views, search, active), [active, entries, search, views]);
  const visible = matches.slice(0, CATALOG_VISIBLE_LIMIT);

  const labels = useMemo(() => catalogMechanicsLabels(definition, catalog), [catalog, definition]);
  const battleCatalogIds = useMemo(() => rulesetBattleCatalogIds(definition), [definition]);
  const showsMechanics = useMemo(() => entries.some((entry) => entry.mechanics), [entries]);

  // A list `hideWhen` hides on this sheet is not drawn by the editor, so nothing is added to it.
  const hiddenLists = useMemo(
    () =>
      new Set(
        definition.sheet.lists.filter((list) => isRulesetItemHidden(list, build, definition)).map((list) => list.id),
      ),
    [build, definition],
  );
  const plan = useMemo(
    () =>
      planCatalogAddition(
        definition,
        catalog.id,
        entries.filter((entry) => selected.has(entry.id)),
        build.lists,
        hiddenLists,
      ),
    [build.lists, catalog.id, definition, entries, hiddenLists, selected],
  );

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const failure = query.isError ? describeCatalogError(query.error, t("game.ruleset.catalog.loadFailed")) : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("game.ruleset.catalog.title", { catalog: catalog.label })}
      width="max-w-2xl"
      mobileFullscreen
      initialFocusRef={searchRef}
      contentClassName="flex flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
            <span className={labelClass}>{t("game.ruleset.catalog.searchLabel")}</span>
            {/* No form wraps the picker (the Modal is a portal), so Enter here submits nothing. */}
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("game.ruleset.catalog.searchPlaceholder")}
              className={inputClass}
            />
          </label>
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

        {query.isPending ? (
          <p className="flex items-center gap-2 py-6 text-xs text-[var(--muted-foreground)]">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            {t("game.ruleset.catalog.loading")}
          </p>
        ) : failure ? (
          <div className="space-y-2 py-4">
            <p role="alert" className="text-xs text-[var(--destructive)]">
              {failure.message}
            </p>
            {failure.issues.map((issue, index) => (
              <p key={index} className="text-[0.6875rem] text-[var(--muted-foreground)]">
                {issue}
              </p>
            ))}
            <button type="button" onClick={() => void query.refetch()} className="mari-chrome-control text-xs">
              {t("game.ruleset.catalog.retry")}
            </button>
          </div>
        ) : entries.length === 0 ? (
          <p className="py-6 text-xs text-[var(--muted-foreground)]">{t("game.ruleset.catalog.empty")}</p>
        ) : (
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
            {visible.length === 0 && (
              <p className="py-6 text-xs text-[var(--muted-foreground)]">{t("game.ruleset.catalog.noMatches")}</p>
            )}
            {visible.map((entry) => {
              const added = catalogEntryAlreadyAdded(catalog.id, entry, catalog.feeds ?? [], build.lists);
              const chips = entryChips(entry, catalog, t);
              return (
                <label
                  key={entry.id}
                  className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(entry.id)}
                    onChange={() => toggle(entry.id)}
                    aria-label={entry.label}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
                  />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium text-[var(--foreground)]">{entry.label}</span>
                      {added && (
                        <span className={chipClass} title={t("game.ruleset.catalog.addedHint")}>
                          {t("game.ruleset.catalog.added")}
                        </span>
                      )}
                    </span>
                    {entry.summary && (
                      <span className="block text-[0.6875rem] text-[var(--muted-foreground)]">{entry.summary}</span>
                    )}
                    {chips.length > 0 && (
                      <span className="flex flex-wrap gap-1">
                        {chips.map((chip) => (
                          <span key={chip} className={chipClass}>
                            {chip}
                          </span>
                        ))}
                      </span>
                    )}
                    {entry.mechanics && (
                      <span className="block text-[0.6875rem] text-[var(--foreground)]">
                        {formatCatalogMechanics(entry.mechanics, labels, t)}
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

        {showsMechanics && (
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {/* A ruleset whose battle block reads one of the lists this catalog fills does lend these
                numbers to battles, so the note must not say otherwise. */}
            {t(
              battleCatalogIds.includes(catalog.id)
                ? "game.ruleset.catalog.mechanicsNoteBattle"
                : "game.ruleset.catalog.mechanicsNote",
            )}
          </p>
        )}

        <div className="shrink-0 space-y-1.5 border-t border-[var(--border)] pt-2">
          {plan.targets.map((target) => (
            <p key={target.listId} className="text-[0.6875rem] text-[var(--muted-foreground)]">
              {t("game.ruleset.catalog.listGain", {
                list: target.label,
                adding: target.adding,
                room: target.room,
              })}
            </p>
          ))}
          {plan.dropped > 0 && (
            <p role="alert" className="text-[0.6875rem] text-[var(--destructive)]">
              {t("game.ruleset.catalog.dropped", { count: plan.dropped })}
            </p>
          )}
          {plan.full.length > 0 && (
            <p role="alert" className="text-[0.6875rem] text-[var(--destructive)]">
              {t("game.ruleset.catalog.overflow", { lists: plan.full.join(", ") })}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
              {t("game.ruleset.catalog.selected", { count: selected.size })}
            </span>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={onClose}
                className="mari-chrome-control mari-chrome-control--small text-xs"
              >
                {t("game.ruleset.catalog.cancel")}
              </button>
              <button
                type="button"
                // Nothing to add also covers a selection whose every entry was left out.
                disabled={selected.size === 0 || plan.full.length > 0 || plan.targets.length === 0}
                onClick={() => {
                  onAdd(plan.lists);
                  onClose();
                }}
                className="mari-chrome-control mari-chrome-control--primary mari-chrome-control--small text-xs"
              >
                {t("game.ruleset.catalog.confirm", { count: selected.size })}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
