/**
 * Small repeatable random sources for lorebook scans. Shared by the Active Context preview (lorebooks.routes) and
 * the seeded inclusion-group winners in the keyword scanner, so both use the same generator.
 */

/** FNV-1a hash of a string, as an unsigned 32-bit integer. */
export function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A mulberry32 generator seeded from `seedText`; the same text always gives the same sequence. */
export function createSeededRandom(seedText: string): () => number {
  let state = stableHash(seedText) || 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
