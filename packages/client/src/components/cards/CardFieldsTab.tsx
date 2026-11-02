/**
 * The Card tab body shared by the character and persona editors.
 *
 * Each prose field has one binding here, plus Prof. Mari generation and the
 * alternatives selector. Entry points supply copy, section order and
 * role-only bodies (the character summary and greeting/onboarding dialogue)
 * through a field's `render`; variable chips stay at the callsite.
 */
import type { ReactNode } from "react";
import { CARD_FIELD_KEYS } from "@marinara-engine/shared";
import type { CardFieldAlternative, CardFieldDraft, CardFieldKey } from "@marinara-engine/shared";

import { CardFieldAlternatives } from "../characters/CardFieldAlternatives";
import { CardFieldWand } from "../characters/CardFieldWand";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import { EditorSectionAnchor } from "../ui/EditorSectionJumps";
import { useCardFieldGeneration } from "../../hooks/use-card-field-generation";
import { CardProseDescription, CardProseTextarea, type CardProseVariant } from "./CardProse";

export type CardFieldsTabLabels = ReturnType<typeof useCardFieldGeneration>["labels"];

export type CardFieldsTabFieldContext = {
  value: string;
  onChange: (value: string) => void;
  card: CardFieldDraft;
  /** This field's wand, wired to the shared generation hook. */
  actions: ReactNode;
  /** This field's alternatives selector, after any callsite footer. */
  footer: ReactNode;
};

type CardFieldsTabFieldBase = {
  key: CardFieldKey;
  /** Anchor id used by the entry point's EditorSectionJumps. */
  sectionId: string;
};

export type CardFieldsTabProseField = CardFieldsTabFieldBase & {
  title: string;
  subtitle: string;
  helpText?: ReactNode;
  placeholder: string;
  rows?: number;
  /** The field id Prof. Mari knows this field by (see lib/mari-editor-fields). */
  mariField?: string;
};

export type CardFieldsTabCustomField = CardFieldsTabFieldBase & {
  render: (context: CardFieldsTabFieldContext) => ReactNode;
};

export type CardFieldsTabField = CardFieldsTabProseField | CardFieldsTabCustomField;

export type CardFieldsTabImageAppearance = {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  toggleLabel: string;
  toggleHelp: string;
  title: string;
  subtitle: string;
  placeholder: string;
  /** Persona stores this flat; character leaves it unset. */
  mariField?: string;
};

export type CardFieldsTabProps = {
  variant: CardProseVariant;
  entityId: string | null;
  name: string;
  values: Record<CardFieldKey, string>;
  onFieldChange: (key: CardFieldKey, value: string) => void;
  /** Array order is the rendered order. */
  fields: CardFieldsTabField[];
  /** Rendered after the appearance field. */
  imageAppearance: CardFieldsTabImageAppearance;
  alternatives: CardFieldAlternative[];
  onAlternativesChange: (alternatives: CardFieldAlternative[]) => void;
  /** Persona derives jump labels from the generation labels; character's are static. */
  renderJumps: (labels: CardFieldsTabLabels) => ReactNode;
  /** Content shown above the alternatives selector, e.g. variable chips. */
  renderFooter?: (key: CardFieldKey) => ReactNode;
  onTextareaRef?: (key: CardFieldKey, element: HTMLTextAreaElement | null) => void;
  onFieldFocus?: (key: CardFieldKey) => void;
};

export function CardFieldsTab({
  variant,
  entityId,
  name,
  values,
  onFieldChange,
  fields,
  imageAppearance,
  alternatives,
  onAlternativesChange,
  renderJumps,
  renderFooter,
  onTextareaRef,
  onFieldFocus,
}: CardFieldsTabProps) {
  // Only the card fields: persona passes its whole form as `values`, and this
  // draft is posted with every generation request.
  const card = { name } as CardFieldDraft;
  for (const key of CARD_FIELD_KEYS) card[key] = values[key];
  const generation = useCardFieldGeneration(variant, entityId, card, onFieldChange);

  const renderField = (field: CardFieldsTabField) => {
    const value = values[field.key];
    const onChange = (next: string) => onFieldChange(field.key, next);
    const actions = (
      <CardFieldWand
        label={generation.labels[field.key]}
        onGenerate={() => void generation.generate(field.key)}
        disabled={!entityId || generation.isPending}
        loading={generation.pendingField === field.key}
      />
    );
    const footer = (
      <>
        {renderFooter?.(field.key)}
        <CardFieldAlternatives
          kind={variant}
          entityId={entityId}
          field={field.key}
          label={generation.labels[field.key]}
          card={card}
          alternatives={alternatives}
          onChange={onAlternativesChange}
        />
      </>
    );
    if ("render" in field) return field.render({ value, onChange, card, actions, footer });

    const textareaRef = onTextareaRef
      ? (element: HTMLTextAreaElement | null) => onTextareaRef(field.key, element)
      : undefined;
    const onFocus = onFieldFocus ? () => onFieldFocus(field.key) : undefined;
    if (field.key === "description") {
      return (
        <CardProseDescription
          variant={variant}
          value={value}
          onChange={onChange}
          subtitle={field.subtitle}
          helpText={field.helpText}
          placeholder={field.placeholder}
          actions={actions}
          footer={footer}
          textareaRef={textareaRef}
          onFocus={onFocus}
        />
      );
    }
    return (
      <CardProseTextarea
        variant={variant}
        mariField={field.mariField}
        title={field.title}
        subtitle={field.subtitle}
        helpText={field.helpText}
        value={value}
        onChange={onChange}
        placeholder={field.placeholder}
        rows={field.rows}
        textareaRef={textareaRef}
        onFocus={onFocus}
        actions={actions}
        footer={footer}
      />
    );
  };

  return (
    <>
      {renderJumps(generation.labels)}
      <div className="space-y-10">
        {fields.map((field) => (
          <EditorSectionAnchor key={field.key} id={field.sectionId}>
            {renderField(field)}
            {field.key === "appearance" && <ImageAppearanceBlock config={imageAppearance} variant={variant} />}
          </EditorSectionAnchor>
        ))}
      </div>
    </>
  );
}

function ImageAppearanceBlock({
  config,
  variant,
}: {
  config: CardFieldsTabImageAppearance;
  variant: CardProseVariant;
}) {
  return (
    <>
      <div className="mt-3">
        <SettingsSwitch
          label={<span className="font-medium">{config.toggleLabel}</span>}
          description={config.toggleHelp}
          checked={config.enabled}
          onChange={config.onToggle}
          labelPosition="start"
          className="justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        />
      </div>
      {config.enabled && (
        <div className="mt-3">
          <CardProseTextarea
            variant={variant}
            mariField={config.mariField}
            title={config.title}
            subtitle={config.subtitle}
            value={config.value}
            onChange={config.onChange}
            placeholder={config.placeholder}
            rows={6}
          />
        </div>
      )}
    </>
  );
}
