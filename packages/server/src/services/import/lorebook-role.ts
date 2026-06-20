// ──────────────────────────────────────────────
// Shared helper: clamp an imported lorebook entry role
// ──────────────────────────────────────────────
// Both the SillyTavern lorebook importer and the Marinara native importer
// take an untrusted `role` from a user-supplied file. The manual
// entry-create routes run it through `createLorebookEntrySchema.parse()`,
// which clamps to z.enum(["system","user","assistant"]); the bulk-import
// paths skip that zod parse, so they must clamp here instead. ST exports
// the field as a number (0/1/2), V2/Marinara as a string — handle both and
// fall back to "system" for anything out of the union.
export function resolveLorebookEntryRole(value: unknown): "system" | "user" | "assistant" {
  const roleMap: Record<number, "system" | "user" | "assistant"> = {
    0: "system",
    1: "user",
    2: "assistant",
  };
  if (value === "system" || value === "user" || value === "assistant") return value;
  return roleMap[typeof value === "number" ? value : 0] ?? "system";
}
