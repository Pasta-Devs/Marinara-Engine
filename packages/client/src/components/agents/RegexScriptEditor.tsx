// ──────────────────────────────────────────────
// Full-Page Regex Script Editor
// ──────────────────────────────────────────────
import { useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useUIStore } from "../../stores/ui.store";
import { showConfirmDialog } from "../../lib/app-dialogs";
import {
  useRegexScripts,
  useUpdateRegexScript,
  useCreateRegexScript,
  useDeleteRegexScript,
  type RegexScriptRow,
} from "../../hooks/use-regex-scripts";
import { useCharacters } from "../../hooks/use-characters";
import { usePresets } from "../../hooks/use-presets";
import {
  ArrowLeft,
  Save,
  Check,
  AlertCircle,
  X,
  Trash2,
  Info,
  Regex,
  Play,
  Plus,
  Minus,
  Users,
  FileText,
  Upload,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { downloadJsonFile, sanitizeExportFilenamePart } from "../../lib/download-json";
import { ApiError } from "../../lib/api-client";
import { HelpTooltip } from "../ui/HelpTooltip";
import { DraftNumberInput } from "../ui/DraftNumberInput";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import {
  applyRegexReplacement,
  formatTextQuotes,
  isPatternSafe,
  resolveRegexPatternLiteralMacros,
  resolveMacros,
  type MacroContext,
  type RegexPlacement,
} from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";

// ═══════════════════════════════════════════════
//  Placement metadata
// ═══════════════════════════════════════════════
const PLACEMENT_META: Record<RegexPlacement, { label: string; description: string }> = {
  ai_output: {
    label: "AI Output",
    description: "Applied to AI responses before they are displayed.",
  },
  user_input: {
    label: "User Input",
    description: "Applied to your messages before they are sent.",
  },
};

const REGEX_FIELD_ICON_CLASS = "mari-chrome-accent-icon mari-accent-animated";
const REGEX_ACTIVE_OPTION_CLASS =
  "mari-chrome-accent-surface mari-accent-animated ring-[var(--marinara-chat-chrome-button-border-active)]";
type RegexApplyMode = "prompt" | "display" | "both";

const APPLY_MODE_META: Record<RegexApplyMode, { label: string; description: string }> = {
  display: {
    label: "Only Display",
    description: "Change what appears in chat only.",
  },
  prompt: {
    label: "Only Prompt",
    description: "Change what the model receives only.",
  },
  both: {
    label: "Both",
    description: "Change display and prompt text.",
  },
};

function deriveRegexApplyMode(
  row: Pick<RegexScriptRow, "applyMode" | "promptOnly"> | null | undefined,
): RegexApplyMode {
  if (row?.applyMode === "prompt" || row?.applyMode === "display" || row?.applyMode === "both") {
    return row.applyMode;
  }
  return row?.promptOnly === "true" ? "prompt" : "display";
}

function createLiveTestMacroContext(input: string): MacroContext {
  return {
    user: "User",
    char: "Character",
    characters: ["Character"],
    variables: {},
    lastInput: input || "Sample input",
    characterFields: {
      description: "Character description",
      personality: "Character personality",
      backstory: "Character backstory",
      appearance: "Character appearance",
      scenario: "Character scenario",
      example: "Character example",
    },
    personaFields: {
      description: "Persona description",
      personality: "Persona personality",
      backstory: "Persona backstory",
      appearance: "Persona appearance",
      scenario: "Persona scenario",
    },
  };
}

function resolveLiveTestMacros(value: string, context: MacroContext): string {
  return resolveMacros(value, context, { trimResult: false });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string" && entry !== "");
  if (typeof value !== "string") return [];
  try {
    return parseStringArray(JSON.parse(value) as unknown);
  } catch {
    return [];
  }
}

function parseCharacterData(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function formatValidationIssue(issue: unknown): string | null {
  if (!isRecord(issue)) return null;
  const message = typeof issue.message === "string" ? issue.message : null;
  if (!message) return null;
  const path = Array.isArray(issue.path)
    ? issue.path.filter((part) => typeof part === "string" || typeof part === "number").join(".")
    : typeof issue.path === "string"
      ? issue.path
      : "";
  return path ? `${path}: ${message}` : message;
}

function describeRegexEditorError(error: unknown): string {
  if (error instanceof ApiError && isRecord(error.payload)) {
    const details = error.payload.details ?? error.payload.issues;
    if (Array.isArray(details)) {
      const messages = details.map(formatValidationIssue).filter((message): message is string => !!message);
      if (messages.length > 0) return messages.slice(0, 3).join("; ");
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return "Failed to save regex script";
}

function ScopeTargetPicker({
  icon,
  options,
  selectedIds,
  addLabel,
  emptyLabel,
  removeLabel,
  onAdd,
  onRemove,
}: {
  icon: ReactNode;
  options: Array<{ id: string; name: string }>;
  selectedIds: string[];
  addLabel: string;
  emptyLabel: string;
  removeLabel: (name: string) => string;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const selected = selectedIds.map((id) => options.find((option) => option.id === id) ?? { id, name: id });
  const available = options.filter((option) => !selectedIds.includes(option.id));

  return (
    <div className="mt-3 space-y-2">
      {selected.map((option) => (
        <div key={option.id} className="mari-editor-panel mari-editor-panel--soft flex items-center gap-2.5 px-3 py-2">
          <span className={REGEX_FIELD_ICON_CLASS}>{icon}</span>
          <span className="min-w-0 flex-1 truncate text-xs">{option.name}</span>
          <button
            type="button"
            onClick={() => onRemove(option.id)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
            aria-label={removeLabel(option.name)}
            title={removeLabel(option.name)}
          >
            <X size="0.75rem" />
          </button>
        </div>
      ))}
      <select
        value=""
        disabled={available.length === 0}
        onChange={(event) => {
          if (event.target.value) onAdd(event.target.value);
        }}
        className="w-full rounded-xl bg-[var(--background)] px-3 py-2 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60"
      >
        <option value="">{available.length > 0 ? addLabel : emptyLabel}</option>
        {available.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  Main Editor
// ═══════════════════════════════════════════════
export function RegexScriptEditor() {
  const { t: localizeUi } = useUiTranslation();
  const regexDetailId = useUIStore((s) => s.regexDetailId);
  const regexDetailDefaultCharacterIds = useUIStore((s) => s.regexDetailDefaultCharacterIds);
  const regexDetailReturn = useUIStore((s) => s.regexDetailReturn);
  const closeRegexDetail = useUIStore((s) => s.closeRegexDetail);
  const openRegexDetail = useUIStore((s) => s.openRegexDetail);
  const quoteFormat = useUIStore((s) => s.quoteFormat);

  const { data: regexScripts } = useRegexScripts();
  const { data: characters } = useCharacters();
  const { data: promptPresets } = usePresets();
  const updateScript = useUpdateRegexScript();
  const createScript = useCreateRegexScript();
  const deleteScript = useDeleteRegexScript();

  const isNew = regexDetailId === "__new__";

  // Find existing DB row
  const dbRow = useMemo(() => {
    if (!regexDetailId || isNew || !regexScripts) return null;
    return (regexScripts as RegexScriptRow[]).find((r) => r.id === regexDetailId) ?? null;
  }, [regexDetailId, isNew, regexScripts]);

  // ── Local editable state ──
  const [localName, setLocalName] = useState("");
  const [localEnabled, setLocalEnabled] = useState(true);
  const [localFindRegex, setLocalFindRegex] = useState("");
  const [localReplaceString, setLocalReplaceString] = useState("");
  const [localTrimStrings, setLocalTrimStrings] = useState<string[]>([]);
  const [localPlacement, setLocalPlacement] = useState<RegexPlacement[]>(["ai_output"]);
  const [localFlags, setLocalFlags] = useState("gi");
  const [localApplyMode, setLocalApplyMode] = useState<RegexApplyMode>("display");
  const [localCharacterScopeEnabled, setLocalCharacterScopeEnabled] = useState(false);
  const [localTargetCharacterIds, setLocalTargetCharacterIds] = useState<string[]>([]);
  const [localPromptPresetScopeEnabled, setLocalPromptPresetScopeEnabled] = useState(false);
  const [localTargetPromptPresetIds, setLocalTargetPromptPresetIds] = useState<string[]>([]);
  const [localOrder, setLocalOrder] = useState(0);
  const [localMinDepth, setLocalMinDepth] = useState<number | null>(null);
  const [localMaxDepth, setLocalMaxDepth] = useState<number | null>(null);

  const [dirty, setDirty] = useState(false);
  const setEditorDirty = useUIStore((s) => s.setEditorDirty);
  useEffect(() => {
    setEditorDirty(dirty);
  }, [dirty, setEditorDirty]);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // ── Test area ──
  const [testInput, setTestInput] = useState("");

  const characterOptions = useMemo(() => {
    if (!Array.isArray(characters)) return [];
    return characters
      .map((character) => {
        if (!isRecord(character) || typeof character.id !== "string") return null;
        const row = character as Record<string, unknown>;
        const data = parseCharacterData(row.data);
        const name =
          typeof data.name === "string" && data.name.trim()
            ? data.name.trim()
            : typeof row.name === "string" && row.name.trim()
              ? row.name.trim()
              : "Unnamed";
        return { id: character.id, name };
      })
      .filter((character): character is { id: string; name: string } => character !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [characters]);
  const promptPresetOptions = useMemo(
    () =>
      (promptPresets ?? [])
        .map((preset) => ({ id: preset.id, name: preset.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [promptPresets],
  );

  // Populate from DB row or defaults for new
  useEffect(() => {
    if (!regexDetailId) return;
    if (dbRow) {
      setLocalName(dbRow.name);
      setLocalEnabled(dbRow.enabled === "true");
      setLocalFindRegex(dbRow.findRegex);
      setLocalReplaceString(dbRow.replaceString);
      try {
        setLocalTrimStrings(JSON.parse(dbRow.trimStrings));
      } catch {
        setLocalTrimStrings([]);
      }
      try {
        setLocalPlacement(JSON.parse(dbRow.placement));
      } catch {
        setLocalPlacement(["ai_output"]);
      }
      setLocalFlags(dbRow.flags);
      setLocalApplyMode(deriveRegexApplyMode(dbRow));
      const targetCharacterIds = parseStringArray(dbRow.targetCharacterIds);
      setLocalTargetCharacterIds(targetCharacterIds);
      setLocalCharacterScopeEnabled(targetCharacterIds.length > 0);
      const targetPromptPresetIds = parseStringArray(dbRow.targetPromptPresetIds);
      setLocalTargetPromptPresetIds(targetPromptPresetIds);
      setLocalPromptPresetScopeEnabled(targetPromptPresetIds.length > 0);
      setLocalOrder(dbRow.order);
      setLocalMinDepth(dbRow.minDepth);
      setLocalMaxDepth(dbRow.maxDepth);
    } else {
      // New script defaults
      setLocalName("New Regex Script");
      setLocalEnabled(true);
      setLocalFindRegex("");
      setLocalReplaceString("");
      setLocalTrimStrings([]);
      setLocalPlacement(["ai_output"]);
      setLocalFlags("gi");
      setLocalApplyMode("display");
      // Pre-scope when opened from a character's scoped-regex manager.
      const defaultScope = regexDetailDefaultCharacterIds ?? [];
      setLocalTargetCharacterIds(defaultScope);
      setLocalCharacterScopeEnabled(defaultScope.length > 0);
      setLocalTargetPromptPresetIds([]);
      setLocalPromptPresetScopeEnabled(false);
      setLocalOrder(0);
      setLocalMinDepth(null);
      setLocalMaxDepth(null);
    }
    setDirty(false);
    setSaveError(null);
    setTestInput("");
  }, [regexDetailId, dbRow, regexDetailDefaultCharacterIds]);

  // Regex validity check
  const regexError = useMemo(() => {
    if (!localFindRegex) return null;
    try {
      const macroContext = createLiveTestMacroContext(testInput);
      const findRegex = resolveRegexPatternLiteralMacros(localFindRegex, (value) =>
        resolveLiveTestMacros(value, macroContext),
      );
      if (!findRegex) return null;
      if (!isPatternSafe(findRegex)) {
        return "Regex pattern is unsafe: avoid nested quantifiers, ambiguous quantified alternatives, and oversized patterns.";
      }
      new RegExp(findRegex, localFlags);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [localFindRegex, localFlags, testInput]);

  const unchangedUnsafePattern =
    !!dbRow && dbRow.findRegex === localFindRegex && regexError?.startsWith("Regex pattern is unsafe:") === true;
  const blockingRegexError = unchangedUnsafePattern ? null : regexError;
  const depthRangeError =
    localMinDepth != null && localMaxDepth != null && localMinDepth > localMaxDepth
      ? "Minimum depth cannot be greater than maximum depth."
      : null;

  // Test result
  const testResult = useMemo(() => {
    if (!testInput || !localFindRegex || regexError) return testInput;
    try {
      const macroContext = createLiveTestMacroContext(testInput);
      const resolveTestMacros = (value: string) => resolveLiveTestMacros(value, macroContext);
      const findRegex = resolveRegexPatternLiteralMacros(localFindRegex, resolveTestMacros);
      if (!findRegex) return testInput;
      const re = new RegExp(findRegex, localFlags);
      let result = applyRegexReplacement(testInput, re, localReplaceString, resolveTestMacros);
      // Apply trim strings
      for (const trim of localTrimStrings) {
        const resolvedTrim = resolveTestMacros(trim);
        if (resolvedTrim) result = result.split(resolvedTrim).join("");
      }
      return formatTextQuotes(result, quoteFormat);
    } catch {
      return testInput;
    }
  }, [testInput, localFindRegex, localReplaceString, localFlags, localTrimStrings, quoteFormat, regexError]);

  const handleClose = useCallback(() => {
    if (dirty) {
      setShowUnsavedWarning(true);
      return;
    }
    closeRegexDetail();
  }, [dirty, closeRegexDetail]);

  const handleSave = useCallback(async () => {
    if (!regexDetailId) return;
    setSaveError(null);
    if (localCharacterScopeEnabled && localTargetCharacterIds.length === 0) {
      setSaveError(localizeUi("ui.agents.regexscripteditor.chooseAtLeastOneCharacter"));
      return;
    }
    if (localPromptPresetScopeEnabled && localTargetPromptPresetIds.length === 0) {
      setSaveError(localizeUi("ui.agents.regexscripteditor.chooseAtLeastOnePromptPreset"));
      return;
    }
    if (blockingRegexError) {
      setSaveError(blockingRegexError);
      return;
    }
    if (depthRangeError) {
      setSaveError(depthRangeError);
      return;
    }

    const payload: Record<string, unknown> = {
      name: localName,
      enabled: localEnabled,
      findRegex: localFindRegex,
      replaceString: localReplaceString,
      trimStrings: localTrimStrings,
      placement: localPlacement,
      flags: localFlags,
      promptOnly: localApplyMode === "prompt",
      applyMode: localApplyMode,
      targetCharacterIds: localCharacterScopeEnabled ? localTargetCharacterIds : [],
      targetPromptPresetIds: localPromptPresetScopeEnabled ? localTargetPromptPresetIds : [],
      minDepth: localMinDepth,
      maxDepth: localMaxDepth,
    };
    if (dbRow || localOrder !== 0) payload.order = localOrder;

    try {
      if (dbRow) {
        const updatePayload = { ...payload };
        if (dbRow.findRegex === localFindRegex) delete updatePayload.findRegex;
        await updateScript.mutateAsync({ id: dbRow.id, ...updatePayload });
      } else {
        const created = (await createScript.mutateAsync(payload)) as RegexScriptRow | undefined;
        if (created?.id) {
          // Preserve the return target (e.g. back to the character card) across the post-save re-open.
          openRegexDetail(created.id, regexDetailReturn ? { returnTo: regexDetailReturn } : undefined);
        }
      }
      setDirty(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (err) {
      setSaveError(describeRegexEditorError(err));
    }
  }, [
    regexDetailId,
    localName,
    localEnabled,
    localFindRegex,
    localReplaceString,
    localTrimStrings,
    localPlacement,
    localFlags,
    localApplyMode,
    localCharacterScopeEnabled,
    localTargetCharacterIds,
    localPromptPresetScopeEnabled,
    localTargetPromptPresetIds,
    localOrder,
    localMinDepth,
    localMaxDepth,
    blockingRegexError,
    depthRangeError,
    dbRow,
    updateScript,
    createScript,
    openRegexDetail,
    regexDetailReturn,
    localizeUi,
  ]);

  const markDirty = useCallback(() => setDirty(true), []);

  const handleDelete = async () => {
    if (!dbRow) return;
    if (
      !(await showConfirmDialog({
        title: localizeUi("ui.agents.regexscripteditor.deleteRegexScript_d694998"),
        message: localizeUi("dialog.delete.namedPermanent", {
          name: dbRow.name,
        }),
        confirmLabel: localizeUi("lorebook.editor.batch.delete"),
        tone: "destructive",
      }))
    ) {
      return;
    }
    await deleteScript.mutateAsync(dbRow.id);
    closeRegexDetail();
  };

  const togglePlacement = (p: RegexPlacement) => {
    setLocalPlacement((prev) => {
      const has = prev.includes(p);
      if (has && prev.length <= 1) return prev; // Must have at least one
      return has ? prev.filter((x) => x !== p) : [...prev, p];
    });
    markDirty();
  };

  const handleExport = () => {
    downloadJsonFile(
      {
        kind: "marinara.regex-script",
        version: 1,
        exportedAt: new Date().toISOString(),
        name: localName,
        enabled: localEnabled,
        findRegex: localFindRegex,
        replaceString: localReplaceString,
        trimStrings: localTrimStrings,
        placement: localPlacement,
        flags: localFlags,
        promptOnly: localApplyMode === "prompt",
        applyMode: localApplyMode,
        targetCharacterIds: localCharacterScopeEnabled ? localTargetCharacterIds : [],
        targetPromptPresetIds: localPromptPresetScopeEnabled ? localTargetPromptPresetIds : [],
        order: localOrder,
        minDepth: localMinDepth,
        maxDepth: localMaxDepth,
      },
      `${sanitizeExportFilenamePart(localName, "regex-script")}.json`,
    );
  };

  // ── Loading / not found ──
  if (!regexDetailId || (!dbRow && !isNew)) {
    return (
      <div className="mari-editor-shell flex flex-1 items-center justify-center">
        <p className="mari-editor-empty px-4 py-3 text-sm">
          {localizeUi("ui.agents.regexscripteditor.regexScriptNotFound")}
        </p>
      </div>
    );
  }

  const isPending = updateScript.isPending || createScript.isPending;
  const characterScopeError =
    localCharacterScopeEnabled && localTargetCharacterIds.length === 0
      ? localizeUi("ui.agents.regexscripteditor.chooseAtLeastOneCharacter")
      : null;
  const promptPresetScopeError =
    localPromptPresetScopeEnabled && localTargetPromptPresetIds.length === 0
      ? localizeUi("ui.agents.regexscripteditor.chooseAtLeastOnePromptPreset")
      : null;

  return (
    <div className="mari-editor-shell mari-editor-legacy-bridge flex flex-1 flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="mari-editor-header">
        <button
          type="button"
          onClick={handleClose}
          aria-label={localizeUi("ui.agents.regexscripteditor.backToRegexScripts")}
          className="mari-editor-action inline-flex"
        >
          <ArrowLeft size="1.125rem" />
        </button>
        <div className="mari-editor-icon-tile">
          <Regex size="1.125rem" className="max-md:!h-[0.875rem] max-md:!w-[0.875rem]" />
        </div>
        <input
          value={localName}
          onChange={(e) => {
            setLocalName(e.target.value);
            markDirty();
          }}
          className="mari-editor-title-input min-w-0 flex-1 placeholder:text-[var(--marinara-editor-muted)]"
          placeholder={localizeUi("ui.agents.regexscripteditor.scriptName")}
        />
        <div className="mari-editor-actions flex max-md:w-full max-md:justify-end max-md:border-t max-md:border-[var(--marinara-editor-divider)] max-md:pt-2">
          {saveError && (
            <span className="mari-editor-status mr-2 text-red-400">
              <AlertCircle size="0.6875rem" /> {localizeUi("ui.agents.agenteditor.saveFailed")}
            </span>
          )}
          {savedFlash && !dirty && (
            <span className="mari-editor-status mr-2 text-emerald-400">
              <Check size="0.6875rem" /> {localizeUi("chat.settings.inlineEditor.saved")}
            </span>
          )}
          {dirty && !saveError && (
            <span className="mari-editor-status mr-2 text-amber-400">
              {localizeUi("ui.agents.agenteditor.unsaved")}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={
              isPending ||
              !!blockingRegexError ||
              !!characterScopeError ||
              !!promptPresetScopeError ||
              !!depthRangeError
            }
            className="mari-editor-action mari-editor-action--primary inline-flex disabled:opacity-50"
            title={localizeUi("ui.agents.regexscripteditor.saveRegexScript")}
            aria-label={localizeUi("ui.agents.regexscripteditor.saveRegexScript")}
          >
            <Save size="0.8125rem" /> <span className="max-md:hidden">{localizeUi("ui.noodle.noodlehome.save")}</span>
          </button>
          <SettingsSwitch
            ariaLabel={localEnabled ? "Disable regex script" : "Enable regex script"}
            title={
              localEnabled ? localizeUi("ui.noodle.noodlehome.enabled") : localizeUi("ui.agents.agenteditor.disabled")
            }
            checked={localEnabled}
            onChange={(checked) => {
              setLocalEnabled(checked);
              markDirty();
            }}
            className="mari-editor-action inline-flex p-1.5 hover:bg-[var(--accent)]"
          />
          <button
            onClick={handleExport}
            className="mari-editor-action inline-flex"
            title={localizeUi("ui.agents.regexscripteditor.exportRegexScript")}
            aria-label={localizeUi("ui.agents.regexscripteditor.exportRegexScript")}
          >
            <Upload size="0.9375rem" />
          </button>
          {dbRow && (
            <button
              onClick={handleDelete}
              className="mari-editor-action inline-flex"
              title={localizeUi("ui.agents.regexscripteditor.deleteRegexScript")}
              aria-label={localizeUi("ui.agents.regexscripteditor.deleteRegexScript")}
            >
              <Trash2 size="0.9375rem" />
            </button>
          )}
        </div>
      </div>

      {/* Unsaved warning */}
      {showUnsavedWarning && (
        <div className="flex items-center justify-between bg-amber-500/10 px-4 py-2 text-xs text-amber-400">
          <span>{localizeUi("ui.agents.agenteditor.youHaveUnsavedChanges")}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowUnsavedWarning(false)}
              className="rounded-lg px-3 py-1 hover:bg-[var(--accent)]"
            >
              {localizeUi("ui.agents.agenteditor.keepEditing")}
            </button>
            <button
              onClick={() => closeRegexDetail()}
              className="rounded-lg px-3 py-1 text-[var(--destructive)] hover:bg-[var(--destructive)]/15"
            >
              {localizeUi("ui.agents.agenteditor.discard")}
            </button>
            <button
              onClick={async () => {
                await handleSave();
                closeRegexDetail();
              }}
              className="rounded-lg bg-amber-500/20 px-3 py-1 hover:bg-amber-500/30"
            >
              {localizeUi("ui.agents.agenteditor.saveClose")}
            </button>
          </div>
        </div>
      )}

      {/* Save error banner */}
      {saveError && (
        <div className="flex items-center gap-2 bg-red-500/10 px-4 py-2 text-xs text-red-400">
          <AlertCircle size="0.8125rem" />
          <span className="flex-1">{saveError}</span>
          <button onClick={() => setSaveError(null)} className="rounded-lg px-2 py-0.5 hover:bg-red-500/20">
            <X size="0.75rem" />
          </button>
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* ── Find Regex ── */}
          <FieldGroup
            label={localizeUi("ui.agents.regexscripteditor.findPatternRegex")}
            icon={<Regex size="0.875rem" className={REGEX_FIELD_ICON_CLASS} />}
            help={localizeUi("ui.agents.regexscripteditor.theRegularExpressionPatternToSearchForWrittenWithout")}
          >
            <div className="relative">
              <input
                value={localFindRegex}
                onChange={(e) => {
                  setLocalFindRegex(e.target.value);
                  markDirty();
                }}
                className={cn(
                  "w-full rounded-xl bg-[var(--secondary)] px-4 py-2.5 font-mono text-sm ring-1 placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2",
                  regexError ? "ring-red-500/50 focus:ring-red-500" : "ring-[var(--border)] focus:ring-[var(--ring)]",
                )}
                placeholder={localizeUi("ui.agents.regexscripteditor.eG")}
              />
              {regexError && <p className="mt-1 text-[0.625rem] text-red-400">{regexError}</p>}
            </div>
          </FieldGroup>

          {/* ── Replace String ── */}
          <FieldGroup
            label={localizeUi("ui.agents.regexscripteditor.replaceWith")}
            icon={<Info size="0.875rem" className={REGEX_FIELD_ICON_CLASS} />}
            help={localizeUi("ui.agents.regexscripteditor.theReplacementStringSupportsCaptureGroups12Named")}
          >
            <input
              value={localReplaceString}
              onChange={(e) => {
                setLocalReplaceString(e.target.value);
                markDirty();
              }}
              className="w-full rounded-xl bg-[var(--secondary)] px-4 py-2.5 font-mono text-sm ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder={localizeUi("ui.agents.regexscripteditor.eG1OrLeaveEmptyToRemove")}
            />
          </FieldGroup>

          {/* ── Flags ── */}
          <FieldGroup
            label={localizeUi("ui.agents.regexscripteditor.regexFlags")}
            icon={<Info size="0.875rem" className={REGEX_FIELD_ICON_CLASS} />}
            help={localizeUi("ui.agents.regexscripteditor.standardRegexFlagsGGlobalICaseInsensitiveM")}
          >
            <div className="flex items-center gap-2">
              {["g", "i", "m", "s", "u", "y", "d"].map((flag) => {
                const active = localFlags.includes(flag);
                return (
                  <button
                    key={flag}
                    onClick={() => {
                      setLocalFlags((prev) => (active ? prev.replace(flag, "") : prev + flag));
                      markDirty();
                    }}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md font-mono text-sm font-bold ring-1 transition-all",
                      active
                        ? REGEX_ACTIVE_OPTION_CLASS
                        : "text-[var(--muted-foreground)] ring-[var(--border)] hover:bg-[var(--accent)]",
                    )}
                  >
                    {flag}
                  </button>
                );
              })}
            </div>
          </FieldGroup>

          {/* ── Placement ── */}
          <FieldGroup
            label={localizeUi("ui.agents.regexscripteditor.applyTo")}
            icon={<Play size="0.875rem" className={REGEX_FIELD_ICON_CLASS} />}
            help={localizeUi("ui.agents.regexscripteditor.whereThisRegexIsAppliedAiOutputTransformsIncoming")}
          >
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(PLACEMENT_META) as [RegexPlacement, { label: string; description: string }][]).map(
                ([placement, meta]) => {
                  const active = localPlacement.includes(placement);
                  return (
                    <button
                      key={placement}
                      onClick={() => togglePlacement(placement)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl p-3 text-xs ring-1 transition-all",
                        active
                          ? REGEX_ACTIVE_OPTION_CLASS
                          : "ring-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                      )}
                    >
                      <span className="font-medium">{meta.label}</span>
                      <span className="text-[0.5625rem] opacity-70">{meta.description}</span>
                    </button>
                  );
                },
              )}
            </div>
            <div className="rounded-xl bg-[var(--secondary)]/60 p-3 ring-1 ring-[var(--border)]">
              <div className="flex items-start gap-2.5">
                <SettingsSwitch
                  ariaLabel="Toggle character target scope"
                  checked={localCharacterScopeEnabled}
                  onChange={(checked) => {
                    setLocalCharacterScopeEnabled(checked);
                    markDirty();
                  }}
                  className="mt-0.5 shrink-0 p-0 hover:bg-transparent"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <Users size="0.75rem" className={REGEX_FIELD_ICON_CLASS} />
                    {localizeUi("ui.agents.regexscripteditor.specificCharacters")}
                    <HelpTooltip
                      text={localizeUi("ui.agents.regexscripteditor.limitThisScriptToTheSelectedCharactersPromptOnly")}
                    />
                  </div>
                  <div className="mt-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                    {localCharacterScopeEnabled
                      ? localizeUi("ui.agents.regexscripteditor.value1Selected", {
                          value1: localTargetCharacterIds.length,
                        })
                      : localizeUi("ui.agents.regexscripteditor.appliesToAllCharacters")}
                  </div>
                </div>
              </div>
              {localCharacterScopeEnabled && (
                <div>
                  <ScopeTargetPicker
                    icon={<Users size="0.75rem" />}
                    options={characterOptions}
                    selectedIds={localTargetCharacterIds}
                    addLabel={localizeUi("ui.agents.regexscripteditor.addCharacter")}
                    emptyLabel={localizeUi("ui.agents.regexscripteditor.noCharactersFound")}
                    removeLabel={(name) => localizeUi("ui.agents.regexscripteditor.removeValue1", { value1: name })}
                    onAdd={(id) => {
                      setLocalTargetCharacterIds((previous) => [...previous, id]);
                      markDirty();
                    }}
                    onRemove={(id) => {
                      setLocalTargetCharacterIds((previous) => previous.filter((value) => value !== id));
                      markDirty();
                    }}
                  />
                  {characterScopeError && (
                    <div className="mt-2 flex items-center gap-1 text-[0.625rem] font-medium text-amber-400">
                      <AlertCircle size="0.6875rem" /> {characterScopeError}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="rounded-xl bg-[var(--secondary)]/60 p-3 ring-1 ring-[var(--border)]">
              <div className="flex items-start gap-2.5">
                <SettingsSwitch
                  ariaLabel={localizeUi("ui.agents.regexscripteditor.togglePromptPresetScope")}
                  checked={localPromptPresetScopeEnabled}
                  onChange={(checked) => {
                    setLocalPromptPresetScopeEnabled(checked);
                    markDirty();
                  }}
                  className="mt-0.5 shrink-0 p-0 hover:bg-transparent"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <FileText size="0.75rem" className={REGEX_FIELD_ICON_CLASS} />
                    {localizeUi("ui.agents.regexscripteditor.specificPromptPresets")}
                    <HelpTooltip
                      text={localizeUi("ui.agents.regexscripteditor.limitThisScriptToSelectedPromptPresets")}
                    />
                  </div>
                  <div className="mt-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                    {localPromptPresetScopeEnabled
                      ? localizeUi("ui.agents.regexscripteditor.value1Selected", {
                          value1: localTargetPromptPresetIds.length,
                        })
                      : localizeUi("ui.agents.regexscripteditor.appliesToAllPromptPresets")}
                  </div>
                </div>
              </div>
              {localPromptPresetScopeEnabled && (
                <div>
                  <ScopeTargetPicker
                    icon={<FileText size="0.75rem" />}
                    options={promptPresetOptions}
                    selectedIds={localTargetPromptPresetIds}
                    addLabel={localizeUi("ui.agents.regexscripteditor.addPromptPreset")}
                    emptyLabel={localizeUi("ui.agents.regexscripteditor.noPromptPresetsFound")}
                    removeLabel={(name) => localizeUi("ui.agents.regexscripteditor.removeValue1", { value1: name })}
                    onAdd={(id) => {
                      setLocalTargetPromptPresetIds((previous) => [...previous, id]);
                      markDirty();
                    }}
                    onRemove={(id) => {
                      setLocalTargetPromptPresetIds((previous) => previous.filter((value) => value !== id));
                      markDirty();
                    }}
                  />
                  {promptPresetScopeError && (
                    <div className="mt-2 flex items-center gap-1 text-[0.625rem] font-medium text-amber-400">
                      <AlertCircle size="0.6875rem" /> {promptPresetScopeError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </FieldGroup>

          {/* ── Trim Strings ── */}
          <FieldGroup
            label={localizeUi("ui.agents.regexscripteditor.trimStrings")}
            icon={<Minus size="0.875rem" className={REGEX_FIELD_ICON_CLASS} />}
            help={localizeUi("ui.agents.regexscripteditor.additionalStringsToRemoveFromTheResultAfterThe")}
          >
            <div className="flex flex-col gap-1.5">
              {localTrimStrings.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={s}
                    onChange={(e) => {
                      const updated = [...localTrimStrings];
                      updated[i] = e.target.value;
                      setLocalTrimStrings(updated);
                      markDirty();
                    }}
                    className="flex-1 rounded-lg bg-[var(--secondary)] px-3 py-1.5 font-mono text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    placeholder={localizeUi("ui.agents.regexscripteditor.stringToTrim")}
                  />
                  <button
                    onClick={() => {
                      setLocalTrimStrings((prev) => prev.filter((_, j) => j !== i));
                      markDirty();
                    }}
                    className="rounded-md p-1 text-[var(--destructive)] hover:bg-[var(--destructive)]/15"
                  >
                    <X size="0.75rem" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  setLocalTrimStrings((prev) => [...prev, ""]);
                  markDirty();
                }}
                className="flex items-center gap-1 self-start rounded-lg px-2.5 py-1.5 text-[0.625rem] font-medium text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              >
                <Plus size="0.625rem" /> {localizeUi("ui.agents.regexscripteditor.addTrimString")}
              </button>
            </div>
          </FieldGroup>

          {/* ── Advanced Options ── */}
          <FieldGroup
            label={localizeUi("ui.agents.regexscripteditor.advancedOptions")}
            icon={<Info size="0.875rem" className={REGEX_FIELD_ICON_CLASS} />}
            help={localizeUi("ui.agents.regexscripteditor.fineTuneWhenAndHowTheRegexRuns")}
          >
            <div className="space-y-3">
              {/* Apply mode */}
              <div className="space-y-2">
                <div className="text-xs font-medium">{localizeUi("ui.agents.regexscripteditor.applyMode")}</div>
                <div className="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
                  {(Object.entries(APPLY_MODE_META) as [RegexApplyMode, { label: string; description: string }][]).map(
                    ([mode, meta]) => {
                      const active = localApplyMode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => {
                            setLocalApplyMode(mode);
                            markDirty();
                          }}
                          className={cn(
                            "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-center text-xs ring-1 transition-all",
                            active
                              ? REGEX_ACTIVE_OPTION_CLASS
                              : "ring-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
                          )}
                        >
                          <span className="font-medium">{meta.label}</span>
                          <span className="text-[0.5625rem] leading-snug opacity-70">{meta.description}</span>
                        </button>
                      );
                    },
                  )}
                </div>
              </div>

              {/* Order */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium w-24">
                  {localizeUi("ui.agents.regexscripteditor.executionOrder")}
                </span>
                <DraftNumberInput
                  value={localOrder}
                  onCommit={(value) => {
                    setLocalOrder(value);
                    markDirty();
                  }}
                  selectOnFocus
                  className="w-20 rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-xs ring-1 ring-transparent focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.agents.regexscripteditor.lowerNumbersRunFirst")}
                </span>
              </div>

              {/* Depth range */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium w-24">{localizeUi("ui.agents.regexscripteditor.depthRange")}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={localMinDepth ?? ""}
                  onChange={(e) => {
                    if (!/^\d*$/.test(e.target.value)) return;
                    setLocalMinDepth(e.target.value ? parseInt(e.target.value, 10) : null);
                    markDirty();
                  }}
                  className="w-16 rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-xs ring-1 ring-transparent focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  placeholder={localizeUi("ui.agents.regexscripteditor.min")}
                />
                <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.noodle.wizardfooter.to")}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={localMaxDepth ?? ""}
                  onChange={(e) => {
                    if (!/^\d*$/.test(e.target.value)) return;
                    setLocalMaxDepth(e.target.value ? parseInt(e.target.value, 10) : null);
                    markDirty();
                  }}
                  className="w-16 rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-xs ring-1 ring-transparent focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  placeholder={localizeUi("ui.agents.regexscripteditor.max")}
                />
                <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.agents.regexscripteditor.messageDepthEmptyUnlimited")}
                </span>
              </div>
              {depthRangeError && (
                <div className="flex items-center gap-1 text-[0.625rem] font-medium text-red-400">
                  <AlertCircle size="0.6875rem" /> {depthRangeError}
                </div>
              )}
            </div>
          </FieldGroup>

          {/* ── Live Test ── */}
          <FieldGroup
            label={localizeUi("ui.agents.regexscripteditor.liveTest")}
            icon={<Play size="0.875rem" className={REGEX_FIELD_ICON_CLASS} />}
            help={localizeUi("ui.agents.regexscripteditor.testYourRegexPatternAgainstSampleTextMacrosUse")}
          >
            <div className="space-y-2">
              <textarea
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                rows={3}
                className="w-full resize-y rounded-xl bg-[var(--secondary)] px-4 py-3 font-mono text-xs leading-relaxed ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                placeholder={localizeUi("ui.agents.regexscripteditor.pasteSampleTextToTest")}
              />
              <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.agents.regexscripteditor.patternPreviewOnlyPlacementEnabledStateCharacterScopeAnd")}
              </p>
              {testInput && (
                <div className="rounded-xl bg-[var(--card)] p-4 ring-1 ring-[var(--border)]">
                  <div className="mb-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                    {localizeUi("ui.agents.regexscripteditor.result")}
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-emerald-400">
                    {testResult}
                  </pre>
                </div>
              )}
            </div>
          </FieldGroup>

          {/* ── Info Card ── */}
          <div className="rounded-xl bg-[var(--card)] p-4 ring-1 ring-[var(--border)]">
            <h3 className="mb-2 text-xs font-semibold text-[var(--foreground)]">
              {localizeUi("ui.agents.regexscripteditor.aboutRegexScripts")}
            </h3>
            <div className="space-y-1.5 text-[0.6875rem] text-[var(--muted-foreground)]">
              <p>{localizeUi("ui.agents.regexscripteditor.regexScriptsAreAppliedToTextDuringChatEither")}</p>
              <p>
                {localizeUi("ui.agents.regexscripteditor.scriptsRunInOrderLowestFirstUseCaptureGroups")}
                <code className="rounded bg-[var(--secondary)] px-1">$1</code>,{" "}
                <code className="rounded bg-[var(--secondary)] px-1">$2</code>
                {localizeUi("ui.agents.regexscripteditor.inTheReplacementToReferenceMatchedGroupsUse")}{" "}
                <code className="rounded bg-[var(--secondary)] px-1">{"\\u$1"}</code>{" "}
                {localizeUi("ui.agents.regexscripteditor.toCapitalizeTheFirstCharacterOfACaptureOr")}{" "}
                <code className="rounded bg-[var(--secondary)] px-1">{"\\U$1\\E"}</code>{" "}
                {localizeUi("ui.agents.regexscripteditor.toUppercaseACapture")}
              </p>
              <p>
                <strong className="text-[var(--foreground)]">
                  {localizeUi("ui.agents.regexscripteditor.examples")}
                </strong>
              </p>
              <ul className="ml-4 list-disc space-y-0.5">
                <li>
                  {localizeUi("ui.agents.regexscripteditor.removeAsterisks")}{" "}
                  <code className="rounded bg-[var(--secondary)] px-1">{"\\*([^*]+)\\*"}</code> →{" "}
                  <code className="rounded bg-[var(--secondary)] px-1">$1</code>
                </li>
                <li>
                  {localizeUi("ui.agents.regexscripteditor.removeOoc")}{" "}
                  <code className="rounded bg-[var(--secondary)] px-1">{"\\(OOC:.*?\\)"}</code>{" "}
                  {localizeUi("ui.agents.regexscripteditor.empty")}
                </li>
                <li>
                  {localizeUi("ui.agents.regexscripteditor.censorWords")}{" "}
                  <code className="rounded bg-[var(--secondary)] px-1">{"\\bbadword\\b"}</code> →{" "}
                  <code className="rounded bg-[var(--secondary)] px-1">***</code>
                </li>
                <li>
                  {localizeUi("ui.agents.regexscripteditor.capitalizeReplacement")}{" "}
                  <code className="rounded bg-[var(--secondary)] px-1">{"\\U$1"}</code>
                </li>
              </ul>
              {dbRow && (
                <p className="mt-2">
                  <strong className="text-[var(--foreground)]">{localizeUi("ui.agents.regexscripteditor.id")}</strong>{" "}
                  {dbRow.id}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  Field Group wrapper (same pattern as AgentEditor)
// ═══════════════════════════════════════════════
function FieldGroup({
  label,
  icon,
  help,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mari-editor-panel space-y-2 p-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold">{label}</span>
        {help && <HelpTooltip text={help} />}
      </div>
      {children}
    </div>
  );
}
