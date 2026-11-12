import { useEffect, useId, useRef, useState } from "react";
import { Loader2, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { ChatImageGenerationRecord } from "@marinara-engine/shared";
import { useConnections } from "../../hooks/use-connections";
import type { ChatImage } from "../../hooks/use-gallery";
import {
  useRegenerateChatImage,
  useReviseChatImagePrompt,
  type ImagePromptDraft,
} from "../../hooks/use-regenerate-chat-image";
import { useUIStore } from "../../stores/ui.store";
import { cn } from "../../lib/utils";
import { ConnectionSelect } from "../connections/ConnectionSelect";
import { DraftNumberInput } from "../ui/DraftNumberInput";
import { NEUTRAL_SURFACE_VARIABLES } from "../ui/neutral-surface-styles";

interface ImageRegeneratePanelProps {
  image: ChatImage;
  record: ChatImageGenerationRecord | null;
  /** Message the image was opened from, so the server swaps that attachment directly. */
  messageId?: string;
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
  onRegenerated: (image: ChatImage) => void;
  className?: string;
}

// Same field as InlineChatCardEditor: the chat chrome input tokens follow every theme and chat style,
// where raw --background turned into the default dark theme's navy.
const FIELD_CLASS =
  "min-h-11 w-full resize-y rounded-lg border border-[var(--marinara-chat-chrome-input-border)] bg-[var(--marinara-chat-chrome-input-bg)] px-3 py-2 text-sm leading-relaxed text-[var(--marinara-chat-chrome-panel-text)] outline-none transition-colors placeholder:text-[var(--marinara-chat-chrome-panel-muted)]/55 focus:border-[var(--marinara-chat-chrome-input-border-focus)] focus:ring-1 focus:ring-[var(--marinara-chat-chrome-focus-ring)] disabled:opacity-60";
const LABEL_CLASS = "text-xs font-semibold text-[var(--foreground)]";
const BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BUTTON_CLASS = `${BUTTON_CLASS} border border-[var(--border)] hover:bg-[var(--accent)]`;
type CharacterPrompt = ImagePromptDraft["characterPrompts"][number];

function PromptField({
  label,
  value,
  original,
  rows = 2,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  original: string;
  rows?: number;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useUiTranslation();
  const id = useId();
  const resetLabel = t("ui.chat.imageregeneratepanel.resetField", { field: label });

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className={LABEL_CLASS}>
          {label}
        </label>
        <button
          type="button"
          aria-label={resetLabel}
          title={resetLabel}
          onClick={() => onChange(original)}
          disabled={disabled || value === original}
          className={cn(BUTTON_CLASS, "w-11 shrink-0 px-0 text-[var(--muted-foreground)] hover:bg-[var(--accent)]")}
        >
          <RotateCcw size="1rem" aria-hidden />
        </button>
      </div>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        rows={rows}
        spellCheck={false}
        className={FIELD_CLASS}
      />
    </div>
  );
}

type PlacementAxis = "x" | "y";

/**
 * A caption's position needs both axes. A half-entered one stays here until the other axis arrives, so
 * one field never invents or erases the other's value.
 */
function PlacementFields({
  name,
  position,
  disabled,
  onChange,
}: {
  name: string;
  position: CharacterPrompt["position"];
  disabled: boolean;
  onChange: (position: CharacterPrompt["position"]) => void;
}) {
  const { t } = useUiTranslation();
  const [pending, setPending] = useState<Partial<Record<PlacementAxis, number>>>({});
  useEffect(() => {
    if (position) setPending({});
  }, [position]);
  const valueOf = (axis: PlacementAxis) => position?.[axis] ?? pending[axis] ?? null;

  const commit = (axis: PlacementAxis, value: number | null) => {
    const x = axis === "x" ? value : valueOf("x");
    const y = axis === "y" ? value : valueOf("y");
    if (x !== null && y !== null) {
      setPending({});
      onChange({ x, y });
      return;
    }
    setPending({ ...(x !== null ? { x } : {}), ...(y !== null ? { y } : {}) });
    onChange(undefined);
  };

  return (
    <fieldset className="grid grid-cols-2 gap-2">
      <legend className={LABEL_CLASS}>{t("ui.chat.imageregeneratepanel.characterPlacement", { name })}</legend>
      {(["x", "y"] as const).map((axis) => (
        <label key={axis} className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-[var(--muted-foreground)]">
            {t(axis === "x" ? "ui.chat.imageregeneratepanel.positionX" : "ui.chat.imageregeneratepanel.positionY")}
          </span>
          <DraftNumberInput
            allowEmpty
            integer={false}
            min={0}
            max={1}
            disabled={disabled}
            value={valueOf(axis)}
            placeholder={t("ui.chat.imageregeneratepanel.positionAutomatic")}
            className={FIELD_CLASS}
            onCommit={(value) => commit(axis, value)}
          />
        </label>
      ))}
      {!position && (pending.x !== undefined || pending.y !== undefined) && (
        <p role="status" className="col-span-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
          {t("ui.chat.imageregeneratepanel.placementIncomplete", { name })}
        </p>
      )}
    </fieldset>
  );
}

export function ImageRegeneratePanel({
  image,
  record,
  messageId,
  onCancel,
  onBusyChange,
  onRegenerated,
  className,
}: ImageRegeneratePanelProps) {
  const { t } = useUiTranslation();
  const debugMode = useUIStore((s) => s.debugMode);
  const { data: connectionRows } = useConnections();
  const regenerate = useRegenerateChatImage(image.chatId);
  const revise = useReviseChatImagePrompt(image.chatId);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const runningRef = useRef(false);
  const titleId = useId();
  const connectionFieldId = useId();
  const original: ImagePromptDraft = {
    prompt: record?.prompt ?? image.prompt,
    negativePrompt: record?.negativePrompt ?? "",
    characterPrompts: record?.characterPrompts ?? [],
  };
  const [draft, setDraft] = useState(original);
  const [guidance, setGuidance] = useState("");
  const [connectionId, setConnectionId] = useState(record?.connectionId ?? "");
  const [phase, setPhase] = useState<"revising" | "generating" | null>(null);
  const [error, setError] = useState("");
  const busy = phase !== null;
  const promptMissing = !draft.prompt.trim();
  const references = record?.references;
  const hasReferences =
    !!references && (references.characterIds.length > 0 || !!references.personaId || !!references.locationImageId);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const updateCharacter = (index: number, update: (entry: CharacterPrompt) => CharacterPrompt) =>
    setDraft((current) => ({
      ...current,
      characterPrompts: current.characterPrompts.map((entry, entryIndex) =>
        entryIndex === index ? update(entry) : entry,
      ),
    }));

  const run = async (action: "revise" | "generate" | "both") => {
    if (runningRef.current || promptMissing) return;
    runningRef.current = true;
    onBusyChange(true);
    setError("");
    let step: "revising" | "generating" = action === "generate" ? "generating" : "revising";
    setPhase(step);
    try {
      let input = {
        prompt: draft.prompt.trim(),
        negativePrompt: draft.negativePrompt,
        characterPrompts: draft.characterPrompts.filter((entry) => entry.prompt.trim()),
      };
      const connection = connectionRows?.some(
        (row) =>
          !!row &&
          typeof row === "object" &&
          "id" in row &&
          row.id === connectionId &&
          "provider" in row &&
          row.provider === "image_generation",
      )
        ? { connectionId }
        : {};
      if (action !== "generate") {
        input = await revise.mutateAsync({ imageId: image.id, ...input, guidance, ...connection, debugMode });
        // Merge revisions into the sent fields, keep cleared fields for reset, and append newly extracted captions.
        let revisedIndex = 0;
        const characterPrompts = draft.characterPrompts.map((entry) =>
          entry.prompt.trim() ? (input.characterPrompts[revisedIndex++] ?? entry) : entry,
        );
        characterPrompts.push(...input.characterPrompts.slice(revisedIndex));
        setDraft({ ...input, characterPrompts });
        if (action === "revise") {
          toast.success(t("ui.chat.imageregeneratepanel.revised"));
          return;
        }
      }
      step = "generating";
      setPhase(step);
      const result = await regenerate.mutateAsync({
        imageId: image.id,
        ...input,
        ...connection,
        ...(messageId ? { messageId } : {}),
        debugMode,
      });
      toast.success(t("ui.chat.imageregeneratepanel.regenerated"));
      onRegenerated(result.image);
    } catch (cause) {
      const label = t(
        step === "revising" ? "ui.chat.imageregeneratepanel.reviseFailed" : "ui.chat.imageregeneratepanel.failed",
      );
      setError(
        cause instanceof Error
          ? t("ui.chat.imageregeneratepanel.errorDetail", { label, message: cause.message })
          : label,
      );
    } finally {
      runningRef.current = false;
      setPhase(null);
      onBusyChange(false);
    }
  };

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--sidebar)] text-left text-[var(--foreground)] shadow-2xl",
        NEUTRAL_SURFACE_VARIABLES,
        className,
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <h2
        id={titleId}
        ref={titleRef}
        tabIndex={-1}
        className="shrink-0 border-b border-[var(--border)] px-4 py-3 text-base font-semibold focus:outline-none"
      >
        {t("ui.chat.chatimagelightbox.regenerateImage")}
      </h2>
      <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain px-4 pb-4">
        <PromptField
          label={t("ui.agents.customagentrepositoriesmodal.prompt")}
          value={draft.prompt}
          original={original.prompt}
          onChange={(prompt) => setDraft((current) => ({ ...current, prompt }))}
          disabled={busy}
          rows={4}
        />
        <PromptField
          label={t("ui.agents.agenteditor.negativePrompt")}
          value={draft.negativePrompt}
          original={original.negativePrompt}
          onChange={(negativePrompt) => setDraft((current) => ({ ...current, negativePrompt }))}
          disabled={busy}
        />

        {draft.characterPrompts.length > 0 && (
          <div className="space-y-3 border-t border-[var(--border)] pt-3">
            <h3 className="text-sm font-semibold">{t("ui.chat.imageregeneratepanel.characterPrompts")}</h3>
            {draft.characterPrompts.map((character, index) => (
              <div key={`${character.name}-${index}`} className="space-y-2">
                <PromptField
                  label={t("ui.chat.imagepromptpanel.characterPrompt", { name: character.name })}
                  value={character.prompt}
                  original={original.characterPrompts[index]?.prompt ?? ""}
                  onChange={(prompt) => updateCharacter(index, (entry) => ({ ...entry, prompt }))}
                  disabled={busy}
                />
                <PromptField
                  label={t("ui.chat.imagepromptpanel.characterNegativePrompt", { name: character.name })}
                  value={character.negativePrompt ?? ""}
                  original={original.characterPrompts[index]?.negativePrompt ?? ""}
                  onChange={(negativePrompt) => updateCharacter(index, (entry) => ({ ...entry, negativePrompt }))}
                  disabled={busy}
                />
                <PlacementFields
                  name={character.name}
                  position={character.position}
                  disabled={busy}
                  onChange={(position) => updateCharacter(index, (entry) => ({ ...entry, position }))}
                />
              </div>
            ))}
          </div>
        )}

        <label className="flex flex-col gap-2 border-t border-[var(--border)] pt-3">
          <span className={LABEL_CLASS}>{t("ui.chat.imageregeneratepanel.guidance")}</span>
          <textarea
            value={guidance}
            onChange={(event) => setGuidance(event.target.value)}
            disabled={busy}
            rows={2}
            maxLength={4000}
            placeholder={t("ui.chat.imageregeneratepanel.guidancePlaceholder")}
            className={FIELD_CLASS}
          />
        </label>

        <div className="flex flex-col gap-2">
          <label htmlFor={connectionFieldId} className={LABEL_CLASS}>
            {t("ui.chat.imageregeneratepanel.connection")}
          </label>
          <ConnectionSelect
            id={connectionFieldId}
            job={t("connections.picker.job.imageRegeneration")}
            kind="image"
            value={connectionId || null}
            onChange={(nextId) => setConnectionId(nextId ?? "")}
            defaultLabel={t("ui.chat.imageregeneratepanel.chatConnection")}
            disabled={busy}
            className="min-h-11"
          />
        </div>

        {(!record || hasReferences) && (
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
            {t(
              !record ? "ui.chat.imageregeneratepanel.noRecordNotice" : "ui.chat.imageregeneratepanel.referencesNotice",
            )}
          </p>
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--border)] px-4 py-3">
        {error && (
          <p role="alert" className="mb-2 max-h-20 overflow-y-auto break-words text-sm text-[var(--destructive)]">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {phase && (
            <p role="status" className="mr-auto flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              <Loader2 size="1rem" className="animate-spin" aria-hidden />
              {t(
                phase === "revising"
                  ? "ui.chat.imageregeneratepanel.revising"
                  : "ui.chat.imageregeneratepanel.generating",
              )}
            </p>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={cn(BUTTON_CLASS, "hover:bg-[var(--accent)]")}
          >
            {t("chat.delete.dialog.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void run("revise")}
            disabled={busy || promptMissing}
            className={SECONDARY_BUTTON_CLASS}
          >
            <Sparkles size="1rem" aria-hidden />
            {t("ui.chat.imageregeneratepanel.revise")}
          </button>
          <button
            type="button"
            onClick={() => void run("generate")}
            disabled={busy || promptMissing}
            className={SECONDARY_BUTTON_CLASS}
          >
            <RefreshCw size="1rem" aria-hidden />
            {t("ui.chat.imageregeneratepanel.generate")}
          </button>
          <button
            type="button"
            onClick={() => void run("both")}
            disabled={busy || promptMissing}
            className={cn(
              BUTTON_CLASS,
              "bg-[var(--primary)] font-semibold text-[var(--primary-foreground)] hover:opacity-90",
            )}
          >
            {t("ui.chat.imageregeneratepanel.reviseAndGenerate")}
          </button>
        </div>
      </div>
    </section>
  );
}
