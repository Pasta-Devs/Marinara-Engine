// The ruleset a game pinned at creation, resolved against what is installed here.
//
// The match is the server's (`resolveGameRuleset`): same id AND same supplying package, and an
// installed definition at least as new as the pin. An id another package now claims is another
// ruleset, and resolving to it would silently change the game's arithmetic — which is the one
// thing the pin exists to prevent. A game with no pin resolves to nothing at all, so it keeps
// today's behaviour byte for byte.
//
// An IMPORTED ruleset keeps every version it was imported at, and the server resolves the exact
// one the game pinned. The installed list only carries the newest, so when the pin names an older
// stored version that definition is fetched on its own: the sheet on screen has to be the one the
// server does its arithmetic with.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  resolveRulesetLayers,
  rulesetRefSchema,
  type InstalledRuleset,
  type RulesetDefinition,
  type RulesetRef,
} from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { capabilityPackageKeys, useInstalledRulesets } from "./use-capability-packages";

export type ResolvedGameRulesetClient =
  | { status: "none" }
  | { status: "loading"; ref: RulesetRef }
  | {
      status: "ok";
      ref: RulesetRef;
      /** The rules this game actually plays by: the installed definition with the pin's layers on
       *  it. Every reader wants this one, which is why it keeps the plain name. */
      definition: RulesetDefinition;
      /** The definition as the package ships it, before any layer. */
      baseDefinition: RulesetDefinition;
      /** The layers the pin turned on, in the order they applied, for naming them on screen. */
      layers: Array<{ id: string; label: string }>;
      /** The option record of the APPLIED layers only. The catalog picker hides entries by this,
       *  never by the pin's own record, so a skipped layer hides nothing. */
      layerOptions: RulesetRef["options"];
    }
  /** The pin cannot be honoured here: unreadable, not installed, another package's, or older. */
  | { status: "unavailable"; ref: RulesetRef | null };

/** Resolve `chat.metadata.gameRuleset`. The installed list is only queried when a pin exists. */
export function useGameRuleset(chatMeta: Record<string, unknown> | null | undefined): ResolvedGameRulesetClient {
  const pin = chatMeta?.gameRuleset;
  const hasPin = pin !== undefined && pin !== null;
  const ref = useMemo(() => {
    if (!hasPin) return null;
    const parsed = rulesetRefSchema.safeParse(pin);
    return parsed.success ? parsed.data : null;
  }, [hasPin, pin]);

  const installed = useInstalledRulesets(hasPin);
  const rulesets = installed.data;
  const isSuccess = installed.isSuccess;
  const isError = installed.isError;

  const match = ref
    ? (rulesets ?? []).find((entry) => entry.definition.id === ref.id && entry.packageId === ref.packageId)
    : undefined;
  // Only an imported ruleset lists `versions`. The newest one is already in hand; any other stored
  // version is asked for, and a version that is not stored is simply unavailable.
  const needsExactVersion = Boolean(
    ref && match?.versions && match.definition.version !== ref.version && match.versions.includes(ref.version),
  );
  const exact = useQuery({
    queryKey: [...capabilityPackageKeys.rulesets(), "version", ref?.id, ref?.version],
    queryFn: () =>
      api.get<InstalledRuleset>(
        `/capability-packages/rulesets/version?rulesetId=${encodeURIComponent(ref!.id)}&version=${ref!.version}`,
      ),
    enabled: needsExactVersion,
  });
  const exactDefinition = exact.data?.definition;
  const exactFailed = exact.isError;

  return useMemo<ResolvedGameRulesetClient>(() => {
    // The server resolves the pin the same way, in `resolveGameRuleset`: the layers the game chose
    // are applied once, here, so the in-game sheet, the battle bridge and the sheet editor all read
    // the rules the Game Master is playing by. `applyRulesetLayers` hands back the SAME object when
    // no layer is on, and this memo is the only thing that builds it, so the reference downstream
    // memos key on is stable as long as neither the definition nor the pin moves.
    const resolved = (definition: RulesetDefinition): ResolvedGameRulesetClient => {
      const layered = resolveRulesetLayers(definition, ref!.options);
      return {
        status: "ok",
        ref: ref!,
        definition: layered.definition,
        baseDefinition: definition,
        // Only the layers whose rules are really on: a layer that was skipped shows no name and
        // hides nothing in the picker.
        layers: layered.applied.map((layer) => ({ id: layer.id, label: layer.label })),
        layerOptions: layered.options,
      };
    };
    if (!hasPin) return { status: "none" };
    if (!ref) return { status: "unavailable", ref: null };
    // A failed lookup says nothing about what is installed, but the consequence for this game is
    // the same one `unavailable` describes: nothing here can read the ruleset, so the sheet stays
    // read-only rather than pretending the game has no rules.
    if (isError) return { status: "unavailable", ref };
    if (!isSuccess) return { status: "loading", ref };
    if (!match) return { status: "unavailable", ref };
    if (match.versions) {
      // Imported: the exact pinned version or nothing, like the server.
      if (match.definition.version === ref.version) return resolved(match.definition);
      if (!match.versions.includes(ref.version) || exactFailed) return { status: "unavailable", ref };
      return exactDefinition ? resolved(exactDefinition) : { status: "loading", ref };
    }
    // A NEWER installed package definition is fine — sheets are read tolerantly against the current
    // schema. An OLDER one is not: the game may depend on something it does not declare.
    if (match.definition.version < ref.version) return { status: "unavailable", ref };
    return resolved(match.definition);
  }, [exactDefinition, exactFailed, hasPin, isError, isSuccess, match, ref]);
}
