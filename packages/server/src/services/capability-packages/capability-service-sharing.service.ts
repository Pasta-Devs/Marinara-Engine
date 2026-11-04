import {
  capabilityServiceKeyOwner,
  type CapabilityServiceSharingState,
  type InstalledCapabilityPackage,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";

/**
 * Capability API 1.819: whether a consumer package may read a provider's service, switched per pair on the package
 * page. A pair is a provider service key and a consumer package id. Only the pairs the user changed are stored; the
 * rest follow the provider's `sharedByDefault`, so a package update that changes its default applies to pairs the
 * user never touched. Usage is two aggregates per pair, never a log.
 */

const OVERRIDES_KEY = "capabilityServiceSharing";
const USAGE_KEY = "capabilityServiceUsage";
const USAGE_DAYS = 7;
const USAGE_FLUSH_MS = 30_000;

interface PairUsage {
  lastUsedAt: string;
  /** Uses per UTC day ("YYYY-MM-DD"), the last seven days only. */
  days: Record<string, number>;
}

const pairId = (key: string, consumerId: string) => `${key}|${consumerId}`;
const overrides = new Map<string, boolean>();
const usage = new Map<string, PairUsage>();
/** Keys an active provider declared in `contributions.services.provides`. Undeclared keys are always shared. */
const declared = new Map<string, { providerId: string; sharedByDefault: boolean }>();

let loadedFrom: DB | null = null;
let loading: Promise<void> | null = null;
let flushTimer: NodeJS.Timeout | null = null;

function parseRecord(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Reads the stored pairs and usage once per database. Never throws: unreadable state means every default applies. */
export function loadCapabilityServiceSharing(db: DB | undefined): Promise<void> {
  if (!db || loadedFrom === db) return Promise.resolve();
  if (loading) return loading;
  loading = (async () => {
    try {
      const settings = createAppSettingsStorage(db);
      overrides.clear();
      for (const [id, value] of Object.entries(parseRecord(await settings.get(OVERRIDES_KEY)))) {
        if (typeof value === "boolean") overrides.set(id, value);
      }
      usage.clear();
      for (const [id, value] of Object.entries(parseRecord(await settings.get(USAGE_KEY)))) {
        const entry = value as Partial<PairUsage> | null;
        if (entry && typeof entry.lastUsedAt === "string" && entry.days && typeof entry.days === "object") {
          usage.set(id, { lastUsedAt: entry.lastUsedAt, days: { ...entry.days } });
        }
      }
      loadedFrom = db;
    } catch (error) {
      logger.warn(error, "Could not read the package sharing switches; every package default applies");
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Records the services an activating package declares it provides; the returned cleanup forgets them. */
export function declareProvidedCapabilityServices(installed: InstalledCapabilityPackage): () => void {
  const entries = (installed.manifest.contributions?.services?.provides ?? []).filter(
    ({ key }) => capabilityServiceKeyOwner(key) === installed.id,
  );
  const records = entries.map((entry) => {
    const record = { providerId: installed.id, sharedByDefault: entry.sharedByDefault !== false };
    declared.set(entry.key, record);
    return [entry.key, record] as const;
  });
  return () => {
    for (const [key, record] of records) if (declared.get(key) === record) declared.delete(key);
  };
}

/** Whether `consumerId` may read `key`. A provider always reads its own services. */
export function isCapabilityServiceSharedWith(key: string, consumerId: string): boolean {
  const service = declared.get(key);
  if (!service || service.providerId === consumerId) return true;
  return overrides.get(pairId(key, consumerId)) ?? service.sharedByDefault;
}

const today = (at = new Date()) => at.toISOString().slice(0, 10);

function scheduleUsageFlush(): void {
  if (flushTimer || !loadedFrom) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushCapabilityServiceUsage();
  }, USAGE_FLUSH_MS);
  flushTimer.unref?.();
}

/**
 * Counts one read of a declared service by another package. ponytail: a read is a `services.get` that returned the
 * service, so a consumer that keeps the object and calls it many times counts once; counting each call would need a
 * proxy around every service object. Counted reads are what the package page needs to say "used lately".
 */
export function recordCapabilityServiceUse(key: string, consumerId: string, at = new Date()): void {
  const service = declared.get(key);
  if (!service || service.providerId === consumerId) return;
  const id = pairId(key, consumerId);
  const entry = usage.get(id) ?? { lastUsedAt: at.toISOString(), days: {} };
  entry.lastUsedAt = at.toISOString();
  const day = today(at);
  entry.days[day] = (entry.days[day] ?? 0) + 1;
  const cutoff = today(new Date(at.getTime() - (USAGE_DAYS - 1) * 86_400_000));
  for (const old of Object.keys(entry.days)) if (old < cutoff) delete entry.days[old];
  usage.set(id, entry);
  scheduleUsageFlush();
}

export async function flushCapabilityServiceUsage(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!loadedFrom) return;
  try {
    await createAppSettingsStorage(loadedFrom).set(USAGE_KEY, JSON.stringify(Object.fromEntries(usage)));
  } catch (error) {
    logger.warn(error, "Could not save package service usage");
  }
}

/** Stores the user's choice for one pair. It survives package updates that change the default. */
export async function setCapabilityServiceShared(
  db: DB,
  key: string,
  consumerId: string,
  shared: boolean,
): Promise<void> {
  await loadCapabilityServiceSharing(db);
  const id = pairId(key, consumerId);
  const previous = overrides.get(id);
  // Applied first, so two quick changes both reach the stored copy; undone if the write fails.
  overrides.set(id, shared);
  try {
    await createAppSettingsStorage(db).set(OVERRIDES_KEY, JSON.stringify(Object.fromEntries(overrides)));
  } catch (error) {
    if (previous === undefined) overrides.delete(id);
    else overrides.set(id, previous);
    throw error;
  }
}

/** What the package page shows: the pairs the user set, and each pair's usage. */
export async function capabilityServiceSharingState(
  db: DB | undefined,
  at = new Date(),
): Promise<CapabilityServiceSharingState> {
  await loadCapabilityServiceSharing(db);
  const split = (id: string) => {
    const index = id.lastIndexOf("|");
    return { key: id.slice(0, index), consumerId: id.slice(index + 1) };
  };
  const cutoff = today(new Date(at.getTime() - (USAGE_DAYS - 1) * 86_400_000));
  return {
    overrides: [...overrides].map(([id, shared]) => ({ ...split(id), shared })),
    usage: [...usage].map(([id, entry]) => ({
      ...split(id),
      lastUsedAt: entry.lastUsedAt,
      usesThisWeek: Object.entries(entry.days)
        .filter(([day]) => day >= cutoff)
        .reduce((total, [, count]) => total + count, 0),
    })),
  };
}

export function resetCapabilityServiceSharing(): void {
  overrides.clear();
  usage.clear();
  declared.clear();
  loadedFrom = null;
  loading = null;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
}

/**
 * Activation order: a package activates after the installed providers its `requires` names, so its `activate` can
 * find them. A cycle keeps the given order, with a warning.
 */
export function orderByServiceRequirements<T extends { installed: InstalledCapabilityPackage }>(
  list: readonly T[],
): T[] {
  const byId = new Map(list.map((item) => [item.installed.id, item]));
  const state = new Map<string, "visiting" | "done">();
  const ordered: T[] = [];
  let cycle: string | null = null;
  const visit = (item: T) => {
    const id = item.installed.id;
    const seen = state.get(id);
    if (seen === "done") return;
    if (seen === "visiting") {
      cycle ??= id;
      return;
    }
    state.set(id, "visiting");
    for (const { key } of item.installed.manifest.contributions?.services?.requires ?? []) {
      const provider = byId.get(capabilityServiceKeyOwner(key));
      if (provider && provider !== item) visit(provider);
    }
    state.set(id, "done");
    ordered.push(item);
  };
  for (const item of list) visit(item);
  if (cycle) {
    logger.warn("Package service requirements form a cycle through %s; activating in the usual order", cycle);
    return [...list];
  }
  return ordered;
}
