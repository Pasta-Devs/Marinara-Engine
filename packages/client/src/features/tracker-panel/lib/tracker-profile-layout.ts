import type { TrackerPanelSide } from "../../../stores/ui.store";
export type TrackerProfileSide = "left" | "right";

export const TRACKER_PROFILE_GRID_CLASS = "relative z-[1] grid gap-y-0 gap-x-0";

export const TRACKER_PROFILE_GRID_CLASS_BY_PORTRAIT_SIDE = {
  left: "grid-cols-[clamp(5.25rem,38cqw,6.75rem)_minmax(0,1fr)] @min-[380px]:grid-cols-[9.25rem_minmax(0,1fr)]",
  right: "grid-cols-[minmax(0,1fr)_clamp(5.25rem,38cqw,6.75rem)] @min-[380px]:grid-cols-[minmax(0,1fr)_9.25rem]",
} satisfies Record<TrackerProfileSide, string>;

export const TRACKER_PROFILE_ORDER_CLASS_BY_SIDE = {
  left: "order-1 @min-[380px]:col-start-1",
  right: "order-2 @min-[380px]:col-start-2",
} satisfies Record<TrackerProfileSide, string>;

export const TRACKER_PROFILE_DETAILS_SEAM_BORDER_CLASS_BY_SIDE = {
  left: "border-r",
  right: "border-l",
} satisfies Record<TrackerProfileSide, string>;

export const TRACKER_PROFILE_PORTRAIT_LOWER_OUTSIDE_FRAME_CLASS_BY_SIDE = {
  left: "rounded-l-[0.875rem] border-l",
  right: "rounded-r-[0.875rem] border-r",
} satisfies Record<TrackerProfileSide, string>;

export const TRACKER_PROFILE_PORTRAIT_LOWER_OUTSIDE_RADIUS_CLASS_BY_SIDE = {
  left: "rounded-l-[0.875rem]",
  right: "rounded-r-[0.875rem]",
} satisfies Record<TrackerProfileSide, string>;

export const TRACKER_PROFILE_PORTRAIT_FADE_CLASS_BY_OUTSIDE_SIDE = {
  left: "right-0 bg-[linear-gradient(270deg,color-mix(in_srgb,var(--background)_44%,transparent),transparent)]",
  right: "left-0 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--background)_44%,transparent),transparent)]",
} satisfies Record<TrackerProfileSide, string>;

export function getOppositeTrackerProfileSide(side: TrackerProfileSide): TrackerProfileSide {
  return side === "left" ? "right" : "left";
}

export function getTrackerProfilePortraitSide(trackerPanelSide: TrackerPanelSide): TrackerProfileSide {
  return trackerPanelSide === "left" ? "right" : "left";
}
