// ──────────────────────────────────────────────
// UI overhaul: Library > Settings profiles > Image settings
//
// What draws pictures and what it is told when nothing else picks, laid out like the Preset editor: the
// sections as chips along the top, and Styles and Prompts keep their list beside the editor. The page sits in
// the Settings profiles detail pane, which already has the profiles list on its left, so a second left column
// would leave the tables too narrow. Phones get the Preset editor's hub of rows, each opening its own page.
// Everything here applies to every chat; a chat or an agent can still pick its own.
// ──────────────────────────────────────────────
import { lazy, Suspense, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, FileText, Image as ImageIcon, Palette, Ruler, ExternalLink } from "lucide-react";
import { useCapabilityAgentRegistry } from "../../hooks/use-capability-packages";
import { useConnections } from "../../hooks/use-connections";
import { isConnectionFlagTrue } from "../../lib/connection-filters";
import { cn } from "../../lib/utils";
import { useOverhaulMobile } from "../../stores/overhaul.store";
import { useUIStore, type ImageSettingsTab } from "../../stores/ui.store";
import { JobModelRow } from "../connections/ConnectionDefaults";
import type { ConnectionRowData } from "../connections/ConnectionRow";
import { OvEditorHead, OvEyebrow } from "../overhaul/EditorChrome";
import { PromptOverridesEditorBody, PromptTemplateList } from "../panels/settings/PromptOverridesEditor";
import { ToggleSetting } from "../panels/settings/SettingControls";
import { DraftNumberInput } from "../ui/DraftNumberInput";
import { HelpTooltip } from "../ui/HelpTooltip";
import { ImageStyleProfilesEditor, StyleProfileList } from "./ImageStyleControls";
import { useImageCanvases, VIDEO_PROMPT_TEMPLATE_KEYS } from "./image-canvases";

const ConnectionEditor = lazy(() =>
  import("../connections/ConnectionEditor").then((module) => ({ default: module.ConnectionEditor })),
);

const SECTIONS: { id: ImageSettingsTab; icon: ReactNode }[] = [
  { id: "defaults", icon: <ImageIcon /> },
  { id: "styles", icon: <Palette /> },
  { id: "canvases", icon: <Ruler /> },
  { id: "prompts", icon: <FileText /> },
];

export function ImageSettingsPage() {
  const { t } = useTranslation();
  const mobile = useOverhaulMobile();
  const tab = useUIStore((s) => s.imageSettingsTab);
  const setTab = useUIStore((s) => s.setImageSettingsTab);
  const closeProfileDetail = useUIStore((s) => s.closeProfileDetail);
  const styleProfiles = useUIStore((s) => s.imageStyleProfiles);
  const [styleId, setStyleId] = useState<string | null>(null);
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const section = tab ?? "defaults";

  const content = (id: ImageSettingsTab) => (
    <>
      {id === "defaults" && <DefaultsSection />}
      {id === "styles" && <StylesSection selectedId={styleId} onSelect={setStyleId} />}
      {id === "canvases" && <CanvasesSection />}
      {id === "prompts" && <PromptsSection selectedKey={templateKey} onSelect={setTemplateKey} />}
    </>
  );

  if (mobile) {
    return (
      <div
        className="mari-editor-shell ov-preset ovm-preset flex flex-1 flex-col"
        data-component="ImageSettingsPage"
        data-ovm-preset={tab ?? "hub"}
      >
        {tab ? (
          <div className="ovm-drill-page__head">
            <button
              type="button"
              className="ovm-drill-page__back"
              aria-label={t("imageSettings.back")}
              onClick={() => setTab(null)}
            >
              <ChevronLeft size={26} aria-hidden="true" />
            </button>
            <span className="ovm-drill-page__title">{t(`imageSettings.tabs.${tab}`)}</span>
          </div>
        ) : (
          <OvEditorHead
            section="profiles"
            sectionLabel="Settings profiles"
            onBack={closeProfileDetail}
            title={t("imageSettings.title")}
            meta={t("imageSettings.meta")}
          />
        )}
        <div className="ovm-preset__body">
          {tab ? (
            <div className="flex flex-col gap-4 px-1 pb-8">{content(tab)}</div>
          ) : (
            SECTIONS.map((item) => (
              <button key={item.id} type="button" className="ovm-drill-row" onClick={() => setTab(item.id)}>
                <span className="ovm-drill-row__icon">{item.icon}</span>
                <span className="ovm-drill-row__title">{t(`imageSettings.tabs.${item.id}`)}</span>
                <ChevronRight size={16} className="ovm-drill-row__chev" aria-hidden="true" />
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="mari-editor-shell ov-preset flex flex-1 flex-col overflow-hidden"
      data-component="ImageSettingsPage"
    >
      <OvEditorHead
        className="ov-preset__head"
        section="profiles"
        sectionLabel="Settings profiles"
        onBack={closeProfileDetail}
        title={t("imageSettings.title")}
        meta={t("imageSettings.meta")}
      />
      <main className="ov-preset__main flex-1">
        <div className="flex max-w-6xl flex-col gap-4">
          <div className="ov-preset__chips">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn("ov-chip", section === item.id && "is-on")}
                aria-pressed={section === item.id}
                onClick={() => setTab(item.id)}
              >
                {t(`imageSettings.tabs.${item.id}`)}
              </button>
            ))}
          </div>
          {section === "styles" || section === "prompts" ? (
            <div className="grid grid-cols-[clamp(10rem,28%,15rem)_minmax(0,1fr)] gap-4">
              <aside className="flex min-w-0 flex-col">
                <p className="ov-preset__eyebrow !mt-0">
                  {t(section === "styles" ? "imageSettings.styles.profiles" : "imageSettings.prompts.templates")}
                </p>
                {section === "styles" ? (
                  <StyleProfileList value={styleProfiles} selectedId={styleId} onSelect={setStyleId} />
                ) : (
                  <PromptTemplateList
                    excludeKeys={VIDEO_PROMPT_TEMPLATE_KEYS}
                    selectedKey={templateKey}
                    onSelect={setTemplateKey}
                  />
                )}
              </aside>
              <div className="flex min-w-0 flex-col gap-4">{content(section)}</div>
            </div>
          ) : (
            content(section)
          )}
        </div>
      </main>
    </div>
  );
}

/** Which pictures use what: the model that draws, and the model that writes the prompt. */
const PICTURES = [
  { key: "illustrator", agent: "illustrator", writer: "writerIllustrator" },
  { key: "selfies", agent: null, writer: "writerSelfies" },
  { key: "gallery", agent: null, writer: "writerNone" },
  { key: "trackerPortraits", agent: "character-tracker", writer: "writerNone" },
] as const;

function DefaultsSection() {
  const { t } = useTranslation();
  const mobile = useOverhaulMobile();
  const connections = (useConnections().data ?? []) as ConnectionRowData[];
  const imagesDefault = connections.find(
    (row) => row.provider === "image_generation" && isConnectionFlagTrue(row.defaultForAgents),
  );
  const openAgentDetail = useUIStore((s) => s.openAgentDetail);
  const setSettingsTab = useUIStore((s) => s.setSettingsTab);
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const autoSave = useUIStore((s) => s.autoSaveGeneratedImagesToGalleries);
  const setAutoSave = useUIStore((s) => s.setAutoSaveGeneratedImagesToGalleries);
  const rule = (key: string, part: "Rule" | "") => t(`imageSettings.defaults.uses.${key}${part}`);
  // An agent that isn't installed opens its install page (AgentEditor swaps it in), so say Install, not Open setup.
  const installedAgents = useCapabilityAgentRegistry().data;
  const agentLinkLabel = (agent: string) =>
    !installedAgents || installedAgents.some((entry) => entry.id === agent)
      ? t("imageSettings.openSetup")
      : t("imageSettings.installAgent");

  return (
    <>
      <section className="flex flex-col gap-2">
        <OvEyebrow>{t("imageSettings.defaults.imagesJob")}</OvEyebrow>
        <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
          {t("imageSettings.defaults.imagesJobHint")}
        </p>
        <JobModelRow jobKey="images" />
      </section>

      <section className="flex flex-col gap-2">
        <OvEyebrow>{t("imageSettings.defaults.whoUses")}</OvEyebrow>
        {mobile ? (
          <div className="flex flex-col">
            {PICTURES.map((picture) => (
              <div key={picture.key} className="border-t border-[var(--border)] py-2 first:border-t-0">
                <p className="text-sm font-medium text-[var(--foreground)]">{rule(picture.key, "")}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t("imageSettings.defaults.drawsWith")}: {rule(picture.key, "Rule")}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t("imageSettings.defaults.promptBy")}: {t(`imageSettings.defaults.${picture.writer}`)}
                </p>
                {picture.agent && (
                  <button
                    type="button"
                    className="mt-1 text-xs text-[var(--primary)]"
                    onClick={() => openAgentDetail(picture.agent!)}
                  >
                    {agentLinkLabel(picture.agent)}
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="ov-table-wrap">
            <table className="ov-table" data-image-settings-table="pictures">
              <thead>
                <tr>
                  <th>{t("imageSettings.defaults.picture")}</th>
                  <th>{t("imageSettings.defaults.drawsWith")}</th>
                  <th>{t("imageSettings.defaults.promptBy")}</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {PICTURES.map((picture) => (
                  <tr
                    key={picture.key}
                    className={picture.agent ? undefined : "!cursor-default"}
                    onClick={picture.agent ? () => openAgentDetail(picture.agent!) : undefined}
                  >
                    <td className="font-medium !whitespace-normal text-[var(--foreground)]">{rule(picture.key, "")}</td>
                    <td className="!whitespace-normal">{rule(picture.key, "Rule")}</td>
                    <td className="!whitespace-normal">{t(`imageSettings.defaults.${picture.writer}`)}</td>
                    <td className="w-8 text-end">
                      {picture.agent ? (
                        // The row's click for the keyboard (QC panel 3 AX17); the row click stays for the mouse.
                        <button
                          type="button"
                          className="ov-table__open inline-flex rounded p-0.5 text-[var(--muted-foreground)]"
                          aria-label={agentLinkLabel(picture.agent)}
                          onClick={(event) => {
                            event.stopPropagation();
                            openAgentDetail(picture.agent!);
                          }}
                        >
                          <ChevronRight size={14} aria-hidden="true" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {imagesDefault && (
        <section className="flex flex-col gap-2">
          <OvEyebrow>
            {t("imageSettings.defaults.modelOptions", { name: imagesDefault.name || imagesDefault.model })}
          </OvEyebrow>
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
            {t("imageSettings.defaults.modelOptionsHint")}
          </p>
          <Suspense fallback={null}>
            <ConnectionEditor key={imagesDefault.id} connectionId={imagesDefault.id} part="imageDefaults" />
          </Suspense>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <OvEyebrow>{t("imageSettings.defaults.saving")}</OvEyebrow>
        <ToggleSetting
          label={t("settings.controls.autoSaveGeneratedImagesToGalleries.label")}
          help={t("settings.controls.autoSaveGeneratedImagesToGalleries.help")}
          checked={autoSave}
          onChange={setAutoSave}
        />
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-[var(--muted-foreground)]">
          {t("imageSettings.defaults.generationsNote")}
          <button
            type="button"
            onClick={() => {
              setSettingsTab("generations");
              openRightPanel("settings");
            }}
            className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline"
          >
            {t("imageSettings.defaults.openGenerations")}
            <ExternalLink size="0.6875rem" aria-hidden />
          </button>
        </p>
      </section>
    </>
  );
}

function StylesSection({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const { t } = useTranslation();
  const profiles = useUIStore((s) => s.imageStyleProfiles);
  const setProfiles = useUIStore((s) => s.setImageStyleProfiles);
  return (
    <>
      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
        {t("imageSettings.styles.intro")} {t("imageSettings.styles.order")}
      </p>
      <ImageStyleProfilesEditor
        value={profiles}
        onChange={setProfiles}
        selectedId={selectedId}
        onSelect={onSelect}
        hideList
      />
    </>
  );
}

function CanvasesSection() {
  const { t } = useTranslation();
  const mobile = useOverhaulMobile();
  const canvases = useImageCanvases();
  const input =
    "w-20 min-w-0 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs text-[var(--foreground)]";
  return (
    <>
      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{t("imageSettings.canvases.intro")}</p>
      {mobile ? (
        // Phones and tablets: the overhaul's phone table shows only its first column, so each size is a row.
        <div className="flex flex-col">
          {canvases.map((canvas) => {
            const label = t(canvas.labelKey);
            return (
              <div
                key={canvas.id}
                id={`image-canvas-${canvas.id}`}
                className="flex min-h-12 items-center gap-2 border-t border-[var(--border)] py-1.5 text-sm text-[var(--foreground)] first:border-t-0"
              >
                <span className="inline-flex min-w-0 flex-1 items-center gap-1">
                  {label}
                  <HelpTooltip text={t(canvas.helpKey)} />
                </span>
                <DraftNumberInput
                  value={canvas.width}
                  ariaLabel={t("settings.imageDimensions.width", { label })}
                  min={64}
                  max={4096}
                  commitOnValidChange
                  onCommit={(width) => canvas.set(width, canvas.height)}
                  className={input}
                />
                <span aria-hidden="true">×</span>
                <DraftNumberInput
                  value={canvas.height}
                  ariaLabel={t("settings.imageDimensions.height", { label })}
                  min={64}
                  max={4096}
                  commitOnValidChange
                  onCommit={(height) => canvas.set(canvas.width, height)}
                  className={input}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="ov-table-wrap">
          <table className="ov-table" data-image-settings-table="canvases">
            <thead>
              <tr>
                <th>{t("imageSettings.defaults.picture")}</th>
                <th>{t("imageSettings.canvases.width")}</th>
                <th>{t("imageSettings.canvases.height")}</th>
              </tr>
            </thead>
            <tbody>
              {canvases.map((canvas) => {
                const label = t(canvas.labelKey);
                return (
                  <tr key={canvas.id} id={`image-canvas-${canvas.id}`} className="!cursor-default">
                    <td className="w-full !whitespace-normal text-[var(--foreground)]">
                      <span className="inline-flex items-center gap-1">
                        {label}
                        <HelpTooltip text={t(canvas.helpKey)} />
                      </span>
                    </td>
                    <td className="text-center">
                      <DraftNumberInput
                        value={canvas.width}
                        ariaLabel={t("settings.imageDimensions.width", { label })}
                        min={64}
                        max={4096}
                        commitOnValidChange
                        onCommit={(width) => canvas.set(width, canvas.height)}
                        className={input}
                      />
                    </td>
                    <td className="text-center">
                      <DraftNumberInput
                        value={canvas.height}
                        ariaLabel={t("settings.imageDimensions.height", { label })}
                        min={64}
                        max={4096}
                        commitOnValidChange
                        onCommit={(height) => canvas.set(canvas.width, height)}
                        className={input}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
        {t("imageSettings.canvases.spritesNote")}
      </p>
    </>
  );
}

function PromptsSection({ selectedKey, onSelect }: { selectedKey: string | null; onSelect: (key: string) => void }) {
  const { t } = useTranslation();
  return (
    <>
      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{t("imageSettings.prompts.intro")}</p>
      <PromptOverridesEditorBody
        split
        hideList
        excludeKeys={VIDEO_PROMPT_TEMPLATE_KEYS}
        preferredKey="conversation.selfie"
        selectedKey={selectedKey}
        onSelectKey={onSelect}
      />
    </>
  );
}
