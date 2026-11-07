// ──────────────────────────────────────────────
// UI overhaul: the character page's Chat button
//
// It used to start a new Roleplay on every press and stay on the card, so
// each tap left another chat behind. Now it opens this character's recent
// chats, with "New chat…" (the mode picker) underneath; with no chats yet it
// goes straight to the mode picker. Either way you land in the chat.
// ──────────────────────────────────────────────
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Gamepad2, MessageCircle, Plus } from "lucide-react";
import { useChats } from "../../hooks/use-chats";
import { isUnfinishedSetup } from "../../hooks/use-setup-drafts";
import { getChatDisplayName } from "../../lib/chat-display";
import { useChatStore } from "../../stores/chat.store";
import { useOverhaulStore, isOverhaulMobile } from "../../stores/overhaul.store";
import { useUIStore } from "../../stores/ui.store";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { RailMoreMenu } from "./EditorRail";
import { useTranslation as useUiTranslation } from "react-i18next";

const RECENT_LIMIT = 5;

export function CharacterChatButton({ characterId, characterName }: { characterId: string; characterName: string }) {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  const [open, setOpen] = useState(false);
  const { data: chats } = useChats({ refetchOnMount: false });
  const recent = useMemo(
    () =>
      (chats ?? [])
        .filter((chat) => chat.characterIds.includes(characterId) && !isUnfinishedSetup(chat))
        .sort((a, b) => (b.lastMessageAt ?? b.updatedAt ?? "").localeCompare(a.lastMessageAt ?? a.updatedAt ?? ""))
        .slice(0, RECENT_LIMIT),
    [chats, characterId],
  );

  const newChat = () => useUIStore.getState().openModal("start-character-chat", { characterId, characterName });
  const openChat = (chatId: string) => {
    const ui = useUIStore.getState();
    ui.closeAllDetails();
    const overhaul = useOverhaulStore.getState();
    overhaul.leaveDocs();
    overhaul.setLibraryPage(null);
    useChatStore.getState().setActiveChatId(chatId);
    if (isOverhaulMobile()) ui.closeRightPanel();
  };

  // The menu hangs under the button, right-aligned, and flips above it when there's no room below
  // (user panel 2, N5: it opened 600px away on desktop and below the screen on a tablet held upright).
  const wrapRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const menu = wrapRef.current?.querySelector<HTMLElement>(".ov-rail__chats");
    if (!menu) return;
    menu.style.top = "";
    menu.style.bottom = "";
    menu.style.left = "";
    menu.style.right = "0";
    const rect = menu.getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 8) {
      menu.style.top = "auto";
      menu.style.bottom = "calc(100% + 0.25rem)";
    }
    if (rect.left < 8) {
      menu.style.right = "auto";
      menu.style.left = "0";
    }
  }, [open]);

  return (
    <span ref={wrapRef} className="ov-chatbtn-wrap">
      <button
        type="button"
        className="ov-btn ov-btn--accent"
        data-ov-chat-trigger=""
        aria-haspopup={recent.length ? "menu" : "dialog"}
        aria-expanded={recent.length ? open : undefined}
        onClick={() => (recent.length ? setOpen((value) => !value) : newChat())}
      >
        <MessageCircle size="0.875rem" />
        {localize("Chat")}
      </button>
      <RailMoreMenu
        open={open}
        onClose={() => setOpen(false)}
        label={localizeUi("ui.overhaul.characterChatButton.continueChat")}
        className="ov-rail__chats"
        trigger="[data-ov-chat-trigger]"
      >
        {recent.map((chat) => {
          const name = getChatDisplayName(chat);
          // Each chat shows its mode, so a game doesn't look like a roleplay.
          const ModeIcon = chat.mode === "game" ? Gamepad2 : chat.mode === "conversation" ? MessageCircle : BookOpen;
          const modeLabel = localize(
            chat.mode === "game" ? "Game" : chat.mode === "conversation" ? "Conversation" : "Roleplay",
          );
          return (
            <button
              key={chat.id}
              type="button"
              role="menuitem"
              title={name}
              aria-label={name}
              aria-description={modeLabel}
              onClick={() => openChat(chat.id)}
            >
              <ModeIcon size="1rem" />
            </button>
          );
        })}
        <button type="button" role="menuitem" title={localize("New chat…")} onClick={newChat}>
          <Plus size="1rem" />
        </button>
      </RailMoreMenu>
    </span>
  );
}
