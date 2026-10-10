import type { OmnibarResult } from "./omnibar-search";
import type { RankedOmnibarResult } from "../components/layout/omnibar/omnibar-result-view";

const CHOICE_SEPARATOR = "::choice:";

/** How far a searched control value sits below an ordinary hit of the same strength. */
export const CHOICE_SCORE_PENALTY = 60;

/**
 * A choice row's options, as rows.
 *
 * `OmnibarDetailPane` was doing two unrelated jobs: previewing a resource, and
 * editing a `control`. Only the first is a preview. A toggle row already flips
 * on Enter, and a choice row is the same thing with more than two values - so
 * its options belong in the list, not behind a pane.
 *
 * Rows are cloned from the parent so they carry a valid `command`, and the id
 * encodes the value, so choosing one needs no extra bookkeeping.
 */
export function buildChoiceOptionResults<T extends OmnibarResult>(parent: T): T[] {
  const control = parent.control;
  if (control?.type !== "choice") return [];
  const current = String(control.value);
  return (control.options ?? []).map((option) => ({
    ...parent,
    id: `${parent.id}${CHOICE_SEPARATOR}${option.value}`,
    title: option.label,
    // Names its control, so a bare "Dark" row reads as the theme, and matches the
    // phrases people type for it ("dark mode").
    description: control.label,
    aliases: option.aliases,
    snippet: undefined,
    contextLabel: option.value === current ? control.label : undefined,
    control: undefined,
    preview: undefined,
    target: undefined,
    action: undefined,
    chooseValue: () => control.onChange(option.value),
  }));
}

export function buildChoiceOptionRows(parent: RankedOmnibarResult): RankedOmnibarResult[] {
  return buildChoiceOptionResults(parent).map((option) => ({
    ...option,
    command: { ...parent.command, id: option.id, title: option.title },
  }));
}

/**
 * Splice the expanded row's options in immediately after it.
 *
 * Insertion is always *below* the expanded row, never above, so the row the user
 * is looking at does not move. That keeps `reconcileActiveResultId` valid and
 * cannot violate the hover and arrow-key anchoring rules the keyboard contract
 * depends on.
 */
export function expandChoiceRows(
  results: readonly RankedOmnibarResult[],
  expandedId: string | null,
): RankedOmnibarResult[] {
  if (!expandedId) return results as RankedOmnibarResult[];
  const index = results.findIndex((result) => result.id === expandedId);
  if (index < 0) return results as RankedOmnibarResult[];
  const options = buildChoiceOptionRows(results[index]);
  if (options.length === 0) return results as RankedOmnibarResult[];
  return [...results.slice(0, index + 1), ...options, ...results.slice(index + 1)];
}

/** Reads back the parent id and chosen value from an option row's id. */
export function readChoiceOptionId(id: string): { parentId: string; value: string } | null {
  const at = id.lastIndexOf(CHOICE_SEPARATOR);
  if (at < 0) return null;
  return { parentId: id.slice(0, at), value: id.slice(at + CHOICE_SEPARATOR.length) };
}
