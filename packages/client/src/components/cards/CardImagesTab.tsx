import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { EditorSectionJumps } from "../ui/EditorSectionJumps";
import { LazyEditorSection } from "../ui/LazyEditorSection";
import { CardProseSectionHeader as SectionHeader } from "./CardProse";

/**
 * Sub-section ids inside the Images tab. They double as old tab ids: `sprites` and `gallery` were tabs before
 * #9191, and `useEditorSections` resolves them to their sub-section, so old links still land in place.
 */
export const CARD_IMAGES_SUBSECTIONS = {
  sheet: "character-sheet",
  instructions: "image-instructions",
  sprites: "sprites",
  gallery: "gallery",
} as const;

/**
 * The Images tab of the character and persona editors: the character sheet, selfie instructions (characters only),
 * sprites and gallery behind one set of jump pills. A layout shell only: each editor passes its own sections,
 * because their save models differ (the sheet saves at once on characters, through the draft on personas).
 */
export function CardImagesTab({
  variant,
  entityKey,
  sheet,
  instructions,
  sprites,
  gallery,
  onJump,
}: {
  variant: "character" | "persona";
  /** The edited card's id: lazy sections remount per card, like the editor's other media sections. */
  entityKey: string;
  sheet: ReactNode;
  /** Characters only: the selfie instructions field. Omitted, its pill is hidden too. */
  instructions?: ReactNode;
  sprites: ReactNode;
  gallery: ReactNode;
  /** The editor's anchored scroll; Sprites and Gallery grow as they load, which a plain jump would overshoot. */
  onJump: (id: string) => void;
}) {
  const { t } = useTranslation();
  const jumps = [
    { id: CARD_IMAGES_SUBSECTIONS.sheet, label: t("ui.cards.imagesTab.jumpSheet") },
    ...(instructions
      ? [{ id: CARD_IMAGES_SUBSECTIONS.instructions, label: t("ui.cards.imagesTab.jumpInstructions") }]
      : []),
    { id: CARD_IMAGES_SUBSECTIONS.sprites, label: t("ui.cards.imagesTab.jumpSprites") },
    { id: CARD_IMAGES_SUBSECTIONS.gallery, label: t("ui.cards.imagesTab.jumpGallery") },
  ];

  return (
    <div>
      <SectionHeader
        variant={variant}
        title={t("editor.tabs.images")}
        subtitle={t(variant === "persona" ? "ui.cards.imagesTab.subtitlePersona" : "ui.cards.imagesTab.subtitle")}
      />
      <EditorSectionJumps items={jumps} onJump={onJump} className="mb-6" />
      <div className="mari-editor-images-sections space-y-10">
        <LazyEditorSection key={`sheet:${entityKey}`} id={CARD_IMAGES_SUBSECTIONS.sheet} nested>
          {sheet}
        </LazyEditorSection>
        {instructions && (
          <section data-editor-subsection={CARD_IMAGES_SUBSECTIONS.instructions}>{instructions}</section>
        )}
        <LazyEditorSection key={`sprites:${entityKey}`} id={CARD_IMAGES_SUBSECTIONS.sprites} nested>
          {sprites}
        </LazyEditorSection>
        <LazyEditorSection key={`gallery:${entityKey}`} id={CARD_IMAGES_SUBSECTIONS.gallery} nested>
          {gallery}
        </LazyEditorSection>
      </div>
    </div>
  );
}

/** The selfie instructions field (was "Image generation instructions" on the Convo tab; stored key unchanged). */
export function SelfieInstructionsField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="mari-editor-panel space-y-3 p-3">
      <label htmlFor="card-selfie-instructions" className="inline-flex items-center gap-1 text-xs font-semibold">
        {t("ui.cards.imagesTab.selfieInstructions")}
      </label>
      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
        {t("ui.cards.imagesTab.selfieInstructionsHelp")}
      </p>
      <textarea
        id="card-selfie-instructions"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("ui.cards.imagesTab.selfieInstructionsPlaceholder")}
        rows={5}
        className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
      />
    </div>
  );
}
