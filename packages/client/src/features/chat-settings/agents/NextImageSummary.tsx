// "Next image in this chat": a read-only summary at the top of the Illustrator (and Conversation selfie) card that
// names the image model, fallback, prompt writer, style and reference pictures the next picture uses, and which
// setting each comes from. The server answers it with the same rules the generators follow.
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Chat } from "@marinara-engine/shared";
import { api } from "../../../lib/api-client";
import { useConnections } from "../../../hooks/use-connections";
import { useAgentConfigs } from "../../../hooks/use-agents";
import { useUIStore } from "../../../stores/ui.store";

export type ImagePlanSource =
  | "chat"
  | "illustratorSetup"
  | "imagesDefault"
  | "illustratorModel"
  | "chatModel"
  | "main"
  | "gameSetup"
  | "modelStyle"
  | "styleDefault"
  | "none";

type PlanModel = { id: string; name: string; model: string; source: ImagePlanSource };

export type ChatImagePlan = {
  kind: "illustrator" | "selfie";
  imageModel: PlanModel | null;
  imageModelSkipped: ImagePlanSource | null;
  fallback: Omit<PlanModel, "source"> | null;
  promptWriter: PlanModel | null;
  promptWriterSkipped: ImagePlanSource | null;
  style: { id: string | null; name: string; source: ImagePlanSource };
  inheritedStyle: { id: string | null; name: string; source: ImagePlanSource };
  references: {
    on: boolean;
    source: "chat" | "illustratorSetup";
    toImageModel: boolean;
    toWriter: boolean;
    workflowSlots: number[] | null;
    blanksFilled: boolean;
  };
};

/** The words for where a value comes from; shared with the pickers' "Using …" lines. */
export function imageSourceLabel(t: (key: string) => string, source: ImagePlanSource | "agentSetup"): string {
  return t(`ui.chat.imageSources.${source}`);
}

const PLAN_KEYS = [
  "illustratorImageConnectionId",
  "illustratorPromptConnectionId",
  "imageStyleProfileId",
  "gameSetupConfig",
  "gameImageConnectionId",
  "imageGenConnectionId",
  "conversationCommandToggles",
  "illustratorUseAvatarReferences",
  "illustratorReferencePictureTarget",
  "selfieUseAvatarReferences",
] as const;

export function useChatImagePlan(chat: Chat, enabled = true) {
  const metadata = (chat.metadata ?? {}) as Record<string, unknown>;
  const connections = useConnections();
  const agents = useAgentConfigs();
  const styleProfiles = useUIStore((s) => s.imageStyleProfiles);
  // Refetch whenever anything the answer reads changes: this chat's picks, its model, the Illustrator setup,
  // the saved Models and the style profiles.
  const signature = JSON.stringify([
    PLAN_KEYS.map((key) => metadata[key] ?? null),
    chat.connectionId ?? null,
    chat.mode,
    connections.dataUpdatedAt,
    agents.dataUpdatedAt,
    styleProfiles,
  ]);
  return useQuery({
    queryKey: ["chat-image-plan", chat.id, signature],
    queryFn: () => api.get<ChatImagePlan>(`/chats/${chat.id}/image-plan`),
    enabled,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });
}

export function NextImageSummary({ chat }: { chat: Chat }) {
  const { t } = useTranslation();
  const plan = useChatImagePlan(chat).data;
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const openAgentDetail = useUIStore((s) => s.openAgentDetail);
  const setSettingsTab = useUIStore((s) => s.setSettingsTab);
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  if (!plan) return null;

  // Where a source chip takes you: the Model's own page, the Illustrator setup, or the style profiles.
  const jump = (source: ImagePlanSource, modelId?: string | null) => {
    if (source === "illustratorSetup" || source === "illustratorModel") return () => openAgentDetail("illustrator");
    if (
      (source === "imagesDefault" || source === "chatModel" || source === "main" || source === "modelStyle") &&
      modelId
    )
      return () => openConnectionDetail(modelId);
    if (source === "styleDefault")
      return () => {
        setSettingsTab("generations");
        openRightPanel("settings");
      };
    return undefined;
  };

  const refs = plan.references;
  const referencesText = !refs.on
    ? t("ui.chat.nextImage.referencesOff")
    : refs.toImageModel && refs.toWriter
      ? t("ui.chat.nextImage.referencesBoth")
      : refs.toWriter
        ? t("ui.chat.nextImage.referencesWriter")
        : t("ui.chat.nextImage.referencesModel");
  const slotsText =
    refs.on && refs.toImageModel && refs.workflowSlots
      ? refs.workflowSlots.length > 0
        ? t("ui.chat.nextImage.workflowSlots", { count: refs.workflowSlots.length })
        : t("ui.chat.nextImage.noWorkflowSlots")
      : null;

  return (
    <div
      data-next-image-summary
      className="ov-next-image overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]"
    >
      <div className="border-b border-[var(--border)] px-2.5 py-1.5 text-[0.6875rem] font-semibold text-[var(--foreground)]">
        {plan.kind === "selfie" ? t("ui.chat.nextImage.selfieTitle") : t("ui.chat.nextImage.title")}
      </div>
      <Row
        label={t("ui.chat.nextImage.imageModel")}
        value={plan.imageModel?.name ?? t("ui.chat.nextImage.noneSet")}
        source={plan.imageModel?.source ?? null}
        onSource={jump(plan.imageModel?.source ?? "none", plan.imageModel?.id)}
        note={
          plan.imageModelSkipped
            ? t("ui.chat.nextImage.skipped", { source: imageSourceLabel(t, plan.imageModelSkipped) })
            : null
        }
        warn={!plan.imageModel}
      />
      {plan.fallback ? (
        <Row
          label={t("ui.chat.nextImage.ifItFails")}
          value={plan.fallback.name}
          source="imagesDefault"
          onSource={() => openConnectionDetail(plan.fallback!.id)}
        />
      ) : null}
      <Row
        label={t("ui.chat.nextImage.promptWriter")}
        value={plan.promptWriter?.name ?? t("ui.chat.nextImage.noneSet")}
        source={plan.promptWriter?.source ?? null}
        onSource={jump(plan.promptWriter?.source ?? "none", plan.promptWriter?.id)}
        note={
          plan.promptWriterSkipped
            ? t(plan.kind === "selfie" ? "ui.chat.nextImage.writerMissingSelfie" : "ui.chat.nextImage.writerMissing")
            : null
        }
        warn={!plan.promptWriter}
      />
      <Row
        label={t("ui.chat.nextImage.style")}
        value={plan.style.name}
        source={plan.style.source === "none" ? null : plan.style.source}
        onSource={jump(plan.style.source, plan.style.source === "modelStyle" ? plan.imageModel?.id : null)}
      />
      <Row
        label={t("ui.chat.nextImage.references")}
        value={slotsText ? `${referencesText} · ${slotsText}` : referencesText}
        source={refs.source}
        onSource={jump(refs.source)}
        warn={!!(refs.on && refs.toImageModel && refs.workflowSlots && refs.workflowSlots.length === 0)}
      />
    </div>
  );
}

function Row({
  label,
  value,
  source,
  onSource,
  note = null,
  warn = false,
}: {
  label: string;
  value: string;
  source: ImagePlanSource | null;
  onSource?: () => void;
  note?: string | null;
  warn?: boolean;
}) {
  const { t } = useTranslation();
  const chip = source ? imageSourceLabel(t, source) : null;
  return (
    <div className="ov-next-image__row grid grid-cols-[minmax(5.5rem,auto)_minmax(0,1fr)_auto] items-center gap-2 border-b border-[var(--border)] px-2.5 py-1.5 text-[0.6875rem] last:border-b-0">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="min-w-0">
        <span
          className={warn ? "block truncate text-amber-400" : "block truncate text-[var(--foreground)]"}
          title={value}
        >
          {value}
        </span>
        {note ? <span className="block text-[0.625rem] leading-snug text-amber-400">{note}</span> : null}
      </span>
      {chip ? (
        onSource ? (
          <button
            type="button"
            onClick={onSource}
            className={
              source === "chat"
                ? "whitespace-nowrap rounded-full border border-[var(--primary)]/45 px-1.5 py-px text-[0.625rem] text-[var(--primary)] transition-opacity hover:opacity-80"
                : "whitespace-nowrap rounded-full border border-[var(--border)] px-1.5 py-px text-[0.625rem] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            }
          >
            {chip}
          </button>
        ) : (
          <span
            className={
              source === "chat"
                ? "whitespace-nowrap rounded-full border border-[var(--primary)]/45 px-1.5 py-px text-[0.625rem] text-[var(--primary)]"
                : "whitespace-nowrap rounded-full border border-[var(--border)] px-1.5 py-px text-[0.625rem] text-[var(--muted-foreground)]"
            }
          >
            {chip}
          </span>
        )
      ) : (
        <span />
      )}
    </div>
  );
}
