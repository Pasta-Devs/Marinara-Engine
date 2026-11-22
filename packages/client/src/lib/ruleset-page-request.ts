// ──────────────────────────────────────────────
// Library > Assets > Rulesets: what Chat settings asks the page to open
//
// Chat settings' "New ruleset…" and "Edit ruleset" open the Rulesets page instead of the builder
// window (new layout). The request says which ruleset (or a new one), and which chat to pin it in
// once saved, so saving still pins and offers the way back. Kept apart from the page so Chat settings
// does not load the builder to set it.
// ──────────────────────────────────────────────
import { create } from "zustand";

export type RulesetPageRequest = {
  /** "new", or the ruleset's list key (`<packageId|local>::<id>`). */
  open: string;
  /** The chat the request came from: saving pins the ruleset there and offers Back to chat. */
  chatId?: string;
  /** Pin on save: always for an edit; for a new ruleset only in a chat that has none yet. */
  pinOnSave?: boolean;
};

export const useRulesetPageRequest = create<{
  request: RulesetPageRequest | null;
  setRequest: (request: RulesetPageRequest | null) => void;
}>((set) => ({ request: null, setRequest: (request) => set({ request }) }));

export function rulesetRowKey(entry: { packageId: string | null; definition: { id: string } }) {
  return `${entry.packageId ?? "local"}::${entry.definition.id}`;
}
