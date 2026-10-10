import type { CommandCenterCategoryFilter } from "../../../lib/command-center";
import type { OmnibarCategory, OmnibarResult } from "../../../lib/omnibar-search";
import type { OmnibarScopeId } from "../../../lib/omnibar-scope";
import type { RichCommandResult } from "../../command-center/command-result-preview.types";
export { formatDate, readNamedRow, readString } from "../../../lib/omnibar-row-readers";

/** The pane union lives with the session state that persists it. */
export type { CommandCenterPane as OmnibarPane } from "../../../lib/command-center";
export type RankedOmnibarResult = OmnibarResult & {
  command: RichCommandResult["command"];
};

// Every category a filter maps to is also a typed scope prefix, so the chips can
// derive their scope from this map instead of restating the pairing.
export const FILTER_CATEGORY: Partial<Record<CommandCenterCategoryFilter, OmnibarCategory & OmnibarScopeId>> = {
  chats: "chat",
  characters: "character",
  personas: "persona",
  lorebooks: "lorebook",
  presets: "preset",
  connections: "connection",
  agents: "agent",
  settings: "settings",
  docs: "docs",
};

/**
 * The categories offered as chips on the empty omnibar, in the order the filter
 * bar uses. Each chip's scope comes from FILTER_CATEGORY, so the plural label and
 * the singular scope cannot drift apart.
 *
 * Chips exist because a typed prefix is otherwise undiscoverable: nothing tells a
 * first-time user that `char:` is a thing. Clicking one writes the prefix into the
 * input, so the syntax is learned by watching it appear.
 */
export const OMNIBAR_SCOPE_CHIP_FILTERS: readonly CommandCenterCategoryFilter[] = [
  "chats",
  "characters",
  "personas",
  "lorebooks",
  "presets",
  "settings",
];

export function isRichResult(result: RankedOmnibarResult, preview = result.preview?.()) {
  return Boolean(
    preview &&
    (preview.description ||
      preview.media ||
      preview.facts?.length ||
      result.command.availability?.status !== "available"),
  );
}

/**
 * The second line of a result row, or null when there is nothing worth saying.
 * A bare fact value ("1") and the category name ("Settings" under a SETTINGS
 * header) both used to land here and read as filler, so neither is a fallback
 * any more — the row just goes single-line instead.
 */
export function resultMetadata(result: RankedOmnibarResult, preview = result.preview?.()): string | null {
  if (result.control?.type === "choice") return result.control.label;
  const text = result.contextLabel ?? preview?.subtitle ?? result.description ?? null;
  const trimmed = text?.trim();
  if (!trimmed) return null;
  // Some imported cards keep a JSON blob in `description`. It is never readable
  // at one truncated line, so show nothing rather than "{ "character": "Eliza"…".
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return null;
  return trimmed;
}

export function getOmnibarResourceId(result: Pick<RankedOmnibarResult, "id">) {
  const parts = result.id.split(":");
  return parts[0] === "context" ? (parts.at(-1) ?? "") : parts.slice(1).join(":");
}
