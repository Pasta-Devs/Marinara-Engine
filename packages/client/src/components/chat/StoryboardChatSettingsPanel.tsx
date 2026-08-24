import { useEffect, useMemo, useState } from "react";
import { Settings2 } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MAX,
  GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MIN,
  GAME_STORYBOARD_KEYFRAME_COUNT_MAX,
  GAME_STORYBOARD_KEYFRAME_COUNT_MIN,
  STORYBOARD_AGENT_ID,
  type AgentPromptTemplateOption,
  type StoryboardAgentSettings,
  type StoryboardAutoGenerateMode,
  type StoryboardViewerMode,
} from "@marinara-engine/shared";
import { mergeBuiltInAgentSettings, normalizeStoryboardAgentSettings } from "@marinara-engine/shared";
import { useAgentConfigs, type AgentConfigRow } from "../../hooks/use-agents";
import { useCapabilityAgentRegistry } from "../../hooks/use-capability-packages";
import { useUpdateChatMetadata } from "../../hooks/use-chats";
import { useConnections } from "../../hooks/use-connections";
import { useUIStore } from "../../stores/ui.store";
import {
  AgentSettingsActionButton,
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
    <div className="flex h-full flex-col gap-1">
      <label className="flex flex-1 flex-col justify-between gap-2 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
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
    <div className="flex h-full flex-col gap-1">
      <label className="grid flex-1 gap-2 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
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

function StoryboardChatWorkflowStage({
  number,
  title,
  description,
  children,
}: {
  number: 2 | 3 | 4;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-storyboard-chat-workflow-stage={number}
      className="space-y-2 rounded-lg bg-[var(--secondary)]/45 p-2.5 ring-1 ring-[var(--border)]"
    >
      <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)]/12 text-[0.6875rem] font-semibold text-[var(--primary)] ring-1 ring-[var(--primary)]/25">
          {number}
        </span>
        <span className="min-w-0">
          <span className="block text-[0.6875rem] font-semibold text-[var(--foreground)]">{title}</span>
          <span className="mt-0.5 block text-[0.59375rem] leading-snug text-[var(--muted-foreground)]">
            {description}
          </span>
        </span>
      </div>
      {children}
    </div>
  );
}

function StoryboardImageAwarePlannerOverride({
  settings,
  metadata,
  onUpdate,
}: {
  settings: StoryboardAgentSettings;
  metadata: Record<string, unknown>;
  onUpdate: (patch: Record<string, unknown>) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const enabledOverridden = typeof metadata.storyboardAgentImageAwareShotPlanningEnabled === "boolean";
  const enabled = enabledOverridden
    ? metadata.storyboardAgentImageAwareShotPlanningEnabled === true
    : settings.imageAwareShotPlanningEnabled;
  const templateOverridden = readString(metadata.storyboardAgentAnimationRefinementTemplateId) !== "";
  const selectedTemplateId = resolveSelectedId(
    metadata.storyboardAgentAnimationRefinementTemplateId,
    settings.animationRefinementTemplateId,
    settings.animationRefinementTemplates,
  );

  return (
    <StoryboardChatWorkflowStage
      number={3}
      title={localizeUi("ui.agents.storyboard.promptStage3Title")}
      description={localizeUi("ui.agents.storyboard.promptStage3Description")}
    >
      <AgentSettingsToggle
        label={localizeUi("ui.agents.storyboard.enableImageAwareShotPlanning")}
        description={localizeUi("ui.agents.storyboard.enableImageAwareShotPlanningDescription")}
        enabled={enabled}
        onToggle={() => onUpdate({ storyboardAgentImageAwareShotPlanningEnabled: !enabled })}
        overridden={enabledOverridden}
        onReset={() => onUpdate({ storyboardAgentImageAwareShotPlanningEnabled: null })}
      />
      {enabled ? (
        <div className="space-y-1">
          <GamePromptTemplateSelect
            label={localizeUi("ui.agents.storyboard.defaultShotPlannerPrompt")}
            description={localizeUi("ui.agents.storyboard.imageAwareShotPlannerDescription")}
            options={settings.animationRefinementTemplates}
            selectedId={selectedTemplateId}
            fallbackId={settings.animationRefinementTemplateId ?? ""}
            onChange={(id) =>
              onUpdate({
                storyboardAgentAnimationRefinementTemplateId: id === settings.animationRefinementTemplateId ? null : id,
              })
            }
          />
          <AgentDefaultStatus
            overridden={templateOverridden}
            onReset={() => onUpdate({ storyboardAgentAnimationRefinementTemplateId: null })}
          />
        </div>
      ) : (
        <p className="px-1 text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
          {localizeUi("ui.agents.storyboard.imageAwarePlannerDisabled")}
        </p>
      )}
    </StoryboardChatWorkflowStage>
  );
}

export function StoryboardChatSettingsPanel({
  active,
  settings,
  metadata,
  onActiveChange,
  onUpdate,
  onOpenAgentSettings,
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
    settings.keyframeCount,
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
    metadata.gameStoryboardViewerDisplayMode === "floating" ||
    metadata.gameStoryboardViewerDisplayMode === "background";
  const viewerDisplayMode: StoryboardViewerMode =
    metadata.gameStoryboardViewerDisplayMode === "background"
      ? "background"
      : metadata.gameStoryboardViewerDisplayMode === "floating"
        ? "floating"
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
            <AgentSettingsSegmentedControl<StoryboardViewerMode>
              value={viewerDisplayMode}
              options={[
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
            <div className="space-y-2">
              <StoryboardChatWorkflowStage
                number={2}
                title={localizeUi("ui.agents.storyboard.promptStage2Title")}
                description={localizeUi("ui.agents.storyboard.promptStage2Description")}
              >
                <GamePromptTemplateSelect
                  label={localizeUi("ui.chat.chatsettingsdrawer.storyboardIllustrationPrompt")}
                  description={localizeUi(
                    "ui.chat.chatsettingsdrawer.formatsEachPlannedKeyframeIntoTheFinalPromptSent",
                  )}
                  options={settings.illustrationTemplates}
                  selectedId={illustrationTemplateId}
                  fallbackId={settings.illustrationTemplateId ?? ""}
                  onChange={(id) =>
                    onUpdate({
                      gameStoryboardImagePromptTemplateId: id === settings.illustrationTemplateId ? null : id,
                    })
                  }
                />
              </StoryboardChatWorkflowStage>
              {autoAnimationsEnabled ? (
                <>
                  <StoryboardImageAwarePlannerOverride settings={settings} metadata={metadata} onUpdate={onUpdate} />
                  <StoryboardChatWorkflowStage
                    number={4}
                    title={localizeUi("ui.agents.storyboard.promptStage4Title")}
                    description={localizeUi("ui.agents.storyboard.promptStage4Description")}
                  >
                    <GamePromptTemplateSelect
                      label={localizeUi("ui.chat.chatsettingsdrawer.storyboardVideoPrompt")}
                      description={localizeUi(
                        "ui.chat.chatsettingsdrawer.combinesTheGeneratedKeyframeAndMotionPlanIntoThe",
                      )}
                      options={settings.videoTemplates}
                      selectedId={videoTemplateId}
                      fallbackId={settings.videoTemplateId ?? ""}
                      onChange={(id) =>
                        onUpdate({ gameStoryboardVideoPromptTemplateId: id === settings.videoTemplateId ? null : id })
                      }
                    />
                  </StoryboardChatWorkflowStage>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
            <p className="min-w-0 flex-1 text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
              {localizeUi("ui.agents.storyboard.promptChainDescription")}
            </p>
            <AgentSettingsActionButton onClick={onOpenAgentSettings} className="shrink-0">
              <Settings2 size="0.75rem" />
              <span>{localizeUi("ui.chat.chatsettingsdrawer.openSetup")}</span>
            </AgentSettingsActionButton>
          </div>
        </AgentSettingsSubsection>
      ) : null}
    </>
  );
}

function RoleplayStoryboardChatSettingsPanel({
  active,
  settings,
  metadata,
  onActiveChange,
  onUpdate,
  onOpenAgentSettings,
}: StoryboardChatSettingsPanelProps) {
  const { t: localizeUi } = useUiTranslation();
  const { data: connectionRows = [] } = useConnections();
  const connections = connectionRows.filter(
    (connection): connection is Record<string, unknown> =>
      typeof connection === "object" && connection !== null && !Array.isArray(connection),
  );
  const imageConnections = connections.filter((connection) => connection.provider === "image_generation");
  const videoConnections = connections.filter((connection) => connection.provider === "video_generation");
  const promptConnections = connections.filter(
    (connection) =>
      connection.provider !== "image_generation" &&
      connection.provider !== "video_generation" &&
      connection.provider !== "audio",
  );
  const autoModeOverridden =
    metadata.roleplayStoryboardAutoGenerateMode === "manual" ||
    metadata.roleplayStoryboardAutoGenerateMode === "illustration" ||
    metadata.roleplayStoryboardAutoGenerateMode === "animation";
  const autoGenerateMode: StoryboardAutoGenerateMode = autoModeOverridden
    ? (metadata.roleplayStoryboardAutoGenerateMode as StoryboardAutoGenerateMode)
    : settings.autoGenerateMode;
  const runIntervalOverridden = typeof metadata.roleplayStoryboardRunInterval === "number";
  const runInterval = readBoundedInteger(metadata.roleplayStoryboardRunInterval, settings.runInterval, 1, 100);
  const keyframeCountOverridden = typeof metadata.roleplayStoryboardKeyframeCount === "number";
  const keyframeCount = readBoundedInteger(
    metadata.roleplayStoryboardKeyframeCount,
    settings.keyframeCount,
    GAME_STORYBOARD_KEYFRAME_COUNT_MIN,
    GAME_STORYBOARD_KEYFRAME_COUNT_MAX,
  );
  const durationOverridden = typeof metadata.roleplayStoryboardAnimationDurationSeconds === "number";
  const animationDurationSeconds = readBoundedInteger(
    metadata.roleplayStoryboardAnimationDurationSeconds,
    settings.animationDurationSeconds,
    GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MIN,
    GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MAX,
  );
  const appearanceOverridden = typeof metadata.roleplayStoryboardIncludeCharacterAppearance === "boolean";
  const includeCharacterAppearance = appearanceOverridden
    ? metadata.roleplayStoryboardIncludeCharacterAppearance === true
    : settings.includeCharacterAppearance;
  const avatarsOverridden = typeof metadata.roleplayStoryboardUseAvatarReferences === "boolean";
  const useAvatarReferences = avatarsOverridden
    ? metadata.roleplayStoryboardUseAvatarReferences === true
    : settings.useAvatarReferences;
  const novelAiOverridden = typeof metadata.roleplayStoryboardUseNovelAiCharacterPrompts === "boolean";
  const useNovelAiCharacterPrompts = novelAiOverridden
    ? metadata.roleplayStoryboardUseNovelAiCharacterPrompts === true
    : settings.useNovelAiCharacterPrompts;
  const templateOverridden = typeof metadata.roleplayStoryboardUsePromptTemplate === "boolean";
  const usePromptTemplate = templateOverridden
    ? metadata.roleplayStoryboardUsePromptTemplate === true
    : settings.usePromptTemplate;
  const episodeTemplateId = resolveSelectedId(
    metadata.roleplayStoryboardEpisodeTemplateId,
    settings.roleplayEpisodeTemplateId,
    settings.roleplayEpisodeTemplates,
  );
  const styleTemplateId = resolveSelectedId(
    metadata.roleplayStoryboardStyleTemplateId,
    settings.roleplayStyleTemplateId,
    settings.roleplayStyleTemplates,
  );
  const animationTemplateId = resolveSelectedId(
    metadata.roleplayStoryboardAnimationTemplateId,
    settings.roleplayAnimationTemplateId,
    settings.roleplayAnimationTemplates,
  );
  const outputTemplateId = resolveSelectedId(
    metadata.roleplayStoryboardOutputTemplateId,
    settings.roleplayOutputTemplateId,
    settings.roleplayOutputTemplates,
  );
  const illustrationTemplateId = resolveSelectedId(
    metadata.roleplayStoryboardImagePromptTemplateId,
    settings.illustrationTemplateId,
    settings.illustrationTemplates,
  );
  const videoTemplateId = resolveSelectedId(
    metadata.roleplayStoryboardVideoPromptTemplateId,
    settings.videoTemplateId,
    settings.videoTemplates,
  );

  const renderConnectionSelect = (
    label: string,
    value: unknown,
    options: Record<string, unknown>[],
    metadataKey: string,
  ) => {
    const selectedId = readString(value);
    const selectedConnectionMissing =
      !!selectedId && !options.some((connection) => readString(connection.id) === selectedId);
    return (
      <label className="flex flex-col gap-1">
        <span className="text-[0.625rem] font-medium text-[var(--foreground)]">{label}</span>
        <select
          value={selectedId}
          onChange={(event) => onUpdate({ [metadataKey]: event.target.value || null })}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50"
        >
          <option value="">{localizeUi("ui.agents.storyboard.useGlobalConnection")}</option>
          {selectedConnectionMissing ? (
            <option value={selectedId}>{localizeUi("ui.chat.chatsettingsdrawer.missingConnection")}</option>
          ) : null}
          {options.map((connection) => {
            const id = readString(connection.id);
            if (!id) return null;
            const name = readString(connection.name) || id;
            const model = readString(connection.model);
            return (
              <option key={id} value={id}>
                {name}
                {model ? localizeUi("ui.connections.connectioneditor.value1", { value1: model }) : ""}
              </option>
            );
          })}
        </select>
      </label>
    );
  };

  return (
    <>
      <div data-agent-settings-feature-toggles="storyboard" className="border-t border-[var(--border)] pt-3">
        <AgentSettingsToggle
          label={localizeUi("ui.chat.chatsettingsdrawer.enableStoryboards")}
          description={localizeUi("ui.agents.storyboard.roleplayEnableDescription")}
          enabled={active}
          onToggle={() => onActiveChange(!active)}
        />
      </div>

      {active ? (
        <AgentSettingsSubsection
          id="roleplay-storyboards"
          title={localizeUi("ui.chat.chatsettingsdrawer.storyboards")}
          description={localizeUi("ui.agents.storyboard.roleplayChatDescription")}
        >
          <div className="space-y-1">
            <p className="text-[0.625rem] font-medium text-[var(--foreground)]">
              {localizeUi("ui.agents.storyboard.automaticMode")}
            </p>
            <AgentSettingsSegmentedControl<StoryboardAutoGenerateMode>
              value={autoGenerateMode}
              columns={3}
              options={[
                { id: "manual", label: localizeUi("ui.agents.storyboard.manual") },
                { id: "illustration", label: localizeUi("ui.agents.storyboard.stillImages") },
                { id: "animation", label: localizeUi("ui.agents.storyboard.animations") },
              ]}
              onChange={(mode) => onUpdate({ roleplayStoryboardAutoGenerateMode: mode })}
            />
            <AgentDefaultStatus
              overridden={autoModeOverridden}
              onReset={() => onUpdate({ roleplayStoryboardAutoGenerateMode: null })}
            />
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <StoryboardSlider
              label={localizeUi("ui.agents.storyboard.assistantMessagesPerEpisode")}
              description={localizeUi("ui.agents.storyboard.assistantMessagesPerEpisodeDescription")}
              value={runInterval}
              min={1}
              max={100}
              overridden={runIntervalOverridden}
              onChange={(value) => onUpdate({ roleplayStoryboardRunInterval: value })}
              onReset={() => onUpdate({ roleplayStoryboardRunInterval: null })}
            />
            <StoryboardSlider
              label={localizeUi("ui.agents.storyboard.keyframesPerEpisode")}
              description={localizeUi("ui.agents.storyboard.keyframesPerEpisodeDescription")}
              value={keyframeCount}
              min={GAME_STORYBOARD_KEYFRAME_COUNT_MIN}
              max={GAME_STORYBOARD_KEYFRAME_COUNT_MAX}
              overridden={keyframeCountOverridden}
              onChange={(value) => onUpdate({ roleplayStoryboardKeyframeCount: value })}
              onReset={() => onUpdate({ roleplayStoryboardKeyframeCount: null })}
            />
            <StoryboardNumberInput
              label={localizeUi("ui.chat.chatsettingsdrawer.animationClipDuration")}
              description={localizeUi("ui.chat.chatsettingsdrawer.controlsTheDurationOfEachStoryboardMp4ClipIn")}
              value={animationDurationSeconds}
              min={GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MIN}
              max={GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MAX}
              disabled={autoGenerateMode !== "animation"}
              overridden={durationOverridden}
              onChange={(value) => onUpdate({ roleplayStoryboardAnimationDurationSeconds: value })}
              onReset={() => onUpdate({ roleplayStoryboardAnimationDurationSeconds: null })}
            />
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {renderConnectionSelect(
              localizeUi("ui.agents.storyboard.promptConnection"),
              metadata.roleplayStoryboardPromptConnectionId,
              promptConnections,
              "roleplayStoryboardPromptConnectionId",
            )}
            {renderConnectionSelect(
              localizeUi("ui.agents.storyboard.imageConnection"),
              metadata.roleplayStoryboardImageConnectionId,
              imageConnections,
              "roleplayStoryboardImageConnectionId",
            )}
            {renderConnectionSelect(
              localizeUi("ui.agents.storyboard.videoConnection"),
              metadata.roleplayStoryboardVideoConnectionId,
              videoConnections,
              "roleplayStoryboardVideoConnectionId",
            )}
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <GamePromptTemplateSelect
              label={localizeUi("ui.agents.storyboard.roleplayEpisodeContract")}
              description={localizeUi("ui.agents.storyboard.roleplayEpisodeContractDescription")}
              options={settings.roleplayEpisodeTemplates}
              selectedId={episodeTemplateId}
              fallbackId={settings.roleplayEpisodeTemplateId ?? ""}
              onChange={(id) =>
                onUpdate({
                  roleplayStoryboardEpisodeTemplateId: id === settings.roleplayEpisodeTemplateId ? null : id,
                })
              }
            />
            <GamePromptTemplateSelect
              label={localizeUi("ui.agents.storyboard.roleplayVisualStyle")}
              description={localizeUi("ui.agents.storyboard.roleplayVisualStyleDescription")}
              options={settings.roleplayStyleTemplates}
              selectedId={styleTemplateId}
              fallbackId={settings.roleplayStyleTemplateId ?? ""}
              onChange={(id) =>
                onUpdate({ roleplayStoryboardStyleTemplateId: id === settings.roleplayStyleTemplateId ? null : id })
              }
            />
            <GamePromptTemplateSelect
              label={localizeUi("ui.agents.storyboard.roleplayAnimationAddon")}
              description={localizeUi("ui.agents.storyboard.roleplayAnimationAddonDescription")}
              options={settings.roleplayAnimationTemplates}
              selectedId={animationTemplateId}
              fallbackId={settings.roleplayAnimationTemplateId ?? ""}
              onChange={(id) =>
                onUpdate({
                  roleplayStoryboardAnimationTemplateId: id === settings.roleplayAnimationTemplateId ? null : id,
                })
              }
            />
            <GamePromptTemplateSelect
              label={localizeUi("ui.agents.storyboard.roleplayOutputContract")}
              description={localizeUi("ui.agents.storyboard.roleplayOutputContractDescription")}
              options={settings.roleplayOutputTemplates}
              selectedId={outputTemplateId}
              fallbackId={settings.roleplayOutputTemplateId ?? ""}
              onChange={(id) =>
                onUpdate({ roleplayStoryboardOutputTemplateId: id === settings.roleplayOutputTemplateId ? null : id })
              }
            />
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <AgentSettingsToggle
              label={localizeUi("ui.chat.agentaddsetupfields.attachCardAppearance")}
              description={localizeUi("ui.agents.storyboard.roleplayAppearanceDescription")}
              enabled={includeCharacterAppearance}
              onToggle={() => onUpdate({ roleplayStoryboardIncludeCharacterAppearance: !includeCharacterAppearance })}
              overridden={appearanceOverridden}
              onReset={() => onUpdate({ roleplayStoryboardIncludeCharacterAppearance: null })}
            />
            <AgentSettingsToggle
              label={localizeUi("ui.chat.agentaddsetupfields.sendAvatarReferences")}
              description={localizeUi("ui.agents.storyboard.roleplayAvatarDescription")}
              enabled={useAvatarReferences}
              onToggle={() => onUpdate({ roleplayStoryboardUseAvatarReferences: !useAvatarReferences })}
              overridden={avatarsOverridden}
              onReset={() => onUpdate({ roleplayStoryboardUseAvatarReferences: null })}
            />
            <AgentSettingsToggle
              label={localizeUi("ui.agents.storyboard.useNovelAiCharacters")}
              description={localizeUi("ui.agents.storyboard.useNovelAiCharactersDescription")}
              enabled={useNovelAiCharacterPrompts}
              onToggle={() => onUpdate({ roleplayStoryboardUseNovelAiCharacterPrompts: !useNovelAiCharacterPrompts })}
              overridden={novelAiOverridden}
              onReset={() => onUpdate({ roleplayStoryboardUseNovelAiCharacterPrompts: null })}
            />
            <AgentSettingsToggle
              label={localizeUi("ui.agents.storyboard.useTemplate")}
              description={localizeUi("ui.agents.storyboard.useTemplateDescription")}
              enabled={usePromptTemplate}
              onToggle={() => onUpdate({ roleplayStoryboardUsePromptTemplate: !usePromptTemplate })}
              overridden={templateOverridden}
              onReset={() => onUpdate({ roleplayStoryboardUsePromptTemplate: null })}
            />
          </div>

          <div className="space-y-2">
            <StoryboardChatWorkflowStage
              number={2}
              title={localizeUi("ui.agents.storyboard.promptStage2Title")}
              description={localizeUi("ui.agents.storyboard.promptStage2Description")}
            >
              <GamePromptTemplateSelect
                label={localizeUi("ui.chat.chatsettingsdrawer.storyboardIllustrationPrompt")}
                description={localizeUi("ui.chat.chatsettingsdrawer.formatsEachPlannedKeyframeIntoTheFinalPromptSent")}
                options={settings.illustrationTemplates}
                selectedId={illustrationTemplateId}
                fallbackId={settings.illustrationTemplateId ?? ""}
                onChange={(id) =>
                  onUpdate({
                    roleplayStoryboardImagePromptTemplateId: id === settings.illustrationTemplateId ? null : id,
                  })
                }
              />
            </StoryboardChatWorkflowStage>
            {autoGenerateMode === "animation" ? (
              <>
                <StoryboardImageAwarePlannerOverride settings={settings} metadata={metadata} onUpdate={onUpdate} />
                <StoryboardChatWorkflowStage
                  number={4}
                  title={localizeUi("ui.agents.storyboard.promptStage4Title")}
                  description={localizeUi("ui.agents.storyboard.promptStage4Description")}
                >
                  <GamePromptTemplateSelect
                    label={localizeUi("ui.chat.chatsettingsdrawer.storyboardVideoPrompt")}
                    description={localizeUi(
                      "ui.chat.chatsettingsdrawer.combinesTheGeneratedKeyframeAndMotionPlanIntoThe",
                    )}
                    options={settings.videoTemplates}
                    selectedId={videoTemplateId}
                    fallbackId={settings.videoTemplateId ?? ""}
                    onChange={(id) =>
                      onUpdate({ roleplayStoryboardVideoPromptTemplateId: id === settings.videoTemplateId ? null : id })
                    }
                  />
                </StoryboardChatWorkflowStage>
              </>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)]">
            <p className="min-w-0 flex-1 text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
              {localizeUi("ui.agents.storyboard.roleplayPromptChainDescription")}
            </p>
            <AgentSettingsActionButton onClick={onOpenAgentSettings} className="shrink-0">
              <Settings2 size="0.75rem" />
              <span>{localizeUi("ui.chat.chatsettingsdrawer.openSetup")}</span>
            </AgentSettingsActionButton>
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

  const Panel = ownerMode === "roleplay" ? RoleplayStoryboardChatSettingsPanel : StoryboardChatSettingsPanel;

  return (
    <Panel
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
    />
  );
}
