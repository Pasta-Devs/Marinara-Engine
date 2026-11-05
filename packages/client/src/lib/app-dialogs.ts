import {
  useDialogStore,
  type AlertDialogState,
  type AppDialogState,
  type ConfirmDialogState,
  type PromptDialogState,
  type ChoiceDialogState,
} from "../stores/dialog.store";

type ActiveDialogResolver = {
  kind: AppDialogState["kind"];
  resolve: (value: boolean | string | null | void) => void;
};

let activeResolver: ActiveDialogResolver | null = null;

function resolveFallback(kind: AppDialogState["kind"]) {
  if (kind === "confirm") return false;
  if (kind === "prompt") return null;
  if (kind === "choice") return null;
  return undefined;
}

function openDialog<T extends boolean | string | null | void>(dialog: AppDialogState): Promise<T> {
  if (activeResolver) {
    activeResolver.resolve(resolveFallback(activeResolver.kind));
    activeResolver = null;
  }

  useDialogStore.getState().openDialog(dialog);

  return new Promise<T>((resolve) => {
    activeResolver = {
      kind: dialog.kind,
      resolve: resolve as (value: boolean | string | null | void) => void,
    };
  });
}

export function resolveActiveDialog(value: boolean | string | null | void) {
  const resolver = activeResolver;
  activeResolver = null;
  useDialogStore.getState().closeDialog();
  resolver?.resolve(value);
}

export function dismissActiveDialog() {
  const dialog = useDialogStore.getState().dialog;
  if (!dialog) return;
  resolveActiveDialog(resolveFallback(dialog.kind));
}

export function showAlertDialog(options: Omit<AlertDialogState, "kind">): Promise<void> {
  return openDialog<void>({
    kind: "alert",
    confirmLabel: "OK",
    ...options,
  });
}

export function showConfirmDialog(options: Omit<ConfirmDialogState, "kind">): Promise<boolean> {
  return openDialog<boolean>({
    kind: "confirm",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    ...options,
  });
}

export function confirmNonEmptyFolderDelete(
  itemCount: number,
  options: Omit<ConfirmDialogState, "kind">,
): Promise<boolean> {
  // Every folder deletion asks first, even an empty one (a stray tap on Delete is easy on phones).
  // An empty folder keeps only the "Delete "name"?" question, not the line about moving items.
  if (itemCount <= 0 && typeof options.message === "string") {
    const question = options.message.match(/^(.*[”"]\?)\s/)?.[1];
    return showConfirmDialog(question ? { ...options, message: question } : options);
  }
  return showConfirmDialog(options);
}

export function showPromptDialog(options: Omit<PromptDialogState, "kind">): Promise<string | null> {
  return openDialog<string | null>({
    kind: "prompt",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    ...options,
  });
}

/** A stacked-button choice dialog. Resolves the chosen `key`, or null if dismissed. */
export function showChoiceDialog(options: Omit<ChoiceDialogState, "kind">): Promise<string | null> {
  return openDialog<string | null>({
    kind: "choice",
    cancelLabel: "Cancel",
    ...options,
  });
}
