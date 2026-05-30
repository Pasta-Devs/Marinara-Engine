// ──────────────────────────────────────────────
// Service: Party Morale System
//
// Tracks and adjusts party-wide morale based on
// game events. Morale affects dice rolls, NPC
// interactions, and narrative flavoring.
// ──────────────────────────────────────────────

export type MoraleTier = "inspired" | "high" | "steady" | "low" | "broken";

/** Event types that affect morale. */
export type MoraleEvent =
  | "combat_victory"
  | "combat_defeat"
  | "npc_allied"
  | "npc_betrayed"
  | "quest_completed"
  | "quest_failed"
  | "party_member_down"
  | "party_healed"
  | "treasure_found"
  | "trap_triggered"
  | "rest_completed"
  | "critical_success"
  | "critical_failure"
  | "boss_defeated"
  | "ally_rescued"
  | "ally_lost";

/** Default morale modifiers for each event. */
const EVENT_MODIFIERS: Record<MoraleEvent, number> = {
  combat_victory: 8,
  combat_defeat: -15,
  npc_allied: 5,
  npc_betrayed: -12,
  quest_completed: 10,
  quest_failed: -10,
  party_member_down: -8,
  party_healed: 4,
  treasure_found: 6,
  trap_triggered: -5,
  rest_completed: 10,
  critical_success: 5,
  critical_failure: -3,
  boss_defeated: 15,
  ally_rescued: 8,
  ally_lost: -20,
};

/** Map morale value to a tier. */
export function getMoraleTier(value: number): MoraleTier {
  if (value >= 85) return "inspired";
  if (value >= 65) return "high";
  if (value >= 35) return "steady";
  if (value >= 15) return "low";
  return "broken";
}

/** Natural morale drift: slowly return towards 50 (steady). */
function drift(current: number): number {
  if (current > 55) return -1;
  if (current < 45) return 1;
  return 0;
}

/** Apply a morale event and return the updated state. */
export function applyMoraleEvent(
  current: number,
  event: MoraleEvent,
  customModifier?: number,
): { value: number; tier: MoraleTier; change: number; previousTier: MoraleTier } {
  const previousTier = getMoraleTier(current);
  const modifier = customModifier ?? EVENT_MODIFIERS[event] ?? 0;
  // Apply drift towards baseline
  const drifted = current + drift(current);
  const newValue = Math.max(0, Math.min(100, drifted + modifier));
  const tier = getMoraleTier(newValue);

  return { value: newValue, tier, change: modifier, previousTier };
}
