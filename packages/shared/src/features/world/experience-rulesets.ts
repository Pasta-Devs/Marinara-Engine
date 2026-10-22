// ──────────────────────────────────────────────
// An Experience's ruleset overlays (Capability API 1.355): what its map pack adds to a ruleset while the
// Experience is on, for one ruleset each. Bestiary creatures its fights and story name, combat conditions
// and the sheet conditions they hold, sheet tracks (1.367), creature tags, and entries for any of the ruleset's catalogs (its
// items). A `.overlay.json` file of its map pack, read strictly for its shape here and checked against the
// game's ruleset when it is merged in: an overlay that does not fit is left out whole.
// ──────────────────────────────────────────────
import { z } from "zod";
import {
  parseRulesetCatalogFile,
  parseRulesetDefinition,
  type RulesetCatalogEntry,
  type RulesetDefinition,
} from "../../schemas/ruleset.schema.js";

export const EXPERIENCE_OVERLAY_VERSION = 1;
export const EXPERIENCE_OVERLAY_MAX = Object.freeze({ entries: 1000, rules: 256, catalogs: 16 });
/** The catalog an overlay's `creatures` go into. */
export const EXPERIENCE_OVERLAY_BESTIARY = "creatures";

const catalogId = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/u, "A catalog is named by its id");
const objects = (max: number) => z.array(z.record(z.unknown())).max(max).optional();

export const experienceRulesetOverlaySchema = z
  .object({
    overlayVersion: z.literal(EXPERIENCE_OVERLAY_VERSION),
    /** Creature tags, as the ruleset's `combat.creatureTypes.tags`. */
    creatureTags: objects(EXPERIENCE_OVERLAY_MAX.rules),
    /** Combat conditions, as the ruleset's `combat.conditions`. */
    conditions: objects(EXPERIENCE_OVERLAY_MAX.rules),
    /** The sheet conditions they hold, as the ruleset's `sheet.live.conditions`. */
    sheetConditions: objects(EXPERIENCE_OVERLAY_MAX.rules),
    /** Sheet tracks (Capability API 1.367), as the ruleset's `sheet.live.tracks`: a mark of Owing that a
     *  story's Held Ground or a board's light rule moves, shown on the sheet and moved by sheet commands. */
    tracks: objects(EXPERIENCE_OVERLAY_MAX.rules),
    /** Bestiary entries, for the ruleset's `creatures` catalog. */
    creatures: objects(EXPERIENCE_OVERLAY_MAX.entries),
    /** Item uses that cost a story number (Capability API 1.359): the item, by `catalog/entry` id, and
     *  what its use adds to the story's number flag `flag` (`add: -2` spends two), refused while the
     *  flag is below `atLeast`. */
    storyUses: z
      .array(
        z
          .object({
            item: z.string().regex(/^[a-z][a-z0-9_]{0,39}\/[^/\s]{1,120}$/u, "An item is named catalog/entry"),
            flag: z.string().regex(/^[a-z0-9_-]{1,40}$/u, "A story flag's id"),
            add: z.number().finite(),
            atLeast: z.number().finite().optional(),
          })
          .strict(),
      )
      .max(EXPERIENCE_OVERLAY_MAX.rules)
      .optional(),
    /** Entries for any other of its catalogs, by catalog id: `{ "magic_items": [...] }`. */
    catalogs: z
      .record(catalogId, z.array(z.record(z.unknown())).max(EXPERIENCE_OVERLAY_MAX.entries))
      .refine((catalogs) => Object.keys(catalogs).length <= EXPERIENCE_OVERLAY_MAX.catalogs, {
        message: `An overlay adds to ${EXPERIENCE_OVERLAY_MAX.catalogs} catalogs at most`,
      })
      .optional(),
  })
  .strict();
export type ExperienceRulesetOverlay = z.infer<typeof experienceRulesetOverlaySchema>;

/** An overlay file, read for its shape; or why not. */
export function readExperienceRulesetOverlay(
  text: string,
): { ok: true; overlay: ExperienceRulesetOverlay } | { ok: false; issues: string[] } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, issues: ["The overlay is not JSON."] };
  }
  const parsed = experienceRulesetOverlaySchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.slice(0, 8).map((issue) => `${issue.path.join(".") || "overlay"}: ${issue.message}`),
    };
  }
  return { ok: true, overlay: parsed.data };
}

/** The entries an overlay adds to a catalog of a ruleset it was merged into, by catalog id. Kept beside
 *  the definition rather than in it, because a catalog's own entries may be a file read later. */
const overlayEntries = new WeakMap<RulesetDefinition, Record<string, RulesetCatalogEntry[]>>();

/** What a use of an item costs in story numbers, by the item's `catalog/entry` id (1.359). */
export type ExperienceStoryUse = NonNullable<ExperienceRulesetOverlay["storyUses"]>[number];
const overlayStoryUses = new WeakMap<RulesetDefinition, ReadonlyMap<string, ExperienceStoryUse>>();

/** The story cost of using this item (1.359), by its `catalog/entry` id, in a ruleset an overlay with
 *  any was merged into; none otherwise. */
export function experienceStoryUse(definition: RulesetDefinition, item: string): ExperienceStoryUse | undefined {
  return overlayStoryUses.get(definition)?.get(item);
}

/** What an Experience's overlay adds to one catalog of this (merged) ruleset; none for any other. */
export function experienceOverlayEntries(definition: RulesetDefinition, catalog: string): RulesetCatalogEntry[] {
  return overlayEntries.get(definition)?.[catalog] ?? [];
}

/** Whose id is taken twice: an overlay's own, or one the ruleset has already. */
function sameIds(base: readonly unknown[], added: readonly unknown[], key: string): string[] {
  const idOf = (each: unknown) =>
    each && typeof each === "object" ? (each as Record<string, unknown>)[key] : undefined;
  const seen = new Set(base.map(idOf));
  const twice: string[] = [];
  for (const each of added) {
    const id = idOf(each);
    if (seen.has(id)) twice.push(String(id));
    seen.add(id);
  }
  return twice;
}

/**
 * A ruleset with an Experience's overlay merged in (1.355): its conditions, sheet conditions and tags
 * added to the ruleset's own and the whole read again as a ruleset is, and its catalog entries checked
 * against it as a catalog file is. Nothing of an overlay that does not fit is merged.
 */
export function applyExperienceRulesetOverlay(
  definition: RulesetDefinition,
  overlay: ExperienceRulesetOverlay,
  /** True when `definition` may have its layers applied: a game's, rather than the file as written. */
  narrowedByLayers = true,
  /** The entry ids of its catalogs kept in a file rather than inline, by catalog id, as the server
   *  read them: an overlay entry may not take one, and a story cost names one of them. */
  fileEntryIds?: ReadonlyMap<string, ReadonlySet<string>>,
): { ok: true; definition: RulesetDefinition } | { ok: false; issues: string[] } {
  const merged = structuredClone(definition) as RulesetDefinition & Record<string, any>;
  const issues: string[] = [];
  const add = (
    rules: readonly unknown[] | undefined,
    owner: Record<string, any> | undefined,
    key: string,
    id: string,
    what: string,
  ) => {
    if (!rules?.length) return;
    if (!owner) {
      issues.push(`${what}: the ruleset has none to add to.`);
      return;
    }
    const base: unknown[] = Array.isArray(owner[key]) ? owner[key] : [];
    for (const twice of sameIds(base, rules, id)) issues.push(`${what}: "${twice}" is the ruleset's already.`);
    owner[key] = [...base, ...structuredClone(rules)];
  };
  add(overlay.conditions, merged.combat, "conditions", "condition", "conditions");
  add(overlay.sheetConditions, merged.sheet?.live, "conditions", "id", "sheetConditions");
  add(overlay.tracks, merged.sheet?.live, "tracks", "id", "tracks");
  add(overlay.creatureTags, merged.combat?.creatureTypes, "tags", "id", "creatureTags");
  if (issues.length) return { ok: false, issues };
  // A stored ruleset is played under its namespaced id (`local/<id>`, `<owner>/<id>`), which a ruleset
  // file's own id never is: it is read again by its bare id and given its namespaced one back.
  const read = parseRulesetDefinition({ ...merged, id: merged.id.replace(/^[^/]+\//u, "") });
  if (!read.ok) return { ok: false, issues: read.issues.slice(0, 8) };
  const done: RulesetDefinition = { ...read.definition, id: merged.id };
  const catalogs: Record<string, RulesetCatalogEntry[]> = {};
  const lists = [
    ...(overlay.creatures?.length ? ([[EXPERIENCE_OVERLAY_BESTIARY, overlay.creatures]] as const) : []),
    ...Object.entries(overlay.catalogs ?? {}),
  ];
  for (const [catalog, entries] of lists) {
    const file = parseRulesetCatalogFile(done, catalog, { schemaVersion: 1, catalog, entries }, narrowedByLayers);
    if (!file.ok) return { ok: false, issues: file.issues.slice(0, 8).map((issue) => `${catalog}: ${issue}`) };
    const header = done.catalogs?.find((each) => each.id === catalog);
    const own = header?.entries ?? [...(fileEntryIds?.get(catalog) ?? [])].map((id) => ({ id }));
    const twice = sameIds([...own, ...(catalogs[catalog] ?? [])], file.entries, "id");
    if (twice.length) return { ok: false, issues: twice.map((id) => `${catalog}: "${id}" is taken already.`) };
    catalogs[catalog] = [...(catalogs[catalog] ?? []), ...file.entries];
  }
  // A story cost is for an item of one of its catalogs, once each (1.359). The item itself is looked
  // for wherever its entries are known: inline, added here, or a file whose ids were passed in.
  const uses = new Map<string, ExperienceStoryUse>();
  for (const use of overlay.storyUses ?? []) {
    const slash = use.item.indexOf("/");
    const catalog = use.item.slice(0, slash);
    const entry = use.item.slice(slash + 1);
    const header = done.catalogs?.find((each) => each.id === catalog);
    if (!header && !catalogs[catalog]) {
      return { ok: false, issues: [`storyUses: "${use.item}" is in no catalog of the ruleset.`] };
    }
    const fileIds = header && !header.entries ? fileEntryIds?.get(catalog) : undefined;
    const known =
      catalogs[catalog]?.some((each) => each.id === entry) ||
      header?.entries?.some((each) => each.id === entry) ||
      fileIds?.has(entry);
    // A file whose ids were not read cannot be looked in; that use is taken on trust.
    const unread = !!header && !header.entries && !fileIds;
    if (!known && !unread) {
      return { ok: false, issues: [`storyUses: "${use.item}" is no entry of its catalog.`] };
    }
    if (uses.has(use.item)) return { ok: false, issues: [`storyUses: "${use.item}" is named twice.`] };
    uses.set(use.item, use);
  }
  overlayEntries.set(done, catalogs);
  if (uses.size) overlayStoryUses.set(done, uses);
  return { ok: true, definition: done };
}
