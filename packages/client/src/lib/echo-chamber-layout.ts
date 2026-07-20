interface EchoChamberTopLayoutInput {
  baseTop: number;
  containerTop: number;
  containerBottom: number;
  viewportBottom: number;
  bottomClearance: number;
  trackerBottom?: number | null;
  stackGap?: number;
}

interface EchoChamberTopLayout {
  top: number;
  maxHeight: number;
}

/** Resolve a top-corner Echo Chamber position without letting it leave the visible chat area. */
export function resolveEchoChamberTopLayout({
  baseTop,
  containerTop,
  containerBottom,
  viewportBottom,
  bottomClearance,
  trackerBottom,
  stackGap = 0,
}: EchoChamberTopLayoutInput): EchoChamberTopLayout {
  const trackerTop = trackerBottom == null ? baseTop : Math.ceil(trackerBottom - containerTop + stackGap);
  const top = Math.max(baseTop, trackerTop);
  const visibleBottom = Math.min(containerBottom, viewportBottom);
  const maxHeight = Math.max(0, Math.floor(visibleBottom - containerTop - top - bottomClearance));

  return { top, maxHeight };
}
