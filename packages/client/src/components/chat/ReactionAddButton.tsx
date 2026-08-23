// ──────────────────────────────────────────────
// Conversation message reactions — add-reaction toolbar button.
// A hover-toolbar button that opens the emoji picker; picking an emoji toggles the
// user's reaction on the message. Standard emojis come from the picker; the global
// custom emojis are shown in a pick-only "Custom" grid. Conversation mode only.
// ──────────────────────────────────────────────
import { useRef, useState, type RefObject } from "react";
import { SmilePlus } from "lucide-react";
import { filterCustomEmojisByName } from "../../lib/custom-emoji";
import { EmojiPicker } from "../ui/EmojiPicker";
import { useCustomEmojis } from "../../hooks/use-custom-emojis";
import { useTranslation as useUiTranslation } from "react-i18next";
import { MESSAGE_ACTION_ICON_SIZE, MessageActionButton } from "./MessageActionButton";

interface ReactionAddButtonProps {
  /** Called with the chosen emoji token (unicode or `:name:`) + its image url (custom only). */
  onPick: (emoji: string, imageUrl: string | null) => void;
  className?: string;
  /** Matches the action bar's tab discipline (-1 while the bar is hidden). */
  tabIndex?: number;
}

export function ReactionAddButton({ onPick, className, tabIndex }: ReactionAddButtonProps) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <MessageActionButton
        buttonRef={buttonRef}
        icon={<SmilePlus size={MESSAGE_ACTION_ICON_SIZE} />}
        onClick={() => setOpen((value) => !value)}
        title={localizeUi("ui.chat.reactionaddbutton.addReaction")}
        tabIndex={tabIndex}
        className={className}
        stopPropagation
      />
      {/* Mounted only while open: this button renders once per speaker segment
          across the whole transcript, so a closed instance must cost nothing —
          no picker subtree and no custom-emoji query subscription. */}
      {open && (
        <ReactionPickerPanel
          anchorRef={buttonRef}
          onClose={() => setOpen(false)}
          onPick={(emoji, imageUrl) => {
            setOpen(false);
            onPick(emoji, imageUrl);
          }}
        />
      )}
    </>
  );
}

function ReactionPickerPanel({
  anchorRef,
  onClose,
  onPick,
}: {
  anchorRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onPick: (emoji: string, imageUrl: string | null) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { data: customEmojis } = useCustomEmojis();
  const renderCustomEmojis = (query: string, searchResultsOnly = false) => {
    const filtered = filterCustomEmojisByName(customEmojis ?? [], query);
    if (searchResultsOnly && filtered.length === 0) return null;
    return (
      <div>
        {searchResultsOnly && (
          <p className="mb-1 px-1 text-[0.625rem] font-semibold uppercase tracking-wide text-foreground/40">
            {localizeUi("settings.notifications.customSound.status.custom")}
          </p>
        )}
        <div className="grid grid-cols-6 gap-1">
          {filtered.map((emoji) => (
            <button
              key={emoji.id}
              type="button"
              onClick={() => onPick(`:${emoji.name}:`, emoji.url)}
              title={localizeUi("ui.chat.conversationinput.value1", { value1: emoji.name })}
              className="flex aspect-square w-full items-center justify-center rounded-md p-1 transition-transform hover:scale-110 hover:bg-foreground/10 active:scale-100"
            >
              <img
                src={emoji.url}
                alt={localizeUi("ui.chat.conversationinput.value1", { value1: emoji.name })}
                className="max-h-9 max-w-full object-contain"
              />
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-6 px-1 py-6 text-center text-[0.6875rem] text-foreground/45">
              {localizeUi("ui.chat.reactionpickerpanel.noCustomEmojisToReactWithYet")}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <EmojiPicker
      open
      onClose={onClose}
      onSelect={(emoji) => onPick(emoji, null)}
      anchorRef={anchorRef}
      customTab={{
        icon: "⭐",
        label: "Custom emojis",
        render: (query) => renderCustomEmojis(query),
        renderSearch: (query) => renderCustomEmojis(query, true),
      }}
    />
  );
}
