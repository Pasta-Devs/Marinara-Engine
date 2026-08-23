import { useState, type ReactNode } from "react";
import { ChevronDown, ImageIcon, PanelsTopLeft, Plus, RotateCcw, Trash2, Video } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MAX,
  GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MIN,
  GAME_STORYBOARD_KEYFRAME_COUNT_MAX,
  GAME_STORYBOARD_KEYFRAME_COUNT_MIN,
  type AgentPromptTemplateOption,
  type StoryboardAgentSettings,
} from "@marinara-engine/shared";
import { MacroTextarea } from "../ui/MacroTextarea";

interface ConnectionOption {
  id: string;
  name: string;
  provider: string;
}

interface StoryboardAgentSettingsPanelProps {
  settings: StoryboardAgentSettings;
  defaults: StoryboardAgentSettings;
  plannerPrompt: string;
  defaultPlannerPrompt: string;
  plannerTemplates: AgentPromptTemplateOption[];
  connections: ConnectionOption[];
  onChange: (settings: StoryboardAgentSettings) => void;
  onPlannerPromptChange: (prompt: string) => void;
  onPlannerTemplatesChange: (templates: AgentPromptTemplateOption[]) => void;
  onDirty: () => void;
}

function uniqueTemplateId(prefix: string, templates: readonly AgentPromptTemplateOption[]): string {
  const used = new Set(templates.map((template) => template.id));
  let candidate = `${prefix}-custom`;
  let index = 2;
  while (used.has(candidate)) {
    candidate = `${prefix}-custom-${index}`;
    index += 1;
  }
  return candidate;
}

function preserveTemplateSelection(
  templates: readonly AgentPromptTemplateOption[],
  selectedId: string | null,
): string | null {
  return templates.some((template) => template.id === selectedId) ? selectedId : (templates[0]?.id ?? null);
}

function TemplateCollectionEditor({
  title,
  description,
  templates,
  defaults,
  prefix,
  required = false,
  renderTemplateMeta,
  onChange,
}: {
  title: string;
  description: string;
  templates: AgentPromptTemplateOption[];
  defaults: AgentPromptTemplateOption[];
  prefix: string;
  required?: boolean;
  renderTemplateMeta?: (template: AgentPromptTemplateOption) => ReactNode;
  onChange: (templates: AgentPromptTemplateOption[]) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const defaultsById = new Map(defaults.map((template) => [template.id, template]));
  const requiredPromptSeed =
    templates.find((template) => template.promptTemplate.trim())?.promptTemplate ??
    defaults.find((template) => template.promptTemplate.trim())?.promptTemplate ??
    "";
  const update = (id: string, patch: Partial<AgentPromptTemplateOption>) => {
    onChange(templates.map((template) => (template.id === id ? { ...template, ...patch } : template)));
  };
  const restoreRequiredPrompt = (template: AgentPromptTemplateOption) => {
    if (!required || template.promptTemplate.trim()) return;
    const fallbackPrompt = defaultsById.get(template.id)?.promptTemplate || requiredPromptSeed;
    if (fallbackPrompt) update(template.id, { promptTemplate: fallbackPrompt });
  };

  return (
    <div className="min-w-0 max-w-full space-y-3 overflow-hidden rounded-xl bg-[var(--secondary)]/55 p-3 ring-1 ring-[var(--border)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--foreground)]">{title}</p>
          <p className="mt-0.5 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">{description}</p>
        </div>
        <button
          type="button"
          disabled={required && !requiredPromptSeed}
          onClick={() => {
            const id = uniqueTemplateId(prefix, templates);
            onChange([
              ...templates,
              {
                id,
                name: localizeUi("ui.agents.storyboard.customPrompt"),
                description: "",
                promptTemplate: required ? requiredPromptSeed : "",
              },
            ]);
          }}
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--background)] px-3 py-2 text-[0.6875rem] font-medium ring-1 ring-[var(--border)] hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size="0.6875rem" /> {localizeUi("ui.agents.agenteditor.addOption")}
        </button>
      </div>

      {templates.map((template, index) => {
        const defaultTemplate = defaultsById.get(template.id);
        const matchesDefault = defaultTemplate?.promptTemplate === template.promptTemplate;
        return (
          <div
            key={template.id}
            className="min-w-0 max-w-full space-y-2 overflow-hidden rounded-xl bg-[var(--background)]/70 p-3 ring-1 ring-[var(--border)]"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)] text-[0.6875rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                {index + 1}
              </span>
              <input
                value={template.name}
                onChange={(event) => update(template.id, { name: event.target.value })}
                className="min-w-0 flex-1 rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                placeholder={localizeUi("ui.agents.agenteditor.optionName")}
              />
              {defaultTemplate ? (
                <button
                  type="button"
                  disabled={matchesDefault}
                  onClick={() => update(template.id, { promptTemplate: defaultTemplate.promptTemplate })}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--accent)] disabled:opacity-35"
                  title={localizeUi("ui.agents.agenteditor.restoreDefaultPrompt")}
                >
                  <RotateCcw size="0.75rem" />
                </button>
              ) : null}
              <button
                type="button"
                disabled={required && templates.length <= 1}
                onClick={() => onChange(templates.filter((entry) => entry.id !== template.id))}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--destructive)] hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-35"
                title={localizeUi("ui.agents.agenteditor.removePromptOption")}
              >
                <Trash2 size="0.75rem" />
              </button>
            </div>
            {renderTemplateMeta?.(template)}
            <input
              value={template.description ?? ""}
              onChange={(event) => update(template.id, { description: event.target.value })}
              className="min-w-0 max-w-full w-full rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder={localizeUi("ui.agents.agenteditor.shortDescriptionShownInChatSettings")}
            />
            <MacroTextarea
              value={template.promptTemplate}
              onChange={(value) => update(template.id, { promptTemplate: value })}
              onBlur={() => restoreRequiredPrompt(template)}
              onExpandedClose={() => restoreRequiredPrompt(template)}
              rows={7}
              title={template.name}
              className="min-w-0 max-w-full w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 font-mono text-xs leading-relaxed ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              wrapperClassName="min-w-0 max-w-full"
              buttonClassName="flex min-h-11 min-w-11 items-center justify-center"
              controlPaddingClassName="pr-12"
              placeholder={localizeUi("ui.agents.agenteditor.writeThePromptTemplateForThisOption")}
            />
          </div>
        );
      })}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-w-0 max-w-full cursor-pointer items-start justify-between gap-4 overflow-hidden rounded-xl bg-[var(--secondary)]/55 px-3 py-2.5 ring-1 ring-[var(--border)]">
      <span className="min-w-0">
        <span className="block text-xs font-medium text-[var(--foreground)]">{label}</span>
        <span className="mt-0.5 block text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
      />
    </label>
  );
}

function PromptStage({
  number,
  title,
  description,
  kind,
  children,
}: {
  number: 1 | 2 | 3 | 4;
  title: string;
  description: string;
  kind: "planner" | "formatter";
  children: ReactNode;
}) {
  const { t: localizeUi } = useUiTranslation();
  const headingId = `storyboard-active-prompt-stage-${number}`;
  return (
    <section
      data-storyboard-workflow-stage={number}
      data-storyboard-workflow-kind={kind}
      aria-labelledby={headingId}
      className="min-w-0 max-w-full space-y-3 rounded-xl bg-[var(--secondary)]/45 p-3 ring-1 ring-[var(--border)]"
    >
      <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-x-2.5 gap-y-2 sm:grid-cols-[1.5rem_minmax(0,1fr)_auto]">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/12 text-[0.6875rem] font-semibold text-[var(--primary)] ring-1 ring-[var(--primary)]/25">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h4 id={headingId} className="text-sm font-semibold text-[var(--foreground)]">
            {title}
          </h4>
          <p className="mt-0.5 max-w-[70ch] text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            {description}
          </p>
        </div>
        <span className="col-start-2 w-fit rounded-full bg-[var(--background)] px-2 py-1 text-[0.5625rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] sm:col-start-auto">
          {localizeUi(
            kind === "planner" ? "ui.agents.storyboard.aiPlanningStage" : "ui.agents.storyboard.providerFormatter",
          )}
        </span>
      </div>
      {children}
    </section>
  );
}

function StagePromptLibrary({
  stage,
  description,
  children,
}: {
  stage: 1 | 2 | 3 | 4;
  description: string;
  children: ReactNode;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      data-storyboard-stage-prompt-library={stage}
      className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)]/55"
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
      >
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-[var(--foreground)]">
            {localizeUi("ui.agents.storyboard.stagePromptLibrary")}
          </span>
          <span className="mt-0.5 block text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            {description}
          </span>
        </span>
        <ChevronDown
          size="0.875rem"
          aria-hidden="true"
          className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded ? (
        <div className="min-w-0 max-w-full space-y-3 border-t border-[var(--border)] p-3">{children}</div>
      ) : null}
    </div>
  );
}

function StoryboardSetupSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      data-storyboard-settings-scope="setup"
      className="min-w-0 max-w-full rounded-xl border border-[var(--border)] bg-[var(--card)]/45"
    >
      <div className="min-w-0 px-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[var(--foreground)]">{title}</span>
          <span className="mt-0.5 block text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            {description}
          </span>
        </span>
      </div>
      <div className="min-w-0 max-w-full space-y-4 border-t border-[var(--border)] p-3">{children}</div>
    </section>
  );
}

function SelectedTemplateControl({
  label,
  value,
  templates,
  onChange,
}: {
  label: string;
  value: string | null;
  templates: AgentPromptTemplateOption[];
  onChange: (id: string | null) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const selected = templates.find((template) => template.id === value) ?? templates[0];
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="text-[0.6875rem] font-medium text-[var(--foreground)]">{label}</span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        className="w-full rounded-xl bg-[var(--background)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
      >
        {templates.length === 0 ? <option value="">{localizeUi("ui.agents.storyboard.noPromptOptions")}</option> : null}
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name}
          </option>
        ))}
      </select>
      {selected?.description ? (
        <span className="block text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
          {selected.description}
        </span>
      ) : null}
    </label>
  );
}

export function StoryboardAgentSettingsPanel({
  settings,
  defaults,
  plannerPrompt,
  defaultPlannerPrompt,
  plannerTemplates,
  connections,
  onChange,
  onPlannerPromptChange,
  onPlannerTemplatesChange,
  onDirty,
}: StoryboardAgentSettingsPanelProps) {
  const { t: localizeUi } = useUiTranslation();
  const [activeWorkflow, setActiveWorkflow] = useState<"roleplay" | "game">("roleplay");
  const imageConnections = connections.filter((connection) => connection.provider === "image_generation");
  const videoConnections = connections.filter((connection) => connection.provider === "video_generation");
  const stillPlanners = plannerTemplates.filter((template) =>
    settings.illustrationPlannerTemplateIds.includes(template.id),
  );
  const animationPlanners = plannerTemplates.filter((template) =>
    settings.animationPlannerTemplateIds.includes(template.id),
  );
  const showAnimationStages = settings.autoGenerateMode !== "illustration";
  const update = (patch: Partial<StoryboardAgentSettings>) => {
    onChange({ ...settings, ...patch });
    onDirty();
  };
  const updatePlannerTemplates = (templates: AgentPromptTemplateOption[]) => {
    const nextTemplateIds = new Set(templates.map((template) => template.id));
    const previousTemplateIds = new Set(plannerTemplates.map((template) => template.id));
    const addedTemplateIds = templates
      .filter((template) => !previousTemplateIds.has(template.id))
      .map((template) => template.id);
    const illustrationPlannerTemplateIds = Array.from(
      new Set([
        ...settings.illustrationPlannerTemplateIds.filter((id) => nextTemplateIds.has(id)),
        ...addedTemplateIds,
      ]),
    );
    const animationPlannerTemplateIds = settings.animationPlannerTemplateIds.filter((id) => nextTemplateIds.has(id));
    const illustrationTemplates = templates.filter((template) => illustrationPlannerTemplateIds.includes(template.id));
    const animationTemplates = templates.filter((template) => animationPlannerTemplateIds.includes(template.id));
    onPlannerTemplatesChange(templates);
    onChange({
      ...settings,
      illustrationPlannerTemplateIds,
      animationPlannerTemplateIds,
      illustrationPlannerTemplateId: preserveTemplateSelection(
        illustrationTemplates,
        settings.illustrationPlannerTemplateId,
      ),
      animationPlannerTemplateId: preserveTemplateSelection(animationTemplates, settings.animationPlannerTemplateId),
    });
    onDirty();
  };
  const setPlannerType = (id: string, type: "illustration" | "animation") => {
    const illustrationPlannerTemplateIds =
      type === "animation"
        ? settings.illustrationPlannerTemplateIds.filter((entry) => entry !== id)
        : Array.from(new Set([...settings.illustrationPlannerTemplateIds, id]));
    const animationPlannerTemplateIds =
      type === "animation"
        ? Array.from(new Set([...settings.animationPlannerTemplateIds, id]))
        : settings.animationPlannerTemplateIds.filter((entry) => entry !== id);
    update({
      illustrationPlannerTemplateIds,
      animationPlannerTemplateIds,
      illustrationPlannerTemplateId: preserveTemplateSelection(
        plannerTemplates.filter((template) => illustrationPlannerTemplateIds.includes(template.id)),
        settings.illustrationPlannerTemplateId,
      ),
      animationPlannerTemplateId: preserveTemplateSelection(
        plannerTemplates.filter((template) => animationPlannerTemplateIds.includes(template.id)),
        settings.animationPlannerTemplateId,
      ),
    });
  };
  const roleplayPlannerLibrary = (
    <StagePromptLibrary stage={1} description={localizeUi("ui.agents.storyboard.roleplayStageLibraryDescription")}>
      <div className="grid gap-3 xl:grid-cols-2">
        <TemplateCollectionEditor
          title={localizeUi("ui.agents.storyboard.roleplayEpisodePrompts")}
          description={localizeUi("ui.agents.storyboard.roleplayEpisodePromptsDescription")}
          templates={settings.roleplayEpisodeTemplates}
          defaults={defaults.roleplayEpisodeTemplates}
          prefix="storyboard-roleplay-episode"
          required
          onChange={(templates) =>
            update({
              roleplayEpisodeTemplates: templates,
              roleplayEpisodeTemplateId: preserveTemplateSelection(templates, settings.roleplayEpisodeTemplateId),
            })
          }
        />
        <TemplateCollectionEditor
          title={localizeUi("ui.agents.storyboard.roleplayStylePrompts")}
          description={localizeUi("ui.agents.storyboard.roleplayStylePromptsDescription")}
          templates={settings.roleplayStyleTemplates}
          defaults={defaults.roleplayStyleTemplates}
          prefix="storyboard-roleplay-style"
          required
          onChange={(templates) =>
            update({
              roleplayStyleTemplates: templates,
              roleplayStyleTemplateId: preserveTemplateSelection(templates, settings.roleplayStyleTemplateId),
            })
          }
        />
        <TemplateCollectionEditor
          title={localizeUi("ui.agents.storyboard.roleplayAnimationPrompts")}
          description={localizeUi("ui.agents.storyboard.roleplayAnimationPromptsDescription")}
          templates={settings.roleplayAnimationTemplates}
          defaults={defaults.roleplayAnimationTemplates}
          prefix="storyboard-roleplay-animation"
          required
          onChange={(templates) =>
            update({
              roleplayAnimationTemplates: templates,
              roleplayAnimationTemplateId: preserveTemplateSelection(templates, settings.roleplayAnimationTemplateId),
            })
          }
        />
        <TemplateCollectionEditor
          title={localizeUi("ui.agents.storyboard.roleplayOutputPrompts")}
          description={localizeUi("ui.agents.storyboard.roleplayOutputPromptsDescription")}
          templates={settings.roleplayOutputTemplates}
          defaults={defaults.roleplayOutputTemplates}
          prefix="storyboard-roleplay-output"
          required
          onChange={(templates) =>
            update({
              roleplayOutputTemplates: templates,
              roleplayOutputTemplateId: preserveTemplateSelection(templates, settings.roleplayOutputTemplateId),
            })
          }
        />
      </div>
    </StagePromptLibrary>
  );
  const gamePlannerLibrary = (
    <StagePromptLibrary stage={1} description={localizeUi("ui.agents.storyboard.gameStageLibraryDescription")}>
      <div className="min-w-0 max-w-full space-y-3 rounded-xl bg-[var(--secondary)]/55 p-3 ring-1 ring-[var(--border)]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-[var(--foreground)]">
              {localizeUi("ui.agents.storyboard.fallbackPlannerPrompt")}
            </p>
            <p className="mt-0.5 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
              {localizeUi("ui.agents.storyboard.fallbackPlannerPromptDescription")}
            </p>
          </div>
          {plannerPrompt.trim() ? (
            <button
              type="button"
              onClick={() => {
                onPlannerPromptChange("");
                onDirty();
              }}
              className="flex min-h-11 items-center gap-1.5 rounded-lg bg-[var(--background)] px-3 py-2 text-[0.6875rem] font-medium ring-1 ring-[var(--border)] hover:bg-[var(--accent)]"
            >
              <RotateCcw size="0.6875rem" /> {localizeUi("ui.agents.agenteditor.resetToDefault")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onPlannerPromptChange(defaultPlannerPrompt);
                onDirty();
              }}
              className="flex min-h-11 items-center gap-1.5 rounded-lg bg-[var(--background)] px-3 py-2 text-[0.6875rem] font-medium ring-1 ring-[var(--border)] hover:bg-[var(--accent)]"
            >
              {localizeUi("ui.agents.agenteditor.copyDefaultToEdit")}
            </button>
          )}
        </div>
        {plannerPrompt.trim() ? (
          <MacroTextarea
            value={plannerPrompt}
            onChange={(prompt) => {
              onPlannerPromptChange(prompt);
              onDirty();
            }}
            rows={10}
            title={localizeUi("ui.agents.storyboard.fallbackPlannerPrompt")}
            className="min-w-0 max-w-full w-full resize-y rounded-lg bg-[var(--background)] px-3 py-2 font-mono text-xs leading-relaxed ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            wrapperClassName="min-w-0 max-w-full"
            placeholder={localizeUi("ui.agents.agenteditor.writeTheSystemPromptForThisAgent")}
          />
        ) : (
          <pre className="min-w-0 max-w-full w-full max-h-[24rem] overflow-y-auto whitespace-pre-wrap rounded-lg bg-[var(--background)] px-3 py-2 font-mono text-xs leading-relaxed text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
            {defaultPlannerPrompt}
          </pre>
        )}
      </div>
      <TemplateCollectionEditor
        title={localizeUi("ui.agents.storyboard.gamePromptLibrary")}
        description={localizeUi("ui.agents.storyboard.gamePromptLibraryDescription")}
        templates={plannerTemplates}
        defaults={defaults.plannerTemplates}
        prefix="storyboard-game-planner"
        renderTemplateMeta={(template) => (
          <label className="flex items-center gap-2 text-[0.6875rem] text-[var(--muted-foreground)]">
            <span>{localizeUi("ui.agents.storyboard.plannerType")}</span>
            <select
              value={settings.animationPlannerTemplateIds.includes(template.id) ? "animation" : "illustration"}
              onChange={(event) =>
                setPlannerType(template.id, event.target.value === "animation" ? "animation" : "illustration")
              }
              className="rounded-lg bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)] ring-1 ring-[var(--border)]"
            >
              <option value="illustration">{localizeUi("ui.agents.storyboard.stillImages")}</option>
              <option value="animation">{localizeUi("ui.agents.storyboard.animations")}</option>
            </select>
          </label>
        )}
        onChange={updatePlannerTemplates}
      />
    </StagePromptLibrary>
  );
  const sharedWorkflowStages = (
    <>
      <PromptStage
        number={2}
        kind="formatter"
        title={localizeUi("ui.agents.storyboard.promptStage2Title")}
        description={localizeUi("ui.agents.storyboard.promptStage2Description")}
      >
        {settings.usePromptTemplate ? (
          <SelectedTemplateControl
            label={localizeUi("ui.agents.storyboard.defaultImagePrompt")}
            value={settings.illustrationTemplateId}
            templates={settings.illustrationTemplates}
            onChange={(illustrationTemplateId) => update({ illustrationTemplateId })}
          />
        ) : (
          <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            {localizeUi("ui.agents.storyboard.imageFormatterBypassed")}
          </p>
        )}
        <StagePromptLibrary stage={2} description={localizeUi("ui.agents.storyboard.stage2LibraryDescription")}>
          <TemplateCollectionEditor
            title={localizeUi("ui.agents.storyboard.imagePrompts")}
            description={localizeUi("ui.agents.storyboard.imagePromptsDescription")}
            templates={settings.illustrationTemplates}
            defaults={defaults.illustrationTemplates}
            prefix="storyboard-image"
            onChange={(templates) =>
              update({
                illustrationTemplates: templates,
                illustrationTemplateId: preserveTemplateSelection(templates, settings.illustrationTemplateId),
              })
            }
          />
        </StagePromptLibrary>
      </PromptStage>

      {showAnimationStages ? (
        <>
          <PromptStage
            number={3}
            kind="planner"
            title={localizeUi("ui.agents.storyboard.promptStage3Title")}
            description={localizeUi("ui.agents.storyboard.promptStage3Description")}
          >
            <ToggleRow
              label={localizeUi("ui.agents.storyboard.enableImageAwareShotPlanning")}
              description={localizeUi("ui.agents.storyboard.enableImageAwareShotPlanningDescription")}
              checked={settings.imageAwareShotPlanningEnabled}
              onChange={(imageAwareShotPlanningEnabled) => update({ imageAwareShotPlanningEnabled })}
            />
            {settings.imageAwareShotPlanningEnabled ? (
              <SelectedTemplateControl
                label={localizeUi("ui.agents.storyboard.defaultShotPlannerPrompt")}
                value={settings.animationRefinementTemplateId}
                templates={settings.animationRefinementTemplates}
                onChange={(animationRefinementTemplateId) => update({ animationRefinementTemplateId })}
              />
            ) : (
              <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                {localizeUi("ui.agents.storyboard.imageAwarePlannerDisabled")}
              </p>
            )}
            <StagePromptLibrary stage={3} description={localizeUi("ui.agents.storyboard.stage3LibraryDescription")}>
              <TemplateCollectionEditor
                title={localizeUi("ui.agents.storyboard.shotPlannerPrompts")}
                description={localizeUi("ui.agents.storyboard.shotPlannerPromptsDescription")}
                templates={settings.animationRefinementTemplates}
                defaults={defaults.animationRefinementTemplates}
                prefix="storyboard-shot-planner"
                required
                onChange={(templates) =>
                  update({
                    animationRefinementTemplates: templates,
                    animationRefinementTemplateId: preserveTemplateSelection(
                      templates,
                      settings.animationRefinementTemplateId,
                    ),
                  })
                }
              />
            </StagePromptLibrary>
          </PromptStage>
          <PromptStage
            number={4}
            kind="formatter"
            title={localizeUi("ui.agents.storyboard.promptStage4Title")}
            description={localizeUi("ui.agents.storyboard.promptStage4Description")}
          >
            <SelectedTemplateControl
              label={localizeUi("ui.agents.storyboard.defaultVideoPrompt")}
              value={settings.videoTemplateId}
              templates={settings.videoTemplates}
              onChange={(videoTemplateId) => update({ videoTemplateId })}
            />
            <StagePromptLibrary stage={4} description={localizeUi("ui.agents.storyboard.stage4LibraryDescription")}>
              <TemplateCollectionEditor
                title={localizeUi("ui.agents.storyboard.videoPrompts")}
                description={localizeUi("ui.agents.storyboard.videoPromptsDescription")}
                templates={settings.videoTemplates}
                defaults={defaults.videoTemplates}
                prefix="storyboard-video"
                onChange={(templates) =>
                  update({
                    videoTemplates: templates,
                    videoTemplateId: preserveTemplateSelection(templates, settings.videoTemplateId),
                  })
                }
              />
            </StagePromptLibrary>
          </PromptStage>
        </>
      ) : (
        <p
          data-storyboard-still-flow-note
          className="rounded-lg bg-[var(--background)]/70 px-3 py-2 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)] ring-1 ring-[var(--border)]"
        >
          {localizeUi("ui.agents.storyboard.stillFlowDescription")}
        </p>
      )}
    </>
  );

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-hidden [&_button]:max-w-full [&_input]:min-w-0 [&_input]:max-w-full [&_label]:min-w-0 [&_section]:min-w-0 [&_select]:min-w-0 [&_select]:max-w-full [&_textarea]:min-w-0 [&_textarea]:max-w-full">
      <StoryboardSetupSection
        title={localizeUi("ui.agents.storyboard.setup")}
        description={localizeUi("ui.agents.storyboard.setupDescription")}
      >
        <div className={`grid gap-3 ${showAnimationStages ? "md:grid-cols-2" : ""}`}>
          <label className="space-y-1.5">
            <span className="flex items-center gap-1.5 text-[0.6875rem] font-medium">
              <ImageIcon size="0.75rem" />
              {localizeUi("ui.agents.storyboard.imageConnection")}
            </span>
            <select
              value={settings.imageConnectionId ?? ""}
              onChange={(event) => update({ imageConnectionId: event.target.value || null })}
              className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              <option value="">{localizeUi("ui.agents.storyboard.useGameImageConnection")}</option>
              {imageConnections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.name}
                </option>
              ))}
            </select>
          </label>
          {showAnimationStages ? (
            <label className="space-y-1.5" data-storyboard-animation-only>
              <span className="flex items-center gap-1.5 text-[0.6875rem] font-medium">
                <Video size="0.75rem" />
                {localizeUi("ui.agents.storyboard.videoConnection")}
              </span>
              <select
                value={settings.videoConnectionId ?? ""}
                onChange={(event) => update({ videoConnectionId: event.target.value || null })}
                className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              >
                <option value="">{localizeUi("ui.agents.storyboard.useGameVideoConnection")}</option>
                {videoConnections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className={`grid gap-3 sm:grid-cols-2 ${showAnimationStages ? "lg:grid-cols-3" : ""}`}>
          <label className="space-y-1.5">
            <span className="text-[0.6875rem] font-medium">{localizeUi("ui.agents.storyboard.autoGenerate")}</span>
            <select
              value={settings.autoGenerateMode}
              onChange={(event) =>
                update({ autoGenerateMode: event.target.value as StoryboardAgentSettings["autoGenerateMode"] })
              }
              className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)]"
            >
              <option value="manual">{localizeUi("ui.agents.storyboard.manual")}</option>
              <option value="illustration">{localizeUi("ui.agents.storyboard.stillImages")}</option>
              <option value="animation">{localizeUi("ui.agents.storyboard.animations")}</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[0.6875rem] font-medium">{localizeUi("ui.agents.storyboard.keyframes")}</span>
            <input
              type="number"
              min={GAME_STORYBOARD_KEYFRAME_COUNT_MIN}
              max={GAME_STORYBOARD_KEYFRAME_COUNT_MAX}
              value={settings.keyframeCount}
              onChange={(event) =>
                update({
                  keyframeCount: Math.min(
                    GAME_STORYBOARD_KEYFRAME_COUNT_MAX,
                    Math.max(
                      GAME_STORYBOARD_KEYFRAME_COUNT_MIN,
                      Number(event.target.value) || GAME_STORYBOARD_KEYFRAME_COUNT_MIN,
                    ),
                  ),
                })
              }
              className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)]"
            />
          </label>
          {showAnimationStages ? (
            <label className="space-y-1.5" data-storyboard-animation-only>
              <span className="text-[0.6875rem] font-medium">{localizeUi("ui.agents.storyboard.duration")}</span>
              <input
                type="number"
                min={GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MIN}
                max={GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MAX}
                value={settings.animationDurationSeconds}
                onChange={(event) =>
                  update({
                    animationDurationSeconds: Math.min(
                      GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MAX,
                      Math.max(
                        GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MIN,
                        Number(event.target.value) || GAME_STORYBOARD_ANIMATION_DURATION_SECONDS_MIN,
                      ),
                    ),
                  })
                }
                className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)]"
              />
            </label>
          ) : null}
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <ToggleRow
            label={localizeUi("ui.chat.agentaddsetupfields.attachCardAppearance")}
            description={localizeUi("ui.agents.agenteditor.addsOnlyMatchedVisibleNamesAsLinesLikeName")}
            checked={settings.includeCharacterAppearance}
            onChange={(checked) => update({ includeCharacterAppearance: checked })}
          />
          <ToggleRow
            label={localizeUi("ui.chat.agentaddsetupfields.sendAvatarReferences")}
            description={localizeUi("ui.agents.agenteditor.sendsReferencesOnlyForCharactersOrPersonaNamesMatched")}
            checked={settings.useAvatarReferences}
            onChange={(checked) => update({ useAvatarReferences: checked })}
          />
          <ToggleRow
            label={localizeUi("ui.agents.storyboard.useTemplate")}
            description={localizeUi("ui.agents.storyboard.useTemplateDescription")}
            checked={settings.usePromptTemplate}
            onChange={(checked) => update({ usePromptTemplate: checked })}
          />
          <ToggleRow
            label={localizeUi("ui.agents.storyboard.useNovelAiCharacters")}
            description={localizeUi("ui.agents.storyboard.useNovelAiCharactersDescription")}
            checked={settings.useNovelAiCharacterPrompts}
            onChange={(checked) => update({ useNovelAiCharacterPrompts: checked })}
          />
        </div>
      </StoryboardSetupSection>

      <div className="space-y-3" data-storyboard-active-workflow={activeWorkflow}>
        <div
          role="tablist"
          aria-label={localizeUi("ui.agents.storyboard.workflowTabsLabel")}
          className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--secondary)]/70 p-1 ring-1 ring-[var(--border)]"
        >
          {(["roleplay", "game"] as const).map((workflow) => {
            const selected = activeWorkflow === workflow;
            return (
              <button
                key={workflow}
                id={`storyboard-workflow-tab-${workflow}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="storyboard-active-flow"
                onClick={() => setActiveWorkflow(workflow)}
                className={`min-h-11 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                  selected
                    ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                }`}
              >
                {localizeUi(
                  workflow === "roleplay" ? "ui.agents.storyboard.roleplayScope" : "ui.agents.storyboard.gameScope",
                )}
              </button>
            );
          })}
        </div>

        <section
          id="storyboard-active-flow"
          role="tabpanel"
          aria-labelledby={`storyboard-workflow-tab-${activeWorkflow}`}
          className="space-y-3 rounded-xl border border-[var(--primary)]/25 bg-[var(--primary)]/8 p-3"
        >
          <div className="flex items-start gap-2">
            <PanelsTopLeft size="0.875rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
            <div>
              <h3 className="text-xs font-semibold text-[var(--foreground)]">
                {localizeUi("ui.agents.storyboard.activeFlow")}
              </h3>
              <p className="mt-1 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                {localizeUi(
                  activeWorkflow === "roleplay"
                    ? "ui.agents.storyboard.roleplayActiveFlowDescription"
                    : "ui.agents.storyboard.gameActiveFlowDescription",
                )}
              </p>
            </div>
          </div>

          {settings.autoGenerateMode === "manual" ? (
            <p className="rounded-lg bg-[var(--background)]/70 px-3 py-2 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
              {localizeUi("ui.agents.storyboard.manualFlowDescription")}
            </p>
          ) : null}

          {activeWorkflow === "roleplay" ? (
            <div data-storyboard-active-roleplay className="space-y-3">
              <label className="grid gap-2 rounded-xl bg-[var(--background)]/70 px-3 py-2.5 ring-1 ring-[var(--border)] sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-center">
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-[var(--foreground)]">
                    {localizeUi("ui.agents.storyboard.roleplayRunInterval")}
                  </span>
                  <span className="mt-0.5 block text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                    {localizeUi("ui.agents.storyboard.roleplayRunIntervalDescription")}
                  </span>
                </span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={settings.runInterval}
                  onChange={(event) =>
                    update({ runInterval: Math.max(1, Math.min(100, Math.trunc(Number(event.target.value) || 1))) })
                  }
                  aria-label={localizeUi("ui.agents.storyboard.roleplayRunInterval")}
                  className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-sm tabular-nums ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </label>

              <PromptStage
                number={1}
                kind="planner"
                title={localizeUi("ui.agents.storyboard.promptStage1Title")}
                description={localizeUi("ui.agents.storyboard.roleplayPlanningStageDescription")}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <SelectedTemplateControl
                    label={localizeUi("ui.agents.storyboard.roleplayEpisodeContract")}
                    value={settings.roleplayEpisodeTemplateId}
                    templates={settings.roleplayEpisodeTemplates}
                    onChange={(roleplayEpisodeTemplateId) => update({ roleplayEpisodeTemplateId })}
                  />
                  <SelectedTemplateControl
                    label={localizeUi("ui.agents.storyboard.roleplayVisualStyle")}
                    value={settings.roleplayStyleTemplateId}
                    templates={settings.roleplayStyleTemplates}
                    onChange={(roleplayStyleTemplateId) => update({ roleplayStyleTemplateId })}
                  />
                  {showAnimationStages ? (
                    <SelectedTemplateControl
                      label={localizeUi("ui.agents.storyboard.roleplayAnimationAddon")}
                      value={settings.roleplayAnimationTemplateId}
                      templates={settings.roleplayAnimationTemplates}
                      onChange={(roleplayAnimationTemplateId) => update({ roleplayAnimationTemplateId })}
                    />
                  ) : null}
                  <SelectedTemplateControl
                    label={localizeUi("ui.agents.storyboard.roleplayOutputContract")}
                    value={settings.roleplayOutputTemplateId}
                    templates={settings.roleplayOutputTemplates}
                    onChange={(roleplayOutputTemplateId) => update({ roleplayOutputTemplateId })}
                  />
                </div>
                {roleplayPlannerLibrary}
              </PromptStage>
              {sharedWorkflowStages}
            </div>
          ) : (
            <div data-storyboard-active-game className="space-y-3">
              <PromptStage
                number={1}
                kind="planner"
                title={localizeUi("ui.agents.storyboard.promptStage1Title")}
                description={localizeUi("ui.agents.storyboard.gamePlanningStageDescription")}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  {settings.autoGenerateMode !== "animation" ? (
                    <SelectedTemplateControl
                      label={localizeUi("ui.agents.storyboard.stillPlanner")}
                      value={settings.illustrationPlannerTemplateId}
                      templates={stillPlanners}
                      onChange={(illustrationPlannerTemplateId) => update({ illustrationPlannerTemplateId })}
                    />
                  ) : null}
                  {showAnimationStages ? (
                    <SelectedTemplateControl
                      label={localizeUi("ui.agents.storyboard.animationPlanner")}
                      value={settings.animationPlannerTemplateId}
                      templates={animationPlanners}
                      onChange={(animationPlannerTemplateId) => update({ animationPlannerTemplateId })}
                    />
                  ) : null}
                </div>
                {gamePlannerLibrary}
              </PromptStage>
              {sharedWorkflowStages}

              <label className="block max-w-sm space-y-1.5 rounded-xl bg-[var(--background)]/70 p-3 ring-1 ring-[var(--border)]">
                <span className="text-[0.6875rem] font-medium">{localizeUi("ui.agents.storyboard.viewer")}</span>
                <select
                  value={settings.viewerDisplayMode}
                  onChange={(event) =>
                    update({ viewerDisplayMode: event.target.value === "background" ? "background" : "floating" })
                  }
                  className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)]"
                >
                  <option value="floating">{localizeUi("ui.agents.storyboard.floating")}</option>
                  <option value="background">{localizeUi("ui.agents.storyboard.background")}</option>
                </select>
              </label>
            </div>
          )}

          <p className="border-t border-[var(--primary)]/15 pt-2 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            {localizeUi("ui.agents.storyboard.agentDefaultsDescription")}
          </p>
        </section>
      </div>
    </div>
  );
}
