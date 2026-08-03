import { useState, type ReactNode } from "react";
import { ChevronDown, Plus, RotateCcw, Trash2, Video, ImageIcon, PanelsTopLeft } from "lucide-react";
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
  plannerTemplates: AgentPromptTemplateOption[];
  connections: ConnectionOption[];
  onChange: (settings: StoryboardAgentSettings) => void;
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
  onChange,
}: {
  title: string;
  description: string;
  templates: AgentPromptTemplateOption[];
  defaults: AgentPromptTemplateOption[];
  prefix: string;
  required?: boolean;
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
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-35"
                title={localizeUi("ui.agents.agenteditor.removePromptOption")}
              >
                <Trash2 size="0.75rem" />
              </button>
            </div>
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

function StoryboardScopeSection({
  id,
  title,
  description,
  children,
}: {
  id: "shared" | "roleplay" | "game";
  title: string;
  description: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <section
      data-storyboard-settings-scope={id}
      className="min-w-0 max-w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]/45"
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={`storyboard-${id}-settings`}
        onClick={() => setExpanded((current) => !current)}
        className="flex min-h-11 w-full min-w-0 items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[var(--foreground)]">{title}</span>
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
        <div
          id={`storyboard-${id}-settings`}
          className="min-w-0 max-w-full space-y-4 border-t border-[var(--border)] p-3"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function StoryboardAgentSettingsPanel({
  settings,
  defaults,
  plannerTemplates,
  connections,
  onChange,
  onDirty,
}: StoryboardAgentSettingsPanelProps) {
  const { t: localizeUi } = useUiTranslation();
  const imageConnections = connections.filter((connection) => connection.provider === "image_generation");
  const videoConnections = connections.filter((connection) => connection.provider === "video_generation");
  const stillPlanners = plannerTemplates.filter((template) =>
    settings.illustrationPlannerTemplateIds.includes(template.id),
  );
  const animationPlanners = plannerTemplates.filter((template) =>
    settings.animationPlannerTemplateIds.includes(template.id),
  );
  const update = (patch: Partial<StoryboardAgentSettings>) => {
    onChange({ ...settings, ...patch });
    onDirty();
  };

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-hidden [&_button]:max-w-full [&_input]:min-w-0 [&_input]:max-w-full [&_label]:min-w-0 [&_section]:min-w-0 [&_select]:min-w-0 [&_select]:max-w-full [&_textarea]:min-w-0 [&_textarea]:max-w-full">
      <div className="rounded-xl border border-[var(--primary)]/25 bg-[var(--primary)]/8 p-3">
        <div className="flex items-start gap-2">
          <PanelsTopLeft size="0.875rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
          <div>
            <p className="text-xs font-semibold text-[var(--foreground)]">
              {localizeUi("ui.agents.storyboard.promptChainTitle")}
            </p>
            <p className="mt-1 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
              {localizeUi("ui.agents.storyboard.promptChainDescription")}
            </p>
          </div>
        </div>
        <p className="mt-2 border-t border-[var(--primary)]/15 pt-2 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
          {localizeUi("ui.agents.storyboard.agentDefaultsDescription")}
        </p>
      </div>

      <StoryboardScopeSection
        id="shared"
        title={localizeUi("ui.agents.storyboard.sharedScope")}
        description={localizeUi("ui.agents.storyboard.sharedScopeDescription")}
      >
        <div className="grid gap-3 md:grid-cols-2">
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
          <label className="space-y-1.5">
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
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          <label className="space-y-1.5">
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

        <div className="space-y-0.5">
          <h4 className="text-sm font-semibold text-[var(--foreground)]">
            {localizeUi("ui.agents.storyboard.sharedProviderFormatters")}
          </h4>
          <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            {localizeUi("ui.agents.storyboard.sharedProviderFormattersDescription")}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-[0.6875rem] font-medium">
              {localizeUi("ui.agents.storyboard.defaultImagePrompt")}
            </span>
            <select
              value={settings.illustrationTemplateId ?? ""}
              onChange={(event) => update({ illustrationTemplateId: event.target.value || null })}
              className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)]"
            >
              {settings.illustrationTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[0.6875rem] font-medium">
              {localizeUi("ui.agents.storyboard.defaultVideoPrompt")}
            </span>
            <select
              value={settings.videoTemplateId ?? ""}
              onChange={(event) => update({ videoTemplateId: event.target.value || null })}
              className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)]"
            >
              {settings.videoTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <TemplateCollectionEditor
            title={localizeUi("ui.agents.storyboard.imagePrompts")}
            description={localizeUi("ui.agents.storyboard.imagePromptsDescription")}
            templates={settings.illustrationTemplates}
            defaults={defaults.illustrationTemplates}
            prefix="storyboard-image"
            onChange={(templates) => {
              const selected = preserveTemplateSelection(templates, settings.illustrationTemplateId);
              update({ illustrationTemplates: templates, illustrationTemplateId: selected });
            }}
          />
          <TemplateCollectionEditor
            title={localizeUi("ui.agents.storyboard.videoPrompts")}
            description={localizeUi("ui.agents.storyboard.videoPromptsDescription")}
            templates={settings.videoTemplates}
            defaults={defaults.videoTemplates}
            prefix="storyboard-video"
            onChange={(templates) => {
              const selected = preserveTemplateSelection(templates, settings.videoTemplateId);
              update({ videoTemplates: templates, videoTemplateId: selected });
            }}
          />
        </div>
      </StoryboardScopeSection>

      <StoryboardScopeSection
        id="roleplay"
        title={localizeUi("ui.agents.storyboard.roleplayScope")}
        description={localizeUi("ui.agents.storyboard.roleplayScopeDescription")}
      >
        <label className="grid gap-2 rounded-xl bg-[var(--secondary)]/55 px-3 py-2.5 ring-1 ring-[var(--border)] sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-center">
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
            className="w-full rounded-lg bg-[var(--background)] px-3 py-2 text-sm tabular-nums ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </label>

        <section className="space-y-3" aria-labelledby="roleplay-storyboard-prompt-library">
          <div className="space-y-0.5">
            <h4 id="roleplay-storyboard-prompt-library" className="text-sm font-semibold text-[var(--foreground)]">
              {localizeUi("ui.agents.storyboard.roleplayPromptLibrary")}
            </h4>
            <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
              {localizeUi("ui.agents.storyboard.roleplayPromptLibraryDescription")}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-[0.6875rem] font-medium">
                {localizeUi("ui.agents.storyboard.roleplayEpisodeContract")}
              </span>
              <select
                value={settings.roleplayEpisodeTemplateId ?? ""}
                onChange={(event) => update({ roleplayEpisodeTemplateId: event.target.value || null })}
                className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)]"
              >
                {settings.roleplayEpisodeTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[0.6875rem] font-medium">
                {localizeUi("ui.agents.storyboard.roleplayVisualStyle")}
              </span>
              <select
                value={settings.roleplayStyleTemplateId ?? ""}
                onChange={(event) => update({ roleplayStyleTemplateId: event.target.value || null })}
                className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)]"
              >
                {settings.roleplayStyleTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[0.6875rem] font-medium">
                {localizeUi("ui.agents.storyboard.roleplayAnimationAddon")}
              </span>
              <select
                value={settings.roleplayAnimationTemplateId ?? ""}
                onChange={(event) => update({ roleplayAnimationTemplateId: event.target.value || null })}
                className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)]"
              >
                {settings.roleplayAnimationTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[0.6875rem] font-medium">
                {localizeUi("ui.agents.storyboard.roleplayOutputContract")}
              </span>
              <select
                value={settings.roleplayOutputTemplateId ?? ""}
                onChange={(event) => update({ roleplayOutputTemplateId: event.target.value || null })}
                className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)]"
              >
                {settings.roleplayOutputTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <TemplateCollectionEditor
              title={localizeUi("ui.agents.storyboard.roleplayEpisodePrompts")}
              description={localizeUi("ui.agents.storyboard.roleplayEpisodePromptsDescription")}
              templates={settings.roleplayEpisodeTemplates}
              defaults={defaults.roleplayEpisodeTemplates}
              prefix="storyboard-roleplay-episode"
              required
              onChange={(templates) => {
                const selected = preserveTemplateSelection(templates, settings.roleplayEpisodeTemplateId);
                update({ roleplayEpisodeTemplates: templates, roleplayEpisodeTemplateId: selected });
              }}
            />
            <TemplateCollectionEditor
              title={localizeUi("ui.agents.storyboard.roleplayStylePrompts")}
              description={localizeUi("ui.agents.storyboard.roleplayStylePromptsDescription")}
              templates={settings.roleplayStyleTemplates}
              defaults={defaults.roleplayStyleTemplates}
              prefix="storyboard-roleplay-style"
              required
              onChange={(templates) => {
                const selected = preserveTemplateSelection(templates, settings.roleplayStyleTemplateId);
                update({ roleplayStyleTemplates: templates, roleplayStyleTemplateId: selected });
              }}
            />
            <TemplateCollectionEditor
              title={localizeUi("ui.agents.storyboard.roleplayAnimationPrompts")}
              description={localizeUi("ui.agents.storyboard.roleplayAnimationPromptsDescription")}
              templates={settings.roleplayAnimationTemplates}
              defaults={defaults.roleplayAnimationTemplates}
              prefix="storyboard-roleplay-animation"
              required
              onChange={(templates) => {
                const selected = preserveTemplateSelection(templates, settings.roleplayAnimationTemplateId);
                update({ roleplayAnimationTemplates: templates, roleplayAnimationTemplateId: selected });
              }}
            />
            <TemplateCollectionEditor
              title={localizeUi("ui.agents.storyboard.roleplayOutputPrompts")}
              description={localizeUi("ui.agents.storyboard.roleplayOutputPromptsDescription")}
              templates={settings.roleplayOutputTemplates}
              defaults={defaults.roleplayOutputTemplates}
              prefix="storyboard-roleplay-output"
              required
              onChange={(templates) => {
                const selected = preserveTemplateSelection(templates, settings.roleplayOutputTemplateId);
                update({ roleplayOutputTemplates: templates, roleplayOutputTemplateId: selected });
              }}
            />
          </div>
        </section>
      </StoryboardScopeSection>

      <StoryboardScopeSection
        id="game"
        title={localizeUi("ui.agents.storyboard.gameScope")}
        description={localizeUi("ui.agents.storyboard.gameScopeDescription")}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-[0.6875rem] font-medium">{localizeUi("ui.agents.storyboard.stillPlanner")}</span>
            <select
              value={settings.illustrationPlannerTemplateId ?? ""}
              onChange={(event) => update({ illustrationPlannerTemplateId: event.target.value || null })}
              className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              {stillPlanners.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[0.6875rem] font-medium">{localizeUi("ui.agents.storyboard.animationPlanner")}</span>
            <select
              value={settings.animationPlannerTemplateId ?? ""}
              onChange={(event) => update({ animationPlannerTemplateId: event.target.value || null })}
              className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              {animationPlanners.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block max-w-sm space-y-1.5">
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

        <p className="rounded-lg bg-[var(--secondary)]/55 px-3 py-2 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
          {localizeUi("ui.agents.storyboard.gamePromptLibraryFollows")}
        </p>
      </StoryboardScopeSection>
    </div>
  );
}
