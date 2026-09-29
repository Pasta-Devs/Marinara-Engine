import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import type { Chat, MultiplayerHostAction, MultiplayerPlayer } from "@marinara-engine/shared";
import { useCharacters } from "../../hooks/use-characters";
import type { GameSetupWizardProps } from "../../components/game/GameSetupWizard";

const GameSetupWizard = lazy(() =>
  import("../../components/game/GameSetupWizard").then((module) => ({ default: module.GameSetupWizard })),
);
export type PreparedMultiplayerGame = Omit<Extract<MultiplayerHostAction, { type: "startGame" }>, "type">;

/** Collect the existing wizard's choices. Starting/generation stays in host room controls. */
export function PreparedMultiplayerGameSetup({
  chat,
  players,
  onPrepared,
  onCancel,
  busy = false,
}: {
  chat: Chat;
  players: MultiplayerPlayer[];
  onPrepared: (setup: PreparedMultiplayerGame) => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  const { data: characters = [], isLoading } = useCharacters();
  const loading = (
    <p role="status" className="p-4 text-sm text-[var(--muted-foreground)]">
      {t("multiplayer.loading")}
    </p>
  );
  if (isLoading) return loading;
  return (
    <Suspense fallback={loading}>
      <GameSetupWizard
        activeChatId={chat.id}
        isNewGame
        chatMetadata={chat.metadata as Record<string, unknown>}
        characters={characters as GameSetupWizardProps["characters"]}
        multiplayerPlayers={players}
        onSetupError={() => false}
        isLoading={busy}
        isDraftingMap={false}
        isLinkingSharedWorld={false}
        onCancel={onCancel}
        onComplete={(config, preferences, connections, gameName) =>
          onPrepared({
            config,
            preferences,
            gmConnectionId: connections.gmConnectionId,
            gameName,
          })
        }
      />
    </Suspense>
  );
}
