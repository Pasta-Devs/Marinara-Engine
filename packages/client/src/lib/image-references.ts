// Order helpers for the References row of image generation windows.

/** Move the picture at `from` to `to`, keeping the others in order. */
export function moveImageReference<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/** The pictures that are actually sent: those within the connection's limit (all while it is unknown). */
export function sentImageReferences<T>(list: readonly T[], limit: number | null): T[] {
  return limit === null ? [...list] : list.slice(0, Math.max(0, limit));
}
