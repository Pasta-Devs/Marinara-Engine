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
import { useMemo, useState } from "react";
import { Minus, Pencil, Plus } from "lucide-react";
import type { TFunction } from "i18next";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  applyRulesetSheetOp,
  readResolvedSheetCommandTags,
  createRulesetSheetEnvelope,
  defaultRulesetSheetBuild,
  evaluateRulesetSheet,
  readRulesetLive,
  type EvaluatedRulesetSheet,
  type ResolvedRulesetLive,
  type RulesetDefinition,
  type RulesetField,
  type RulesetLayerOptions,
  type RulesetLiveState,
  type RulesetSheetBuild,
  type RulesetSheetEnvelope,
  type RulesetSheetOp,
} from "@marinara-engine/shared";
import { RulesetSheetEditor } from "../rulesets/RulesetSheetEditor";
import { rulesetCheckValueText } from "../../lib/ruleset-resolution";
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
  "unknown-pool": "game.ruleset.sheet.refusal.unknownPool",
  "ambiguous-pool": "game.ruleset.sheet.refusal.ambiguousPool",
  insufficient: "game.ruleset.sheet.refusal.insufficient",
  "bad-amount": "game.ruleset.sheet.refusal.badAmount",
  "no-temp": "game.ruleset.sheet.refusal.noTemp",
  "unknown-track": "game.ruleset.sheet.refusal.unknownTrack",
  "wrong-track": "game.ruleset.sheet.refusal.wrongTrack",
  "unknown-kind": "game.ruleset.sheet.refusal.unknownKind",
  "unknown-condition": "game.ruleset.sheet.refusal.unknownCondition",
  "unknown-field": "game.ruleset.sheet.refusal.unknownField",
  "unknown-rest": "game.ruleset.sheet.refusal.unknownRest",
  "unknown-entry": "game.ruleset.sheet.refusal.unknownEntry",
  "ambiguous-entry": "game.ruleset.sheet.refusal.ambiguousEntry",
  "bad-pool": "game.ruleset.sheet.refusal.badPool",
  malformed: "game.ruleset.sheet.refusal.malformed",
  "unknown-character": "game.ruleset.sheet.refusal.unknownCharacter",
  "ambiguous-character": "game.ruleset.sheet.refusal.ambiguousCharacter",
  "too-many": "game.ruleset.sheet.refusal.tooMany",
});

/** One line naming every sheet change the Engine refused in a turn, or null when it refused none.
 *  The narration may well claim the spend happened, so the player is told it did not. */
export function describeRefusedSheetCommands(content: string, t: TFunction): string | null {
  const refused = readResolvedSheetCommandTags(content).filter((entry) => !entry.ok);
  if (refused.length === 0) return null;
  const list = refused
    .map((entry) =>
      t("game.ruleset.sheet.refusal.entry", {
        who: entry.who || t("game.ruleset.sheet.refusal.someone"),
        reason: t(SHEET_REFUSAL_KEYS[entry.reason ?? ""] ?? "game.ruleset.sheet.refusal.other"),
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
): string {
  if (field.type === "number") return String(evaluated.numbers[field.id] ?? 0);
  const stored = build.fields?.[field.id];
  const value = stored === undefined ? field.default : stored;
  if (typeof value === "boolean") return value ? yes : no;
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return "";
  return field.type === "enum" ? (field.valueLabels?.[value] ?? value) : value;
}

/**
 * A wound track: its levels as boxes, worst last, each showing its own mark.
 *
 * These systems expect a player to keep their own track, so every box is a button. Clicking an
 * unmarked box marks the track with the chosen kind; clicking a marked one clears one mark. The
 * rules themselves live in `applyRulesetSheetOp`, so a mark placed here lands exactly where the
 * Game Master's own command would put it: in severity order, pushing lighter marks down.
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
  onMark: (kind: string, amount: number) => void;
  localizeUi: TFunction;
}) {
  // The kind a click marks with. The lightest is the default, because that is what most harm is.
  const kinds = [...wound.kinds].sort((a, b) => a.severity - b.severity);
  const [kindId, setKindId] = useState(kinds[0]?.id ?? "");
  const chosen = kinds.find((kind) => kind.id === kindId) ?? kinds[0];
  const markLabel = (id: string | undefined) => wound.kinds.find((kind) => kind.id === id)?.label ?? "";

  return (
    <div className={`space-y-1.5 ${cardClass}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 flex-1 basis-24 truncate text-xs text-[var(--foreground)]" title={track.label}>
          {track.label}
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
                aria-label={localizeUi("game.ruleset.sheet.wound.kindAria", { kind: kind.label, name: track.label })}
                className={`${chipClass} ${
                  kind.id === chosen?.id
                    ? "border-[var(--primary)] bg-[var(--accent)] text-[var(--foreground)]"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                }`}
              >
                {kind.label}
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
          disabled={readOnly || !chosen}
          onClick={() => onMark(chosen?.id ?? "", 1)}
          className={chipClass}
        >
          {localizeUi("game.ruleset.sheet.wound.mark")}
        </button>
        <button
          type="button"
          disabled={readOnly || (wound.marks.length === 0 && wound.overflow === 0)}
          onClick={() => onMark(wound.marks[wound.marks.length - 1] ?? chosen?.id ?? "", -1)}
          className={chipClass}
        >
          {localizeUi("game.ruleset.sheet.wound.unmark")}
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {wound.levels.map((level, index) => {
          const mark = wound.marks[index];
          // Marks are held sorted, so a mark always lands at the end of the run and a clear always
          // takes the last one. Only those two boxes do anything, and only those two are offered:
          // a box that looked pressable but moved a DIFFERENT box would be lying about itself.
          const adds = !mark && index === wound.marks.length && !!chosen;
          const clears = !!mark && index === wound.marks.length - 1;
          return (
            <button
              key={`${track.id}-${index}`}
              type="button"
              disabled={readOnly || (!adds && !clears)}
              // A box says what it is, what it costs and what is on it, because a coloured square
              // says none of the three to somebody who cannot see it.
              aria-label={localizeUi("game.ruleset.sheet.wound.levelAria", {
                level: level.label,
                penalty: level.penalty,
                state: mark
                  ? localizeUi("game.ruleset.sheet.wound.marked", { kind: markLabel(mark) })
                  : localizeUi("game.ruleset.sheet.wound.clear"),
                name: track.label,
                who: cardName,
              })}
              title={localizeUi("game.ruleset.sheet.wound.levelTitle", {
                level: level.label,
                penalty: level.penalty,
              })}
              onClick={() => onMark(clears ? mark! : (chosen?.id ?? ""), clears ? -1 : 1)}
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
        {wound.penalty === 0
          ? localizeUi("game.ruleset.sheet.wound.noPenalty", { name: track.label })
          : localizeUi("game.ruleset.sheet.wound.penalty", {
              name: track.label,
              level: wound.levels[wound.marks.length - 1]?.label ?? "",
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
  readOnly = false,
}: GameRulesetSheetProps) {
  const { t: localizeUi } = useUiTranslation();
  const [draft, setDraft] = useState<RulesetSheetEnvelope | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [restNotice, setRestNotice] = useState<string | null>(null);

  const layerNames = layers?.map((layer) => layer.label).join(", ") || null;

  const build = useMemo(() => envelope?.build ?? defaultRulesetSheetBuild(definition), [definition, envelope]);
  const evaluated = useMemo(() => evaluateRulesetSheet(definition, build), [definition, build]);
  const resolved = useMemo(() => readRulesetLive(definition, build, live), [definition, build, live]);

  /** Every change a player makes takes the same route a Game Master command does. */
  const apply = (op: RulesetSheetOp) => {
    if (readOnly) return;
    const result = applyRulesetSheetOp(definition, build, live, op);
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

  const summary = definition.gm.sheetSummary;
  const summaryFields = definition.sheet.fields.filter((field) => summary.fields.includes(field.id));
  const summaryDerived = definition.sheet.derived.filter((entry) => summary.derived.includes(entry.id));
  const untrainedTier = definition.resolution.proficiencyTiers[0]?.id;
  const trained = [
    ...definition.sheet.skills.map((skill) => ({
      id: skill.id,
      label: skill.label,
      tier: evaluated.skillTiers[skill.id],
      modifier: evaluated.skillMods[skill.id] ?? 0,
    })),
    ...definition.sheet.saves.map((save) => ({
      id: save.id,
      label: save.label,
      tier: evaluated.saveTiers[save.id],
      modifier: evaluated.saveMods[save.id] ?? 0,
    })),
  ].filter((entry) => entry.tier !== undefined && entry.tier !== untrainedTier);

  const startEditing = () => {
    setDraft(createRulesetSheetEnvelope(definition, build));
    setRestNotice(null);
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

  return (
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
              ? localizeUi("game.ruleset.sheet.nameWithLayers", { name: definition.name, layers: layerNames })
              : definition.name}
          </p>
        </div>
        {!readOnly && !draft && (
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
          <RulesetSheetEditor
            definition={definition}
            layerOptions={layerOptions}
            envelope={draft}
            onChange={setDraft}
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
          {poolGroups.map((group) => (
            <div key={group.id || "ungrouped"} className="space-y-1.5">
              {group.id && <p className={labelClass}>{group.id}</p>}
              {group.pools.map((pool) => (
                <div key={pool.key} className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${cardClass}`}>
                  <span
                    className="min-w-0 flex-1 basis-24 truncate text-xs text-[var(--foreground)]"
                    title={pool.label}
                  >
                    {pool.label}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => apply({ op: "spend", pool: pool.key, amount: 1 })}
                      disabled={readOnly || pool.value <= 0}
                      aria-label={localizeUi("game.ruleset.sheet.spendAria", { name: pool.label, who: cardName })}
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
                      ariaLabel={localizeUi("game.ruleset.sheet.valueAria", { name: pool.label, who: cardName })}
                      className={numberInputClass}
                    />
                    <span className="text-xs tabular-nums text-[var(--muted-foreground)]">/{pool.max}</span>
                    <button
                      type="button"
                      onClick={() => apply({ op: "restore", pool: pool.key, amount: 1 })}
                      disabled={readOnly || pool.value >= pool.max}
                      aria-label={localizeUi("game.ruleset.sheet.restoreAria", { name: pool.label, who: cardName })}
                      className={stepButtonClass}
                    >
                      <Plus size={12} aria-hidden="true" />
                    </button>
                  </div>
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
                        ariaLabel={localizeUi("game.ruleset.sheet.tempAria", { name: pool.label, who: cardName })}
                        className={numberInputClass}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}

          {resolved.tracks.length > 0 && (
            <div className="space-y-1.5">
              {resolved.tracks.map((track) =>
                track.wound ? (
                  <WoundTrack
                    key={track.id}
                    track={track}
                    wound={track.wound}
                    cardName={cardName}
                    readOnly={readOnly}
                    onMark={(kind, amount) => apply({ op: "damage", track: track.id, kind, amount })}
                    localizeUi={localizeUi}
                  />
                ) : (
                  <div key={track.id} className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${cardClass}`}>
                    <span
                      className="min-w-0 flex-1 basis-24 truncate text-xs text-[var(--foreground)]"
                      title={track.label}
                    >
                      {track.label}
                    </span>
                    <span className="shrink-0 text-[0.6875rem] tabular-nums text-[var(--muted-foreground)]">
                      {localizeUi("game.ruleset.sheet.range", { min: track.min, max: track.max })}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => apply({ op: "track", track: track.id, by: -1 })}
                        disabled={readOnly || track.value <= track.min}
                        aria-label={localizeUi("game.ruleset.sheet.trackDownAria", {
                          name: track.label,
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
                        disabled={readOnly || track.value >= track.max}
                        aria-label={localizeUi("game.ruleset.sheet.trackUpAria", { name: track.label, who: cardName })}
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

          {resolved.text.length > 0 && (
            <div className="space-y-1.5">
              {resolved.text.map((entry) => (
                <label key={entry.id} className="flex min-w-0 flex-col gap-0.5">
                  <span className={labelClass}>{entry.label}</span>
                  <DraftTextarea
                    value={entry.value}
                    onCommit={(next) => apply({ op: "note", field: entry.id, value: next })}
                    maxLength={entry.maxLength}
                    rows={1}
                    disabled={readOnly}
                    aria-label={localizeUi("game.ruleset.sheet.noteAria", { name: entry.label, who: cardName })}
                    className="w-full min-w-0 resize-y rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--foreground)]"
                  />
                </label>
              ))}
            </div>
          )}

          {resolved.conditions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {resolved.conditions.map((condition) => (
                <button
                  key={condition.id}
                  type="button"
                  aria-pressed={condition.active}
                  disabled={readOnly}
                  onClick={() => apply({ op: "condition", condition: condition.id, active: !condition.active })}
                  className={`${chipClass} ${
                    condition.active
                      ? "border-[var(--primary)] bg-[var(--accent)] text-[var(--foreground)]"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                  }`}
                >
                  {condition.label}
                </button>
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
                    disabled={readOnly}
                    onClick={() => apply({ op: "rest", rest: rest.id })}
                    aria-label={localizeUi("game.ruleset.sheet.restAria", { name: rest.label, who: cardName })}
                    className={`${chipClass} border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]`}
                  >
                    {rest.label}
                  </button>
                ))}
              </div>
              {restNotice && (
                <p role="status" className="text-[0.6875rem] text-[var(--muted-foreground)]">
                  {restNotice}
                </p>
              )}
            </div>
          )}

          {definition.sheet.abilities.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {definition.sheet.abilities.map((ability) => (
                <div
                  key={ability.id}
                  className={`flex min-w-0 flex-col items-center ${cardClass}`}
                  title={ability.label}
                >
                  <span className={`${labelClass} max-w-full truncate`}>{ability.short ?? ability.label}</span>
                  <span className="text-xs font-semibold tabular-nums text-[var(--foreground)]">
                    {rulesetCheckValueText(definition, evaluated.abilityMods[ability.id] ?? 0, localizeUi)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {trained.length > 0 && (
            <div className="space-y-1">
              <p className={labelClass}>{localizeUi("game.ruleset.sheet.trained")}</p>
              <div className="flex flex-wrap gap-1.5">
                {trained.map((entry) => (
                  <span
                    key={`${entry.id}-${entry.label}`}
                    className="rounded-lg border border-[var(--border)] px-1.5 py-0.5 text-[0.6875rem] text-[var(--foreground)]"
                  >
                    {entry.label}{" "}
                    <span className="tabular-nums">
                      {rulesetCheckValueText(definition, entry.modifier, localizeUi)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {(summaryFields.length > 0 || summaryDerived.length > 0) && (
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {summaryFields.map((field) => (
                <div key={field.id} className={`flex min-w-0 flex-col ${cardClass}`}>
                  <span className={`${labelClass} truncate`}>{field.label}</span>
                  <span className="truncate text-xs text-[var(--foreground)]">
                    {summaryFieldValue(
                      field,
                      build,
                      evaluated,
                      localizeUi("game.ruleset.sheet.yes"),
                      localizeUi("game.ruleset.sheet.no"),
                    )}
                  </span>
                </div>
              ))}
              {summaryDerived.map((entry) => (
                <div key={entry.id} className={`flex min-w-0 flex-col ${cardClass}`}>
                  <span className={`${labelClass} truncate`}>{entry.label}</span>
                  <span className="text-xs font-semibold tabular-nums text-[var(--foreground)]">
                    {evaluated.derived[entry.id] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
