// ──────────────────────────────────────────────
// Game: ruleset registry
//
// Reads every installed package's `ruleset.json` plus every community ruleset the user imported,
// validates them as data, and resolves the ruleset a game pinned at creation
// (`chat.metadata.gameRuleset`). No pin means `engine-legacy`: today's behaviour, untouched. A pin
// this install cannot honour is reported, never reinterpreted — the game's arithmetic must not
// change silently because a package went away or is older than the pin.
//
// Official rulesets are keyed by their bare id and community ones by their NAMESPACED id, so an
// import can never shadow a package's ruleset and two authors' `v20` are two entries. The import
// policy is not consulted here: turning imports off hides community rulesets from NEW games (see
// the `/create` handler), and must never break a game that already pinned one.
// ──────────────────────────────────────────────
import {
  activeRulesetLayers,
  resolveRulesetLayers,
  isCommunityRulesetId,
  parseRulesetDefinition,
  rulesetLayerOptionKey,
  rulesetRefSchema,
  RULESET_MAX_BYTES,
  type CommunityRulesetSource,
  type RulesetDefinition,
  type RulesetRef,
} from "@marinara-engine/shared";
import { getDB, type DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createGameRulesetsStorage } from "../storage/game-rulesets.storage.js";
import { capabilityPackageManager } from "../capability-packages/package-manager.service.js";

export type RulesetSource = { packageId: string | null; data: Buffer | string };
/** One stored community version, as `game_rulesets` holds it. */
export type CommunityRulesetRow = {
  rulesetId: string;
  version: number;
  sourceKind: CommunityRulesetSource["kind"];
  sourceUrl: string | null;
  definition: string;
};
export type RegisteredRuleset = {
  /** For a community entry this is the HIGHEST stored version. */
  definition: RulesetDefinition;
  packageId: string | null;
  /** Community only: where the file came from. Absent on an official package's ruleset. */
  source?: CommunityRulesetSource;
  /** Community only: every stored version, because a game pins an exact one. */
  versions?: ReadonlyMap<number, RulesetDefinition>;
};
export type RulesetRegistry = ReadonlyMap<string, RegisteredRuleset>;

type RegistryLog = (message: string) => void;

/** Re-key a community definition under its namespaced id. The rest of the Engine and the client key
 *  sheets, pins and wizard choices by `definition.id`, so the id the file carries (always bare)
 *  would collide with an official ruleset's the moment it left this function. */
function namespaceDefinition(definition: RulesetDefinition, rulesetId: string): RulesetDefinition {
  return { ...definition, id: rulesetId };
}

/** Build the registry from raw sources. Pure apart from `log`, and never throws: a source the
 *  Engine cannot use is dropped with one line saying why. Sources are taken in package-id order so
 *  which of two packages claiming one id wins does not depend on install order. Community rows are
 *  a separate input so the whole merge stays testable without a database. */
export function buildRulesetRegistry(
  sources: readonly RulesetSource[],
  log: RegistryLog,
  community: readonly CommunityRulesetRow[] = [],
): RulesetRegistry {
  const registry = new Map<string, RegisteredRuleset>();
  // Code-point order, not localeCompare: the winner must not depend on the host's locale either.
  // A source with no package sorts last, so it can never take an id from an installed package.
  const ordered = [...sources].sort((a, b) => {
    if ((a.packageId === null) !== (b.packageId === null)) return a.packageId === null ? 1 : -1;
    const left = a.packageId ?? "";
    const right = b.packageId ?? "";
    return left < right ? -1 : left > right ? 1 : 0;
  });
  for (const source of ordered) {
    const owner = source.packageId ?? "(no package)";
    const bytes = typeof source.data === "string" ? Buffer.byteLength(source.data) : source.data.byteLength;
    if (bytes > RULESET_MAX_BYTES) {
      log(`Ruleset from ${owner} is ${bytes} bytes, over the ${RULESET_MAX_BYTES}-byte ceiling; dropped`);
      continue;
    }
    let json: unknown;
    try {
      json = JSON.parse(typeof source.data === "string" ? source.data : source.data.toString("utf8"));
    } catch {
      log(`Ruleset from ${owner} is not valid JSON; dropped`);
      continue;
    }
    const parsed = parseRulesetDefinition(json);
    if (!parsed.ok) {
      log(`Ruleset from ${owner} is not usable; dropped (${parsed.issues.slice(0, 5).join("; ")})`);
      continue;
    }
    const existing = registry.get(parsed.definition.id);
    if (existing) {
      log(
        `Ruleset id "${parsed.definition.id}" from ${owner} is already provided by ${existing.packageId ?? "(no package)"}; dropped`,
      );
      continue;
    }
    registry.set(parsed.definition.id, { definition: parsed.definition, packageId: source.packageId });
  }

  // Community versions, grouped by namespaced id. A stored row the CURRENT schema no longer accepts
  // (the format tightened since it was imported) is skipped with one line, exactly like a package
  // source: the other versions of that ruleset stay usable.
  const byId = new Map<string, Map<number, { definition: RulesetDefinition; row: CommunityRulesetRow }>>();
  for (const row of community) {
    if (!isCommunityRulesetId(row.rulesetId)) {
      log(`Stored ruleset "${row.rulesetId}" is not namespaced and cannot shadow an official id; dropped`);
      continue;
    }
    let json: unknown;
    try {
      json = JSON.parse(row.definition);
    } catch {
      log(`Stored ruleset "${row.rulesetId}" version ${row.version} is not valid JSON; dropped`);
      continue;
    }
    const parsed = parseRulesetDefinition(json);
    if (!parsed.ok) {
      log(
        `Stored ruleset "${row.rulesetId}" version ${row.version} is no longer usable; dropped (${parsed.issues
          .slice(0, 5)
          .join("; ")})`,
      );
      continue;
    }
    const versions = byId.get(row.rulesetId) ?? new Map();
    versions.set(row.version, { definition: namespaceDefinition(parsed.definition, row.rulesetId), row });
    byId.set(row.rulesetId, versions);
  }
  for (const [rulesetId, versions] of byId) {
    const latest = [...versions.keys()].reduce((highest, version) => Math.max(highest, version));
    const newest = versions.get(latest)!;
    registry.set(rulesetId, {
      definition: newest.definition,
      packageId: null,
      source: { kind: newest.row.sourceKind, url: newest.row.sourceUrl },
      versions: new Map([...versions].map(([version, entry]) => [version, entry.definition])),
    });
  }
  return registry;
}

export type ResolvedGameRuleset =
  | { status: "legacy" }
  | {
      status: "ok";
      ref: RulesetRef;
      /** The rules this game actually plays by: the registered definition with the layers the pin
       *  turned on. Every caller reads this, so the prompt, the resolver, the sheet block, the
       *  editor and the battle bridge all see the layered ruleset with no change of their own. */
      definition: RulesetDefinition;
      /** The ruleset as its author shipped it, for the rare caller that wants the unlayered file. */
      baseDefinition: RulesetDefinition;
      /** The active layers, in declaration order, for a UI that names what this game turned on. */
      layers: { id: string; label: string }[];
      packageId: string | null;
    }
  | {
      status: "unavailable";
      /** `unreadable-pin`: the stored pin is malformed. `missing`: nothing installed provides the id.
       *  `different-package`: the id is provided, but not by the package the game pinned.
       *  `older-installed`: the game was created on a newer version than the one installed.
       *  `version-missing`: a community ruleset is here, but not the exact version the game pinned. */
      reason: "unreadable-pin" | "missing" | "different-package" | "older-installed" | "version-missing";
      ref: RulesetRef | null;
      installedVersion: number | null;
    };

/** The effective ruleset for a pin: the registered definition with the layers the pin froze in.
 *  Layers are applied HERE, in the one place every caller already goes through, and never throw: a
 *  layer the Engine could not apply is left out and the game keeps its rules. A chosen layer the
 *  file does not have, or the later of a conflicting pair, is a debug line rather than a warning,
 *  because this runs on every turn and the same pin would repeat it for the life of the game. */
function resolvedWithLayers(
  ref: RulesetRef,
  definition: RulesetDefinition,
  packageId: string | null,
): ResolvedGameRuleset {
  const active = activeRulesetLayers(definition, ref.options);
  if (active.length > 0 || Object.keys(ref.options).length > 0) {
    const declared = new Set((definition.layers ?? []).map((layer) => layer.id));
    const chosen = Object.keys(ref.options).filter((key) => ref.options[key] === true);
    const applied = new Set(active.map((layer) => rulesetLayerOptionKey(layer.id)));
    for (const key of chosen) {
      if (applied.has(key)) continue;
      const id = key.startsWith("layer.") ? key.slice("layer.".length) : null;
      if (id === null) continue;
      logger.debug(
        '[game/rulesets] Ruleset "%s" %s the layer "%s" this game pinned; it was not applied',
        definition.id,
        declared.has(id) ? "drops a conflicting choice of" : "no longer declares",
        id,
      );
    }
  }
  // ponytail: no cache. With a layer on, this re-validates one definition per resolution, which
  // is what `buildRulesetRegistry` already does for EVERY installed ruleset on every call, because
  // the registry is deliberately re-read so install, update and import need no invalidation. A
  // cache here would have nothing stable to key on (the registry and its definitions are new
  // objects each time) until the registry itself is cached, and that is the upgrade path.
  const layered = resolveRulesetLayers(definition, ref.options);
  for (const layer of active) {
    if (layered.applied.includes(layer)) continue;
    logger.debug(
      '[game/rulesets] The layer "%s" of ruleset "%s" does not validate with the layers before it; it was not applied',
      layer.id,
      definition.id,
    );
  }
  return {
    status: "ok",
    ref,
    definition: layered.definition,
    baseDefinition: definition,
    // The layers whose rules are REALLY on, so a name is never shown for a layer that was skipped.
    layers: layered.applied.map((layer) => ({ id: layer.id, label: layer.label })),
    packageId,
  };
}

/** Resolve a game's pinned ruleset, matched on id AND supplying package. An installed definition NEWER than the pin is accepted, because
 *  sheets are read tolerantly against the current schema; an OLDER one is not, because the game may
 *  depend on something the older file does not declare. */
export function resolveGameRuleset(metadata: Record<string, unknown>, registry: RulesetRegistry): ResolvedGameRuleset {
  const raw = metadata.gameRuleset;
  if (raw === undefined || raw === null) return { status: "legacy" };
  const parsed = rulesetRefSchema.safeParse(raw);
  if (!parsed.success) return { status: "unavailable", reason: "unreadable-pin", ref: null, installedVersion: null };
  const ref = parsed.data;
  const registered = registry.get(ref.id);
  if (!registered) return { status: "unavailable", reason: "missing", ref, installedVersion: null };
  // The id alone is not the identity: another package claiming the same id is another ruleset, and
  // resolving to it would be exactly the silent reinterpretation the pin exists to prevent.
  if (registered.packageId !== ref.packageId) {
    return { status: "unavailable", reason: "different-package", ref, installedVersion: registered.definition.version };
  }
  // A community ruleset keeps every version it was imported at, so the game gets the EXACT one it
  // was created on rather than the author's latest: an import is not a reviewed package update, and
  // a newer file may have renumbered the very sheet the game is built on.
  if (registered.versions) {
    const exact = registered.versions.get(ref.version);
    if (!exact) {
      return { status: "unavailable", reason: "version-missing", ref, installedVersion: registered.definition.version };
    }
    return resolvedWithLayers(ref, exact, null);
  }
  if (registered.definition.version < ref.version) {
    return { status: "unavailable", reason: "older-installed", ref, installedVersion: registered.definition.version };
  }
  return resolvedWithLayers(ref, registered.definition, registered.packageId);
}

/** The pin for a new game on the given registered ruleset. A community ruleset also records where
 *  it came from, so a recipient of a shared setup can be told where to get it. */
export function createRulesetRef(registered: RegisteredRuleset): RulesetRef {
  return {
    id: registered.definition.id,
    version: registered.definition.version,
    packageId: registered.packageId,
    ...(registered.source?.url ? { source: registered.source.url } : {}),
    options: {},
  };
}

/** The live registry: every ready installed package's ruleset plus every imported one. Re-read per
 *  call like the GM verb table, so install, update, disable, uninstall and import need no
 *  invalidation. Throws when the sources cannot be read, for a caller that must tell "none
 *  installed" from "could not look".
 *
 *  `db` defaults to the process's own connection — the same instance `app.db` is decorated with —
 *  because this function is already the wrapper that reaches for live state (it does the same with
 *  `capabilityPackageManager`). Resolving it here rather than at each call site is what guarantees
 *  that every path which resolves a pin sees imported rulesets; `buildRulesetRegistry` stays the
 *  pure, injectable core. */
export async function readRulesetRegistry(db?: DB): Promise<RulesetRegistry> {
  const [sources, community] = await Promise.all([
    capabilityPackageManager.rulesetSources(),
    createGameRulesetsStorage(db ?? (await getDB())).list(),
  ]);
  return buildRulesetRegistry(
    sources,
    (message) => logger.warn("[game/rulesets] %s", message),
    community.map((row) => ({
      rulesetId: row.rulesetId,
      version: row.version,
      sourceKind: row.sourceKind,
      sourceUrl: row.sourceUrl,
      definition: row.definition,
    })),
  );
}

/** The same registry for game resolution, which never throws: a failed read is an empty registry,
 *  so a pinned game reports its ruleset missing instead of failing the turn. */
export async function loadRulesetRegistry(db?: DB): Promise<RulesetRegistry> {
  try {
    return await readRulesetRegistry(db);
  } catch (error) {
    logger.error(error, "[game/rulesets] Could not read installed rulesets; games fall back to reporting them missing");
    return new Map();
  }
}
