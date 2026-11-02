import { useStartChatFromCharacter } from "../../hooks/use-start-chat-from-character";
import { isMobileShellViewport, useUIStore } from "../../stores/ui.store";
import { ChatModeSelectorModal, type ChatLaunchMode } from "../chat/ChatModeSelectorModal";

interface StartCharacterChatModalProps {
  open: boolean;
  onClose: () => void;
  characterId: string;
  characterName: string;
}

export function StartCharacterChatModal({ open, onClose, characterId, characterName }: StartCharacterChatModalProps) {
  const closeAllDetails = useUIStore((state) => state.closeAllDetails);
  const closeRightPanel = useUIStore((state) => state.closeRightPanel);
  const { startChatFromCharacter, isStartingChat } = useStartChatFromCharacter();

  const selectMode = (mode: ChatLaunchMode) => {
    startChatFromCharacter({
      characterId,
      characterName,
      mode,
      onSuccess: () => {
        closeAllDetails();
        if (isMobileShellViewport()) closeRightPanel();
        onClose();
      },
    });
  };

  return <ChatModeSelectorModal open={open} onClose={onClose} onSelectMode={selectMode} isPending={isStartingChat} />;
}
