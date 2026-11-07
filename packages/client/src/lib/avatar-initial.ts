// ──────────────────────────────────────────────
// The letter shown in place of a missing avatar
//
// Names that start with a tag ("[tablet] Mara Quill") showed "[" (panel 3, PN9).
// The tag is dropped the same way tab titles drop it, and the first letter or
// digit (or, failing that, the first character) is used.
// ──────────────────────────────────────────────

export function avatarInitial(name: string | null | undefined, fallback = "?"): string {
  const trimmed = (name ?? "").trim();
  const untagged = trimmed.replace(/^(?:\[[^\]]{0,24}\]\s*)+/, "").trim() || trimmed;
  const letter = untagged.match(/[\p{L}\p{N}]/u)?.[0] ?? Array.from(untagged)[0];
  return letter ? letter.toLocaleUpperCase() : fallback;
}
