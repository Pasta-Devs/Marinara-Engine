import { toast } from "sonner";
import type { GenerationFallbackReason } from "@marinara-engine/shared";
import { i18n } from "../localization/i18n";
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
};

const CATEGORIES = new Set(["main", "agents", "illustrator", "video"]);
const REASONS = new Set<GenerationFallbackReason>(["off", "needs_key", "review", "deleted", "failed"]);

function readNoticeText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** "Fix" opens where the reason is fixed: the Connection (on/off, key, review), else the Model, else the panel. */
function openFix(reason: GenerationFallbackReason, accountId: string | null, connectionId: string | null): void {
  const ui = useUIStore.getState();
  if (reason !== "deleted" && reason !== "failed" && accountId) ui.openModal("connection-account", { accountId });
  else if (reason !== "deleted" && reason !== "failed" && connectionId) ui.openConnectionDetail(connectionId);
  else ui.openRightPanel("connections");
}

export function showGenerationFallbackToast(raw: unknown): void {
  const notice = raw && typeof raw === "object" ? (raw as GenerationFallbackNotice) : {};
  const t = i18n.t.bind(i18n);
  const connection =
    readNoticeText(notice.connectionName) ?? readNoticeText(notice.connectionId) ?? t("generation.fallback.fallback");
  const model = readNoticeText(notice.model);
  const category = t(
    `generation.fallback.category.${CATEGORIES.has(notice.category as string) ? notice.category : "main"}`,
  );
  // A notice without a reason is the retry after a failed request.
  const reason = REASONS.has(notice.reason as GenerationFallbackReason)
    ? (notice.reason as GenerationFallbackReason)
    : "failed";
  const unavailable = readNoticeText(notice.unavailableName) ?? t("generation.fallback.thisModel");
  toast.info(
    t(model ? "generation.fallback.titleWithModel" : "generation.fallback.title", { category, connection, model }),
    {
      description: t(`generation.fallback.reason.${reason}`, { model: unavailable }),
      duration: 10_000,
      action: {
        label: t("generation.fallback.fix"),
        onClick: () =>
          openFix(reason, readNoticeText(notice.unavailableAccountId), readNoticeText(notice.unavailableConnectionId)),
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
