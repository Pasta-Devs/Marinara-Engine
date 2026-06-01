import { Blend, Brush, Crosshair, Eraser, Hand, Wand2, ZoomIn, ZoomOut, type LucideIcon } from "lucide-react";
import type { CleanupTool } from "./sprite-cleanup-model";

interface SpriteCleanupToolbarProps {
  tool: CleanupTool;
  loading: boolean;
  applying: boolean;
  zoom: number;
  onSelectTool: (tool: CleanupTool) => void;
  onZoomOut: () => void;
  onFitCanvasToStage: () => void;
  onZoomIn: () => void;
}

const cleanupToolOptions: Array<{
  tool: Exclude<CleanupTool, "pan">;
  label: string;
  title: string;
  Icon: LucideIcon;
}> = [
  { tool: "wand", label: "Wand", title: "Select connected pixels", Icon: Wand2 },
  { tool: "clean", label: "Clean", title: "Brush away pixels matching the sampled color", Icon: Crosshair },
  { tool: "erase", label: "Erase", title: "Paint pixels transparent", Icon: Eraser },
  { tool: "brush", label: "Brush", title: "Paint color or restore original pixels", Icon: Brush },
  { tool: "blur", label: "Blur", title: "Paint alpha smoothing over jagged edges", Icon: Blend },
];

export function SpriteCleanupToolbar({
  tool,
  loading,
  applying,
  zoom,
  onSelectTool,
  onZoomOut,
  onFitCanvasToStage,
  onZoomIn,
}: SpriteCleanupToolbarProps) {
  const toolButtonClass = (active: boolean) =>
    [
      "inline-flex min-w-[5.75rem] flex-[1_0_5.75rem] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ring-1 disabled:opacity-45 sm:flex-none sm:px-3",
      active
        ? "bg-[var(--primary)] text-[var(--primary-foreground)] ring-transparent"
        : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-[var(--border)] hover:text-[var(--foreground)]",
    ].join(" ");

  const navigationButtonClass = (active = false) =>
    [
      "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-45",
      active
        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
        : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
    ].join(" ");

  return (
    <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2">
      {cleanupToolOptions.map(({ tool: optionTool, label, title, Icon }) => (
        <button
          key={optionTool}
          type="button"
          onClick={() => onSelectTool(optionTool)}
          disabled={loading || applying}
          className={toolButtonClass(tool === optionTool)}
          aria-pressed={tool === optionTool}
          title={title}
        >
          <Icon size="0.875rem" />
          {label}
        </button>
      ))}

      <div className="flex w-full flex-wrap items-center justify-end gap-1 rounded-lg bg-[var(--secondary)] px-1.5 py-1 sm:ml-auto sm:w-auto">
        <button
          type="button"
          onClick={() => onSelectTool("pan")}
          disabled={loading || applying}
          className={navigationButtonClass(tool === "pan")}
          aria-label="Pan"
          aria-pressed={tool === "pan"}
          title="Pan (middle mouse drag also pans)"
        >
          <Hand size="0.875rem" />
        </button>
        <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-[var(--border)]" />
        <button
          type="button"
          onClick={onZoomOut}
          disabled={loading || applying}
          className={navigationButtonClass()}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <ZoomOut size="0.875rem" />
        </button>
        <button
          type="button"
          onClick={onFitCanvasToStage}
          disabled={loading || applying}
          className="h-7 rounded-md px-2 text-[0.6875rem] font-medium tabular-nums text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-45"
          title="Fit to view"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          disabled={loading || applying}
          className={navigationButtonClass()}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <ZoomIn size="0.875rem" />
        </button>
      </div>
    </div>
  );
}
