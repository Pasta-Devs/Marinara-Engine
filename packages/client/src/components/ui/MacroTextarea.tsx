import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Maximize2, X } from "lucide-react";
import { SUPPORTED_MACROS } from "@marinara-engine/shared";

import { cn } from "../../lib/utils";

type MacroDefinition = (typeof SUPPORTED_MACROS)[number];

const MACRO_REFERENCE = Array.from(
  SUPPORTED_MACROS.reduce<Map<string, MacroDefinition[]>>((groups, macro) => {
    const next = groups.get(macro.category) ?? [];
    next.push(macro);
    groups.set(macro.category, next);
    return groups;
  }, new Map()),
);

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
  formatOnChange?: (textarea: HTMLTextAreaElement) => string;
}

function insertTextAtSelection(target: HTMLTextAreaElement, insertText: string): { value: string; cursor: number } {
  const { selectionStart, selectionEnd, value } = target;
  return {
    value: `${value.slice(0, selectionStart)}${insertText}${value.slice(selectionEnd)}`,
    cursor: selectionStart + insertText.length,
  };
}

function ExpandedMacroEditor({
  open,
  title,
  value,
  onChange,
  onClose,
  placeholder,
  formatOnChange,
}: ExpandedMacroEditorProps) {
  const [localValue, setLocalValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setLocalValue(value);
    window.setTimeout(() => textareaRef.current?.focus(), 20);
  }, [open, value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onChange(localValue);
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [localValue, onChange, onClose, open]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const nextValue = formatOnChange ? formatOnChange(event.currentTarget) : event.currentTarget.value;
      setLocalValue(nextValue);
      onChange(nextValue);
    },
    [formatOnChange, onChange],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Tab") {
        return;
      }

      event.preventDefault();
      const target = event.currentTarget;
      const next = insertTextAtSelection(target, "  ");
      setLocalValue(next.value);
      onChange(next.value);
      requestAnimationFrame(() => {
        target.selectionStart = next.cursor;
        target.selectionEnd = next.cursor;
      });
    },
    [onChange],
  );

  if (!open) {
    return null;
  }

  return (
    <MacroModalPortal>
      <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-sm sm:p-4">
        <div className="flex h-[min(92vh,56rem)] max-h-[calc(100vh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)] shadow-2xl supports-[height:100dvh]:h-[min(92dvh,56rem)] supports-[height:100dvh]:max-h-[calc(100dvh-1.5rem)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
              <p className="text-xs text-[var(--muted-foreground)]">Expanded editor</p>
            </div>
            <button
              type="button"
              onClick={() => {
                onChange(localValue);
                onClose();
              }}
              className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-2 text-[var(--muted-foreground)] transition hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
              aria-label="Close expanded editor"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <textarea
            ref={textareaRef}
            value={localValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
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
      <div className="fixed inset-0 z-[145] flex items-center justify-center bg-black/70 p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-sm sm:p-4">
        <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)] shadow-2xl supports-[height:100dvh]:max-h-[88dvh]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Macro reference</h3>
              <p className="text-xs text-[var(--muted-foreground)]">Macros are replaced with live chat, character, and preset values during generation.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-2 text-[var(--muted-foreground)] transition hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
              aria-label="Close macro reference"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[calc(88vh-4rem)] space-y-4 overflow-y-auto p-4 supports-[height:100dvh]:max-h-[calc(88dvh-4rem)]">
            <section className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-xs text-[var(--muted-foreground)]">
              <p>
                Use <code className="text-[var(--foreground)]">{"{{macro}}"}</code> anywhere in prompt fields. Conditional blocks let you include content only when a value exists.
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-2">
                  <p className="font-semibold text-[var(--foreground)]">Conditional block</p>
                  <code className="mt-1 block whitespace-pre-wrap text-[var(--primary)]">{"{{#if character == \"Dottore\"}}\nWrite this for Dottore.\n{{else}}\nWrite this for anyone else.\n{{/if}}"}</code>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-2">
                  <p className="font-semibold text-[var(--foreground)]">Supported comparisons</p>
                  <code className="mt-1 block whitespace-pre-wrap text-[var(--primary)]">{"{{#if character != \"Dottore\"}}\n...\n{{/if}}\n{{#if user contains \"Mari\"}}\n...\n{{/if}}"}</code>
                </div>
              </div>
            </section>
            {MACRO_REFERENCE.map(([category, macros]) => (
              <section key={category} className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">{category}</h4>
                <div className="grid gap-2 md:grid-cols-2">
                  {macros.map((macro) => (
                    <div key={macro.syntax} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-2">
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
  placeholder?: string;
  className?: string;
  wrapperClassName?: string;
  buttonClassName?: string;
  toolbarClassName?: string;
  controlPaddingClassName?: string;
  toolbarExtra?: ReactNode;
  formatOnChange?: (textarea: HTMLTextAreaElement) => string;
  showMacroReference?: boolean;
  showExpand?: boolean;
  spellCheck?: boolean;
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
  spellCheck = true,
}: MacroTextareaProps) {
  const [expanded, setExpanded] = useState(false);
  const [showMacroRef, setShowMacroRef] = useState(false);

  const handleExpandedClose = useCallback(() => {
    setExpanded(false);
    onExpandedClose?.();
  }, [onExpandedClose]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(formatOnChange ? formatOnChange(event.currentTarget) : event.currentTarget.value);
    },
    [formatOnChange, onChange],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || event.key !== "Tab") {
        return;
      }

      event.preventDefault();
      const target = event.currentTarget;
      const next = insertTextAtSelection(target, "  ");
      onChange(next.value);
      requestAnimationFrame(() => {
        target.selectionStart = next.cursor;
        target.selectionEnd = next.cursor;
      });
    },
    [onChange, onKeyDown],
  );

  const affordanceButtonClassName = cn(
    "rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
    buttonClassName,
  );

  return (
    <>
      <div className={cn("relative", wrapperClassName)}>
        <textarea
          value={value}
          onChange={handleChange}
          onBlur={onBlur}
          onFocus={onFocus}
          onKeyDown={handleKeyDown}
          rows={rows}
          placeholder={placeholder}
          spellCheck={spellCheck}
          className={cn(
            "w-full resize-y rounded-lg bg-[var(--secondary)] p-2.5 text-sm leading-6 text-[var(--foreground)] ring-1 ring-[var(--border)] transition placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
            className,
            controlPaddingClassName ?? (toolbarExtra ? "pr-12" : "pr-8"),
          )}
        />
        {(showExpand || showMacroReference || toolbarExtra) && (
          <div className={cn("absolute right-1.5 top-1.5 flex flex-col gap-0.5", toolbarClassName)}>
            {showExpand ? (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className={affordanceButtonClassName}
                aria-label="Expand editor"
                title="Expand editor"
              >
                <Maximize2 className="h-3 w-3" />
              </button>
            ) : null}
            {showMacroReference ? (
              <button
                type="button"
                onClick={() => setShowMacroRef(true)}
                className={affordanceButtonClassName}
                aria-label="Macro reference"
                title="Macro reference"
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
        formatOnChange={formatOnChange}
      />
      <MacrosReferenceModal open={showMacroRef} onClose={() => setShowMacroRef(false)} />
    </>
  );
}
