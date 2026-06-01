import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Eraser, Loader2, Sparkles } from "lucide-react";
import { useConnections } from "../../../connections/index";
import { showConfirmDialog } from "../../../../../shared/lib/app-dialogs";
import { lorebookCommandApi } from "../../../../../shared/api/lorebook-command-api";
import { HelpTooltip } from "../../../../../shared/components/ui/HelpTooltip";
import { cn } from "../../../../../shared/lib/utils";
import type { LorebookEntry } from "../../../../../engine/contracts/types/lorebook";
import { lorebookKeys, useBulkUnvectorizeLorebookEntries } from "../../hooks/use-lorebooks";
import { readBoolFlag } from "./lorebook-editor-utils";

const LEGACY_LOCAL_SIDECAR_CONNECTION_ID = "__local_sidecar__";

/** Vectorize lorebook entries for semantic matching. */
export function LorebookVectorizeSection({
  lorebookId,
  entries,
  excludeFromVectorization,
  hasUnsavedVectorizationToggle,
}: {
  lorebookId: string;
  entries: LorebookEntry[];
  excludeFromVectorization: boolean;
  hasUnsavedVectorizationToggle: boolean;
}) {
  const queryClient = useQueryClient();
  const unvectorizeEntries = useBulkUnvectorizeLorebookEntries();
  const { data: rawConnections } = useConnections();
  const connections = (rawConnections ?? []) as Array<{ id: string; name: string; embeddingModel?: string }>;
  const embeddingConnections = connections.filter(
    (connection) =>
      connection.id !== LEGACY_LOCAL_SIDECAR_CONNECTION_ID &&
      typeof connection.embeddingModel === "string" &&
      connection.embeddingModel.trim(),
  );
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");
  const [vectorizing, setVectorizing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const excludedCount = excludeFromVectorization
    ? entries.length
    : entries.filter((entry) => readBoolFlag(entry.excludeFromVectorization)).length;
  const vectorizableEntries = useMemo(
    () => (excludeFromVectorization ? [] : entries.filter((entry) => !readBoolFlag(entry.excludeFromVectorization))),
    [entries, excludeFromVectorization],
  );
  const vectorizableEntryCount = vectorizableEntries.length;
  const vectorizedCount = vectorizableEntries.filter(
    (entry) => Array.isArray(entry.embedding) && entry.embedding.length > 0,
  ).length;
  const missingCount = Math.max(0, vectorizableEntryCount - vectorizedCount);
  const allVectorized = vectorizableEntryCount > 0 && missingCount === 0;
  const vectorizedEntryIds = useMemo(
    () =>
      vectorizableEntries
        .filter((entry) => Array.isArray(entry.embedding) && entry.embedding.length > 0)
        .map((entry) => entry.id),
    [vectorizableEntries],
  );

  useEffect(() => {
    if (!selectedConnectionId && embeddingConnections.length > 0) {
      setSelectedConnectionId(embeddingConnections[0].id);
    }
  }, [embeddingConnections, selectedConnectionId]);

  const handleVectorize = async () => {
    const selectedConnection = embeddingConnections.find((item) => item.id === selectedConnectionId);
    const connection = selectedConnection ?? embeddingConnections[0];
    if (!connection) return;
    const model = connection.embeddingModel?.trim();
    if (!model) {
      setResult({ success: false, message: "Selected connection has no embedding model configured." });
      return;
    }
    if (connection.id !== selectedConnectionId) {
      setSelectedConnectionId(connection.id);
    }
    setVectorizing(true);
    setResult(null);
    try {
      const response = await lorebookCommandApi.vectorize(lorebookId, {
        connectionId: connection.id,
        model,
        onlyMissing: !allVectorized,
      });
      const data = response as { vectorized: number; total?: number; skipped?: number };
      await queryClient.invalidateQueries({ queryKey: lorebookKeys.entries(lorebookId) });
      setResult({
        success: true,
        message: allVectorized
          ? `Re-vectorized ${data.vectorized} entries`
          : `Vectorized ${data.vectorized} missing entries`,
      });
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : "Vectorization failed" });
    } finally {
      setVectorizing(false);
    }
  };

  const handleUnvectorizeAll = async () => {
    if (vectorizedEntryIds.length === 0) return;
    if (
      !(await showConfirmDialog({
        title: "Unvectorize Lorebook",
        message: `Clear stored embeddings for ${vectorizedEntryIds.length} ${
          vectorizedEntryIds.length === 1 ? "entry" : "entries"
        }? Keyword and regex matching will keep working.`,
        confirmLabel: "Unvectorize",
      }))
    ) {
      return;
    }
    setResult(null);
    try {
      const data = await unvectorizeEntries.mutateAsync({ lorebookId, entryIds: vectorizedEntryIds });
      setResult({
        success: true,
        message: `Cleared embeddings for ${data.cleared} ${data.cleared === 1 ? "entry" : "entries"}`,
      });
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : "Unvectorize failed" });
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/30 p-4">
      <div className="flex items-center gap-2">
        <Sparkles size="0.875rem" className="text-violet-400" />
        <h4 className="text-xs font-semibold">Semantic Search (Embeddings)</h4>
        <HelpTooltip text="Vectorize entries to enable semantic matching. Entries will be found by meaning, not just keywords. Requires a connection with an Embedding Model configured." />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[0.625rem] text-[var(--muted-foreground)]">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1",
            allVectorized
              ? "bg-emerald-400/10 text-emerald-400 ring-emerald-400/20"
              : "bg-[var(--background)]/70 ring-[var(--border)]",
          )}
        >
          {allVectorized ? <Check size="0.625rem" /> : <AlertTriangle size="0.625rem" />}
          {vectorizedCount}/{vectorizableEntryCount} entries vectorized
        </span>
        {missingCount > 0 && <span>{missingCount} still need embeddings.</span>}
        {excludeFromVectorization ? <span>This lorebook excludes every entry.</span> : null}
        {!excludeFromVectorization && excludedCount > 0 && <span>{excludedCount} excluded.</span>}
      </div>
      {hasUnsavedVectorizationToggle ? (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          Save this lorebook before vectorizing so the No Vector setting is applied.
        </p>
      ) : excludeFromVectorization ? (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          Semantic vectorization is disabled by this lorebook&apos;s No Vector toggle. Keyword matching still works.
        </p>
      ) : embeddingConnections.length === 0 ? (
        <p className="text-[0.625rem] text-[var(--muted-foreground)]">
          No connections with an embedding model configured. Set an Embedding Model on a connection first.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <select
              value={selectedConnectionId}
              onChange={(event) => setSelectedConnectionId(event.target.value)}
              className="flex-1 rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              {embeddingConnections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.name} ({connection.embeddingModel})
                </option>
              ))}
            </select>
            <button
              onClick={handleVectorize}
              disabled={
                vectorizing ||
                unvectorizeEntries.isPending ||
                hasUnsavedVectorizationToggle ||
                vectorizableEntryCount === 0
              }
              className="flex items-center gap-1.5 rounded-xl bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-400 ring-1 ring-violet-500/30 transition-all hover:bg-violet-500/25 active:scale-[0.98] disabled:opacity-50"
            >
              {vectorizing ? <Loader2 size="0.75rem" className="animate-spin" /> : <Sparkles size="0.75rem" />}
              {vectorizing
                ? "Vectorizing..."
                : hasUnsavedVectorizationToggle
                  ? "Save first"
                  : allVectorized
                    ? `Re-vectorize ${vectorizableEntryCount} entries`
                    : `Vectorize ${missingCount} missing`}
            </button>
            <button
              onClick={handleUnvectorizeAll}
              disabled={
                vectorizing ||
                unvectorizeEntries.isPending ||
                hasUnsavedVectorizationToggle ||
                vectorizedEntryIds.length === 0
              }
              className="flex items-center gap-1.5 rounded-xl bg-[var(--secondary)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] active:scale-[0.98] disabled:opacity-50"
            >
              {unvectorizeEntries.isPending ? (
                <Loader2 size="0.75rem" className="animate-spin" />
              ) : (
                <Eraser size="0.75rem" />
              )}
              Unvectorize all
            </button>
          </div>
          {result && (
            <p
              className={cn(
                "flex items-center gap-1 text-[0.625rem]",
                result.success ? "text-emerald-400" : "text-red-400",
              )}
            >
              {result.success ? <Check size="0.625rem" /> : <AlertTriangle size="0.625rem" />}
              {result.message}
            </p>
          )}
        </>
      )}
    </div>
  );
}
