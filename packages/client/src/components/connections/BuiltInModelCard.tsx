import { useTranslation } from "react-i18next";
import { ChevronRight, Download } from "lucide-react";
import { useDeviceSetup, type DeviceItem } from "../../hooks/use-device-setup";
import { openAddConnection } from "../../lib/add-connection";
import { useSidecarStore } from "../../stores/sidecar.store";
import { ROW_BUTTON } from "./ConnectionRow";
import { ServiceRow } from "./ServiceRow";
import { cn } from "../../lib/utils";

const gb = (bytes: number) => (bytes / 1024 ** 3).toFixed(1);
const ACCOUNT = { name: "", provider: "local_model", baseUrl: null, icon: null, imagePath: null };

/** The built-in model's own card under Defaults: where it stands, and the one thing to do next. */
export function BuiltInModelCard({ onOpenDevice }: { onOpenDevice: (item: DeviceItem) => void }) {
  const { t } = useTranslation();
  const { "local-model": local } = useDeviceSetup();
  const status = useSidecarStore((s) => s.status);
  const progress = useSidecarStore((s) => s.downloadProgress);
  const modelSize = useSidecarStore((s) => s.modelSize);
  const config = useSidecarStore((s) => s.config);
  if (!local.available) return null;

  const downloading = status === "downloading_runtime" || status === "downloading_model";
  const percent = progress && progress.total > 0 ? Math.round((progress.downloaded / progress.total) * 100) : 0;
  const setUp = () => openAddConnection({ category: "device", item: "local-model" });
  const open = () => (local.setUp ? onOpenDevice("local-model") : setUp());
  const notDownloaded = !local.setUp && !downloading;
  const uses = [
    config.useAsMainDefault && t("connections.builtin.card.main"),
    config.useAsAgentsDefault && t("connections.builtin.card.agents"),
    config.useForTrackers && t("connections.builtin.card.trackers"),
  ]
    .filter(Boolean)
    .join(", ");

  const line = downloading ? (
    <span>{t("connections.builtin.card.downloading", { percent })}</span>
  ) : local.setUp ? (
    <span>
      {[t("connections.builtin.card.ready"), modelSize && `${gb(modelSize)} GB`, uses].filter(Boolean).join(" · ")}
    </span>
  ) : (
    <span className="text-[var(--warning)]">{t("connections.builtin.card.notDownloaded")}</span>
  );

  return (
    <div
      className="mari-connection-group flex min-w-0 flex-col"
      role="group"
      aria-label={t("connections.add.device.local_model")}
      data-connection-builtin-card
    >
      <ServiceRow
        account={{ ...ACCOUNT, name: t("connections.add.device.local_model") }}
        rows={[]}
        count={line}
        // One action per state: the Download button while nothing is on disk, otherwise the row itself.
        onClick={notDownloaded ? undefined : open}
        trailing={
          notDownloaded ? undefined : (
            <ChevronRight size="0.875rem" aria-hidden className="shrink-0 text-[var(--muted-foreground)]" />
          )
        }
        end={
          notDownloaded && (
            <button
              type="button"
              onClick={setUp}
              className={cn(ROW_BUTTON, "text-[var(--marinara-app-accent-static)]")}
              title={t("connections.builtin.card.download")}
              aria-label={t("connections.builtin.card.download")}
            >
              <Download size="1rem" aria-hidden />
            </button>
          )
        }
      />
    </div>
  );
}
