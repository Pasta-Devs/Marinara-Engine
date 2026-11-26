export type WindowResizeCorner = "ne" | "nw" | "se" | "sw";

export const isWindowResizeCorner = (edge: string): edge is WindowResizeCorner => edge.length === 2;

/**
 * The corner resize cue every resizable window shares (chat windows, Prof. Mari's floating window): a small chip
 * just outside the corner, its chevron turned to that corner. Render it inside the corner's resize handle, so a
 * drag on it resizes. The bottom-right one shows while the pointer is in the window; every corner shows its own
 * when the pointer gets close to it (globals.css, `.mari-window__resize-grip`).
 */
export function WindowResizeGrip({ corner }: { corner: WindowResizeCorner }) {
  return <span aria-hidden="true" data-corner={corner} className="mari-window__resize-grip" />;
}
