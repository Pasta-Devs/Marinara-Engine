import { Copy } from "lucide-react";
import { toast } from "sonner";
import type { MessageExtra } from "../../../../../engine/contracts/types/chat";
import { stripGenerationGuideInstruction } from "../../../../../engine/shared/text/generation-guide";
import { Modal } from "../../../../../shared/components/ui/Modal";
import { copyToClipboard } from "../../../../../shared/lib/utils";

type GenerationReplay = NonNullable<MessageExtra["generationReplay"]>;
type GuideSource = NonNullable<GenerationReplay["generationGuideSource"]>;

const GUIDE_SOURCE_LABELS: Record<GuideSource, string> = {
  narrator: "/guided",
  guide: "Guided regenerate",
  game_start: "Game start",
  game_turn: "Game turn",
  game_retry: "Game retry",
};

function storedText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function visibleGenerationGuide(replay: GenerationReplay | null): string | null {
  const guide = storedText(replay?.generationGuide);
  if (!guide) return null;
  return replay?.generationGuideSource === "narrator" || replay?.generationGuideSource === "guide"
    ? stripGenerationGuideInstruction(guide)
    : guide;
}

export function hasGenerationReplayDetails(value: unknown): value is GenerationReplay {
  if (!value || typeof value !== "object") return false;
  const replay = value as GenerationReplay;
  return replay.impersonate === true || storedText(replay.generationGuide) !== null;
}

function guideLabel(source: GenerationReplay["generationGuideSource"]): string {
  return source && source in GUIDE_SOURCE_LABELS ? GUIDE_SOURCE_LABELS[source as GuideSource] : "Stored guidance";
}

function TextBlock({
  label,
  value,
  muted = false,
  copyValue,
  copyLabel = "Copy",
}: {
  label: string;
  value: string;
  muted?: boolean;
  copyValue?: string | null;
  copyLabel?: string;
}) {
  const handleCopy = async () => {
    if (!copyValue) return;
    const ok = await copyToClipboard(copyValue);
    toast[ok ? "success" : "error"](ok ? "Copied to clipboard." : "Clipboard copy failed.");
  };

  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[0.75rem] font-semibold uppercase tracking-normal text-[var(--muted-foreground)]">
          {label}
        </h3>
        {copyValue && (
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 text-[0.6875rem] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
          >
            <Copy size="0.75rem" />
            {copyLabel}
          </button>
        )}
      </div>
      <pre
        className={`max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2 text-[0.8125rem] leading-relaxed ${
          muted ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)]"
        }`}
      >
        {value}
      </pre>
    </section>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 text-[0.8125rem] max-sm:grid-cols-1 max-sm:gap-1">
      <dt className="font-medium text-[var(--muted-foreground)]">{label}</dt>
      <dd className="min-w-0 break-words font-mono text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

export function GenerationReplayDetailsModal({
  open,
  replay,
  onClose,
}: {
  open: boolean;
  replay: GenerationReplay | null;
  onClose: () => void;
}) {
  const generationGuide = visibleGenerationGuide(replay);
  const impersonateDirection = storedText(replay?.userMessage);
  const impersonateGuidance =
    hasGenerationReplayDetails(replay) && replay?.impersonate === true
      ? (generationGuide ?? impersonateDirection)
      : null;
  const impersonatePromptTemplate = storedText(replay?.impersonatePromptTemplate);
  const hasImpersonate = replay?.impersonate === true;
  const hasMetadata =
    hasImpersonate &&
    (storedText(replay?.impersonatePresetId) ||
      storedText(replay?.impersonateConnectionId) ||
      replay?.impersonateBlockAgents === true);
  const guidedCopyCommand =
    generationGuide &&
    !hasImpersonate &&
    (replay?.generationGuideSource === "narrator" || replay?.generationGuideSource === "guide")
      ? `/guided ${generationGuide.trim()}`
      : null;

  return (
    <Modal open={open} onClose={onClose} title="Stored guidance" width="max-w-xl">
      <div className="space-y-5">
        {generationGuide && !hasImpersonate && (
          <TextBlock
            label={guideLabel(replay?.generationGuideSource)}
            value={generationGuide}
            copyValue={guidedCopyCommand}
            copyLabel="Copy /guided"
          />
        )}

        {hasImpersonate && (
          <section className="space-y-3">
            <h3 className="text-[0.75rem] font-semibold uppercase tracking-normal text-[var(--muted-foreground)]">
              /impersonate
            </h3>
            <TextBlock
              label="Current guidance"
              value={impersonateGuidance ?? "No guidance stored"}
              muted={!impersonateGuidance}
            />
            {impersonatePromptTemplate && <TextBlock label="Prompt template" value={impersonatePromptTemplate} />}
            {hasMetadata && (
              <dl className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2">
                {storedText(replay?.impersonatePresetId) && (
                  <MetadataRow label="Preset" value={storedText(replay?.impersonatePresetId)!} />
                )}
                {storedText(replay?.impersonateConnectionId) && (
                  <MetadataRow label="Connection" value={storedText(replay?.impersonateConnectionId)!} />
                )}
                {replay?.impersonateBlockAgents === true && <MetadataRow label="Agents" value="Blocked" />}
              </dl>
            )}
          </section>
        )}

        {!generationGuide && !hasImpersonate && (
          <p className="text-sm text-[var(--muted-foreground)]">No stored guidance on this swipe.</p>
        )}
      </div>
    </Modal>
  );
}
