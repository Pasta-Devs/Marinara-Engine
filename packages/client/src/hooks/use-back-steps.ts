import { useEffect, useRef } from "react";
import { batchBackLayers, registerBackLayer } from "../lib/back-navigation";

/**
 * Back goes up one level at a time: `depth` history entries while a page sits `depth` levels deep (a folder inside a
 * folder), each press runs `stepBack` once. Works for the mouse's back button and the browser's Back on desktop too,
 * not only the phone's swipe, because it is plain history (lib/back-navigation.ts).
 *
 * Entries are added and removed one by one as the depth changes, never all dropped and pushed again, so jumping from
 * one folder to its sibling leaves history alone.
 */
export function useBackSteps(depth: number, stepBack: () => void) {
  const stepRef = useRef(stepBack);
  const releases = useRef<Array<() => void>>([]);

  useEffect(() => {
    stepRef.current = stepBack;
  });

  useEffect(() => {
    const wanted = Math.max(0, depth);
    if (releases.current.length === wanted) return;
    batchBackLayers(() => {
      while (releases.current.length > wanted) releases.current.pop()?.();
      while (releases.current.length < wanted) releases.current.push(registerBackLayer(() => stepRef.current()));
    });
  }, [depth]);

  useEffect(
    () => () => {
      const open = releases.current.splice(0);
      batchBackLayers(() => {
        while (open.length) open.pop()?.();
      });
    },
    [],
  );
}
