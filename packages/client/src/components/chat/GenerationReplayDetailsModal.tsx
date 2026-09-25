import { stripGenerationGuideInstruction, type MessageExtra } from "@marinara-engine/shared";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "../ui/Modal";
import { useTranslation as useUiTranslation } from "react-i18next";
import { copyToClipboard } from "../../lib/utils";

type GenerationReplay = NonNullable<MessageExtra["generationReplay"]>;
type GuideSource = NonNullable<GenerationReplay["generationGuideSource"]>;

const GUIDE_SOURCE_LABELS: Record<GuideSource, string> = {
  narrator: "ui.chat.generationreplaydetailsmodal.guideSource.narrator",
  guide: "ui.chat.generationreplaydetailsmodal.guideSource.guide",
  game_start: "ui.chat.generationreplaydetailsmodal.guideSource.gameStart",
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

function guideLabel(source: GenerationReplay["generationGuideSource"], localizeUi: (key: string) => string): string {
  const key =
    source && source in GUIDE_SOURCE_LABELS
      ? GUIDE_SOURCE_LABELS[source as GuideSource]
      : "ui.chat.chatmessage.storedGuidance";
  return localizeUi(key);
}

/** What a block's copy button puts on the clipboard, and how it reports itself. */
type CopyAction = {
  value: string;
  label: string;
  title: string;
  copiedMessage: string;
  failedMessage: string;
};

function TextBlock({
  label,
  value,
  muted = false,
  copy,
}: {
  label: string;
  value: string;
  muted?: boolean;
  copy?: CopyAction | null;
}) {
  const handleCopy = async () => {
    if (!copy) return;
    try {
      const copied = await copyToClipboard(copy.value);
      if (copied) {
        toast.success(copy.copiedMessage);
      } else {
        toast.error(copy.failedMessage);
      }
    } catch {
      toast.error(copy.failedMessage);
    }
  };

  return (
    <section className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[0.75rem] font-semibold uppercase tracking-normal text-[var(--muted-foreground)]">
          {label}
        </h3>
        {copy && (
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-[0.6875rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            title={copy.title}
            aria-label={copy.title}
          >
            <Copy size="0.75rem" className="shrink-0" />
            {copy.label}
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
  const guidedCopy: CopyAction | null = guidedCopyCommand
    ? {
        value: guidedCopyCommand,
        label: localizeUi("ui.chat.textblock.copyGuided"),
        title: localizeUi("ui.chat.textblock.copyAsGuidedCommand"),
        copiedMessage: localizeUi("ui.chat.textblock.guidedCommandCopied"),
        failedMessage: localizeUi("ui.chat.textblock.couldNotCopyGuidance"),
      }
    : null;
  // The stored guidance is what /impersonate took as its direction, so the
  // command below replays the same generation.
  const impersonateCopy: CopyAction | null = impersonateGuidance
    ? {
        value: `/impersonate ${impersonateGuidance.trim()}`,
        label: localizeUi("ui.chat.textblock.copyImpersonate"),
        title: localizeUi("ui.chat.textblock.copyAsImpersonateCommand"),
        copiedMessage: localizeUi("ui.chat.textblock.impersonateCommandCopied"),
        failedMessage: localizeUi("ui.chat.textblock.couldNotCopyGuidance"),
      }
    : null;
  // The template is a stored setting rather than a command, so it copies as-is.
  const promptTemplateCopy: CopyAction | null = impersonatePromptTemplate
    ? {
        value: impersonatePromptTemplate,
        label: localizeUi("ui.chat.textblock.copy"),
        title: localizeUi("ui.chat.textblock.copyPromptTemplate"),
        copiedMessage: localizeUi("ui.chat.textblock.promptTemplateCopied"),
        failedMessage: localizeUi("ui.chat.textblock.couldNotCopyPromptTemplate"),
      }
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
            label={guideLabel(replay?.generationGuideSource, localizeUi)}
            value={generationGuide}
            copy={guidedCopy}
          />
        )}

        {hasImpersonate && (
          <section className="space-y-3">
            <h3 className="text-[0.75rem] font-semibold uppercase tracking-normal text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.generationreplaydetailsmodal.impersonate")}
            </h3>
            <TextBlock
              label={localizeUi("ui.chat.generationreplaydetailsmodal.currentGuidance")}
              value={impersonateGuidance ?? localizeUi("ui.chat.generationreplaydetailsmodal.noGuidanceStored")}
              muted={!impersonateGuidance}
              copy={impersonateCopy}
            />
            {impersonatePromptTemplate && (
              <TextBlock
                label={localizeUi("ui.chat.generationreplaydetailsmodal.promptTemplate")}
                value={impersonatePromptTemplate}
                copy={promptTemplateCopy}
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
                  <MetadataRow
                    label={localizeUi("navigation.topbar.agents")}
                    value={localizeUi("ui.chat.generationreplaydetailsmodal.blocked")}
                  />
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
