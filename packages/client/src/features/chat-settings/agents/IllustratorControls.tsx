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

export function IllustratorPromptConnectionSelect({
  chat,
  connectionId,
  includeLocalSidecar,
}: {
  chat: Chat;
  connectionId: string;
  includeLocalSidecar: boolean;
}) {
  const { t } = useTranslation();
  const { t: localizeUi } = useUiTranslation();
  const updateMeta = useUpdateChatMetadata();
  const update = (next: string) => updateMeta.mutate({ id: chat.id, illustratorPromptConnectionId: next || null });
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.promptModel")}
      </span>
      <ConnectionSelect
        job={t("connections.picker.job.illustratorPrompts")}
        value={connectionId || null}
        onChange={(next) => update(next ?? "")}
        includeLocalSidecar={includeLocalSidecar}
        defaultLabel={localizeUi("ui.chat.chatsettingsdrawer.agentDefault")}
        inherits="agents"
      />
      <span className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.choosesTheTextModelThatWritesIllustratorSelfiePrompts")}
      </span>
      <AgentDefaultStatus overridden={connectionId.length > 0} onReset={() => update("")} />
    </div>
  );
}

export function IllustratorImageConnectionSelect({
  chat,
  connectionId,
  agentSettings,
}: {
  chat: Chat;
  connectionId: string;
  /** The Illustrator agent's saved settings, for the model-needed chip when this chat has no connection of its own. */
  agentSettings: unknown;
}) {
  const { t } = useTranslation();
  const { t: localizeUi } = useUiTranslation();
  const updateMeta = useUpdateChatMetadata();
  const update = (next: string) => updateMeta.mutate({ id: chat.id, illustratorImageConnectionId: next || null });
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.imageConnection")}
      </span>
      <ConnectionSelect
        job={t("connections.picker.job.images")}
        value={connectionId || null}
        onChange={(next) => update(next ?? "")}
        kind="image"
        defaultLabel={localizeUi("ui.chat.chatsettingsdrawer.agentDefault")}
        inherits="agents"
      />
      <AgentDefaultStatus overridden={connectionId.length > 0} onReset={() => update("")} />
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
  const { t: localizeUi } = useUiTranslation();
  const updateMeta = useUpdateChatMetadata();
  const imageStyleProfiles = useUIStore((s) => s.imageStyleProfiles);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.imageStyle")}
      </span>
      <Select
        label={localizeUi("ui.chat.chatsettingsdrawer.imageStyle")}
        value={styleProfileId}
        options={[
          { value: "", label: emptyOptionLabel ?? "Use default style from Style Profiles in Advanced settings" },
          ...imageStyleProfiles.profiles.map((profile) => ({ value: profile.id, label: profile.name })),
        ]}
        onChange={(value) => updateMeta.mutate({ id: chat.id, imageStyleProfileId: value || null })}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
      />
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
