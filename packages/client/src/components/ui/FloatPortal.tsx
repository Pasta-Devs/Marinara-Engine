import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { FloatBox } from "./useWindowFloat";

/** Renders children in place, or in the body when `float` says the anchor sits in a popped-out window. */
export function FloatPortal({ float, children }: { float: FloatBox | null; children: ReactNode }) {
  return float ? createPortal(<div data-overhaul-float>{children}</div>, document.body) : <>{children}</>;
}
