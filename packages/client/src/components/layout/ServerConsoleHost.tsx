// ──────────────────────────────────────────────
// Server console host: mounts the console window once, app-wide, only while it is open
//
// The window and its log feed load on first open, and leaving it closed polls nothing.
// ──────────────────────────────────────────────
import { lazy, Suspense } from "react";
import { SERVER_CONSOLE_WINDOW_ID, useFloatingWindowStore } from "../../stores/floating-window.store";

const LazyServerConsoleWindow = lazy(() =>
  import("./ServerConsoleWindow").then((module) => ({ default: module.ServerConsoleWindow })),
);

export function ServerConsoleHost() {
  const open = useFloatingWindowStore((state) => state.open[SERVER_CONSOLE_WINDOW_ID] === true);
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <LazyServerConsoleWindow />
    </Suspense>
  );
}
