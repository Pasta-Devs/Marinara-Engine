import { create } from "zustand";

export type AppDialogTone = "default" | "destructive";

type AppDialogCommon = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: AppDialogTone;
};

export type AlertDialogState = AppDialogCommon & {
  kind: "alert";
};

export type ConfirmDialogState = AppDialogCommon & {
  kind: "confirm";
  /** When set, the confirm dialog shows an opt-in checkbox whose state is returned. */
  checkboxLabel?: string;
};

export type PromptDialogState = AppDialogCommon & {
  kind: "prompt";
  defaultValue?: string;
  placeholder?: string;
  /** Optional image shown above the input (e.g. a preview of the emoji being named). */
  previewImageUrl?: string;
};

export type ChoiceDialogState = AppDialogCommon & {
  kind: "choice";
  /** Buttons shown stacked; resolves the chosen key. The first is styled as the primary action. */
  choices: Array<{ key: string; label: string; tone?: AppDialogTone }>;
};

export type AppDialogState = AlertDialogState | ConfirmDialogState | PromptDialogState | ChoiceDialogState;

interface DialogStoreState {
  dialog: AppDialogState | null;
  openDialog: (dialog: AppDialogState) => void;
  closeDialog: () => void;
}

export const useDialogStore = create<DialogStoreState>((set) => ({
  dialog: null,
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
}));
