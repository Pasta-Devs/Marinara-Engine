// ──────────────────────────────────────────────
// Regex Script Types (SillyTavern-compatible)
// ──────────────────────────────────────────────

/** Where a regex script is applied. */
export type RegexPlacement = "ai_output" | "user_input";

/** A find/replace regex script. */
export interface RegexScript {
  id: string;
  characterId: string | null;
  /** Display name */
  name: string;
  /** Whether this script is active */
  enabled: boolean;
  /** The regex pattern string (without delimiters) */
  findRegex: string;
  /** The replacement string (supports $1, $2, etc.) */
  replaceString: string;
  /** Additional strings to trim from the result */
  trimStrings: string[];
  /** Where to apply this script */
  placement: RegexPlacement[];
  /** Regex flags (e.g. "gi", "gm") */
  flags: string;
  /** Only apply in prompt context (not displayed text) */
  promptOnly: boolean;
  /** Execution order (lower = runs first) */
  order: number;
  /** Optional minimum message depth to apply (null = no limit) */
  minDepth: number | null;
  /** Optional maximum message depth to apply (null = no limit) */
  maxDepth: number | null;
  createdAt: string;
  updatedAt: string;
}
