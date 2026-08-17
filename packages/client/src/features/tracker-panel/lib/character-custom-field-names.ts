export function normalizeCharacterCustomFieldName(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/\s+/gu, " ");
}

export function makeUniqueCharacterCustomFieldName(customFields: Record<string, string> | null | undefined) {
  const existing = new Set(Object.keys(customFields ?? {}).map(normalizeCharacterCustomFieldName));
  let index = 1;
  let name = "New Field";
  while (existing.has(normalizeCharacterCustomFieldName(name))) {
    index += 1;
    name = `New Field ${index}`;
  }
  return name;
}

export function resolveCharacterCustomFieldName(nextName: string, currentName: string) {
  return nextName.trim() || currentName.trim() || "Field";
}
