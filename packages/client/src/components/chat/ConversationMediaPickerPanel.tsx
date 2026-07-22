import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { EmojiPicker } from "../ui/EmojiPicker";
import { GifPicker } from "../ui/GifPicker";
import { StickerPicker } from "./StickerPicker";
import { CustomEmojiTab } from "./CustomEmojiTab";

export type ConversationMediaPickerTabId = "emoji" | "gifs" | "stickers" | "tools";
export type ConversationMediaPickerTab = { id: ConversationMediaPickerTabId; label: string };

interface ConversationMediaPickerPanelProps {
  tabs: ConversationMediaPickerTab[];
  activeTab: ConversationMediaPickerTabId;
  onActiveTabChange: (tab: ConversationMediaPickerTabId) => void;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  onGifSelect: (gifUrl: string) => void;
  onStickerSelect: (name: string) => void;
  toolsContent?: ReactNode;
  className?: string;
}

export function ConversationMediaPickerPanel({
  tabs,
  activeTab,
  onActiveTabChange,
  onClose,
  onEmojiSelect,
  onGifSelect,
  onStickerSelect,
  toolsContent,
  className,
}: ConversationMediaPickerPanelProps) {
  return (
    <div
      className={cn(
        "flex h-[22rem] max-h-[60vh] flex-col overflow-hidden rounded-xl border border-foreground/10 bg-[var(--card)] shadow-xl",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-foreground/10 px-2 py-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onActiveTabChange(tab.id)}
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              activeTab === tab.id
                ? "bg-foreground/10 text-foreground/80 ring-1 ring-foreground/15"
                : "text-foreground/45 hover:bg-foreground/10 hover:text-foreground/70",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {activeTab === "emoji" && (
          <EmojiPicker
            embedded
            open
            onClose={onClose}
            onSelect={onEmojiSelect}
            customTab={{
              icon: "⭐",
              label: "Custom emojis",
              render: (query) => <CustomEmojiTab onInsert={onEmojiSelect} query={query} />,
              renderSearch: (query) => (
                <CustomEmojiTab onInsert={onEmojiSelect} query={query} searchResultsOnly />
              ),
            }}
          />
        )}
        {activeTab === "gifs" && <GifPicker embedded open onClose={onClose} onSelect={onGifSelect} />}
        {activeTab === "stickers" && <StickerPicker embedded open onClose={onClose} onSelect={onStickerSelect} />}
        {activeTab === "tools" && toolsContent}
      </div>
    </div>
  );
}
