// ──────────────────────────────────────────────
// Modal: AI Character Maker
// Streams character generation and lets user review/edit before saving.
// ──────────────────────────────────────────────
import { useState, useRef, useCallback } from "react";
import { Modal } from "../../../../shared/components/ui/Modal";
import { useConnections } from "../../connections/index";
import { useCharacterGroups, useCreateCharacter, useUpdateGroup } from "../hooks/use-characters";
import { useCreateLorebookEntry, useLorebooks } from "../../lorebooks/index";
import { useUIStore } from "../../../../shared/stores/ui.store";
import { Sparkles, Loader2, Wand2, AlertCircle, ChevronDown, Folder, BookOpen } from "lucide-react";
import { ProfessorMariWorkingWindow } from "../../../../shared/components/ui/ProfessorMariWorkingWindow";
import { generateCharacterMaker } from "../../../../engine/generation/makers";
import { llmApi } from "../../../../shared/api/llm-api";
import type { CharacterGroup } from "../../../../engine/contracts/types/character";
import type { Lorebook } from "../../../../engine/contracts/types/lorebook";
import { CharacterMakerGeneratedPreview } from "./CharacterMakerGeneratedPreview";
import {
  characterLorebookContent,
  mergeTags,
  nameKeywords,
  parseTagsInput,
  type ConnectionRow,
  type GeneratedCharacterData,
} from "../lib/character-maker-model";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CharacterMakerModal({ open, onClose }: Props) {
  const { data: rawConnections } = useConnections();
  const { data: rawGroups } = useCharacterGroups();
  const { data: rawLorebooks } = useLorebooks();
  const createCharacter = useCreateCharacter();
  const updateGroup = useUpdateGroup();
  const createLorebookEntry = useCreateLorebookEntry();
  const openCharacterDetail = useUIStore((s) => s.openCharacterDetail);
  const enableStreaming = useUIStore((s) => s.enableStreaming);

  const [prompt, setPrompt] = useState("");
  const [referenceTagsInput, setReferenceTagsInput] = useState("");
  const [nameHint, setNameHint] = useState("");
  const [preserveNameSpelling, setPreserveNameSpelling] = useState(true);
  const [declensionHint, setDeclensionHint] = useState("");
  const [targetGroupId, setTargetGroupId] = useState("");
  const [targetLorebookId, setTargetLorebookId] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [generated, setGenerated] = useState<GeneratedCharacterData | null>(null);
  const [confirmedName, setConfirmedName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const connections = (rawConnections ?? []) as ConnectionRow[];
  const groups = (rawGroups ?? []) as CharacterGroup[];
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

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      let fullText = "";
      let parsed: GeneratedCharacterData | null = null;
      const referenceTags = parseTagsInput(referenceTagsInput);
      for await (const event of generateCharacterMaker(
        { llm: llmApi },
        {
          prompt,
          connectionId,
          streaming: enableStreaming,
          referenceTags,
          nameHint,
          preserveNameSpelling,
          declensionHint,
        },
        abort.signal,
      )) {
        if (event.type === "token") {
          fullText += event.data;
          setStreamText(fullText);
        } else if (event.type === "done") {
          parsed = JSON.parse(event.data) as GeneratedCharacterData;
        }
      }

      if (parsed) {
        setGenerated(parsed);
        setConfirmedName((parsed.name || nameHint).trim());
      } else setError("Generated text wasn't valid JSON. You can try again.");
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Generation failed");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [prompt, connectionId, enableStreaming, referenceTagsInput, nameHint, preserveNameSpelling, declensionHint]);

  const handleSave = async () => {
    const finalName = confirmedName.trim() || generated?.name?.trim();
    if (!generated || !finalName) return;
    setSaving(true);
    try {
      const referenceTags = parseTagsInput(referenceTagsInput);
      const savedTags = mergeTags(generated.tags, referenceTags);
      const characterData = {
        data: {
          name: finalName,
          description: generated.description ?? "",
          personality: generated.personality ?? "",
          scenario: generated.scenario ?? "",
          first_mes: generated.first_mes ?? "",
          mes_example: generated.mes_example ?? "",
          creator_notes: generated.creator_notes ?? "",
          system_prompt: generated.system_prompt ?? "",
          post_history_instructions: generated.post_history_instructions ?? "",
          tags: savedTags,
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
            altDescriptions: [],
            marinara: {
              aiCharacterMaker: {
                referenceTags,
                nameHint: nameHint.trim(),
                preserveNameSpelling,
                declensionHint: declensionHint.trim(),
              },
            },
          },
          character_book: null,
        },
      };

      const result = await createCharacter.mutateAsync(characterData);
      const charId = (result as { id: string })?.id;

      if (charId && targetGroupId) {
        const group = groups.find((entry) => entry.id === targetGroupId);
        const characterIds = Array.from(new Set([...(group?.characterIds ?? []), charId]));
        await updateGroup.mutateAsync({ id: targetGroupId, characterIds });
      }

      if (charId && targetLorebookId) {
        await createLorebookEntry.mutateAsync({
          lorebookId: targetLorebookId,
          name: finalName,
          content: characterLorebookContent(generated, finalName),
          description: generated.description ?? generated.personality ?? "",
          keys: nameKeywords(finalName),
          secondaryKeys: savedTags,
          enabled: true,
          tag: "character",
          characterFilterMode: "include",
          characterFilterIds: [charId],
          additionalMatchingSources: ["character_name", "character_description", "character_tags"],
          order: 100,
        });
      }

      onClose();
      // Reset state
      setPrompt("");
      setReferenceTagsInput("");
      setNameHint("");
      setPreserveNameSpelling(true);
      setDeclensionHint("");
      setTargetGroupId("");
      setTargetLorebookId("");
      setStreamText("");
      setGenerated(null);
      setConfirmedName("");
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
    <Modal open={open} onClose={handleClose} title="✦ AI Character Maker" width="max-w-xl">
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

        <div className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)]/70 p-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">Reference Tags</label>
            <input
              value={referenceTagsInput}
              onChange={(e) => setReferenceTagsInput(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
              placeholder="scholar, vampire, slow burn"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">Preferred Name</label>
            <input
              value={nameHint}
              onChange={(e) => setNameHint(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
              placeholder="Bella"
            />
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={preserveNameSpelling}
              onChange={(e) => setPreserveNameSpelling(e.target.checked)}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Preserve exact name spelling
          </label>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">Declension Note</label>
            <input
              value={declensionHint}
              onChange={(e) => setDeclensionHint(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
              placeholder="Keep base name unchanged"
            />
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
              <Folder size="0.75rem" />
              Save to Group
            </label>
            <select
              value={targetGroupId}
              onChange={(e) => setTargetGroupId(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            >
              <option value="">No group</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
              <BookOpen size="0.75rem" />
              Add to Lorebook
            </label>
            <select
              value={targetLorebookId}
              onChange={(e) => setTargetLorebookId(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            >
              <option value="">No lorebook entry</option>
              {lorebooks.map((lorebook) => (
                <option key={lorebook.id} value={lorebook.id}>
                  {lorebook.name}
                </option>
              ))}
            </select>
          </div>
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
          <CharacterMakerGeneratedPreview
            generated={generated}
            confirmedName={confirmedName}
            onConfirmedNameChange={setConfirmedName}
            saving={saving}
            onSave={handleSave}
          />
        )}
      </div>
    </Modal>
  );
}
