// ──────────────────────────────────────────────
// Modal: AI Lorebook Maker
// Streams lorebook generation and lets user review / auto-save entries.
// ──────────────────────────────────────────────
import { useState, useCallback, useRef } from "react";
import { Modal } from "../ui/Modal";
import { useConnections } from "../../hooks/use-connections";
import { useLorebooks, useCreateLorebook } from "../../hooks/use-lorebooks";
import { useUIStore } from "../../stores/ui.store";
import { Loader2, Wand2, CheckCircle, AlertCircle, ChevronDown, BookOpen, Plus } from "lucide-react";
import { api } from "../../lib/api-client";
import type { Lorebook } from "@marinara-engine/shared";

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

export function LorebookMakerModal({ open, onClose }: Props) {
  const { data: rawConnections } = useConnections();
  const { data: rawLorebooks } = useLorebooks();
  const createLorebook = useCreateLorebook();
  const openLorebookDetail = useUIStore((s) => s.openLorebookDetail);

  const [prompt, setPrompt] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [targetLorebookId, setTargetLorebookId] = useState<string>("__new__");
  const [entryCount, setEntryCount] = useState(10);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
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

    try {
      let fullText = "";
      const body: Record<string, unknown> = {
        prompt,
        connectionId,
        entryCount,
      };

      // If targeting existing lorebook, pass the ID so server auto-saves entries
      if (targetLorebookId !== "__new__") {
        body.lorebookId = targetLorebookId;
      }

      for await (const chunk of api.stream("/lorebook-maker/generate", body)) {
        fullText += chunk;
        setStreamText(fullText);
      }

      // Try parsing the final text as JSON
      try {
        const jsonMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, fullText];
        const jsonStr = (jsonMatch[1] ?? fullText).trim();
        const parsed = JSON.parse(jsonStr) as GeneratedData;
        setGenerated(parsed);

        // If entries were sent to an existing lorebook, mark as saved
        if (targetLorebookId !== "__new__") {
          setSaved(true);
        }
      } catch {
        setError("Generated text wasn't valid JSON. You can try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setStreaming(false);
    }
  }, [prompt, connectionId, entryCount, targetLorebookId]);

  const handleSaveAsNew = async () => {
    if (!generated) return;
    setSaving(true);
    try {
      const result = await createLorebook.mutateAsync({
        name: generated.lorebook_name || "AI Generated Lorebook",
        description: generated.lorebook_description || "",
        category: (generated.category as "world") || "world",
        generatedBy: "lorebook-maker",
      });

      const lbId = (result as Lorebook)?.id;

      // Now bulk-create entries via direct API call
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

        await api.post(`/lorebooks/${lbId}/entries/bulk`, { entries: entriesToCreate });
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
              onChange={(e) => setEntryCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
              min={1}
              max={50}
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
          <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
            <pre className="whitespace-pre-wrap break-words text-xs font-mono text-[var(--muted-foreground)]">
              {streamText}
              {streaming && <span className="animate-pulse">▋</span>}
            </pre>
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
