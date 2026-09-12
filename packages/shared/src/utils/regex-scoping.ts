import type { ScopedRegexMode } from "../types/regex.js";

/** An explicit chat choice wins; unset/cleared overrides inherit the preset. */
export function resolveScopedRegexMode(override?: unknown, presetDefault?: unknown): ScopedRegexMode {
  for (const value of [override, presetDefault]) {
    if (value === "disabled" || value === "exclusive" || value === "chat") return value;
  }
  return "disabled";
}
