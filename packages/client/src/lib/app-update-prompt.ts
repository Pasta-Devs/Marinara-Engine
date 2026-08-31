import { toast } from "sonner";
import { translate } from "../localization/i18n";

const APP_UPDATE_TOAST_ID = "marinara-app-update";

export function showAppUpdatePrompt(refresh: () => void | Promise<void>) {
  toast.info(translate("ui.app.update.available"), {
    id: APP_UPDATE_TOAST_ID,
    description: translate("ui.app.update.description"),
    duration: Infinity,
    action: {
      label: translate("ui.app.update.refresh"),
      onClick: () => void refresh(),
    },
  });
}
