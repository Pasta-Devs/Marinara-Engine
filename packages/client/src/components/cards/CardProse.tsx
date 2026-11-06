import type { ReactNode, Ref } from "react";

import { MariFieldReview } from "../characters/MariFieldReview";
import { HelpTooltip } from "../ui/HelpTooltip";
import { MacroTextarea } from "../ui/MacroTextarea";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useUIStore } from "../../stores/ui.store";
import { estimateTextTokens, formatEstimatedTokens } from "../../lib/character-token-count";
import { cn } from "../../lib/utils";

export type CardProseVariant = "character" | "persona";

const FOCUS_CLASS: Record<CardProseVariant, string> = {
  character: "focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20",
  persona: "focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/20",
};

const TEXTAREA_CLASS =
  "w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40";

export type CardProseSectionHeaderProps = {
  title: string;
  subtitle?: string;
  helpText?: ReactNode;
  helpWide?: boolean;
  /** Extra classes on the wrapper, e.g. spacing for a mid-tab group heading. */
  className?: string;
  /** Character is the default so character callsites stay unchanged. */
  variant?: CardProseVariant;
};

export function CardProseSectionHeader({
  title,
  subtitle,
  helpText,
  helpWide = true,
  className,
  variant = "character",
}: CardProseSectionHeaderProps) {
  const persona = variant === "persona";
  const headingClass = cn("inline-flex items-center gap-1.5", persona ? "text-sm font-semibold" : "text-lg font-bold");
  const content = (
    <>
      {title}
      {helpText && (
        <HelpTooltip text={helpText} side="bottom" wide={helpWide} size={persona ? "0.8125rem" : "0.875rem"} />
      )}
    </>
  );

  return (
    <div className={cn("mb-4", className)}>
      {persona ? <h3 className={headingClass}>{content}</h3> : <h2 className={headingClass}>{content}</h2>}
      {subtitle && <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{subtitle}</p>}
    </div>
  );
}

export type CardProseTextareaProps = {
  /** Character by default; persona wrappers opt into the compact variant. */
  variant?: CardProseVariant;
  title: string;
  subtitle: string;
  helpText?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
  /** Extra classes on the textarea; wins over the defaults, e.g. a prompt font. */
  textareaClassName?: string;
  textareaRef?: Ref<HTMLTextAreaElement>;
  onFocus?: () => void;
  /** Shown under the textarea, inside the Mari panel. */
  footer?: ReactNode;
  actions?: ReactNode;
  /** The field id Prof. Mari knows this field by (see lib/mari-editor-fields). */
  mariField?: string;
  /** Passed through for MacroTextarea's self-reference preview when present. */
};

export function CardProseTextarea({
  variant = "character",
  title,
  subtitle,
  helpText,
  value,
  onChange,
  placeholder,
  rows = 8,
  textareaClassName,
  textareaRef,
  onFocus,
  footer,
  actions,
  mariField,
}: CardProseTextareaProps) {
  const { t: localizeUi } = useUiTranslation();
  const persona = variant === "persona";

  const selfCharacterId = useUIStore((state) => (persona ? null : state.characterDetailId));
  return (
    <div className="mari-editor-panel space-y-3 p-3" data-mari-field={mariField}>
      <div className="flex items-start justify-between gap-3">
        <CardProseSectionHeader variant={variant} title={title} subtitle={subtitle} helpText={helpText} />
        {actions}
      </div>
      <MariFieldReview field={mariField ?? ""}>
        <MacroTextarea
          ariaLabel={title}
          textareaRef={textareaRef}
          onFocus={onFocus}
          showTokenCount={!persona}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
          title={title}
          showMarkdownPreview
          selfCharacterId={selfCharacterId}
          className={cn(TEXTAREA_CLASS, FOCUS_CLASS[variant], textareaClassName)}
        />
        {persona && (
          <p className="mt-1.5 text-right text-[0.625rem] text-[var(--muted-foreground)]">
            {formatEstimatedTokens(estimateTextTokens(value), localizeUi)}
          </p>
        )}
      </MariFieldReview>
      {footer}
    </div>
  );
}

export type CardProseDescriptionProps = {
  variant?: CardProseVariant;
  value: string;
  onChange: (value: string) => void;
  subtitle: string;
  helpText?: ReactNode;
  placeholder: string;
  actions?: ReactNode;
  footer?: ReactNode;
  textareaRef?: Ref<HTMLTextAreaElement>;
  onFocus?: () => void;
};

/** The description panel both editors used to implement separately. */
export function CardProseDescription({
  variant = "character",
  value,
  onChange,
  subtitle,
  helpText,
  placeholder,
  actions,
  footer,
  textareaRef,
  onFocus,
}: CardProseDescriptionProps) {
  const { t: localizeUi } = useUiTranslation();

  return (
    <CardProseTextarea
      variant={variant}
      mariField="description"
      title={localizeUi("chat.settings.inlineEditor.fields.description")}
      subtitle={subtitle}
      helpText={helpText}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={12}
      textareaRef={textareaRef}
      onFocus={onFocus}
      footer={footer}
      actions={actions}
    />
  );
}
