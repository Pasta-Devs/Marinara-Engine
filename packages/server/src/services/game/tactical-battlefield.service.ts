import { z } from "zod";
import {
  validateTacticalBattlefieldBrief,
  type TacticalBattlefieldBrief,
  type TacticalBattlefieldSetup,
  type TacticalMovementMode,
} from "@marinara-engine/shared";

export type { TacticalBattlefieldSetup } from "@marinara-engine/shared";

export const MAX_TACTICAL_BATTLEFIELD_SEED = 0xffff_ffff;

export const tacticalBattlefieldSeedSchema = z
  .number()
  .int("Battlefield seed must be a whole number.")
  .min(0, "Battlefield seed must be at least 0.")
  .max(MAX_TACTICAL_BATTLEFIELD_SEED, `Battlefield seed must be at most ${MAX_TACTICAL_BATTLEFIELD_SEED}.`);

export const tacticalBattlefieldSetupSchema = z
  .object({
    seed: tacticalBattlefieldSeedSchema.optional(),
    size: z.enum(["small", "medium", "large"]).optional(),
    instructions: z.string().trim().max(4000).optional(),
  })
  .strict();

const TACTICAL_MOVEMENT_MODES = new Set<TacticalMovementMode>(["walk", "fly", "teleport"]);

export interface TacticalEncounterBlueprintAdditions {
  battlefield?: {
    formation?: unknown;
    terrainBrief?: TacticalBattlefieldBrief;
    terrainBriefError?: string;
    [key: string]: unknown;
  };
  party?: unknown[];
  enemies?: unknown[];
  [key: string]: unknown;
}

export type TacticalEncounterBlueprintValidation =
  | { ok: true; blueprint: TacticalEncounterBlueprintAdditions }
  | { ok: false; error: string };

/** Validate and normalize only the tactical fields produced by the encounter model. */
export function validateTacticalEncounterBlueprint(value: unknown): TacticalEncounterBlueprintValidation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "combat blueprint must be a JSON object" };
  }
  const blueprint = value as TacticalEncounterBlueprintAdditions;

  for (const group of ["party", "enemies"] as const) {
    const members = blueprint[group];
    if (!Array.isArray(members)) continue;
    for (let index = 0; index < members.length; index++) {
      const member = members[index];
      if (!member || typeof member !== "object" || Array.isArray(member)) continue;
      const movementMode = (member as { movementMode?: unknown }).movementMode;
      // Omission is the legacy walking default. Reject explicit unsupported capabilities:
      // silently changing them to walking would change the encounter's movement rules.
      if (
        movementMode !== undefined &&
        !(typeof movementMode === "string" && TACTICAL_MOVEMENT_MODES.has(movementMode as TacticalMovementMode))
      ) {
        return {
          ok: false,
          error: `${group}[${index}].movementMode must be walk, fly, or teleport`,
        };
      }
    }
  }

  if (blueprint.battlefield === undefined) return { ok: true, blueprint };
  if (!blueprint.battlefield || typeof blueprint.battlefield !== "object" || Array.isArray(blueprint.battlefield)) {
    return { ok: false, error: "battlefield must be an object" };
  }

  const battlefield = { ...blueprint.battlefield };
  const briefResult = validateTacticalBattlefieldBrief(battlefield.terrainBrief);
  if (!briefResult.ok) {
    delete battlefield.terrainBrief;
    battlefield.terrainBriefError = `The GM's terrain request was invalid: ${briefResult.error}`;
    return { ok: true, blueprint: { ...blueprint, battlefield } };
  }
  delete battlefield.terrainBriefError;
  if (briefResult.brief) battlefield.terrainBrief = briefResult.brief;
  else delete battlefield.terrainBrief;
  return { ok: true, blueprint: { ...blueprint, battlefield } };
}

export type TacticalStartPreferences =
  | { ok: true; seed: number; battlefield?: TacticalBattlefieldBrief }
  | { ok: false; error: string };

/** Resolve setup-owned preferences before request hints; setup size is authoritative; obsolete setup seeds are ignored. */
export function resolveTacticalStartPreferences(args: {
  setup: unknown;
  requestSeed: number | undefined;
  requestBattlefield: unknown;
  randomSeed: () => number;
}): TacticalStartPreferences {
  const setupResult =
    args.setup === undefined
      ? { success: true as const, data: {} }
      : tacticalBattlefieldSetupSchema.safeParse(args.setup);
  if (!setupResult.success) {
    return {
      ok: false,
      error: `Stored tactical battlefield settings are invalid: ${setupResult.error.issues[0]?.message ?? "invalid settings"}`,
    };
  }

  const briefResult = validateTacticalBattlefieldBrief(args.requestBattlefield);
  if (!briefResult.ok) return { ok: false, error: `Battlefield brief is invalid: ${briefResult.error}` };

  const setup = setupResult.data as TacticalBattlefieldSetup;
  const requested = briefResult.brief;
  const battlefield = setup.size ? { ...(requested ?? {}), size: setup.size } : requested;
  return {
    ok: true,
    seed: args.requestSeed ?? args.randomSeed(),
    ...(battlefield ? { battlefield } : {}),
  };
}
