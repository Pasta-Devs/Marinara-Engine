interface TrackerPanelDesktopWidthInput {
  preferredWidth: number;
  mainLeft: number;
  mainRight: number;
  chatColumnLeft: number;
  chatColumnRight: number;
  side: "left" | "right";
  gap?: number;
}

/** Preserve the requested Tracker width, constraining it only to the main viewport. */
export function resolveTrackerPanelDesktopWidth({
  preferredWidth,
  mainLeft,
  mainRight,
  gap = 0,
}: TrackerPanelDesktopWidthInput) {
  return Math.max(0, Math.min(preferredWidth, Math.floor(mainRight - mainLeft - gap)));
}

/** Scale constrained Tracker contents while retaining a readable lower bound and responsive reflow. */
export function resolveTrackerPanelContentScale(preferredWidth: number, resolvedWidth: number, minimumScale = 0.65) {
  if (preferredWidth <= 0 || resolvedWidth <= 0 || resolvedWidth >= preferredWidth) return 1;
  return Math.max(minimumScale, resolvedWidth / preferredWidth);
}
