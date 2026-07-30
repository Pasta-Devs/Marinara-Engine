import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Settings2 } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MAX,
  GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MIN,
  GAME_STORYBOARD_KEYFRAME_COUNT_MAX,
  GAME_STORYBOARD_KEYFRAME_COUNT_MIN,
  STORYBOARD_AGENT_ID,
  type AgentPromptTemplateOption,
  type GameStoryboardViewerDisplayMode,
  type StoryboardAgentSettings,
} from "@marinara-engine/shared";
import { mergeBuiltInAgentSettings, normalizeStoryboardAgentSettings } from "@marinara-engine/shared";
import { useAgentConfigs, type AgentConfigRow } from "../../hooks/use-agents";
import { useCapabilityAgentRegistry } from "../../hooks/use-capability-packages";
import { useUpdateChatMetadata } from "../../hooks/use-chats";
import { useUIStore } from "../../stores/ui.store";
import {
  AgentDefaultStatus,
  AgentSettingsSegmentedControl,
  AgentSettingsSubsection,
  AgentSettingsToggle,
  GamePromptTemplateSelect,
} from "./AgentSettingsControls";

type StoryboardChatSettingsPanelProps = {
  active: boolean;
  settings: StoryboardAgentSettings;
  metadata: Record<string, unknown>;
  onActiveChange: (active: boolean) => void;
  onUpdate: (patch: Record<string, unknown>) => void;
  onOpenAgentSettings: () => void;
  ownerMode?: "game" | "roleplay";
};

type StoryboardChatSettingsBridgeProps = {
  chatId: string;
  metadata: Record<string, unknown>;
  onClose: () => void;
  ownerMode?: "game" | "roleplay";
};

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readBoundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function resolveSelectedId(
  value: unknown,
  fallback: string | null,
  options: readonly AgentPromptTemplateOption[],
): string {
  const selected = readString(value);
  if (selected && options.some((option) => option.id === selected)) return selected;
  if (fallback && options.some((option) => option.id === fallback)) return fallback;
  return options[0]?.id ?? "";
}

function StoryboardSlider({
  label,
  description,
  value,
  min,
  max,
  overridden,
  onChange,
  onReset,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  overridden: boolean;
  onChange: (value: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-1">
      <label className="block space-y-2 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
        <span className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[0.625rem] font-medium text-[var(--foreground)]">{label}</span>
            <span className="mt-0.5 block text-[0.5625rem] leading-snug text-[var(--muted-foreground)]">
              {description}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[0.625rem] tabular-nums text-[var(--foreground)] ring-1 ring-[var(--border)]">
            {value}
          </span>
        </span>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-7 w-full cursor-pointer accent-[var(--primary)]"
          aria-label={label}
        />
      </label>
      <AgentDefaultStatus overridden={overridden} onReset={onReset} />
    </div>
  );
}

function StoryboardNumberInput({
  label,
  description,
  value,
  min,
  max,
  disabled,
  overridden,
  onChange,
  onReset,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  overridden: boolean;
  onChange: (value: number) => void;
  onReset: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const numeric = Number(draft);
    if (!Number.isFinite(numeric)) {
      setDraft(String(value));
      return;
    }
    const normalized = Math.max(min, Math.min(max, Math.trunc(numeric)));
    setDraft(String(normalized));
    if (normalized !== value || !overridden) onChange(normalized);
  };

  return (
    <div className="space-y-1">
      <label className="grid gap-2 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <span className="min-w-0">
          <span className="block text-[0.625rem] font-medium text-[var(--foreground)]">{label}</span>
          <span className="mt-0.5 block text-[0.5625rem] leading-snug text-[var(--muted-foreground)]">
            {description}
          </span>
        </span>
        <span className="grid grid-cols-[minmax(0,4rem)_auto] items-center gap-1.5">
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={1}
            value={draft}
            disabled={disabled}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                setDraft(String(value));
                event.currentTarget.blur();
              }
            }}
            aria-label={label}
            className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50 disabled:cursor-not-allowed disabled:opacity-70"
          />
          <span className="text-[0.625rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.noodle.stageprofileview.s")}
          </span>
        </span>
      </label>
      <AgentDefaultStatus overridden={overridden} onReset={onReset} />
    </div>
  );
}

export function StoryboardChatSettingsPanel({
  active,
  settings,
  metadata,
  onActiveChange,
  onUpdate,
  onOpenAgentSettings,
  ownerMode = "game",
}: StoryboardChatSettingsPanelProps) {
  const { t: localizeUi } = useUiTranslation();
  const autoIllustrationsOverridden = typeof metadata.gameStoryboardAutoIllustrationsEnabled === "boolean";
  const autoAnimationsOverridden = typeof metadata.gameStoryboardAutoGenerationEnabled === "boolean";
  const autoAnimationsEnabled = autoAnimationsOverridden
    ? metadata.gameStoryboardAutoGenerationEnabled === true
    : settings.autoGenerateMode === "animation";
  const autoIllustrationsEnabled =
    autoAnimationsEnabled ||
    (autoIllustrationsOverridden
      ? metadata.gameStoryboardAutoIllustrationsEnabled === true
      : settings.autoGenerateMode !== "manual");
  const keyframeCountOverridden = typeof metadata.gameStoryboardKeyframeCount === "number";
  const keyframeCount = readBoundedInteger(
    metadata.gameStoryboardKeyframeCount,
    ownerMode === "roleplay" ? 1 : settings.keyframeCount,
    GAME_STORYBOARD_KEYFRAME_COUNT_MIN,
    GAME_STORYBOARD_KEYFRAME_COUNT_MAX,
  );
  const durationOverridden = typeof metadata.gameStoryboardAnimationDurationSeconds === "number";
  const animationDurationSeconds = readBoundedInteger(
    metadata.gameStoryboardAnimationDurationSeconds,
    settings.animationDurationSeconds,
    GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MIN,
    GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MAX,
  );
  const viewerOverridden =
    metadata.gameStoryboardViewerDisplayMode === "inline" ||
    metadata.gameStoryboardViewerDisplayMode === "floating" ||
    metadata.gameStoryboardViewerDisplayMode === "background";
  const viewerDisplayMode: GameStoryboardViewerDisplayMode =
    metadata.gameStoryboardViewerDisplayMode === "inline" ||
    metadata.gameStoryboardViewerDisplayMode === "floating" ||
    metadata.gameStoryboardViewerDisplayMode === "background"
      ? metadata.gameStoryboardViewerDisplayMode
      : ownerMode === "roleplay"
        ? "inline"
        : settings.viewerDisplayMode;
  const novelAiOverridden = typeof metadata.gameStoryboardUseNovelAiCharacterPrompts === "boolean";
  const useNovelAiCharacterPrompts = novelAiOverridden
    ? metadata.gameStoryboardUseNovelAiCharacterPrompts === true
    : settings.useNovelAiCharacterPrompts;
  const useTemplateOverridden = typeof metadata.gameStoryboardUsePromptTemplate === "boolean";
  const usePromptTemplate = useTemplateOverridden
    ? metadata.gameStoryboardUsePromptTemplate === true
    : settings.usePromptTemplate;
  const stillPlannerOptions = settings.plannerTemplates.filter((template) =>
    settings.illustrationPlannerTemplateIds.includes(template.id),
  );
  const animationPlannerOptions = settings.plannerTemplates.filter((template) =>
    settings.animationPlannerTemplateIds.includes(template.id),
  );
  const stillPlannerId = resolveSelectedId(
    metadata.gameStoryboardIllustrationPromptTemplateId,
    settings.illustrationPlannerTemplateId,
    stillPlannerOptions,
  );
  const animationPlannerId = resolveSelectedId(
    metadata.gameStoryboardAnimationPromptTemplateId,
    settings.animationPlannerTemplateId,
    animationPlannerOptions,
  );
  const illustrationTemplateId = resolveSelectedId(
    metadata.gameStoryboardImagePromptTemplateId,
    settings.illustrationTemplateId,
    settings.illustrationTemplates,
  );
  const videoTemplateId = resolveSelectedId(
    metadata.gameStoryboardVideoPromptTemplateId,
    settings.videoTemplateId,
    settings.videoTemplates,
  );
  const roleplayImageConnectionMissing = ownerMode === "roleplay" && !readString(settings.imageConnectionId);
  const roleplayVideoConnectionMissing =
    ownerMode === "roleplay" && autoAnimationsEnabled && !readString(settings.videoConnectionId);

  return (
    <>
      <div data-agent-settings-feature-toggles="storyboard" className="border-t border-[var(--border)] pt-3">
        <AgentSettingsToggle
          label={localizeUi("ui.chat.chatsettingsdrawer.enableStoryboards")}
          description={localizeUi("ui.chat.chatsettingsdrawer.showStoryboardControlsAndAllowAutomaticKeyframeMedia")}
          enabled={active}
          onToggle={() => onActiveChange(!active)}
        />
      </div>

      {active ? (
        <AgentSettingsSubsection
          id="storyboards"
          title={localizeUi("ui.chat.chatsettingsdrawer.storyboards")}
          description={localizeUi("ui.chat.chatsettingsdrawer.createKeyframeMediaForCompletedGmTurnsAndFollow")}
        >
          {roleplayImageConnectionMissing || roleplayVideoConnectionMissing ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-amber-400/10 px-3 py-2.5 ring-1 ring-amber-400/25"
            >
              <AlertTriangle size="0.875rem" className="mt-0.5 shrink-0 text-amber-300" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="space-y-0.5 text-[0.625rem] leading-snug text-[var(--foreground)]">
                  {roleplayImageConnectionMissing ? (
                    <p>{localizeUi("ui.agents.storyboard.roleplayImageConnectionRequired")}</p>
                  ) : null}
                  {roleplayVideoConnectionMissing ? (
                    <p>{localizeUi("ui.agents.storyboard.roleplayVideoConnectionRequired")}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onOpenAgentSettings}
                  className="inline-flex items-center gap-1.5 rounded-md bg-amber-300/15 px-2 py-1 text-[0.625rem] font-medium text-[var(--foreground)] ring-1 ring-amber-300/25 transition-colors hover:bg-amber-300/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
                >
                  <Settings2 size="0.6875rem" />
                  {localizeUi("ui.chat.chatsettingsdrawer.openSetup")}
                </button>
              </div>
            </div>
          ) : null}
          <AgentSettingsToggle
            label={localizeUi("ui.chat.chatsettingsdrawer.automaticStoryboardIllustrations")}
            description={localizeUi(
              "ui.chat.chatsettingsdrawer.automaticallyCreateStillKeyframeIllustrationsAfterCompletedGmTurns",
            )}
            enabled={autoIllustrationsEnabled}
            onToggle={() =>
              onUpdate({
                gameStoryboardAutoIllustrationsEnabled: !autoIllustrationsEnabled,
                ...(!autoIllustrationsEnabled ? {} : { gameStoryboardAutoGenerationEnabled: false }),
              })
            }
            overridden={autoIllustrationsOverridden}
            onReset={() => onUpdate({ gameStoryboardAutoIllustrationsEnabled: null })}
          />
          <AgentSettingsToggle
            label={localizeUi("ui.chat.chatsettingsdrawer.automaticStoryboardAnimations")}
            description={localizeUi("ui.chat.chatsettingsdrawer.alsoGenerateMp4ClipsForEachStoryboardKeyframeRequires")}
            enabled={autoAnimationsEnabled}
            onToggle={() =>
              onUpdate({
                gameStoryboardAutoGenerationEnabled: !autoAnimationsEnabled,
                ...(!autoAnimationsEnabled ? { gameStoryboardAutoIllustrationsEnabled: true } : {}),
              })
            }
            overridden={autoAnimationsOverridden}
            onReset={() => onUpdate({ gameStoryboardAutoGenerationEnabled: null })}
          />
          <AgentSettingsToggle
            label={localizeUi("ui.agents.storyboard.useNovelAiCharacters")}
            description={localizeUi("ui.agents.storyboard.useNovelAiCharactersDescription")}
            enabled={useNovelAiCharacterPrompts}
            onToggle={() => onUpdate({ gameStoryboardUseNovelAiCharacterPrompts: !useNovelAiCharacterPrompts })}
            overridden={novelAiOverridden}
            onReset={() => onUpdate({ gameStoryboardUseNovelAiCharacterPrompts: null })}
          />

          <div className="grid gap-2 md:grid-cols-2">
            <StoryboardSlider
              label={localizeUi("ui.chat.chatsettingsdrawer.keyframesPerTurn")}
              description={localizeUi(
                "ui.chat.chatsettingsdrawer.controlsHowManyStoryboardIllustrationsArePlannedForEach",
              )}
              value={keyframeCount}
              min={GAME_STORYBOARD_KEYFRAME_COUNT_MIN}
              max={GAME_STORYBOARD_KEYFRAME_COUNT_MAX}
              overridden={keyframeCountOverridden}
              onChange={(value) => onUpdate({ gameStoryboardKeyframeCount: value })}
              onReset={() => onUpdate({ gameStoryboardKeyframeCount: null })}
            />
            <StoryboardNumberInput
              label={localizeUi("ui.chat.chatsettingsdrawer.animationClipDuration")}
              description={localizeUi("ui.chat.chatsettingsdrawer.controlsTheDurationOfEachStoryboardMp4ClipIn")}
              value={animationDurationSeconds}
              min={GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MIN}
              max={GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MAX}
              disabled={!autoAnimationsEnabled}
              overridden={durationOverridden}
              onChange={(value) => onUpdate({ gameStoryboardAnimationDurationSeconds: value })}
              onReset={() => onUpdate({ gameStoryboardAnimationDurationSeconds: null })}
            />
          </div>

          <div className="space-y-1">
            <p className="text-[0.625rem] font-medium text-[var(--foreground)]">
              {localizeUi("ui.chat.chatsettingsdrawer.viewerDisplay")}
            </p>
            <AgentSettingsSegmentedControl<GameStoryboardViewerDisplayMode>
              value={viewerDisplayMode}
              options={[
                ...(ownerMode === "roleplay"
                  ? [
                      {
                        id: "inline" as const,
                        label: localizeUi("ui.agents.storyboard.inline"),
                        description: localizeUi("ui.agents.storyboard.inlineDescription"),
                      },
                    ]
                  : []),
                {
                  id: "floating",
                  label: localizeUi("ui.agents.storyboard.floating"),
                  description: localizeUi("ui.agents.storyboard.floatingDescription"),
                },
                {
                  id: "background",
                  label: localizeUi("ui.agents.storyboard.background"),
                  description: localizeUi("ui.agents.storyboard.backgroundDescription"),
                },
              ]}
              onChange={(mode) => onUpdate({ gameStoryboardViewerDisplayMode: mode })}
            />
            <AgentDefaultStatus
              overridden={viewerOverridden}
              onReset={() => onUpdate({ gameStoryboardViewerDisplayMode: null })}
            />
          </div>

          <div className="space-y-2">
            <div className="space-y-0.5 px-0.5">
              <h5 className="text-[0.6875rem] font-semibold text-[var(--foreground)]">
                {localizeUi("ui.chat.chatsettingsdrawer.storyboardPlanners")}
              </h5>
              <p className="text-[0.59375rem] leading-snug text-[var(--muted-foreground)]">
                {localizeUi("ui.chat.chatsettingsdrawer.plannersSplitACompletedGmTurnIntoOrderedKeyframes")}
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <GamePromptTemplateSelect
                label={localizeUi("ui.agents.storyboard.stillPlanner")}
                description={localizeUi(
                  "ui.chat.chatsettingsdrawer.plansFinishedStillKeyframesAndWritesTheirImageDescriptions",
                )}
                options={stillPlannerOptions}
                selectedId={stillPlannerId}
                fallbackId={settings.illustrationPlannerTemplateId ?? ""}
                onChange={(id) =>
                  onUpdate({
                    gameStoryboardIllustrationPromptTemplateId:
                      id === settings.illustrationPlannerTemplateId ? null : id,
                  })
                }
              />
              <GamePromptTemplateSelect
                label={localizeUi("ui.agents.storyboard.animationPlanner")}
                description={localizeUi(
                  "ui.chat.chatsettingsdrawer.plansAnimationReadySourceImagesAndAMotionDirection",
                )}
                options={animationPlannerOptions}
                selectedId={animationPlannerId}
                fallbackId={settings.animationPlannerTemplateId ?? ""}
                onChange={(id) =>
                  onUpdate({
                    gameStoryboardAnimationPromptTemplateId: id === settings.animationPlannerTemplateId ? null : id,
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="space-y-0.5 px-0.5">
              <h5 className="text-[0.6875rem] font-semibold text-[var(--foreground)]">
                {localizeUi("ui.chat.chatsettingsdrawer.finalGenerationPrompts")}
              </h5>
              <p className="text-[0.59375rem] leading-snug text-[var(--muted-foreground)]">
                {localizeUi("ui.chat.chatsettingsdrawer.theseFormatEachPlannerResultIntoTheFinalRequest")}
              </p>
            </div>
            <AgentSettingsToggle
              label={localizeUi("ui.chat.chatsettingsdrawer.useStoryboardTemplate")}
              description={localizeUi("ui.agents.storyboard.useTemplateDescription")}
              enabled={usePromptTemplate}
              onToggle={() => onUpdate({ gameStoryboardUsePromptTemplate: !usePromptTemplate })}
              overridden={useTemplateOverridden}
              onReset={() => onUpdate({ gameStoryboardUsePromptTemplate: null })}
            />
            <div className="grid gap-2 md:grid-cols-2">
              <GamePromptTemplateSelect
                label={localizeUi("ui.chat.chatsettingsdrawer.storyboardIllustrationPrompt")}
                description={localizeUi("ui.chat.chatsettingsdrawer.formatsEachPlannedKeyframeIntoTheFinalPromptSent")}
                options={settings.illustrationTemplates}
                selectedId={illustrationTemplateId}
                fallbackId={settings.illustrationTemplateId ?? ""}
                onChange={(id) =>
                  onUpdate({
                    gameStoryboardImagePromptTemplateId: id === settings.illustrationTemplateId ? null : id,
                  })
                }
              />
              <GamePromptTemplateSelect
                label={localizeUi("ui.chat.chatsettingsdrawer.storyboardVideoPrompt")}
                description={localizeUi("ui.chat.chatsettingsdrawer.combinesTheGeneratedKeyframeAndMotionPlanIntoThe")}
                options={settings.videoTemplates}
                selectedId={videoTemplateId}
                fallbackId={settings.videoTemplateId ?? ""}
                onChange={(id) =>
                  onUpdate({ gameStoryboardVideoPromptTemplateId: id === settings.videoTemplateId ? null : id })
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
            <p className="min-w-0 flex-1 text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
              {localizeUi("ui.agents.storyboard.promptChainDescription")}
            </p>
            <button
              type="button"
              onClick={onOpenAgentSettings}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--background)]/80 px-3 py-1.5 text-[0.6875rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            >
              <Settings2 size="0.75rem" />
              <span>{localizeUi("ui.chat.chatsettingsdrawer.openSetup")}</span>
            </button>
          </div>
        </AgentSettingsSubsection>
      ) : null}
    </>
  );
}

export default function StoryboardChatSettingsBridge({
  chatId,
  metadata,
  onClose,
  ownerMode = "game",
}: StoryboardChatSettingsBridgeProps) {
  const { data: installedAgentManifests = [] } = useCapabilityAgentRegistry();
  const { data: agentConfigs } = useAgentConfigs();
  const updateMetadata = useUpdateChatMetadata();
  const installed = installedAgentManifests.some((agent) => agent.id === STORYBOARD_AGENT_ID);
  const storyboardConfig = (agentConfigs as AgentConfigRow[] | undefined)?.find(
    (config) => config.type === STORYBOARD_AGENT_ID,
  );
  const settings = useMemo(
    () => normalizeStoryboardAgentSettings(mergeBuiltInAgentSettings(STORYBOARD_AGENT_ID, storyboardConfig?.settings)),
    [storyboardConfig?.settings],
  );
  const activeAgentIds = Array.isArray(metadata.activeAgentIds)
    ? metadata.activeAgentIds.filter((id): id is string => typeof id === "string")
    : [];
  const active = activeAgentIds.includes(STORYBOARD_AGENT_ID);

  if (!installed) return null;

  return (
    <StoryboardChatSettingsPanel
      active={active}
      settings={settings}
      metadata={metadata}
      onActiveChange={(enabled) =>
        updateMetadata.mutate({
          id: chatId,
          ...(enabled ? { enableAgents: true } : {}),
          activeAgentIds: enabled
            ? Array.from(new Set([...activeAgentIds, STORYBOARD_AGENT_ID]))
            : activeAgentIds.filter((id) => id !== STORYBOARD_AGENT_ID),
        })
      }
      onUpdate={(patch) => updateMetadata.mutate({ id: chatId, ...patch })}
      onOpenAgentSettings={() => {
        onClose();
        useUIStore.getState().openAgentDetail(STORYBOARD_AGENT_ID);
      }}
      ownerMode={ownerMode}
    />
  );
}
