// ──────────────────────────────────────────────
// Full-Page Regex Script Editor
// ──────────────────────────────────────────────
import { useState, useCallback, useEffect, useMemo } from "react";
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

function deriveRegexApplyMode(row: Pick<RegexScriptRow, "applyMode" | "promptOnly"> | null | undefined): RegexApplyMode {
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

// ═══════════════════════════════════════════════
//  Main Editor
// ═══════════════════════════════════════════════
export function RegexScriptEditor() {
  const regexDetailId = useUIStore((s) => s.regexDetailId);
  const regexDetailDefaultCharacterIds = useUIStore((s) => s.regexDetailDefaultCharacterIds);
  const regexDetailReturn = useUIStore((s) => s.regexDetailReturn);
  const closeRegexDetail = useUIStore((s) => s.closeRegexDetail);
  const openRegexDetail = useUIStore((s) => s.openRegexDetail);
  const quoteFormat = useUIStore((s) => s.quoteFormat);

  const { data: regexScripts } = useRegexScripts();
  const { data: characters } = useCharacters();
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
      setSaveError("Choose at least one target character.");
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
  ]);

  const markDirty = useCallback(() => setDirty(true), []);

  const handleDelete = async () => {
    if (!dbRow) return;
    if (
      !(await showConfirmDialog({
        title: "Delete Regex Script",
        message: "Delete this regex script? This cannot be undone.",
        confirmLabel: "Delete",
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

  const toggleTargetCharacter = (characterId: string) => {
    setLocalTargetCharacterIds((prev) =>
      prev.includes(characterId) ? prev.filter((id) => id !== characterId) : [...prev, characterId],
    );
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
          Regex script not found.
        </p>
      </div>
    );
  }

  const isPending = updateScript.isPending || createScript.isPending;
  const characterScopeError =
    localCharacterScopeEnabled && localTargetCharacterIds.length === 0 ? "Choose at least one character." : null;

  return (
    <div className="mari-editor-shell mari-editor-legacy-bridge flex flex-1 flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="mari-editor-header">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Back to regex scripts"
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
          placeholder="Script name…"
        />
        <div className="mari-editor-actions flex max-md:w-full max-md:justify-end max-md:border-t max-md:border-[var(--marinara-editor-divider)] max-md:pt-2">
          {saveError && (
            <span className="mari-editor-status mr-2 text-red-400">
              <AlertCircle size="0.6875rem" /> Save failed
            </span>
          )}
          {savedFlash && !dirty && (
            <span className="mari-editor-status mr-2 text-emerald-400">
              <Check size="0.6875rem" /> Saved
            </span>
          )}
          {dirty && !saveError && <span className="mari-editor-status mr-2 text-amber-400">Unsaved</span>}
          <button
            onClick={handleSave}
            disabled={isPending || !!blockingRegexError || !!characterScopeError || !!depthRangeError}
            className="mari-editor-action mari-editor-action--primary inline-flex disabled:opacity-50"
            title="Save regex script"
            aria-label="Save regex script"
          >
            <Save size="0.8125rem" /> <span className="max-md:hidden">Save</span>
          </button>
          <SettingsSwitch
            ariaLabel={localEnabled ? "Disable regex script" : "Enable regex script"}
            title={localEnabled ? "Enabled" : "Disabled"}
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
            title="Export regex script"
            aria-label="Export regex script"
          >
            <Upload size="0.9375rem" />
          </button>
          {dbRow && (
            <button
              onClick={handleDelete}
              className="mari-editor-action inline-flex"
              title="Delete regex script"
              aria-label="Delete regex script"
            >
              <Trash2 size="0.9375rem" />
            </button>
          )}
        </div>
      </div>

      {/* Unsaved warning */}
      {showUnsavedWarning && (
        <div className="flex items-center justify-between bg-amber-500/10 px-4 py-2 text-xs text-amber-400">
          <span>You have unsaved changes.</span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowUnsavedWarning(false)}
              className="rounded-lg px-3 py-1 hover:bg-[var(--accent)]"
            >
              Keep editing
            </button>
            <button
              onClick={() => closeRegexDetail()}
              className="rounded-lg px-3 py-1 text-[var(--destructive)] hover:bg-[var(--destructive)]/15"
            >
              Discard
            </button>
            <button
              onClick={async () => {
                await handleSave();
                closeRegexDetail();
              }}
              className="rounded-lg bg-amber-500/20 px-3 py-1 hover:bg-amber-500/30"
            >
              Save & close
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
            label="Find Pattern (Regex)"
            icon={<Regex size="0.875rem" className={REGEX_FIELD_ICON_CLASS} />}
            help="The regular expression pattern to search for. Written without delimiters. Macros resolve with sample values in Live Test and chat values at runtime."
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
                placeholder="e.g. \\*([^*]+)\\*"
              />
              {regexError && <p className="mt-1 text-[0.625rem] text-red-400">{regexError}</p>}
            </div>
          </FieldGroup>

          {/* ── Replace String ── */}
          <FieldGroup
            label="Replace With"
            icon={<Info size="0.875rem" className={REGEX_FIELD_ICON_CLASS} />}
            help={
              "The replacement string. Supports capture groups ($1, $2), named groups ($<name>), and case transforms before captures like \\u$1, \\U$1\\E, \\l$1, and \\L$1\\E. Literal backslash text such as C:\\Users is preserved."
            }
          >
            <input
              value={localReplaceString}
              onChange={(e) => {
                setLocalReplaceString(e.target.value);
                markDirty();
              }}
              className="w-full rounded-xl bg-[var(--secondary)] px-4 py-2.5 font-mono text-sm ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder="e.g. $1 or leave empty to remove"
            />
          </FieldGroup>

          {/* ── Flags ── */}
          <FieldGroup
            label="Regex Flags"
            icon={<Info size="0.875rem" className={REGEX_FIELD_ICON_CLASS} />}
            help="Standard regex flags: g (global), i (case-insensitive), m (multiline), s (dotAll), u (unicode), y (sticky), d (match indices). Duplicate or unsupported flags are rejected."
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
                      "flex h-8 w-8 items-center justify-center rounded-lg font-mono text-sm font-bold ring-1 transition-all",
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
            label="Apply To"
            icon={<Play size="0.875rem" className={REGEX_FIELD_ICON_CLASS} />}
            help="Where this regex is applied. AI Output transforms incoming responses; User Input transforms your messages before sending."
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
                    Specific Characters
                    <HelpTooltip text="Limit this script to the selected characters. Prompt-only scripts then run only for those characters' prompts; display scripts apply per the chat's Scoped Regex mode." />
                  </div>
                  <div className="mt-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                    {localCharacterScopeEnabled
                      ? `${localTargetCharacterIds.length} selected`
                      : "Applies to all characters"}
                  </div>
                </div>
              </div>
              {localCharacterScopeEnabled && (
                <div className="mt-3 rounded-lg bg-[var(--background)]/60 p-2 ring-1 ring-[var(--border)]">
                  {characterOptions.length > 0 ? (
                    <div className="grid max-h-36 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                      {characterOptions.map((character) => {
                        const selected = localTargetCharacterIds.includes(character.id);
                        return (
                          <button
                            key={character.id}
                            type="button"
                            onClick={() => toggleTargetCharacter(character.id)}
                            title={character.name}
                            className={cn(
                              "flex min-w-0 items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[0.6875rem] ring-1 transition-all",
                              selected
                                ? REGEX_ACTIVE_OPTION_CLASS
                                : "text-[var(--muted-foreground)] ring-[var(--border)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                            )}
                          >
                            <span className="min-w-0 truncate">{character.name}</span>
                            {selected && <Check size="0.6875rem" className="shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-2 py-1 text-[0.6875rem] text-[var(--muted-foreground)]">
                      No characters found.
                    </div>
                  )}
                  {characterScopeError && (
                    <div className="mt-2 flex items-center gap-1 text-[0.625rem] font-medium text-amber-400">
                      <AlertCircle size="0.6875rem" /> {characterScopeError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </FieldGroup>

          {/* ── Trim Strings ── */}
          <FieldGroup
            label="Trim Strings"
            icon={<Minus size="0.875rem" className={REGEX_FIELD_ICON_CLASS} />}
            help="Additional strings to remove from the result after the regex replacement. One per row."
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
                    placeholder="String to trim…"
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
                <Plus size="0.625rem" /> Add trim string
              </button>
            </div>
          </FieldGroup>

          {/* ── Advanced Options ── */}
          <FieldGroup
            label="Advanced Options"
            icon={<Info size="0.875rem" className={REGEX_FIELD_ICON_CLASS} />}
            help="Fine-tune when and how the regex runs."
          >
            <div className="space-y-3">
              {/* Apply mode */}
              <div className="space-y-2">
                <div className="text-xs font-medium">Apply Mode</div>
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
                <span className="text-xs font-medium w-24">Execution Order</span>
                <DraftNumberInput
                  value={localOrder}
                  onCommit={(value) => {
                    setLocalOrder(value);
                    markDirty();
                  }}
                  selectOnFocus
                  className="w-20 rounded-lg bg-[var(--secondary)] px-2.5 py-1.5 text-xs ring-1 ring-transparent focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                <span className="text-[0.625rem] text-[var(--muted-foreground)]">Lower numbers run first</span>
              </div>

              {/* Depth range */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium w-24">Depth Range</span>
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
                  placeholder="Min"
                />
                <span className="text-[0.625rem] text-[var(--muted-foreground)]">to</span>
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
                  placeholder="Max"
                />
                <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                  message depth (empty = unlimited)
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
            label="Live Test"
            icon={<Play size="0.875rem" className={REGEX_FIELD_ICON_CLASS} />}
            help="Test your regex pattern against sample text. Macros use sample User and Character values here."
          >
            <div className="space-y-2">
              <textarea
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                rows={3}
                className="w-full resize-y rounded-xl bg-[var(--secondary)] px-4 py-3 font-mono text-xs leading-relaxed ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                placeholder="Paste sample text to test…"
              />
              <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                Pattern preview only: placement, enabled state, character scope, and depth are evaluated at runtime.
              </p>
              {testInput && (
                <div className="rounded-xl bg-[var(--card)] p-4 ring-1 ring-[var(--border)]">
                  <div className="mb-1 text-[0.625rem] font-medium text-[var(--muted-foreground)]">Result:</div>
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-emerald-400">
                    {testResult}
                  </pre>
                </div>
              )}
            </div>
          </FieldGroup>

          {/* ── Info Card ── */}
          <div className="rounded-xl bg-[var(--card)] p-4 ring-1 ring-[var(--border)]">
            <h3 className="mb-2 text-xs font-semibold text-[var(--foreground)]">About Regex Scripts</h3>
            <div className="space-y-1.5 text-[0.6875rem] text-[var(--muted-foreground)]">
              <p>
                Regex scripts are applied to text during chat — either transforming AI responses before display, or
                modifying your input before it's sent.
              </p>
              <p>
                Scripts run in order (lowest first). Use capture groups (
                <code className="rounded bg-[var(--secondary)] px-1">$1</code>,{" "}
                <code className="rounded bg-[var(--secondary)] px-1">$2</code>) in the replacement to reference matched
                groups. Use <code className="rounded bg-[var(--secondary)] px-1">\u$1</code> to capitalize the first
                character of a capture, or <code className="rounded bg-[var(--secondary)] px-1">\U$1\E</code> to
                uppercase a capture.
              </p>
              <p>
                <strong className="text-[var(--foreground)]">Examples:</strong>
              </p>
              <ul className="ml-4 list-disc space-y-0.5">
                <li>
                  Remove asterisks: <code className="rounded bg-[var(--secondary)] px-1">\\*([^*]+)\\*</code> →{" "}
                  <code className="rounded bg-[var(--secondary)] px-1">$1</code>
                </li>
                <li>
                  Remove OOC: <code className="rounded bg-[var(--secondary)] px-1">\\(OOC:.*?\\)</code> → (empty)
                </li>
                <li>
                  Censor words: <code className="rounded bg-[var(--secondary)] px-1">\\bbadword\\b</code> →{" "}
                  <code className="rounded bg-[var(--secondary)] px-1">***</code>
                </li>
                <li>
                  Capitalize replacement: <code className="rounded bg-[var(--secondary)] px-1">\U$1</code>
                </li>
              </ul>
              {dbRow && (
                <p className="mt-2">
                  <strong className="text-[var(--foreground)]">ID:</strong> {dbRow.id}
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
