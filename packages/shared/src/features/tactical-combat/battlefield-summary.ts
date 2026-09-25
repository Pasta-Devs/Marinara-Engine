import {
  gridDimensions,
  TACTICAL_BATTLEFIELD_GENERATOR_VERSION,
  validateTacticalBattlefieldBrief,
} from "./grid-gen.js";
import { TERRAIN_DATA, type TacticalBattlefieldSize } from "./types.js";

const BATTLEFIELD_SIZES = new Set(["small", "medium", "large"]);
const MAX_SUMMARY_LENGTH = 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isKnownTerrain(value: unknown): value is keyof typeof TERRAIN_DATA {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(TERRAIN_DATA, value);
}

/**
 * Creates bounded GM context from an accepted generated tactical board. The
 * unknown input keeps this safe for persisted snapshots at the server boundary.
 */
export function summarizeTacticalBattlefield(value: unknown): string | undefined {
  if (!isRecord(value) || !isRecord(value.battlefield) || !isRecord(value.grid)) return undefined;
  const provenance = value.battlefield;
  if (
    provenance.kind !== "generated" ||
    provenance.generatorVersion !== TACTICAL_BATTLEFIELD_GENERATOR_VERSION ||
    !BATTLEFIELD_SIZES.has(provenance.size as string)
  ) {
    return undefined;
  }

  const { width, height } = gridDimensions(0, provenance.size as TacticalBattlefieldSize);
  const tiles = value.grid.tiles;
  if (value.grid.width !== width || value.grid.height !== height || !Array.isArray(tiles) || tiles.length !== height) {
    return undefined;
  }

  const counts = new Map<string, number>();
  for (const row of tiles) {
    if (!Array.isArray(row) || row.length !== width) return undefined;
    for (const terrain of row) {
      if (!isKnownTerrain(terrain)) return undefined;
      counts.set(terrain, (counts.get(terrain) ?? 0) + 1);
    }
  }

  const lines = [
    `Seed: ${Number.isInteger(value.seed) ? value.seed : "unknown"}`,
    `Environment: ${typeof value.environment === "string" && /^[a-z]+$/.test(value.environment) ? value.environment : "unspecified"}`,
    `Board size: ${provenance.size}`,
  ];
  const briefResult = validateTacticalBattlefieldBrief(provenance.brief);
  const features = briefResult.ok ? briefResult.brief?.features : undefined;
  lines.push(
    `Accepted features: ${features?.length ? features.map((feature) => `${feature.terrain} ${feature.placement} ${feature.shape}`).join("; ") : "none"}`,
  );

  if (counts.size) {
    lines.push(
      `Resolved terrain: ${[...counts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([terrain, count]) => `${terrain} ${count}`)
        .join(", ")}`,
    );
  }
  return lines.join("\n").slice(0, MAX_SUMMARY_LENGTH);
}
