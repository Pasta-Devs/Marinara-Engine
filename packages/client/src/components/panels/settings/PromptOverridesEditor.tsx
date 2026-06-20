// ──────────────────────────────────────────────
// Settings: registered prompt overrides editor
// ──────────────────────────────────────────────
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Code2, FileText, Loader2, RotateCcw, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  usePromptOverride,
  usePromptOverrideDefault,
  usePromptOverrides,
  useResetPromptOverride,
  useSavePromptOverride,
  type PromptOverrideSummary,
} from "../../../hooks/use-prompt-overrides";
import { ApiError } from "../../../lib/api-client";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { cn } from "../../../lib/utils";
import { HelpTooltip } from "../../ui/HelpTooltip";
import { SettingsSwitch } from "./SettingControls";

const PREFERRED_PROMPT_KEY = "conversation.selfie";

type PromptOverridesEditorProps = {
  title?: string;
  description?: string;
  help?: string;
  keys?: readonly string[];
  preferredKey?: string;
  defaultOpen?: boolean;
};

function humanizePromptKey(key: string) {
  return key
    .replace(/\./g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function promptOverrideStatus(entry: PromptOverrideSummary | undefined) {
  if (!entry?.hasOverride)
    return { label: "Default", className: "bg-[var(--secondary)] text-[var(--muted-foreground)]" };
  if (entry.enabled) {
    return { label: "Custom active", className: "bg-[var(--primary)]/15 text-[var(--primary)]" };
  }
  return { label: "Custom paused", className: "bg-amber-500/15 text-amber-300" };
}

function getPromptOverrideErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.payload && typeof error.payload === "object") {
    const payload = error.payload as { unknownVariables?: unknown; error?: unknown };
    if (Array.isArray(payload.unknownVariables) && payload.unknownVariables.length > 0) {
      return `Unknown variable${payload.unknownVariables.length === 1 ? "" : "s"}: ${payload.unknownVariables.join(", ")}`;
    }
    if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
  }
  return error instanceof Error ? error.message : "Failed to save prompt override.";
}

function buildEditableDefaultTemplate(
  renderedDefault: string,
  exampleContext: Record<string, string | number | undefined> | undefined,
  variables: Array<{ name: string; example?: string }>,
) {
  if (!renderedDefault || !exampleContext) return renderedDefault;
  let template = renderedDefault;
  const replacements = variables
    .map((variable) => {
      const value = exampleContext[variable.name] ?? variable.example;
      const example = value === undefined || value === null ? "" : String(value);
      return { example, token: "$" + "{" + variable.name + "}" };
    })
    .filter((item) => item.example.length > 1)
    .sort((a, b) => b.example.length - a.example.length);

  for (const { example, token } of replacements) {
    template = template.split(example).join(token);
  }
  return template;
}

function renderTemplatePreview(
  template: string,
  exampleContext: Record<string, string | number | undefined> | undefined,
  variables: Array<{ name: string; example?: string }>,
) {
  const declared = new Set(variables.map((variable) => variable.name));
  const unknownVariables = new Set<string>();
  const rendered = template.replace(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (token, name: string) => {
    if (!declared.has(name)) {
      unknownVariables.add(name);
      return token;
    }
    const value = exampleContext?.[name] ?? variables.find((variable) => variable.name === name)?.example ?? "";
    return String(value);
  });
  return { rendered, unknownVariables: Array.from(unknownVariables) };
}

export function PromptOverridesEditor({
  title = "Prompt Overrides",
  description = "Edit the templates used by image and sprite prompt builders.",
  help = "Global templates for registered prompt builders. Chat-specific selfie prompts still override the global conversation selfie template.",
  keys,
  preferredKey = PREFERRED_PROMPT_KEY,
  defaultOpen = false,
}: PromptOverridesEditorProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [hasOpened, setHasOpened] = useState(defaultOpen);
  const contentId = useId();

  const toggleOpen = () => {
    setHasOpened(true);
    setIsOpen((open) => !open);
  };

  return (
    <section className="overflow-hidden rounded-xl bg-[var(--secondary)]/40 ring-1 ring-[var(--border)]">
      <div className="flex items-start gap-2 p-3">
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={isOpen}
          aria-controls={contentId}
          className="flex min-w-0 flex-1 items-start gap-2 rounded-lg text-left transition-colors hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          <ChevronDown
            size="0.875rem"
            className={cn(
              "mt-0.5 shrink-0 text-[var(--muted-foreground)] transition-transform",
              !isOpen && "-rotate-90",
            )}
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <FileText size="0.75rem" className="text-[var(--muted-foreground)]" />
              <span className="text-xs font-medium text-[var(--foreground)]">{title}</span>
            </span>
            <span className="mt-1 block text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
              {description}
            </span>
          </span>
        </button>
        <span className="mt-0.5 shrink-0">
          <HelpTooltip text={help} />
        </span>
      </div>

      {hasOpened && (
        <div id={contentId} hidden={!isOpen} className="border-t border-[var(--border)]/70 p-3 pt-2.5">
          <PromptOverridesEditorBody keys={keys} preferredKey={preferredKey} />
        </div>
      )}
    </section>
  );
}

function PromptOverridesEditorBody({ keys, preferredKey }: { keys?: readonly string[]; preferredKey: string }) {
  const { data: entries = [], isLoading: loadingEntries, isError: listFailed } = usePromptOverrides();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const keySet = useMemo(() => (keys ? new Set(keys) : null), [keys]);
  const filteredEntries = useMemo(
    () => (keySet ? entries.filter((entry) => keySet.has(entry.key)) : entries),
    [entries, keySet],
  );
  const selectedEntry = useMemo(
    () => filteredEntries.find((entry) => entry.key === selectedKey),
    [filteredEntries, selectedKey],
  );
  const detailQuery = usePromptOverride(selectedKey);
  const defaultQuery = usePromptOverrideDefault(selectedKey);
  const saveOverride = useSavePromptOverride();
  const resetOverride = useResetPromptOverride();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedKey || filteredEntries.length === 0) return;
    setSelectedKey(filteredEntries.some((entry) => entry.key === preferredKey) ? preferredKey : filteredEntries[0].key);
  }, [filteredEntries, preferredKey, selectedKey]);

  useEffect(() => {
    if (!selectedKey || filteredEntries.length === 0) return;
    if (!filteredEntries.some((entry) => entry.key === selectedKey)) setSelectedKey(filteredEntries[0].key);
  }, [filteredEntries, selectedKey]);

  const detail = detailQuery.data;
  const variables = useMemo(
    () => detail?.variables ?? selectedEntry?.variables ?? [],
    [detail?.variables, selectedEntry?.variables],
  );
  const defaultTemplate = useMemo(
    () => buildEditableDefaultTemplate(defaultQuery.data?.template ?? "", defaultQuery.data?.exampleContext, variables),
    [defaultQuery.data?.exampleContext, defaultQuery.data?.template, variables],
  );
  const sourceTemplate = detail?.override?.template ?? defaultTemplate;
  const sourceEnabled = detail?.override?.enabled ?? true;
  const loadingPrompt = !!selectedKey && (detailQuery.isLoading || defaultQuery.isLoading);
  const status = promptOverrideStatus(selectedEntry);
  const isDirty = draft !== sourceTemplate || enabled !== sourceEnabled;
  const canSave = !!selectedKey && draft.trim().length > 0 && isDirty && !saveOverride.isPending && !loadingPrompt;
  const canReset = !!selectedKey && (detail?.override || draft !== defaultTemplate) && !resetOverride.isPending;
  const renderedPreview = useMemo(
    () => renderTemplatePreview(draft, defaultQuery.data?.exampleContext, variables),
    [defaultQuery.data?.exampleContext, draft, variables],
  );

  useEffect(() => {
    if (!selectedKey || !defaultQuery.data || detailQuery.isLoading) return;
    setDraft(sourceTemplate);
    setEnabled(sourceEnabled);
    setLastError(null);
  }, [defaultQuery.data, detailQuery.isLoading, selectedKey, sourceEnabled, sourceTemplate]);

  const insertVariable = (name: string) => {
    const token = "$" + "{" + name + "}";
    const textarea = textareaRef.current;
    if (!textarea) {
      setDraft((current) => `${current}${token}`);
      return;
    }
    const start = textarea.selectionStart ?? draft.length;
    const end = textarea.selectionEnd ?? draft.length;
    const nextDraft = `${draft.slice(0, start)}${token}${draft.slice(end)}`;
    setDraft(nextDraft);
    setLastError(null);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + token.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const handleSave = async () => {
    if (!selectedKey) return;
    if (!draft.trim()) {
      setLastError("Template must not be empty.");
      return;
    }
    try {
      setLastError(null);
      await saveOverride.mutateAsync({ key: selectedKey, template: draft, enabled });
      toast.success("Prompt override saved.");
    } catch (error) {
      const message = getPromptOverrideErrorMessage(error);
      setLastError(message);
      toast.error(message);
    }
  };

  const handleReset = async () => {
    if (!selectedKey) return;
    if (!detail?.override) {
      setDraft(defaultTemplate);
      setEnabled(true);
      setLastError(null);
      return;
    }

    const confirmed = await showConfirmDialog({
      title: "Reset prompt override?",
      message: `${humanizePromptKey(selectedKey)} will use its built-in default again. Your custom template for this key will be removed.`,
      confirmLabel: "Reset to Default",
      cancelLabel: "Cancel",
      tone: "destructive",
    });
    if (!confirmed) return;

    try {
      setLastError(null);
      await resetOverride.mutateAsync(selectedKey);
      setDraft(defaultTemplate);
      setEnabled(true);
      toast.success("Prompt override reset to default.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reset prompt override.";
      setLastError(message);
      toast.error(message);
    }
  };

  if (listFailed) {
    return (
      <div className="flex items-start gap-2 text-xs text-[var(--destructive)]">
        <AlertTriangle size="0.875rem" className="mt-0.5 shrink-0" />
        Could not load registered prompt overrides.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <label className="flex flex-col gap-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Registered prompt</span>
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[0.5625rem] font-semibold", status.className)}>
            {loadingEntries ? "Loading" : status.label}
          </span>
        </span>
        <select
          value={selectedKey ?? ""}
          disabled={loadingEntries || filteredEntries.length === 0}
          onChange={(event) => setSelectedKey(event.target.value)}
          className="w-full rounded-lg bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] focus:ring-[var(--primary)] disabled:opacity-60"
        >
          {loadingEntries && <option value="">Loading prompts...</option>}
          {!loadingEntries && filteredEntries.length === 0 && <option value="">No registered prompts</option>}
          {filteredEntries.map((entry) => (
            <option key={entry.key} value={entry.key}>
              {humanizePromptKey(entry.key)}
            </option>
          ))}
        </select>
      </label>

      {selectedEntry && (
        <p className="rounded-lg bg-[var(--background)]/50 px-2.5 py-2 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)] ring-1 ring-[var(--border)]/70">
          {selectedEntry.description}
        </p>
      )}

      {variables.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Available variables</span>
          <div className="flex flex-wrap gap-1.5">
            {variables.map((variable) => (
              <button
                type="button"
                key={variable.name}
                onClick={() => insertVariable(variable.name)}
                title={variable.description}
                className="inline-flex items-center gap-1 rounded-md bg-[var(--background)] px-2 py-1 font-mono text-[0.6rem] text-[var(--primary)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]"
              >
                <Code2 size="0.625rem" />
                {"${" + variable.name + "}"}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Template</span>
          <span className="text-[0.5625rem] text-[var(--muted-foreground)]">{draft.length} chars</span>
        </div>
        <textarea
          ref={textareaRef}
          value={loadingPrompt ? "" : draft}
          disabled={loadingPrompt || !selectedKey}
          onChange={(event) => {
            setDraft(event.target.value);
            setLastError(null);
          }}
          placeholder={loadingPrompt ? "Loading template..." : "Write a prompt template..."}
          className="min-h-52 resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] p-2.5 font-mono text-[0.6875rem] leading-relaxed text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)]/45 focus:border-[var(--primary)]/50 disabled:cursor-wait disabled:opacity-60"
        />
      </label>

      <div className="rounded-lg bg-[var(--background)]/55 p-2.5 ring-1 ring-[var(--border)]/70">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Rendered preview</span>
          <span className="text-[0.5625rem] text-[var(--muted-foreground)]">Example values</span>
        </div>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-[var(--secondary)]/70 p-2 font-mono text-[0.625rem] leading-relaxed text-[var(--foreground)]">
          {loadingPrompt ? "Loading preview..." : renderedPreview.rendered || "Nothing to preview yet."}
        </pre>
        {renderedPreview.unknownVariables.length > 0 && (
          <p className="mt-1.5 text-[0.5625rem] text-amber-500">
            Unknown variables: {renderedPreview.unknownVariables.join(", ")}
          </p>
        )}
      </div>

      <SettingsSwitch
        label="Apply this override"
        description="Turn this off to keep the template saved without using it."
        checked={enabled}
        disabled={loadingPrompt || !selectedKey}
        onChange={setEnabled}
        labelPosition="start"
        className="justify-between rounded-lg bg-[var(--background)]/45 px-2.5 py-2 ring-1 ring-[var(--border)]/70"
        labelClassName="text-xs font-medium text-[var(--foreground)]"
      />

      {lastError && (
        <div className="flex items-start gap-1.5 rounded-lg bg-[var(--destructive)]/10 px-2.5 py-2 text-[0.625rem] text-[var(--destructive)] ring-1 ring-[var(--destructive)]/20">
          <AlertTriangle size="0.75rem" className="mt-0.5 shrink-0" />
          <span>{lastError}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          className={cn(
            "mari-chrome-control flex-1 text-xs disabled:cursor-not-allowed",
            canSave && "mari-chrome-control--selected",
          )}
        >
          {saveOverride.isPending ? <Loader2 size="0.8125rem" className="animate-spin" /> : <Save size="0.8125rem" />}
          Save
        </button>
        <button
          type="button"
          onClick={() => void handleReset()}
          disabled={!canReset}
          className="mari-chrome-control flex-1 text-xs disabled:cursor-not-allowed"
        >
          {resetOverride.isPending ? (
            <Loader2 size="0.8125rem" className="animate-spin" />
          ) : detail?.override ? (
            <RotateCcw size="0.8125rem" />
          ) : (
            <Sparkles size="0.8125rem" />
          )}
          Reset to Default
        </button>
      </div>

      {detail?.override && !isDirty && (
        <div className="flex items-center gap-1.5 text-[0.625rem] text-[var(--muted-foreground)]">
          <Check size="0.6875rem" className="text-green-500" />
          Saved {new Date(detail.override.updatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
