import { CheckCircle2, Loader2, Palette, RotateCcw, Save, TriangleAlert } from "lucide-react";
import { TrackerCardColorControls } from "../../../../../shared/components/ui/TrackerCardColorControls";
import { cn } from "../../../../../shared/lib/utils";
import { useTrackerCardColorManager } from "../../hooks/use-tracker-card-color-manager";

export function TrackerCardColorSettings() {
  const {
    activeChatId,
    draftConfig,
    handleChange,
    handleRevert,
    handleSave,
    hasUnsavedChanges,
    isLoadingGameState,
    saveState,
    selectedTarget,
    selectedTargetKey,
    setSelectedTargetKey,
    targets,
  } = useTrackerCardColorManager();

  const saveMessage =
    saveState === "saving"
      ? "Saving..."
      : saveState === "error"
        ? "Save failed"
        : hasUnsavedChanges
          ? "Unsaved preview"
          : saveState === "saved"
            ? "Saved"
            : "";

  return (
    <div className="mt-2 flex flex-col gap-1.5 rounded-lg bg-[var(--background)]/36 p-1.5 ring-1 ring-[var(--border)]">
      <div className="flex min-h-5 items-center justify-between gap-2 px-0.5">
        <span className="inline-flex min-w-0 items-center gap-1 text-[0.625rem] font-medium text-[var(--foreground)]">
          <Palette size="0.6875rem" className="text-[var(--primary)]" />
          Card colors
        </span>
        {saveMessage && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 text-[0.5625rem] text-[var(--muted-foreground)]",
              saveState === "error" && "text-[var(--destructive)]",
              saveState === "saved" && "text-[var(--primary)]",
              hasUnsavedChanges && saveState !== "error" && "text-[var(--primary)]",
            )}
          >
            {saveState === "saving" ? (
              <Loader2 size="0.625rem" className="animate-spin" />
            ) : saveState === "error" ? (
              <TriangleAlert size="0.625rem" />
            ) : hasUnsavedChanges ? (
              <Palette size="0.625rem" />
            ) : (
              <CheckCircle2 size="0.625rem" />
            )}
            {saveMessage}
          </span>
        )}
      </div>

      {!activeChatId ? (
        <p className="rounded-md bg-[var(--secondary)]/42 px-2 py-2 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
          Select a chat to edit tracker card colors.
        </p>
      ) : isLoadingGameState && targets.length === 0 ? (
        <p className="rounded-md bg-[var(--secondary)]/42 px-2 py-2 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
          Loading current tracker cards...
        </p>
      ) : targets.length === 0 ? (
        <p className="rounded-md bg-[var(--secondary)]/42 px-2 py-2 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
          No active persona or present character IDs are available for this chat.
        </p>
      ) : (
        <>
          <label className="grid gap-1">
            <span className="px-0.5 text-[0.625rem] text-[var(--muted-foreground)]">Editing</span>
            <select
              value={selectedTargetKey}
              onChange={(event) => setSelectedTargetKey(event.target.value)}
              disabled={saveState === "saving" || hasUnsavedChanges}
              title={hasUnsavedChanges ? "Save or revert before choosing another card." : undefined}
              className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1.5 text-[0.6875rem] text-[var(--foreground)] outline-none transition-shadow focus:ring-1 focus:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-65"
            >
              {targets.map((target) => (
                <option key={target.key} value={target.key}>
                  {target.optionLabel}
                </option>
              ))}
            </select>
          </label>

          {selectedTarget && (
            <div className="flex min-w-0 items-center justify-end gap-1 px-0.5">
              <button
                type="button"
                onClick={handleRevert}
                disabled={!hasUnsavedChanges || saveState === "saving"}
                title="Revert to previous save"
                className="inline-flex h-6 min-w-0 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-1.5 text-[0.625rem] font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <RotateCcw size="0.6875rem" />
                <span>Revert</span>
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!hasUnsavedChanges || saveState === "saving"}
                className="inline-flex h-6 min-w-0 items-center gap-1 rounded-md border border-[var(--primary)]/30 bg-[var(--primary)]/12 px-1.5 text-[0.625rem] font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/18 disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:bg-[var(--secondary)] disabled:text-[var(--muted-foreground)] disabled:opacity-45"
              >
                {saveState === "saving" ? (
                  <Loader2 size="0.6875rem" className="animate-spin" />
                ) : (
                  <Save size="0.6875rem" />
                )}
                <span>Save</span>
              </button>
            </div>
          )}

          {selectedTarget && draftConfig && (
            <TrackerCardColorControls
              value={draftConfig}
              onChange={handleChange}
              chatColors={selectedTarget.chatColors}
              entityLabel={selectedTarget.entityLabel}
              variant="compact"
              disabled={saveState === "saving"}
            />
          )}
        </>
      )}
    </div>
  );
}
