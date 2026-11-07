// ──────────────────────────────────────────────
// Settings > Appearance: "Look on this device"
// Lets one device keep its own theme, Visual Style, colours, font and CSS theme
// instead of the look shared by every device (see stores/device-look.store).
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUIStore } from "../../stores/ui.store";
import {
  DEVICE_LOOK_KEYS,
  SETTINGS_PUSH_NOW_EVENT,
  pickLook,
  useDeviceLookStore,
} from "../../stores/device-look.store";
import { api } from "../../lib/api-client";
import { themeKeys } from "../../hooks/use-themes";
import { HelpTooltip } from "../ui/HelpTooltip";

export function DeviceLookSetting({ anchorId }: { anchorId?: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const enabled = useDeviceLookStore((s) => s.enabled);

  const choose = (own: boolean) => {
    const store = useDeviceLookStore.getState();
    if (own === store.enabled) return;
    if (own) {
      // Everything currently on screen is the shared look; from now on changes here stay here.
      store.setEnabled(true, pickLook(useUIStore.getState() as unknown as Record<string, unknown>));
      return;
    }
    // Back to the shared look: take it over again and follow the server's CSS theme.
    const shared = store.sharedLook;
    store.setEnabled(false);
    const restore: Record<string, unknown> = {};
    for (const key of DEVICE_LOOK_KEYS) if (key in shared) restore[key] = shared[key];
    useUIStore.setState(restore);
    void queryClient.invalidateQueries({ queryKey: themeKeys.all });
  };

  /** Make this device's look the shared one, then stop keeping it separate. */
  const applyEverywhere = async () => {
    const store = useDeviceLookStore.getState();
    const themeId = store.customThemeId;
    store.setEnabled(false);
    if (themeId !== undefined) {
      try {
        await api.put("/themes/active", { id: themeId });
      } catch {
        // The look still syncs; only the CSS theme stays as it was elsewhere.
      }
    }
    void queryClient.invalidateQueries({ queryKey: themeKeys.all });
    window.dispatchEvent(new Event(SETTINGS_PUSH_NOW_EVENT));
    toast.success(t("settings.deviceLook.appliedEverywhere"));
  };

  return (
    <div id={anchorId} className="flex scroll-mt-3 flex-col gap-1" data-component="DeviceLookSetting">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium inline-flex items-center gap-1">
          {t("settings.deviceLook.label")} <HelpTooltip text={t("settings.deviceLook.help")} />
        </span>
        <select
          value={enabled ? "device" : "shared"}
          onChange={(e) => choose(e.target.value === "device")}
          className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]"
        >
          <option value="shared">{t("settings.deviceLook.shared")}</option>
          <option value="device">{t("settings.deviceLook.device")}</option>
        </select>
      </label>
      {enabled ? (
        <button
          type="button"
          onClick={() => void applyEverywhere()}
          className="self-start text-[0.6875rem] text-[var(--primary)] underline-offset-2 hover:underline"
        >
          {t("settings.deviceLook.applyEverywhere")}
        </button>
      ) : null}
    </div>
  );
}
