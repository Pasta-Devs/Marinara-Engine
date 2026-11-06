/** URL of a file inside an installed capability package, versioned so caches refresh on update. */
export function capabilityPackageAssetUrl(packageId: string, version: string, assetPath: string): string {
  const encodedPath = assetPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/capability-packages/${encodeURIComponent(packageId)}/assets/${encodedPath}?v=${encodeURIComponent(version)}`;
}
