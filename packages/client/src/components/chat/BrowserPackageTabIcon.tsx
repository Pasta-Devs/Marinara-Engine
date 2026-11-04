import { Bot } from "lucide-react";
import { cn } from "../../lib/utils";

/** URL of one asset inside an installed capability package. */
export function capabilityPackageAssetUrl(packageId: string, version: string, assetPath: string): string {
  const encodedPath = assetPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/capability-packages/${encodeURIComponent(packageId)}/assets/${encodedPath}?v=${encodeURIComponent(version)}`;
}

export function BrowserPackageTabIcon({
  packageId,
  version,
  iconPaths,
}: {
  packageId: string;
  version: string;
  iconPaths: readonly string[] | undefined;
}) {
  if (!iconPaths?.length) return <Bot size="0.8rem" className="mari-chrome-accent-icon mari-accent-animated" />;
  if (iconPaths.length === 1) {
    return (
      <img
        src={capabilityPackageAssetUrl(packageId, version, iconPaths[0]!)}
        alt=""
        draggable={false}
        className="h-4 w-5 shrink-0 object-contain"
      />
    );
  }
  return (
    <span aria-hidden="true" className="relative h-4 w-5 shrink-0">
      {iconPaths.slice(0, 2).map((iconPath, index) => (
        <img
          key={iconPath}
          src={capabilityPackageAssetUrl(packageId, version, iconPath)}
          alt=""
          draggable={false}
          className={cn(
            "absolute h-2.5 w-4 object-contain drop-shadow-[0_1px_1px_oklch(0_0_0/0.18)]",
            index === 0 ? "left-0 top-0" : "bottom-0 right-0",
          )}
        />
      ))}
    </span>
  );
}
