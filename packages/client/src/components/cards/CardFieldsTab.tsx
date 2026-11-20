/**
 * The Card tab body shared by the character and persona editors.
 *
 * Each prose field has one binding here, plus Prof. Mari generation and the
 * alternatives selector. Entry points supply copy, section order and
 * role-only bodies (the character summary and greeting/onboarding dialogue)
 * through a field's `render`; variable chips stay at the callsite.
 */
import { useState, type ReactNode } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { CARD_FIELD_KEYS } from "@marinara-engine/shared";
import type { CardFieldAlternative, CardFieldDraft, CardFieldKey } from "@marinara-engine/shared";

import { CardFieldAlternatives } from "../characters/CardFieldAlternatives";
import { CardFieldWand } from "../characters/CardFieldWand";
import { EditorSectionAnchor } from "../ui/EditorSectionJumps";
import { useCardFieldGeneration } from "../../hooks/use-card-field-generation";
import {
  AppearanceTabHint,
  AppearanceTabs,
  changeImageTags,
  type AppearanceImageTagsState,
  type AppearanceTab,
} from "./AppearanceImageTags";
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

/** The Appearance field's image tags (#7053), shown as its second tab (#9605). */
export type CardFieldsTabImageAppearance = AppearanceImageTagsState & {
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
  /** The appearance field's Image tags tab. */
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
  const { t: localizeUi } = useUiTranslation();
  const [appearanceTab, setAppearanceTab] = useState<AppearanceTab>("prose");

  const renderField = (field: CardFieldsTabField) => {
    const value = values[field.key];
    const onChange = (next: string) => onFieldChange(field.key, next);
    const actions = (
      <CardFieldWand
        label={generation.labels[field.key]}
        onGenerate={() => void generation.generate(field.key)}
        disabled={!entityId || generation.isPending}
        loading={generation.pendingField === field.key}
        field={field.key}
      />
    );
    const alternativesFooter = (
      <CardFieldAlternatives
        kind={variant}
        entityId={entityId}
        field={field.key}
        label={generation.labels[field.key]}
        card={card}
        alternatives={alternatives}
        onChange={onAlternativesChange}
        imageAppearance={field.key === "appearance" ? imageAppearance : undefined}
      />
    );
    const footer = (
      <>
        {renderFooter?.(field.key)}
        {alternativesFooter}
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
    if (field.key === "appearance" && appearanceTab === "imageTags") {
      return (
        <CardProseTextarea
          key="appearance-image-tags"
          variant={variant}
          mariField={imageAppearance.mariField}
          title={field.title}
          subtitle={field.subtitle}
          helpText={field.helpText}
          textareaLabel={localizeUi("ui.cards.appearanceImageTags.textareaLabel")}
          value={imageAppearance.value}
          onChange={(next) => changeImageTags(imageAppearance, next)}
          placeholder={localizeUi("ui.characters.charactercardtab.imageAppearancePlaceholder")}
          rows={field.rows}
          textareaClassName={imageAppearance.enabled ? undefined : "opacity-60"}
          // No wand here: it writes the Appearance prose, which this tab hides.
          belowHeader={appearanceTabs}
          footer={
            <>
              <AppearanceTabHint tab="imageTags" state={imageAppearance} />
              {/* No variable chips: they insert into the Appearance prose, which this tab hides. */}
              {alternativesFooter}
            </>
          }
        />
      );
    }
    return (
      <CardProseTextarea
        key={field.key === "appearance" ? "appearance-prose" : undefined}
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
        belowHeader={field.key === "appearance" ? appearanceTabs : undefined}
        footer={
          field.key === "appearance" ? (
            <>
              <AppearanceTabHint tab="prose" state={imageAppearance} />
              {footer}
            </>
          ) : (
            footer
          )
        }
      />
    );
  };

  const appearanceTabs = <AppearanceTabs tab={appearanceTab} onTabChange={setAppearanceTab} state={imageAppearance} />;

  return (
    <>
      {renderJumps(generation.labels)}
      <div className="space-y-10">
        {fields.map((field) => (
          <EditorSectionAnchor key={field.key} id={field.sectionId}>
            {renderField(field)}
          </EditorSectionAnchor>
        ))}
      </div>
    </>
  );
}
