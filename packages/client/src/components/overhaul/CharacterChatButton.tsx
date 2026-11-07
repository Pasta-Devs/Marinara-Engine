// ──────────────────────────────────────────────
// UI overhaul: the character page's Chat button
//
// It used to start a new Roleplay on every press and stay on the card, so
// each tap left another chat behind. Now it opens this character's recent
// chats, with "New chat…" (the mode picker) underneath; with no chats yet it
// goes straight to the mode picker. Either way you land in the chat.
// ──────────────────────────────────────────────
import { useMemo, useState } from "react";
import { MessageCircle, Plus } from "lucide-react";
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

  return (
    <>
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
          return (
            <button key={chat.id} type="button" role="menuitem" title={name} onClick={() => openChat(chat.id)}>
              <MessageCircle size="1rem" />
            </button>
          );
        })}
        <button type="button" role="menuitem" title={localize("New chat…")} onClick={newChat}>
          <Plus size="1rem" />
        </button>
      </RailMoreMenu>
    </>
  );
}
