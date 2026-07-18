import { toast } from "sonner";

export const GENERATION_FALLBACK_HEADER = "X-Marinara-Fallback-Used";

type GenerationFallbackNotice = {
  category?: unknown;
  connectionName?: unknown;
  connectionId?: unknown;
  model?: unknown;
};

function readNoticeText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function categoryLabel(category: unknown): string {
  switch (category) {
    case "agents":
      return "Agents";
    case "illustrator":
      return "Illustrator";
    case "video":
      return "Videos";
    default:
      return "Main";
  }
}

export function showGenerationFallbackToast(raw: unknown): void {
  const notice = raw && typeof raw === "object" ? (raw as GenerationFallbackNotice) : {};
  const connection = readNoticeText(notice.connectionName) ?? readNoticeText(notice.connectionId) ?? "fallback";
  const model = readNoticeText(notice.model);
  toast.info(`${categoryLabel(notice.category)} switched to ${connection}${model ? ` (${model})` : ""}.`, {
    description: "The primary generation failed, so Guksu retried with your configured fallback.",
    duration: 10_000,
  });
}

export function showGenerationFallbackHeader(response: Response): void {
  const encoded = response.headers.get(GENERATION_FALLBACK_HEADER);
  if (!encoded) return;
  try {
    showGenerationFallbackToast(JSON.parse(decodeURIComponent(encoded)));
  } catch {
    showGenerationFallbackToast({ connectionName: "fallback" });
  }
}
