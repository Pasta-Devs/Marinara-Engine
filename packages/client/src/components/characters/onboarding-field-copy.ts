// ──────────────────────────────────────────────
// Onboarding persona-field copy
// The five fields a card's onboarding template writes reuse the persona editor's
// Card copy. They live here, not inside CharacterEditor, so the player's persona
// preview can share the same labels without pulling the whole lazy-loaded
// editor into the setup-wizard chunk.
// ──────────────────────────────────────────────
import type { OnboardingPersonaField } from "@marinara-engine/shared";

export interface OnboardingFieldCopy {
  title: string;
  subtitle: string;
  placeholder: string;
  rows: number;
}

/**
 * The onboarding fields reuse the persona editor's Card copy: what the author
 * writes here becomes the player's persona, not part of this character.
 */
export const ONBOARDING_FIELD_COPY: Record<OnboardingPersonaField, OnboardingFieldCopy> = {
  description: {
    title: "chat.settings.inlineEditor.fields.description",
    subtitle: "ui.personas.descriptiontab.yourGeneralDescriptionThisIsSentInEveryPrompt",
    placeholder: "ui.personas.descriptiontab.describeWhoYouAreYourRoleInTheStory",
    rows: 12,
  },
  personality: {
    title: "chat.settings.inlineEditor.fields.personality",
    subtitle: "ui.personas.personacardtab.yourPersonalityTraitsTemperamentAndBehavioralPatterns",
    placeholder: "ui.personas.personacardtab.calmAndAnalyticalButQuickToActWhenSomeone",
    rows: 8,
  },
  backstory: {
    title: "chat.settings.inlineEditor.fields.backstory",
    subtitle: "ui.personas.personacardtab.yourCharacterSHistoryOriginStoryAndFormativeLife",
    placeholder: "ui.personas.personacardtab.grewUpInAFrontierTownApprenticedUnderA",
    rows: 12,
  },
  appearance: {
    title: "chat.settings.inlineEditor.fields.appearance",
    subtitle: "ui.personas.personacardtab.physicalDescriptionHeightBuildHairEyesClothingDistinguishingFeatures",
    placeholder: "ui.personas.personacardtab.averageHeightDarkHairWornLoosePrefersPracticalClothing",
    rows: 8,
  },
  scenario: {
    title: "chat.settings.inlineEditor.fields.scenario",
    subtitle: "ui.personas.personacardtab.yourDefaultSituationOrContextWithinRoleplays",
    placeholder: "ui.personas.personacardtab.aWanderingAdventurerSeekingAnswersAboutAMysteriousArtifact",
    rows: 8,
  },
};
