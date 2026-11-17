// ──────────────────────────────────────────────
// PoolDescriptionButton — in the emoji and sticker pickers' edit mode, a small
// corner button that writes or changes one custom emoji's or sticker's description.
// ──────────────────────────────────────────────
import { ScanText } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import { normalizeGalleryDescription } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { showPromptDialog } from "../../lib/app-dialogs";
import { saveGalleryDescription } from "../../lib/gallery-descriptions";

export function PoolDescriptionButton({
  kind,
  item,
}: {
  kind: "emoji" | "sticker";
  item: { id: string; name: string; url: string; description?: string | null };
}) {
  const { t: localizeUi } = useUiTranslation();
  const queryClient = useQueryClient();

  const edit = async () => {
    const input = await showPromptDialog({
      title: localizeUi("ui.ui.customemojitagbutton.descriptionTitle"),
      message: localizeUi("ui.ui.customemojitagbutton.descriptionPrompt"),
      defaultValue: item.description ?? "",
      placeholder: localizeUi("ui.ui.customemojitagbutton.descriptionPlaceholder"),
      previewImageUrl: item.url,
    });
    if (input === null) return;
    try {
      await saveGalleryDescription({ scope: kind }, item.id, normalizeGalleryDescription(input));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      await queryClient.invalidateQueries({ queryKey: [kind === "emoji" ? "custom-emojis" : "custom-stickers"] });
    }
  };

  return (
    <button
      type="button"
      onClick={() => void edit()}
      title={item.description || localizeUi("ui.ui.customemojitagbutton.addDescription")}
      aria-label={
        item.description
          ? localizeUi("ui.ui.customemojitagbutton.editDescription")
          : localizeUi("ui.ui.customemojitagbutton.addDescription")
      }
      className={cn(
        "absolute -bottom-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full shadow ring-1 ring-black/10 transition-transform hover:scale-110",
        item.description
          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
          : "bg-foreground/70 text-[var(--background)]",
      )}
    >
      <ScanText size="0.625rem" />
    </button>
  );
}
