/**
 * A name without the kind said after it: "Wolf (Beast)" and "Reef Shark, Beast" are the Wolf and the
 * Reef Shark. Done with indexes, not a pattern, so a long name with many spaces costs one pass.
 */
export function withoutTrailingKind(text: string): string {
  let name = text.trim();
  if (name.endsWith(")")) {
    const open = name.lastIndexOf("(");
    if (open >= 0 && !name.slice(open + 1, -1).includes(")")) name = name.slice(0, open).trimEnd();
  }
  const comma = name.lastIndexOf(",");
  if (comma >= 0) name = name.slice(0, comma);
  return name.trim();
}
