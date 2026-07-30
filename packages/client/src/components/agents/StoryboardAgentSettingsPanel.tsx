import { Plus, RotateCcw, Trash2, Video, ImageIcon, PanelsTopLeft } from "lucide-react";
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

function TemplateCollectionEditor({
  title,
  description,
  templates,
  defaults,
  prefix,
  onChange,
}: {
  title: string;
  description: string;
  templates: AgentPromptTemplateOption[];
  defaults: AgentPromptTemplateOption[];
  prefix: string;
  onChange: (templates: AgentPromptTemplateOption[]) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const defaultsById = new Map(defaults.map((template) => [template.id, template]));
  const update = (id: string, patch: Partial<AgentPromptTemplateOption>) => {
    onChange(templates.map((template) => (template.id === id ? { ...template, ...patch } : template)));
  };

  return (
    <div className="space-y-3 rounded-xl bg-[var(--secondary)]/55 p-3 ring-1 ring-[var(--border)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-[var(--foreground)]">{title}</p>
          <p className="mt-0.5 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const id = uniqueTemplateId(prefix, templates);
            onChange([
              ...templates,
              {
                id,
                name: localizeUi("ui.agents.storyboard.customPrompt"),
                description: "",
                promptTemplate: "",
              },
            ]);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--background)] px-2.5 py-1.5 text-[0.6875rem] font-medium ring-1 ring-[var(--border)] hover:bg-[var(--accent)]"
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
            className="space-y-2 rounded-xl bg-[var(--background)]/70 p-3 ring-1 ring-[var(--border)]"
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
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--accent)] disabled:opacity-35"
                  title={localizeUi("ui.agents.agenteditor.restoreDefaultPrompt")}
                >
                  <RotateCcw size="0.75rem" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onChange(templates.filter((entry) => entry.id !== template.id))}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                title={localizeUi("ui.agents.agenteditor.removePromptOption")}
              >
                <Trash2 size="0.75rem" />
              </button>
            </div>
            <input
              value={template.description ?? ""}
              onChange={(event) => update(template.id, { description: event.target.value })}
              className="w-full rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder={localizeUi("ui.agents.agenteditor.shortDescriptionShownInChatSettings")}
            />
            <MacroTextarea
              value={template.promptTemplate}
              onChange={(value) => update(template.id, { promptTemplate: value })}
              rows={7}
              title={template.name}
              className="w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 font-mono text-xs leading-relaxed ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
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
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl bg-[var(--secondary)]/55 px-3 py-2.5 ring-1 ring-[var(--border)]">
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
    <div className="space-y-4">
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
      </div>

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
            <option value="">{localizeUi("ui.agents.storyboard.noImageConnection")}</option>
            {imageConnections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.name}
              </option>
            ))}
          </select>
          <span className="block text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            {localizeUi("ui.agents.storyboard.imageConnectionFallbackDescription")}
          </span>
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
            <option value="">{localizeUi("ui.agents.storyboard.noVideoConnection")}</option>
            {videoConnections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.name}
              </option>
            ))}
          </select>
          <span className="block text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            {localizeUi("ui.agents.storyboard.videoConnectionFallbackDescription")}
          </span>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        <label className="space-y-1.5">
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

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-[0.6875rem] font-medium">{localizeUi("ui.agents.storyboard.defaultImagePrompt")}</span>
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
          <span className="text-[0.6875rem] font-medium">{localizeUi("ui.agents.storyboard.defaultVideoPrompt")}</span>
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
            const selected = templates.some((template) => template.id === settings.illustrationTemplateId)
              ? settings.illustrationTemplateId
              : (templates[0]?.id ?? null);
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
            const selected = templates.some((template) => template.id === settings.videoTemplateId)
              ? settings.videoTemplateId
              : (templates[0]?.id ?? null);
            update({ videoTemplates: templates, videoTemplateId: selected });
          }}
        />
      </div>
    </div>
  );
}
