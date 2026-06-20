// ──────────────────────────────────────────────
// Conversation message reactions — add-reaction toolbar button.
// A hover-toolbar button that opens the emoji picker; picking an emoji toggles the
// user's reaction on the message. Standard emojis come from the picker; the global
// custom emojis are shown in a pick-only "Custom" grid. Conversation mode only.
// ──────────────────────────────────────────────
import { useRef, useState } from "react";
import { SmilePlus } from "lucide-react";
import { cn } from "../../lib/utils";
import { EmojiPicker } from "../ui/EmojiPicker";
import { useCustomEmojis } from "../../hooks/use-custom-emojis";

interface ReactionAddButtonProps {
  /** Called with the chosen emoji token (unicode or `:name:`) + its image url (custom only). */
  onPick: (emoji: string, imageUrl: string | null) => void;
  className?: string;
  /** Matches the action bar's tab discipline (-1 while the bar is hidden). */
  tabIndex?: number;
}

export function ReactionAddButton({ onPick, className, tabIndex }: ReactionAddButtonProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { data: customEmojis } = useCustomEmojis();

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        title="Add reaction"
        aria-label="Add reaction"
        tabIndex={tabIndex}
        className={cn(
          "flex items-center justify-center rounded p-1 text-foreground/70 transition-colors hover:bg-foreground/20 hover:text-foreground",
          className,
        )}
      >
        <SmilePlus size="0.75rem" />
      </button>
      <EmojiPicker
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(emoji) => {
          setOpen(false);
          onPick(emoji, null);
        }}
        anchorRef={buttonRef}
        customTab={{
          icon: "⭐",
          label: "Custom emojis",
          render: () => (
            <div className="grid grid-cols-6 gap-1">
              {(customEmojis ?? []).map((emoji) => (
                <button
                  key={emoji.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onPick(`:${emoji.name}:`, emoji.url);
                  }}
                  title={`:${emoji.name}:`}
                  className="flex aspect-square w-full items-center justify-center rounded-md p-1 transition-transform hover:scale-110 hover:bg-foreground/10 active:scale-100"
                >
                  <img src={emoji.url} alt={`:${emoji.name}:`} className="max-h-9 max-w-full object-contain" />
                </button>
              ))}
              {(customEmojis ?? []).length === 0 && (
                <p className="col-span-6 px-1 py-6 text-center text-[0.6875rem] text-foreground/45">
                  No custom emojis to react with yet.
                </p>
              )}
            </div>
          ),
        }}
      />
    </>
  );
}
