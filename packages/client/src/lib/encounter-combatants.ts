// ──────────────────────────────────────────────
// Combat encounters: the model's combatants matched to the fight by name (#9117)
// ──────────────────────────────────────────────
// The reply may return the party or the enemies in another order, or leave one out. Merging by list position put every
// attack, item, sprite and description on the wrong combatant and dropped the one left out. These merge by name
// (case-insensitive): an entry updates the combatant with its name, a combatant the reply leaves out keeps its state,
// and an enemy name the fight does not have yet is added as a new foe. The player is never one of them.
import type { CombatPartyMember, CombatEnemy } from "@marinara-engine/shared";

/**
 * #9117: the combatant an entry is, matched by name (case-insensitive) and never by list position. The model may
 * return the fight in another order or leave someone out; a name match updates that combatant, and an entry with no
 * match is taken as a new one (the caller adds it after these).
 */
export function currentOf<T extends { name: string }>(name: string, current: T[]): T | undefined {
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  return current.find((one) => one.name === name) ?? current.find((one) => one.name.trim().toLowerCase() === key);
}

/** The name an entry gives, when it gives one; "" for an entry with none. */
const entryName = (raw: unknown) => {
  const m = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const name = typeof m?.name === "string" ? m.name.trim() : "";
  return name;
};

/**
 * Ensure each party member has all required numeric/string fields so components don't crash, and that each one is the
 * member with its name (#9117). A member the reply leaves out keeps the state it had.
 */
export function sanitizeParty(arr: unknown[], current: CombatPartyMember[]): CombatPartyMember[] {
  const kept = arr.flatMap((raw) => {
    const m = raw as Record<string, unknown> | null;
    const name = entryName(raw);
    const matched = name ? currentOf(name, current) : undefined;
    if (!matched) return [];
    return [
      {
        name: matched.name,
        hp: typeof m?.hp === "number" ? m.hp : matched.hp,
        maxHp: typeof m?.maxHp === "number" && m.maxHp > 0 ? m.maxHp : matched.maxHp,
        attacks: Array.isArray(m?.attacks) ? m.attacks : matched.attacks,
        items: Array.isArray(m?.items) ? m.items : matched.items,
        statuses: Array.isArray(m?.statuses) ? m.statuses : matched.statuses,
        isPlayer: typeof m?.isPlayer === "boolean" ? m.isPlayer : matched.isPlayer,
      } satisfies CombatPartyMember,
    ];
  });
  const seen = new Set(kept.map((one) => one.name));
  return [...kept, ...current.filter((one) => !seen.has(one.name))];
}

/**
 * Ensure each enemy has all required numeric/string fields so components don't crash, and that each one is the enemy
 * with its name (#9117). A name the fight does not have yet is added as it came, so a foe that joins mid-fight shows
 * up; the player is never one of them.
 */
export function sanitizeEnemies(arr: unknown[], current: CombatEnemy[]): CombatEnemy[] {
  const kept = arr.flatMap((raw) => {
    const m = raw as Record<string, unknown> | null;
    const name = entryName(raw);
    if (!name) return [];
    const matched = currentOf(name, current);
    return [
      {
        name: matched?.name ?? name,
        hp: typeof m?.hp === "number" ? m.hp : (matched?.hp ?? 0),
        maxHp: typeof m?.maxHp === "number" && m.maxHp > 0 ? m.maxHp : (matched?.maxHp ?? 1),
        attacks: Array.isArray(m?.attacks) ? m.attacks : (matched?.attacks ?? []),
        statuses: Array.isArray(m?.statuses) ? m.statuses : (matched?.statuses ?? []),
        description: typeof m?.description === "string" ? m.description : (matched?.description ?? ""),
        sprite: typeof m?.sprite === "string" ? m.sprite : (matched?.sprite ?? ""),
      } satisfies CombatEnemy,
    ];
  });
  const seen = new Set(kept.map((one) => one.name));
  return [...kept, ...current.filter((one) => !seen.has(one.name))];
}
