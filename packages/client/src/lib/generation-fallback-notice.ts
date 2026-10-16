import { toast } from "sonner";
import type { GenerationFallbackUnavailableReason } from "@marinara-engine/shared";
import { translate } from "../localization/i18n";
import { useUIStore } from "../stores/ui.store";

export const GENERATION_FALLBACK_HEADER = "X-Marinara-Fallback-Used";

type GenerationFallbackNotice = {
  category?: unknown;
  connectionName?: unknown;
  connectionId?: unknown;
  model?: unknown;
  reason?: unknown;
  unavailableConnectionId?: unknown;
  unavailableName?: unknown;
  unavailableAccountId?: unknown;
  failed?: unknown;
};

type FailedConnection = {
  connectionId?: unknown;
  connectionName?: unknown;
  model?: unknown;
  reason?: unknown;
  status?: unknown;
};

const UNAVAILABLE_REASONS = new Set<GenerationFallbackUnavailableReason>(["off", "needs_key", "review", "deleted"]);

function readNoticeText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** "Fix" opens where the reason is fixed: the Connection (on/off, key, review), else the Model, else the panel. */
function openFix(
  reason: GenerationFallbackUnavailableReason | null,
  accountId: string | null,
  connectionId: string | null,
): void {
  const ui = useUIStore.getState();
  if (reason && reason !== "deleted" && accountId) ui.openModal("connection-account", { accountId });
  else if (reason && reason !== "deleted" && connectionId) ui.openConnectionDetail(connectionId);
  else ui.openRightPanel("connections");
}

function readNotice<T>(raw: unknown): T | null {
  return raw && typeof raw === "object" ? (raw as T) : null;
}

/** "Name (model)", the name alone, or the model alone when the connection has no name. */
function connectionLabel(connection: string | null, model: unknown): string | null {
  const modelText = readNoticeText(model);
  if (!connection) return modelText;
  return modelText ? `${connection} (${modelText})` : connection;
}

function fallbackLabel(notice: GenerationFallbackNotice): string {
  const connection =
    readNoticeText(notice.connectionName) ??
    readNoticeText(notice.connectionId) ??
    translate("generation.fallback.unnamed");
  return connectionLabel(connection, notice.model) ?? connection;
}

function categoryLabel(category: unknown): string {
  switch (category) {
    case "agents":
      return translate("generation.fallback.category.agents");
    case "illustrator":
      return translate("generation.fallback.category.illustrator");
    case "video":
      return translate("generation.fallback.category.video");
    default:
      return translate("generation.fallback.category.main");
  }
}

function reasonLabel(reason: unknown, status: unknown): string {
  switch (reason) {
    case "rate_limit":
      return translate("generation.fallback.reason.rateLimit");
    case "auth":
      return translate("generation.fallback.reason.auth");
    case "not_found":
      return translate("generation.fallback.reason.notFound");
    case "timeout":
      return translate("generation.fallback.reason.timeout");
    case "network":
      return translate("generation.fallback.reason.network");
    case "server":
      return translate("generation.fallback.reason.server");
    case "empty":
      return translate("generation.fallback.reason.empty");
    default:
      return typeof status === "number"
        ? translate("generation.fallback.reason.errorStatus", { status })
        : translate("generation.fallback.reason.error");
  }
}

/** The connection that failed and why, or null when the notice does not say which one failed. */
function failedParts(notice: GenerationFallbackNotice | null): { failed: string; reason: string } | null {
  const failed = readNotice<FailedConnection>(notice?.failed);
  if (!failed) return null;
  const failedLabel =
    connectionLabel(readNoticeText(failed.connectionName), failed.model) ?? readNoticeText(failed.connectionId);
  return failedLabel ? { failed: failedLabel, reason: reasonLabel(failed.reason, failed.status) } : null;
}

/**
 * Names the connection that failed and the fallback that wrote a saved reply (#7697), or null when
 * the notice does not say which connection failed.
 */
export function describeGenerationFallback(raw: unknown): string | null {
  const notice = readNotice<GenerationFallbackNotice>(raw);
  const parts = failedParts(notice);
  if (!notice || !parts) return null;
  return translate("generation.fallback.failedOver", { ...parts, fallback: fallbackLabel(notice) });
}

export function showGenerationFallbackToast(raw: unknown): void {
  const notice = readNotice<GenerationFallbackNotice>(raw) ?? {};
  // The toast comes before the fallback has answered, so it says only what failed; the title names the switch.
  const unavailable = UNAVAILABLE_REASONS.has(notice.reason as GenerationFallbackUnavailableReason)
    ? (notice.reason as GenerationFallbackUnavailableReason)
    : null;
  const parts = failedParts(notice);
  const description = unavailable
    ? translate(`generation.fallback.reason.${unavailable}`, {
        model: readNoticeText(notice.unavailableName) ?? translate("generation.fallback.thisModel"),
      })
    : parts
      ? translate("generation.fallback.failed", parts)
      : translate("generation.fallback.description");
  toast.info(
    translate("generation.fallback.switched", {
      category: categoryLabel(notice.category),
      connection: fallbackLabel(notice),
    }),
    {
      description,
      duration: 10_000,
      action: {
        label: translate("generation.fallback.fix"),
        onClick: () =>
          openFix(
            unavailable,
            readNoticeText(notice.unavailableAccountId),
            readNoticeText(notice.unavailableConnectionId),
          ),
      },
    },
  );
}

export function showGenerationFallbackHeader(response: Response): void {
  const encoded = response.headers.get(GENERATION_FALLBACK_HEADER);
  if (!encoded) return;
  try {
    showGenerationFallbackToast(JSON.parse(decodeURIComponent(encoded)));
  } catch {
    showGenerationFallbackToast({});
  }
}
