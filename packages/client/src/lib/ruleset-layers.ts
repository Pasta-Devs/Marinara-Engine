// The setup wizard's half of ruleset layers: which toggles are drawn, which one a checked layer
// rules out, and how the checked ids become the `options` record the pin is frozen from.
//
// None of it needs React, so the client-lane regression checks it directly. The rules themselves
// live in the shared helpers: the order layers apply in, and which of a conflicting pair goes, are
// decided once there and read here, so the wizard can never offer a combination the server would
// resolve differently.
import {
  activeRulesetLayers,
  rulesetLayerOptionKey,
  type RulesetDefinition,
  type RulesetLayer,
  type RulesetLayerOptions,
} from "@marinara-engine/shared";

/** Only `layers` is read, so the chooser can pass a listed definition as well as a full one. */
type LayeredRuleset = Pick<RulesetDefinition, "layers">;

export type RulesetLayerChoice = {
  layer: RulesetLayer;
  checked: boolean;
  /** The checked layer that rules this one out, or null when it can be turned on. A layer that is
   *  itself checked is never blocked: turning it off is always allowed. */
  blockedBy: RulesetLayer | null;
};

function conflict(one: RulesetLayer, other: RulesetLayer): boolean {
  return (one.conflicts ?? []).includes(other.id) || (other.conflicts ?? []).includes(one.id);
}

/** One row per declared layer, in the order the ruleset declares them, which is the order their
 *  effects apply in. */
export function rulesetLayerChoices(definition: LayeredRuleset, checked: readonly string[]): RulesetLayerChoice[] {
  const declared = definition.layers ?? [];
  const picked = new Set(checked);
  return declared.map((layer) => ({
    layer,
    checked: picked.has(layer.id),
    blockedBy: picked.has(layer.id)
      ? null
      : (declared.find((other) => picked.has(other.id) && conflict(other, layer)) ?? null),
  }));
}

/** The checked ids after this toggle, kept in declaration order. Turning one off always works.
 *  Turning one on that a checked layer rules out changes nothing: the chooser disables that box,
 *  and a click that reaches here anyway must not produce a selection the server would refuse. */
export function toggleRulesetLayer(definition: LayeredRuleset, checked: readonly string[], layerId: string): string[] {
  const choice = rulesetLayerChoices(definition, checked).find((entry) => entry.layer.id === layerId);
  if (!choice) return [...checked];
  if (choice.checked) return checked.filter((id) => id !== layerId);
  if (choice.blockedBy) return [...checked];
  const wanted = new Set([...checked, layerId]);
  return (definition.layers ?? []).filter((layer) => wanted.has(layer.id)).map((layer) => layer.id);
}

/** The `options` record the create call sends: only the checked layers, each as `true`. A ruleset
 *  with nothing checked sends the empty record it sent before layers existed. */
export function rulesetLayerOptions(checked: readonly string[]): RulesetLayerOptions {
  const options: RulesetLayerOptions = {};
  for (const id of checked) options[rulesetLayerOptionKey(id)] = true;
  return options;
}

/** The checked ids a saved or shared setup file restores to. An id this definition no longer has is
 *  dropped, and so is the later of a conflicting pair, because that is what the shared resolver
 *  would do with the same record. */
export function restoredRulesetLayers(
  definition: LayeredRuleset,
  options: RulesetLayerOptions | null | undefined,
): string[] {
  return activeRulesetLayers(definition, options).map((layer) => layer.id);
}
