// ──────────────────────────────────────────────
// State Editor — a reusable editor for structured state.
// Sections list, search across every section, a JSON draft per section, and a
// review diff before saving. Each section shows as Fields (simple values as
// inputs) or JSON; both write the same draft. It knows nothing about where the state comes from:
// the caller passes sections and a save function (see lib/state-editor).
// ──────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Braces,
  ChevronRight,
  ListTree,
  Loader2,
  Lock,
  RotateCcw,
  Search,
  Wand2,
  X,
} from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { UnifiedLineDiff } from "../../chat/MariUnifiedDiff";
import { StateFieldsView } from "./StateFieldsView";
import { StateJsonField } from "./StateJsonField";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { cn } from "../../../lib/utils";
import {
  collectStateChanges,
  getStateSectionDraftStatus,
  layoutStateJson,
  parseStateDraft,
  searchStateSections,
  type StateJsonLayout,
  type StateSearchResult,
  type StateSectionDraftStatus,
} from "../../../lib/state-editor/state-editor-json";
import type {
  StateEditorChange,
  StateEditorPath,
  StateEditorSection,
} from "../../../lib/state-editor/state-editor.types";

interface StateEditorProps {
  sections: StateEditorSection[];
  /** Saves the changed sections. Throw to keep the drafts and show the error. */
  onSave: (changes: StateEditorChange[]) => Promise<void>;
  /** Shown above the editor, e.g. a warning that the state moved on. */
  notice?: ReactNode;
  /** Lets the host guard closing while drafts are unsaved. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Says where the review's changes will land; defaults to a plain count. */
  reviewSubtitle?: (count: number) => string;
}

type StateEditorView = "section" | "results" | "review";
type StateSectionMode = "fields" | "json";

const SECONDARY_BUTTON =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY_BUTTON =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
const SMALL_TOOL_BUTTON =
  "inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-[0.6875rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-40";

function countItems(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return null;
}

/** Selects one line of the textarea and scrolls it into the upper third of the box. */
function revealTextareaLine(textarea: HTMLTextAreaElement, line: number) {
  const lines = textarea.value.split("\n");
  const index = Math.min(Math.max(line, 1), lines.length) - 1;
  let start = 0;
  for (let i = 0; i < index; i++) start += lines[i]!.length + 1;
  const end = start + lines[index]!.length;
  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(start, end);
  const lineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight) || 18;
  textarea.scrollTop = Math.max(0, index * lineHeight - textarea.clientHeight / 3);
}

export function StateEditor({ sections, onSave, notice, onDirtyChange, reviewSubtitle }: StateEditorProps) {
  const { t: localizeUi } = useUiTranslation();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<StateEditorView>("section");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingLine, setPendingLine] = useState<number | null>(null);
  const [mode, setMode] = useState<StateSectionMode>("fields");
  const [focusPath, setFocusPath] = useState<StateEditorPath | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const layouts = useMemo(() => {
    const map = new Map<string, StateJsonLayout>();
    for (const section of sections) map.set(section.id, layoutStateJson(section.value));
    return map;
  }, [sections]);

  const statuses = useMemo(() => {
    const map = new Map<string, StateSectionDraftStatus>();
    for (const section of sections) map.set(section.id, getStateSectionDraftStatus(section, drafts[section.id]));
    return map;
  }, [drafts, sections]);

  const { changes, invalidSectionIds } = useMemo(() => collectStateChanges(sections, drafts), [drafts, sections]);
  const dirty = changes.length > 0 || invalidSectionIds.length > 0;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Search what the user sees: a section's draft when it parses, its saved value otherwise.
  const searchValues = useMemo(() => {
    const values: Record<string, unknown> = {};
    for (const [sectionId, draft] of Object.entries(drafts)) {
      const parsed = parseStateDraft(draft);
      if (parsed.ok) values[sectionId] = parsed.value;
    }
    return values;
  }, [drafts]);

  const results = useMemo(
    () => (query.trim() ? searchStateSections(sections, query, searchValues) : []),
    [query, searchValues, sections],
  );

  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0];
  const activeStatus = activeSection ? statuses.get(activeSection.id) : undefined;
  const activeText = activeSection ? (drafts[activeSection.id] ?? layouts.get(activeSection.id)?.text ?? "") : "";

  useEffect(() => {
    if (pendingLine === null || view !== "section" || mode !== "json" || !textareaRef.current) return;
    revealTextareaLine(textareaRef.current, pendingLine);
    setPendingLine(null);
  }, [pendingLine, view, mode, activeSectionId]);

  const setDraft = useCallback(
    (sectionId: string, text: string) => {
      setSaveError(null);
      setDrafts((current) => {
        // Typing back to the saved text is no draft at all.
        if (text === layouts.get(sectionId)?.text) {
          const { [sectionId]: _removed, ...rest } = current;
          return rest;
        }
        return { ...current, [sectionId]: text };
      });
    },
    [layouts],
  );

  const openSection = (sectionId: string, target?: { line: number; path: StateEditorPath }) => {
    setActiveSectionId(sectionId);
    setView("section");
    // Only the open view consumes its target; a leftover one would jump later, on the next view switch.
    setPendingLine(mode === "json" ? (target?.line ?? null) : null);
    setFocusPath(mode === "fields" ? (target?.path ?? null) : null);
  };

  const openResult = (result: StateSearchResult) => openSection(result.sectionId, result);

  const clearFocusPath = useCallback(() => setFocusPath(null), []);

  const handleQueryChange = (next: string) => {
    setQuery(next);
    if (view === "review") return;
    setView(next.trim() ? "results" : "section");
  };

  const formatActive = () => {
    if (!activeSection) return;
    const parsed = parseStateDraft(activeText);
    if (parsed.ok) setDraft(activeSection.id, layoutStateJson(parsed.value).text);
  };

  const revertActive = () => {
    if (!activeSection) return;
    setDrafts(({ [activeSection.id]: _removed, ...rest }) => rest);
  };

  const discardAll = async () => {
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.stateEditor.discard.title"),
      message: localizeUi("ui.stateEditor.discard.message"),
      confirmLabel: localizeUi("ui.stateEditor.discard.confirm"),
      cancelLabel: localizeUi("ui.stateEditor.discard.cancel"),
      tone: "destructive",
    });
    if (!confirmed) return;
    setDrafts({});
    setSaveError(null);
    if (view === "review") setView(query.trim() ? "results" : "section");
  };

  const save = async () => {
    if (changes.length === 0 || invalidSectionIds.length > 0 || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(changes);
      setDrafts({});
      setView(query.trim() ? "results" : "section");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : localizeUi("ui.stateEditor.review.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const sectionNavItem = (section: StateEditorSection, compact: boolean) => {
    const status = statuses.get(section.id);
    const active = view !== "review" && view !== "results" && section.id === activeSection?.id;
    const count = countItems(searchValues[section.id] ?? section.value);
    return (
      <button
        key={section.id}
        type="button"
        onClick={() => openSection(section.id)}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex items-center gap-2 rounded-lg text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          compact ? "min-h-9 shrink-0 px-3 ring-1" : "min-h-9 w-full px-2.5 py-1.5",
          active
            ? "bg-[var(--accent)] font-semibold text-[var(--foreground)] ring-[var(--border)]"
            : "text-[var(--muted-foreground)] ring-[var(--border)]/50 hover:bg-[var(--accent)]/60 hover:text-[var(--foreground)]",
        )}
      >
        <span className={cn("min-w-0", compact ? "whitespace-nowrap" : "flex-1 truncate")}>{section.label}</span>
        {status?.kind === "invalid" ? (
          <AlertTriangle
            size="0.75rem"
            className="shrink-0 text-[var(--marinara-app-accent-static)]"
            aria-label={localizeUi("ui.stateEditor.sections.invalid")}
          />
        ) : status?.kind === "changed" ? (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]"
            aria-label={localizeUi("ui.stateEditor.sections.edited")}
          />
        ) : section.readOnly ? (
          <Lock
            size="0.625rem"
            className="shrink-0 opacity-60"
            aria-label={localizeUi("ui.stateEditor.sections.readOnly")}
          />
        ) : null}
        {count !== null && !compact ? (
          <span className="shrink-0 tabular-nums text-[0.625rem] text-[var(--muted-foreground)]/80">{count}</span>
        ) : null}
      </button>
    );
  };

  const renderResults = () => (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          {localizeUi("ui.stateEditor.search.resultsFor", { query: query.trim() })}
        </h3>
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
          {results.length > 0
            ? localizeUi("ui.stateEditor.search.matchCount", { count: results.length })
            : localizeUi("ui.stateEditor.search.noMatches")}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {results.map((result, index) => (
          <li key={`${result.sectionId}:${result.line}:${index}`}>
            <button
              type="button"
              onClick={() => openResult(result)}
              className="group flex w-full items-center gap-3 rounded-lg bg-[var(--secondary)]/50 px-3 py-2.5 text-left ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 flex-wrap items-center gap-0.5 text-[0.6875rem] text-[var(--muted-foreground)]">
                  {[result.sectionLabel, ...result.trail].map((part, partIndex) => (
                    <span key={partIndex} className="inline-flex min-w-0 items-center gap-0.5">
                      {partIndex > 0 ? <ChevronRight size="0.625rem" className="shrink-0 opacity-60" /> : null}
                      <span className="truncate">{part}</span>
                    </span>
                  ))}
                </span>
                <span className="mt-0.5 block truncate text-sm font-semibold text-[var(--foreground)]">
                  {result.key}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[0.6875rem] text-[var(--muted-foreground)]">
                  {result.preview}
                </span>
              </span>
              <ArrowRight
                size="0.95rem"
                className="shrink-0 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--foreground)]"
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  const renderSection = () => {
    if (!activeSection) return null;
    const hasDraft = drafts[activeSection.id] !== undefined;
    const readOnly = activeSection.readOnly === true;
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {query.trim() ? (
          <button
            type="button"
            onClick={() => setView("results")}
            className={cn(SMALL_TOOL_BUTTON, "self-start -ml-2")}
          >
            <ArrowLeft size="0.75rem" />
            {localizeUi("ui.stateEditor.search.backToResults")}
          </button>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
              {activeSection.label}
              {activeStatus?.kind === "changed" ? (
                <span className="rounded-full bg-[var(--primary)]/15 px-1.5 py-px text-[0.625rem] font-semibold text-[var(--primary)] ring-1 ring-[var(--primary)]/30">
                  {localizeUi("ui.stateEditor.sections.edited")}
                </span>
              ) : readOnly ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--secondary)] px-1.5 py-px text-[0.625rem] font-semibold text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                  <Lock size="0.5625rem" />
                  {localizeUi("ui.stateEditor.sections.readOnly")}
                </span>
              ) : null}
            </h3>
            {activeSection.description ? (
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{activeSection.description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-0.5">
            <div
              role="group"
              aria-label={localizeUi("ui.stateEditor.editor.viewLabel")}
              className="mr-1 inline-flex rounded-lg bg-[var(--secondary)]/60 p-0.5 ring-1 ring-[var(--border)]/60"
            >
              {(["fields", "json"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMode(option)}
                  aria-pressed={mode === option}
                  className={cn(
                    "inline-flex min-h-7 items-center gap-1 rounded-md px-2 text-[0.6875rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                    mode === option
                      ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border)]/60"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                  )}
                >
                  {option === "fields" ? <ListTree size="0.75rem" /> : <Braces size="0.75rem" />}
                  {localizeUi(
                    option === "fields" ? "ui.stateEditor.editor.viewFields" : "ui.stateEditor.editor.viewJson",
                  )}
                </button>
              ))}
            </div>
            {mode === "json" && !readOnly ? (
              <button
                type="button"
                onClick={formatActive}
                disabled={activeStatus?.kind === "invalid"}
                className={SMALL_TOOL_BUTTON}
              >
                <Wand2 size="0.75rem" />
                {localizeUi("ui.stateEditor.editor.format")}
              </button>
            ) : null}
            {readOnly ? null : (
              <button type="button" onClick={revertActive} disabled={!hasDraft} className={SMALL_TOOL_BUTTON}>
                <RotateCcw size="0.75rem" />
                {localizeUi("ui.stateEditor.editor.revert")}
              </button>
            )}
          </div>
        </div>
        {activeStatus?.kind === "invalid" ? (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-[var(--marinara-app-accent-static)]/10 px-3 py-2 text-xs text-[var(--marinara-app-accent-static)] ring-1 ring-[var(--marinara-app-accent-static)]/30"
          >
            <AlertTriangle size="0.875rem" className="shrink-0" />
            <span className="min-w-0 break-words">
              {localizeUi("ui.stateEditor.editor.invalidJson")}
              {activeStatus.error ? <span className="opacity-80"> {activeStatus.error}</span> : null}
            </span>
          </div>
        ) : null}
        {mode === "json" ? (
          <StateJsonField
            value={activeText}
            onChange={(text) => setDraft(activeSection.id, text)}
            ariaLabel={localizeUi("ui.stateEditor.editor.ariaLabel", { section: activeSection.label })}
            invalid={activeStatus?.kind === "invalid"}
            readOnly={readOnly}
            textareaRef={textareaRef}
            className="min-h-[16rem] flex-1"
          />
        ) : activeStatus?.kind === "invalid" ? (
          <button type="button" onClick={() => setMode("json")} className={cn(SECONDARY_BUTTON, "self-start")}>
            <Braces size="0.875rem" />
            {localizeUi("ui.stateEditor.fields.fixInJson")}
          </button>
        ) : (
          <StateFieldsView
            value={activeSection.id in searchValues ? searchValues[activeSection.id] : activeSection.value}
            onChange={(next) => setDraft(activeSection.id, layoutStateJson(next).text)}
            focusPath={focusPath}
            onFocusHandled={clearFocusPath}
            readOnly={readOnly}
          />
        )}
      </div>
    );
  };

  const renderReview = () => (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{localizeUi("ui.stateEditor.review.title")}</h3>
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
          {reviewSubtitle?.(changes.length) ?? localizeUi("ui.stateEditor.review.subtitle", { count: changes.length })}
        </p>
      </div>
      {changes.map((change) => {
        const section = sections.find((item) => item.id === change.sectionId);
        if (!section) return null;
        return (
          <section key={change.sectionId} className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => openSection(change.sectionId)}
              className="inline-flex items-center gap-1 self-start text-xs font-semibold text-[var(--foreground)] hover:underline"
            >
              {section.label}
              <ChevronRight size="0.75rem" className="text-[var(--muted-foreground)]" />
            </button>
            <UnifiedLineDiff
              before={layouts.get(change.sectionId)?.text ?? ""}
              after={layoutStateJson(change.value).text}
              className="max-h-80 ring-1 ring-[var(--border)]/60"
            />
          </section>
        );
      })}
      {saveError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-[var(--marinara-app-accent-static)]/10 px-3 py-2 text-xs text-[var(--marinara-app-accent-static)] ring-1 ring-[var(--marinara-app-accent-static)]/30"
        >
          <AlertTriangle size="0.875rem" className="mt-px shrink-0" />
          <span className="min-w-0 break-words">{saveError}</span>
        </div>
      ) : null}
    </div>
  );

  const footerStatus =
    invalidSectionIds.length > 0
      ? localizeUi("ui.stateEditor.footer.invalidSections", { count: invalidSectionIds.length })
      : changes.length > 0
        ? localizeUi("ui.stateEditor.footer.changedSections", { count: changes.length })
        : localizeUi("ui.stateEditor.footer.noChanges");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-[var(--border)]/60 px-4 py-3">
        <div className="relative">
          <Search
            size="0.875rem"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder={localizeUi("ui.stateEditor.search.placeholder")}
            aria-label={localizeUi("ui.stateEditor.search.placeholder")}
            className="h-9 w-full rounded-lg bg-[var(--background)] pl-8 pr-9 text-sm text-[var(--foreground)] ring-1 ring-[var(--border)] outline-none placeholder:text-[var(--muted-foreground)] focus:ring-2 focus:ring-[var(--ring)] [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => handleQueryChange("")}
              aria-label={localizeUi("ui.stateEditor.search.clear")}
              className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            >
              <X size="0.875rem" />
            </button>
          ) : null}
        </div>
        {notice ? <div className="mt-3">{notice}</div> : null}
      </div>

      <div className="flex min-h-0 flex-1 max-md:flex-col">
        {/* A single-section source (chat variables) has nothing to pick between. */}
        {sections.length > 1 ? (
          <nav
            aria-label={localizeUi("ui.stateEditor.sections.title")}
            className="shrink-0 border-[var(--border)]/60 max-md:border-b md:w-52 md:overflow-y-auto md:border-r"
          >
            <div className="hidden items-center justify-between px-4 pt-3 pb-1.5 text-[0.625rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] md:flex">
              <span>{localizeUi("ui.stateEditor.sections.title")}</span>
              <span className="tabular-nums">{sections.length}</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
              {sections.map((section) => sectionNavItem(section, true))}
            </div>
            <div className="hidden flex-col gap-0.5 px-2 pb-3 md:flex">
              {sections.map((section) => sectionNavItem(section, false))}
            </div>
          </nav>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          {view === "review" ? renderReview() : view === "results" ? renderResults() : renderSection()}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[var(--border)]/60 px-4 py-3">
        <div className="min-w-0">
          <p
            className={cn(
              "text-xs font-semibold",
              invalidSectionIds.length > 0 ? "text-[var(--marinara-app-accent-static)]" : "text-[var(--foreground)]",
            )}
          >
            {footerStatus}
          </p>
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{localizeUi("ui.stateEditor.footer.hint")}</p>
        </div>
        <div className="flex items-center gap-2 max-sm:w-full max-sm:[&>button]:flex-1">
          {view === "review" ? (
            <>
              <button type="button" onClick={() => setView("section")} disabled={saving} className={SECONDARY_BUTTON}>
                <ArrowLeft size="0.875rem" />
                {localizeUi("ui.stateEditor.review.back")}
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || changes.length === 0}
                className={PRIMARY_BUTTON}
              >
                {saving ? <Loader2 size="0.875rem" className="animate-spin" /> : null}
                {localizeUi("ui.stateEditor.review.save")}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => void discardAll()} disabled={!dirty} className={SECONDARY_BUTTON}>
                {localizeUi("ui.stateEditor.footer.discard")}
              </button>
              <button
                type="button"
                onClick={() => setView("review")}
                disabled={changes.length === 0 || invalidSectionIds.length > 0}
                className={PRIMARY_BUTTON}
              >
                {localizeUi("ui.stateEditor.footer.review")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
