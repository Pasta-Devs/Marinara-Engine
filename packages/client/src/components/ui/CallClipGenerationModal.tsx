import { useEffect, useMemo, useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import {
  CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS,
  type ConversationCallCharacterVideoClipKind,
} from "@marinara-engine/shared";
import { useConnections } from "../../hooks/use-connections";
import { type CharacterCallVideoGenerationInput } from "../../hooks/use-characters";
import { cn } from "../../lib/utils";
import { Modal } from "./Modal";

type VideoGenerationConnectionOption = {
  id: string;
  name?: string;
  model?: string | null;
  provider?: string | null;
  defaultForAgents?: boolean | string | null;
};

const CALL_VIDEO_CLIP_LABEL_BY_KIND: Record<ConversationCallCharacterVideoClipKind, string> = {
  idle: "Idle",
  talking: "Talking",
  laughing: "Laughing",
  angry: "Angry",
  crying: "Crying",
  sighing: "Sighing",
};

function isDefaultVideoGenerationConnection(connection: VideoGenerationConnectionOption) {
  return connection.defaultForAgents === true || connection.defaultForAgents === "true";
}

export function CallClipGenerationModal({
  open,
  entityName,
  initialKind = null,
  generating,
  onClose,
  onGenerate,
}: {
  open: boolean;
  entityName: string;
  initialKind?: ConversationCallCharacterVideoClipKind | null;
  generating: boolean;
  onClose: () => void;
  onGenerate: (input: CharacterCallVideoGenerationInput) => void | Promise<void>;
}) {
  const { data: connectionsList } = useConnections();
  const videoConnections = useMemo(() => {
    if (!connectionsList) return [];
    return (connectionsList as VideoGenerationConnectionOption[])
      .filter((connection) => connection.provider === "video_generation")
      .sort((a, b) => Number(isDefaultVideoGenerationConnection(b)) - Number(isDefaultVideoGenerationConnection(a)));
  }, [connectionsList]);
  const defaultConnectionId =
    videoConnections.find(isDefaultVideoGenerationConnection)?.id ?? videoConnections[0]?.id ?? null;
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [includeAvatarReference, setIncludeAvatarReference] = useState(true);
  const [selectedKinds, setSelectedKinds] = useState<ConversationCallCharacterVideoClipKind[]>(
    initialKind ? [initialKind] : CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS,
  );
  const [clipCount, setClipCount] = useState(initialKind ? 1 : CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS.length);

  useEffect(() => {
    if (!open) return;
    const nextKinds = initialKind ? [initialKind] : CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS;
    setSelectedKinds(nextKinds);
    setClipCount(nextKinds.length);
    setConnectionId(null);
    setIncludeAvatarReference(true);
  }, [initialKind, open]);

  const effectiveConnectionId = connectionId ?? defaultConnectionId;
  const maxClipCount = Math.max(1, selectedKinds.length);
  const safeClipCount = Math.min(Math.max(1, clipCount), maxClipCount);
  const requestedClipKinds = selectedKinds.slice(0, safeClipCount);
  const canGenerate = requestedClipKinds.length > 0 && Boolean(effectiveConnectionId) && !generating;

  const toggleKind = (kind: ConversationCallCharacterVideoClipKind) => {
    setSelectedKinds((current) => {
      const exists = current.includes(kind);
      const next = exists ? current.filter((item) => item !== kind) : [...current, kind];
      if (next.length === 0) return current;
      setClipCount((count) => Math.min(Math.max(1, count), next.length));
      return next;
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Generate Call Clips" width="max-w-lg">
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
          Generate video-call loop clips for {entityName}. Marinara will use the selected video generation connection.
        </p>

        <label className="grid gap-1.5 text-xs font-semibold text-[var(--foreground)]">
          Video Generation Connection
          <select
            value={effectiveConnectionId ?? ""}
            onChange={(event) => setConnectionId(event.target.value || null)}
            className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm font-medium text-[var(--foreground)] outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          >
            {videoConnections.length === 0 ? <option value="">No video generation connections</option> : null}
            {videoConnections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.name || connection.model || "Video connection"}
                {isDefaultVideoGenerationConnection(connection) ? " (Default)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/60 px-3 py-2">
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-[var(--foreground)]">Use avatar as reference</span>
            <span className="block text-[0.6875rem] text-[var(--muted-foreground)]">
              Recommended for first and final frame matching.
            </span>
          </span>
          <input
            type="checkbox"
            checked={includeAvatarReference}
            onChange={(event) => setIncludeAvatarReference(event.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
        </label>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-[var(--foreground)]">Clips to generate</span>
            <label className="flex items-center gap-2 text-[0.6875rem] text-[var(--muted-foreground)]">
              Count
              <input
                type="number"
                min={1}
                max={maxClipCount}
                value={safeClipCount}
                onChange={(event) => setClipCount(Number(event.target.value) || 1)}
                className="w-16 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]/40"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS.map((kind) => (
              <label
                key={kind}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                  selectedKinds.includes(kind)
                    ? "border-[var(--primary)]/45 bg-[var(--primary)]/10 text-[var(--foreground)]"
                    : "border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedKinds.includes(kind)}
                  onChange={() => toggleKind(kind)}
                  className="h-3.5 w-3.5 accent-[var(--primary)]"
                />
                {CALL_VIDEO_CLIP_LABEL_BY_KIND[kind]}
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              void onGenerate({
                clipKinds: requestedClipKinds,
                clipCount: requestedClipKinds.length,
                connectionId: effectiveConnectionId,
                includeAvatarReference,
              })
            }
            disabled={!canGenerate}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? <Loader2 size="0.875rem" className="animate-spin" /> : <Wand2 size="0.875rem" />}
            Generate
          </button>
        </div>
      </div>
    </Modal>
  );
}
