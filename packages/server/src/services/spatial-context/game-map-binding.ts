import { getCapabilityService } from "../capability-packages/capability-service-registry.service.js";

export type GameMapBindingTarget =
  | { target: "map"; mapId: string }
  | { target: "cell"; mapId: string; x: number; y: number }
  | { target: "node"; mapId: string; nodeId: string };

export type UpdateGameMapBindingInput = GameMapBindingTarget & { spatialLocationId: string | null };

export class GameMapBindingError extends Error {
  readonly name = "GameMapBindingError";

  constructor(
    readonly code: "map_missing" | "target_missing" | "target_type_mismatch" | "feature_unavailable",
    message: string,
  ) {
    super(message);
  }

  static [Symbol.hasInstance](value: unknown): boolean {
    return value instanceof Error && value.name === "GameMapBindingError";
  }
}

interface GameMapBindingService {
  updateGameMapBinding(metadata: Record<string, unknown>, input: UpdateGameMapBindingInput): Record<string, unknown>;
}

export function updateGameMapBinding(
  metadata: Record<string, unknown>,
  input: UpdateGameMapBindingInput,
): Record<string, unknown> {
  const provider = getCapabilityService<GameMapBindingService>("hierarchical-maps:game-map-binding");
  if (!provider) throw new GameMapBindingError("feature_unavailable", "World Maps is not active.");
  return provider.updateGameMapBinding(metadata, input);
}
