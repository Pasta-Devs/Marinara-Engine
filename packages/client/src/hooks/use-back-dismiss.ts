import { useEffect, useRef } from "react";
import { registerBackLayer } from "../lib/back-navigation";

/**
 * Makes a mounted overlay dismissable with the hardware / gesture back button.
 *
 * Registrations are a LIFO stack, so the most recently opened overlay is the
 * one a back press closes. `onDismiss` is read through a ref, so an inline
 * arrow function will not churn the registration.
 */
export function useBackDismiss(active: boolean, onDismiss: () => void) {
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!active) return;
    return registerBackLayer(() => dismissRef.current());
  }, [active]);
}
