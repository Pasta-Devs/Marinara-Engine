import { Search } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";

interface GamePeekPromptButtonProps {
  messageId: string;
  className: string;
  onPeekPrompt: (messageId: string) => void;
}

export default function GamePeekPromptButton({ messageId, className, onPeekPrompt }: GamePeekPromptButtonProps) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <button
      type="button"
      data-component="GameNarration.PeekPrompt"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onPeekPrompt(messageId);
      }}
      className={className}
      title={localizeUi("ui.game.gamepeekpromptbutton.peekPrompt")}
      aria-label={localizeUi("ui.game.gamepeekpromptbutton.peekPrompt")}
    >
      <Search size={11} />
    </button>
  );
}
