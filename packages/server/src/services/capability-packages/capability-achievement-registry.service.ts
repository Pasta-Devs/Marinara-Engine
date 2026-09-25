// ──────────────────────────────────────────────
// Capability achievement registry — gives the `achievements` permission its mechanism.
//
// The Engine's own badges are a fixed array in shared, counted off Engine tables. A package's
// feature is invisible to both, so this is the seam: a package declares its badges at activation,
// and the Home panel renders them beside the built-in ones under a section of its own.
//
// Counting stays with the package. A ranked badge carries a `readProgress` callback rather than a
// metric name, because only the package knows what "ten noodle runs" means, and it already has a
// persistence host to keep the tally in. The Engine stores exactly one thing: the unlock row, in
// the table it already uses, keyed by the namespaced id.
// ──────────────────────────────────────────────

import { AsyncLocalStorage } from "node:async_hooks";
import type { AchievementDefinition, AchievementSource, PackagedAchievementDefinition } from "@marinara-engine/shared";
import { ACHIEVEMENT_DEFINITION_BY_ID } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { withDeadline } from "./capability-prompt-context.service.js";

interface RegisteredAchievement {
  definition: AchievementDefinition;
  packageId: string;
  readProgress?: PackagedAchievementDefinition["readProgress"];
}

const byId = new Map<string, RegisteredAchievement>();

const LOCAL_ID = /^[a-z][a-z0-9_-]*$/;

// A package that registers hundreds of badges would bury the Engine's own panel, and every ranked
// one costs a `readProgress` call on each status read. Generous, not a budget to plan around.
const MAX_ACHIEVEMENTS_PER_PACKAGE = 32;
const MAX_TITLE_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 300;

/** How long a package's progress callback has before the status read stops waiting on it. */
const PROGRESS_TIMEOUT_MS = 2_000;

/** `noodle.fed_the_noodle` from package `noodle` and badge `fed_the_noodle`. A built-in id has no
 *  dot, so the two namespaces cannot collide however the Engine's catalog grows. */
export function qualifyAchievementId(packageId: string, id: string): string {
  return `${packageId}.${id}`;
}

function assetUrl(source: AchievementSource, iconPath: string): string {
  const encoded = iconPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/capability-packages/${encodeURIComponent(source.packageId)}/assets/${encoded}?v=${encodeURIComponent(source.packageVersion)}`;
}

function toDefinition(source: AchievementSource, packaged: PackagedAchievementDefinition): AchievementDefinition {
  const id = qualifyAchievementId(source.packageId, packaged.id);
  return {
    id,
    // Namespaced so a locale pack can cover a package's badges without the Engine shipping the
    // strings. `title`/`description` stay the fallback that always works.
    titleKey: `capabilityAchievements.${source.packageId}.${packaged.id}.title`,
    title: packaged.title.trim(),
    descriptionKey: `capabilityAchievements.${source.packageId}.${packaged.id}.description`,
    description: packaged.description.trim(),
    category: packaged.category ?? "milestone",
    icon: packaged.icon ?? "trophy",
    ...(packaged.iconPath ? { iconUrl: assetUrl(source, packaged.iconPath) } : {}),
    ...(packaged.target ? { target: packaged.target } : {}),
    source,
  };
}

/** Register one package's achievements. Returns a releaser for deactivation. */
export function registerCapabilityAchievements(
  source: AchievementSource,
  achievements: readonly PackagedAchievementDefinition[],
): () => void {
  const registered: Array<[string, RegisteredAchievement]> = [];
  for (const packaged of achievements) {
    const localId = packaged.id.trim();
    if (!LOCAL_ID.test(localId) || localId.length > 60) {
      throw new Error(`Capability achievement id ${packaged.id} is invalid`);
    }
    if (!packaged.title.trim() || packaged.title.length > MAX_TITLE_LENGTH) {
      throw new Error(`Capability achievement ${localId} needs a title of at most ${MAX_TITLE_LENGTH} characters`);
    }
    if (!packaged.description.trim() || packaged.description.length > MAX_DESCRIPTION_LENGTH) {
      throw new Error(
        `Capability achievement ${localId} needs a description of at most ${MAX_DESCRIPTION_LENGTH} characters`,
      );
    }
    if (packaged.target !== undefined && (!Number.isInteger(packaged.target) || packaged.target <= 0)) {
      throw new Error(`Capability achievement ${localId} has a target that is not a positive whole number`);
    }
    // A target is only meaningful against a count. Without one the bar could never move, and a
    // badge the package then unlocks by hand would read "1 / 10" forever.
    if ((packaged.target === undefined) !== (packaged.readProgress === undefined)) {
      throw new Error(`Capability achievement ${localId} must declare target and readProgress together`);
    }
    const id = qualifyAchievementId(source.packageId, localId);
    if (ACHIEVEMENT_DEFINITION_BY_ID.has(id)) {
      throw new Error(`Capability achievement ${id} collides with a built-in achievement`);
    }
    const existing = byId.get(id);
    if (existing && existing.packageId !== source.packageId) {
      throw new Error(`Capability achievement ${id} is already registered by ${existing.packageId}`);
    }
    if (registered.some(([registeredId]) => registeredId === id)) {
      throw new Error(`Capability achievement ${id} is registered twice by ${source.packageId}`);
    }
    registered.push([
      id,
      {
        definition: toDefinition(source, { ...packaged, id: localId }),
        packageId: source.packageId,
        ...(packaged.readProgress ? { readProgress: packaged.readProgress } : {}),
      },
    ]);
  }
  // The limit is per package, not per call: count what it already owns that this batch does not
  // replace, so repeated calls cannot add up past it.
  const batchIds = new Set(registered.map(([id]) => id));
  const kept = [...byId.entries()].filter(
    ([id, entry]) => entry.packageId === source.packageId && !batchIds.has(id),
  ).length;
  if (kept + batchIds.size > MAX_ACHIEVEMENTS_PER_PACKAGE) {
    throw new Error(
      `Capability package ${source.packageId} may register at most ${MAX_ACHIEVEMENTS_PER_PACKAGE} achievements`,
    );
  }
  // Nothing is published until every entry validates, so a bad third badge cannot leave the first
  // two half-registered in a panel the user is already looking at.
  for (const [id, entry] of registered) byId.set(id, entry);
  return () => {
    // Identity, not package id: re-registering replaces the entry, and a superseded releaser must
    // not delete its replacement.
    for (const [id, entry] of registered) {
      if (byId.get(id) === entry) byId.delete(id);
    }
  };
}

/** Drops every achievement a package registered, for deactivation or removal. */
export function releaseCapabilityAchievements(packageId: string): void {
  for (const [id, entry] of byId) {
    if (entry.packageId === packageId) byId.delete(id);
  }
}

export function capabilityAchievementDefinitions(packageId?: string): AchievementDefinition[] {
  return [...byId.values()]
    .filter((entry) => !packageId || entry.packageId === packageId)
    .map((entry) => entry.definition);
}

export function isCapabilityAchievementOwnedBy(packageId: string, id: string): boolean {
  return byId.get(id)?.packageId === packageId;
}

// Packages whose `readProgress` is running in the current async chain. A callback may itself call
// `api.runtime.achievements.list()`, which reads progress again; without this it would recurse
// until the deadline, and two packages listing each other would cycle.
const activeProgressReads = new AsyncLocalStorage<ReadonlySet<string>>();

/**
 * Current counts for ranked package badges, optionally for one package only. Never throws: a
 * package whose callback fails or hangs reports zero, because one broken package must not fail the
 * whole Achievements panel. A package already reading its progress up the call chain is skipped.
 */
/** A count and the definition of the registration that produced it. A badge replaced after its
 *  count was read has a different definition object, so the unlock decision can tell that the
 *  count belongs to a registration that no longer exists and skip it, whatever the targets are. */
export interface CapabilityAchievementCount {
  count: number;
  definition: AchievementDefinition;
}

export async function readCapabilityAchievementProgress(
  packageId?: string,
): Promise<Map<string, CapabilityAchievementCount>> {
  const active = activeProgressReads.getStore() ?? new Set<string>();
  const entries = [...byId.values()].filter(
    (entry) => entry.readProgress && (!packageId || entry.packageId === packageId) && !active.has(entry.packageId),
  );
  const results = await Promise.all(
    entries.map(async (entry) => {
      try {
        // ponytail: like capability tools, the deadline bounds asynchronous waits only. Packages run
        // as trusted code in this process, so a callback that blocks synchronously blocks the event
        // loop; hard cancellation would need a worker or process boundary this runtime does not have.
        const value = await withDeadline(
          activeProgressReads.run(new Set([...active, entry.packageId]), () => Promise.resolve(entry.readProgress?.())),
          `Capability achievement progress for ${entry.definition.id}`,
          PROGRESS_TIMEOUT_MS,
        );
        // A package re-activated while this callback was pending has a new entry under the same id,
        // possibly with a new target. The old count must not be compared against it.
        if (byId.get(entry.definition.id) !== entry) return null;
        const count = Number.isFinite(value) ? Math.max(0, Math.trunc(value as number)) : 0;
        return [entry.definition.id, { count, definition: entry.definition }] as const;
      } catch (error) {
        logger.warn(error, "[capability/achievements] Package %s failed reporting progress", entry.packageId);
        return byId.get(entry.definition.id) === entry
          ? ([entry.definition.id, { count: 0, definition: entry.definition }] as const)
          : null;
      }
    }),
  );
  return new Map(results.filter((result) => result !== null));
}
