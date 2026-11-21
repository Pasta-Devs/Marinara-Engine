// The image style profiles editor and one picture kind's size row, shared by the Image settings window.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  DEFAULT_IMAGE_STYLE_PROFILES,
  compileImagePrompt,
  createImageStyleProfileId,
  normalizeImageStyleProfileSettings,
  type ImagePromptKind,
  type ImagePromptMode,
  type ImageStyleProfile,
  type ImageStyleProfileSettings,
} from "@marinara-engine/shared";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { SETTINGS_BUTTON_CLASS } from "../panels/settings/SettingControls";
import { DraftNumberInput } from "../ui/DraftNumberInput";
import { HelpTooltip } from "../ui/HelpTooltip";
import { Select } from "../ui/Select";
import { Tabs } from "../ui/Tabs";

const IMAGE_STYLE_SUBJECT_KINDS: ImagePromptKind[] = [
  "avatar",
  "portrait",
  "selfie",
  "background",
  "illustration",
  "sprite",
];
const IMAGE_PROMPT_MODE_OPTIONS: Array<{ value: ImagePromptMode; label: string }> = [
  { value: "hybrid", label: "Hybrid" },
  { value: "danbooru", label: "Danbooru tags" },
  { value: "tagged", label: "Tags" },
  { value: "natural", label: "Natural language" },
];

export function ImageDimensionRow({
  label,
  help,
  width,
  height,
  onCommit,
  controlId,
}: {
  label: string;
  help: string;
  width: number;
  height: number;
  onCommit: (width: number, height: number) => void;
  controlId?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div
      id={controlId ? `image-canvas-${controlId}` : undefined}
      className="grid scroll-mt-3 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-[var(--border)] py-1.5 first:border-t-0"
    >
      <div className="min-w-0">
        <div className="inline-flex items-center gap-1 text-xs font-medium text-[var(--foreground)]">
          {label}
          <HelpTooltip text={help} />
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 w-40">
        <DraftNumberInput
          value={width}
          ariaLabel={localizeUi("settings.imageDimensions.width", { label })}
          min={64}
          max={4096}
          commitOnValidChange
          onCommit={(nextWidth) => onCommit(nextWidth, height)}
          className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs"
        />
        <span className="text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.panels.imagedimensionrow.x")}
        </span>
        <DraftNumberInput
          value={height}
          ariaLabel={localizeUi("settings.imageDimensions.height", { label })}
          min={64}
          max={4096}
          commitOnValidChange
          onCommit={(nextHeight) => onCommit(width, nextHeight)}
          className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs"
        />
      </div>
    </div>
  );
}

export function ImageStyleProfilesEditor({
  value,
  onChange,
}: {
  value: ImageStyleProfileSettings;
  onChange: (settings: ImageStyleProfileSettings) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const settings = normalizeImageStyleProfileSettings(value);
  const [selectedId, setSelectedId] = useState(settings.defaultProfileId);
  const [previewKind, setPreviewKind] = useState<ImagePromptKind>("portrait");
  const [part, setPart] = useState<"general" | "perImage" | "testBench">("general");
  const [tagKind, setTagKind] = useState<ImagePromptKind>("illustration");
  const [previewPrompt, setPreviewPrompt] = useState(
    "Create a portrait of Mira, anime style, best quality, high quality, detailed eyes. Avoid blurry, text, watermark. no extra fingers",
  );
  const selected = settings.profiles.find((profile) => profile.id === selectedId) ?? settings.profiles[0]!;
  const preview = useMemo(
    () =>
      compileImagePrompt({
        kind: previewKind,
        prompt: previewPrompt,
        styleProfiles: { ...settings, defaultProfileId: selected.id },
        styleProfileId: selected.id,
      }),
    [previewKind, previewPrompt, selected.id, settings],
  );
  const cleanupCount =
    preview.diagnostics.removedPositiveDuplicates.length +
    preview.diagnostics.removedNegativeDuplicates.length +
    preview.diagnostics.movedNegativeFragments.length;

  useEffect(() => {
    if (!settings.profiles.some((profile) => profile.id === selectedId)) {
      setSelectedId(settings.defaultProfileId);
    }
  }, [selectedId, settings.defaultProfileId, settings.profiles]);

  const commit = useCallback(
    (next: ImageStyleProfileSettings) => {
      onChange(normalizeImageStyleProfileSettings(next));
    },
    [onChange],
  );

  const updateSelected = useCallback(
    (patch: Partial<ImageStyleProfile>) => {
      commit({
        ...settings,
        profiles: settings.profiles.map((profile) =>
          profile.id === selected.id ? { ...profile, ...patch, id: selected.id } : profile,
        ),
      });
    },
    [commit, selected.id, settings],
  );

  const updateSubjectTags = useCallback(
    (kind: ImagePromptKind, tags: string) => {
      updateSelected({ subjectTags: { ...selected.subjectTags, [kind]: tags } });
    },
    [selected.subjectTags, updateSelected],
  );

  const cloneSelected = useCallback(() => {
    const id = createImageStyleProfileId(selected.id, settings.profiles);
    const clone = { ...selected, id, name: `${selected.name} Custom`, builtIn: false };
    commit({ ...settings, profiles: [...settings.profiles, clone], defaultProfileId: id });
    setSelectedId(id);
  }, [commit, selected, settings]);

  const resetSelected = useCallback(() => {
    const builtIn = DEFAULT_IMAGE_STYLE_PROFILES.find((profile) => profile.id === selected.id);
    if (!builtIn) return;
    commit({
      ...settings,
      profiles: settings.profiles.map((profile) => (profile.id === selected.id ? { ...builtIn } : profile)),
    });
  }, [commit, selected.id, settings]);

  const deleteSelected = useCallback(() => {
    if (selected.builtIn || settings.profiles.length <= 1) return;
    const profiles = settings.profiles.filter((profile) => profile.id !== selected.id);
    const defaultProfileId = settings.defaultProfileId === selected.id ? profiles[0]!.id : settings.defaultProfileId;
    commit({ profiles, defaultProfileId });
    setSelectedId(defaultProfileId);
  }, [commit, selected.builtIn, selected.id, settings]);

  const setDefaultProfileId = useCallback(
    (defaultProfileId: string) => {
      commit({ ...settings, defaultProfileId });
    },
    [commit, settings],
  );

  const label = "mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]";
  const field = "w-full rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 text-xs";
  const area =
    "w-full resize-y rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-2 text-xs leading-relaxed";
  const isDefault = selected.id === settings.defaultProfileId;

  // The profiles as a list beside the selected one's editor; its parts sit under General, Per-image tags and Test bench.
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(10rem,13rem)_minmax(0,1fr)]">
      {/* Phones and tablets: a dropdown instead of the long list. */}
      <div className="flex items-end gap-2 md:hidden">
        <div className="min-w-0 flex-1">
          <span className={label}>{localizeUi("imageSettings.styles.profiles")}</span>
          <Select
            value={selected.id}
            options={settings.profiles.map((profile) => ({
              value: profile.id,
              label:
                profile.id === settings.defaultProfileId
                  ? `${profile.name} (${localizeUi("imageSettings.styles.default")})`
                  : profile.name,
            }))}
            onChange={setSelectedId}
            label={localizeUi("imageSettings.styles.profiles")}
            className={cn(field, "h-11")}
          />
        </div>
        <button type="button" onClick={cloneSelected} className={cn(SETTINGS_BUTTON_CLASS, "!min-h-11")}>
          <Plus size="0.75rem" aria-hidden />
          {localizeUi("ui.panels.imagestyleprofileseditor.clone")}
        </button>
      </div>
      <nav
        aria-label={localizeUi("imageSettings.styles.profiles")}
        data-style-profile-list
        className="hidden min-w-0 flex-col md:flex md:max-h-[min(34rem,60vh)] md:overflow-y-auto md:pe-1"
      >
        <p className="px-2 pb-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          {localizeUi("imageSettings.styles.profiles")}
        </p>
        {settings.profiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            onClick={() => setSelectedId(profile.id)}
            aria-current={profile.id === selected.id ? "true" : undefined}
            className={cn(
              "flex min-h-8 items-center gap-2 rounded-md px-2 text-start text-xs transition-colors",
              profile.id === selected.id
                ? "bg-[var(--primary)]/12 text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]",
            )}
          >
            <span className="min-w-0 flex-1 truncate">{profile.name}</span>
            {profile.id === settings.defaultProfileId && (
              <span className="shrink-0 rounded-full bg-[var(--primary)]/15 px-1.5 py-px text-[0.5625rem] font-semibold text-[var(--primary)]">
                {localizeUi("imageSettings.styles.default")}
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={cloneSelected}
          className="mt-1 flex min-h-8 items-center gap-2 rounded-md px-2 text-start text-xs text-[var(--primary)] transition-colors hover:bg-[var(--secondary)]"
        >
          <Plus size="0.75rem" aria-hidden />
          {localizeUi("imageSettings.styles.newFrom", { name: selected.name })}
        </button>
      </nav>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {isDefault ? (
            <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
              {localizeUi("imageSettings.styles.isDefault")}
            </span>
          ) : (
            <button type="button" onClick={() => setDefaultProfileId(selected.id)} className={SETTINGS_BUTTON_CLASS}>
              {localizeUi("imageSettings.styles.makeDefault")}
            </button>
          )}
          <span className="flex-1" />
          <button
            type="button"
            onClick={resetSelected}
            disabled={!selected.builtIn}
            className={cn(SETTINGS_BUTTON_CLASS, "ovm-risky")}
          >
            <RotateCcw size="0.75rem" />
            {localizeUi("ui.panels.imagestyleprofileseditor.reset")}
          </button>
          <button
            type="button"
            onClick={() => {
              void showConfirmDialog({
                title: localizeUi("lorebook.editor.batch.delete"),
                message: localizeUi("ui.chat.gameprompttemplateselect.value1", { value1: selected.name }),
                confirmLabel: localizeUi("lorebook.editor.batch.delete"),
                cancelLabel: localizeUi("chat.delete.dialog.cancel"),
              }).then((confirmed) => {
                if (confirmed) deleteSelected();
              });
            }}
            disabled={selected.builtIn || settings.profiles.length <= 1}
            className={cn(SETTINGS_BUTTON_CLASS, "mari-chrome-control--danger ovm-risky")}
          >
            <Trash2 size="0.75rem" />
            {localizeUi("lorebook.editor.batch.delete")}
          </button>
        </div>

        <Tabs
          variant="underline"
          label={selected.name}
          items={[
            { id: "general", label: localizeUi("imageSettings.styles.general") },
            { id: "perImage", label: localizeUi("ui.panels.imagestyleprofileseditor.perImageTags") },
            { id: "testBench", label: localizeUi("ui.panels.imagestyleprofileseditor.testBench") },
          ]}
          value={part}
          onChange={setPart}
        />

        {part === "general" && (
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="min-w-0">
                <span className={label}>{localizeUi("ui.panels.imagestyleprofileseditor.name")}</span>
                <input
                  value={selected.name}
                  onChange={(event) => updateSelected({ name: event.target.value })}
                  className={cn(field, "h-9")}
                />
              </label>
              <div className="min-w-0">
                <span className={label}>{localizeUi("ui.panels.imagestyleprofileseditor.promptGrammar")}</span>
                <Select
                  value={selected.promptMode}
                  options={[
                    { value: "off", label: localizeUi("ui.panels.imagestyleprofileseditor.promptGrammarOff") },
                    ...IMAGE_PROMPT_MODE_OPTIONS,
                  ]}
                  onChange={(promptMode) => updateSelected({ promptMode })}
                  label={localizeUi("ui.panels.imagestyleprofileseditor.promptGrammar")}
                  className={cn(field, "h-9")}
                />
              </div>
            </div>
            {selected.promptMode === "off" && (
              <p className="-mt-1.5 text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.panels.imagestyleprofileseditor.promptGrammarOffHelp")}
              </p>
            )}
            <label className="block">
              <span className={label}>{localizeUi("ui.panels.imagestyleprofileseditor.styleText")}</span>
              <textarea
                value={selected.styleText}
                onChange={(event) => updateSelected({ styleText: event.target.value })}
                className={cn(area, "min-h-16")}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={label}>{localizeUi("ui.panels.imagestyleprofileseditor.positiveTags")}</span>
                <textarea
                  value={selected.positiveTags}
                  onChange={(event) => updateSelected({ positiveTags: event.target.value })}
                  className={cn(area, "min-h-24")}
                />
              </label>
              <label className="block">
                <span className={label}>{localizeUi("ui.panels.imagestyleprofileseditor.negativeTags")}</span>
                <textarea
                  value={selected.negativeTags}
                  onChange={(event) => updateSelected({ negativeTags: event.target.value })}
                  className={cn(area, "min-h-24")}
                />
              </label>
            </div>
          </div>
        )}

        {part === "perImage" && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-[var(--muted-foreground)]">{localizeUi("imageSettings.styles.perImageHint")}</p>
            <div className="min-w-0 sm:max-w-xs">
              <span className={label}>{localizeUi("ui.panels.imagestyleprofileseditor.imageKind")}</span>
              <Select
                value={tagKind}
                options={IMAGE_STYLE_SUBJECT_KINDS.map((kind) => ({
                  value: kind,
                  label: localizeUi(`imageSettings.kinds.${kind}`),
                }))}
                onChange={setTagKind}
                label={localizeUi("ui.panels.imagestyleprofileseditor.imageKind")}
                className={cn(field, "h-9")}
              />
            </div>
            <textarea
              aria-label={localizeUi(`imageSettings.kinds.${tagKind}`)}
              value={selected.subjectTags[tagKind] ?? ""}
              onChange={(event) => updateSubjectTags(tagKind, event.target.value)}
              className={cn(area, "min-h-24")}
            />
          </div>
        )}

        {part === "testBench" && (
          <div className="grid gap-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-2">
              <div className="block">
                <span className={label}>{localizeUi("ui.panels.imagestyleprofileseditor.imageKind")}</span>
                <Select
                  value={previewKind}
                  options={IMAGE_STYLE_SUBJECT_KINDS.map((kind) => ({
                    value: kind,
                    label: localizeUi(`imageSettings.kinds.${kind}`),
                  }))}
                  onChange={setPreviewKind}
                  label={localizeUi("ui.panels.imagestyleprofileseditor.imageKind")}
                  className={cn(field, "h-9")}
                />
              </div>
              <label className="block">
                <span className={label}>{localizeUi("ui.panels.imagestyleprofileseditor.sampleInput")}</span>
                <textarea
                  value={previewPrompt}
                  onChange={(event) => setPreviewPrompt(event.target.value)}
                  className={cn(area, "min-h-32 font-mono")}
                  spellCheck={false}
                />
              </label>
              <div className="text-[0.625rem] text-[var(--muted-foreground)]">
                {cleanupCount > 0
                  ? localizeUi("ui.panels.imagestyleprofileseditor.value1DuplicateOrMisplacedFragmentValue2Cleaned", {
                      value1: cleanupCount,
                      value2: cleanupCount === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
                    })
                  : localizeUi("ui.panels.imagestyleprofileseditor.noCleanupNeededForThisSample")}
              </div>
            </div>
            <div className="grid gap-2">
              <label className="block">
                <span className={label}>{localizeUi("ui.panels.imagestyleprofileseditor.finalPositivePrompt")}</span>
                <textarea
                  value={preview.prompt}
                  readOnly
                  className={cn(area, "min-h-32 font-mono")}
                  spellCheck={false}
                />
              </label>
              <label className="block">
                <span className={label}>{localizeUi("ui.panels.imagestyleprofileseditor.finalNegativePrompt")}</span>
                <textarea
                  value={preview.negativePrompt}
                  readOnly
                  className={cn(area, "min-h-20 font-mono")}
                  spellCheck={false}
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
