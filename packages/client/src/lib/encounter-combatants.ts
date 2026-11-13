// ──────────────────────────────────────────────
// Combat encounters: the model's combatants matched to the fight by name (#9117)
// ──────────────────────────────────────────────
// The reply may return the party or the enemies in another order, or leave one out. Merging by list position put every
// attack, item, sprite and description on the wrong combatant and dropped the one left out. These merge by name
// (case-insensitive) and by occurrence: an entry updates the next unconsumed combatant with its name, so two foes
// sharing a name are updated one for the other rather than collapsed, a combatant the reply leaves out keeps its state,
// and an enemy name the fight does not have yet is added as a new foe. The player is never one of them.
import type { CombatPartyMember, CombatEnemy } from "@marinara-engine/shared";

/**
 * #9117: the index of the next current combatant an entry of this name stands for: the first one with that name
 * (case-insensitive) that no earlier entry has consumed, so two combatants sharing a name are matched one for the
 * other. -1 when every combatant of that name is already accounted for, or the entry names no one.
 */
/** A name as matching reads it: trimmed, without case, so "Wolf" and "wolf" are the same foe. */
export const combatantNameKey = (name: string) => name.trim().toLowerCase();

export function nextIndexOf<T extends { name: string }>(name: string, current: T[], consumed: Set<number>): number {
  const key = combatantNameKey(name);
  if (!key) return -1;
  const exact = current.findIndex((one, index) => !consumed.has(index) && one.name === name);
  if (exact >= 0) return exact;
  return current.findIndex((one, index) => !consumed.has(index) && combatantNameKey(one.name) === key);
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
  const consumed = new Set<number>();
  const kept = arr.flatMap((raw) => {
    const m = raw as Record<string, unknown> | null;
    const index = nextIndexOf(entryName(raw), current, consumed);
    const matched = index >= 0 ? current[index] : undefined;
    if (!matched) return [];
    consumed.add(index);
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
  return [...kept, ...current.filter((_, index) => !consumed.has(index))];
}

/**
 * Ensure each enemy has all required numeric/string fields so components don't crash, and that each one is the enemy
 * with its name (#9117). Two enemies of one name are matched one for the other. A name the fight does not have yet is
 * added as it came, so a foe that joins mid-fight shows up; the player is never one of them.
 */
export function sanitizeEnemies(arr: unknown[], current: CombatEnemy[]): CombatEnemy[] {
  const consumed = new Set<number>();
  const kept = arr.flatMap((raw) => {
    const m = raw as Record<string, unknown> | null;
    const name = entryName(raw);
    const index = nextIndexOf(name, current, consumed);
    const matched = index >= 0 ? current[index] : undefined;
    if (!name) return [];
    // #9117: a reply naming one foe more often than the fight has foes of that name adds no extra: the extra
    // would arrive with no attacks or statuses and hp 1, not a foe that joined (Dottore LOW).
    if (!matched && current.some((enemy) => combatantNameKey(enemy.name) === combatantNameKey(name))) return [];
    if (matched) consumed.add(index);
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
  return [...kept, ...current.filter((_, index) => !consumed.has(index))];
}
