// ──────────────────────────────────────────────
// Game Mode rulesets: layers
//
// A layer is a variant the ruleset ships inside its own file (Low magic, Hard winter). The player
// turns layers on when the game is created, the choice is frozen into the pin's `options` record,
// and the server applies them in one place, so the prompt, the resolver, the sheet editor and the
// battle bridge all see the effective rules with no change of their own.
//
// Everything here is pure and nothing throws. A game must never lose its ruleset to a layer, so a
// layer whose result the Engine could not read is skipped and the rest of the game goes on.
// ──────────────────────────────────────────────
import {
  rulesetEffectiveDefinitionSchema,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetDifficultyLadderStep,
  type RulesetEnumField,
  type RulesetField,
  type RulesetLayer,
  type RulesetLayerCatalogHide,
  type RulesetRef,
} from "../../schemas/ruleset.schema.js";

/** The pin's `options` record, which is also where a later slice's own keys would live. */
export type RulesetLayerOptions = RulesetRef["options"];

/** Only `layers` is read, so a caller with a listed definition (catalog entries stripped) or with
 *  the base definition beside the effective one can pass either. */
type LayeredRuleset = Pick<RulesetDefinition, "layers">;

const LAYER_OPTION_PREFIX = "layer.";

/** The key a layer's toggle writes into the pin. Everything else in `options` belongs to somebody
 *  else and is carried through untouched. */
export function rulesetLayerOptionKey(layerId: string): string {
  return `${LAYER_OPTION_PREFIX}${layerId}`;
}

/** The layers a pin turns on, in the order the ruleset DECLARES them, which is the order their
 *  guidance is appended in and the order the later of two conflicting layers is decided by. An
 *  option key naming a layer the file does not have is ignored: a hand-edited pin, or a layer a
 *  later version dropped, must not cost the game its rules. */
export function activeRulesetLayers(
  definition: LayeredRuleset,
  options: RulesetLayerOptions | null | undefined,
): RulesetLayer[] {
  const declared = definition.layers ?? [];
  if (declared.length === 0 || !options) return [];
  const kept: RulesetLayer[] = [];
  for (const layer of declared) {
    if (options[rulesetLayerOptionKey(layer.id)] !== true) continue;
    // Conflicts read both ways: naming one side of the pair is enough, and the LATER layer is the
    // one that goes, so the same two choices always produce the same rules.
    if (kept.some((earlier) => conflict(earlier, layer))) continue;
    kept.push(layer);
  }
  return kept;
}

function conflict(one: RulesetLayer, other: RulesetLayer): boolean {
  return (one.conflicts ?? []).includes(other.id) || (other.conflicts ?? []).includes(one.id);
}

/** Why a code answers a layer selection. `/game/create` sends the first one back as a 400, so the
 *  player is told which toggle the ruleset cannot honour instead of starting a game without it. */
export type RulesetLayerSelectionIssue = {
  code: "ruleset_layer_unknown" | "ruleset_layer_conflict";
  message: string;
};

/** What is wrong with a selection a client sent. Empty means the pin may keep it as it stands.
 *  Resolution is deliberately more forgiving than this: a pin that is already in a chat is applied
 *  as far as it can be, while a NEW game refuses rather than quietly dropping a choice. */
export function rulesetLayerSelectionIssues(
  definition: LayeredRuleset,
  options: RulesetLayerOptions | null | undefined,
): RulesetLayerSelectionIssue[] {
  const declared = definition.layers ?? [];
  const byId = new Map(declared.map((layer) => [layer.id, layer]));
  const issues: RulesetLayerSelectionIssue[] = [];
  for (const [key, value] of Object.entries(options ?? {})) {
    if (value !== true || !key.startsWith(LAYER_OPTION_PREFIX)) continue;
    const id = key.slice(LAYER_OPTION_PREFIX.length);
    if (!byId.has(id)) {
      issues.push({ code: "ruleset_layer_unknown", message: `This ruleset has no layer "${id}".` });
    }
  }
  const selected = declared.filter((layer) => options?.[rulesetLayerOptionKey(layer.id)] === true);
  selected.forEach((layer, index) => {
    for (const earlier of selected.slice(0, index)) {
      if (conflict(earlier, layer)) {
        issues.push({
          code: "ruleset_layer_conflict",
          message: `"${earlier.label}" and "${layer.label}" cannot be turned on together.`,
        });
      }
    }
  });
  return issues;
}

/** The ruleset a game on this pin actually plays by. The SAME reference comes back when no layer
 *  is on, so a game without layers is byte for byte the game it was, and nothing downstream has to
 *  know layers exist.
 *
 *  The result is re-validated with the ruleset's own rules (relaxed only where a merged string is
 *  longer than one file may declare). A combination that would not validate falls back to applying
 *  the layers one at a time and keeping the ones that do, so a broken layer costs the game that
 *  layer and never its rules. */
export function applyRulesetLayers(
  definition: RulesetDefinition,
  options: RulesetLayerOptions | null | undefined,
): RulesetDefinition {
  return resolveRulesetLayers(definition, options).definition;
}

/** What a pin's layers came to: the ruleset the game plays by, the layers that are REALLY on it, and
 *  the option record that names exactly those. */
export interface ResolvedRulesetLayers {
  definition: RulesetDefinition;
  /** In declaration order. A chosen layer that lost a conflict, or that would not validate with the
   *  ones before it, is not here. */
  applied: RulesetLayer[];
  /** `layer.<id>: true` for the applied layers only. Whatever shows a layer's name or hides what a
   *  layer hides reads THIS, so a layer whose rules were skipped never shows up half applied. */
  options: RulesetLayerOptions;
}

/** `applyRulesetLayers` with its working shown. Same rules, same fallback, same reference when no
 *  layer is on. */
export function resolveRulesetLayers(
  definition: RulesetDefinition,
  options: RulesetLayerOptions | null | undefined,
): ResolvedRulesetLayers {
  const active = activeRulesetLayers(definition, options);
  if (active.length === 0) return { definition, applied: [], options: {} };
  const asOptions = (layers: readonly RulesetLayer[]): RulesetLayerOptions =>
    Object.fromEntries(layers.map((layer) => [rulesetLayerOptionKey(layer.id), true]));
  const together = validated(layered(definition, active));
  if (together) return { definition: together, applied: [...active], options: asOptions(active) };
  let result = definition;
  const applied: RulesetLayer[] = [];
  for (const layer of active) {
    const candidate = validated(layered(definition, [...applied, layer]));
    if (!candidate) continue;
    applied.push(layer);
    result = candidate;
  }
  return { definition: result, applied, options: asOptions(applied) };
}

/** A catalog as the ruleset LISTING sends it to a client: the inline entries are left out (they are
 *  asked for on their own) and a count stands in for them. The file schema rightly refuses that
 *  shape, and a layer never touches a catalog's entries, so such a catalog is checked with an empty
 *  entry list and handed back exactly as it came. The file schema itself is not loosened. */
function validated(candidate: RulesetDefinition): RulesetDefinition | null {
  const catalogs = candidate.catalogs as ReadonlyArray<Record<string, unknown>> | undefined;
  const listed = (catalogs ?? []).some(
    (catalog) => "entryCount" in catalog || (catalog.entries === undefined && catalog.asset === undefined),
  );
  const subject = listed
    ? {
        ...candidate,
        catalogs: catalogs!.map((catalog) => {
          const { entryCount: _entryCount, ...rest } = catalog;
          return rest.entries === undefined && rest.asset === undefined ? { ...rest, entries: [] } : rest;
        }),
      }
    : candidate;
  const parsed = rulesetEffectiveDefinitionSchema.safeParse(subject);
  if (!parsed.success) return null;
  const checked = parsed.data as RulesetDefinition;
  return listed ? { ...checked, catalogs: candidate.catalogs } : checked;
}

/** The base definition with these layers' effects on it, before validation. */
function layered(definition: RulesetDefinition, layers: readonly RulesetLayer[]): RulesetDefinition {
  const checkGuidance =
    appended(
      definition.gm.checkGuidance,
      layers.map((layer) => layer.gm?.guidance),
    ) ?? definition.gm.checkGuidance;
  const worldGuidance = appended(
    definition.gm.worldGuidance,
    layers.map((layer) => layer.gm?.worldGuidance),
  );
  return {
    ...definition,
    resolution: withLadder(definition.resolution, layers),
    sheet: { ...definition.sheet, fields: narrowedFields(definition.sheet.fields, layers) },
    gm: {
      ...definition.gm,
      checkGuidance,
      ...(worldGuidance === undefined ? {} : { worldGuidance }),
    },
  };
}

/** The base text and every layer's, in the order they were applied. Joined with a space rather
 *  than a blank line: guidance is one line by the format's own rule, and the Game Master reminder
 *  renders `checkGuidance` inside a single bullet, where a line break would read as a new
 *  instruction. */
function appended(base: string | undefined, additions: readonly (string | undefined)[]): string | undefined {
  const parts = [base, ...additions]
    .map((part) => part?.trim())
    .filter((part): part is string => part !== undefined && part.length > 0);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

/** The ladder of the LAST active layer that declares one, in the base kind's own shape. A ladder
 *  of the other kind is refused at import, so one that reaches here is left unapplied rather than
 *  part-applied. */
function withLadder(
  resolution: RulesetDefinition["resolution"],
  layers: readonly RulesetLayer[],
): RulesetDefinition["resolution"] {
  let result = resolution;
  for (const layer of layers) {
    const ladder: readonly RulesetDifficultyLadderStep[] | undefined = layer.difficultyLadder;
    if (!ladder) continue;
    if (result.kind === "dice-sum") {
      const steps = ladder.filter((step) => "dc" in step);
      if (steps.length === ladder.length && steps.length > 0) result = { ...result, difficultyLadder: steps };
    } else {
      const steps = ladder.filter((step) => "successes" in step);
      if (steps.length === ladder.length && steps.length > 0) result = { ...result, difficultyLadder: steps };
    }
  }
  return result;
}

/** Enum fields with the layers' values taken out, their labels for those values dropped, and the
 *  default replaced where a layer says so. Every other field comes back as it was. */
function narrowedFields(fields: readonly RulesetField[], layers: readonly RulesetLayer[]): RulesetField[] {
  const narrowing = new Map<string, { remove: Set<string>; fallback?: string }>();
  for (const layer of layers) {
    for (const entry of layer.fields ?? []) {
      const narrow = narrowing.get(entry.id) ?? { remove: new Set<string>() };
      for (const value of entry.removeValues) narrow.remove.add(value);
      if (entry.default !== undefined) narrow.fallback = entry.default;
      narrowing.set(entry.id, narrow);
    }
  }
  if (narrowing.size === 0) return [...fields];
  return fields.map((field) => {
    if (field.type !== "enum") return field;
    const narrow = narrowing.get(field.id);
    if (!narrow) return field;
    const values = field.values.filter((value) => !narrow.remove.has(value));
    const next: RulesetEnumField = {
      ...field,
      values,
      ...(field.valueLabels
        ? {
            valueLabels: Object.fromEntries(
              Object.entries(field.valueLabels).filter(([value]) => !narrow.remove.has(value)),
            ),
          }
        : {}),
    };
    const fallback = narrow.fallback ?? field.default;
    // The schema refuses a layer that removes a field's default without naming a surviving one, so
    // the second branch only ever guards a definition nobody validated.
    if (fallback !== undefined && values.includes(fallback)) next.default = fallback;
    else delete next.default;
    return next;
  });
}

/** Whether the catalog picker leaves this entry out under the game's layers. The picker filters
 *  what it shows; the ruleset's own entries are never rewritten, so a sheet that already holds a
 *  hidden row keeps it and a layer turned off brings the entry straight back. */
export function catalogEntryHiddenByLayers(
  definition: LayeredRuleset,
  options: RulesetLayerOptions | null | undefined,
  catalogId: string,
  entry: Pick<RulesetCatalogEntry, "filters">,
): boolean {
  for (const layer of activeRulesetLayers(definition, options)) {
    for (const rule of layer.catalogs ?? []) {
      if (rule.id === catalogId && hides(rule.hide, entry.filters?.[rule.hide.filter])) return true;
    }
  }
  return false;
}

/** Whether one rule hides an entry. An entry that does not declare the filter is never hidden: the
 *  layer said nothing about it, and guessing would take away entries the author meant to keep. */
function hides(hide: RulesetLayerCatalogHide, value: number | string | string[] | undefined): boolean {
  if (value === undefined) return false;
  if (hide.above !== undefined) return typeof value === "number" && value > hide.above;
  if (hide.below !== undefined) return typeof value === "number" && value < hide.below;
  // A `tags` filter holds a list and a `text` filter one word; one matching word is a match, which
  // is how the picker itself reads them.
  const words = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  if (words.length === 0) return false;
  if (hide.equals !== undefined) return words.includes(hide.equals);
  const notIn = hide.notIn;
  return notIn !== undefined && !words.some((word) => notIn.includes(word));
}
