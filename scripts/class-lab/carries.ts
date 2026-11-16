import {
  MARINARA_CARRY_SLOTS,
  marinaraCarryRedundant,
  type MarinaraProgression,
} from "../../packages/shared/src/features/marinara-classes.js";

/** The first carries in rank order that the class doesn't already cover (Greater Channel on a Starweaver). */
export function pickCarries(character: MarinaraProgression, ranked: Array<{ id: string }>): string[] {
  const carried: string[] = [];
  for (const skill of ranked) {
    if (carried.length >= MARINARA_CARRY_SLOTS) break;
    if (carried.includes(skill.id) || marinaraCarryRedundant({ ...character, carried }, skill.id)) continue;
    carried.push(skill.id);
  }
  return carried;
}
