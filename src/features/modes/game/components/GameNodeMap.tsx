// ──────────────────────────────────────────────
// Game: Node Map (dungeons/interiors)
// ──────────────────────────────────────────────
import { Check, Pencil, X } from "lucide-react";
import { useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import { cn } from "../../../../shared/lib/utils";
import type { GameMap } from "../../../../engine/contracts/types/game";

export interface GameNodeEditPatch {
  emoji?: string;
  label?: string;
}

interface GameNodeMapProps {
  map: GameMap;
  onNodeClick: (nodeId: string) => void;
  onEditNode?: (nodeId: string, patch: GameNodeEditPatch) => void | Promise<void>;
  selectedNodeId?: string | null;
  /** When true, node clicks are disabled (e.g. narration still playing) */
  disabled?: boolean;
  showPartyPosition?: boolean;
  zoom?: number;
  topLeftAction?: ReactNode;
  topRightAction?: ReactNode;
}

export function GameNodeMap({
  map,
  onNodeClick,
  onEditNode,
  selectedNodeId,
  disabled,
  showPartyPosition = true,
  zoom = 1,
  topLeftAction,
  topRightAction,
}: GameNodeMapProps) {
  const nodes = useMemo(() => map.nodes ?? [], [map.nodes]);
  const edges = useMemo(() => map.edges ?? [], [map.edges]);
  const currentNodeId = showPartyPosition && typeof map.partyPosition === "string" ? map.partyPosition : null;
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(
    selectedNodeId ?? currentNodeId ?? nodes[0]?.id ?? null,
  );
  const [draftEmoji, setDraftEmoji] = useState("");
  const [draftLabel, setDraftLabel] = useState("");
  const [editorError, setEditorError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const editingNode = nodes.find((node) => node.id === editingNodeId) ?? nodes[0] ?? null;

  const handleTap = useCallback(
    (nodeId: string, isClickable: boolean) => {
      // On mobile: first tap shows tooltip, second tap navigates
      if (hoveredNodeId === nodeId && isClickable) {
        onNodeClick(nodeId);
      } else {
        setHoveredNodeId(nodeId);
      }
    },
    [hoveredNodeId, onNodeClick],
  );

  useEffect(() => {
    if (!editorOpen) return;
    if (editingNode && nodes.some((node) => node.id === editingNode.id)) return;
    setEditingNodeId(selectedNodeId ?? currentNodeId ?? nodes[0]?.id ?? null);
  }, [currentNodeId, editingNode, editorOpen, nodes, selectedNodeId]);

  useEffect(() => {
    if (!editingNode) return;
    setDraftEmoji(editingNode.emoji || "");
    setDraftLabel(editingNode.label || "");
    setEditorError(null);
  }, [editingNode]);

  const saveNodeEdit = useCallback(async () => {
    if (!editingNode || !onEditNode) return;

    const nextLabel = draftLabel.trim();
    if (!nextLabel) {
      setEditorError("Location name is required.");
      return;
    }

    const nextEmoji = draftEmoji.trim() || editingNode.emoji || "📍";
    setSavingEdit(true);
    setEditorError(null);
    try {
      await onEditNode(editingNode.id, {
        emoji: nextEmoji,
        label: nextLabel,
      });
      setEditorOpen(false);
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "Failed to update location.");
    } finally {
      setSavingEdit(false);
    }
  }, [draftEmoji, draftLabel, editingNode, onEditNode]);

  // Guard against empty nodes — no SVG to render
  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center rounded border border-[var(--border)] bg-gray-900/30 p-4 text-xs text-[var(--muted-foreground)]">
        No map nodes available
      </div>
    );
  }

  // Calculate SVG bounds from node positions
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const padding = 40;
  const minX = Math.min(...xs) - padding;
  const maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding;
  const maxY = Math.max(...ys) + padding;
  const viewWidth = maxX - minX || 200;
  const viewHeight = maxY - minY || 200;
  const zoomOutScale = Math.min(zoom, 1);
  const visibleViewWidth = viewWidth / zoomOutScale;
  const visibleViewHeight = viewHeight / zoomOutScale;
  const centerX = minX + viewWidth / 2;
  const centerY = minY + viewHeight / 2;
  const visibleMinX = centerX - visibleViewWidth / 2;
  const visibleMinY = centerY - visibleViewHeight / 2;
  const mapContentWidth = `${Math.max(zoom, 1) * 100}%`;

  // Build adjacency for current node highlighting
  const adjacentIds = new Set<string>();
  for (const edge of edges) {
    if (edge.from === currentNodeId) adjacentIds.add(edge.to);
    if (edge.to === currentNodeId) adjacentIds.add(edge.from);
  }

  const visualScale = Math.pow(Math.max(zoom, 1), -1.12);
  const edgeStrokeWidth = 2 * visualScale;
  const nodeRadius = 16 * visualScale;
  const emojiFontSize = 12 * visualScale;
  const tooltipWidth = 80 * visualScale;
  const tooltipHeight = 16 * visualScale;
  const tooltipRadius = 4 * visualScale;
  const tooltipLabelOffset = 22 * visualScale;
  const tooltipTopOffset = 32 * visualScale;
  const tooltipFontSize = 7 * visualScale;

  return (
    <div className="relative" onMouseLeave={() => setHoveredNodeId(null)}>
      {topLeftAction}
      {topRightAction}
      {onEditNode && (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setEditorOpen((open) => !open);
            }}
            onPointerDown={(event) => event.stopPropagation()}
            className={cn(
              "absolute top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-md border border-white/15 bg-black/85 text-white/80 shadow-lg shadow-black/35 transition-colors hover:bg-black hover:text-white",
              topLeftAction ? "left-9" : "left-1.5",
              editorOpen && "border-[var(--primary)]/50 text-white ring-1 ring-[var(--primary)]/30",
            )}
            title="Edit map locations"
            aria-label="Edit map locations"
            aria-expanded={editorOpen}
          >
            <Pencil size={11} />
          </button>
          {editorOpen && editingNode && (
            <div
              className="absolute left-1.5 right-1.5 top-9 z-30 rounded-lg border border-white/15 bg-black/90 p-2 text-[0.6875rem] text-white shadow-xl shadow-black/40 backdrop-blur"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="mb-2 flex items-center gap-1.5">
                <Pencil size={11} className="shrink-0 text-white/65" />
                <select
                  value={editingNode.id}
                  onChange={(event) => setEditingNodeId(event.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/10 px-2 py-1 text-[0.6875rem] text-white outline-none focus:border-[var(--primary)]"
                  aria-label="Choose map location to edit"
                >
                  {nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.emoji || "📍"} {node.label || node.id}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                  title="Close location editor"
                  aria-label="Close location editor"
                >
                  <X size={12} />
                </button>
              </div>
              <div className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-1.5">
                <input
                  value={draftEmoji}
                  onChange={(event) => setDraftEmoji(Array.from(event.target.value).slice(0, 4).join(""))}
                  className="h-8 rounded-md border border-white/10 bg-white/10 px-2 text-center text-base outline-none focus:border-[var(--primary)]"
                  aria-label="Location emoji"
                />
                <input
                  value={draftLabel}
                  onChange={(event) => setDraftLabel(event.target.value)}
                  className="h-8 min-w-0 rounded-md border border-white/10 bg-white/10 px-2 text-[0.75rem] text-white outline-none focus:border-[var(--primary)]"
                  aria-label="Location name"
                />
                <button
                  type="button"
                  onClick={saveNodeEdit}
                  disabled={savingEdit}
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Save location"
                  aria-label="Save location"
                >
                  <Check size={13} />
                </button>
              </div>
              {editorError && <p className="mt-1.5 text-[0.625rem] text-red-300">{editorError}</p>}
            </div>
          )}
        </>
      )}
      <div
        className="w-full overflow-auto rounded"
        style={{
          aspectRatio: `${viewWidth} / ${viewHeight}`,
          maxHeight: "min(52vh, 340px)",
        }}
      >
        <svg
          viewBox={`${visibleMinX} ${visibleMinY} ${visibleViewWidth} ${visibleViewHeight}`}
          className="block rounded border border-[var(--border)] bg-gray-900/30"
          style={{ width: mapContentWidth }}
        >
          {/* Edges */}
          {edges.map((edge) => {
            const from = nodes.find((n) => n.id === edge.from);
            const to = nodes.find((n) => n.id === edge.to);
            if (!from || !to) return null;
            const isTraversed = from.discovered && to.discovered;
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={isTraversed ? "rgba(168, 162, 158, 0.5)" : "rgba(100, 100, 100, 0.2)"}
                strokeWidth={edgeStrokeWidth}
                strokeDasharray={isTraversed ? "none" : "4 4"}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isCurrent = node.id === currentNodeId;
            const isSelected = node.id === selectedNodeId;
            const isAdjacent = adjacentIds.has(node.id);
            const isDiscovered = !!node.discovered;
            const isClickable = !disabled && (isCurrent || isAdjacent || isDiscovered);
            const isHovered = hoveredNodeId === node.id;

            return (
              <g
                key={node.id}
                onClick={() => handleTap(node.id, isClickable)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                className={cn(isClickable && "cursor-pointer")}
              >
                {/* Background circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={nodeRadius}
                  fill={
                    isCurrent
                      ? "rgba(255, 255, 255, 0.2)"
                      : isSelected
                        ? "rgba(56, 189, 248, 0.18)"
                        : node.discovered
                          ? "rgba(100, 100, 100, 0.3)"
                          : "rgba(50, 50, 50, 0.4)"
                  }
                  stroke={
                    isCurrent
                      ? "#ffffff"
                      : isSelected
                        ? "#38bdf8"
                        : isAdjacent && !disabled
                          ? "#a8a29e"
                          : isDiscovered && !disabled
                            ? "rgba(148, 163, 184, 0.45)"
                            : "transparent"
                  }
                  strokeWidth={(isCurrent || isSelected ? 2 : 1) * visualScale}
                />
                {/* Emoji */}
                <text
                  x={node.x}
                  y={node.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={emojiFontSize}
                  className="pointer-events-none"
                >
                  {node.discovered ? node.emoji : "❓"}
                </text>
                {/* Tooltip label — shown on hover/tap only */}
                {node.discovered && isHovered && (
                  <>
                    <rect
                      x={node.x - tooltipWidth / 2}
                      y={node.y - tooltipTopOffset}
                      width={tooltipWidth}
                      height={tooltipHeight}
                      rx={tooltipRadius}
                      fill="rgba(0, 0, 0, 0.85)"
                      stroke="rgba(255, 255, 255, 0.15)"
                      strokeWidth={0.5 * visualScale}
                      className="pointer-events-none"
                    />
                    <text
                      x={node.x}
                      y={node.y - tooltipLabelOffset}
                      textAnchor="middle"
                      fontSize={tooltipFontSize}
                      fill="rgba(255, 255, 255, 0.9)"
                      className="pointer-events-none"
                    >
                      {node.label.length > 16 ? node.label.slice(0, 15) + "…" : node.label}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
