// ──────────────────────────────────────────────
// Game: Checkpoint Manager
//
// Lists auto-saved and manual checkpoints,
// allows loading (restoring) or creating
// new save points.
// ──────────────────────────────────────────────
import { useState, useCallback } from "react";
import { X, Save, RotateCcw, Trash2, Shield, Swords, MapPin, Clock } from "lucide-react";
import { cn } from "../../lib/utils";
import { toast } from "sonner";
import { useGameCheckpoints, useCreateCheckpoint, useLoadCheckpoint, useDeleteCheckpoint } from "../../hooks/use-game";
import type { GameCheckpoint, CheckpointTrigger } from "@marinara-engine/shared";

interface GameCheckpointsProps {
  chatId: string;
  onClose: () => void;
  onLoaded?: () => void;
}

const TRIGGER_ICONS: Record<CheckpointTrigger, typeof Save> = {
  manual: Save,
  session_start: Clock,
  session_end: Clock,
  combat_start: Swords,
  combat_end: Shield,
  location_change: MapPin,
  auto_interval: Clock,
};

const TRIGGER_LABELS: Record<CheckpointTrigger, string> = {
  manual: "Manual Save",
  session_start: "Session Start",
  session_end: "Session End",
  combat_start: "Combat Start",
  combat_end: "Combat End",
  location_change: "Location Change",
  auto_interval: "Auto-Save",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

export function GameCheckpoints({ chatId, onClose, onLoaded }: GameCheckpointsProps) {
  const { data: checkpoints, refetch } = useGameCheckpoints(chatId);
  const createCheckpoint = useCreateCheckpoint();
  const loadCheckpoint = useLoadCheckpoint();
  const deleteCheckpoint = useDeleteCheckpoint();
  const [newLabel, setNewLabel] = useState("");
  const [confirmLoadId, setConfirmLoadId] = useState<string | null>(null);

  const handleCreate = useCallback(() => {
    const label = newLabel.trim() || "Quick Save";
    createCheckpoint.mutate(
      { chatId, label, triggerType: "manual" },
      {
        onSuccess: () => {
          toast.success("Checkpoint saved");
          setNewLabel("");
          refetch();
        },
        onError: () => toast.error("Failed to save checkpoint"),
      },
    );
  }, [chatId, newLabel, createCheckpoint, refetch]);

  const handleLoad = useCallback(
    (cp: GameCheckpoint) => {
      loadCheckpoint.mutate(
        { chatId, checkpointId: cp.id },
        {
          onSuccess: () => {
            toast.success(`Loaded: ${cp.label}`);
            setConfirmLoadId(null);
            onLoaded?.();
          },
          onError: () => toast.error("Failed to load checkpoint"),
        },
      );
    },
    [chatId, loadCheckpoint, onLoaded],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteCheckpoint.mutate(id, {
        onSuccess: () => {
          refetch();
        },
      });
    },
    [deleteCheckpoint, refetch],
  );

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Save className="h-4 w-4" />
          Checkpoints
        </h2>
        <button onClick={onClose} className="rounded p-1 hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Quick save input */}
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <input
          type="text"
          placeholder="Save label (optional)"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          className="flex-1 rounded bg-muted px-2 py-1.5 text-xs outline-none"
          maxLength={200}
        />
        <button
          onClick={handleCreate}
          disabled={createCheckpoint.isPending}
          className="flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-3 w-3" />
          Save
        </button>
      </div>

      {/* Checkpoint list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {!checkpoints?.length ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No checkpoints yet. Auto-saves are created at session boundaries and combat transitions.
          </p>
        ) : (
          <div className="space-y-1">
            {checkpoints.map((cp) => {
              const Icon = TRIGGER_ICONS[cp.triggerType as CheckpointTrigger] ?? Clock;
              const triggerLabel = TRIGGER_LABELS[cp.triggerType as CheckpointTrigger] ?? cp.triggerType;

              return (
                <div
                  key={cp.id}
                  className={cn(
                    "group flex items-start gap-2 rounded-lg border px-3 py-2 text-xs transition-colors",
                    confirmLoadId === cp.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                  )}
                >
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{cp.label}</div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                      <span>{triggerLabel}</span>
                      {cp.location && <span>{cp.location}</span>}
                      {cp.weather && <span>{cp.weather}</span>}
                      <span>{formatDate(cp.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {confirmLoadId === cp.id ? (
                      <>
                        <button
                          onClick={() => handleLoad(cp)}
                          disabled={loadCheckpoint.isPending}
                          className="rounded bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmLoadId(null)}
                          className="rounded px-2 py-1 text-[10px] hover:bg-muted"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setConfirmLoadId(cp.id)}
                          className="rounded p-1 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                          title="Load checkpoint"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                        {cp.triggerType === "manual" && (
                          <button
                            onClick={() => handleDelete(cp.id)}
                            className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
                            title="Delete checkpoint"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
