// Rebases an agent's settings on save over what another editor saved meanwhile.

import { AGENT_TRACKER_DATA_SECTIONS_SETTING } from "@marinara-engine/shared";
import { rebaseUntouchedKeys } from "./mari-editor-fields";

type Settings = Record<string, unknown>;

function trackerDataFlag(settings: Settings): unknown {
  const sources = settings.contextSources;
  return sources && typeof sources === "object" ? (sources as { trackerData?: unknown }).trackerData : undefined;
}

function trackerDataMode(settings: Settings): string {
  return JSON.stringify([trackerDataFlag(settings) ?? null, settings[AGENT_TRACKER_DATA_SECTIONS_SETTING] ?? null]);
}

/**
 * `rebaseUntouchedKeys` for agent settings, with the Tracker Data mode (Off / All / Pick) as one unit.
 * The mode spans two keys, `contextSources.trackerData` and the section list, which rebase one by one,
 * so a concurrent edit could save half of each side's mode. The mode comes from this editor when it
 * changed it, else from the other editor when that changed it; other context sources keep rebasing
 * as before.
 *
 * @param sent the settings this save sends
 * @param sentAtLoad what the form sent for the agent as loaded
 * @param before the stored settings when the form loaded
 * @param now the stored settings now
 */
export function rebaseAgentSettings(sent: Settings, sentAtLoad: Settings, before: Settings, now: Settings): Settings {
  const rebased = rebaseUntouchedKeys(sent, sentAtLoad, before, now);
  const modeSource =
    trackerDataMode(sent) !== trackerDataMode(sentAtLoad)
      ? sent
      : trackerDataMode(before) !== trackerDataMode(now)
        ? now
        : null;
  if (!modeSource) return rebased;
  const rebasedSources = rebased.contextSources;
  rebased.contextSources = {
    ...(rebasedSources && typeof rebasedSources === "object" ? rebasedSources : {}),
    trackerData: trackerDataFlag(modeSource),
  };
  const sections = modeSource[AGENT_TRACKER_DATA_SECTIONS_SETTING];
  if (sections === undefined) delete rebased[AGENT_TRACKER_DATA_SECTIONS_SETTING];
  else rebased[AGENT_TRACKER_DATA_SECTIONS_SETTING] = sections;
  return rebased;
}
