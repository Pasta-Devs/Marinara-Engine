// Image settings: one window for what draws pictures and what it is told when nothing else picks. Opened from
// Connections > Jobs > Images, Settings > Generations and the "Next image in this chat" summary. The tabs hold the
// Images job and who follows it, the style profiles, the size each kind of picture asks for, and the prompt templates.
import { lazy, Suspense, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { useConnections } from "../../hooks/use-connections";
import { isConnectionFlagTrue } from "../../lib/connection-filters";
import { useUIStore, type ImageSettingsTab } from "../../stores/ui.store";
import { JobModelRow } from "../connections/ConnectionDefaults";
import type { ConnectionRowData } from "../connections/ConnectionRow";
import { PromptOverridesEditorBody } from "../panels/settings/PromptOverridesEditor";
import { ToggleSetting } from "../panels/settings/SettingControls";
import { Modal } from "../ui/Modal";
import { Tabs } from "../ui/Tabs";
import { ImageDimensionRow, ImageStyleProfilesEditor } from "./ImageStyleControls";
import { useImageCanvases, VIDEO_PROMPT_TEMPLATE_KEYS } from "./image-canvases";

const ConnectionEditor = lazy(() =>
  import("../connections/ConnectionEditor").then((module) => ({ default: module.ConnectionEditor })),
);

const TABS: ImageSettingsTab[] = ["defaults", "styles", "canvases", "prompts"];

export function ImageSettingsWindow() {
  const { t } = useTranslation();
  const tab = useUIStore((s) => s.imageSettingsTab);
  const openImageSettings = useUIStore((s) => s.openImageSettings);
  const close = useUIStore((s) => s.closeImageSettings);
  if (!tab) return null;
  return (
    <Modal
      open
      onClose={close}
      title={t("imageSettings.title")}
      width="max-w-4xl"
      mobileFullscreen
      dataComponent="ImageSettingsWindow"
      // The tabs stay put while a long tab scrolls under them.
      contentClassName="flex min-h-0 flex-col gap-3 !overflow-hidden"
    >
      <Tabs
        variant="underline"
        label={t("imageSettings.title")}
        idPrefix="image-settings"
        items={TABS.map((id) => ({ id, label: t(`imageSettings.tabs.${id}`) }))}
        value={tab}
        onChange={openImageSettings}
      />
      <div
        role="tabpanel"
        id={`image-settings-panel-${tab}`}
        aria-labelledby={`image-settings-tab-${tab}`}
        className="-me-2 min-h-0 flex-1 overflow-y-auto overscroll-contain pe-2"
      >
        {tab === "defaults" && <DefaultsTab />}
        {tab === "styles" && <StylesTab />}
        {tab === "canvases" && <CanvasesTab />}
        {tab === "prompts" && <PromptsTab />}
      </div>
    </Modal>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-[var(--border)] p-3">
      <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{title}</h3>
      {hint && <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{hint}</p>}
      {children}
    </section>
  );
}

/** One feature and the rule it follows, with a jump to where it is set. */
function RuleRow({ name, rule, onOpen }: { name: string; rule: string; onOpen?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-[var(--border)] py-1.5 first:border-t-0">
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--foreground)]">{name}</p>
        <p className="text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">{rule}</p>
      </div>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="mari-chrome-control mari-chrome-control--small text-[0.6875rem]"
        >
          {t("imageSettings.open")}
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

function DefaultsTab() {
  const { t } = useTranslation();
  const connections = (useConnections().data ?? []) as ConnectionRowData[];
  const imagesDefault = connections.find(
    (row) => row.provider === "image_generation" && isConnectionFlagTrue(row.defaultForAgents),
  );
  const openAgentDetail = useUIStore((s) => s.openAgentDetail);
  const close = useUIStore((s) => s.closeImageSettings);
  const setSettingsTab = useUIStore((s) => s.setSettingsTab);
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const autoSave = useUIStore((s) => s.autoSaveGeneratedImagesToGalleries);
  const setAutoSave = useUIStore((s) => s.setAutoSaveGeneratedImagesToGalleries);
  const openAgent = (agentType: string) => () => {
    close();
    openAgentDetail(agentType);
  };
  return (
    <div className="flex flex-col gap-3">
      <Section title={t("imageSettings.defaults.imagesJob")} hint={t("imageSettings.defaults.imagesJobHint")}>
        <JobModelRow jobKey="images" />
      </Section>

      <Section title={t("imageSettings.defaults.whoUses")}>
        <div className="flex flex-col">
          <RuleRow
            name={t("imageSettings.defaults.uses.illustrator")}
            rule={t("imageSettings.defaults.uses.illustratorRule")}
            onOpen={openAgent("illustrator")}
          />
          <RuleRow
            name={t("imageSettings.defaults.uses.selfies")}
            rule={t("imageSettings.defaults.uses.selfiesRule")}
          />
          <RuleRow
            name={t("imageSettings.defaults.uses.gallery")}
            rule={t("imageSettings.defaults.uses.galleryRule")}
          />
          <RuleRow
            name={t("imageSettings.defaults.uses.trackerPortraits")}
            rule={t("imageSettings.defaults.uses.trackerPortraitsRule")}
            onOpen={openAgent("character-tracker")}
          />
        </div>
      </Section>

      <Section title={t("imageSettings.defaults.writer")} hint={t("imageSettings.defaults.writerHint")}>
        <div className="flex flex-col">
          <RuleRow
            name={t("imageSettings.defaults.uses.illustrator")}
            rule={t("imageSettings.defaults.writerIllustrator")}
            onOpen={openAgent("illustrator")}
          />
          <RuleRow name={t("imageSettings.defaults.uses.selfies")} rule={t("imageSettings.defaults.writerSelfies")} />
        </div>
      </Section>

      {imagesDefault && (
        <Section
          title={t("imageSettings.defaults.modelOptions", { name: imagesDefault.name || imagesDefault.model })}
          hint={t("imageSettings.defaults.modelOptionsHint")}
        >
          <Suspense fallback={null}>
            <ConnectionEditor key={imagesDefault.id} connectionId={imagesDefault.id} part="imageDefaults" />
          </Suspense>
        </Section>
      )}

      <Section title={t("imageSettings.defaults.saving")}>
        <ToggleSetting
          label={t("settings.controls.autoSaveGeneratedImagesToGalleries.label")}
          help={t("settings.controls.autoSaveGeneratedImagesToGalleries.help")}
          checked={autoSave}
          onChange={setAutoSave}
        />
      </Section>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-[var(--muted-foreground)]">
        {t("imageSettings.defaults.generationsNote")}
        <button
          type="button"
          onClick={() => {
            close();
            setSettingsTab("generations");
            openRightPanel("settings");
          }}
          className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline"
        >
          {t("imageSettings.defaults.openGenerations")}
          <ExternalLink size="0.6875rem" aria-hidden />
        </button>
      </p>
    </div>
  );
}

function StylesTab() {
  const { t } = useTranslation();
  const profiles = useUIStore((s) => s.imageStyleProfiles);
  const setProfiles = useUIStore((s) => s.setImageStyleProfiles);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{t("imageSettings.styles.intro")}</p>
      <p className="rounded-lg bg-[var(--secondary)]/55 px-2.5 py-2 text-[0.6875rem] leading-relaxed text-[var(--foreground)] ring-1 ring-[var(--border)]">
        {t("imageSettings.styles.order")}
      </p>
      <ImageStyleProfilesEditor value={profiles} onChange={setProfiles} />
    </div>
  );
}

function CanvasesTab() {
  const { t } = useTranslation();
  const canvases = useImageCanvases();
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{t("imageSettings.canvases.intro")}</p>
      <div className="flex flex-col rounded-xl border border-[var(--border)] px-3 py-1">
        {canvases.map((canvas) => (
          <ImageDimensionRow
            key={canvas.id}
            controlId={canvas.id}
            label={t(canvas.labelKey)}
            help={t(canvas.helpKey)}
            width={canvas.width}
            height={canvas.height}
            onCommit={canvas.set}
          />
        ))}
      </div>
      <p className="text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
        {t("imageSettings.canvases.spritesNote")}
      </p>
    </div>
  );
}

function PromptsTab() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{t("imageSettings.prompts.intro")}</p>
      <PromptOverridesEditorBody split excludeKeys={VIDEO_PROMPT_TEMPLATE_KEYS} preferredKey="conversation.selfie" />
    </div>
  );
}
