// ──────────────────────────────────────────────
// Modal: AI Lorebook Maker
// Streams lorebook generation and lets user review / auto-save entries.
// ──────────────────────────────────────────────
import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../../../shared/components/ui/Modal";
import { useConnections } from "../../connections/index";
import { useLorebooks, useCreateLorebook, lorebookKeys } from "../hooks/use-lorebooks";
import { useUIStore } from "../../../../shared/stores/ui.store";
import { Loader2, Wand2, CheckCircle, AlertCircle, ChevronDown, BookOpen, Plus } from "lucide-react";
import {
  createLorebookEntrySchema,
  lorebookCategorySchema,
} from "../../../../engine/contracts/schemas/lorebook.schema";
import type { Lorebook } from "../../../../engine/contracts/types/lorebook";
import { ProfessorMariWorkingWindow } from "../../../../shared/components/ui/ProfessorMariWorkingWindow";
import { generateLorebookMaker } from "../../../../engine/generation/makers";
import { llmApi } from "../../../../shared/api/llm-api";
import { storageApi } from "../../../../shared/api/storage-api";

interface Props {
  open: boolean;
  onClose: () => void;
}

type ConnectionRow = {
  id: string;
  name: string;
  provider: string;
  model: string;
};

type GeneratedData = {
  lorebook_name?: string;
  lorebook_description?: string;
  category?: string;
  entries?: Array<{
    name?: string;
    content?: string;
    keys?: string[];
    secondary_keys?: string[];
    tag?: string;
    constant?: boolean;
    order?: number;
  }>;
};

function normalizeGeneratedLorebookCategory(category: unknown) {
  const parsed = lorebookCategorySchema.safeParse(category);
  return parsed.success ? parsed.data : "world";
}

export function LorebookMakerModal({ open, onClose }: Props) {
  const { data: rawConnections } = useConnections();
  const { data: rawLorebooks } = useLorebooks();
  const createLorebook = useCreateLorebook();
  const openLorebookDetail = useUIStore((s) => s.openLorebookDetail);
  const enableStreaming = useUIStore((s) => s.enableStreaming);
  const qc = useQueryClient();

  const [prompt, setPrompt] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [targetLorebookId, setTargetLorebookId] = useState<string>("__new__");
  const [entryCount, setEntryCount] = useState(10);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [batchProgress, setBatchProgress] = useState<{
    batch: number;
    totalBatches: number;
    entriesSoFar: number;
  } | null>(null);
  const [generated, setGenerated] = useState<GeneratedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const connections = (rawConnections ?? []) as ConnectionRow[];
  const lorebooks = (rawLorebooks ?? []) as Lorebook[];

  // Auto-select first connection
  if (!connectionId && connections.length > 0) {
    setConnectionId(connections[0].id);
  }

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || !connectionId) return;

    setStreaming(true);
    setStreamText("");
    setGenerated(null);
    setError(null);
    setSaved(false);
    setBatchProgress(null);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      let fullText = "";
      let finalData: GeneratedData | null = null;
      for await (const event of generateLorebookMaker(
        { llm: llmApi, storage: storageApi },
        {
          prompt,
          connectionId,
          entryCount,
          streaming: enableStreaming,
          ...(targetLorebookId !== "__new__" ? { lorebookId: targetLorebookId } : {}),
        },
        abort.signal,
      )) {
        switch (event.type) {
          case "token":
            fullText += event.data as string;
            setStreamText(fullText);
            break;

          case "batch_start": {
            const bs = event.data as {
              batch: number;
              totalBatches: number;
              totalEntriesSoFar?: number;
              entriesSoFar: number;
            };
            setBatchProgress({ batch: bs.batch, totalBatches: bs.totalBatches, entriesSoFar: bs.entriesSoFar });
            // Visual separator between batches in the stream preview
            if (bs.batch > 1) {
              fullText += `\n\n── Batch ${bs.batch}/${bs.totalBatches} ──\n\n`;
              setStreamText(fullText);
            }
            break;
          }

          case "batch_done": {
            const bd = event.data as { batch: number; totalBatches: number; totalEntriesSoFar: number };
            setBatchProgress({ batch: bd.batch, totalBatches: bd.totalBatches, entriesSoFar: bd.totalEntriesSoFar });
            break;
          }

          case "batch_warning": {
            const bw = event.data as { batch: number; message: string };
            setError(bw.message);
            break;
          }

          case "saved": {
            setSaved(true);
            // Invalidate lorebook queries so entries appear in the UI
            qc.invalidateQueries({ queryKey: lorebookKeys.all });
            break;
          }

          case "done": {
            try {
              const raw = typeof event.data === "string" ? event.data : JSON.stringify(event.data);
              finalData = JSON.parse(raw) as GeneratedData;
            } catch {
              // Fall back to parsing the raw stream text
              try {
                const jsonMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, fullText];
                const jsonStr = (jsonMatch[1] ?? fullText).trim();
                finalData = JSON.parse(jsonStr) as GeneratedData;
              } catch {
                /* parsing failed */
              }
            }
            break;
          }

          case "error":
            setError(event.data as string);
            break;
        }
      }

      if (finalData) {
        setGenerated(finalData);
        if (targetLorebookId !== "__new__") {
          setSaved(true);
        }
      } else {
        setError("Generated text wasn't valid JSON. You can try again.");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Generation failed");
      }
    } finally {
      setStreaming(false);
      setBatchProgress(null);
      abortRef.current = null;
    }
  }, [prompt, connectionId, entryCount, targetLorebookId, enableStreaming, qc]);

  const handleSaveAsNew = async () => {
    if (!generated) return;
    setSaving(true);
    setError(null);
    try {
      const result = await createLorebook.mutateAsync({
        name: generated.lorebook_name || "AI Generated Lorebook",
        description: generated.lorebook_description || "",
        category: normalizeGeneratedLorebookCategory(generated.category),
        generatedBy: "lorebook-maker",
      });

      const lbId = (result as Lorebook)?.id;

      if (lbId && generated.entries?.length) {
        const entriesToCreate = generated.entries.map((e) => ({
          lorebookId: lbId,
          name: e.name ?? "Untitled",
          content: e.content ?? "",
          keys: e.keys ?? [],
          secondaryKeys: e.secondary_keys ?? [],
          tag: e.tag ?? "",
          constant: e.constant ?? false,
          order: e.order ?? 100,
        }));

        const validatedEntries = entriesToCreate.map((entry) => createLorebookEntrySchema.parse(entry));
        await Promise.all(validatedEntries.map((entry) => storageApi.create("lorebook-entries", entry)));
        // Invalidate so entries appear immediately
        qc.invalidateQueries({ queryKey: lorebookKeys.entries(lbId) });
      }

      setSaved(true);
      onClose();

      // Reset state
      setPrompt("");
      setStreamText("");
      setGenerated(null);
      setError(null);
      setSaved(false);

      if (lbId) openLorebookDetail(lbId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save lorebook");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (abortRef.current) abortRef.current.abort();
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="✦ AI Lorebook Maker" width="max-w-lg">
      <ProfessorMariWorkingWindow visible={streaming || saving} />
      <div className="space-y-4">
        {/* Connection selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">API Connection</label>
          <div className="relative">
            <select
              value={connectionId}
              onChange={(e) => setConnectionId(e.target.value)}
              className="w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 pr-8 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            >
              {connections.length === 0 && <option value="">No connections available</option>}
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.model})
                </option>
              ))}
            </select>
            <ChevronDown
              size="0.875rem"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
          </div>
        </div>

        {/* Target lorebook */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Target Lorebook</label>
          <div className="relative">
            <select
              value={targetLorebookId}
              onChange={(e) => setTargetLorebookId(e.target.value)}
              className="w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 pr-8 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            >
              <option value="__new__">✦ Create new lorebook</option>
              {lorebooks.map((lb) => (
                <option key={lb.id} value={lb.id}>
                  {lb.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size="0.875rem"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
          </div>
        </div>

        {/* Entry count + Prompt */}
        <div className="flex gap-3">
          <div className="w-24 space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">Entries</label>
            <input
              type="number"
              value={entryCount}
              onChange={(e) => setEntryCount(Math.max(1, Math.min(200, parseInt(e.target.value) || 10)))}
              min={1}
              max={200}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">World / Topic</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-sm outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
              placeholder="Describe your world or topic… e.g. 'A steampunk Victorian city built on a floating island with a class-based magic system'"
            />
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={streaming || !prompt.trim() || !connectionId}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
        >
          {streaming ? (
            <>
              <Loader2 size="1rem" className="animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Wand2 size="1rem" />
              Generate Lorebook
            </>
          )}
        </button>

        {/* Stream preview */}
        {(streaming || streamText) && !generated && (
          <div className="space-y-2">
            {batchProgress && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-400">
                <Loader2 size="0.75rem" className="animate-spin" />
                <span>
                  Batch {batchProgress.batch}/{batchProgress.totalBatches}
                  {batchProgress.entriesSoFar > 0 && ` · ${batchProgress.entriesSoFar} entries so far`}
                </span>
              </div>
            )}
            <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
              <pre className="whitespace-pre-wrap break-words text-xs font-mono text-[var(--muted-foreground)]">
                {streamText}
                {streaming && <span className="animate-pulse">▋</span>}
              </pre>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            <AlertCircle size="0.875rem" />
            {error}
          </div>
        )}

        {/* Generated preview */}
        {generated && (
          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
            <div className="flex items-center gap-2">
              <BookOpen size="1rem" className="text-amber-400" />
              <span className="font-semibold">{generated.lorebook_name || "Generated Lorebook"}</span>
              {generated.category && (
                <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[0.625rem] font-medium text-amber-400">
                  {generated.category}
                </span>
              )}
            </div>

            {generated.lorebook_description && (
              <p className="text-xs text-[var(--muted-foreground)]">{generated.lorebook_description}</p>
            )}

            <div className="space-y-1.5">
              <p className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                {generated.entries?.length ?? 0} entries generated
              </p>
              <div className="max-h-48 space-y-1.5 overflow-y-auto">
                {generated.entries?.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] p-2 text-xs">
                    <span className="font-medium">{entry.name}</span>
                    <span className="text-[var(--muted-foreground)]">{entry.keys?.slice(0, 3).join(", ")}</span>
                    {entry.tag && (
                      <span className="ml-auto rounded bg-[var(--accent)] px-1.5 py-0.5 text-[0.5625rem]">
                        {entry.tag}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            {!saved && targetLorebookId === "__new__" && (
              <button
                onClick={handleSaveAsNew}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 size="0.875rem" className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Plus size="0.875rem" />
                    Create Lorebook & Save Entries
                  </>
                )}
              </button>
            )}

            {saved && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-400">
                <CheckCircle size="0.875rem" />
                Entries saved successfully!
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
