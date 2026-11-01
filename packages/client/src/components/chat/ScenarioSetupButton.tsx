import { lazy, Suspense, useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useChat } from "../../hooks/use-chats";
import { readChatMetadata } from "../../lib/chat-wizard-defaults";

// The dialog lives in the lazily loaded wizard module; only this button ships with the chat view.
const ScenarioSetupDialog = lazy(() =>
  import("./ChatSetupWizard").then((module) => ({ default: module.ScenarioSetupDialog })),
);

/**
 * "Set up a scenario" for a roleplay or conversation chat with no messages. Stays mounted while the
 * dialog is open: Start writes the opening first, which makes the chat non-empty mid-save.
 */
export function ScenarioSetupButton({ chatId, empty }: { chatId: string | null; empty: boolean }) {
  const { t } = useTranslation();
  const { data: chat } = useChat(chatId);
  const [open, setOpen] = useState(false);
  if (!chat || (chat.mode !== "roleplay" && chat.mode !== "conversation")) return null;
  if (readChatMetadata(chat).multiplayerSetup === true) return null;
  // A draft needs a character to speak the opening.
  const characterIds: unknown =
    typeof chat.characterIds === "string" ? JSON.parse(chat.characterIds) : chat.characterIds;
  if (!Array.isArray(characterIds) || !characterIds.length) return null;
  return (
    <>
      {empty && !open && (
        <div className="flex justify-center px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mari-chat-style-control mari-chrome-control mari-chrome-control--small inline-flex min-h-11 items-center gap-1.5 px-3 text-xs sm:min-h-0"
          >
            <Sparkles size="0.75rem" aria-hidden="true" />
            {t("chat.wizard.scenario.title")}
          </button>
        </div>
      )}
      {open && (
        <Suspense fallback={null}>
          <ScenarioSetupDialog chat={chat} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
