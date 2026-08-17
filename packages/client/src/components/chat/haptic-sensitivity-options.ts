import type { HapticFeedbackSensitivity } from "@marinara-engine/shared";

export const HAPTIC_SENSITIVITY_OPTIONS: ReadonlyArray<{
  id: HapticFeedbackSensitivity;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    id: "subtle",
    labelKey: "ui.chat.hapticsetupfields.subtle",
    descriptionKey: "ui.chat.hapticsetupfields.subtleDescription",
  },
  {
    id: "standard",
    labelKey: "ui.chat.hapticsetupfields.standard",
    descriptionKey: "ui.chat.hapticsetupfields.standardDescription",
  },
  {
    id: "intense",
    labelKey: "ui.chat.hapticsetupfields.intense",
    descriptionKey: "ui.chat.hapticsetupfields.intenseDescription",
  },
];
