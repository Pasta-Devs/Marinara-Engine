// The in-game half of a ruleset character sheet: what changes during play.
//
// The BUILD (abilities, training, lists) lives on the game's copy of the card and is edited with
// the shared `RulesetSheetEditor`. Everything else here is LIVE state — pool values, tracks, short
// notes, conditions — and every change goes through `applyRulesetSheetOp`, the same function the
// Game Master's `[sheet: ...]` commands go through. A player and the Game Master therefore obey
// one set of rules: a pool that is empty cannot be spent from by either of them.
//
// Nothing here knows a system by name. Every pool, track, note, condition and rest is read out of
// the definition, so a ruleset whose only resource is an empty-start "stress" track renders as
// completely as one with spell slots.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Check, Minus, Pencil, Plus, X } from "lucide-react";
import type { TFunction } from "i18next";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  rulesetConditionIcons,
  rulesetItemEffectFacts,
  applyRulesetSheetOp,
  rulesetRestDiceEntries,
  rulesetPartyDefinition,
  readRulesetPartySheet,
  readResolvedSheetCommandTags,
  rulesetSheetStamp,
  defaultRulesetSheetBuild,
  evaluateRulesetSheet,
  readRulesetLive,
  rulesetKeptCalls,
  rulesetKeptForm,
  rulesetCheckEffects,
  rulesetCheckSources,
  rulesetHideLines,
  rulesetSectionGroups,
  isRulesetItemHidden,
  isRulesetTextHidden,
  rulesetCatalogIdsForBuild,
  type EvaluatedRulesetSheet,
  type RulesetCatalogEntriesById,
  type RulesetCatalogPayload,
  type ResolvedRulesetLive,
  type RulesetDefinition,
  type RulesetField,
  type RulesetLayerOptions,
  type RulesetList,
  type RulesetLiveState,
  type RulesetSheetBuild,
  type RulesetSheetEnvelope,
  type RulesetSheetOp,
  type RulesetSheetItem,
  type RulesetRestRecovery,
  type RulesetUseRecover,
} from "@marinara-engine/shared";
import { ArtIcon } from "./ArtIcon";
import { rulesetEffectPhrase } from "./RulesetItemPicker";
import { RulesetSheetEditor } from "../rulesets/RulesetSheetEditor";
import { stalePartySheet, useSavePartySheet } from "../../hooks/use-party-sheet";
import { rulesetCheckValueText } from "../../lib/ruleset-resolution";
import {
  rulesetListRowsShown,
  rulesetPoolLevels,
  rulesetPoolGroupLabel,
  rulesetSheetAttacks,
  rulesetSheetSummaryShown,
} from "../../lib/ruleset-sheet-view";
import { rulesetCatalogQuery } from "../../hooks/use-capability-packages";
import { RulesetTextContext, useRulesetText, type RulesetText } from "../../lib/ruleset-text";
import { useRulesetDefinitionText } from "../../hooks/use-ruleset-text";
import { useCombatScreenStore } from "../../stores/combat-screen.store";
import { DraftNumberInput } from "../ui/DraftNumberInput";
import { DraftTextarea } from "../ui/DraftTextarea";

const cardClass = "rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2 py-1.5";
const labelClass = "text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]";
const stepButtonClass =
  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40";
const numberInputClass =
  "w-10 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-1 py-0.5 text-center text-xs tabular-nums text-[var(--foreground)]";
const chipClass =
  "rounded-full border px-2 py-0.5 text-[0.6875rem] transition-colors disabled:cursor-not-allowed disabled:opacity-50";

/** Plain-language phrases for the reasons the Engine turns a sheet command down. A reason this
 *  Engine does not know (a newer one's, a hand-edited transcript) falls back to a generic line
 *  rather than showing the player a bare code. */
const SHEET_REFUSAL_KEYS: Readonly<Record<string, string>> = Object.freeze({
  "unknown-sheet": "game.ruleset.sheet.refusal.unknownSheet",
  "unknown-pool": "game.ruleset.sheet.refusal.unknownPool",
  "ambiguous-pool": "game.ruleset.sheet.refusal.ambiguousPool",
  insufficient: "game.ruleset.sheet.refusal.insufficient",
  "bad-amount": "game.ruleset.sheet.refusal.badAmount",
  "no-temp": "game.ruleset.sheet.refusal.noTemp",
  "unknown-track": "game.ruleset.sheet.refusal.unknownTrack",
  "wrong-track": "game.ruleset.sheet.refusal.wrongTrack",
  "unknown-kind": "game.ruleset.sheet.refusal.unknownKind",
  "no-box": "game.ruleset.sheet.refusal.noBox",
  "unknown-condition": "game.ruleset.sheet.refusal.unknownCondition",
  "unknown-state": "game.ruleset.sheet.refusal.unknownState",
  "unknown-value": "game.ruleset.sheet.refusal.unknownValue",
  "unknown-field": "game.ruleset.sheet.refusal.unknownField",
  "unknown-rest": "game.ruleset.sheet.refusal.unknownRest",
  "unknown-entry": "game.ruleset.sheet.refusal.unknownEntry",
  "ambiguous-entry": "game.ruleset.sheet.refusal.ambiguousEntry",
  "bad-pool": "game.ruleset.sheet.refusal.badPool",
  "cannot-heal": "game.ruleset.sheet.refusal.cannotHeal",
  "dying-saves-rolled": "game.ruleset.sheet.refusal.dyingSavesRolled",
  "rested-already": "game.ruleset.sheet.refusal.restedAlready",
  "not-prepared": "game.ruleset.sheet.refusal.notPrepared",
  "too-many-prepared": "game.ruleset.sheet.refusal.tooManyPrepared",
  malformed: "game.ruleset.sheet.refusal.malformed",
  "unknown-character": "game.ruleset.sheet.refusal.unknownCharacter",
  "ambiguous-character": "game.ruleset.sheet.refusal.ambiguousCharacter",
  "too-many": "game.ruleset.sheet.refusal.tooMany",
});

/** The phrase for a reason, by the code before any detail after its colon ("not-prepared: ..."). */
function refusalKey(reason: string): string {
  return (
    SHEET_REFUSAL_KEYS[reason] ?? SHEET_REFUSAL_KEYS[reason.split(":")[0]!.trim()] ?? "game.ruleset.sheet.refusal.other"
  );
}

/** One line naming every sheet change the Engine refused in a turn, or null when it refused none.
 *  The narration may well claim the spend happened, so the player is told it did not. */
export function describeRefusedSheetCommands(content: string, t: TFunction): string | null {
  const refused = readResolvedSheetCommandTags(content).filter((entry) => !entry.ok);
  if (refused.length === 0) return null;
  const list = refused
    .map((entry) =>
      t("game.ruleset.sheet.refusal.entry", {
        who:
          entry.sheet === "party"
            ? t("game.ruleset.party.title")
            : entry.who || t("game.ruleset.sheet.refusal.someone"),
        reason: t(refusalKey(entry.reason ?? "")),
      }),
    )
    .join(" ");
  return t("game.ruleset.sheet.refusal.summary", { list });
}

/** One summary field as text. Number fields read their evaluated value, so a default applies. */
function summaryFieldValue(
  field: RulesetField,
  build: RulesetSheetBuild,
  evaluated: EvaluatedRulesetSheet,
  yes: string,
  no: string,
  text: RulesetText,
): string {
  if (field.type === "number") return String(evaluated.numbers[field.id] ?? 0);
  const stored = build.fields?.[field.id];
  const value = stored === undefined ? field.default : stored;
  if (typeof value === "boolean") return value ? yes : no;
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return "";
  // A choice's label is the ruleset's own word. A written value reads any of the ruleset's words in it
  // ("Common, Elvish" for Languages, name by name); what a player typed in of their own stays as written.
  return text(field.type === "enum" ? (field.valueLabels?.[value] ?? value) : value);
}

/** A number with its sign where it is a bonus: "+7", "-1", "0". */
function signedText(value: number, signed: boolean | undefined): string {
  return signed && value > 0 ? `+${value}` : String(value);
}

/**
 * The ruleset's own words in the player's language (1.806), as the fight screen reads them
 * (`DirectedCombatUI`): its translation for the language on screen, or every word as written. Only
 * what is shown goes through it; ids, and what goes back to the rules, stay the ruleset's own.
 */
function useSheetRulesetText(definition: RulesetDefinition): RulesetText {
  return useRulesetDefinitionText(definition);
}

/** How many conditions the "Add condition" search offers at once: it narrows as more is typed. */
const CONDITION_MATCHES_SHOWN = 12;

/**
 * The conditions on the character, as chips, and the rest behind a search. A ruleset may name
 * hundreds (every spell's and item's own state), so only what is on is drawn; a condition the
 * ruleset keeps out of the picker (`pickable: false`) still shows while play has put it on.
 */
function RulesetSheetConditions({
  definition,
  conditions,
  editable,
  cardName,
  onToggle,
}: {
  definition: RulesetDefinition;
  conditions: ResolvedRulesetLive["conditions"];
  editable: boolean;
  cardName: string;
  onToggle: (condition: string, active: boolean) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const text = useRulesetText();
  const [query, setQuery] = useState("");
  const active = conditions.filter((condition) => condition.active);
  const pickable = useMemo(() => {
    const kept = new Set(
      definition.sheet.live.conditions.filter((entry) => entry.pickable === false).map((entry) => entry.id),
    );
    return conditions.filter((condition) => !condition.active && !kept.has(condition.id));
  }, [conditions, definition]);
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? pickable
        .filter((condition) => text(condition.label).toLowerCase().includes(needle))
        .slice(0, CONDITION_MATCHES_SHOWN)
    : [];
  if (!active.length && (!editable || !pickable.length)) return null;
  return (
    <div className="space-y-1.5">
      <p className={labelClass}>{localizeUi("game.ruleset.sheet.conditions")}</p>
      {active.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {active.map((condition) => (
            <span
              key={condition.id}
              className={`${chipClass} inline-flex items-center gap-1 border-[var(--primary)] bg-[var(--accent)] text-[var(--foreground)]`}
            >
              <ArtIcon ids={rulesetConditionIcons(definition, condition.id)} className="h-4 w-4" />
              {text(condition.label)}
              {editable && (
                <button
                  type="button"
                  onClick={() => onToggle(condition.id, false)}
                  aria-label={localizeUi("game.ruleset.sheet.removeConditionAria", {
                    name: text(condition.label),
                    who: cardName,
                  })}
                  className="-mr-1 rounded-full p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                >
                  <X size={10} aria-hidden="true" />
                </button>
              )}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
          {localizeUi("game.ruleset.sheet.noConditions")}
        </p>
      )}
      {editable && pickable.length > 0 && (
        <div className="space-y-1">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={localizeUi("game.ruleset.sheet.addCondition")}
            aria-label={localizeUi("game.ruleset.sheet.addConditionAria", { who: cardName })}
            className="w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--foreground)]"
          />
          {matches.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {matches.map((condition) => (
                <button
                  key={condition.id}
                  type="button"
                  onClick={() => {
                    onToggle(condition.id, true);
                    setQuery("");
                  }}
                  className={`${chipClass} border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]`}
                >
                  <ArtIcon
                    ids={rulesetConditionIcons(definition, condition.id)}
                    className="mr-1 h-4 w-4 align-[-0.2em]"
                  />
                  {text(condition.label)}
                </button>
              ))}
            </div>
          )}
          {needle && matches.length === 0 && (
            <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
              {localizeUi("game.ruleset.sheet.noConditionMatch")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** A list the ruleset gives a tab of its own (1.378): its rows by name, under a heading for each
 *  place a number column puts them in ("Cantrips", "1st level"), with a tick for a yes-or-no column. */
function RulesetSheetListView({
  definition,
  list,
  rows,
  yes,
}: {
  definition: RulesetDefinition;
  list: RulesetList;
  rows: unknown;
  yes: string;
}) {
  const text = useRulesetText();
  const display = list.display;
  const nameColumn =
    definition.gm.sheetSummary.lists.find((entry) => entry.list === list.id)?.nameColumn ??
    list.pools?.nameColumn ??
    list.columns.find((column) => column.type === "text")?.id;
  const entries = (Array.isArray(rows) ? rows : []).flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const name = nameColumn ? row[nameColumn] : undefined;
    if (typeof name !== "string" || !name.trim()) return [];
    const place = display?.by ? row[display.by.column] : undefined;
    return [
      {
        key: `${index}`,
        name: name.trim(),
        place: typeof place === "number" && Number.isInteger(place) ? place : undefined,
        marked: display?.mark ? row[display.mark] === true : false,
      },
    ];
  });
  const groups = new Map<number | undefined, typeof entries>();
  for (const entry of entries) groups.set(entry.place, [...(groups.get(entry.place) ?? []), entry]);
  const ordered = [...groups.entries()].sort(([left], [right]) => (left ?? -1) - (right ?? -1));
  return (
    <div className="space-y-1.5">
      <p className={labelClass}>{text(list.label)}</p>
      {entries.length === 0 && <p className="text-[0.6875rem] text-[var(--muted-foreground)]">—</p>}
      {ordered.map(([place, group]) => (
        <div key={place ?? "none"} className="space-y-1">
          {place !== undefined && display?.by && (
            <p className="text-[0.6875rem] font-semibold text-[var(--foreground)]">
              {text(display.by.labels[place] ?? String(place))}
            </p>
          )}
          <ul className="m-0 grid list-none gap-1 p-0 sm:grid-cols-2">
            {group.map((entry) => (
              <li key={entry.key} className={`flex items-center gap-1.5 ${cardClass}`}>
                {display?.mark && (
                  <span
                    className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center"
                    title={entry.marked ? yes : undefined}
                  >
                    {entry.marked && <Check size={12} aria-label={yes} className="text-[var(--primary)]" />}
                  </span>
                )}
                <span className="min-w-0 break-words text-xs text-[var(--foreground)]">{text(entry.name)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * A wound track: its levels as boxes, worst last, each showing its own mark.
 *
 * These systems expect a player to keep their own track, so every box is a button. Clicking an
 * unmarked box marks the track with the chosen kind; clicking a marked one clears one mark. The
 * rules themselves live in `applyRulesetSheetOp`, so a mark placed here lands exactly where the
 * Game Master's own command would put it: in severity order, pushing lighter marks down, or on a
 * track that fills by box, on the box clicked.
 */
function WoundTrack({
  track,
  wound,
  cardName,
  readOnly,
  onMark,
  localizeUi,
}: {
  track: ResolvedRulesetLive["tracks"][number];
  wound: NonNullable<ResolvedRulesetLive["tracks"][number]["wound"]>;
  cardName: string;
  readOnly: boolean;
  onMark: (kind: string, amount: number, box?: number) => void;
  localizeUi: TFunction;
}) {
  const text = useRulesetText();
  const name = text(track.label);
  // The kind a click marks with. The lightest is the default, because that is what most harm is.
  const kinds = [...wound.kinds].sort((a, b) => a.severity - b.severity);
  const [kindId, setKindId] = useState(kinds[0]?.id ?? "");
  const chosen = kinds.find((kind) => kind.id === kindId) ?? kinds[0];
  const markLabel = (id: string | undefined) => text(wound.kinds.find((kind) => kind.id === id)?.label ?? "");
  const levelName = (index: number) =>
    wound.numbered
      ? localizeUi("game.ruleset.sheet.wound.box", { number: index + 1 })
      : text(wound.levels[index]?.label ?? "");
  // The box one heal clears, by the Engine's own rule: the lightest mark, the highest box among
  // equally light ones. On a sequential track that is always the last marked box.
  const severityOf = (id: string | undefined) => wound.kinds.find((kind) => kind.id === id)?.severity;
  let clearing = -1;
  wound.marks.forEach((mark, index) => {
    const severity = severityOf(mark);
    if (severity === undefined) return;
    const current = severityOf(wound.marks[clearing]);
    if (clearing === -1 || current === undefined || severity <= current) clearing = index;
  });
  const full = wound.filled >= wound.levels.length;

  return (
    <div className={`space-y-1.5 ${cardClass}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 flex-1 basis-24 truncate text-xs text-[var(--foreground)]" title={name}>
          {name}
        </span>
        {kinds.length > 1 && (
          <div className="flex shrink-0 flex-wrap gap-1">
            {kinds.map((kind) => (
              <button
                key={kind.id}
                type="button"
                aria-pressed={kind.id === chosen?.id}
                disabled={readOnly}
                onClick={() => setKindId(kind.id)}
                aria-label={localizeUi("game.ruleset.sheet.wound.kindAria", { kind: text(kind.label), name })}
                className={`${chipClass} ${
                  kind.id === chosen?.id
                    ? "border-[var(--primary)] bg-[var(--accent)] text-[var(--foreground)]"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                }`}
              >
                {text(kind.label)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* The two that always mean the same thing, whatever the track looks like: one more of the
          chosen kind (which becomes an overflow once the track is full and cannot take another),
          and one less (which takes an overflow back before it takes a mark off). The boxes below
          are the quick way; these are the way that still works at both ends. */}
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          disabled={readOnly || !chosen || (full && wound.refusesWhenFull)}
          onClick={() => onMark(chosen?.id ?? "", 1)}
          className={chipClass}
        >
          {localizeUi("game.ruleset.sheet.wound.mark")}
        </button>
        <button
          type="button"
          disabled={readOnly || (wound.filled === 0 && wound.overflow === 0)}
          onClick={() => onMark(wound.marks[clearing] || chosen?.id || "", -1)}
          className={chipClass}
        >
          {localizeUi("game.ruleset.sheet.wound.unmark")}
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {wound.levels.map((level, index) => {
          const mark = wound.marks[index];
          // On a sequential track marks are held sorted, so a mark always lands at the end of the run
          // and a clear takes the lightest. On one that fills by box, any clear box takes a mark where
          // it is. Only the boxes a click would really change are offered: a box that looked
          // pressable but moved a DIFFERENT box would be lying about itself.
          const adds = !mark && !!chosen && (wound.indexed || index === wound.filled);
          // While marks have spilled over, a heal takes an overflow first, so no box would change: only
          // Clear one is offered then.
          const clears = !!mark && index === clearing && wound.overflow === 0;
          return (
            <button
              key={`${track.id}-${index}`}
              type="button"
              disabled={readOnly || (!adds && !clears)}
              // A box says what it is, what it costs and what is on it, because a coloured square
              // says none of the three to somebody who cannot see it.
              aria-label={localizeUi("game.ruleset.sheet.wound.levelAria", {
                level: levelName(index),
                penalty: level.penalty,
                state: mark
                  ? localizeUi("game.ruleset.sheet.wound.marked", { kind: markLabel(mark) })
                  : localizeUi("game.ruleset.sheet.wound.clear"),
                name,
                who: cardName,
              })}
              title={localizeUi("game.ruleset.sheet.wound.levelTitle", {
                level: levelName(index),
                penalty: level.penalty,
              })}
              onClick={() =>
                clears ? onMark(mark!, -1) : onMark(chosen?.id ?? "", 1, wound.indexed ? index + 1 : undefined)
              }
              className={`flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg border text-[0.625rem] leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                mark
                  ? "border-[var(--primary)] bg-[var(--accent)] font-semibold text-[var(--foreground)]"
                  : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
              }`}
            >
              <span aria-hidden="true">{mark ? markLabel(mark) : ""}</span>
              <span aria-hidden="true" className="tabular-nums opacity-70">
                {level.penalty}
              </span>
            </button>
          );
        })}
      </div>

      {/* The penalty in force, said once, in words. It is the one on the lowest marked level. */}
      <p role="status" className="text-[0.6875rem] text-[var(--muted-foreground)]">
        {wound.numbered
          ? localizeUi(
              wound.penalty === 0 ? "game.ruleset.sheet.wound.boxesNoPenalty" : "game.ruleset.sheet.wound.penaltyBoxes",
              {
                name,
                filled: wound.filled,
                count: wound.levels.length,
                penalty: wound.penalty,
              },
            )
          : wound.penalty === 0
            ? localizeUi("game.ruleset.sheet.wound.noPenalty", { name })
            : localizeUi("game.ruleset.sheet.wound.penalty", {
                name,
                level: levelName(wound.lowest),
                penalty: wound.penalty,
              })}
        {wound.overflow > 0 ? " " : ""}
        {wound.overflow > 0 ? localizeUi("game.ruleset.sheet.wound.overflow", { count: wound.overflow }) : ""}
      </p>
    </div>
  );
}

export interface GameRulesetSheetProps {
  /** The effective definition: the ruleset with the game's layers already on it. */
  definition: RulesetDefinition;
  /** The layers the game turned on, listed after the ruleset's name. Empty or absent outside a
   *  game, and for a game whose ruleset ships none. */
  layers?: Array<{ id: string; label: string }>;
  /** The pin's own option record, which the build editor's catalog picker filters by. */
  layerOptions?: RulesetLayerOptions;
  /** The party card this sheet belongs to, for accessible names. */
  cardName: string;
  envelope: RulesetSheetEnvelope | undefined;
  live: RulesetLiveState | undefined;
  onLiveChange: (next: RulesetLiveState) => void;
  onEnvelopeSave: (next: RulesetSheetEnvelope) => Promise<void> | void;
  readOnly?: boolean;
  /** The sheet can be edited, but its live state is played elsewhere (the party's shared sheet). */
  buildOnly?: boolean;
  /** A note shown above the editor while a draft is open. */
  draftNotice?: string | null;
  /** A new draft was opened, so a note about an earlier one no longer applies. */
  onDraftStart?: () => void;
  /** What the character holds, which a value reading their items (`itemStat`) shows. */
  items?: ReadonlyArray<RulesetSheetItem>;
  /** Whether what they carry encumbers them, or is past the most they can carry: a chip on the sheet. */
  carrying?: { encumbered: boolean; over: boolean };
  /** A rest taken by the game rather than here: the sheet and what the character carries change
   *  together, and it answers with the rest's own words, or null when it was not taken. */
  onRest?: (
    rest: string,
    diceFrom?: Record<string, number>,
    recover?: Array<{ name: string; recover: RulesetUseRecover[] }>,
  ) => Promise<string | null>;
  /** The features a rest offers to use as it ends (1.789): Arcane Recovery on a Short rest. */
  onRestOffers?: (rest: string) => Promise<RulesetRestRecovery[]>;
}

export function GameRulesetSheet({
  definition,
  layers,
  layerOptions,
  cardName,
  envelope,
  live,
  onLiveChange,
  onEnvelopeSave,
  readOnly: locked = false,
  buildOnly = false,
  draftNotice,
  onDraftStart,
  items,
  carrying,
  onRest,
  onRestOffers,
}: GameRulesetSheetProps) {
  const readOnly = locked || buildOnly;
  // In a fight on screen the sheet is read as it stands: only what play spends (points, slots,
  // wounds) is still moved here, and the rest waits for the fight to end.
  const inFight = useCombatScreenStore((state) => state.round !== null || state.tacticalShowing);
  const settled = readOnly || inFight;
  const { t: localizeUi } = useUiTranslation();
  const text = useSheetRulesetText(definition);
  const [tab, setTab] = useState<string | null>(null);
  const [draft, setDraft] = useState<RulesetSheetEnvelope | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [restNotice, setRestNotice] = useState<string | null>(null);
  // A rest the Engine takes is one at a time: a second click would rest (and roll recharges) again.
  const [resting, setResting] = useState(false);
  // The dice a rest spends to heal first (a Short rest's hit dice), picked pool by pool before it.
  const [restDice, setRestDice] = useState<Record<string, number>>({});
  // What each rest offers to use as it ends (1.789), by rest, and what the player picked of it: on or
  // off, and how many of each spent pool, keyed "rest/feature".
  const [restOffers, setRestOffers] = useState<Record<string, RulesetRestRecovery[]>>({});
  const [restRecover, setRestRecover] = useState<Record<string, { on: boolean; counts: Record<string, number> }>>({});

  const layerNames = layers?.map((layer) => text(layer.label)).join(", ") || null;

  const build = useMemo(() => envelope?.build ?? defaultRulesetSheetBuild(definition), [definition, envelope]);
  const resolved = useMemo(() => readRulesetLive(definition, build, live, items), [definition, build, live, items]);
  // What a use outside a fight called and keeps (1.798): a familiar, until it is dismissed or killed.
  const keptCalls = useMemo(() => rulesetKeptCalls(live), [live]);
  const keptForm = useMemo(() => rulesetKeptForm(live), [live]);
  // Against the live state as it stands, so a value that reads a track or a pool shows what it is now,
  // and against what the character holds, so one that reads their items does too.
  const evaluated = useMemo(
    () => evaluateRulesetSheet(definition, build, items ? { ...resolved, items } : resolved),
    [definition, build, items, resolved],
  );

  // The level a pool's slots are cast at, for one that names its own (5e's pact slots).
  const poolLevels = useMemo(() => rulesetPoolLevels(definition, build, evaluated), [definition, build, evaluated]);

  const checkSources = useMemo(
    () => rulesetCheckSources(definition, build, live, items),
    [definition, build, live, items],
  );
  const hideLines = useMemo(
    () => rulesetHideLines(definition, checkSources, localizeUi),
    [definition, checkSources, localizeUi],
  );
  const tabs = useMemo(
    () => [
      ...new Set(
        definition.sheet.lists.flatMap((list) =>
          list.display?.tab && !isRulesetItemHidden(list, build, definition) ? [list.display.tab] : [],
        ),
      ),
    ],
    [definition, build],
  );
  // A tab whose lists are all hidden now (a class changed) falls back to the Overview.
  const shownTab = tab !== null && tabs.includes(tab) ? tab : null;
  // A track the ruleset shows only once moved (1.378), and a note hidden by the sheet's own values.
  const shownTracks = resolved.tracks.filter(
    (track) =>
      !(
        definition.sheet.live.tracks.find((entry) => entry.id === track.id)?.showWhenSet &&
        track.value === (track.start ?? track.min)
      ),
  );
  const shownText = resolved.text.filter((entry) => {
    const declared = definition.sheet.live.text.find((one) => one.id === entry.id);
    return !declared || !isRulesetTextHidden(declared, build, definition, evaluated.derived);
  });
  // The catalogs this sheet's rows point at, so its attacks are read with what its features do to
  // them, as a fight reads them: Martial Arts's Dexterity on a quarterstaff (laptop class builds
  // 2026-10-24). The same queries the editor and the battle prefetch share.
  const catalogIds = useMemo(() => rulesetCatalogIdsForBuild(definition, build), [definition, build]);
  const combineCatalogs = useCallback(
    (results: readonly { data: RulesetCatalogPayload | undefined }[]): RulesetCatalogEntriesById => {
      const loaded: RulesetCatalogEntriesById = {};
      results.forEach((result, index) => {
        const catalogId = catalogIds[index];
        if (catalogId && result.data) loaded[catalogId] = result.data.entries;
      });
      return loaded;
    },
    [catalogIds],
  );
  const catalogs = useQueries({
    queries: catalogIds.map((catalogId) => rulesetCatalogQuery(definition.id, catalogId, definition.version)),
    combine: combineCatalogs,
  });
  const attacks = useMemo(
    () => rulesetSheetAttacks(definition, build, live, items, catalogs),
    [definition, build, live, items, catalogs],
  );
  const saveModifiers = checkSources.flatMap((source) =>
    rulesetItemEffectFacts(definition, {
      modifiers: source.modifiers?.filter((one) => one.against),
      saves: source.saves ? [...source.saves] : undefined,
    }),
  );

  /** Every change a player makes takes the same route a Game Master command does. */
  const apply = (op: RulesetSheetOp) => {
    if (readOnly) return;
    // What they hold counts, as a Game Master's command's does: an Amulet of Health's hit points.
    const result = applyRulesetSheetOp(definition, build, live, op, undefined, items);
    if (!result.ok) return;
    setRestNotice(op.op === "rest" ? result.now : null);
    onLiveChange(result.live);
  };

  /** Typing a pool value straight in is the same move as spending or restoring the difference, so
   *  it stays sparse: a value back at its default drops out and follows the maximum again. */
  const setPoolValue = (pool: ResolvedRulesetLive["pools"][number], next: number) => {
    const target = Math.min(Math.max(Math.round(next), 0), pool.max);
    if (target === pool.value) return;
    const amount = Math.abs(target - pool.value);
    apply(target > pool.value ? { op: "restore", pool: pool.key, amount } : { op: "spend", pool: pool.key, amount });
  };

  // Every pool a rest may spend dice from to heal first that has any left, in the rests' own order.
  const restDicePools = useMemo(() => {
    const keys = [
      ...new Set(definition.rests.flatMap((rest) => rulesetRestDiceEntries(rest.dice).map((entry) => entry.pool))),
    ];
    return keys.flatMap((key) => {
      const pool = resolved.pools.find((one) => one.key === key);
      return pool && pool.value > 0 ? [pool] : [];
    });
  }, [definition.rests, resolved.pools]);

  // Read again whenever the sheet changes, since a spent slot or a used counter changes the offer.
  const settledForOffers = readOnly || inFight;
  useEffect(() => {
    if (!onRestOffers || settledForOffers || definition.rests.length === 0) return;
    let cancelled = false;
    void Promise.all(
      definition.rests.map((rest) =>
        onRestOffers(rest.id)
          .then((offers) => [rest.id, offers] as const)
          .catch(() => [rest.id, [] as RulesetRestRecovery[]] as const),
      ),
    ).then((pairs) => {
      if (cancelled) return;
      setRestOffers(Object.fromEntries(pairs.filter(([, offers]) => offers.length > 0)));
      setRestRecover((current) => {
        const next: typeof current = {};
        for (const [rest, offers] of pairs) {
          for (const offer of offers) {
            const key = `${rest}/${offer.name}`;
            // A count the player set stays, no more than is spent now; the Engine's pick fills the rest.
            // A new pick joins only while it fits what the feature gives back (`upTo` levels, `count`
            // pools); counts that no longer fit fall back to the Engine's own pick.
            const before = current[key]?.counts ?? {};
            const levelOf = new Map(offer.pools.map((pool) => [pool.key, pool.level]));
            let counts: Record<string, number> = {};
            for (const pool of offer.pools)
              if (before[pool.key] !== undefined) counts[pool.key] = Math.min(before[pool.key]!, pool.spent);
            const levels = (of: Record<string, number>) =>
              Object.entries(of).reduce((sum, [pool, n]) => sum + (levelOf.get(pool) ?? 0) * n, 0);
            const pools = (of: Record<string, number>) => Object.values(of).reduce((sum, n) => sum + n, 0);
            const fits = (of: Record<string, number>) =>
              levels(of) <= offer.upTo && (offer.count === undefined || pools(of) <= offer.count);
            if (!fits(counts)) counts = Object.fromEntries(offer.picks.map((pick) => [pick.pool, pick.count]));
            else
              for (const pick of offer.picks) {
                if (counts[pick.pool] !== undefined) continue;
                for (let n = pick.count; n > 0; n--)
                  if (fits({ ...counts, [pick.pool]: n })) {
                    counts[pick.pool] = n;
                    break;
                  }
              }
            next[key] = { on: current[key]?.on ?? false, counts };
          }
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [onRestOffers, settledForOffers, definition.rests, live]);

  const poolGroups = useMemo(() => {
    const groups: Array<{ id: string; pools: ResolvedRulesetLive["pools"] }> = [];
    for (const pool of resolved.pools) {
      const id = pool.group ?? "";
      const group = groups.find((entry) => entry.id === id);
      if (group) group.pools.push(pool);
      else groups.push({ id, pools: [pool] });
    }
    return groups;
  }, [resolved.pools]);

  const { fields: summaryFields, derived: summaryDerived } = rulesetSheetSummaryShown(definition, build);
  const untrainedTier = definition.resolution.proficiencyTiers[0]?.id;
  const trained = [
    ...definition.sheet.skills.map((skill) => ({
      id: skill.id,
      label: skill.label,
      section: skill.section,
      tier: evaluated.skillTiers[skill.id],
      modifier: evaluated.skillMods[skill.id] ?? 0,
    })),
    ...definition.sheet.saves.map((save) => ({
      id: save.id,
      label: save.label,
      section: save.section,
      tier: evaluated.saveTiers[save.id],
      // What is worn counts as it does on the roll: a Cloak of Protection's +1 to every save. Only a
      // number that always applies; dice, and a bonus against something named, wait for the roll.
      modifier:
        (evaluated.saveMods[save.id] ?? 0) +
        rulesetCheckEffects(checkSources, { type: "save", id: save.id, label: save.label }).modifiers.reduce(
          (sum, { modifier }) =>
            modifier.against || modifier.dice !== undefined || modifier.add !== undefined
              ? sum
              : sum + (modifier.flat ?? 0),
          0,
        ),
    })),
  ].filter((entry) => entry.tier !== undefined && entry.tier !== untrainedTier);

  const startEditing = () => {
    // Labelled with this layout, and never older than the sheet already was. Everything else the
    // envelope carries (the guided builder's choices) goes along, or re-picking would grant twice.
    setDraft({ ...envelope, v: rulesetSheetStamp(definition, envelope), build });
    setRestNotice(null);
    onDraftStart?.();
  };

  const saveDraft = async () => {
    if (!draft || isSaving) return;
    setIsSaving(true);
    try {
      await onEnvelopeSave(draft);
      setDraft(null);
    } catch {
      // The host reports the failure; the draft stays open so nothing typed is lost.
    } finally {
      setIsSaving(false);
    }
  };

  const sheet = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]">
            {localizeUi("game.ruleset.sheet.title")}
          </h3>
          {/* The rules this game runs on, and the variants of them it turned on, so a player
              reading the sheet can tell a Hard winter game from an ordinary one. */}
          <p className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">
            {layerNames
              ? localizeUi("game.ruleset.sheet.nameWithLayers", { name: text(definition.name), layers: layerNames })
              : text(definition.name)}
          </p>
          {/* Past the most they can carry, or encumbered: what the bag does to them, on the sheet too. */}
          {carrying && (carrying.over || carrying.encumbered) && (
            <span
              className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[0.625rem] font-medium ${
                carrying.over
                  ? "bg-[var(--destructive)]/15 text-[var(--destructive)]"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-300"
              }`}
            >
              {localizeUi(carrying.over ? "ui.game.gameinventory.overLimit" : "ui.game.gameinventory.encumbered")}
            </span>
          )}
        </div>
        {!locked && !draft && !inFight && (
          <button
            type="button"
            onClick={startEditing}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[0.6875rem] text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            <Pencil size={12} aria-hidden="true" />
            {localizeUi("game.ruleset.sheet.edit")}
          </button>
        )}
      </div>

      {draft ? (
        <div className="space-y-3">
          {draftNotice && (
            <p
              role="alert"
              className="rounded-lg border border-[var(--marinara-app-accent-static)] bg-[var(--secondary)] p-2 text-[0.6875rem] text-[var(--foreground)]"
            >
              {draftNotice}
            </p>
          )}
          <RulesetSheetEditor
            definition={definition}
            layerOptions={layerOptions}
            envelope={draft}
            onChange={setDraft}
            live={live}
            items={items}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={isSaving}
              className="rounded-lg border border-[var(--border)] bg-[var(--accent)] px-2 py-1 text-[0.6875rem] font-semibold text-[var(--foreground)] disabled:opacity-60"
            >
              {isSaving ? localizeUi("game.ruleset.sheet.saving") : localizeUi("game.ruleset.sheet.save")}
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              disabled={isSaving}
              className="rounded-lg border border-[var(--border)] px-2 py-1 text-[0.6875rem] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] disabled:opacity-60"
            >
              {localizeUi("game.ruleset.sheet.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <>
          {tabs.length > 0 && (
            <div role="tablist" className="flex flex-wrap gap-1.5">
              {[null, ...tabs].map((one) => (
                <button
                  key={one ?? "overview"}
                  type="button"
                  role="tab"
                  aria-selected={shownTab === one}
                  onClick={() => setTab(one)}
                  className={`${chipClass} ${
                    shownTab === one
                      ? "border-[var(--primary)] bg-[var(--accent)] text-[var(--foreground)]"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                  }`}
                >
                  {one === null ? localizeUi("game.ruleset.sheet.overview") : text(one)}
                </button>
              ))}
            </div>
          )}
          {shownTab !== null &&
            definition.sheet.lists
              .filter((list) => list.display?.tab === shownTab && !isRulesetItemHidden(list, build, definition))
              .map((list) => (
                <RulesetSheetListView
                  key={list.id}
                  definition={definition}
                  list={list}
                  rows={rulesetListRowsShown(definition, list.id, build.lists?.[list.id])}
                  yes={localizeUi("game.ruleset.sheet.yes")}
                />
              ))}
          {shownTab === null && (
            <>
              {(summaryFields.length > 0 || summaryDerived.length > 0) && (
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {summaryFields.map((field) => (
                    <div key={field.id} className={`flex min-w-0 flex-col ${cardClass}`}>
                      <span className={`${labelClass} truncate`} title={text(field.label)}>
                        {text(field.label)}
                      </span>
                      <span className="truncate text-xs text-[var(--foreground)]">
                        {summaryFieldValue(
                          field,
                          build,
                          evaluated,
                          localizeUi("game.ruleset.sheet.yes"),
                          localizeUi("game.ruleset.sheet.no"),
                          text,
                        )}
                      </span>
                    </div>
                  ))}
                  {summaryDerived.map((entry) => (
                    <div key={entry.id} className={`flex min-w-0 flex-col ${cardClass}`}>
                      <span className={`${labelClass} truncate`} title={text(entry.label)}>
                        {text(entry.label)}
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-[var(--foreground)]">
                        {signedText(evaluated.derived[entry.id] ?? 0, entry.signed)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Under their section headings where the ruleset gives them some; otherwise one grid, as always. */}
              {rulesetSectionGroups(definition, definition.sheet.abilities).map((group) => (
                <div
                  key={group.section ? `section:${group.section.id}` : "none"}
                  className={group.section ? "space-y-1" : undefined}
                >
                  {group.section && <p className={labelClass}>{text(group.section.label)}</p>}
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                    {group.entries.map((ability) => (
                      <div
                        key={ability.id}
                        className={`flex min-w-0 flex-col items-center ${cardClass}`}
                        title={text(ability.label)}
                      >
                        <span className={`${labelClass} max-w-full truncate`}>
                          {text(ability.short ?? ability.label)}
                        </span>
                        {/* The score a player reads off a printed sheet, and what it adds to a roll. */}
                        <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                          {evaluated.abilityScores[ability.id] ?? ability.default}
                        </span>
                        <span className="text-[0.6875rem] tabular-nums text-[var(--muted-foreground)]">
                          {rulesetCheckValueText(definition, evaluated.abilityMods[ability.id] ?? 0, localizeUi)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {poolGroups.map((group) => (
                <div key={group.id || "ungrouped"} className="space-y-1.5">
                  {group.id && <p className={labelClass}>{text(rulesetPoolGroupLabel(group.id))}</p>}
                  {group.pools.map((pool) => (
                    <div key={pool.key} className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${cardClass}`}>
                      <span
                        className="min-w-0 flex-1 basis-24 truncate text-xs text-[var(--foreground)]"
                        title={text(pool.label)}
                      >
                        {text(pool.label)}
                        {/* What its slots are cast at, where the pool says (laptop builder 2026-10-24:
                            a warlock's pact slots read no level). */}
                        {poolLevels[pool.key] !== undefined && (
                          <span className="ml-1 text-[0.6875rem] text-[var(--muted-foreground)]">
                            {localizeUi("game.ruleset.sheet.poolLevel", { level: poolLevels[pool.key]! })}
                          </span>
                        )}
                      </span>
                      {/* A tally counts the times it was used (1.801): nothing to spend, only read,
                          and its recharge starts it over. */}
                      {pool.tally ? (
                        <span className="shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]">
                          {localizeUi("game.ruleset.sheet.tallyUsed", { count: pool.max - pool.value })}
                        </span>
                      ) : (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => apply({ op: "spend", pool: pool.key, amount: 1 })}
                            disabled={readOnly || pool.value <= 0}
                            aria-label={localizeUi("game.ruleset.sheet.spendAria", {
                              name: text(pool.label),
                              who: cardName,
                            })}
                            className={stepButtonClass}
                          >
                            <Minus size={12} aria-hidden="true" />
                          </button>
                          <DraftNumberInput
                            value={pool.value}
                            onCommit={(next) => setPoolValue(pool, next)}
                            min={0}
                            max={pool.max}
                            integer
                            disabled={readOnly}
                            selectOnFocus
                            ariaLabel={localizeUi("game.ruleset.sheet.valueAria", {
                              name: text(pool.label),
                              who: cardName,
                            })}
                            className={numberInputClass}
                          />
                          <span className="text-xs tabular-nums text-[var(--muted-foreground)]">/{pool.max}</span>
                          <button
                            type="button"
                            onClick={() => apply({ op: "restore", pool: pool.key, amount: 1 })}
                            disabled={readOnly || pool.value >= pool.max}
                            aria-label={localizeUi("game.ruleset.sheet.restoreAria", {
                              name: text(pool.label),
                              who: cardName,
                            })}
                            className={stepButtonClass}
                          >
                            <Plus size={12} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                      {pool.allowTemp && (
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
                            {localizeUi("game.ruleset.sheet.temp")}
                          </span>
                          <DraftNumberInput
                            value={pool.temp}
                            onCommit={(next) =>
                              apply({ op: "temp", pool: pool.key, amount: Math.max(0, Math.round(next)) })
                            }
                            min={0}
                            integer
                            disabled={readOnly}
                            selectOnFocus
                            ariaLabel={localizeUi("game.ruleset.sheet.tempAria", {
                              name: text(pool.label),
                              who: cardName,
                            })}
                            className={numberInputClass}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              {shownTracks.length > 0 && (
                <div className="space-y-1.5">
                  {shownTracks.map((track) =>
                    track.wound ? (
                      <WoundTrack
                        key={track.id}
                        track={track}
                        wound={track.wound}
                        cardName={cardName}
                        readOnly={readOnly}
                        onMark={(kind, amount, box) =>
                          apply({
                            op: "damage",
                            track: track.id,
                            kind,
                            amount,
                            ...(box !== undefined ? { box } : {}),
                          })
                        }
                        localizeUi={localizeUi}
                      />
                    ) : (
                      <div key={track.id} className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${cardClass}`}>
                        <span
                          className="min-w-0 flex-1 basis-24 truncate text-xs text-[var(--foreground)]"
                          title={text(track.label)}
                        >
                          {text(track.label)}
                        </span>
                        <span className="shrink-0 text-[0.6875rem] tabular-nums text-[var(--muted-foreground)]">
                          {localizeUi("game.ruleset.sheet.range", { min: track.min, max: track.max })}
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => apply({ op: "track", track: track.id, by: -1 })}
                            disabled={settled || track.value <= track.min}
                            aria-label={localizeUi("game.ruleset.sheet.trackDownAria", {
                              name: text(track.label),
                              who: cardName,
                            })}
                            className={stepButtonClass}
                          >
                            <Minus size={12} aria-hidden="true" />
                          </button>
                          <span className="min-w-6 text-center text-xs font-semibold tabular-nums text-[var(--foreground)]">
                            {track.value}
                          </span>
                          <button
                            type="button"
                            onClick={() => apply({ op: "track", track: track.id, by: 1 })}
                            disabled={settled || track.value >= track.max}
                            aria-label={localizeUi("game.ruleset.sheet.trackUpAria", {
                              name: text(track.label),
                              who: cardName,
                            })}
                            className={stepButtonClass}
                          >
                            <Plus size={12} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}

              {attacks.length > 0 && (
                <div className="space-y-1">
                  <p className={labelClass}>{localizeUi("game.ruleset.sheet.attacks")}</p>
                  {attacks.map((attack) => (
                    <div key={attack.id} className={`flex flex-wrap items-baseline gap-x-2 ${cardClass}`}>
                      <span className="min-w-0 flex-1 basis-24 break-words text-xs font-semibold text-[var(--foreground)]">
                        {text(attack.label)}
                      </span>
                      {attack.toHit !== undefined && (
                        <span className="shrink-0 text-xs tabular-nums text-[var(--foreground)]">
                          {localizeUi("game.ruleset.sheet.toHit", { value: signedText(attack.toHit, true) })}
                        </span>
                      )}
                      {attack.damage && (
                        <span className="shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]">
                          {attack.damage}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <RulesetSheetConditions
                definition={definition}
                conditions={resolved.conditions}
                editable={!settled}
                cardName={cardName}
                onToggle={(condition, active) => apply({ op: "condition", condition, active })}
              />

              {keptCalls.length > 0 && (
                <div className="space-y-1.5">
                  <p className={labelClass}>{localizeUi("game.ruleset.sheet.keptCalls")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {keptCalls.map((call) => (
                      <span
                        key={call.entry}
                        title={call.entry}
                        className={`${chipClass} inline-flex items-center gap-1 border-[var(--border)] text-[var(--foreground)]`}
                      >
                        {text(call.as || call.entry)}
                        {!settled && !readOnly && (
                          <button
                            type="button"
                            onClick={() => apply({ op: "dismiss", name: call.entry })}
                            aria-label={localizeUi("game.ruleset.sheet.dismissKeptAria", {
                              name: text(call.as || call.entry),
                              who: cardName,
                            })}
                            className="-mr-1 rounded-full p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                          >
                            <X size={10} aria-hidden="true" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {keptForm && (
                <div className="space-y-1.5">
                  <p className={labelClass}>{localizeUi("game.ruleset.sheet.keptForm")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      title={keptForm.entry}
                      className={`${chipClass} inline-flex items-center gap-1 border-[var(--border)] text-[var(--foreground)]`}
                    >
                      {text(keptForm.as)}
                      {!settled && !readOnly && (
                        <button
                          type="button"
                          onClick={() => apply({ op: "dismiss", name: keptForm.entry })}
                          aria-label={localizeUi("game.ruleset.sheet.endKeptFormAria", {
                            name: text(keptForm.as),
                            who: cardName,
                          })}
                          className="-mr-1 rounded-full p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                        >
                          <X size={10} aria-hidden="true" />
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {hideLines.map((line) => (
                <p key={line} className="break-words text-xs text-[var(--muted-foreground)]">
                  {line}
                </p>
              ))}
              {saveModifiers.length > 0 && (
                <div className="space-y-1 text-xs text-[var(--muted-foreground)]">
                  {saveModifiers.map((fact, index) => (
                    <p key={index}>{rulesetEffectPhrase(fact, localizeUi)}</p>
                  ))}
                </div>
              )}
              {checkSources.flatMap((source, index) => {
                const modifiers = source.modifiers?.filter((one) => one.to === "damage");
                // One with nothing it can say (a critical's extra dice, which only a fight reads) is
                // left out rather than shown as its name alone (class pass 2026-10-25).
                const said = modifiers?.length
                  ? rulesetItemEffectFacts(definition, { modifiers })
                      .map((fact) => rulesetEffectPhrase(fact, localizeUi))
                      .filter(Boolean)
                  : [];
                return said.length ? (
                  <p key={`damage-${index}`} className="text-xs text-[var(--muted-foreground)]">
                    {text(source.name)}: {said.join("; ")}
                  </p>
                ) : (
                  []
                );
              })}

              {shownText.length > 0 && (
                <div className="space-y-1.5">
                  {shownText.map((entry) => (
                    <label key={entry.id} className="flex min-w-0 flex-col gap-0.5">
                      <span className={labelClass}>{text(entry.label)}</span>
                      <DraftTextarea
                        value={entry.value}
                        onCommit={(next) => apply({ op: "note", field: entry.id, value: next })}
                        maxLength={entry.maxLength}
                        rows={1}
                        disabled={settled}
                        aria-label={localizeUi("game.ruleset.sheet.noteAria", {
                          name: text(entry.label),
                          who: cardName,
                        })}
                        className="w-full min-w-0 resize-y rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--foreground)]"
                      />
                    </label>
                  ))}
                </div>
              )}

              {resolved.states.length > 0 && (
                <div className="space-y-1.5">
                  {resolved.states.map((state) => (
                    <label key={state.id} className="flex min-w-0 flex-col gap-0.5">
                      <span className={labelClass}>{text(state.label)}</span>
                      <select
                        value={state.value}
                        onChange={(event) => apply({ op: "state", state: state.id, value: event.target.value })}
                        disabled={settled}
                        aria-label={localizeUi("game.ruleset.sheet.stateAria", {
                          name: text(state.label),
                          who: cardName,
                        })}
                        className="w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--foreground)]"
                      >
                        {state.values.map((value) => (
                          <option key={value} value={value}>
                            {text(state.valueLabels?.[value] ?? value)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}

              {definition.rests.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {definition.rests.map((rest) => (
                      <button
                        key={rest.id}
                        type="button"
                        disabled={settled || resting}
                        onClick={() => {
                          if (settled || resting) return;
                          const owns = new Set(rulesetRestDiceEntries(rest.dice).map((entry) => entry.pool));
                          const picked = Object.fromEntries(
                            Object.entries(restDice).filter(([pool, count]) => owns.has(pool) && count > 0),
                          );
                          const diceFrom = Object.keys(picked).length > 0 ? picked : undefined;
                          setRestDice({});
                          if (!onRest) return apply({ op: "rest", rest: rest.id, ...(diceFrom ? { diceFrom } : {}) });
                          // The features ticked for this rest, with the spent pools picked for each.
                          const recover = (restOffers[rest.id] ?? []).flatMap((offer) => {
                            const chosen = restRecover[`${rest.id}/${offer.name}`];
                            const pools = Object.entries(chosen?.counts ?? {})
                              .filter(([, count]) => count > 0)
                              .map(([pool, count]) => ({ pool, count }));
                            return chosen?.on && pools.length > 0 ? [{ name: offer.name, recover: pools }] : [];
                          });
                          setResting(true);
                          void onRest(rest.id, diceFrom, recover.length > 0 ? recover : undefined)
                            .then((now) => {
                              if (now !== null) setRestNotice(now);
                            })
                            .catch(() => undefined)
                            .finally(() => setResting(false));
                        }}
                        aria-label={localizeUi("game.ruleset.sheet.restAria", {
                          name: text(rest.label),
                          who: cardName,
                        })}
                        className={`${chipClass} border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]`}
                      >
                        {text(rest.label)}
                      </button>
                    ))}
                  </div>
                  {restDicePools.length > 0 && !settled && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={labelClass}>{localizeUi("game.ruleset.sheet.restDice")}</span>
                      {restDicePools.map((pool) => (
                        <label key={pool.key} className="flex items-center gap-1 text-[0.6875rem]">
                          <span>{text(pool.label)}</span>
                          <input
                            type="number"
                            min={0}
                            max={pool.value}
                            value={restDice[pool.key] ?? 0}
                            onChange={(event) => {
                              const count = Math.min(
                                Math.max(Math.trunc(Number(event.target.value) || 0), 0),
                                pool.value,
                              );
                              setRestDice((current) => ({ ...current, [pool.key]: count }));
                            }}
                            aria-label={localizeUi("game.ruleset.sheet.restDiceAria", {
                              name: text(pool.label),
                              who: cardName,
                            })}
                            className="w-12 rounded border border-[var(--border)] bg-transparent px-1 py-0.5 text-center"
                          />
                          <span className="text-[var(--muted-foreground)]">/ {pool.value}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {!settled &&
                    definition.rests.flatMap((rest) =>
                      (restOffers[rest.id] ?? []).map((offer) => {
                        const key = `${rest.id}/${offer.name}`;
                        const chosen = restRecover[key] ?? { on: false, counts: {} };
                        const set = (next: Partial<typeof chosen>) =>
                          setRestRecover((current) => ({ ...current, [key]: { ...chosen, ...next } }));
                        return (
                          <div key={key} className="space-y-1 text-[0.6875rem]">
                            <label className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={chosen.on}
                                onChange={(event) => set({ on: event.target.checked })}
                              />
                              <span>
                                {localizeUi("game.ruleset.sheet.restRecover", {
                                  name: text(offer.name),
                                  rest: text(rest.label),
                                  levels: offer.upTo,
                                })}
                              </span>
                            </label>
                            {chosen.on && (
                              <div className="flex flex-wrap items-center gap-2 pl-5">
                                {offer.pools.map((pool) => (
                                  <label key={pool.key} className="flex items-center gap-1">
                                    <span>{text(pool.label)}</span>
                                    <input
                                      type="number"
                                      min={0}
                                      max={pool.spent}
                                      value={chosen.counts[pool.key] ?? 0}
                                      onChange={(event) => {
                                        const count = Math.min(
                                          Math.max(Math.trunc(Number(event.target.value) || 0), 0),
                                          pool.spent,
                                        );
                                        set({ counts: { ...chosen.counts, [pool.key]: count } });
                                      }}
                                      aria-label={localizeUi("game.ruleset.sheet.restRecoverAria", {
                                        name: text(pool.label),
                                        feature: text(offer.name),
                                        who: cardName,
                                      })}
                                      className="w-12 rounded border border-[var(--border)] bg-transparent px-1 py-0.5 text-center"
                                    />
                                    <span className="text-[var(--muted-foreground)]">/ {pool.spent}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }),
                    )}
                  {restNotice && (
                    <p role="status" className="text-[0.6875rem] text-[var(--muted-foreground)]">
                      {restNotice}
                    </p>
                  )}
                </div>
              )}

              {trained.length > 0 && (
                <div className="space-y-1">
                  <p className={labelClass}>{localizeUi("game.ruleset.sheet.trained")}</p>
                  {rulesetSectionGroups(definition, trained).map((group) => (
                    <div
                      key={group.section ? `section:${group.section.id}` : "none"}
                      className="flex flex-wrap items-center gap-1.5"
                    >
                      {group.section && <span className={labelClass}>{text(group.section.label)}</span>}
                      {group.entries.map((entry) => (
                        <span
                          key={`${entry.id}-${entry.label}`}
                          className="rounded-lg border border-[var(--border)] px-1.5 py-0.5 text-[0.6875rem] text-[var(--foreground)]"
                        >
                          {text(entry.label)}{" "}
                          <span className="tabular-nums">
                            {rulesetCheckValueText(definition, entry.modifier, localizeUi)}
                          </span>
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );

  // What the sheet's parts draw (conditions, lists, wound tracks) reads the same words.
  return <RulesetTextContext.Provider value={text}>{sheet}</RulesetTextContext.Provider>;
}

/** The shared sheet sits beside the party portraits. A ruleset that sets the party up through a
 *  guided builder (1.163) lets any player edit it, saved on the revision it was opened at: a save
 *  opened before someone else's landed is refused, the draft stays open, and saving again replaces theirs. */
export function GameRulesetPartySheet({
  definition,
  stored,
  live,
  chatId,
  revision,
  memberBuilds,
}: {
  definition: RulesetDefinition;
  stored: unknown;
  live: RulesetLiveState | undefined;
  chatId?: string | null;
  revision?: number;
  /** The party's characters' builds, which the fields read off them follow. */
  memberBuilds?: readonly RulesetSheetBuild[];
}) {
  const { t: localizeUi } = useUiTranslation();
  const text = useSheetRulesetText(definition);
  const [conflict, setConflict] = useState(false);
  const savePartySheet = useSavePartySheet();
  const party = useMemo(() => rulesetPartyDefinition(definition), [definition]);
  const envelope = useMemo(
    () => readRulesetPartySheet(definition, stored, memberBuilds),
    [definition, stored, memberBuilds],
  );
  if (!party || !definition.party) return null;
  const editable = Boolean(chatId && (definition.party.builder || definition.party.lists?.length));
  const save = async (sheet: RulesetSheetEnvelope) => {
    try {
      await savePartySheet.mutateAsync({ chatId: chatId!, sheet, revision: revision ?? 0 });
      setConflict(false);
    } catch (error) {
      // Theirs is shown as saved; this draft stays open, and saving it again replaces theirs.
      if (stalePartySheet(error)) setConflict(true);
      else toast.error(error instanceof Error ? error.message : localizeUi("game.ruleset.party.saveFailed"));
      throw error;
    }
  };
  return (
    <details className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
      <summary className="cursor-pointer break-words text-xs font-semibold text-[var(--foreground)]">
        {text(definition.party.label)}
      </summary>
      <div className="mt-3 max-h-80 overflow-y-auto">
        {envelope ? (
          <GameRulesetSheet
            definition={party}
            cardName={text(definition.party.label)}
            envelope={envelope}
            live={live}
            readOnly={!editable}
            buildOnly={editable}
            draftNotice={conflict ? localizeUi("game.ruleset.party.conflict") : null}
            onDraftStart={() => setConflict(false)}
            onLiveChange={() => undefined}
            onEnvelopeSave={save}
          />
        ) : (
          <p className="text-xs text-[var(--muted-foreground)]">{localizeUi("game.ruleset.party.unreadable")}</p>
        )}
      </div>
    </details>
  );
}
