// Battle narration for a fight the game's ruleset resolves. Its log keeps every roll (the arithmetic is
// the point of a ruleset), and each blow gains a line of prose above it. The fight screen holds this,
// not the log, because a phone opens and closes the log as a tab while the fight goes on.
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { rulesetNarrationBeats, type DirectedRulesetView } from "@marinara-engine/shared";
import { useCombatNarration } from "./combat-narration";

/** The prose for each told blow, by the running number of its log line. */
export const RulesetNarrationContext = createContext<ReadonlyMap<number, string>>(new Map());

export function useRulesetLineNarration(): ReadonlyMap<number, string> {
  return useContext(RulesetNarrationContext);
}

/**
 * Tells each new blow of a ruleset fight. A fight read back tells only its current round again, so a
 * reload never sends the whole fight.
 */
export function useRulesetFightNarration(view: DirectedRulesetView | undefined): ReadonlyMap<number, string> {
  const { prose, narrate } = useCombatNarration();
  const toldUpTo = useRef<number | null>(null);
  useEffect(() => {
    if (!view) return;
    const newest = view.events.at(-1)?.seq ?? 0;
    if (toldUpTo.current === null) {
      // The first view: from the start of the round on screen.
      let roundStart = -1;
      for (const entry of view.events) if (entry.event.type === "round") roundStart = entry.seq - 1;
      toldUpTo.current = roundStart;
    }
    if (newest <= toldUpTo.current) return;
    const after = toldUpTo.current;
    toldUpTo.current = newest;
    const names = new Map(view.combatants.map((one) => [one.id, one.name]));
    const beats = rulesetNarrationBeats(
      view.events.filter((entry) => entry.seq > after),
      names,
    );
    if (beats.length) narrate(beats);
  }, [view, narrate]);
  return useMemo(() => {
    const bySeq = new Map<number, string>();
    for (const [id, text] of prose) if (id.startsWith("s")) bySeq.set(Number(id.slice(1)), text);
    return bySeq;
  }, [prose]);
}
