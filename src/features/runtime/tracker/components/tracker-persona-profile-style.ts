import type { CSSProperties } from "react";
import type { Persona } from "../../../../engine/contracts/types/persona";
import { parseTrackerCardColorConfig } from "../../../../shared/lib/tracker-card-colors";
import { visibleText } from "./tracker-display.helpers";
import { type TrackerProfileColors, getTrackerProfilePalette } from "./tracker-profile-colors";
import { withTrackerProfileStyle } from "./tracker-profile-style-vars";

function getPersonaProfileColors(persona: Persona | null): TrackerProfileColors {
  return {
    dialogueColor: persona?.dialogueColor,
    nameColor: persona?.nameColor,
    boxColor: persona?.boxColor,
    trackerCardColors: parseTrackerCardColorConfig(persona?.trackerCardColors),
  };
}

export function getPersonaAmbienceStyle(
  persona: Persona | null,
  options: { paintBackground?: boolean } = {},
): CSSProperties {
  const palette = getTrackerProfilePalette(getPersonaProfileColors(persona));
  const style = withTrackerProfileStyle(palette);

  if (options.paintBackground === false) {
    delete style.background;
    delete style.backgroundBlendMode;
  }

  return style;
}

export function getPersonaInitial(persona: Persona | null) {
  return (Array.from(visibleText(persona?.name, "P"))[0] ?? "P").toUpperCase();
}
