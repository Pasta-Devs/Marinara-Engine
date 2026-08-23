import { stripGenerationGuideInstruction, type MessageExtra } from "@marinara-engine/shared";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "../ui/Modal";
import { useTranslation as useUiTranslation } from "react-i18next";

type GenerationReplay = NonNullable<MessageExtra["generationReplay"]>;
type GuideSource = NonNullable<GenerationReplay["generationGuideSource"]>;

const GUIDE_SOURCE_LABELS: Record<GuideSource, string> = {
  narrator: "/guided",
  guide: "Guided regenerate",
  game_start: "Game start",
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

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function TextBlock({
  label,
  value,
  muted = false,
  copyValue,
}: {
  label: string;
  value: string;
  muted?: boolean;
  copyValue?: string | null;
}) {
  const { t: localizeUi } = useUiTranslation();
  const handleCopy = async () => {
    if (!copyValue) return;
    try {
      await copyToClipboard(copyValue);
      toast.success(localizeUi("ui.chat.textblock.guidedCommandCopied"));
    } catch {
      toast.error(localizeUi("ui.chat.textblock.couldNotCopyGuidance"));
    }
  };

  return (
    <section className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[0.75rem] font-semibold uppercase tracking-normal text-[var(--muted-foreground)]">
          {label}
        </h3>
        {copyValue && (
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-[0.6875rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            title={localizeUi("ui.chat.textblock.copyAsGuidedCommand")}
            aria-label={localizeUi("ui.chat.textblock.copyAsGuidedCommand")}
          >
            <Copy size="0.75rem" className="shrink-0" />
            {localizeUi("ui.chat.textblock.copyGuided")}
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
  const { t: localizeUi } = useUiTranslation();
  const generationGuide = visibleGenerationGuide(replay);
  const impersonateDirection = storedText(replay?.userMessage);
  const impersonateGuidance =
    hasGenerationReplayDetails(replay) && replay?.impersonate === true
      ? (generationGuide ?? impersonateDirection)
      : null;
  const impersonatePromptTemplate = storedText(replay?.impersonatePromptTemplate);
  const hasImpersonate = replay?.impersonate === true;
  const guidedCopyCommand =
    generationGuide && !hasImpersonate && replay?.generationGuideSource !== "game_start"
      ? `/guided ${generationGuide.trim()}`
      : null;
  const hasMetadata =
    hasImpersonate &&
    (storedText(replay?.impersonatePresetId) ||
      storedText(replay?.impersonateConnectionId) ||
      replay?.impersonateBlockAgents === true);

  return (
    <Modal open={open} onClose={onClose} title={localizeUi("ui.chat.chatmessage.storedGuidance")} width="max-w-xl">
      <div className="space-y-5">
        {generationGuide && !hasImpersonate && (
          <TextBlock
            label={guideLabel(replay?.generationGuideSource)}
            value={generationGuide}
            copyValue={guidedCopyCommand}
          />
        )}

        {hasImpersonate && (
          <section className="space-y-3">
            <h3 className="text-[0.75rem] font-semibold uppercase tracking-normal text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.generationreplaydetailsmodal.impersonate")}
            </h3>
            <TextBlock
              label={localizeUi("ui.chat.generationreplaydetailsmodal.currentGuidance")}
              value={impersonateGuidance ?? "No guidance stored"}
              muted={!impersonateGuidance}
            />
            {impersonatePromptTemplate && (
              <TextBlock
                label={localizeUi("ui.chat.generationreplaydetailsmodal.promptTemplate")}
                value={impersonatePromptTemplate}
              />
            )}
            {hasMetadata && (
              <dl className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2">
                {storedText(replay?.impersonatePresetId) && (
                  <MetadataRow
                    label={localizeUi("chat.toolbar.preset")}
                    value={storedText(replay?.impersonatePresetId)!}
                  />
                )}
                {storedText(replay?.impersonateConnectionId) && (
                  <MetadataRow
                    label={localizeUi("ui.chat.conversationquicksetup.connection")}
                    value={storedText(replay?.impersonateConnectionId)!}
                  />
                )}
                {replay?.impersonateBlockAgents === true && (
                  <MetadataRow label={localizeUi("navigation.topbar.agents")} value="Blocked" />
                )}
              </dl>
            )}
          </section>
        )}

        {!generationGuide && !hasImpersonate && (
          <p className="text-sm text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.generationreplaydetailsmodal.noStoredGuidanceOnThisSwipe")}
          </p>
        )}
      </div>
    </Modal>
  );
}
