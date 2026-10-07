import { DEFAULT_GENERATION_PARAMS } from "@marinara-engine/shared";
import { GenerationParametersFields, getEditableGenerationParameters } from "../ui/GenerationParametersEditor";
// ──────────────────────────────────────────────
// Full-Page Preset Editor
// Tabs: Overview · Sections · Prompts · Regex
// ──────────────────────────────────────────────
import {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ChangeEvent,
  type FC,
  type ReactNode,
} from "react";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { useUIStore } from "../../stores/ui.store";
import { toast } from "sonner";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { useChatStore } from "../../stores/chat.store";
import { useChat } from "../../hooks/use-chats";
import {
  usePresetFull,
  useUpdatePreset,
  useDeletePreset,
  useDuplicatePreset,
  useCreateSection,
  useUpdateSection,
  useDeleteSection,
  useReorderSections,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useCreateVariable,
  useUpdateVariable,
  useDeleteVariable,
  useReorderVariables,
  useUploadPresetImage,
} from "../../hooks/use-presets";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Save,
  Trash2,
  FileText,
  Settings2,
  Layers,
  Sparkles,
  Plus,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Code2,
  Hash,
  Type,
  Eye,
  EyeOff,
  FolderOpen,
  MessageSquare,
  User,
  Bot,
  X,
  AlertTriangle,
  Copy,
  Camera,
  Loader2,
  Regex,
  Pencil,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { HelpTooltip } from "../ui/HelpTooltip";
import { DraftNumberInput } from "../ui/DraftNumberInput";
import { MacroTextarea } from "../ui/MacroTextarea";
import { applyTextareaQuoteFormat } from "../../lib/textarea-quotes";
import { api } from "../../lib/api-client";
import { useAgentConfigs, type AgentConfigRow } from "../../hooks/use-agents";
import {
  isStockMarinaraUniversalPreset,
  resolveScopedRegexMode,
  type ScopedRegexMode,
  type MarkerType,
  type PromptPreset,
  type PromptSection,
  type WrapFormat,
} from "@marinara-engine/shared";
import { useCapabilityAgentRegistry } from "../../hooks/use-capability-packages";
import { useQuoteFormatter } from "../../hooks/use-quote-formatter";
import { EditorTabNavigation } from "../ui/EditorTabNavigation";
import { useEditorSections } from "../../hooks/use-editor-sections";
import { useEditorLeaveSave } from "../../hooks/use-editor-leave-save";
import { hasEditorLeaveHandler, leaveWithoutSaving } from "../../lib/editor-leave";
import { useTouchFolderDrag } from "../../hooks/use-touch-folder-drag";
import { getTouchReorderDropIndex } from "../../lib/touch-reorder";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import { resolvePresetArtwork } from "../../lib/preset-artwork";
import { useRegexScripts } from "../../hooks/use-regex-scripts";
import { PresetVariablesEditor, reorderIdsByOffset, reorderIdsToGap } from "./PresetVariablesEditor";

// ── Tab definitions ──
const TABS = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "sections", label: "Sections", icon: Layers },
  { id: "prompts", label: "Prompts", icon: MessageSquare },
  { id: "parameters", label: "Parameters", icon: FileText },
  { id: "regex", label: "Regex", icon: Regex },
] as const;
type TabId = (typeof TABS)[number]["id"];

const ROLE_COLORS: Record<string, string> = {
  system: "text-blue-400",
  user: "text-green-400",
  assistant: "mari-chrome-accent-text mari-accent-animated",
};

const ROLE_ICONS: Record<string, FC<{ size: string | number; className?: string }>> = {
  system: Settings2,
  user: User,
  assistant: Bot,
};

const MARKER_LABELS: Record<MarkerType, string> = {
  character: "Character Info",
  lorebook: "Lorebook Marker (All)",
  persona: "Persona",
  chat_history: "Chat History",
  chat_summary: "Chat Summary",
  current_scene_summary: "Current Scene Summary",
  recalled_scenes: "Recalled Scenes",
  recalled_messages: "Recalled Scenes",
  id_macro_cards: "ID Macro Cards",
  world_info_before: "Lorebook Marker (Before)",
  world_info_after: "Lorebook Marker (After)",
  dialogue_examples: "Dialogue Examples",
  agent_data: "Agent Data",
};

function lorebookWarningDismissalKey(presetId: string) {
  return `preset:loreWarning:dismissed:${presetId}`;
}

function readBoolFlag(value: unknown): boolean {
  return value === true || value === "true";
}

function readMarkerConfig(value: unknown) {
  if (!value) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════
//  Main Editor
// ═══════════════════════════════════════════════

export function PresetEditor() {
  const { t: localizeUi } = useUiTranslation();
  const presetDetailId = useUIStore((s) => s.presetDetailId);
  const presetDetailInitialTab = useUIStore((s) => s.presetDetailInitialTab) as TabId | null;
  const closePresetDetail = useUIStore((s) => s.closePresetDetail);
  const openPresetDetail = useUIStore((s) => s.openPresetDetail);
  const activeChatId = useChatStore((s) => s.activeChatId);

  const { data, isLoading } = usePresetFull(presetDetailId);
  const { data: activeChat } = useChat(activeChatId);
  const updatePreset = useUpdatePreset();
  const deletePreset = useDeletePreset();
  const { mutateAsync: duplicatePreset } = useDuplicatePreset();
  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();
  const reorderSections = useReorderSections();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const createVariable = useCreateVariable();
  const updateVariable = useUpdateVariable();
  const deleteVariable = useDeleteVariable();
  const reorderVariables = useReorderVariables();

  const [activeTab, setActiveTab] = useState<TabId>(() => presetDetailInitialTab ?? "overview");
  const { contentRef, scrollToSection } = useEditorSections(
    presetDetailId,
    !!data,
    presetDetailInitialTab ?? "overview",
    setActiveTab,
  );
  useEffect(() => {
    setActiveTab(presetDetailInitialTab ?? "overview");
  }, [presetDetailId, presetDetailInitialTab]);
  const [dirty, setDirty] = useState(false);
  const setEditorDirty = useUIStore((s) => s.setEditorDirty);
  useEffect(() => {
    setEditorDirty(dirty);
  }, [dirty, setEditorDirty]);

  const [showSaved, setShowSaved] = useState(false);
  const [stockCopyError, setStockCopyError] = useState<string | null>(null);
  const [stockCopyPending, setStockCopyPending] = useState(false);

  // Local editable state
  const [localName, setLocalName] = useState("");
  const [localDescription, setLocalDescription] = useState("");
  const [localWrapFormat, setLocalWrapFormat] = useState<WrapFormat>("xml");
  const [localAuthor, setLocalAuthor] = useState("");
  const [localConversationPrompt, setLocalConversationPrompt] = useState("");
  const [localGamePrompt, setLocalGamePrompt] = useState("");
  const [localParameters, setLocalParameters] = useState<Record<string, unknown>>({});
  const [localScopedRegexMode, setLocalScopedRegexMode] = useState<ScopedRegexMode>("disabled");
  const hydratedPresetIdRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const editRevisionRef = useRef(0);
  const formatQuotes = useQuoteFormatter();

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  // Populate local state when data loads
  useEffect(() => {
    if (!data || !presetDetailId) return;
    if (dirtyRef.current && hydratedPresetIdRef.current === presetDetailId) return;
    const p = data.preset as any;
    hydratedPresetIdRef.current = presetDetailId;
    setLocalName(p.name ?? "");
    setLocalDescription(p.description ?? "");
    setLocalWrapFormat((p.wrapFormat ?? "xml") as WrapFormat);
    setLocalAuthor(p.author ?? "");
    setLocalConversationPrompt(p.conversationPrompt ?? "");
    setLocalGamePrompt(p.gamePrompt ?? "");
    try {
      const parameters = typeof p.parameters === "string" ? JSON.parse(p.parameters) : p.parameters;
      setLocalParameters(parameters && typeof parameters === "object" && !Array.isArray(parameters) ? parameters : {});
    } catch {
      setLocalParameters({});
    }
    setLocalScopedRegexMode(resolveScopedRegexMode(p.scopedRegexMode));
  }, [data, presetDetailId]);

  useEffect(() => {
    setStockCopyError(null);
    setStockCopyPending(false);
  }, [presetDetailId]);

  const handleClose = useCallback(() => {
    closePresetDetail();
  }, [closePresetDetail]);

  const handleCreateStockCopy = useCallback(async () => {
    if (!presetDetailId || stockCopyPending) return;
    setStockCopyPending(true);
    setStockCopyError(null);
    try {
      const copy = await duplicatePreset(presetDetailId);
      if (useUIStore.getState().presetDetailId !== presetDetailId) return;
      if (!copy?.id) throw new Error(localizeUi("ui.presets.preseteditor.couldNotCreateEditableCopy"));
      toast.success(localizeUi("ui.presets.preseteditor.createdEditableCopy"));
      openPresetDetail(copy.id, { initialTab: presetDetailInitialTab ?? undefined });
    } catch (error) {
      if (useUIStore.getState().presetDetailId !== presetDetailId) return;
      setStockCopyError(
        error instanceof Error ? error.message : localizeUi("ui.presets.preseteditor.couldNotCreateEditableCopy"),
      );
    } finally {
      if (useUIStore.getState().presetDetailId === presetDetailId) setStockCopyPending(false);
    }
  }, [duplicatePreset, localizeUi, openPresetDetail, presetDetailId, presetDetailInitialTab, stockCopyPending]);

  const handleSave = useCallback(async () => {
    if (!presetDetailId) return false;
    const revision = editRevisionRef.current;
    const payload: { id: string } & Record<string, unknown> = {
      id: presetDetailId,
      name: localName,
      description: localDescription,
      wrapFormat: localWrapFormat,
      author: localAuthor,
      conversationPrompt: localConversationPrompt,
      gamePrompt: localGamePrompt,
      parameters: { ...DEFAULT_GENERATION_PARAMS, ...localParameters },
      scopedRegexMode: localScopedRegexMode,
    };
    await updatePreset.mutateAsync(payload);
    if (editRevisionRef.current !== revision) return false;
    setDirty(false);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 1500);
    return true;
  }, [
    presetDetailId,
    localName,
    localDescription,
    localWrapFormat,
    localAuthor,
    localConversationPrompt,
    localGamePrompt,
    localParameters,
    localScopedRegexMode,
    updatePreset,
  ]);

  const handleExportPreset = useCallback(async () => {
    if (!presetDetailId) return;
    if (dirty) {
      const shouldSave = await showConfirmDialog({
        title: localizeUi("ui.presets.preseteditor.saveBeforeExporting"),
        message: localizeUi("ui.presets.preseteditor.youHaveUnsavedPresetEditsSaveThemBeforeExporting"),
        confirmLabel: localizeUi("ui.presets.preseteditor.saveAndExport"),
        cancelLabel: "Cancel",
      });
      if (!shouldSave) return;
      try {
        await handleSave();
      } catch {
        toast.error(localizeUi("ui.presets.preseteditor.couldNotSavePresetBeforeExport"));
        return;
      }
    }
    api.download(`/prompts/${presetDetailId}/export`);
  }, [dirty, handleSave, presetDetailId, localizeUi]);

  const handleDelete = useCallback(async () => {
    if (!presetDetailId) return;
    if (
      !(await showConfirmDialog({
        title: localizeUi("ui.presets.preseteditor.deletePreset"),
        message: localizeUi("dialog.delete.namedPermanent", {
          name: (data?.preset as { name?: string } | undefined)?.name || localizeUi("chat.toolbar.preset"),
        }),
        confirmLabel: localizeUi("lorebook.editor.batch.delete"),
        tone: "destructive",
      }))
    ) {
      return;
    }
    deletePreset.mutate(presetDetailId, { onSuccess: () => leaveWithoutSaving(closePresetDetail) });
  }, [closePresetDetail, data?.preset, deletePreset, localizeUi, presetDetailId]);

  useEditorLeaveSave(`presetDetailId:${presetDetailId}`, dirty, handleSave, updatePreset.isPending);
  const markDirty = useCallback(() => {
    editRevisionRef.current += 1;
    setDirty(true);
  }, []);

  // Parse sections in order
  const sectionOrder = useMemo(() => {
    if (!data?.preset) return [];
    const p = data.preset as any;
    try {
      return typeof p.sectionOrder === "string" ? JSON.parse(p.sectionOrder) : (p.sectionOrder ?? []);
    } catch {
      return [];
    }
  }, [data]);

  const orderedSections = useMemo(() => {
    if (!data?.sections) return [];
    const map = new Map((data.sections as any[]).map((s) => [s.id, s]));
    return sectionOrder.map((id: string) => map.get(id)).filter(Boolean) as any[];
  }, [data?.sections, sectionOrder]);

  const sectionHasLorebookMarker = useMemo(() => {
    return orderedSections.some((section: any) => {
      if (section.enabled !== "true" && section.enabled !== true) return false;
      if (section.isMarker !== "true" && section.isMarker !== true) return false;
      try {
        const config =
          typeof section.markerConfig === "string" ? JSON.parse(section.markerConfig) : section.markerConfig;
        return (
          config?.type === "lorebook" || config?.type === "world_info_before" || config?.type === "world_info_after"
        );
      } catch {
        return false;
      }
    });
  }, [orderedSections]);
  const parentChatHasLorebook = useMemo(() => {
    try {
      const metadata =
        typeof activeChat?.metadata === "string"
          ? JSON.parse(activeChat.metadata)
          : ((activeChat?.metadata ?? {}) as any);
      return Array.isArray(metadata.activeLorebookIds) && metadata.activeLorebookIds.length > 0;
    } catch {
      return false;
    }
  }, [activeChat?.metadata]);

  const groupMap = useMemo(() => {
    if (!data?.groups) return new Map<string, any>();
    return new Map((data.groups as any[]).map((g) => [g.id, g]));
  }, [data?.groups]);

  const choiceBlocks = useMemo(() => {
    if (!data?.choiceBlocks) return [] as any[];
    return data.choiceBlocks as any[];
  }, [data?.choiceBlocks]);

  if (!presetDetailId) return null;

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="shimmer h-8 w-48 rounded-xl" />
          <div className="shimmer h-4 w-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mari-editor-shell flex flex-1 items-center justify-center">
        <p className="mari-editor-empty px-4 py-3 text-sm">{localizeUi("ui.presets.preseteditor.presetNotFound")}</p>
      </div>
    );
  }

  if (isStockMarinaraUniversalPreset(data.preset)) {
    return (
      <div className="mari-editor-shell flex flex-1 items-center justify-center p-6">
        <div className="mari-editor-panel flex max-w-md flex-col items-center gap-3 p-5 text-center">
          <FileText size="1.5rem" className="text-[var(--primary)]" />
          <h2 className="text-base font-semibold">{data.preset.name}</h2>
          {data.preset.description ? (
            <p className="text-sm text-[var(--marinara-editor-muted)]">{data.preset.description}</p>
          ) : null}
          <p className="text-sm text-[var(--marinara-editor-muted)]">
            {localizeUi("ui.presets.preseteditor.stockPresetReadOnly")}
          </p>
          {stockCopyError ? <p className="text-sm text-[var(--destructive)]">{stockCopyError}</p> : null}
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={closePresetDetail} className="mari-editor-action inline-flex px-3 py-2">
              <ArrowLeft size="0.875rem" />
              {localizeUi("ui.presets.preseteditor.backToPresets")}
            </button>
            <button
              type="button"
              onClick={() => void handleCreateStockCopy()}
              disabled={stockCopyPending}
              className="mari-editor-action mari-editor-action--primary inline-flex px-3 py-2 disabled:opacity-50"
            >
              {stockCopyPending ? <Loader2 size="0.875rem" className="animate-spin" /> : <Copy size="0.875rem" />}
              {localizeUi(
                stockCopyPending
                  ? "ui.presets.preseteditor.creatingEditableCopy"
                  : "ui.presets.preseteditor.createEditableCopy",
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const presetArtwork = resolvePresetArtwork(data.preset);

  return (
    <div className="mari-editor-shell mari-editor-legacy-bridge flex flex-1 flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="mari-editor-header mari-editor-header--with-nav">
        <div className="mari-editor-header-main">
          <button onClick={handleClose} className="mari-editor-action inline-flex">
            <ArrowLeft size="1.125rem" />
          </button>
          <div className="mari-editor-icon-tile mari-panel-gradient-surface mari-panel-gradient--presets overflow-hidden">
            {presetArtwork ? (
              <img src={presetArtwork} alt="" className="h-full w-full object-cover" draggable={false} />
            ) : (
              <FileText size="1.125rem" className="max-md:!h-[0.875rem] max-md:!w-[0.875rem]" />
            )}
          </div>
          <input
            value={localName}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              setLocalName(e.target.value);
              markDirty();
            }}
            className="mari-editor-title-input min-w-0 flex-1 placeholder:text-[var(--marinara-editor-muted)]"
            placeholder={localizeUi("ui.presets.preseteditor.presetName")}
          />
        </div>

        <EditorTabNavigation tabs={TABS} activeId={activeTab} onChange={scrollToSection} />

        <div className="mari-editor-actions flex">
          <button
            onClick={handleSave}
            disabled={updatePreset.isPending}
            className="mari-editor-action mari-editor-action--primary inline-flex disabled:opacity-50"
            aria-label={localizeUi("ui.noodle.noodlehome.save")}
            title={localizeUi("ui.noodle.noodlehome.save")}
          >
            <Save size="0.8125rem" />
            <span className="mari-editor-save-label">{localizeUi("ui.noodle.noodlehome.save")}</span>
          </button>
          <button
            onClick={handleExportPreset}
            className="mari-editor-action inline-flex"
            title={
              dirty
                ? localizeUi("ui.presets.preseteditor.saveCurrentEditsBeforeExporting")
                : localizeUi("ui.presets.preseteditor.exportPreset")
            }
          >
            <svg
              width="0.9375rem"
              height="0.9375rem"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 13V3m0 0l-4 4m4-4l4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="3" y="15" width="14" height="2" rx="1" fill="currentColor" />
            </svg>
          </button>
          <button onClick={handleDelete} className="mari-editor-action inline-flex">
            <Trash2 size="0.9375rem" />
          </button>
        </div>
      </div>

      {/* Saved toast */}
      {showSaved && (
        <div className="absolute left-1/2 top-14 z-50 -translate-x-1/2 animate-fade-in-up rounded-lg border border-[var(--marinara-editor-accent)]/30 bg-[var(--marinara-editor-accent)]/15 px-3 py-1.5 text-xs font-medium text-[var(--marinara-editor-accent)] shadow-lg backdrop-blur-sm">
          {localizeUi("ui.presets.preseteditor.changesSaved")}
        </div>
      )}

      {/* ── Body ── */}
      <div className="mari-editor-body">
        {/* Content area */}
        <div ref={contentRef} className="mari-editor-content @max-5xl:p-4">
          <div className="mari-editor-content-inner space-y-6">
            <section data-editor-section="overview">
              <OverviewTab
                preset={data.preset}
                name={localName}
                onNameChange={(v) => {
                  setLocalName(v);
                  markDirty();
                }}
                description={localDescription}
                onDescriptionChange={(v) => {
                  setLocalDescription(formatQuotes(v));
                  markDirty();
                }}
                wrapFormat={localWrapFormat}
                onWrapFormatChange={(v) => {
                  setLocalWrapFormat(v);
                  markDirty();
                }}
                author={localAuthor}
                onAuthorChange={(v) => {
                  setLocalAuthor(formatQuotes(v));
                  markDirty();
                }}
                sectionCount={orderedSections.length}
                groupCount={data.groups?.length ?? 0}
              />
            </section>
            <section data-editor-section="sections">
              <SectionsTab
                presetId={presetDetailId}
                sections={orderedSections}
                groupMap={groupMap}
                choiceBlocks={choiceBlocks}
                wrapFormat={localWrapFormat}
                onCreateSection={createSection}
                onUpdateSection={updateSection}
                onDeleteSection={deleteSection}
                onReorderSections={reorderSections}
                onCreateGroup={createGroup}
                onUpdateGroup={updateGroup}
                onDeleteGroup={deleteGroup}
                onCreateVariable={createVariable}
                onUpdateVariable={updateVariable}
                onDeleteVariable={deleteVariable}
                onReorderVariables={reorderVariables}
                hasLorebookMarker={sectionHasLorebookMarker}
                parentChatHasLorebook={parentChatHasLorebook}
              />
            </section>
            <section data-editor-section="prompts">
              <PromptsTab
                conversationPrompt={localConversationPrompt}
                onConversationPromptChange={(v) => {
                  setLocalConversationPrompt(v);
                  markDirty();
                }}
                gamePrompt={localGamePrompt}
                onGamePromptChange={(v) => {
                  setLocalGamePrompt(v);
                  markDirty();
                }}
              />
            </section>
            <section data-editor-section="parameters" className="space-y-3">
              <h3 className="text-sm font-semibold">{localizeUi("generationParameters.preset.title")}</h3>
              <p className="text-xs text-[var(--muted-foreground)]">{localizeUi("generationParameters.preset.hint")}</p>
              <GenerationParametersFields
                value={getEditableGenerationParameters(DEFAULT_GENERATION_PARAMS, localParameters)}
                showServiceTier
                onChange={(next) => {
                  setLocalParameters((previous) => ({ ...previous, ...next }));
                  markDirty();
                }}
              />
            </section>
            <section data-editor-section="regex">
              <PresetRegexTab
                presetId={presetDetailId}
                mode={localScopedRegexMode}
                onModeChange={(mode) => {
                  setLocalScopedRegexMode(mode);
                  markDirty();
                }}
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function PresetRegexTab({
  presetId,
  mode,
  onModeChange,
}: {
  presetId: string;
  mode: ScopedRegexMode;
  onModeChange: (mode: ScopedRegexMode) => void;
}) {
  const { t } = useUiTranslation();
  const { data: scripts } = useRegexScripts();
  const openRegexDetail = useUIStore((s) => s.openRegexDetail);
  const editorDirty = useUIStore((s) => s.editorDirty);
  const linkedScripts = useMemo(
    () =>
      (scripts ?? []).filter((script) => {
        try {
          const ids: unknown = JSON.parse(script.targetPromptPresetIds);
          return Array.isArray(ids) && ids.includes(presetId);
        } catch {
          return false;
        }
      }),
    [scripts, presetId],
  );
  const openScript = async (id: string) => {
    if (editorDirty && !hasEditorLeaveHandler(useUIStore.getState())) {
      const proceed = await showConfirmDialog({
        title: t("ui.characters.characterregexsection.unsavedChanges"),
        message: t("presets.regex.unsavedChanges"),
        confirmLabel: t("ui.characters.characterregexsection.discardContinue"),
        tone: "destructive",
      });
      if (!proceed) return;
    }
    openRegexDetail(id, { defaultPresetIds: [presetId], returnTo: { presetId } });
  };

  return (
    <div className="space-y-6" data-preset-regex>
      <div className="mari-editor-panel space-y-3 p-4">
        <label className="flex flex-wrap items-center justify-between gap-3 text-sm font-medium">
          {t("presets.regex.defaultMode")}
          <select
            className="mari-editor-input px-3 py-2 text-sm"
            value={mode}
            onChange={(event) => onModeChange(event.target.value as ScopedRegexMode)}
          >
            <option value="disabled">{t("ui.agents.agenteditor.disabled")}</option>
            <option value="exclusive">{t("ui.chat.chatsettingsdrawer.exclusive")}</option>
            <option value="chat">{t("ui.chat.chatsettingsdrawer.chat")}</option>
          </select>
        </label>
        <p className="text-xs text-[var(--marinara-editor-muted)]">{t("presets.regex.defaultHelp")}</p>
      </div>
      <div className="mari-editor-panel space-y-3 p-4">
        <h3 className="text-sm font-medium">{t("ui.characters.characterregexsection.regexScripts")}</h3>
        <p className="text-xs text-[var(--marinara-editor-muted)]">{t("presets.regex.linkedHelp")}</p>
        <button type="button" className="mari-editor-action inline-flex" onClick={() => void openScript("__new__")}>
          <Plus size="1rem" />
          {t("ui.characters.characterregexsection.createRegex")}
        </button>
        <label className="flex flex-wrap items-center gap-3 text-sm">
          {t("presets.regex.addExisting")}
          <select
            value=""
            className="mari-editor-input min-w-0 max-w-full px-3 py-2 text-sm"
            onChange={(event) => {
              if (event.target.value) void openScript(event.target.value);
            }}
          >
            <option value="">{t("presets.regex.chooseScript")}</option>
            {(scripts ?? [])
              .filter((script) => !linkedScripts.includes(script))
              .map((script) => (
                <option key={script.id} value={script.id}>
                  {script.name}
                </option>
              ))}
          </select>
        </label>
        {linkedScripts.length === 0 && (
          <p className="text-xs text-[var(--marinara-editor-muted)]">{t("presets.regex.noScripts")}</p>
        )}
        {linkedScripts.map((script) => (
          <button
            key={script.id}
            type="button"
            className="mari-editor-action flex w-full items-center justify-between gap-2 text-left"
            onClick={() => void openScript(script.id)}
          >
            <span className="min-w-0 truncate">{script.name}</span>
            <Pencil size="1rem" className="shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function QuickPresetSectionsEditor({
  presetId,
  parentChatHasLorebook = false,
  onEditableCopyCreated,
}: {
  presetId: string;
  parentChatHasLorebook?: boolean;
  onEditableCopyCreated: (presetId: string) => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = usePresetFull(presetId);
  const { mutateAsync: duplicatePreset } = useDuplicatePreset();
  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();
  const reorderSections = useReorderSections();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const createVariable = useCreateVariable();
  const updateVariable = useUpdateVariable();
  const deleteVariable = useDeleteVariable();
  const reorderVariables = useReorderVariables();
  const [quickCopyError, setQuickCopyError] = useState<string | null>(null);
  const [quickCopyPending, setQuickCopyPending] = useState(false);
  const currentPresetIdRef = useRef(presetId);

  useLayoutEffect(() => {
    currentPresetIdRef.current = presetId;
  }, [presetId]);

  useEffect(() => {
    setQuickCopyError(null);
    setQuickCopyPending(false);
  }, [presetId]);

  const handleCreateQuickCopy = useCallback(async () => {
    if (quickCopyPending) return;
    const initiatingPresetId = presetId;
    setQuickCopyPending(true);
    setQuickCopyError(null);
    try {
      const copy = await duplicatePreset(initiatingPresetId);
      if (currentPresetIdRef.current !== initiatingPresetId) return;
      if (!copy?.id) throw new Error(t("ui.presets.preseteditor.couldNotCreateEditableCopy"));
      toast.success(t("ui.presets.preseteditor.createdEditableCopy"));
      onEditableCopyCreated(copy.id);
    } catch (error) {
      if (currentPresetIdRef.current !== initiatingPresetId) return;
      setQuickCopyError(
        error instanceof Error ? error.message : t("ui.presets.preseteditor.couldNotCreateEditableCopy"),
      );
    } finally {
      if (currentPresetIdRef.current === initiatingPresetId) setQuickCopyPending(false);
    }
  }, [duplicatePreset, onEditableCopyCreated, presetId, quickCopyPending, t]);

  const sectionOrder = useMemo<string[]>(() => {
    const rawOrder = data?.preset?.sectionOrder;
    try {
      const parsed: unknown = typeof rawOrder === "string" ? JSON.parse(rawOrder) : (rawOrder ?? []);
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
    } catch {
      return [];
    }
  }, [data?.preset?.sectionOrder]);

  const orderedSections = useMemo(() => {
    const sections = data?.sections ?? [];
    const byId = new Map(sections.map((section) => [section.id, section]));
    return sectionOrder
      .map((id: string) => byId.get(id))
      .filter((section): section is PromptSection => section !== undefined);
  }, [data?.sections, sectionOrder]);

  const groupMap = useMemo(() => new Map((data?.groups ?? []).map((group) => [group.id, group])), [data?.groups]);
  const hasLorebookMarker = useMemo(
    () =>
      orderedSections.some((section) => {
        if (!readBoolFlag(section.enabled) || !readBoolFlag(section.isMarker)) return false;
        const marker = readMarkerConfig(section.markerConfig);
        return (
          marker?.type === "lorebook" || marker?.type === "world_info_before" || marker?.type === "world_info_after"
        );
      }),
    [orderedSections],
  );

  if (isLoading) {
    return (
      <div className="mari-editor-empty flex min-h-24 items-center justify-center px-3 py-6 text-xs">
        {t("chat.settings.promptPreset.quickEdit.loading")}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mari-editor-empty flex min-h-24 items-center justify-center px-3 py-6 text-xs">
        {t("chat.settings.promptPreset.quickEdit.missing")}
      </div>
    );
  }

  if (isStockMarinaraUniversalPreset(data.preset)) {
    return (
      <div className="mari-editor-empty flex min-h-24 flex-col items-center justify-center gap-2 px-3 py-6 text-center text-xs">
        <span>{t("ui.presets.preseteditor.stockPresetReadOnly")}</span>
        {quickCopyError ? <span className="text-[var(--destructive)]">{quickCopyError}</span> : null}
        <button
          type="button"
          onClick={() => void handleCreateQuickCopy()}
          disabled={quickCopyPending}
          className="mari-editor-action mari-editor-action--primary inline-flex px-3 py-2 disabled:opacity-50"
        >
          {quickCopyPending ? <Loader2 size="0.875rem" className="animate-spin" /> : <Copy size="0.875rem" />}
          {t(
            quickCopyPending
              ? "ui.presets.preseteditor.creatingEditableCopy"
              : "ui.presets.preseteditor.createEditableCopy",
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="mari-editor-legacy-bridge mari-quick-preset-editor">
      <SectionsTab
        presetId={presetId}
        sections={orderedSections}
        groupMap={groupMap}
        choiceBlocks={data.choiceBlocks ?? []}
        wrapFormat={(data.preset.wrapFormat ?? "xml") as WrapFormat}
        onCreateSection={createSection}
        onUpdateSection={updateSection}
        onDeleteSection={deleteSection}
        onReorderSections={reorderSections}
        onCreateGroup={createGroup}
        onUpdateGroup={updateGroup}
        onDeleteGroup={deleteGroup}
        onCreateVariable={createVariable}
        onUpdateVariable={updateVariable}
        onDeleteVariable={deleteVariable}
        onReorderVariables={reorderVariables}
        hasLorebookMarker={hasLorebookMarker}
        parentChatHasLorebook={parentChatHasLorebook}
        compact
      />
    </div>
  );
}

// ═══════════════════════════════════════════════
//  Overview Tab
// ═══════════════════════════════════════════════

function OverviewTab({
  preset,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  wrapFormat,
  onWrapFormatChange,
  author,
  onAuthorChange,
  sectionCount,
  groupCount,
}: {
  preset: PromptPreset;
  name: string;
  onNameChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  wrapFormat: WrapFormat;
  onWrapFormatChange: (v: WrapFormat) => void;
  author: string;
  onAuthorChange: (v: string) => void;
  sectionCount: number;
  groupCount: number;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <>
      <PresetPictureField preset={preset} />

      <FieldGroup
        label={localizeUi("ui.presets.overviewtab.name")}
        help={localizeUi("ui.presets.overviewtab.theDisplayNameForThisPresetUsedInThe")}
      >
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={localizeUi("ui.presets.preseteditor.presetName")}
          className="mari-editor-field w-full p-3 text-sm"
        />
      </FieldGroup>

      <FieldGroup
        label={localizeUi("chat.settings.inlineEditor.fields.description")}
        help={localizeUi("ui.presets.overviewtab.aShortSummaryOfWhatThisPresetIsDesigned")}
      >
        <textarea
          value={description}
          onFocus={(e) => e.target.select()}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={localizeUi("ui.presets.overviewtab.whatDoesThisPresetDo")}
          className="mari-editor-field min-h-[5rem] w-full p-3 text-sm"
        />
      </FieldGroup>

      <FieldGroup
        label={localizeUi("ui.presets.overviewtab.wrapFormat")}
        help={localizeUi("ui.presets.overviewtab.controlsHowPromptSectionsAreFormattedWhenSentTo")}
      >
        <div className="flex gap-2">
          {(["xml", "markdown", "none"] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => onWrapFormatChange(fmt)}
              aria-pressed={wrapFormat === fmt}
              className={cn(
                "flex items-center gap-2 rounded-md px-4 py-2.5 text-xs font-medium transition-all",
                wrapFormat === fmt
                  ? "mari-chrome-accent-surface mari-accent-animated"
                  : "mari-editor-action text-[var(--marinara-editor-muted)]",
              )}
            >
              {fmt === "xml" ? (
                <Code2 size="0.875rem" />
              ) : fmt === "markdown" ? (
                <Hash size="0.875rem" />
              ) : (
                <Type size="0.875rem" />
              )}
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[0.6875rem] text-[var(--muted-foreground)]">
          {wrapFormat === "xml"
            ? localizeUi("ui.presets.overviewtab.sectionsWrappedInXmlTagsGroupsBecomeParentTags")
            : wrapFormat === "markdown"
              ? localizeUi("ui.presets.overviewtab.sectionsWrappedWithHeadingsGroupsBecomeHeadings")
              : localizeUi("ui.presets.overviewtab.noAutomaticWrappingSectionContentIsSentAsIs")}
        </p>
      </FieldGroup>

      <FieldGroup
        label={localizeUi("ui.presets.overviewtab.author")}
        help={localizeUi("ui.presets.overviewtab.optionalCreatorNameUsefulIfYouSharePresetsWith")}
      >
        <input
          value={author}
          onFocus={(e) => e.target.select()}
          onChange={(e) => onAuthorChange(e.target.value)}
          placeholder={localizeUi("ui.presets.overviewtab.yourNameOptional")}
          className="mari-editor-field w-full p-2.5 text-sm"
        />
      </FieldGroup>

      <div className="flex gap-4">
        <StatCard label={localizeUi("editor.tabs.sections")} value={sectionCount} />
        <StatCard label={localizeUi("ui.presets.overviewtab.groups")} value={groupCount} />
      </div>
    </>
  );
}

function PresetPictureField({ preset }: { preset: PromptPreset }) {
  const { t: localizeUi } = useUiTranslation();
  const uploadPresetImage = useUploadPresetImage();
  const inputRef = useRef<HTMLInputElement>(null);
  const artwork = resolvePresetArtwork(preset);
  const pictureLabel = artwork
    ? localizeUi("ui.panels.presetspanel.replacePresetPicture")
    : localizeUi("ui.panels.presetspanel.uploadPresetPicture");

  const handleImageSelected = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast.error(localizeUi("ui.panels.presetspanel.chooseAnImageFileForThePresetPicture"));
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const image = typeof reader.result === "string" ? reader.result : "";
        if (!image) {
          toast.error(localizeUi("ui.panels.agentspanel.couldNotReadThatImage"));
          return;
        }
        try {
          await uploadPresetImage.mutateAsync({ id: preset.id, image });
          toast.success(localizeUi("ui.panels.presetspanel.presetPictureUpdated"));
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : localizeUi("ui.panels.presetspanel.failedToUploadPresetPicture"),
          );
        }
      };
      reader.onerror = () => toast.error(localizeUi("ui.panels.agentspanel.couldNotReadThatImage"));
      reader.readAsDataURL(file);
    },
    [localizeUi, preset.id, uploadPresetImage],
  );

  return (
    <FieldGroup
      label={localizeUi("ui.presets.overviewtab.picture")}
      help={localizeUi("ui.presets.overviewtab.pictureHelp")}
    >
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelected} />
      <button
        type="button"
        data-preset-overview-picture
        onClick={() => {
          if (!inputRef.current) return;
          inputRef.current.value = "";
          inputRef.current.click();
        }}
        disabled={uploadPresetImage.isPending}
        className="mari-panel-gradient-surface mari-panel-gradient--presets group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl shadow-sm transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[var(--marinara-chat-chrome-focus-ring)] disabled:opacity-60"
        title={pictureLabel}
        aria-label={pictureLabel}
      >
        {artwork ? (
          <img src={artwork} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <FileText size="1.5rem" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-100">
          <Camera size="1.125rem" />
        </span>
      </button>
    </FieldGroup>
  );
}

// ═══════════════════════════════════════════════
//  Prompts Tab
// ═══════════════════════════════════════════════

function PromptsTab({
  conversationPrompt,
  onConversationPromptChange,
  gamePrompt,
  onGamePromptChange,
}: {
  conversationPrompt: string;
  onConversationPromptChange: (v: string) => void;
  gamePrompt: string;
  onGamePromptChange: (v: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const quoteFormat = useUIStore((s) => s.quoteFormat);
  const formatPrompt = useCallback(
    (textarea: HTMLTextAreaElement, inputEvent: InputEvent) =>
      applyTextareaQuoteFormat(textarea, quoteFormat, inputEvent),
    [quoteFormat],
  );

  return (
    <>
      <FieldGroup
        label={localizeUi("onboarding.conversation.title")}
        help={localizeUi("ui.presets.promptstab.usedAsThePromptPresetSConversationPromptIn")}
      >
        <MacroTextarea
          showTokenCount
          value={conversationPrompt}
          tokenCountAlign="start"
          onChange={onConversationPromptChange}
          title={localizeUi("ui.presets.promptstab.editConversationModePrompt")}
          placeholder={localizeUi("ui.presets.promptstab.leaveEmptyToUseMarinaraSBuiltInConversation")}
          className="mari-editor-field min-h-[12rem] w-full p-3 font-mono text-xs"
          formatOnChange={formatPrompt}
          showMarkdownPreview
          spellCheck={false}
        />
      </FieldGroup>

      <FieldGroup
        label={localizeUi("onboarding.roleplay.title")}
        help={localizeUi("ui.presets.promptstab.roleplayPromptStructureContinuesToComeFromThisPreset")}
      >
        <div className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
          {localizeUi("ui.presets.promptstab.usesTheAssembledPromptFromSections")}
        </div>
      </FieldGroup>

      <FieldGroup
        label={localizeUi("onboarding.game.title")}
        help={localizeUi("ui.presets.promptstab.usedAsThePromptPresetSGamePromptIn")}
      >
        <MacroTextarea
          showTokenCount
          value={gamePrompt}
          tokenCountAlign="start"
          onChange={onGamePromptChange}
          title={localizeUi("ui.presets.promptstab.editGameModePrompt")}
          placeholder={localizeUi("ui.presets.promptstab.leaveEmptyToUseMarinaraSBuiltInGame")}
          className="mari-editor-field min-h-[12rem] w-full p-3 font-mono text-xs"
          formatOnChange={formatPrompt}
          showMarkdownPreview
          spellCheck={false}
        />
      </FieldGroup>
    </>
  );
}

// ═══════════════════════════════════════════════
//  Sections Tab (with drag-reorder, groups management, choice editing)
// ═══════════════════════════════════════════════

function SectionsTab({
  presetId,
  sections,
  groupMap,
  choiceBlocks,
  wrapFormat,
  onCreateSection,
  onUpdateSection,
  onDeleteSection,
  onReorderSections,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onCreateVariable,
  onUpdateVariable,
  onDeleteVariable,
  onReorderVariables,
  hasLorebookMarker,
  parentChatHasLorebook,
  compact = false,
}: {
  presetId: string;
  sections: any[];
  groupMap: Map<string, any>;
  choiceBlocks: any[];
  wrapFormat: WrapFormat;
  onCreateSection: any;
  onUpdateSection: any;
  onDeleteSection: any;
  onReorderSections: any;
  onCreateGroup: any;
  onUpdateGroup: any;
  onDeleteGroup: any;
  onCreateVariable: any;
  onUpdateVariable: any;
  onDeleteVariable: any;
  onReorderVariables: any;
  hasLorebookMarker: boolean;
  parentChatHasLorebook: boolean;
  compact?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [showGroupsPanel, setShowGroupsPanel] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragReady, setDragReady] = useState<number | null>(null); // index of section ready to drag (grip held)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [lorebookWarningDismissed, setLorebookWarningDismissed] = useState(() => {
    try {
      return localStorage.getItem(lorebookWarningDismissalKey(presetId)) === "true";
    } catch {
      return false;
    }
  });
  const markerLabel = (type: MarkerType) => {
    if (type === "id_macro_cards") return localizeUi("ui.presets.sectionstab.idMacroCards");
    if (type === "current_scene_summary") return localizeUi("ui.presets.sectionstab.currentSceneSummary");
    if (type === "recalled_scenes" || type === "recalled_messages")
      return localizeUi("ui.presets.sectionstab.recalledScenes");
    return MARKER_LABELS[type];
  };

  useEffect(() => {
    try {
      setLorebookWarningDismissed(localStorage.getItem(lorebookWarningDismissalKey(presetId)) === "true");
    } catch {
      setLorebookWarningDismissed(false);
    }
  }, [presetId]);

  useEffect(() => {
    if (!showAddMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && addMenuRef.current?.contains(target)) return;
      setShowAddMenu(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Claimed, so the Chat Settings window around the quick editor stays open.
      event.preventDefault();
      setShowAddMenu(false);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showAddMenu]);

  const dismissLorebookWarning = useCallback(() => {
    try {
      localStorage.setItem(lorebookWarningDismissalKey(presetId), "true");
    } catch {
      /* Ignore storage failures; the in-memory dismissal still helps this session. */
    }
    setLorebookWarningDismissed(true);
  }, [presetId]);

  // Fetch agent configs and filter to those with injectAsSection enabled
  const { data: agentConfigs } = useAgentConfigs();
  const { data: capabilityAgents = [] } = useCapabilityAgentRegistry();
  const injectableAgents = useMemo(() => {
    const configured = (agentConfigs ?? []).filter((a: AgentConfigRow) => {
      const settings = typeof a.settings === "string" ? JSON.parse(a.settings) : a.settings;
      return settings?.injectAsSection === true;
    });
    const ltm = capabilityAgents.find((agent) => agent.id === "long-term-memory");
    return ltm && !configured.some((agent) => agent.type === ltm.id)
      ? [...configured, { id: ltm.id, type: ltm.id, name: ltm.name }]
      : configured;
  }, [agentConfigs, capabilityAgents]);

  const toggleExpanded = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddSection = (opts?: {
    isMarker?: boolean;
    markerType?: MarkerType;
    agentType?: string;
    agentName?: string;
  }) => {
    setShowAddMenu(false);
    if (opts?.agentType) {
      // Agent data marker — pre-fill content with macro
      onCreateSection.mutate({
        presetId,
        identifier: `agent_${opts.agentType}`,
        name: `${opts.agentName ?? opts.agentType} (Agent)`,
        content: `{{agent::${opts.agentType}}}`,
        role: "system",
        isMarker: true,
        markerConfig: { type: "agent_data" as MarkerType, agentType: opts.agentType },
      });
    } else {
      onCreateSection.mutate({
        presetId,
        identifier: opts?.isMarker ? opts.markerType : `section_${Date.now()}`,
        name: opts?.isMarker ? markerLabel(opts.markerType!) : "New Section",
        content: "",
        role: "system",
        isMarker: opts?.isMarker ?? false,
        markerConfig: opts?.isMarker ? { type: opts.markerType! } : null,
      });
    }
  };

  const handleAddGroup = () => {
    onCreateGroup.mutate({ presetId, name: "New Group" });
  };

  // ── Drag & Drop ──
  // dropIdx represents the *gap* the item will be inserted at:
  //   0 = before first, 1 = between 0 and 1, N = after last, etc.
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  const handleDragStart = (idx: number, e: React.DragEvent) => {
    setDraggingIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  };

  const calcDropIdx = (cardIdx: number, e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    return e.clientY < midY ? cardIdx : cardIdx + 1;
  };

  const handleDragOver = (cardIdx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropIdx(calcDropIdx(cardIdx, e));
  };

  const containerRef = useRef<HTMLDivElement>(null);

  const handleContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    // Only snap to end-of-list when the cursor is below all cards.
    // Card-level onDragOver calls stopPropagation, so this only fires
    // when the cursor is in container padding/gaps outside any card.
    // Double-check: if there are cards, only set end-of-list when cursor
    // is below the last card's bottom edge.
    if (containerRef.current && sections.length > 0) {
      const lastCard = containerRef.current.lastElementChild as HTMLElement | null;
      if (lastCard) {
        const lastRect = lastCard.getBoundingClientRect();
        if (e.clientY > lastRect.bottom) {
          setDropIdx(sections.length);
        }
        // If cursor is above the first card, set to 0
        const firstCard = containerRef.current.firstElementChild as HTMLElement | null;
        if (firstCard) {
          const firstRect = firstCard.getBoundingClientRect();
          if (e.clientY < firstRect.top) {
            setDropIdx(0);
          }
        }
        return;
      }
    }
    setDropIdx(sections.length);
  };

  const commitSectionReorder = useCallback(
    (sourceIdx: number, target: number) => {
      const ids = reorderIdsToGap(sections, sourceIdx, target);
      if (!ids) return;
      onReorderSections.mutate({ presetId, sectionIds: ids });
    },
    [onReorderSections, presetId, sections],
  );

  const commitDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const sourceIdx = draggingIdx;
    const target = dropIdx;
    setDraggingIdx(null);
    setDropIdx(null);
    if (sourceIdx === null || target === null) return;
    commitSectionReorder(sourceIdx, target);
  };

  const handleDragEnd = () => {
    setDraggingIdx(null);
    setDropIdx(null);
  };

  const moveSectionByOffset = (idx: number, offset: number) => {
    const sectionIds = reorderIdsByOffset(sections, idx, offset);
    if (!sectionIds) return;
    onReorderSections.mutate({ presetId, sectionIds });
  };

  const { startTouchDrag: startSectionTouchDrag } = useTouchFolderDrag({
    onActivate: (sectionId) => {
      const idx = sections.findIndex((section: any) => section.id === sectionId);
      if (idx < 0) return;
      setDraggingIdx(idx);
      setDragReady(idx);
    },
    onDrop: (sectionId, x, y) => {
      const sourceIdx = sections.findIndex((section: any) => section.id === sectionId);
      const targetIdx = getTouchReorderDropIndex({
        x,
        y,
        itemSelector: '[data-touch-reorder-item="preset-section"]',
        rootSelector: "[data-preset-section-root]",
        itemCount: sections.length,
      });
      setDraggingIdx(null);
      setDropIdx(null);
      setDragReady(null);
      if (sourceIdx < 0 || targetIdx === null) return;
      commitSectionReorder(sourceIdx, targetIdx);
    },
    onCancel: () => {
      setDraggingIdx(null);
      setDropIdx(null);
      setDragReady(null);
    },
  });

  const duplicateSection = async (section: any, idx: number) => {
    try {
      const created = await onCreateSection.mutateAsync({
        presetId,
        identifier: `${section.identifier ?? "section"}_copy_${Date.now()}`,
        name: `${section.name ?? "Prompt Block"} Copy`,
        content: section.content ?? "",
        role: section.role ?? "system",
        enabled: readBoolFlag(section.enabled),
        isMarker: readBoolFlag(section.isMarker),
        groupId: section.groupId ?? null,
        markerConfig: readMarkerConfig(section.markerConfig),
        injectionPosition: section.injectionPosition ?? "ordered",
        injectionDepth: section.injectionDepth ?? 0,
        injectionOrder: section.injectionOrder ?? idx * 100,
        forbidOverrides: readBoolFlag(section.forbidOverrides),
        skipWrap: readBoolFlag(section.skipWrap),
      });
      if (created?.id) {
        const sectionIds = sections.map((s: any) => s.id);
        sectionIds.splice(idx + 1, 0, created.id);
        await onReorderSections.mutateAsync({ presetId, sectionIds });
        setExpandedSections((prev) => new Set(prev).add(created.id));
      }
      toast.success(localizeUi("ui.presets.sectionstab.duplicatedValue1", { value1: section.name }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.presets.sectionstab.failedToDuplicatePromptBlock"),
      );
    }
  };

  return (
    <>
      {/* ── Toolbar ── */}
      <div
        className={cn(
          "mari-editor-toolbar flex flex-wrap items-center",
          compact ? "gap-1.5 px-1 pb-2 pt-1.5" : "gap-2 p-2",
        )}
      >
        <HelpTooltip
          text={localizeUi("ui.presets.sectionstab.everythingWeSendToAModelIsJustText")}
          side="right"
          buttonClassName={compact ? "p-1" : undefined}
        />
        <div ref={addMenuRef} className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="mari-editor-action mari-editor-action--primary inline-flex"
          >
            <Plus size="0.8125rem" /> {localizeUi("ui.presets.sectionstab.addSection")}
          </button>
          {showAddMenu && (
            <div className="mari-editor-panel absolute left-0 top-full z-50 mt-1 max-h-80 w-56 overflow-y-auto p-1 shadow-xl">
              <button
                onClick={() => handleAddSection()}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[var(--marinara-editor-text)] hover:bg-[var(--marinara-editor-control-bg-hover)]"
              >
                <MessageSquare size="0.8125rem" /> {localizeUi("ui.presets.sectionstab.promptBlock")}
              </button>
              <div className="my-1 border-t border-[var(--border)]" />
              <p className="px-3 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                {localizeUi("ui.presets.sectionstab.markers")}
              </p>
              {(Object.keys(MARKER_LABELS) as MarkerType[])
                .filter((t) => t !== "agent_data" && t !== "recalled_messages")
                .map((type) => (
                  <button
                    key={type}
                    onClick={() => handleAddSection({ isMarker: true, markerType: type })}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[var(--marinara-editor-text)] hover:bg-[var(--marinara-editor-control-bg-hover)]"
                  >
                    <Layers size="0.8125rem" className="mari-chrome-accent-icon mari-accent-animated" />{" "}
                    {markerLabel(type)}
                  </button>
                ))}
              {injectableAgents.length > 0 && (
                <>
                  <div className="my-1 border-t border-[var(--border)]" />
                  <p className="px-3 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                    {localizeUi("ui.presets.sectionstab.agentSections")}
                  </p>
                  {injectableAgents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => handleAddSection({ agentType: agent.type, agentName: agent.name })}
                      className="flex w-full items-center justify-start gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--marinara-editor-text)] hover:bg-[var(--marinara-editor-control-bg-hover)]"
                    >
                      <Sparkles size="0.8125rem" className="mari-chrome-accent-icon mari-accent-animated" />{" "}
                      {agent.name} {localizeUi("ui.presets.sectionstab.agent")}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowGroupsPanel(!showGroupsPanel)}
          aria-expanded={showGroupsPanel}
          className={cn(
            "mari-editor-action mari-editor-action--primary inline-flex",
            showGroupsPanel && "mari-chrome-accent-surface mari-accent-animated",
          )}
        >
          <FolderOpen size="0.8125rem" /> {localizeUi("ui.presets.sectionstab.groups")}
          {groupMap.size})
        </button>
        {!hasLorebookMarker && parentChatHasLorebook && !lorebookWarningDismissed && (
          <div className="mari-editor-chip mari-editor-chip--warning shrink px-2.5 py-1.5 text-[0.6875rem]">
            <AlertTriangle size="0.75rem" className="shrink-0" />
            <span>{localizeUi("ui.presets.sectionstab.addALorebookMarkerWhenThisPresetShouldReceive")}</span>
            <button
              type="button"
              onClick={dismissLorebookWarning}
              className="ml-0.5 rounded-md p-0.5 text-[var(--marinara-editor-muted)] transition-colors hover:bg-[var(--warning)]/15 hover:text-[var(--warning)]"
              title={localizeUi("ui.presets.sectionstab.dismissWarning")}
              aria-label={localizeUi("ui.presets.sectionstab.dismissWarning")}
            >
              <X size="0.6875rem" />
            </button>
          </div>
        )}
      </div>

      {/* ── Groups Management Panel ── */}
      {showGroupsPanel && (
        <div className="mari-editor-panel space-y-2 p-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-[var(--marinara-editor-text)]">
              {localizeUi("ui.presets.overviewtab.groups")}
            </h4>
            <button
              onClick={handleAddGroup}
              className="mari-editor-action mari-editor-action--compact flex items-center gap-1 px-2 py-1 text-[0.625rem]"
            >
              <Plus size="0.625rem" /> {localizeUi("ui.presets.sectionstab.newGroup")}
            </button>
          </div>
          <p className="text-[0.625rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.presets.sectionstab.groupsWrapAdjacentSectionsInASingleXmlMarkdown")}
          </p>
          {groupMap.size === 0 ? (
            <p className="py-2 text-center text-[0.625rem] text-[var(--muted-foreground)]">
              {localizeUi("ui.presets.sectionstab.noGroupsYetCreateOneToOrganizeSections")}
            </p>
          ) : (
            <div className="space-y-1">
              {[...groupMap.values()].map((g: any) => (
                <div
                  key={g.id}
                  className="mari-editor-panel mari-editor-panel--soft flex items-center gap-2 px-2.5 py-1.5"
                >
                  {editingGroupId === g.id ? (
                    <input
                      value={editingGroupName}
                      onChange={(e) => setEditingGroupName(e.target.value)}
                      onBlur={() => {
                        if (editingGroupName.trim()) {
                          onUpdateGroup.mutate({ presetId, groupId: g.id, name: editingGroupName.trim() });
                        }
                        setEditingGroupId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setEditingGroupId(null);
                      }}
                      className="mari-editor-field flex-1 px-1.5 py-0.5 text-xs"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="flex-1 cursor-pointer truncate text-xs font-medium"
                      onClick={() => {
                        setEditingGroupId(g.id);
                        setEditingGroupName(g.name);
                      }}
                      title={localizeUi("ui.presets.sectionstab.clickToRename")}
                    >
                      {g.name}
                    </span>
                  )}
                  <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
                    {sections.filter((s: any) => s.groupId === g.id).length}{" "}
                    {localizeUi("ui.presets.sectionstab.sections")}
                  </span>
                  <button
                    onClick={async () => {
                      if (
                        await showConfirmDialog({
                          title: localizeUi("ui.presets.sectionstab.deleteGroup"),
                          message: localizeUi("ui.presets.sectionstab.deleteGroupValue1SectionsWillBeUngrouped", {
                            value1: g.name,
                          }),
                          confirmLabel: localizeUi("lorebook.editor.batch.delete"),
                          tone: "destructive",
                        })
                      ) {
                        onDeleteGroup.mutate({ presetId, groupId: g.id });
                      }
                    }}
                    className="rounded p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  >
                    <Trash2 size="0.625rem" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Section list with drag & drop ── */}
      <div
        ref={containerRef}
        data-preset-section-root
        className="space-y-1"
        onDragOver={handleContainerDragOver}
        onDrop={commitDrop}
      >
        {sections.length === 0 ? (
          <div className="mari-editor-empty flex flex-col items-center gap-2 py-10 text-center">
            <Layers size="1.5rem" className="text-[var(--muted-foreground)]" />
            <p className="text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.presets.sectionstab.noSectionsYetAddOneToGetStarted")}
            </p>
          </div>
        ) : (
          sections.map((section: any, idx: number) => {
            const isExpanded = expandedSections.has(section.id);
            const isEnabled = section.enabled === "true" || section.enabled === true;
            const isMarker = section.isMarker === "true" || section.isMarker === true;
            const role = (section.role ?? "system") as string;
            const group = section.groupId ? groupMap.get(section.groupId) : null;
            const RoleIcon = ROLE_ICONS[role] ?? Settings2;
            const markerConfig = isMarker ? readMarkerConfig(section.markerConfig) : null;
            const hasContentTextarea = !isMarker || markerConfig?.type === "agent_data";
            const positionControls = (
              <div
                className={cn(
                  "flex flex-wrap items-center gap-3 text-xs",
                  compact && "max-sm:gap-x-1.5 max-sm:gap-y-1 max-sm:text-[0.6875rem]",
                )}
              >
                <label className={cn("text-[var(--muted-foreground)]", compact && "max-sm:text-[0.625rem]")}>
                  {localizeUi("ui.presets.sectionstab.position")}
                </label>
                <select
                  value={section.injectionPosition ?? "ordered"}
                  onChange={(e) =>
                    onUpdateSection.mutate({
                      presetId,
                      sectionId: section.id,
                      injectionPosition: e.target.value,
                    })
                  }
                  data-preset-section-position
                  className={cn(
                    "mari-editor-field px-2 py-1 text-xs",
                    compact &&
                      "max-sm:h-7 max-sm:min-w-0 max-sm:max-w-[12rem] max-sm:px-1.5 max-sm:py-1 max-sm:text-[0.6875rem]",
                  )}
                >
                  <option value="ordered">{localizeUi("ui.presets.sectionstab.orderedInSequence")}</option>
                  <option value="depth">{localizeUi("ui.presets.sectionstab.depthFromEndOfChat")}</option>
                </select>
                {section.injectionPosition === "depth" && (
                  <>
                    <label className={cn("text-[var(--muted-foreground)]", compact && "max-sm:text-[0.625rem]")}>
                      {localizeUi("ui.presets.sectionstab.depth")}
                    </label>
                    <DraftNumberInput
                      value={section.injectionDepth ?? 0}
                      min={0}
                      selectOnFocus
                      onCommit={(nextValue) =>
                        onUpdateSection.mutate({
                          presetId,
                          sectionId: section.id,
                          injectionDepth: nextValue,
                        })
                      }
                      className={cn(
                        "mari-editor-field w-16 px-2 py-1 text-xs",
                        compact && "max-sm:h-7 max-sm:w-12 max-sm:px-1.5 max-sm:text-[0.6875rem]",
                      )}
                    />
                    <span
                      className={cn(
                        "text-[var(--muted-foreground)]",
                        compact && "max-sm:basis-full max-sm:text-[0.5625rem]",
                      )}
                    >
                      {localizeUi("ui.presets.sectionstab.zeroMeansAfterLastMessage")}
                    </span>
                  </>
                )}
              </div>
            );
            // Show drop indicator line above this card when dropIdx matches
            const showDropBefore =
              dropIdx === idx && draggingIdx !== null && draggingIdx !== idx && draggingIdx !== idx - 1;
            const showDropAfter =
              idx === sections.length - 1 && dropIdx === sections.length && draggingIdx !== null && draggingIdx !== idx;

            return (
              <div key={section.id}>
                {showDropBefore && (
                  <div className="mari-chrome-accent-progress mari-accent-animated mx-2 mb-1 h-0.5 rounded-full" />
                )}
                <div
                  data-touch-reorder-item="preset-section"
                  data-touch-reorder-index={idx}
                  data-preset-marker-section={compact && isMarker ? "true" : undefined}
                  draggable={dragReady === idx}
                  onDragStart={(e) => handleDragStart(idx, e)}
                  onDragOver={(e) => {
                    e.stopPropagation();
                    handleDragOver(idx, e);
                  }}
                  onDrop={(e) => {
                    e.stopPropagation();
                    commitDrop(e);
                  }}
                  onDragEnd={() => {
                    handleDragEnd();
                    setDragReady(null);
                  }}
                  className={cn(
                    "mari-editor-panel transition-all",
                    isEnabled
                      ? "border-[var(--marinara-editor-border)]"
                      : "border-[var(--marinara-editor-border)]/50 opacity-50",
                    draggingIdx === idx && "opacity-40",
                  )}
                >
                  {/* Section header */}
                  <div className={cn("flex min-w-0 items-center", compact ? "gap-1.5 px-2 py-2" : "gap-2 px-3 py-2.5")}>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <div
                        className="cursor-grab rounded p-0.5 hover:bg-[var(--accent)] active:cursor-grabbing"
                        title={localizeUi("ui.presets.sectionstab.dragToReorder")}
                        onMouseDown={() => setDragReady(idx)}
                        onMouseUp={() => setDragReady(null)}
                        onTouchStart={(event) => {
                          event.stopPropagation();
                          startSectionTouchDrag(event, section.id, {
                            allowInteractiveTarget: true,
                            sourceElement: event.currentTarget.closest<HTMLElement>(
                              '[data-touch-reorder-item="preset-section"]',
                            ),
                          });
                        }}
                      >
                        <GripVertical size="0.875rem" className="text-[var(--muted-foreground)]" />
                      </div>
                      <button
                        type="button"
                        onClick={() => moveSectionByOffset(idx, -1)}
                        disabled={idx === 0 || onReorderSections.isPending}
                        className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-30"
                        title={localizeUi("ui.presets.sectionstab.moveUp")}
                        aria-label={localizeUi("ui.presets.sectionstab.moveValue1Up", { value1: section.name })}
                      >
                        <ArrowUp size="0.75rem" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSectionByOffset(idx, 1)}
                        disabled={idx === sections.length - 1 || onReorderSections.isPending}
                        className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-30"
                        title={localizeUi("ui.presets.sectionstab.moveDown")}
                        aria-label={localizeUi("ui.presets.sectionstab.moveValue1Down", { value1: section.name })}
                      >
                        <ArrowDown size="0.75rem" />
                      </button>
                    </div>
                    <button
                      data-preset-section-toggle
                      onClick={() => toggleExpanded(section.id)}
                      className="shrink-0 rounded p-0.5 hover:bg-[var(--accent)]"
                    >
                      {isExpanded ? (
                        <ChevronDown size="0.875rem" className="text-[var(--muted-foreground)]" />
                      ) : (
                        <ChevronRight size="0.875rem" className="text-[var(--muted-foreground)]" />
                      )}
                    </button>
                    <RoleIcon size="0.875rem" className={cn("shrink-0", ROLE_COLORS[role])} />
                    <span
                      className={cn(
                        "min-w-0 flex-1 cursor-pointer truncate font-medium",
                        compact ? "text-xs" : "text-sm",
                      )}
                      onClick={() => toggleExpanded(section.id)}
                    >
                      {markerConfig?.type === "recalled_messages" && section.name === "Recalled Messages"
                        ? markerLabel("recalled_scenes")
                        : section.name}
                    </span>

                    {isMarker && (
                      <span
                        data-preset-marker-badge
                        className={cn(
                          "mari-chrome-accent-surface mari-accent-animated shrink-0 rounded px-1.5 py-0.5 text-[0.5625rem] font-medium",
                          compact && "max-sm:hidden",
                        )}
                      >
                        {localizeUi("ui.presets.sectionstab.marker")}
                      </span>
                    )}
                    {group && (
                      <span
                        data-preset-section-group-badge
                        className={cn(
                          "mari-editor-chip shrink-0 whitespace-nowrap px-1.5 py-0.5 text-[0.5625rem]",
                          compact && "max-sm:hidden",
                        )}
                      >
                        {group.name}
                      </span>
                    )}
                    <span className="hidden shrink-0 text-[0.625rem] text-[var(--muted-foreground)] sm:inline">
                      {role}
                    </span>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => void duplicateSection(section, idx)}
                        disabled={onCreateSection.isPending || onReorderSections.isPending}
                        className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-30"
                        title={localizeUi("ui.presets.sectionstab.duplicate")}
                        aria-label={localizeUi("ui.presets.sectionstab.duplicateValue1", { value1: section.name })}
                      >
                        <Copy size="0.75rem" />
                      </button>
                      <button
                        onClick={() =>
                          onUpdateSection.mutate({
                            presetId,
                            sectionId: section.id,
                            enabled: !isEnabled,
                          })
                        }
                        className="rounded-lg p-1 hover:bg-[var(--accent)]"
                        title={
                          isEnabled
                            ? localizeUi("ui.presets.sectionstab.disable")
                            : localizeUi("ui.presets.sectionstab.enable")
                        }
                      >
                        {isEnabled ? (
                          <Eye size="0.75rem" className="text-green-400" />
                        ) : (
                          <EyeOff size="0.75rem" className="text-[var(--muted-foreground)]" />
                        )}
                      </button>
                      <button
                        onClick={async () => {
                          if (
                            !(await showConfirmDialog({
                              title: localizeUi("ui.presets.sectionstab.deletePromptBlock"),
                              message: localizeUi("dialog.delete.namedPermanent", {
                                name: section.name || localizeUi("ui.presets.sectionstab.promptBlock"),
                              }),
                              confirmLabel: localizeUi("lorebook.editor.batch.delete"),
                              tone: "destructive",
                            }))
                          ) {
                            return;
                          }
                          onDeleteSection.mutate({ presetId, sectionId: section.id });
                        }}
                        className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                        title={localizeUi("lorebook.editor.batch.delete")}
                      >
                        <Trash2 size="0.75rem" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div
                      className={cn(
                        "space-y-3 border-t border-[var(--marinara-editor-divider)] px-3 py-3",
                        compact && "max-sm:space-y-2 max-sm:px-2 max-sm:py-2",
                      )}
                    >
                      {/* Name & Role */}
                      <div className={cn("flex gap-2", compact && "flex-col max-sm:gap-1.5")}>
                        <SectionNameInput
                          value={section.name}
                          onCommit={(name) =>
                            onUpdateSection.mutate({
                              presetId,
                              sectionId: section.id,
                              name,
                            })
                          }
                        />
                        <select
                          value={role}
                          onChange={(e) =>
                            onUpdateSection.mutate({
                              presetId,
                              sectionId: section.id,
                              role: e.target.value,
                            })
                          }
                          data-preset-section-role
                          className={cn(
                            "mari-editor-field px-2 py-1.5 text-xs",
                            compact &&
                              "max-sm:h-7 max-sm:w-fit max-sm:max-w-full max-sm:self-start max-sm:px-1.5 max-sm:py-1 max-sm:text-[0.6875rem]",
                          )}
                        >
                          <option value="system">{localizeUi("ui.presets.sectionstab.system")}</option>
                          <option value="user">{localizeUi("ui.presets.sectionstab.user")}</option>
                          <option value="assistant">{localizeUi("ui.presets.sectionstab.assistant")}</option>
                        </select>
                      </div>

                      {/* Content (not for markers) */}
                      {!isMarker && (
                        <SectionContentTextarea
                          value={section.content}
                          tokenCountFooter={positionControls}
                          sectionName={section.name}
                          onCommit={(content) =>
                            onUpdateSection.mutate({
                              presetId,
                              sectionId: section.id,
                              content,
                            })
                          }
                        />
                      )}

                      {/* Marker config */}
                      {isMarker &&
                        markerConfig &&
                        (() => {
                          const mc = markerConfig;
                          const isAgentMarker = mc.type === "agent_data";
                          return isAgentMarker ? (
                            <div className="space-y-2">
                              <div
                                className={cn(
                                  "mari-editor-panel mari-editor-panel--soft p-3 text-xs text-[var(--marinara-editor-text)]",
                                  compact && "max-sm:p-2 max-sm:text-[0.6875rem]",
                                )}
                              >
                                {localizeUi("ui.presets.sectionstab.agentSection")} <strong>{section.name}</strong>
                                <p className="mt-1 text-[var(--muted-foreground)]">
                                  {localizeUi("ui.presets.sectionstab.the")}{" "}
                                  <code className="rounded bg-black/20 px-1 py-0.5 text-[0.625rem] font-mono text-[var(--marinara-chat-chrome-panel-text)]">
                                    {"{{agent::" + (mc.agentType ?? "agent") + "}}"}
                                  </code>{" "}
                                  {localizeUi("ui.presets.sectionstab.macroWillBeReplacedWithTheLatestOutputFrom")}
                                </p>
                              </div>
                              <SectionContentTextarea
                                value={section.content || `{{agent::${mc.agentType ?? "agent"}}}`}
                                tokenCountFooter={positionControls}
                                sectionName={section.name}
                                onCommit={(content) =>
                                  onUpdateSection.mutate({
                                    presetId,
                                    sectionId: section.id,
                                    content,
                                  })
                                }
                              />
                            </div>
                          ) : (
                            <div
                              className={cn(
                                "mari-editor-panel mari-editor-panel--soft p-3 text-xs text-[var(--marinara-editor-text)]",
                                compact && "max-sm:p-2 max-sm:text-[0.6875rem]",
                              )}
                            >
                              {localizeUi("ui.presets.sectionstab.markerType")}{" "}
                              <strong>{markerLabel(mc.type as MarkerType) || "Unknown"}</strong>
                              <p className="mt-1 text-[var(--muted-foreground)]">
                                {mc.type === "id_macro_cards"
                                  ? localizeUi("ui.presets.sectionstab.idMacroCardsDescription")
                                  : mc.type === "current_scene_summary"
                                    ? localizeUi("ui.presets.sectionstab.currentSceneSummaryDescription")
                                    : mc.type === "recalled_scenes" || mc.type === "recalled_messages"
                                      ? localizeUi("ui.presets.sectionstab.recalledScenesDescription")
                                      : mc.type === "chat_summary"
                                        ? localizeUi(
                                            "ui.presets.sectionstab.rendersTheCompiledChatSummaryForThisChatIncluding",
                                          )
                                        : localizeUi(
                                            "ui.presets.sectionstab.contentIsAutoGeneratedAtAssemblyTimeFromYour",
                                          )}
                              </p>
                              {["lorebook", "world_info_before", "world_info_after"].includes(mc.type) && (
                                <p className="mt-1 text-[var(--warning)]">
                                  {localizeUi("ui.presets.sectionstab.thisIsWhereActiveLorebookEntriesAreInserted")}
                                </p>
                              )}
                            </div>
                          );
                        })()}

                      {/* Position & Depth */}
                      {!hasContentTextarea && positionControls}

                      {/* Group assignment */}
                      <div
                        className={cn(
                          "flex items-center gap-3 text-xs",
                          compact && "max-sm:flex-wrap max-sm:gap-1.5 max-sm:text-[0.6875rem]",
                        )}
                      >
                        <label className={cn("text-[var(--muted-foreground)]", compact && "max-sm:text-[0.625rem]")}>
                          {localizeUi("ui.presets.sectionstab.group")}
                        </label>
                        <select
                          value={section.groupId ?? ""}
                          onChange={(e) =>
                            onUpdateSection.mutate({
                              presetId,
                              sectionId: section.id,
                              groupId: e.target.value || null,
                            })
                          }
                          data-preset-section-group
                          className={cn(
                            "mari-editor-field px-2 py-1 text-xs",
                            compact &&
                              "max-sm:h-7 max-sm:min-w-0 max-sm:max-w-[12rem] max-sm:px-1.5 max-sm:py-1 max-sm:text-[0.6875rem]",
                          )}
                        >
                          <option value="">{localizeUi("ui.presets.sectionstab.noGroup")}</option>
                          {[...groupMap.values()].map((g: any) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                        {groupMap.size === 0 && (
                          <span
                            className={cn(
                              "text-[0.625rem] text-[var(--muted-foreground)]",
                              compact && "max-sm:basis-full max-sm:text-[0.5625rem]",
                            )}
                          >
                            {localizeUi("ui.presets.sectionstab.openGroupsPanelToCreateOne")}
                          </span>
                        )}
                      </div>

                      {/* Prompt-block wrap opt-out; markers keep their wrapper, and NONE wraps nothing */}
                      {!isMarker && wrapFormat !== "none" && (
                        <SettingsSwitch
                          label={localizeUi("ui.presets.sectionstab.sendWithoutWrapper")}
                          description={localizeUi("ui.presets.sectionstab.sendWithoutWrapperDescription")}
                          checked={readBoolFlag(section.skipWrap)}
                          onChange={(checked) =>
                            onUpdateSection.mutate({
                              presetId,
                              sectionId: section.id,
                              skipWrap: checked,
                            })
                          }
                          labelClassName="text-xs"
                          className="p-0 hover:bg-transparent"
                        />
                      )}
                    </div>
                  )}
                </div>
                {showDropAfter && (
                  <div className="mari-chrome-accent-progress mari-accent-animated mx-2 mt-1 h-0.5 rounded-full" />
                )}
              </div>
            );
          })
        )}
      </div>

      {sections.length > 0 && (
        <p className="text-center text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.presets.sectionstab.clickToExpandSectionsAreAssembledTopToBottom")}
        </p>
      )}

      {/* ── Preset Variables ── */}
      <PresetVariablesEditor
        presetId={presetId}
        variables={choiceBlocks}
        onCreateVariable={onCreateVariable}
        onUpdateVariable={onUpdateVariable}
        onDeleteVariable={onDeleteVariable}
        onReorderVariables={onReorderVariables}
        compact={compact}
      />
    </>
  );
}

// ── Locally-controlled section content textarea (commits on blur) ──
function SectionContentTextarea({
  value,
  sectionName,
  tokenCountFooter,
  onCommit,
}: {
  value: string;
  sectionName?: string;
  tokenCountFooter?: ReactNode;
  onCommit: (v: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [local, setLocal] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusedRef = useRef(false);
  const quoteFormat = useUIStore((s) => s.quoteFormat);

  // Only sync from parent when not actively editing
  useEffect(() => {
    if (!focusedRef.current) setLocal(value);
  }, [value]);

  const commit = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (local !== value) onCommit(local);
  }, [local, value, onCommit]);

  // Debounced auto-save while typing (800ms)
  const handleChange = (nextRawValue: string) => {
    const nextValue = nextRawValue;
    setLocal(nextValue);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (nextValue !== value) onCommit(nextValue);
    }, 800);
  };

  // Commit on blur immediately
  const handleBlur = () => {
    focusedRef.current = false;
    commit();
  };

  const handleFocus = () => {
    focusedRef.current = true;
  };

  // Cleanup timer on unmount
  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  return (
    <MacroTextarea
      showTokenCount
      value={local}
      tokenCountFooter={tokenCountFooter}
      tokenCountAlign="start"
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onExpandedClose={commit}
      formatOnChange={(textarea, inputEvent) => applyTextareaQuoteFormat(textarea, quoteFormat, inputEvent)}
      title={
        sectionName
          ? localizeUi("ui.presets.sectioncontenttextarea.editValue1", { value1: sectionName })
          : localizeUi("ui.presets.sectioncontenttextarea.editPrompt")
      }
      showMarkdownPreview
      className="mari-editor-field min-h-[7.5rem] w-full p-2.5 font-mono text-xs"
      placeholder={localizeUi("ui.presets.sectioncontenttextarea.promptContentSupportsUserCharCommentTrimMacros")}
    />
  );
}

// ── Locally-controlled section name input (commits on blur / Enter) ──
function SectionNameInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const { t: localizeUi } = useUiTranslation();
  const [local, setLocal] = useState(value);

  // Sync when the external value changes (e.g. after refetch)
  useEffect(() => {
    setLocal(value);
  }, [value]);

  const commit = () => {
    const trimmed = local.trim();
    if (trimmed && trimmed !== value) onCommit(trimmed);
    else setLocal(value); // revert if empty
  };

  return (
    <input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="mari-editor-field flex-1 px-2.5 py-1.5 text-xs"
      placeholder={localizeUi("ui.presets.sectionnameinput.sectionName")}
    />
  );
}

// ═══════════════════════════════════════════════
//  Shared UI Components
// ═══════════════════════════════════════════════

function FieldGroup({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="mari-editor-panel space-y-2 p-3">
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
        {label}
        {help && <HelpTooltip text={help} />}
      </label>
      {children}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="mari-editor-panel flex flex-1 flex-col items-center p-3">
      <span className="text-xl font-bold text-[var(--foreground)]">{value}</span>
      <span className="text-[0.625rem] text-[var(--muted-foreground)]">{label}</span>
    </div>
  );
}
