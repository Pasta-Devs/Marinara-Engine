// ──────────────────────────────────────────────
// Preset variables editor: the variable list, each variable's card (name,
// question, options, presentation) and the expanded option-value editor.
// Moved verbatim out of PresetEditor.tsx so other editors can reuse it.
// ──────────────────────────────────────────────
import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { showConfirmDialog } from "../../lib/app-dialogs";
import {
  ArrowDown,
  ArrowUp,
  Trash2,
  Plus,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Hash,
  X,
  Maximize2,
  ListChecks,
  Shuffle,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useQuoteFormatter } from "../../hooks/use-quote-formatter";
import { useTouchFolderDrag } from "../../hooks/use-touch-folder-drag";
import { getTouchReorderDropIndex } from "../../lib/touch-reorder";
import { handleTextareaTab } from "../../lib/textarea-editing";
import { SettingsSwitch } from "../panels/settings/SettingControls";

// ── Input caret helpers ──
type TextSelection = { start: number; end: number };

function shouldSelectTextOnFocus() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return !window.matchMedia("(pointer: coarse)").matches;
}

function useRestoreTextSelection<T extends HTMLInputElement | HTMLTextAreaElement>(
  inputRef: { current: T | null },
  selectionRef: { current: TextSelection | null },
  value: string,
) {
  useLayoutEffect(() => {
    const input = inputRef.current;
    const selection = selectionRef.current;
    if (!input || !selection || typeof document === "undefined" || document.activeElement !== input) return;

    selectionRef.current = null;
    const start = Math.min(selection.start, input.value.length);
    const end = Math.min(selection.end, input.value.length);
    input.setSelectionRange(start, end);
  }, [inputRef, selectionRef, value]);
}

function getFormattedTextSelection(
  rawValue: string,
  selectionStart: number,
  selectionEnd: number,
  formatValue: (value: string) => string,
): TextSelection {
  const formattedBeforeSelection = formatValue(rawValue.slice(0, selectionStart));
  const formattedSelection = formatValue(rawValue.slice(selectionStart, selectionEnd));
  return {
    start: formattedBeforeSelection.length,
    end: formattedBeforeSelection.length + formattedSelection.length,
  };
}

const sanitizeVariableName = (value: string) => value.replace(/[^\w]/g, "");

function getSanitizedVariableSelection(rawValue: string, selectionStart: number, selectionEnd: number): TextSelection {
  return {
    start: sanitizeVariableName(rawValue.slice(0, selectionStart)).length,
    end: sanitizeVariableName(rawValue.slice(0, selectionEnd)).length,
  };
}

export function reorderIdsByOffset(items: Array<{ id: string }>, index: number, offset: number): string[] | null {
  const targetIndex = index + offset;
  if (targetIndex < 0 || targetIndex >= items.length) return null;
  const ids = items.map((item) => item.id);
  const [moved] = ids.splice(index, 1);
  if (!moved) return null;
  ids.splice(targetIndex, 0, moved);
  return ids;
}

function reorderItems<T>(items: T[], sourceIndex: number, targetIndex: number): T[] | null {
  if (sourceIndex < 0 || sourceIndex >= items.length || targetIndex < 0 || targetIndex >= items.length) return null;
  if (sourceIndex === targetIndex) return null;
  const next = [...items];
  const [moved] = next.splice(sourceIndex, 1);
  if (moved === undefined) return null;
  next.splice(targetIndex, 0, moved);
  return next;
}

export function reorderIdsToGap(
  items: Array<{ id: string }>,
  sourceIndex: number,
  targetGapIndex: number,
): string[] | null {
  if (sourceIndex < 0 || sourceIndex >= items.length || targetGapIndex < 0 || targetGapIndex > items.length)
    return null;
  let insertAt = targetGapIndex;
  if (sourceIndex < insertAt) insertAt--;
  if (sourceIndex === insertAt) return null;
  const ids = items.map((item) => item.id);
  const [moved] = ids.splice(sourceIndex, 1);
  if (!moved) return null;
  ids.splice(insertAt, 0, moved);
  return ids;
}

function reorderItemsToGap<T>(items: T[], sourceIndex: number, targetGapIndex: number): T[] | null {
  if (sourceIndex < 0 || sourceIndex >= items.length || targetGapIndex < 0 || targetGapIndex > items.length)
    return null;
  let insertAt = targetGapIndex;
  if (sourceIndex < insertAt) insertAt--;
  if (sourceIndex === insertAt) return null;
  const next = [...items];
  const [moved] = next.splice(sourceIndex, 1);
  if (moved === undefined) return null;
  next.splice(insertAt, 0, moved);
  return next;
}

type ChoiceDisplayMode = "auto" | "buttons" | "listbox";
type ChoiceOptionSort = "manual" | "alphabetical";
type VariableOptionDraft = { id: string; label: string; value: string };

function readChoiceDisplayMode(value: unknown): ChoiceDisplayMode {
  return value === "buttons" || value === "listbox" ? value : "auto";
}

function readChoiceOptionSort(value: unknown): ChoiceOptionSort {
  return value === "alphabetical" ? "alphabetical" : "manual";
}

// ── Preset Variables Editor (preset-level, supports multiple) ──

export function PresetVariablesEditor({
  presetId,
  variables,
  onCreateVariable,
  onUpdateVariable,
  onDeleteVariable,
  onReorderVariables,
  compact = false,
}: {
  presetId: string;
  variables: any[];
  onCreateVariable: any;
  onUpdateVariable: any;
  onDeleteVariable: any;
  onReorderVariables: any;
  compact?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [dragReady, setDragReady] = useState<number | null>(null);

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

  const handleContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropIdx(variables.length);
  };

  const commitVariableReorder = useCallback(
    (sourceIdx: number, target: number) => {
      const ids = reorderIdsToGap(variables, sourceIdx, target);
      if (!ids) return;
      onReorderVariables.mutate({ presetId, variableIds: ids });
    },
    [onReorderVariables, presetId, variables],
  );

  const commitDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const sourceIdx = draggingIdx;
    const target = dropIdx;
    setDraggingIdx(null);
    setDropIdx(null);
    if (sourceIdx === null || target === null) return;
    commitVariableReorder(sourceIdx, target);
  };

  const handleDragEnd = () => {
    setDraggingIdx(null);
    setDropIdx(null);
  };

  const moveVariableByOffset = (idx: number, offset: number) => {
    const variableIds = reorderIdsByOffset(variables, idx, offset);
    if (!variableIds) return;
    onReorderVariables.mutate({ presetId, variableIds });
  };

  const { startTouchDrag: startVariableTouchDrag } = useTouchFolderDrag({
    onActivate: (variableId) => {
      const idx = variables.findIndex((variable: any) => variable.id === variableId);
      if (idx < 0) return;
      setDraggingIdx(idx);
      setDragReady(idx);
    },
    onDrop: (variableId, x, y) => {
      const sourceIdx = variables.findIndex((variable: any) => variable.id === variableId);
      const targetIdx = getTouchReorderDropIndex({
        x,
        y,
        itemSelector: '[data-touch-reorder-item="preset-variable"]',
        rootSelector: "[data-preset-variable-root]",
        itemCount: variables.length,
      });
      setDraggingIdx(null);
      setDropIdx(null);
      setDragReady(null);
      if (sourceIdx < 0 || targetIdx === null) return;
      commitVariableReorder(sourceIdx, targetIdx);
    },
    onCancel: () => {
      setDraggingIdx(null);
      setDropIdx(null);
      setDragReady(null);
    },
  });

  return (
    <div className={cn("mari-editor-panel space-y-3", compact ? "mt-3 p-2" : "mt-6 p-3")}>
      <div
        data-preset-variables-header
        className={cn(
          "flex items-center justify-between gap-3",
          compact && "max-sm:flex-wrap max-sm:gap-x-3 max-sm:gap-y-2",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Hash size="0.875rem" className="mari-chrome-accent-icon mari-accent-animated" />
          <span className="text-sm font-semibold">
            {localizeUi("ui.presets.presetvariableseditor.presetVariables")}
          </span>
          <span
            data-preset-variable-count
            className="mari-editor-chip mari-editor-chip--accent px-1.5 py-0.5 text-[0.5625rem]"
          >
            {variables.length}
          </span>
        </div>
        <button
          onClick={() =>
            onCreateVariable.mutate({
              presetId,
              variableName: `VAR_${Date.now()}`,
              question: "Choose an option",
              options: [
                { id: `opt_${Date.now()}_a`, label: "Option A", value: "value_a" },
                { id: `opt_${Date.now()}_b`, label: "Option B", value: "value_b" },
              ],
            })
          }
          className={cn(
            "mari-editor-action mari-editor-action--primary mari-editor-action--compact flex items-center gap-1.5 px-2.5 py-1.5 text-[0.6875rem]",
            compact && "max-sm:ml-auto",
          )}
        >
          <Plus size="0.6875rem" /> {localizeUi("ui.presets.presetvariableseditor.addVariable")}
        </button>
      </div>

      <p className="text-[0.625rem] text-[var(--muted-foreground)]">
        {localizeUi("ui.presets.presetvariableseditor.defineVariablesThatUsersSelectWhenAssigningThisPreset")}{" "}
        <code className="mari-editor-chip mari-editor-chip--accent rounded px-1 text-[0.625rem]">
          {"{{variable_name}}"}
        </code>{" "}
        {localizeUi("ui.presets.presetvariableseditor.inAnySectionToInsertTheSelectedValue")}
      </p>

      {variables.length === 0 ? (
        <div className="mari-editor-empty flex flex-col items-center gap-2 py-6 text-center">
          <Hash size="1.25rem" className="text-[var(--muted-foreground)]" />
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.presets.presetvariableseditor.noVariablesYetAddOneToLetUsersCustomize")}
          </p>
        </div>
      ) : (
        <div data-preset-variable-root className="space-y-2" onDragOver={handleContainerDragOver} onDrop={commitDrop}>
          {variables.map((variable: any, idx: number) => {
            const showDropBefore =
              dropIdx === idx && draggingIdx !== null && draggingIdx !== idx && draggingIdx !== idx - 1;
            const showDropAfter =
              idx === variables.length - 1 &&
              dropIdx === variables.length &&
              draggingIdx !== null &&
              draggingIdx !== idx;
            return (
              <div key={variable.id}>
                {showDropBefore && (
                  <div className="mari-chrome-accent-progress mari-accent-animated mx-2 mb-1 h-0.5 rounded-full" />
                )}
                <div
                  data-touch-reorder-item="preset-variable"
                  data-touch-reorder-index={idx}
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
                  className={cn(draggingIdx === idx && "opacity-40")}
                >
                  <VariableCard
                    presetId={presetId}
                    variable={variable}
                    isExpanded={expandedId === variable.id}
                    onToggle={() => setExpandedId(expandedId === variable.id ? null : variable.id)}
                    onUpdateVariable={onUpdateVariable}
                    onDeleteVariable={onDeleteVariable}
                    onGripDown={() => setDragReady(idx)}
                    onGripUp={() => setDragReady(null)}
                    onGripTouchStart={(event) => {
                      event.stopPropagation();
                      startVariableTouchDrag(event, variable.id, {
                        allowInteractiveTarget: true,
                        sourceElement: event.currentTarget.closest<HTMLElement>(
                          '[data-touch-reorder-item="preset-variable"]',
                        ),
                      });
                    }}
                    onMoveUp={() => moveVariableByOffset(idx, -1)}
                    onMoveDown={() => moveVariableByOffset(idx, 1)}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < variables.length - 1}
                    isReordering={onReorderVariables.isPending}
                  />
                </div>
                {showDropAfter && (
                  <div className="mari-chrome-accent-progress mari-accent-animated mx-2 mt-1 h-0.5 rounded-full" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Single Variable Card ──

function VariableCard({
  presetId,
  variable,
  isExpanded,
  onToggle,
  onUpdateVariable,
  onDeleteVariable,
  onGripDown,
  onGripUp,
  onGripTouchStart,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  isReordering,
}: {
  presetId: string;
  variable: any;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateVariable: any;
  onDeleteVariable: any;
  onGripDown: () => void;
  onGripUp: () => void;
  onGripTouchStart: (event: React.TouchEvent<HTMLElement>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isReordering: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  // Parse options
  const opts = useMemo<VariableOptionDraft[]>(() => {
    try {
      return typeof variable.options === "string" ? JSON.parse(variable.options) : (variable.options ?? []);
    } catch {
      return [];
    }
  }, [variable.options]);

  const varName = variable.variableName ?? variable.variable_name ?? "";
  const question = variable.question ?? "";
  const isMultiSelect = variable.multiSelect === "true" || variable.multiSelect === true;
  const isRandomPick = variable.randomPick === "true" || variable.randomPick === true;
  const separatorValue = variable.separator ?? ", ";
  const displayMode = readChoiceDisplayMode(variable.displayMode ?? variable.display_mode);
  const optionSort = readChoiceOptionSort(variable.optionSort ?? variable.option_sort);
  const optionOrderIsAlphabetical = optionSort === "alphabetical";

  // Track which option is expanded in the big editor.
  const [expandedOptId, setExpandedOptId] = useState<string | null>(null);
  const [draggingOptIdx, setDraggingOptIdx] = useState<number | null>(null);
  const [dropOptIdx, setDropOptIdx] = useState<number | null>(null);
  const [dragReadyOptIdx, setDragReadyOptIdx] = useState<number | null>(null);
  const optsRef = useRef<VariableOptionDraft[]>(opts);
  const expandedOpt = expandedOptId ? (opts.find((opt) => opt.id === expandedOptId) ?? null) : null;

  useEffect(() => {
    if (!onUpdateVariable.isPending) optsRef.current = opts;
  }, [onUpdateVariable.isPending, opts]);

  const update = (data: Record<string, unknown>) => {
    onUpdateVariable.mutate({ presetId, variableId: variable.id, ...data });
  };

  const updateOpts = (newOpts: VariableOptionDraft[]) => {
    optsRef.current = newOpts;
    update({ options: newOpts });
  };

  const currentOpts = () => (optsRef.current.length > 0 ? optsRef.current : opts);

  const updateOptionField = (optionId: string, field: "label" | "value", value: string) => {
    updateOpts(currentOpts().map((opt) => (opt.id === optionId ? { ...opt, [field]: value } : opt)));
  };

  const calcOptionDropIdx = (optionIdx: number, e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    return e.clientY < midY ? optionIdx : optionIdx + 1;
  };

  const handleOptionDragStart = (optionIdx: number, e: React.DragEvent) => {
    if (optionOrderIsAlphabetical) return;
    setDraggingOptIdx(optionIdx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(optionIdx));
  };

  const handleOptionDragOver = (optionIdx: number, e: React.DragEvent) => {
    if (optionOrderIsAlphabetical) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropOptIdx(calcOptionDropIdx(optionIdx, e));
  };

  const commitOptionDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const sourceIdx = draggingOptIdx;
    const target = dropOptIdx;
    setDraggingOptIdx(null);
    setDropOptIdx(null);
    setDragReadyOptIdx(null);
    if (optionOrderIsAlphabetical || sourceIdx === null || target === null) return;
    const next = reorderItemsToGap(currentOpts(), sourceIdx, target);
    if (next) updateOpts(next);
  };

  const moveOptionByOffset = (optionIdx: number, offset: number) => {
    if (optionOrderIsAlphabetical) return;
    const next = reorderItems(currentOpts(), optionIdx, optionIdx + offset);
    if (next) updateOpts(next);
  };

  const { startTouchDrag: startOptionTouchDrag } = useTouchFolderDrag({
    onActivate: (optionId) => {
      if (optionOrderIsAlphabetical) return;
      const idx = currentOpts().findIndex((option) => option.id === optionId);
      if (idx < 0) return;
      setDraggingOptIdx(idx);
      setDragReadyOptIdx(idx);
    },
    onDrop: (optionId, x, y) => {
      const options = currentOpts();
      const sourceIdx = options.findIndex((option) => option.id === optionId);
      const targetIdx = getTouchReorderDropIndex({
        x,
        y,
        itemSelector: `[data-touch-reorder-item="preset-variable-option-${variable.id}"]`,
        rootSelector: `[data-preset-variable-option-root="${variable.id}"]`,
        itemCount: options.length,
      });
      setDraggingOptIdx(null);
      setDropOptIdx(null);
      setDragReadyOptIdx(null);
      if (optionOrderIsAlphabetical || sourceIdx < 0 || targetIdx === null) return;
      const next = reorderItemsToGap(options, sourceIdx, targetIdx);
      if (next) updateOpts(next);
    },
    onCancel: () => {
      setDraggingOptIdx(null);
      setDropOptIdx(null);
      setDragReadyOptIdx(null);
    },
  });

  return (
    <div className="mari-editor-panel mari-editor-panel--soft transition-all">
      {/* Header */}
      <div className="flex min-w-0 items-center gap-2 px-3 py-2.5">
        <div className="flex shrink-0 items-center gap-0.5">
          <div
            className="cursor-grab rounded p-0.5 hover:bg-[var(--accent)] active:cursor-grabbing"
            title={localizeUi("ui.presets.sectionstab.dragToReorder")}
            onMouseDown={onGripDown}
            onMouseUp={onGripUp}
            onTouchStart={onGripTouchStart}
          >
            <GripVertical size="0.875rem" className="text-[var(--muted-foreground)]" />
          </div>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp || isReordering}
            className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-30"
            title={localizeUi("ui.presets.sectionstab.moveUp")}
            aria-label={localizeUi("ui.presets.sectionstab.moveValue1Up", {
              value1: varName || localizeUi("ui.presets.variablecard.variable"),
            })}
          >
            <ArrowUp size="0.75rem" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown || isReordering}
            className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-30"
            title={localizeUi("ui.presets.sectionstab.moveDown")}
            aria-label={localizeUi("ui.presets.sectionstab.moveValue1Down", {
              value1: varName || localizeUi("ui.presets.variablecard.variable"),
            })}
          >
            <ArrowDown size="0.75rem" />
          </button>
        </div>
        <button onClick={onToggle} className="shrink-0 rounded p-0.5 hover:bg-[var(--accent)]">
          {isExpanded ? (
            <ChevronDown size="0.875rem" className="text-[var(--muted-foreground)]" />
          ) : (
            <ChevronRight size="0.875rem" className="text-[var(--muted-foreground)]" />
          )}
        </button>
        <Hash size="0.875rem" className="mari-chrome-accent-icon mari-accent-animated shrink-0" />
        <span
          className="mari-chrome-accent-text mari-accent-animated min-w-0 flex-1 cursor-pointer truncate text-sm font-medium"
          onClick={onToggle}
        >
          {varName}
        </span>
        <span className="mari-editor-chip mari-editor-chip--accent shrink-0 px-1.5 py-0.5 text-[0.5625rem]">
          {opts.length} {localizeUi("ui.presets.variablecard.options")}
        </span>
        {opts.length === 1 && !isMultiSelect && (
          <span className="mari-chrome-accent-surface mari-accent-animated shrink-0 rounded px-1.5 py-0.5 text-[0.5625rem] font-medium">
            {localizeUi("ui.presets.variablecard.boolean")}
          </span>
        )}
        {isMultiSelect && (
          <span className="mari-chrome-accent-surface mari-accent-animated shrink-0 rounded px-1.5 py-0.5 text-[0.5625rem] font-medium">
            {isRandomPick ? localizeUi("ui.presets.variablecard.random") : localizeUi("ui.presets.variablecard.multi")}
          </span>
        )}
        <code className="hidden shrink-0 text-[0.625rem] text-[var(--muted-foreground)] sm:inline">{`{{${varName}}}`}</code>
        <button
          onClick={async () => {
            if (
              await showConfirmDialog({
                title: localizeUi("ui.presets.variablecard.deleteVariable_8ceffd4"),
                message: localizeUi("ui.presets.variablecard.deleteVariableValue1", { value1: varName }),
                confirmLabel: localizeUi("lorebook.editor.batch.delete"),
                tone: "destructive",
              })
            ) {
              onDeleteVariable.mutate({ presetId, variableId: variable.id });
            }
          }}
          className="shrink-0 rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          title={localizeUi("ui.presets.variablecard.deleteVariable")}
        >
          <Trash2 size="0.75rem" />
        </button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="space-y-3 border-t border-[var(--marinara-editor-divider)] px-3 py-3">
          {/* Variable Name */}
          <div className="space-y-1">
            <label className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
              {localizeUi("ui.presets.variablecard.variableName")}
            </label>
            <VariableNameInput value={varName} onCommit={(v) => update({ variableName: v })} />
            <p className="text-[0.5625rem] text-[var(--muted-foreground)]">
              {localizeUi("ui.presets.variablecard.use")}{" "}
              <code className="mari-chrome-accent-text mari-accent-animated">{`{{${varName}}}`}</code>{" "}
              {localizeUi("ui.presets.variablecard.inAnyPromptSectionToInsertTheSelectedValue")}
            </p>
          </div>

          {/* Question */}
          <div className="space-y-1">
            <label className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
              {localizeUi("ui.presets.variablecard.questionShownToUser")}
            </label>
            <VariableQuestionInput value={question} onCommit={(v) => update({ question: v })} />
          </div>

          {/* Multi-Select & Random Pick (not shown for single-option/boolean variables) */}
          {opts.length === 1 && !isMultiSelect ? (
            <div className="mari-editor-panel mari-editor-panel--soft space-y-1.5 p-2.5">
              <div className="flex items-center gap-1.5">
                <ListChecks size="0.75rem" className="mari-chrome-accent-icon mari-accent-animated" />
                <span className="mari-chrome-accent-text mari-accent-animated text-[0.625rem] font-medium">
                  {localizeUi("ui.presets.variablecard.booleanToggle")}
                </span>
              </div>
              <p className="text-[0.5625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.presets.variablecard.thisVariableHasOnlyOneOptionSoItBehaves")}
              </p>
            </div>
          ) : (
            <div className="mari-editor-panel mari-editor-panel--soft space-y-2 p-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ListChecks size="0.75rem" className="mari-chrome-accent-icon mari-accent-animated" />
                  <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                    {localizeUi("ui.presets.variablecard.multiSelect")}
                  </span>
                </div>
                <SettingsSwitch
                  ariaLabel={isMultiSelect ? "Disable multi-select" : "Enable multi-select"}
                  checked={isMultiSelect}
                  onChange={(checked) => update({ multiSelect: checked })}
                  className="p-0 hover:bg-transparent"
                />
              </div>
              <p className="text-[0.5625rem] text-[var(--muted-foreground)]">
                {localizeUi("ui.presets.variablecard.allowUsersToSelectMultipleOptionsInsteadOfJust")}
              </p>

              <div className="space-y-2 border-t border-[var(--border)] pt-2">
                {/* Random Pick Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Shuffle size="0.75rem" className="mari-chrome-accent-icon mari-accent-animated" />
                    <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                      {localizeUi("ui.presets.variablecard.randomPick")}
                    </span>
                  </div>
                  <SettingsSwitch
                    ariaLabel={localizeUi("ui.presets.variablecard.randomPick")}
                    checked={isRandomPick}
                    onChange={(checked) => update({ randomPick: checked })}
                    className="p-0 hover:bg-transparent"
                  />
                </div>
                <p className="text-[0.5625rem] text-[var(--muted-foreground)]">
                  {isMultiSelect
                    ? isRandomPick
                      ? localizeUi("ui.presets.variablecard.oneOfTheUserSSelectedOptionsWillBe")
                      : localizeUi("ui.presets.variablecard.allSelectedOptionsWillBeJoinedTogetherWithThe")
                    : isRandomPick
                      ? localizeUi("ui.presets.variablecard.aRandomOptionIsRolledOnceWhenTheVariable")
                      : localizeUi("ui.presets.variablecard.theFirstOptionIsUsedByDefaultUntilThe")}
                </p>

                {/* Separator (only shown for multi-select, and not random pick) */}
                {isMultiSelect && !isRandomPick && (
                  <div className="flex items-center gap-2">
                    <label className="shrink-0 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                      {localizeUi("ui.presets.variablecard.separator")}
                    </label>
                    <OptionFieldInput
                      value={separatorValue}
                      onCommit={(value) => update({ separator: value })}
                      className="mari-editor-field w-20 px-1.5 py-0.5 text-center font-mono text-xs"
                      placeholder=", "
                    />
                    <span className="text-[0.5625rem] text-[var(--muted-foreground)]">
                      {localizeUi("ui.presets.variablecard.eGBecomesRomanceFantasyAction")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Presentation */}
          <div className="mari-editor-panel mari-editor-panel--soft space-y-2 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <ListChecks size="0.75rem" className="mari-chrome-accent-icon mari-accent-animated" />
                <span className="text-[0.625rem] font-medium text-[var(--foreground)]">
                  {localizeUi("ui.presets.variablecard.presentation")}
                </span>
              </div>
              <div className="mari-editor-field flex p-0.5">
                {(
                  [
                    ["auto", "Auto"],
                    ["buttons", isMultiSelect ? "Checkboxes" : "Radios"],
                    ["listbox", isMultiSelect ? "Listbox" : "Dropdown"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => update({ displayMode: mode })}
                    className={cn(
                      "rounded-md px-2 py-1 text-[0.625rem] font-medium transition-colors",
                      displayMode === mode
                        ? "mari-chrome-accent-surface mari-accent-animated"
                        : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2">
              <div className="min-w-0">
                <p className="text-[0.625rem] font-medium text-[var(--foreground)]">
                  {localizeUi("ui.presets.variablecard.alphabeticalOptionDisplay")}
                </p>
                <p className="text-[0.5625rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.presets.variablecard.manualOrderIsKeptForEditingAndExports")}
                </p>
              </div>
              <SettingsSwitch
                ariaLabel={
                  optionOrderIsAlphabetical
                    ? "Use manual option display order"
                    : "Use alphabetical option display order"
                }
                checked={optionOrderIsAlphabetical}
                onChange={(checked) => update({ optionSort: checked ? "alphabetical" : "manual" })}
                className="p-0 hover:bg-transparent"
              />
            </div>
          </div>

          {/* Options */}
          <div className="space-y-1.5" data-preset-variable-option-root={variable.id}>
            <label className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
              {localizeUi("ui.presets.variablecard.options_6bf5da9")}
            </label>
            {opts.map((opt, oi) => {
              const valueIsBlank = !opt.value || !opt.value.trim();
              const showDropBefore =
                dropOptIdx === oi && draggingOptIdx !== null && draggingOptIdx !== oi && draggingOptIdx !== oi - 1;
              const showDropAfter =
                oi === opts.length - 1 &&
                dropOptIdx === opts.length &&
                draggingOptIdx !== null &&
                draggingOptIdx !== oi;
              return (
                <div key={opt.id}>
                  {showDropBefore && (
                    <div className="mari-chrome-accent-progress mari-accent-animated mx-2 mb-1 h-0.5 rounded-full" />
                  )}
                  <div
                    data-touch-reorder-item={`preset-variable-option-${variable.id}`}
                    data-touch-reorder-index={oi}
                    draggable={dragReadyOptIdx === oi && !optionOrderIsAlphabetical}
                    onDragStart={(e) => handleOptionDragStart(oi, e)}
                    onDragOver={(e) => {
                      e.stopPropagation();
                      handleOptionDragOver(oi, e);
                    }}
                    onDrop={(e) => {
                      e.stopPropagation();
                      commitOptionDrop(e);
                    }}
                    onDragEnd={() => {
                      setDraggingOptIdx(null);
                      setDropOptIdx(null);
                      setDragReadyOptIdx(null);
                    }}
                    className={cn(
                      "flex min-w-0 flex-wrap items-center gap-2 rounded-lg px-2.5 py-1.5 ring-1 sm:flex-nowrap",
                      "mari-editor-panel mari-editor-panel--soft",
                      draggingOptIdx === oi && "opacity-40",
                    )}
                  >
                    <div className="flex shrink-0 items-center gap-0.5">
                      <div
                        className={cn(
                          "rounded p-0.5",
                          optionOrderIsAlphabetical
                            ? "cursor-not-allowed opacity-30"
                            : "cursor-grab hover:bg-[var(--accent)] active:cursor-grabbing",
                        )}
                        title={
                          optionOrderIsAlphabetical
                            ? localizeUi("ui.presets.variablecard.disableAlphabeticalDisplayToReorder")
                            : localizeUi("ui.presets.sectionstab.dragToReorder")
                        }
                        onMouseDown={() => {
                          if (!optionOrderIsAlphabetical) setDragReadyOptIdx(oi);
                        }}
                        onMouseUp={() => setDragReadyOptIdx(null)}
                        onTouchStart={(event) => {
                          event.stopPropagation();
                          if (optionOrderIsAlphabetical) return;
                          startOptionTouchDrag(event, opt.id, {
                            allowInteractiveTarget: true,
                            sourceElement: event.currentTarget.closest<HTMLElement>(
                              `[data-touch-reorder-item="preset-variable-option-${variable.id}"]`,
                            ),
                          });
                        }}
                      >
                        <GripVertical size="0.75rem" className="text-[var(--muted-foreground)]" />
                      </div>
                      <button
                        type="button"
                        onClick={() => moveOptionByOffset(oi, -1)}
                        disabled={optionOrderIsAlphabetical || oi === 0}
                        className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-30"
                        title={localizeUi("ui.presets.variablecard.moveOptionUp")}
                        aria-label={localizeUi("ui.presets.sectionstab.moveValue1Up", {
                          value1: opt.label || localizeUi("ui.presets.variablecard.optionValue1", { value1: oi + 1 }),
                        })}
                      >
                        <ArrowUp size="0.625rem" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveOptionByOffset(oi, 1)}
                        disabled={optionOrderIsAlphabetical || oi === opts.length - 1}
                        className="rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-30"
                        title={localizeUi("ui.presets.variablecard.moveOptionDown")}
                        aria-label={localizeUi("ui.presets.sectionstab.moveValue1Down", {
                          value1: opt.label || localizeUi("ui.presets.variablecard.optionValue1", { value1: oi + 1 }),
                        })}
                      >
                        <ArrowDown size="0.625rem" />
                      </button>
                    </div>
                    <span className="mari-chrome-accent-text mari-accent-animated shrink-0 text-[0.625rem] font-medium">
                      {oi + 1}.
                    </span>
                    <OptionFieldInput
                      value={opt.label}
                      onCommit={(v) => updateOptionField(opt.id, "label", v)}
                      className="mari-editor-field min-w-[7rem] flex-[1_1_7rem] px-1.5 py-0.5 text-xs sm:min-w-0 sm:flex-1"
                      placeholder={localizeUi("ui.presets.variablecard.label")}
                    />
                    <OptionFieldInput
                      value={opt.value}
                      onCommit={(v) => updateOptionField(opt.id, "value", v)}
                      className="mari-editor-field min-w-[7rem] flex-[1_1_7rem] rounded px-1.5 py-0.5 font-mono text-xs focus:outline-none focus:ring-1 sm:min-w-0 sm:flex-1"
                      placeholder={localizeUi("ui.presets.variablecard.value")}
                    />
                    <button
                      onClick={() => setExpandedOptId(opt.id)}
                      className="shrink-0 rounded p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                      title={localizeUi("ui.presets.variablecard.expandValueEditor")}
                    >
                      <Maximize2 size="0.625rem" />
                    </button>
                    <button
                      onClick={() => {
                        if (currentOpts().length <= 1)
                          return toast.error(localizeUi("ui.presets.variablecard.aVariableNeedsAtLeast1Option"));
                        updateOpts(currentOpts().filter((option) => option.id !== opt.id));
                      }}
                      className="shrink-0 rounded p-0.5 hover:bg-[var(--destructive)]/15"
                      title={localizeUi("ui.presets.variablecard.removeOption")}
                    >
                      <X size="0.625rem" className="text-[var(--destructive)]" />
                    </button>
                  </div>
                  {valueIsBlank && (
                    <p className="mt-1 pl-6 text-[0.5625rem] text-[var(--muted-foreground)]">
                      {localizeUi("ui.presets.variablecard.blankValueInsertsNothing")}
                    </p>
                  )}
                  {showDropAfter && (
                    <div className="mari-chrome-accent-progress mari-accent-animated mx-2 mt-1 h-0.5 rounded-full" />
                  )}
                </div>
              );
            })}
            <button
              onClick={() => {
                const newOpt = {
                  id: `opt_${Date.now()}`,
                  label: `Option ${String.fromCharCode(65 + currentOpts().length)}`,
                  value: "",
                };
                updateOpts([...currentOpts(), newOpt]);
              }}
              className="mari-editor-action mari-editor-action--compact flex items-center gap-1 px-2 py-1 text-[0.625rem]"
            >
              <Plus size="0.625rem" /> {localizeUi("ui.noodle.noodlehome.addOption")}
            </button>
          </div>

          {/* Expanded value editor for a single option */}
          {expandedOpt && (
            <ExpandedEditorModal
              title={localizeUi("ui.presets.variablecard.editValueValue1", {
                value1: expandedOpt.label || localizeUi("ui.presets.variablecard.option"),
              })}
              value={expandedOpt.value}
              onChange={(v) => updateOptionField(expandedOpt.id, "value", v)}
              onClose={() => setExpandedOptId(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Variable Name Input (local state, commits on blur/Enter) ──
function VariableNameInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const { t: localizeUi } = useUiTranslation();
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<TextSelection | null>(null);
  const focusedRef = useRef(false);
  useRestoreTextSelection(inputRef, selectionRef, local);
  useEffect(() => {
    if (!focusedRef.current) setLocal(value);
  }, [value]);
  return (
    <input
      ref={inputRef}
      value={local}
      onFocus={(e) => {
        focusedRef.current = true;
        if (shouldSelectTextOnFocus()) e.target.select();
      }}
      onChange={(e) => {
        const rawValue = e.target.value;
        const selectionStart = e.target.selectionStart ?? rawValue.length;
        const selectionEnd = e.target.selectionEnd ?? selectionStart;
        selectionRef.current = getSanitizedVariableSelection(rawValue, selectionStart, selectionEnd);
        setLocal(sanitizeVariableName(rawValue));
      }}
      onBlur={() => {
        focusedRef.current = false;
        if (local !== value) onCommit(local);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="mari-editor-field w-full px-2 py-1 font-mono text-xs"
      placeholder={localizeUi("ui.presets.variablenameinput.variableName")}
    />
  );
}

// ── Option field input (local state, debounced commit + commit on blur) ──
function OptionFieldInput({
  value,
  onCommit,
  className,
  placeholder,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<TextSelection | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusedRef = useRef(false);
  const formatQuotes = useQuoteFormatter();
  useRestoreTextSelection(inputRef, selectionRef, local);
  useEffect(() => {
    if (!focusedRef.current) setLocal(value);
  }, [value]);
  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );
  return (
    <input
      ref={inputRef}
      value={local}
      onFocus={(e) => {
        focusedRef.current = true;
        if (shouldSelectTextOnFocus()) e.target.select();
      }}
      onChange={(e) => {
        const rawValue = e.target.value;
        const selectionStart = e.target.selectionStart ?? rawValue.length;
        const selectionEnd = e.target.selectionEnd ?? selectionStart;
        selectionRef.current = getFormattedTextSelection(rawValue, selectionStart, selectionEnd, formatQuotes);
        const nextValue = formatQuotes(rawValue);
        setLocal(nextValue);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          onCommit(nextValue);
        }, 600);
      }}
      onBlur={() => {
        focusedRef.current = false;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        if (local !== value) onCommit(local);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={className}
      placeholder={placeholder}
    />
  );
}

// ── Variable Question Input (local state, commits on blur/Enter) ──
function VariableQuestionInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const { t: localizeUi } = useUiTranslation();
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<TextSelection | null>(null);
  const focusedRef = useRef(false);
  const formatQuotes = useQuoteFormatter();
  useRestoreTextSelection(inputRef, selectionRef, local);
  useEffect(() => {
    if (!focusedRef.current) setLocal(value);
  }, [value]);
  return (
    <input
      ref={inputRef}
      value={local}
      onFocus={(e) => {
        focusedRef.current = true;
        if (shouldSelectTextOnFocus()) e.target.select();
      }}
      onChange={(e) => {
        const rawValue = e.target.value;
        const selectionStart = e.target.selectionStart ?? rawValue.length;
        const selectionEnd = e.target.selectionEnd ?? selectionStart;
        selectionRef.current = getFormattedTextSelection(rawValue, selectionStart, selectionEnd, formatQuotes);
        setLocal(formatQuotes(rawValue));
      }}
      onBlur={() => {
        focusedRef.current = false;
        if (local !== value) onCommit(local);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="mari-editor-field w-full px-2 py-1 text-xs"
      placeholder={localizeUi("ui.presets.variablequestioninput.whatShouldTheUserChoose")}
    />
  );
}

// ── Expanded prompt editor modal ──
function PresetModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

function ExpandedEditorModal({
  title,
  value,
  onChange,
  onClose,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef<TextSelection | null>(null);
  const [local, setLocal] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formatQuotes = useQuoteFormatter();
  useRestoreTextSelection(textareaRef, selectionRef, local);

  // Sync from parent only on initial mount (not on every re-render)
  useEffect(() => {
    setLocal(value);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus the textarea on mount
  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (local !== value) onChange(local);
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, onChange, local, value]);

  // Cleanup timer on unmount
  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const rawValue = e.target.value;
    const selectionStart = e.target.selectionStart ?? rawValue.length;
    const selectionEnd = e.target.selectionEnd ?? selectionStart;
    selectionRef.current = getFormattedTextSelection(rawValue, selectionStart, selectionEnd, formatQuotes);
    const v = formatQuotes(rawValue);
    setLocal(v);
    // Debounced commit so the parent stays in sync without cursor jumps
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      onChange(v);
    }, 600);
  };

  const handleClose = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    onClose();
  };

  return (
    <PresetModalPortal>
      <div
        data-chat-floating-panel
        className="fixed inset-0 z-50 flex items-center justify-center p-3 pb-[max(0.75rem,var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom)))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-6"
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
        <div className="mari-editor-shell mari-editor-legacy-bridge relative flex h-[80vh] max-h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col rounded-2xl border border-[var(--marinara-editor-border)] bg-[var(--marinara-editor-surface-bg)] shadow-2xl shadow-black/50 [--marinara-editor-bg:var(--sidebar)] [--marinara-editor-control-bg:var(--sidebar)] [--marinara-editor-surface-bg:var(--sidebar)] supports-[height:100dvh]:h-[80dvh] supports-[height:100dvh]:max-h-[calc(100dvh-1.5rem)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <h3 className="text-sm font-semibold">{title}</h3>
            <button onClick={handleClose} className="rounded-lg p-1.5 hover:bg-[var(--accent)]">
              <X size="1rem" />
            </button>
          </div>
          {/* Editor */}
          <div className="flex-1 overflow-hidden p-4">
            <textarea
              ref={textareaRef}
              value={local}
              onChange={handleChange}
              onBlur={() => {
                if (timeoutRef.current) {
                  clearTimeout(timeoutRef.current);
                  timeoutRef.current = null;
                }
                if (local !== value) onChange(local);
              }}
              onKeyDown={handleTextareaTab}
              className="mari-editor-field h-full w-full resize-none p-4 font-mono text-sm"
              placeholder={localizeUi("ui.presets.expandededitormodal.promptContentSupportsMacrosLikeUserCharEtc")}
            />
          </div>
          {/* Footer */}
          <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2.5">
            <p className="text-[0.625rem] text-[var(--muted-foreground)]">
              {localizeUi("ui.presets.expandededitormodal.changesAutoSavePressEscapeToClose")}
            </p>
            <button
              onClick={handleClose}
              className="mari-editor-action mari-editor-action--primary mari-editor-action--compact inline-flex px-4 py-1.5"
            >
              {localizeUi("lorebook.editor.batch.done")}
            </button>
          </div>
        </div>
      </div>
    </PresetModalPortal>
  );
}
