// Illustrator's per-chat controls, shared by its Conversation, Roleplay and Game cards in Chat Settings.
import {
  MAX_ILLUSTRATOR_IMAGES_PER_GENERATION,
  MAX_ILLUSTRATOR_RUN_INTERVAL,
  normalizeIllustratorImagesPerGeneration,
  type Chat,
} from "@marinara-engine/shared";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { useUpdateChatMetadata } from "../../../hooks/use-chats";
import { AgentDefaultStatus } from "../../../components/chat/AgentSettingsControls";
import { NeedsModelChip, agentModelNeed } from "../../../components/connections/NeedsModelChip";
import { ConnectionSelect } from "../../../components/connections/ConnectionSelect";
import { DraftNumberInput } from "../../../components/ui/DraftNumberInput";
import { Select } from "../../../components/ui/Select";
import { useUIStore } from "../../../stores/ui.store";
import { imageSourceLabel, useChatImagePlan } from "./NextImageSummary";

/**
 * "Using …" while a field follows the next setting down, or "This chat only" with a reset to it once the chat
 * picks its own. The source is named, so a reset says where it returns to.
 */
export function InheritStatus({
  overridden,
  sourceLabel,
  onReset,
}: {
  overridden: boolean;
  sourceLabel: string;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2 px-1 text-[0.625rem] text-[var(--muted-foreground)]">
      <span>
        {overridden ? t("ui.chat.inheritStatus.thisChat") : t("ui.chat.inheritStatus.using", { source: sourceLabel })}
      </span>
      {overridden ? (
        <button
          type="button"
          onClick={onReset}
          className="font-medium text-[var(--primary)] transition-opacity hover:opacity-80"
        >
          {t("ui.chat.inheritStatus.use", { source: sourceLabel })}
        </button>
      ) : null}
    </div>
  );
}

/**
 * The text model that writes image prompts. Without a pick of its own the chat follows, as the generators do:
 * Illustrator pictures use the Illustrator setup's model, then the chat's model; selfies use the chat's model.
 */
export function IllustratorPromptConnectionSelect({
  chat,
  connectionId,
  includeLocalSidecar,
  illustratorConnectionId = null,
}: {
  chat: Chat;
  connectionId: string;
  includeLocalSidecar: boolean;
  /** The Illustrator setup's own model; Conversation selfies and Game prompts skip it. */
  illustratorConnectionId?: string | null;
}) {
  const { t } = useTranslation();
  const { t: localizeUi } = useUiTranslation();
  const updateMeta = useUpdateChatMetadata();
  const update = (next: string) => updateMeta.mutate({ id: chat.id, illustratorPromptConnectionId: next || null });
  const followsIllustrator = chat.mode === "roleplay" && !!illustratorConnectionId;
  const chatModelId = typeof chat.connectionId === "string" && chat.connectionId ? chat.connectionId : null;
  const sourceLabel = imageSourceLabel(t, followsIllustrator ? "illustratorModel" : chatModelId ? "chatModel" : "main");
  return (
    <div className="flex flex-col gap-1" data-image-field="prompt-writer">
      <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.promptModel")}
      </span>
      <ConnectionSelect
        job={t("connections.picker.job.illustratorPrompts")}
        value={connectionId || null}
        onChange={(next) => update(next ?? "")}
        includeLocalSidecar={includeLocalSidecar}
        defaultLabel={sourceLabel}
        inherits={{ connectionId: followsIllustrator ? illustratorConnectionId : chatModelId }}
      />
      <span className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.choosesTheTextModelThatWritesIllustratorSelfiePrompts")}
      </span>
      <InheritStatus overridden={connectionId.length > 0} sourceLabel={sourceLabel} onReset={() => update("")} />
    </div>
  );
}

/**
 * The image model for this chat's pictures. Without a pick of its own the chat follows the Illustrator setup's
 * model, then the Images default. Game chats keep theirs under gameImageConnectionId.
 */
export function IllustratorImageConnectionSelect({
  chat,
  connectionId,
  agentSettings,
  metadataKey = "illustratorImageConnectionId",
}: {
  chat: Chat;
  connectionId: string;
  /** The Illustrator agent's saved settings: its own image model, and the model-needed chip. */
  agentSettings: unknown;
  metadataKey?: "illustratorImageConnectionId" | "gameImageConnectionId";
}) {
  const { t } = useTranslation();
  const { t: localizeUi } = useUiTranslation();
  const updateMeta = useUpdateChatMetadata();
  const update = (next: string) => updateMeta.mutate({ id: chat.id, [metadataKey]: next || null });
  const setupModel =
    agentSettings && typeof agentSettings === "object"
      ? (agentSettings as Record<string, unknown>).imageConnectionId
      : null;
  const setupModelId = typeof setupModel === "string" && setupModel.trim() ? setupModel.trim() : null;
  const sourceLabel = imageSourceLabel(t, setupModelId ? "illustratorSetup" : "imagesDefault");
  return (
    <div className="flex flex-col gap-1" data-image-field="image-model">
      <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.imageConnection")}
      </span>
      <ConnectionSelect
        job={t("connections.picker.job.images")}
        value={connectionId || null}
        onChange={(next) => update(next ?? "")}
        kind="image"
        defaultLabel={sourceLabel}
        inherits={setupModelId ? { connectionId: setupModelId } : "agents"}
      />
      <InheritStatus overridden={connectionId.length > 0} sourceLabel={sourceLabel} onReset={() => update("")} />
      <NeedsModelChip kind="image" own={connectionId || agentModelNeed("illustrator", agentSettings)?.own} />
    </div>
  );
}

export function IllustratorImageStyleSelect({
  chat,
  styleProfileId,
  emptyOptionLabel,
  description,
}: {
  chat: Chat;
  styleProfileId: string;
  emptyOptionLabel?: string;
  description?: string;
}) {
  const { t } = useTranslation();
  const { t: localizeUi } = useUiTranslation();
  const updateMeta = useUpdateChatMetadata();
  const imageStyleProfiles = useUIStore((s) => s.imageStyleProfiles);
  // The style without this chat's own pick, as the generators find it: Game setup, the image model's own style,
  // then the Style Profiles default.
  const inherited = useChatImagePlan(chat).data?.inheritedStyle ?? null;
  const inheritedLabel = inherited
    ? t("connections.select.inheritWith", { label: imageSourceLabel(t, inherited.source), model: inherited.name })
    : null;
  const update = (value: string) => updateMeta.mutate({ id: chat.id, imageStyleProfileId: value || null });
  return (
    <div className="flex flex-col gap-1" data-image-field="style">
      <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.imageStyle")}
      </span>
      <Select
        label={localizeUi("ui.chat.chatsettingsdrawer.imageStyle")}
        value={styleProfileId}
        options={[
          { value: "", label: inheritedLabel ?? emptyOptionLabel ?? localizeUi("ui.chat.imageSources.styleDefault") },
          ...imageStyleProfiles.profiles.map((profile) => ({ value: profile.id, label: profile.name })),
        ]}
        onChange={update}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
      />
      {inherited ? (
        <InheritStatus
          overridden={styleProfileId.length > 0}
          sourceLabel={imageSourceLabel(t, inherited.source)}
          onReset={() => update("")}
        />
      ) : null}
      {description ? (
        <span className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">{description}</span>
      ) : null}
    </div>
  );
}

export function IllustratorImagesPerGeneration({ chat, value }: { chat: Chat; value: number }) {
  const { t: localizeUi } = useUiTranslation();
  const updateMeta = useUpdateChatMetadata();
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.imagesPerGeneration")}
      </span>
      <Select
        label={localizeUi("ui.chat.chatsettingsdrawer.imagesPerGeneration")}
        value={String(value)}
        options={Array.from({ length: MAX_ILLUSTRATOR_IMAGES_PER_GENERATION }, (_, index) => ({
          value: String(index + 1),
          label: String(index + 1),
        }))}
        onChange={(next) =>
          updateMeta.mutate({
            id: chat.id,
            illustratorImagesPerGeneration: normalizeIllustratorImagesPerGeneration(next),
          })
        }
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
      />
      <span className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.generateThisManyVariantsForEachIllustrationOrSelfie")}
      </span>
    </div>
  );
}

/** Image or video Run Interval: how many messages Illustrator waits between runs in this chat. */
export function IllustratorRunIntervalField({
  chat,
  kind,
  value,
  overridden,
}: {
  chat: Chat;
  kind: "image" | "video";
  /** This chat's interval, else the agent's default. */
  value: number;
  /** Whether this chat has its own interval rather than the agent's default. */
  overridden: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const updateMeta = useUpdateChatMetadata();
  const metadataKey = kind === "image" ? "illustratorRunInterval" : "illustratorVideoRunInterval";
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1">
        <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
          {kind === "image"
            ? localizeUi("ui.agents.agenteditor.imageRunInterval")
            : localizeUi("ui.agents.agenteditor.videoRunInterval")}
        </span>
        <span className="flex items-center gap-2">
          <DraftNumberInput
            value={value}
            min={0}
            max={MAX_ILLUSTRATOR_RUN_INTERVAL}
            onCommit={(next) => {
              // Leaving the field unchanged must not turn the agent default into a chat value.
              if (next !== value) updateMeta.mutate({ id: chat.id, [metadataKey]: next });
            }}
            className="w-24 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs tabular-nums text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
          />
          <span className="text-[0.625rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.agents.agenteditor.messages")}
          </span>
        </span>
        <span className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
          {kind === "image"
            ? localizeUi("agents.illustrator.chatRunIntervalHelp")
            : localizeUi("agents.illustrator.chatVideoRunIntervalHelp")}
        </span>
      </label>
      <AgentDefaultStatus
        overridden={overridden}
        onReset={() => updateMeta.mutate({ id: chat.id, [metadataKey]: null })}
      />
    </div>
  );
}
