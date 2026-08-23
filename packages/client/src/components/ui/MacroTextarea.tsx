import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import { BookOpen, Eye, Maximize2, Pencil, X } from "lucide-react";
import { SUPPORTED_MACROS } from "@marinara-engine/shared";

import { applyInlineMarkdown, renderMarkdownBlocks } from "../../lib/markdown";
import { resolveSelfCardAssets } from "../../lib/card-asset-links";
import { cn } from "../../lib/utils";
import { handleTextareaTab } from "../../lib/textarea-editing";
import { Trans, useTranslation as useUiTranslation } from "react-i18next";

type MacroDefinition = (typeof SUPPORTED_MACROS)[number];

const MACRO_REFERENCE = Array.from(
  SUPPORTED_MACROS.reduce<Map<string, MacroDefinition[]>>((groups, macro) => {
    const next = groups.get(macro.category) ?? [];
    next.push(macro);
    groups.set(macro.category, next);
    return groups;
  }, new Map()),
);

const EDITOR_MODAL_SURFACE_VARIABLES = [
  "[--accent:var(--marinara-editor-control-bg-hover)]",
  "[--accent-foreground:var(--marinara-editor-text)]",
  "[--background:var(--marinara-editor-bg)]",
  "[--border:var(--marinara-editor-border)]",
  "[--card:var(--marinara-editor-surface-bg)]",
  "[--foreground:var(--marinara-editor-text)]",
  "[--input:var(--marinara-editor-border)]",
  "[--muted:var(--marinara-editor-control-bg)]",
  "[--muted-foreground:var(--marinara-editor-muted)]",
  "[--popover:var(--marinara-editor-surface-bg)]",
  "[--popover-foreground:var(--marinara-editor-text)]",
  "[--primary:var(--marinara-editor-accent)]",
  "[--primary-foreground:var(--marinara-editor-bg)]",
  "[--ring:var(--marinara-editor-focus-ring)]",
  "[--secondary:var(--marinara-editor-control-bg)]",
].join(" ");

interface MacroModalPortalProps {
  children: ReactNode;
}

function MacroModalPortal({ children }: MacroModalPortalProps) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}

interface ExpandedMacroEditorProps {
  open: boolean;
  title: string;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  placeholder?: string;
  readOnly?: boolean;
  maxLength?: number;
  formatOnChange?: (textarea: HTMLTextAreaElement, inputEvent: InputEvent) => string;
}

function ExpandedMacroEditor({
  open,
  title,
  value,
  onChange,
  onClose,
  placeholder,
  readOnly = false,
  maxLength,
  formatOnChange,
}: ExpandedMacroEditorProps) {
  const { t: localizeUi } = useUiTranslation();
  const [localValue, setLocalValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!open) {
      return;
    }

    setLocalValue(valueRef.current);
    const focusTimer = window.setTimeout(() => textareaRef.current?.focus(), 20);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!readOnly) onChange(localValue);
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [localValue, onChange, onClose, open, readOnly]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const textarea = event.currentTarget;
      const nextValue = formatOnChange ? formatOnChange(textarea, event.nativeEvent as InputEvent) : textarea.value;
      onChange(nextValue);
      setLocalValue(textarea.value);
    },
    [formatOnChange, onChange],
  );

  if (!open) {
    return null;
  }

  return (
    <MacroModalPortal>
      <div
        data-component="ExpandedMacroEditor"
        data-macro-modal="true"
        className={cn(
          "fixed inset-0 z-[10050] flex items-center justify-center bg-black/70 p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-sm sm:p-4",
          EDITOR_MODAL_SURFACE_VARIABLES,
        )}
      >
        <div className="flex h-[min(92vh,56rem)] max-h-[calc(100vh-1.5rem)] w-full min-w-0 max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)] shadow-2xl supports-[height:100dvh]:h-[min(92dvh,56rem)] supports-[height:100dvh]:max-h-[calc(100dvh-1.5rem)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div className="min-w-0 flex-1">
              <h3 title={title} className="truncate text-sm font-semibold text-[var(--foreground)]">
                {title}
              </h3>
              <p className="text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.ui.expandedmacroeditor.expandedEditor")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!readOnly) onChange(localValue);
                onClose();
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)] transition hover:border-[var(--primary)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              aria-label={localizeUi("ui.ui.expandedmacroeditor.closeExpandedEditor")}
              title={localizeUi("capabilities.actions.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <textarea
            ref={textareaRef}
            value={localValue}
            onChange={handleChange}
            onKeyDown={handleTextareaTab}
            placeholder={placeholder}
            readOnly={readOnly}
            maxLength={maxLength}
            className="min-h-0 flex-1 resize-none bg-[var(--secondary)] p-4 font-mono text-sm leading-6 text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
            spellCheck={false}
          />
        </div>
      </div>
    </MacroModalPortal>
  );
}

interface MacrosReferenceModalProps {
  open: boolean;
  onClose: () => void;
}

function MacrosReferenceModal({ open, onClose }: MacrosReferenceModalProps) {
  const { t: localizeUi } = useUiTranslation();
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <MacroModalPortal>
      <div
        data-component="MacroReference"
        data-macro-modal="true"
        className={cn(
          "fixed inset-0 z-[10050] flex items-center justify-center bg-black/70 p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-sm sm:p-4",
          EDITOR_MODAL_SURFACE_VARIABLES,
        )}
      >
        <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)] shadow-2xl supports-[height:100dvh]:max-h-[88dvh]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                {localizeUi("ui.ui.macrosreferencemodal.macroReference")}
              </h3>
              <p className="text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.ui.macrosreferencemodal.macrosAreReplacedWithLiveChatCharacterAndPreset")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-2 text-[var(--muted-foreground)] transition hover:border-[var(--primary)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              aria-label={localizeUi("ui.ui.macrosreferencemodal.closeMacroReference")}
              title={localizeUi("capabilities.actions.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[calc(88vh-4rem)] space-y-4 overflow-y-auto p-4 supports-[height:100dvh]:max-h-[calc(88dvh-4rem)]">
            <section className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-xs text-[var(--muted-foreground)]">
              <p>
                <Trans
                  i18nKey="ui.ui.macrosreferencemodal.macroUsageGuidance"
                  values={{ macroExample: "{{macro}}" }}
                  components={{
                    macroCode: <code className="text-[var(--foreground)]" />,
                    or: <code className="text-[var(--foreground)]" />,
                    and: <code className="text-[var(--foreground)]" />,
                  }}
                />
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-2">
                  <p className="font-semibold text-[var(--foreground)]">
                    {localizeUi("ui.ui.macrosreferencemodal.conditionalBlock")}
                  </p>
                  <code className="mt-1 block whitespace-pre-wrap text-[var(--primary)]">
                    {
                      '{{#if character == "Dottore"}}\nWrite this for Dottore.\n{{else}}\nWrite this for anyone else.\n{{/if}}'
                    }
                  </code>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-2">
                  <p className="font-semibold text-[var(--foreground)]">
                    {localizeUi("ui.ui.macrosreferencemodal.comparisonsAndLogic")}
                  </p>
                  <code className="mt-1 block whitespace-pre-wrap text-[var(--primary)]">
                    {
                      '{{#if character == "Maukie" || "Pantalone"}}\n...\n{{/if}}\n{{#if scenario && user contains "Mari"}}\n...\n{{/if}}'
                    }
                  </code>
                </div>
              </div>
            </section>
            {MACRO_REFERENCE.map(([category, macros]) => (
              <section key={category} className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  {category}
                </h4>
                <div className="grid gap-2 md:grid-cols-2">
                  {macros.map((macro) => (
                    <div
                      key={macro.syntax}
                      className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-2"
                    >
                      <code className="text-xs font-semibold text-[var(--foreground)]">{macro.syntax}</code>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">{macro.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </MacroModalPortal>
  );
}

export interface MacroTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  onExpandedClose?: () => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  title?: string;
  ariaLabel?: string;
  ariaInvalid?: boolean;
  placeholder?: string;
  className?: string;
  wrapperClassName?: string;
  buttonClassName?: string;
  toolbarClassName?: string;
  controlPaddingClassName?: string;
  toolbarExtra?: ReactNode;
  formatOnChange?: (textarea: HTMLTextAreaElement, inputEvent: InputEvent) => string;
  showMacroReference?: boolean;
  showExpand?: boolean;
  showMarkdownPreview?: boolean;
  /** Character the edited field belongs to — resolves card://self refs in the preview only. */
  selfCharacterId?: string | null;
  spellCheck?: boolean;
  readOnly?: boolean;
  maxLength?: number;
  /** Optional ref to the underlying textarea (e.g. to insert emoji at the caret). */
  textareaRef?: Ref<HTMLTextAreaElement>;
}

export function MacroTextarea({
  value,
  onChange,
  onBlur,
  onFocus,
  onExpandedClose,
  onKeyDown,
  rows = 6,
  title = "Edit text",
  ariaLabel,
  ariaInvalid,
  placeholder,
  className,
  wrapperClassName,
  buttonClassName,
  toolbarClassName,
  controlPaddingClassName,
  toolbarExtra,
  formatOnChange,
  showMacroReference = true,
  showExpand = true,
  showMarkdownPreview = false,
  selfCharacterId,
  spellCheck = true,
  readOnly = false,
  maxLength,
  textareaRef,
}: MacroTextareaProps) {
  const { t: localizeUi } = useUiTranslation();
  const [expanded, setExpanded] = useState(false);
  const [showMacroRef, setShowMacroRef] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleExpandedClose = useCallback(() => {
    setExpanded(false);
    onExpandedClose?.();
  }, [onExpandedClose]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(
        formatOnChange
          ? formatOnChange(event.currentTarget, event.nativeEvent as InputEvent)
          : event.currentTarget.value,
      );
    },
    [formatOnChange, onChange],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || event.key !== "Tab") {
        return;
      }

      handleTextareaTab(event);
    },
    [onKeyDown],
  );

  const affordanceButtonClassName = cn(
    "rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
    buttonClassName,
  );

  return (
    <>
      <div className={cn("relative", wrapperClassName)}>
        {showMarkdownPreview && showPreview ? (
          <div
            role="region"
            aria-label={ariaLabel ?? localizeUi("ui.ui.macrotextarea.markdownPreview")}
            style={{ minHeight: `${rows * 1.5 + 1.25}rem` }}
            className={cn(
              "mari-message-content w-full overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--secondary)] p-2.5 text-sm leading-6 text-[var(--foreground)] ring-1 ring-[var(--border)]",
              className,
              controlPaddingClassName ?? (toolbarExtra ? "pr-12" : "pr-8"),
            )}
          >
            {value.trim() ? (
              renderMarkdownBlocks(resolveSelfCardAssets(value, selfCharacterId), applyInlineMarkdown, "field-preview")
            ) : (
              <span className="text-[var(--muted-foreground)]">{placeholder}</span>
            )}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onBlur={onBlur}
            onFocus={onFocus}
            onKeyDown={handleKeyDown}
            rows={rows}
            aria-label={ariaLabel}
            aria-invalid={ariaInvalid || undefined}
            placeholder={placeholder}
            spellCheck={spellCheck}
            readOnly={readOnly}
            maxLength={maxLength}
            className={cn(
              "w-full resize-y rounded-lg bg-[var(--secondary)] p-2.5 text-sm leading-6 text-[var(--foreground)] ring-1 ring-[var(--border)] transition placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
              className,
              controlPaddingClassName ?? (toolbarExtra ? "pr-12" : "pr-8"),
            )}
          />
        )}
        {(showExpand || showMacroReference || showMarkdownPreview || toolbarExtra) && (
          <div className={cn("absolute right-1.5 top-1.5 flex flex-col gap-0.5", toolbarClassName)}>
            {showMarkdownPreview ? (
              <button
                type="button"
                onClick={() => setShowPreview((current) => !current)}
                className={affordanceButtonClassName}
                aria-pressed={showPreview}
                aria-label={localizeUi(
                  showPreview ? "ui.ui.macrotextarea.editMarkdownSource" : "ui.ui.macrotextarea.previewMarkdown",
                )}
                title={localizeUi(
                  showPreview ? "ui.ui.macrotextarea.editMarkdownSource" : "ui.ui.macrotextarea.previewMarkdown",
                )}
              >
                {showPreview ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            ) : null}
            {showExpand ? (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className={affordanceButtonClassName}
                aria-label={localizeUi("ui.ui.macrotextarea.expandEditor")}
                title={localizeUi("ui.ui.macrotextarea.expandEditor")}
              >
                <Maximize2 className="h-3 w-3" />
              </button>
            ) : null}
            {showMacroReference ? (
              <button
                type="button"
                onClick={() => setShowMacroRef(true)}
                className={affordanceButtonClassName}
                aria-label={localizeUi("ui.ui.macrosreferencemodal.macroReference")}
                title={localizeUi("ui.ui.macrosreferencemodal.macroReference")}
              >
                <BookOpen className="h-3 w-3" />
              </button>
            ) : null}
            {toolbarExtra}
          </div>
        )}
      </div>
      <ExpandedMacroEditor
        open={expanded}
        title={title}
        value={value}
        onChange={onChange}
        onClose={handleExpandedClose}
        placeholder={placeholder}
        readOnly={readOnly}
        maxLength={maxLength}
        formatOnChange={formatOnChange}
      />
      <MacrosReferenceModal open={showMacroRef} onClose={() => setShowMacroRef(false)} />
    </>
  );
}
