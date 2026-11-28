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
import { WEATHER_ART_LABELS, type WeatherArtPart } from "./use-chat-agents";

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

/** The ChatAgents fields the background version controls read. */
type BackgroundVersionState = {
  illustratorAutoBackgroundsEnabled: boolean;
  illustratorWeatherBackgroundsEnabled: boolean;
  illustratorTimeBackgroundsEnabled: boolean;
  hasDecisionModel: boolean;
  illustratorDecisionLocationCheck: boolean;
  illustratorDecisionWeatherCheck: boolean;
  illustratorDecisionTimeCheck: boolean;
  shownWeatherVersion: string;
  shownTimeVersion: string;
  shownVersionLabel: string;
  remakingWeatherArt: WeatherArtPart | null;
  remakeWeatherArt: (part: WeatherArtPart) => void;
};

/**
 * Remake buttons for the weather or time of day version the chat shows now: the picture itself and,
 * for a weather version, its window stencil (or no stencil at all).
 */
export function IllustratorBackgroundVersionRemake({ state }: { state: BackgroundVersionState }) {
  const { t: localizeUi } = useUiTranslation();
  const { shownWeatherVersion, shownTimeVersion, shownVersionLabel, remakingWeatherArt, remakeWeatherArt } = state;
  if (!shownWeatherVersion && !shownTimeVersion) return null;
  const parts = shownWeatherVersion ? (["picture", "stencil", "no-stencil"] as const) : (["picture"] as const);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.weatherArtTitle", { weather: shownVersionLabel })}
      </span>
      {/* Wraps on narrow screens rather than cutting the labels short. */}
      <div className="flex flex-wrap gap-1.5">
        {parts.map((part) => (
          <button
            key={part}
            type="button"
            disabled={remakingWeatherArt !== null}
            onClick={() => remakeWeatherArt(part)}
            className="min-w-0 flex-1 basis-[7.5rem] whitespace-nowrap rounded-md bg-[var(--secondary)] px-2 py-1.5 text-[0.6875rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] disabled:opacity-60"
          >
            {remakingWeatherArt === part
              ? localizeUi("ui.chat.chatsettingsdrawer.weatherArtRemaking")
              : localizeUi(WEATHER_ART_LABELS[part])}
          </button>
        ))}
      </div>
      <span className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
        {localizeUi(
          shownWeatherVersion ? "ui.chat.chatsettingsdrawer.weatherArtHelp" : "ui.chat.chatsettingsdrawer.timeArtHelp",
        )}
      </span>
    </div>
  );
}

const DECISION_CHECK_LABEL_KEYS: Record<string, string> = {
  "location+weather": "both",
  "location+time": "locationTime",
  "weather+time": "weatherTime",
  "location+weather+time": "all",
};

/**
 * Optional Decision model checks: the Decision model reads every reply for a new place, a weather
 * change or a time of day change. Only the checks whose background feature is on are offered.
 */
export function IllustratorDecisionChecksSelect({ chat, state }: { chat: Chat; state: BackgroundVersionState }) {
  const { t: localizeUi } = useUiTranslation();
  // Serialized: two quick picks must not land out of order.
  const updateMeta = useUpdateChatMetadata({ serialize: true });
  const parts = [
    ...(state.illustratorAutoBackgroundsEnabled ? (["location"] as const) : []),
    ...(state.illustratorWeatherBackgroundsEnabled ? (["weather"] as const) : []),
    ...(state.illustratorTimeBackgroundsEnabled ? (["time"] as const) : []),
  ];
  if (parts.length === 0) return null;
  // Each check is one part of the value ("location+time").
  const on = {
    location: state.illustratorDecisionLocationCheck,
    weather: state.illustratorDecisionWeatherCheck,
    time: state.illustratorDecisionTimeCheck,
  };
  const value = (["location", "weather", "time"] as const).filter((part) => on[part]).join("+") || "off";
  // Every mix of the checks that are on: single checks, then pairs, then all of them.
  const subsets: string[] = [];
  for (let mask = 1; mask < 1 << parts.length; mask++) {
    subsets.push(parts.filter((_, index) => mask & (1 << index)).join("+"));
  }
  subsets.sort((a, b) => a.split("+").length - b.split("+").length);
  const options = Array.from(new Set(["off", ...subsets, value]));
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.illustratorDecisionChecks")}
      </span>
      <span className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
        {localizeUi(
          state.hasDecisionModel
            ? "ui.chat.chatsettingsdrawer.illustratorDecisionChecksHelp"
            : "ui.chat.chatsettingsdrawer.illustratorDecisionChecksNoModel",
        )}
      </span>
      <Select
        label={localizeUi("ui.chat.chatsettingsdrawer.illustratorDecisionChecks")}
        value={value}
        disabled={!state.hasDecisionModel && value === "off"}
        options={options.map((option) => ({
          value: option,
          label: localizeUi(
            `ui.chat.chatsettingsdrawer.illustratorDecisionChecks.${DECISION_CHECK_LABEL_KEYS[option] ?? option}`,
          ),
        }))}
        onChange={(next) => {
          const picked = next.split("+");
          updateMeta.mutate({
            id: chat.id,
            illustratorDecisionLocationCheck: picked.includes("location"),
            illustratorDecisionWeatherCheck: picked.includes("weather"),
            illustratorDecisionTimeCheck: picked.includes("time"),
          });
        }}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50 disabled:opacity-60"
      />
    </div>
  );
}
