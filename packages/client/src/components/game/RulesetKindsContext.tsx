import { createContext, useContext } from "react";

/** Where the menu hands up the kinds a zone strikes, named as it is cast (1.753): Forbiddance's.
 *  Whoever sends the choice adds them to it, for that option only, once. */
export const RulesetKindsContext = createContext<((optionId: string, kinds: string[]) => void) | null>(null);

export function useRulesetKinds() {
  return useContext(RulesetKindsContext);
}
