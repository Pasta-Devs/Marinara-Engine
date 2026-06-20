// ──────────────────────────────────────────────
// CustomEmojiTagButton — per-image overlay to tag a gallery image
// as a custom emoji or sticker. Shared across all three galleries.
// ──────────────────────────────────────────────
import { useRef, useState } from "react";
import { Tag, Smile, Sticker, Pencil, X } from "lucide-react";
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

export interface TaggableImage {
  id: string;
  url: string;
  customKind?: CustomKind | null;
  customName?: string | null;
}

const NAME_PROMPT_MESSAGE = "Name it. In prompts it appears as :name: (emoji) or sticker:name: (sticker).";

export function CustomEmojiTagButton({
  image,
  onApply,
}: {
  image: TaggableImage;
  onApply: (patch: CustomTagPatch) => void;
}) {
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
          title: kind === "emoji" ? "Custom Emoji" : "Custom Sticker",
          message: NAME_PROMPT_MESSAGE,
          defaultValue: image.customName ?? "",
          placeholder: "e.g. kekw",
        });
        if (input === null) return; // cancelled
        name = input;
      }
      const slug = slugifyCustomName(name);
      if (!slug) {
        toast.error("Enter a name using letters or numbers.");
        return;
      }
      onApply({ customKind: kind, customName: slug, width, height });
    } catch {
      triggerFlash("Could not read this image to measure it.");
    } finally {
      setBusy(false);
    }
  }

  async function rename() {
    const input = await showPromptDialog({
      title: "Rename",
      message: NAME_PROMPT_MESSAGE,
      defaultValue: image.customName ?? "",
      placeholder: "e.g. kekw",
    });
    if (input === null) return;
    const slug = slugifyCustomName(input);
    if (!slug) {
      toast.error("Enter a name using letters or numbers.");
      return;
    }
    onApply({ customKind: image.customKind ?? "emoji", customName: slug });
  }

  const items: ContextMenuItem[] = tagged
    ? [
        { label: "Rename", icon: <Pencil size="0.75rem" />, onSelect: () => void rename() },
        image.customKind === "emoji"
          ? {
              label: "Switch to sticker",
              icon: <Sticker size="0.75rem" />,
              onSelect: () => void applyKind("sticker", image.customName),
            }
          : {
              label: "Switch to emoji",
              icon: <Smile size="0.75rem" />,
              onSelect: () => void applyKind("emoji", image.customName),
            },
        {
          label: image.customKind === "emoji" ? "Remove emoji" : "Remove sticker",
          icon: <X size="0.75rem" />,
          onSelect: () => onApply({ customKind: null, customName: null }),
          destructive: true,
        },
      ]
    : [
        { label: "Make emoji", icon: <Smile size="0.75rem" />, onSelect: () => void applyKind("emoji") },
        { label: "Make sticker", icon: <Sticker size="0.75rem" />, onSelect: () => void applyKind("sticker") },
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
        title={tagged ? `${image.customKind}: ${image.customName}` : "Tag as emoji or sticker"}
        className={cn(
          "absolute left-1 top-1 z-10 flex max-w-[calc(100%-0.5rem)] items-center gap-1 rounded-lg px-1.5 py-1 text-white transition-opacity",
          tagged
            ? "bg-[var(--primary)]/80 opacity-100"
            : "bg-black/50 opacity-0 group-hover:opacity-100 max-md:opacity-100",
        )}
      >
        {tagged ? (
          <>
            {image.customKind === "emoji" ? <Smile size="0.75rem" /> : <Sticker size="0.75rem" />}
            <span className="truncate text-[0.625rem] font-medium">{image.customName}</span>
          </>
        ) : (
          <Tag size="0.75rem" />
        )}
      </button>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={items} onClose={() => setMenu(null)} />}
    </>
  );
}
