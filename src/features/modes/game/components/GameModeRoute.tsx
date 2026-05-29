import { GameConversationView } from "./GameConversationView";

type GameModeRouteProps = {
  activeChatId: string;
};

export function GameModeRoute({ activeChatId }: GameModeRouteProps) {
  return <GameConversationView activeChatId={activeChatId} />;
}
