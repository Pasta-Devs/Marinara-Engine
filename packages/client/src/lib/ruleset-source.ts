import type { CommunityRulesetSource } from "@marinara-engine/shared";

/** Where an imported ruleset came from, short enough for one line: the repository's host and owner.
 *  Null for a file the user picked, and for a url that will not parse, so the caller shows its own
 *  localized "imported file" wording instead of a half-readable address. Shared by the Agents panel
 *  and the game setup chooser, which both label the same rulesets. */
export function rulesetRepositoryLabel(source: CommunityRulesetSource): string | null {
  if (source.kind !== "repository" || !source.url) return null;
  try {
    const url = new URL(source.url);
    const owner = url.pathname.split("/").filter(Boolean)[0];
    return owner ? `${url.host}/${owner}` : url.host;
  } catch {
    return null;
  }
}
