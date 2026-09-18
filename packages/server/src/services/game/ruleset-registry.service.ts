// ──────────────────────────────────────────────
// Game: ruleset registry
//
// Reads every installed package's `ruleset.json`, validates it as data, and resolves the ruleset a
// game pinned at creation (`chat.metadata.gameRuleset`). No pin means `engine-legacy`: today's
// behaviour, untouched. A pin this install cannot honour is reported, never reinterpreted — the
// game's arithmetic must not change silently because a package went away or is older than the pin.
// ──────────────────────────────────────────────
import {
  parseRulesetDefinition,
  rulesetRefSchema,
  RULESET_MAX_BYTES,
  type RulesetDefinition,
  type RulesetRef,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { capabilityPackageManager } from "../capability-packages/package-manager.service.js";

export type RulesetSource = { packageId: string | null; data: Buffer | string };
export type RegisteredRuleset = { definition: RulesetDefinition; packageId: string | null };
export type RulesetRegistry = ReadonlyMap<string, RegisteredRuleset>;

type RegistryLog = (message: string) => void;

/** Build the registry from raw sources. Pure apart from `log`, and never throws: a source the
 *  Engine cannot use is dropped with one line saying why. Sources are taken in package-id order so
 *  which of two packages claiming one id wins does not depend on install order. */
export function buildRulesetRegistry(sources: readonly RulesetSource[], log: RegistryLog): RulesetRegistry {
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
  return registry;
}

export type ResolvedGameRuleset =
  | { status: "legacy" }
  | { status: "ok"; ref: RulesetRef; definition: RulesetDefinition; packageId: string | null }
  | {
      status: "unavailable";
      /** `unreadable-pin`: the stored pin is malformed. `missing`: nothing installed provides the id.
       *  `different-package`: the id is provided, but not by the package the game pinned.
       *  `older-installed`: the game was created on a newer version than the one installed. */
      reason: "unreadable-pin" | "missing" | "different-package" | "older-installed";
      ref: RulesetRef | null;
      installedVersion: number | null;
    };

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
  if (registered.definition.version < ref.version) {
    return { status: "unavailable", reason: "older-installed", ref, installedVersion: registered.definition.version };
  }
  return { status: "ok", ref, definition: registered.definition, packageId: registered.packageId };
}

/** The pin for a new game on the given registered ruleset. */
export function createRulesetRef(registered: RegisteredRuleset): RulesetRef {
  return {
    id: registered.definition.id,
    version: registered.definition.version,
    packageId: registered.packageId,
    options: {},
  };
}

/** The live registry: every ready installed package's ruleset. Re-read per call like the GM verb
 *  table, so install, update, disable and uninstall need no invalidation. */
export async function loadRulesetRegistry(): Promise<RulesetRegistry> {
  try {
    return buildRulesetRegistry(await capabilityPackageManager.rulesetSources(), (message) =>
      logger.warn("[game/rulesets] %s", message),
    );
  } catch (error) {
    logger.error(error, "[game/rulesets] Could not read installed rulesets; games fall back to reporting them missing");
    return new Map();
  }
}
