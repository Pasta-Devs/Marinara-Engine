export type TrackerStatDensity = "normal" | "compact" | "tight";
export type TrackerStatDisplayScale = "standard" | "roomy" | "spacious";

export const TRACKER_FEATURED_CHARACTER_META_KEY = "trackerFeaturedCharacterKeys";
export const TRACKER_TEXT_ROW = "text-[0.6875rem] leading-[0.875rem]";
export const TRACKER_TEXT_MICRO = "text-[0.625rem] leading-[0.75rem]";
export const TRACKER_BAR = "h-[3px] rounded-[1px]";
export const TRACKER_PROFILE_PORTRAIT_COLUMN_RIGHT_CLASS =
  "grid-cols-[minmax(0,1fr)_clamp(5.25rem,38cqw,6.75rem)] @min-[380px]:grid-cols-[minmax(0,1fr)_9.25rem]";
export const TRACKER_PROFILE_PORTRAIT_COLUMN_LEFT_CLASS =
  "grid-cols-[clamp(5.25rem,38cqw,6.75rem)_minmax(0,1fr)] @min-[380px]:grid-cols-[9.25rem_minmax(0,1fr)]";
export const TRACKER_PROFILE_PORTRAIT_FRAME_STAGE_CLASS =
  "tracker-profile-portrait-frame-stage h-[9rem] min-h-[9rem] @min-[380px]:h-[10.5rem] @min-[380px]:min-h-[10.5rem]";
export const TRACKER_PROFILE_PORTRAIT_FRAME_STAGE_MAX_CLASS =
  "tracker-profile-portrait-frame-stage tracker-profile-portrait-frame-stage--max h-[9rem] max-h-[9rem] @min-[380px]:h-[10.5rem] @min-[380px]:max-h-[10.5rem]";
export const TRACKER_PROFILE_PORTRAIT_MEDIA_STAGE_REM = 7.75;
export const TRACKER_PROFILE_PORTRAIT_ROOMY_MEDIA_STAGE_REM = 9.25;

export const TRACKER_PORTRAIT_DEFAULT_FOCUS_X = 50;
export const TRACKER_PORTRAIT_DEFAULT_FOCUS_Y = 36;
export const TRACKER_PORTRAIT_EXPRESSION_DEFAULT_FOCUS_Y = 88;
export const TRACKER_PORTRAIT_EXPRESSION_FOCUS_Y_MAX = 140;
export const TRACKER_PORTRAIT_DEFAULT_ZOOM = 1;
export const TRACKER_PORTRAIT_MIN_ZOOM = 0.75;
export const TRACKER_PORTRAIT_MAX_ZOOM = 2.35;
export const TRACKER_PORTRAIT_ZOOM_STEP = 0.12;
export const FEATURED_PORTRAIT_DEFAULT_FOCUS_X = TRACKER_PORTRAIT_DEFAULT_FOCUS_X;
export const FEATURED_PORTRAIT_DEFAULT_FOCUS_Y = TRACKER_PORTRAIT_DEFAULT_FOCUS_Y;
export const FEATURED_CHARACTER_PORTRAIT_STAGE_REM = TRACKER_PROFILE_PORTRAIT_MEDIA_STAGE_REM;
export const FEATURED_CHARACTER_PORTRAIT_ROOMY_STAGE_REM = TRACKER_PROFILE_PORTRAIT_ROOMY_MEDIA_STAGE_REM;

export const PERSONA_STAT_DENSITY_HEIGHT_REM: Record<TrackerStatDensity, number> = {
  normal: 1.25,
  compact: 0.95,
  tight: 0.72,
};
export const PERSONA_ADD_STAT_DENSITY_HEIGHT_REM: Record<TrackerStatDensity, number> = {
  normal: 1.25,
  compact: 1,
  tight: 0.82,
};
