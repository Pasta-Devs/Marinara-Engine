import { type ReactNode } from "react";
import { cn } from "../../../../shared/lib/utils";
import { visibleText } from "./tracker-display.helpers";
import { FittedText, InlineEdit } from "./tracker-data-sidebar.controls";
import { getOppositeTrackerProfileSide, type TrackerProfileSide } from "../lib/tracker-profile-layout";

const NAMEPLATE_CLASS = "tracker-profile-nameplate";
const NAMEPLATE_TOP_AURA_CLASS = "tracker-profile-nameplate-top-aura";
const NAMEPLATE_TOP_GLINT_CLASS = "tracker-profile-nameplate-top-glint";
const NAMEPLATE_JOIN_CLASS = "tracker-profile-nameplate-join";
const NAMEPLATE_CLASP_BASE_CLASS = "tracker-profile-nameplate-clasp";
const NAMEPLATE_CONTROL_CLASP_POSITION_BY_SIDE = {
  left: "tracker-profile-nameplate-clasp--control-left",
  right: "tracker-profile-nameplate-clasp--control-right",
} satisfies Record<TrackerProfileSide, string>;
const NAMEPLATE_ORNAMENT_CLASP_POSITION_BY_SIDE = {
  left: "tracker-profile-nameplate-clasp--ornament-left",
  right: "tracker-profile-nameplate-clasp--ornament-right",
} satisfies Record<TrackerProfileSide, string>;
const NAMEPLATE_CLASP_TONE_CLASS = {
  control: "tracker-profile-nameplate-clasp--control",
  ornament: "tracker-profile-nameplate-clasp--ornament",
} satisfies Record<"control" | "ornament", string>;
const NAMEPLATE_CLASP_DIAMOND_CLASS = "tracker-profile-nameplate-clasp-diamond";
const NAMEPLATE_CLASP_CENTER_CLASS = "tracker-profile-nameplate-clasp-center";
const NAMEPLATE_CLASP_TOP_STROKE_CLASS = "tracker-profile-nameplate-clasp-top-stroke";
const NAMEPLATE_CLASP_BOTTOM_STROKE_CLASS = "tracker-profile-nameplate-clasp-bottom-stroke";
const NAMEPLATE_NAME_ACCENT_BASE_CLASS = "tracker-profile-nameplate-name-accent";
const NAMEPLATE_NAME_ACCENT_CLASS_BY_SPACE = {
  open: "tracker-profile-nameplate-name-accent--open",
  reserved: "tracker-profile-nameplate-name-accent--reserved",
} satisfies Record<"open" | "reserved", string>;
const NAMEPLATE_NAME_ACCENT_BAR_CLASS = "tracker-profile-nameplate-name-accent-bar";
const NAMEPLATE_NAME_HALO_CLASS = "tracker-profile-nameplate-name-halo";
const PRIMARY_CONTROL_SLOT_CLASS = "tracker-profile-nameplate-primary-slot";
const PRIMARY_CONTROL_WASH_BASE_CLASS = "tracker-profile-nameplate-primary-wash";
const PRIMARY_CONTROL_WASH_CLASS_BY_SIDE = {
  left: "tracker-profile-nameplate-primary-wash--left",
  right: "tracker-profile-nameplate-primary-wash--right",
} satisfies Record<TrackerProfileSide, string>;
const SECONDARY_CONTROLS_CLASS = "tracker-profile-nameplate-secondary-controls";
const SECONDARY_CONTROL_WASH_BASE_CLASS = "tracker-profile-nameplate-secondary-wash";
const SECONDARY_CONTROL_WASH_CLASS_BY_SIDE = {
  left: "tracker-profile-nameplate-secondary-wash--left",
  right: "tracker-profile-nameplate-secondary-wash--right",
} satisfies Record<TrackerProfileSide, string>;
const NAME_EDIT_CLASS = "tracker-profile-nameplate-edit";
const NAME_PREVIEW_CLASS = "tracker-profile-nameplate-preview";

export const TRACKER_PROFILE_NAMEPLATE_ICON_BUTTON_CLASS = "tracker-profile-nameplate-icon-button";
export const TRACKER_PROFILE_NAMEPLATE_ICON_BUTTON_ACTIVE_CLASS = "tracker-profile-nameplate-icon-button--active";
export const TRACKER_PROFILE_NAMEPLATE_HEADER_BUTTON_CLASS = "tracker-profile-nameplate-header-button";

function TrackerProfileNameplateClasp({
  side,
  tone = "ornament",
}: {
  side: TrackerProfileSide;
  tone?: "control" | "ornament";
}) {
  const positionClass =
    tone === "control"
      ? NAMEPLATE_CONTROL_CLASP_POSITION_BY_SIDE[side]
      : NAMEPLATE_ORNAMENT_CLASP_POSITION_BY_SIDE[side];

  return (
    <div aria-hidden="true" className={cn(NAMEPLATE_CLASP_BASE_CLASS, positionClass, NAMEPLATE_CLASP_TONE_CLASS[tone])}>
      <div className={NAMEPLATE_CLASP_TOP_STROKE_CLASS} />
      <div className={NAMEPLATE_CLASP_DIAMOND_CLASS} />
      <div className={NAMEPLATE_CLASP_CENTER_CLASS} />
      <div className={NAMEPLATE_CLASP_BOTTOM_STROKE_CLASS} />
    </div>
  );
}

function TrackerProfileNameAccentBars({ reserveControlSpace }: { reserveControlSpace: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        NAMEPLATE_NAME_ACCENT_BASE_CLASS,
        NAMEPLATE_NAME_ACCENT_CLASS_BY_SPACE[reserveControlSpace ? "reserved" : "open"],
      )}
    >
      <div className={NAMEPLATE_NAME_ACCENT_BAR_CLASS} />
      <div />
      <div className={NAMEPLATE_NAME_ACCENT_BAR_CLASS} />
    </div>
  );
}

export function TrackerProfileNameplate({
  value,
  placeholder,
  onSave,
  primaryControl,
  primaryControlSide = "left",
  secondaryControls,
  secondaryControlsSide,
  className,
  nameClassName,
}: {
  value: string | null | undefined;
  placeholder: string;
  onSave?: (value: string) => void;
  primaryControl?: ReactNode;
  primaryControlSide?: TrackerProfileSide;
  secondaryControls?: ReactNode;
  secondaryControlsSide?: TrackerProfileSide;
  className?: string;
  nameClassName?: string;
}) {
  const displayValue = visibleText(value, placeholder);
  const hasPrimaryControl = !!primaryControl;
  const hasSecondaryControls = !!secondaryControls;
  const resolvedSecondaryControlsSide = secondaryControlsSide ?? getOppositeTrackerProfileSide(primaryControlSide);
  const reserveControlSpace = hasPrimaryControl || hasSecondaryControls;
  const showSecondaryControlClasp =
    hasSecondaryControls && (!hasPrimaryControl || resolvedSecondaryControlsSide !== primaryControlSide);

  return (
    <div className={cn(NAMEPLATE_CLASS, reserveControlSpace ? "px-6" : "px-2.5", className)}>
      <div className={NAMEPLATE_TOP_AURA_CLASS} />
      <div className={NAMEPLATE_TOP_GLINT_CLASS} />
      <div className={NAMEPLATE_JOIN_CLASS} />
      {hasPrimaryControl && (
        <div className={cn(PRIMARY_CONTROL_WASH_BASE_CLASS, PRIMARY_CONTROL_WASH_CLASS_BY_SIDE[primaryControlSide])} />
      )}
      {hasSecondaryControls && (
        <div
          className={cn(
            SECONDARY_CONTROL_WASH_BASE_CLASS,
            SECONDARY_CONTROL_WASH_CLASS_BY_SIDE[resolvedSecondaryControlsSide],
          )}
        />
      )}
      {hasPrimaryControl && <TrackerProfileNameplateClasp side={primaryControlSide} tone="control" />}
      {!hasPrimaryControl && !hasSecondaryControls && (
        <>
          <TrackerProfileNameplateClasp side="left" />
          <TrackerProfileNameplateClasp side="right" />
        </>
      )}
      {showSecondaryControlClasp && (
        <TrackerProfileNameplateClasp side={resolvedSecondaryControlsSide} tone="control" />
      )}
      <div className={NAMEPLATE_NAME_HALO_CLASS} />
      <TrackerProfileNameAccentBars reserveControlSpace={reserveControlSpace} />

      {hasPrimaryControl && (
        <div className={cn(PRIMARY_CONTROL_SLOT_CLASS, primaryControlSide === "left" ? "left-1" : "right-1")}>
          {primaryControl}
        </div>
      )}

      {hasSecondaryControls && (
        <div className={cn(SECONDARY_CONTROLS_CLASS, resolvedSecondaryControlsSide === "left" ? "left-1" : "right-1")}>
          {secondaryControls}
        </div>
      )}

      {onSave ? (
        <InlineEdit
          value={value ?? ""}
          onSave={onSave}
          placeholder={placeholder}
          className={cn(NAME_EDIT_CLASS, nameClassName)}
          showEditHint={false}
          fitPreview
          fitAlign="center"
          fitMinScale={0.6}
        />
      ) : (
        <FittedText
          className={cn(NAME_PREVIEW_CLASS, nameClassName)}
          title={displayValue}
          align="center"
          minScale={0.6}
        >
          {displayValue}
        </FittedText>
      )}
    </div>
  );
}
