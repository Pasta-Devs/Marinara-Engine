/** Stable for a calendar day and independent of catalog ordering. No stored duplicate catalog. */
export function dailyCharacters<T extends { id: string }>(rows: readonly T[], day: string, count = 4): T[] {
  const rank = (id: string) => {
    let hash = 2166136261;
    for (const char of `${day}:${id}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return hash >>> 0;
  };
  return [...rows].sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id)).slice(0, count);
}
