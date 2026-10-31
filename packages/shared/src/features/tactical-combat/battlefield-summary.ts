import {
  gridDimensions,
  TACTICAL_BATTLEFIELD_GENERATOR_VERSION,
  validateTacticalBattlefieldBrief,
} from "./grid-gen.js";
import { TACTICAL_BATTLEFIELD_SIZES, TERRAIN_DATA, type TacticalBattlefieldSize } from "./types.js";

const BATTLEFIELD_SIZES = new Set<string>(TACTICAL_BATTLEFIELD_SIZES);
const MAX_SUMMARY_LENGTH = 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isKnownTerrain(value: unknown): value is keyof typeof TERRAIN_DATA {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(TERRAIN_DATA, value);
}

/**
 * Creates bounded GM context from an accepted tactical board, generated or painted by hand for the
 * fight's place (worldgen W9g). The unknown input keeps this safe for persisted snapshots at the server
 * boundary.
 */
export function summarizeTacticalBattlefield(value: unknown): string | undefined {
  if (!isRecord(value) || !isRecord(value.battlefield) || !isRecord(value.grid)) return undefined;
  const provenance = value.battlefield;
  // A hand-made board's name, as the Game Master may be told it: one plain line, with nothing a macro or a
  // prompt tag is made of (a round-tripped snapshot is the client's JSON).
  const madeName =
    provenance.kind === "hand-made" && typeof provenance.name === "string"
      ? provenance.name
          .replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029"[\]{}<>]/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 60)
      : undefined;
  if (
    !(
      madeName ||
      // Any generator: version 1 boards are flat, version 2 ones may have foothills (combat C6b),
      // version 3 ones may be cut to an outline (2026-10-24).
      (provenance.kind === "generated" &&
        (provenance.generatorVersion === 1 ||
          provenance.generatorVersion === 2 ||
          provenance.generatorVersion === TACTICAL_BATTLEFIELD_GENERATOR_VERSION))
    ) ||
    !BATTLEFIELD_SIZES.has(provenance.size as string)
  ) {
    return undefined;
  }

  const { width, height } = gridDimensions(0, provenance.size as TacticalBattlefieldSize);
  const tiles = value.grid.tiles;
  if (value.grid.width !== width || value.grid.height !== height || !Array.isArray(tiles) || tiles.length !== height) {
    return undefined;
  }

  // Off the map is no terrain of the board's (2026-10-24): it is counted apart.
  const outside = (value.grid as { outside?: unknown }).outside;
  const off = (x: number, y: number) =>
    Array.isArray(outside) && Array.isArray(outside[y]) && (outside[y] as unknown[])[x] === true;
  let offCount = 0;
  const counts = new Map<string, number>();
  for (const [y, row] of tiles.entries()) {
    if (!Array.isArray(row) || row.length !== width) return undefined;
    for (const [x, terrain] of row.entries()) {
      if (!isKnownTerrain(terrain)) return undefined;
      if (off(x, y)) offCount += 1;
      else counts.set(terrain, (counts.get(terrain) ?? 0) + 1);
    }
  }

  const lines = [
    `Seed: ${Number.isInteger(value.seed) ? value.seed : "unknown"}`,
    `Environment: ${typeof value.environment === "string" && /^[a-z]+$/.test(value.environment) ? value.environment : "unspecified"}`,
    `Board size: ${provenance.size}`,
  ];
  if (offCount > 0) {
    const outline =
      typeof provenance.outline === "string" && /^[a-z]+$/.test(provenance.outline) ? provenance.outline : "shaped";
    lines.push(`Outline: ${outline}, ${offCount} squares off the map`);
  }
  if (madeName) {
    lines.push(`Board: "${madeName}", made by hand for this place (fought on exactly as made)`);
  } else {
    const briefResult = validateTacticalBattlefieldBrief(provenance.brief);
    const features = briefResult.ok ? briefResult.brief?.features : undefined;
    lines.push(
      `Accepted features: ${features?.length ? features.map((feature) => `${feature.terrain} ${feature.placement} ${feature.shape}`).join("; ") : "none"}`,
    );
  }

  if (counts.size) {
    lines.push(
      `Resolved terrain: ${[...counts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([terrain, count]) => `${terrain} ${count}`)
        .join(", ")}`,
    );
  }
  // Raised ground (combat C6b), counted by level, so the Game Master can tell it: higher ground hits
  // harder and sees further, and a step of two levels or more is a cliff.
  const elevation = (value.grid as { elevation?: unknown }).elevation;
  if (Array.isArray(elevation)) {
    const levels = new Map<number, number>();
    for (const row of elevation) {
      if (!Array.isArray(row)) continue;
      for (const level of row) {
        if (Number.isInteger(level) && level > 0 && level <= 3) levels.set(level, (levels.get(level) ?? 0) + 1);
      }
    }
    if (levels.size) {
      lines.push(
        `Raised ground: ${[...levels.entries()]
          .sort(([a], [b]) => a - b)
          .map(([level, count]) => `height ${level} ${count}`)
          .join(", ")}`,
      );
    }
  }
  return lines.join("\n").slice(0, MAX_SUMMARY_LENGTH);
}
