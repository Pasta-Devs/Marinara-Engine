import { toast } from "sonner";
import { translate } from "../localization/i18n";
import { reloadBrowser } from "./browser-runtime";

const APP_UPDATE_TOAST_ID = "marinara-app-update";
let latestRefresh: (() => void | Promise<void>) | null = null;

export function showAppUpdatePrompt(refresh: () => void | Promise<void>) {
  latestRefresh = refresh;
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
