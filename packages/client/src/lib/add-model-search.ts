// Add window, "A specific model…": which services serve a model, from data Marinara has without a key.
// Vendors and plans list their models offline; OpenRouter and NanoGPT have no offline list, so they are named only
// when the shared gateway catalog knows the model's maker. The user's own Connections add what their saved Models
// and cached catalogs hold, so "your Bifrost ✓" shows.
import { MODEL_LISTS, catalogModelId, findKnownModel, type APIProvider } from "@marinara-engine/shared";

export type ModelKind = "chat" | "image" | "video";
/** A service to connect (`service`) or a Connection the user has (`accountId`), and the model id it uses. */
export type ModelRoute = { service: string; model: string } | { accountId: string; model: string };
export type ModelEntry = { key: string; name: string; kind: ModelKind; routes: ModelRoute[] };

export const modelKey = (id: string) => catalogModelId(id).toLowerCase();

const GATEWAYS = ["openrouter", "nanogpt"] as const;
/** Date pins (`claude-opus-4-5-20251101`) repeat the model they pin. */
const DATE_PIN = /-(?:\d{8}|\d{4}-\d{2}-\d{2})$/u;

/** The offline part of the index, in list order (each list starts with its newest models). */
export function buildOfflineModelIndex(services: readonly APIProvider[]): ModelEntry[] {
  const byKey = new Map<string, ModelEntry>();
  for (const service of services) {
    for (const model of MODEL_LISTS[service] ?? []) {
      const key = modelKey(model.id);
      if (!key || DATE_PIN.test(key)) continue;
      let entry = byKey.get(key);
      if (!entry) byKey.set(key, (entry = { key, name: model.name, kind: "chat", routes: [] }));
      if (!entry.routes.some((route) => "service" in route && route.service === service))
        entry.routes.push({ service, model: model.id });
    }
  }
  for (const entry of byKey.values()) {
    if (findKnownModel("openrouter", entry.key))
      for (const service of GATEWAYS) entry.routes.push({ service, model: entry.key });
  }
  return [...byKey.values()];
}

const keyMaps = new WeakMap<ReadonlySet<string>, Map<string, string>>();
/** A cached catalog's ids by model key; the first id wins. Cached per catalog, so typing does not redo it. */
export function keysOf(ids: ReadonlySet<string>): Map<string, string> {
  let map = keyMaps.get(ids);
  if (!map) {
    map = new Map();
    for (const id of ids) {
      const key = modelKey(id);
      if (key && !map.has(key)) map.set(key, id);
    }
    keyMaps.set(ids, map);
  }
  return map;
}

/**
 * Adds the user's Connections to a copy of the index: each one that holds a model (a saved Model or its cached
 * catalog) becomes a route, and models only the user's Connections know become entries of their own.
 */
export function withOwnConnections(
  offline: readonly ModelEntry[],
  own: ReadonlyArray<{ accountId: string; models: ReadonlyMap<string, { id: string; kind: ModelKind }> }>,
): ModelEntry[] {
  const byKey = new Map(
    offline.map((entry) => [`${entry.kind}:${entry.key}`, { ...entry, routes: [...entry.routes] }]),
  );
  for (const { accountId, models } of own) {
    for (const [key, model] of models) {
      const slot = `${model.kind}:${key}`;
      let entry = byKey.get(slot);
      if (!entry) byKey.set(slot, (entry = { key, name: model.id, kind: model.kind, routes: [] }));
      if (!entry.routes.some((route) => "accountId" in route && route.accountId === accountId))
        entry.routes.push({ accountId, model: model.id });
    }
  }
  return [...byKey.values()];
}

/** Entries whose name or id holds every typed word. */
export function searchModels(index: readonly ModelEntry[], query: string, kind: ModelKind | null, limit: number) {
  const words = query.trim().toLowerCase().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return [];
  return index
    .filter((entry) => !kind || entry.kind === kind)
    .filter((entry) => {
      const text = `${entry.name} ${entry.key}`.toLowerCase();
      return words.every((word) => text.includes(word));
    })
    .slice(0, limit);
}

/** A few good first picks before typing: the newest model of each of the first services, one per service. */
export function popularModels(index: readonly ModelEntry[], kind: ModelKind | null, limit: number) {
  const seen = new Set<string>();
  const picks: ModelEntry[] = [];
  for (const entry of index) {
    if (kind && entry.kind !== kind) continue;
    const first = entry.routes.find((route) => "service" in route);
    if (!first || !("service" in first) || seen.has(first.service)) continue;
    seen.add(first.service);
    picks.push(entry);
    if (picks.length === limit) break;
  }
  return picks;
}
