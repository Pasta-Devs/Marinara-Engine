// ──────────────────────────────────────────────
// Modal: AI Character Maker
// Streams character generation and lets user review/edit before saving.
// ──────────────────────────────────────────────
import { useState, useRef, useCallback } from "react";
import { Modal } from "../ui/Modal";
import { useConnections } from "../../hooks/use-connections";
import { useCreateCharacter } from "../../hooks/use-characters";
import { useUIStore } from "../../stores/ui.store";
import { Sparkles, Loader2, Wand2, CheckCircle, AlertCircle, ChevronDown, User, Save } from "lucide-react";
import { api } from "../../lib/api-client";

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
  name?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  creator_notes?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  tags?: string[];
  backstory?: string;
  appearance?: string;
};

export function CharacterMakerModal({ open, onClose }: Props) {
  const { data: rawConnections } = useConnections();
  const createCharacter = useCreateCharacter();
  const openCharacterDetail = useUIStore((s) => s.openCharacterDetail);

  const [prompt, setPrompt] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [generated, setGenerated] = useState<GeneratedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const connections = (rawConnections ?? []) as ConnectionRow[];

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

    try {
      let fullText = "";
      for await (const chunk of api.stream("/character-maker/generate", {
        prompt,
        connectionId,
      })) {
        fullText += chunk;
        setStreamText(fullText);
      }

      // Try parsing the final text as JSON
      try {
        const jsonMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, fullText];
        const jsonStr = (jsonMatch[1] ?? fullText).trim();
        const parsed = JSON.parse(jsonStr) as GeneratedData;
        setGenerated(parsed);
      } catch {
        // If we can't parse, still show the raw text
        setError("Generated text wasn't valid JSON. You can try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setStreaming(false);
    }
  }, [prompt, connectionId]);

  const handleSave = async () => {
    if (!generated?.name) return;
    setSaving(true);
    try {
      const characterData = {
        data: {
          name: generated.name,
          description: generated.description ?? "",
          personality: generated.personality ?? "",
          scenario: generated.scenario ?? "",
          first_mes: generated.first_mes ?? "",
          mes_example: generated.mes_example ?? "",
          creator_notes: generated.creator_notes ?? "",
          system_prompt: generated.system_prompt ?? "",
          post_history_instructions: generated.post_history_instructions ?? "",
          tags: generated.tags ?? [],
          creator: "AI Character Maker",
          character_version: "1.0",
          alternate_greetings: [],
          extensions: {
            talkativeness: 0.5,
            fav: false,
            world: "",
            depth_prompt: { prompt: "", depth: 4, role: "system" },
            backstory: generated.backstory ?? "",
            appearance: generated.appearance ?? "",
          },
          character_book: null,
        },
      };

      const result = await createCharacter.mutateAsync(characterData);
      const charId = (result as { id: string })?.id;

      onClose();
      // Reset state
      setPrompt("");
      setStreamText("");
      setGenerated(null);
      setError(null);

      // Open the character editor for the newly created character
      if (charId) {
        openCharacterDetail(charId);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (abortRef.current) abortRef.current.abort();
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="✦ AI Character Maker" width="max-w-lg">
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

        {/* Prompt input */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Character Concept</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-sm outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            placeholder="Describe your character... e.g. 'A cheerful catgirl barista who secretly runs a thieves' guild at night'"
          />
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={streaming || !prompt.trim() || !connectionId}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-400 to-fuchsia-500 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-violet-500/20 transition-all hover:shadow-lg hover:shadow-violet-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {streaming ? (
            <>
              <Loader2 size="0.9375rem" className="animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Wand2 size="0.9375rem" />
              Generate Character
            </>
          )}
        </button>

        {/* Streaming preview */}
        {streaming && streamText && (
          <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles size="0.75rem" className="animate-pulse text-violet-400" />
              <span className="text-[0.625rem] font-medium text-violet-400">Generating…</span>
            </div>
            <pre className="whitespace-pre-wrap text-xs text-[var(--muted-foreground)] font-mono">
              {streamText.slice(-500)}
            </pre>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 p-3">
            <AlertCircle size="0.875rem" className="mt-0.5 shrink-0 text-[var(--destructive)]" />
            <p className="text-xs text-[var(--destructive)]">{error}</p>
          </div>
        )}

        {/* Generated preview */}
        {generated && (
          <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle size="0.875rem" className="text-emerald-500" />
              <span className="text-xs font-medium text-emerald-500">Character Generated!</span>
            </div>

            {/* Preview card */}
            <div className="flex items-start gap-3 rounded-xl bg-[var(--card)] p-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400 to-purple-500 shadow-md">
                <User size="1.25rem" className="text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold">{generated.name}</h4>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)] line-clamp-2">
                  {generated.description?.slice(0, 200)}
                </p>
                {generated.tags && generated.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {generated.tags.slice(0, 5).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[0.625rem] font-medium text-[var(--primary)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Preview sections */}
            <div className="grid gap-2 text-xs">
              {generated.personality && <PreviewSection label="Personality" text={generated.personality} />}
              {generated.backstory && <PreviewSection label="Backstory" text={generated.backstory} />}
              {generated.appearance && <PreviewSection label="Appearance" text={generated.appearance} />}
              {generated.first_mes && <PreviewSection label="First Message" text={generated.first_mes} />}
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-400 to-purple-500 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-pink-500/20 transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 size="0.9375rem" className="animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save size="0.9375rem" />
                  Save & Edit Character
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function PreviewSection({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-lg bg-[var(--secondary)] p-2.5">
      <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        {label}
      </span>
      <p className="mt-1 text-[var(--foreground)] line-clamp-3">{text}</p>
    </div>
  );
}
