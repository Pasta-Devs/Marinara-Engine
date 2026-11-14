// ──────────────────────────────────────────────
// CustomEmojiTagButton — per-image overlay to tag a gallery image
// as a custom emoji or sticker, or (character, persona and chat galleries)
// as a chat background with the places it shows. Shared across the galleries.
// ──────────────────────────────────────────────
import { useRef, useState } from "react";
import { Tag, Smile, Sticker, Pencil, X, ImageIcon, MapPin } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { showPromptDialog } from "../../lib/app-dialogs";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import {
  slugifyCustomName,
  validateDimensionsForKind,
  readImageDimensions,
  type CustomKind,
  type CustomTagPatch,
} from "../../lib/custom-emoji";
import { useTranslation as useUiTranslation } from "react-i18next";
import { normalizeGalleryBackgroundPlaces, type GalleryTagKind } from "@marinara-engine/shared";

export interface TaggableImage {
  id: string;
  url: string;
  customKind?: GalleryTagKind | null;
  customName?: string | null;
}

export function CustomEmojiTagButton({
  image,
  onApply,
  allowBackground = false,
  allowEmoji = true,
}: {
  image: TaggableImage;
  onApply: (patch: CustomTagPatch) => void;
  /** Offer "Use as background" (character, persona and chat galleries). */
  allowBackground?: boolean;
  /** Offer emoji/sticker (not in the chat gallery, whose pictures are too big for them). */
  allowEmoji?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const namePromptMessage = localizeUi("ui.ui.customemojitagbutton.namePrompt");
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tagged = !!image.customKind;

  function triggerFlash(message: string) {
    toast.error(message);
    setFlashing(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashing(false), 1300);
  }

  // Measure + validate against the kind's limit, prompt for a name if new, then apply.
  async function applyKind(kind: CustomKind, keepName?: string | null) {
    setBusy(true);
    try {
      const { width, height } = await readImageDimensions(image.url);
      const check = validateDimensionsForKind(width, height, kind);
      if (!check.ok) {
        triggerFlash(check.reason);
        return;
      }
      let name = keepName ?? "";
      if (!keepName) {
        const input = await showPromptDialog({
          title:
            kind === "emoji"
              ? localizeUi("ui.ui.customemojitagbutton.customEmoji")
              : localizeUi("ui.ui.customemojitagbutton.customSticker"),
          message: namePromptMessage,
          defaultValue: image.customName ?? "",
          placeholder: localizeUi("ui.ui.customemojitagbutton.namePlaceholder"),
        });
        if (input === null) return; // cancelled
        name = input;
      }
      const slug = slugifyCustomName(name);
      if (!slug) {
        toast.error(localizeUi("ui.ui.customemojitagbutton.enterANameUsingLettersOrNumbers"));
        return;
      }
      onApply({ customKind: kind, customName: slug, width, height });
    } catch {
      triggerFlash(localizeUi("ui.ui.customemojitagbutton.couldNotMeasure"));
    } finally {
      setBusy(false);
    }
  }

  async function rename() {
    const input = await showPromptDialog({
      title: localizeUi("ui.chat.chatbranchselector.rename"),
      message: namePromptMessage,
      defaultValue: image.customName ?? "",
      placeholder: localizeUi("ui.ui.customemojitagbutton.namePlaceholder"),
    });
    if (input === null) return;
    const slug = slugifyCustomName(input);
    if (!slug) {
      toast.error(localizeUi("ui.ui.customemojitagbutton.enterANameUsingLettersOrNumbers"));
      return;
    }
    onApply({ customKind: image.customKind ?? "emoji", customName: slug });
  }

  // A background's name is the places it shows ("John's bedroom, John's room"); it may stay empty.
  async function editBackgroundPlaces() {
    const input = await showPromptDialog({
      title: localizeUi("ui.ui.customemojitagbutton.backgroundTitle"),
      message: localizeUi("ui.ui.customemojitagbutton.backgroundPlacesPrompt"),
      defaultValue: image.customKind === "background" ? (image.customName ?? "") : "",
      placeholder: localizeUi("ui.ui.customemojitagbutton.backgroundPlacesPlaceholder"),
    });
    if (input === null) return;
    onApply({ customKind: "background", customName: normalizeGalleryBackgroundPlaces(input) || null });
  }

  const backgroundItem: ContextMenuItem = {
    label: localizeUi("ui.ui.customemojitagbutton.useAsBackground"),
    icon: <ImageIcon size="0.75rem" />,
    onSelect: () => void editBackgroundPlaces(),
  };

  const items: ContextMenuItem[] =
    image.customKind === "background"
      ? [
          {
            label: localizeUi("ui.ui.customemojitagbutton.editBackgroundPlaces"),
            icon: <MapPin size="0.75rem" />,
            onSelect: () => void editBackgroundPlaces(),
          },
          {
            label: localizeUi("ui.ui.customemojitagbutton.removeBackground"),
            icon: <X size="0.75rem" />,
            onSelect: () => onApply({ customKind: null, customName: null }),
            destructive: true,
          },
        ]
      : tagged
        ? [
            {
              label: localizeUi("ui.chat.chatbranchselector.rename"),
              icon: <Pencil size="0.75rem" />,
              onSelect: () => void rename(),
            },
            image.customKind === "emoji"
              ? {
                  label: localizeUi("ui.ui.customemojitagbutton.switchToSticker"),
                  icon: <Sticker size="0.75rem" />,
                  onSelect: () => void applyKind("sticker", image.customName),
                }
              : {
                  label: localizeUi("ui.ui.customemojitagbutton.switchToEmoji"),
                  icon: <Smile size="0.75rem" />,
                  onSelect: () => void applyKind("emoji", image.customName),
                },
            {
              label:
                image.customKind === "emoji"
                  ? localizeUi("ui.ui.customemojitagbutton.removeEmoji")
                  : localizeUi("ui.ui.customemojitagbutton.removeSticker"),
              icon: <X size="0.75rem" />,
              onSelect: () => onApply({ customKind: null, customName: null }),
              destructive: true,
            },
          ]
        : [
            ...(allowEmoji
              ? [
                  {
                    label: localizeUi("ui.ui.customemojitagbutton.makeEmoji"),
                    icon: <Smile size="0.75rem" />,
                    onSelect: () => void applyKind("emoji"),
                  },
                  {
                    label: localizeUi("ui.ui.customemojitagbutton.makeSticker"),
                    icon: <Sticker size="0.75rem" />,
                    onSelect: () => void applyKind("sticker"),
                  },
                ]
              : []),
            ...(allowBackground ? [backgroundItem] : []),
          ];

  return (
    <>
      {flashing && (
        <div className="pointer-events-none absolute inset-0 z-20 animate-pulse rounded-xl bg-red-500/20 ring-2 ring-red-500" />
      )}
      <button
        type="button"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          setMenu({ x: rect.left, y: rect.bottom + 4 });
        }}
        title={
          image.customKind === "background"
            ? image.customName
              ? localizeUi("ui.ui.customemojitagbutton.backgroundFor", { places: image.customName })
              : localizeUi("ui.ui.customemojitagbutton.backgroundTitle")
            : tagged
              ? localizeUi("ui.ui.customemojitagbutton.value1Value2", {
                  value1: image.customKind,
                  value2: image.customName,
                })
              : allowEmoji
                ? localizeUi("ui.ui.customemojitagbutton.tagAsEmojiOrSticker")
                : localizeUi("ui.ui.customemojitagbutton.useAsBackground")
        }
        className={cn(
          "absolute left-1 top-1 z-10 flex max-w-[calc(100%-0.5rem)] items-center gap-1 rounded-lg px-1.5 py-1 text-white transition-opacity",
          tagged
            ? "bg-[var(--primary)]/80 opacity-100"
            : "bg-black/50 opacity-0 group-hover:opacity-100 max-md:opacity-100",
        )}
      >
        {tagged ? (
          <>
            {image.customKind === "emoji" ? (
              <Smile size="0.75rem" />
            ) : image.customKind === "background" ? (
              <ImageIcon size="0.75rem" />
            ) : (
              <Sticker size="0.75rem" />
            )}
            <span className="truncate text-[0.625rem] font-medium">
              {image.customKind === "background"
                ? image.customName || localizeUi("ui.ui.customemojitagbutton.backgroundTitle")
                : image.customName}
            </span>
          </>
        ) : (
          <Tag size="0.75rem" />
        )}
      </button>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={items} onClose={() => setMenu(null)} />}
    </>
  );
}
