import { toast } from "sonner";
import { translate } from "../localization/i18n";
import { reloadBrowser } from "./browser-runtime";
import { useUIStore } from "../stores/ui.store";

const APP_UPDATE_TOAST_ID = "marinara-app-update";
let latestRefresh: (() => void | Promise<void>) | null = null;

export function showAppUpdatePrompt(refresh: () => void | Promise<void>) {
  latestRefresh = refresh;
  // The restart sheet reloads into whatever build the server serves; a down server also reads as "update ready".
  if (useUIStore.getState().modal?.type === "server-restart") return;
  toast.info(translate("ui.app.update.available"), {
    id: APP_UPDATE_TOAST_ID,
    description: translate("ui.app.update.description"),
    duration: Infinity,
    action: {
      label: translate("ui.app.update.refresh"),
      onClick: () => {
        void Promise.resolve()
          .then(() => latestRefresh?.())
          .catch(() => reloadBrowser("update-fallback"));
      },
    },
  });
}

export function dismissAppUpdatePrompt() {
  toast.dismiss(APP_UPDATE_TOAST_ID);
}
