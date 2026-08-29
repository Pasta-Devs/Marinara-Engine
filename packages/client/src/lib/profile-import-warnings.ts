export type ProfileImportWarning = {
  type?: string;
  path?: string;
  message?: string;
};

export type ProfileImportWarningCopy = {
  missingAssetSummary: (count: number) => string;
  skippedAssetSummary: (count: number) => string;
  securityWarningSummary: (count: number) => string;
  missingLabel: string;
  skippedLabel: string;
  additionalPaths: (count: number) => string;
  additionalMessages: (count: number) => string;
};

export function normalizeProfileImportWarnings(warnings: unknown): ProfileImportWarning[] {
  if (!Array.isArray(warnings)) return [];
  return warnings.flatMap((warning) => {
    if (!warning || typeof warning !== "object") return [];
    const record = warning as { type?: unknown; path?: unknown; message?: unknown };
    const path = typeof record.path === "string" ? record.path : undefined;
    const message = typeof record.message === "string" ? record.message : undefined;
    const type = typeof record.type === "string" ? record.type : undefined;
    if (!path && !message) return [];
    return [{ type, path, message }];
  });
}

export function formatProfileImportWarningSummary(warnings: ProfileImportWarning[], copy: ProfileImportWarningCopy) {
  const missingAssets = warnings.filter((warning) => warning.type === "missing_asset");
  const skippedAssets = warnings.filter((warning) => warning.type === "skipped_asset");
  const securityWarnings = warnings.filter(
    (warning) => warning.type !== "missing_asset" && warning.type !== "skipped_asset",
  );
  return [
    missingAssets.length > 0 ? copy.missingAssetSummary(missingAssets.length) : "",
    skippedAssets.length > 0 ? copy.skippedAssetSummary(skippedAssets.length) : "",
    securityWarnings.length > 0 ? copy.securityWarningSummary(securityWarnings.length) : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function formatProfileImportWarningDetails(warnings: ProfileImportWarning[], copy: ProfileImportWarningCopy) {
  const paths = warnings
    .filter((warning) => warning.type === "missing_asset")
    .map((warning) => warning.path)
    .filter((path): path is string => !!path);
  const messages = warnings
    .filter((warning) => warning.type !== "missing_asset" && warning.type !== "skipped_asset")
    .map((warning) => warning.message)
    .filter((message): message is string => !!message);
  const skippedMessages = warnings
    .filter((warning) => warning.type === "skipped_asset")
    .map((warning) => warning.message ?? warning.path)
    .filter((message): message is string => !!message);
  const missing =
    paths.length > 0
      ? `${copy.missingLabel}: ${paths.slice(0, 3).join(", ")}${paths.length > 3 ? copy.additionalPaths(paths.length - 3) : ""}`
      : "";
  const skipped =
    skippedMessages.length > 0
      ? `${copy.skippedLabel}: ${skippedMessages.slice(0, 3).join(" ")}${skippedMessages.length > 3 ? copy.additionalMessages(skippedMessages.length - 3) : ""}`
      : "";
  const security = `${messages.slice(0, 3).join(" ")}${messages.length > 3 ? copy.additionalMessages(messages.length - 3) : ""}`;
  return [missing, skipped, security].filter(Boolean).join("\n");
}
