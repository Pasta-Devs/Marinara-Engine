import { useMemo, useState } from "react";
import { Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  parseChatImageGenerationRecord,
  type ChatImageGenerationRecord,
  type SceneIllustrationCharacterPrompt,
} from "@marinara-engine/shared";
import { useConnections } from "../../hooks/use-connections";
import { useGalleryImages, type ChatImage } from "../../hooks/use-gallery";
import { useRegenerateChatImage } from "../../hooks/use-regenerate-chat-image";
import { useUIStore } from "../../stores/ui.store";
import { cn } from "../../lib/utils";

interface ImageRegeneratePanelProps {
  image: ChatImage;
  /** Message the image was opened from, so the server swaps that attachment directly. */
  messageId?: string;
  onCancel: () => void;
  onRegenerated: (image: ChatImage) => void;
  className?: string;
}

const PANEL_CLASS =
  "flex flex-col gap-2.5 rounded-lg border border-white/10 bg-black/95 px-3 py-2.5 text-left shadow-2xl";
const FIELD_CLASS =
  "w-full resize-y rounded-md border border-white/10 bg-black/40 px-2.5 py-2 font-mono text-[0.75rem] leading-relaxed text-white/85 outline-none transition-colors placeholder:text-white/30 focus:border-white/30 disabled:opacity-60";
const LABEL_CLASS = "text-[0.6875rem] font-semibold text-white/55";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Edit an image's final request and send it again (#7767). Lives in the lightbox in place of the
 * read-only Prompt panel and uses its dark styling.
 */
export function ImageRegeneratePanel(props: ImageRegeneratePanelProps) {
  const { image, className } = props;
  // Message attachments and storyboard frames carry only the visible fields; the saved
  // request lives on the gallery row.
  const needsGalleryRow = image.generation === undefined;
  const { data: galleryImages, isLoading } = useGalleryImages(needsGalleryRow ? image.chatId : undefined);

  // Wait for the saved request before mounting the form, so its fields start from it and never
  // flash the provider's display prompt.
  if (needsGalleryRow && isLoading) {
    return (
      <div className={cn(PANEL_CLASS, "items-center py-4", className)}>
        <Loader2 size="1rem" className="animate-spin text-white/55" />
      </div>
    );
  }
  const generation = needsGalleryRow ? galleryImages?.find((row) => row.id === image.id)?.generation : image.generation;
  return <ImageRegenerateForm {...props} record={parseChatImageGenerationRecord(generation)} />;
}

function ImageRegenerateForm({
  image,
  messageId,
  onCancel,
  onRegenerated,
  className,
  record,
}: ImageRegeneratePanelProps & { record: ChatImageGenerationRecord | null }) {
  const { t: localizeUi } = useUiTranslation();
  const debugMode = useUIStore((s) => s.debugMode);
  const { data: connectionRows = [] } = useConnections();
  const regenerate = useRegenerateChatImage(image.chatId);
  const imageConnections = useMemo(
    () =>
      connectionRows.filter(
        (row): row is Record<string, unknown> =>
          !!row && typeof row === "object" && (row as Record<string, unknown>).provider === "image_generation",
      ),
    [connectionRows],
  );

  const [prompt, setPrompt] = useState(() => record?.prompt ?? image.prompt);
  const [negativePrompt, setNegativePrompt] = useState(() => record?.negativePrompt ?? "");
  const [characterPrompts, setCharacterPrompts] = useState<SceneIllustrationCharacterPrompt[]>(
    () => record?.characterPrompts ?? [],
  );
  const [connectionId, setConnectionId] = useState(() => record?.connectionId ?? "");

  const busy = regenerate.isPending;
  const promptMissing = !prompt.trim();
  const selectedConnectionMissing =
    !!connectionId && !imageConnections.some((connection) => readString(connection.id) === connectionId);
  const references = record?.references;
  const hasReferences =
    !!references && (references.characterIds.length > 0 || !!references.personaId || !!references.locationImageId);

  const handleGenerate = () => {
    if (busy || promptMissing) return;
    regenerate.mutate(
      {
        imageId: image.id,
        prompt: prompt.trim(),
        negativePrompt,
        characterPrompts: characterPrompts.filter((entry) => entry.prompt.trim()),
        ...(connectionId && !selectedConnectionMissing ? { connectionId } : {}),
        ...(messageId ? { messageId } : {}),
        debugMode,
      },
      {
        onSuccess: (result) => {
          toast.success(localizeUi("ui.chat.imageregeneratepanel.regenerated"));
          onRegenerated(result.image);
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : localizeUi("ui.chat.imageregeneratepanel.failed"));
        },
      },
    );
  };

  return (
    <div
      className={cn(PANEL_CLASS, className)}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS}>{localizeUi("ui.agents.customagentrepositoriesmodal.prompt")}</span>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          disabled={busy}
          rows={5}
          spellCheck={false}
          className={cn(FIELD_CLASS, "min-h-24")}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS}>{localizeUi("ui.agents.agenteditor.negativePrompt")}</span>
        <textarea
          value={negativePrompt}
          onChange={(event) => setNegativePrompt(event.target.value)}
          disabled={busy}
          rows={2}
          spellCheck={false}
          className={cn(FIELD_CLASS, "min-h-12")}
        />
      </label>

      {characterPrompts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className={LABEL_CLASS}>{localizeUi("ui.chat.imageregeneratepanel.characterPrompts")}</span>
          {characterPrompts.map((character, index) => (
            <label key={`${character.name}-${index}`} className="flex flex-col gap-1">
              <span className="text-[0.6875rem] font-medium text-white/75">{character.name}</span>
              <textarea
                value={character.prompt}
                onChange={(event) =>
                  setCharacterPrompts((current) =>
                    current.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, prompt: event.target.value } : entry,
                    ),
                  )
                }
                disabled={busy}
                rows={2}
                spellCheck={false}
                className={cn(FIELD_CLASS, "min-h-12")}
              />
            </label>
          ))}
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS}>{localizeUi("ui.chat.imageregeneratepanel.connection")}</span>
        <select
          value={connectionId}
          onChange={(event) => setConnectionId(event.target.value)}
          disabled={busy}
          className="w-full rounded-md border border-white/10 bg-black/40 px-2.5 py-2 text-[0.75rem] text-white/85 outline-none transition-colors focus:border-white/30 disabled:opacity-60"
        >
          <option value="">{localizeUi("ui.chat.imageregeneratepanel.chatConnection")}</option>
          {selectedConnectionMissing ? (
            <option value={connectionId}>{localizeUi("ui.chat.chatsettingsdrawer.missingConnection")}</option>
          ) : null}
          {imageConnections.map((connection) => {
            const id = readString(connection.id);
            if (!id) return null;
            const name = readString(connection.name) || id;
            const model = readString(connection.model);
            // One string: a JSX line break between name and model would render without a space.
            const label = model
              ? name + " " + localizeUi("ui.connections.connectioneditor.value1", { value1: model })
              : name;
            return (
              <option key={id} value={id}>
                {label}
              </option>
            );
          })}
        </select>
      </label>

      {(!record || hasReferences) && (
        <p className="text-[0.6875rem] leading-relaxed text-white/45">
          {!record
            ? localizeUi("ui.chat.imageregeneratepanel.noRecordNotice")
            : localizeUi("ui.chat.imageregeneratepanel.referencesNotice")}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-[0.75rem] font-medium text-white/75 transition-colors hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X size="0.875rem" />
          {localizeUi("chat.delete.dialog.cancel")}
        </button>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={busy || promptMissing}
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 py-1.5 text-[0.75rem] font-semibold ring-1 transition-colors",
            busy || promptMissing
              ? "cursor-not-allowed bg-white/5 text-white/40 ring-white/10"
              : "bg-[var(--primary)]/20 text-[var(--primary)] ring-[var(--primary)]/40 hover:bg-[var(--primary)]/30",
          )}
        >
          {busy ? <Loader2 size="0.875rem" className="animate-spin" /> : <RefreshCw size="0.875rem" />}
          {busy
            ? localizeUi("ui.chat.imageregeneratepanel.generating")
            : localizeUi("ui.chat.imageregeneratepanel.generate")}
        </button>
      </div>
    </div>
  );
}
