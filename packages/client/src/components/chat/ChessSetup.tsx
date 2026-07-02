// ──────────────────────────────────────────────
// ChessSetup — game configuration modal (conversation mode)
// ──────────────────────────────────────────────
// Opened from the /chess command or the natural-language launcher. Chess is
// strictly one-on-one: pick a single opponent character and your color.
import { useEffect, useMemo, useState } from "react";
import { Crown } from "lucide-react";
import type { ChessColor } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { useCharacters } from "../../hooks/use-characters";
import { useChats } from "../../hooks/use-chats";
import { parseCharacterDisplayData } from "../../lib/character-display";
import { getChatCharacterIds } from "../../lib/chat-macros";
import { useStartChess } from "../../hooks/use-chess";
import { useChessGameStore } from "../../stores/chess-game.store";

interface Props {
  chatId: string;
  open: boolean;
  onClose: () => void;
}

const COLOR_OPTIONS: Array<{ value: ChessColor | "random"; label: string }> = [
  { value: "white", label: "White" },
  { value: "random", label: "Random" },
  { value: "black", label: "Black" },
];

export function ChessSetup({ chatId, open, onClose }: Props) {
  const { data: chats } = useChats();
  const { data: characters } = useCharacters(open);
  const start = useStartChess(chatId);

  // A game can start underneath the open modal — e.g. the user's "let's play
  // chess" message opens this setup AND a character accepts via [chess].
  // Finished games linger in the store, so exclude them or a rematch's setup
  // modal closes itself on the same frame it opens.
  const activeGame = useChessGameStore((s) => s.current);
  useEffect(() => {
    if (open && activeGame?.chatId === chatId && activeGame.status !== "finished") onClose();
  }, [open, activeGame, chatId, onClose]);

  const chat = useMemo(() => (chats ?? []).find((c) => c.id === chatId), [chats, chatId]);
  const charIds = useMemo(() => getChatCharacterIds(chat), [chat]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of characters ?? []) {
      const item = c as { id?: string; data?: unknown; comment?: string | null };
      if (typeof item.id === "string")
        map.set(item.id, parseCharacterDisplayData({ data: item.data, comment: item.comment }).name);
    }
    return map;
  }, [characters]);

  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [humanColor, setHumanColor] = useState<ChessColor | "random">("random");

  // Default opponent = the chat's first character (until the user picks one).
  const selectedOpponent = opponentId ?? charIds[0] ?? null;
  const canStart = !!selectedOpponent && !start.isPending;

  const startGame = () => {
    if (!selectedOpponent || !canStart) return;
    start.mutate(
      {
        gameType: "chess",
        config: { humanColor },
        botCharacterIds: [selectedOpponent],
        humanFirst: true,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Start Chess" width="max-w-md">
      <div className="space-y-4 p-1">
        {/* Opponent */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">Opponent</h3>
          {charIds.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">Add at least one character to this chat to play.</p>
          ) : (
            <div className="space-y-1">
              {charIds.map((id) => (
                <label
                  key={id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--muted)]"
                >
                  <input
                    type="radio"
                    name="chess-opponent"
                    checked={selectedOpponent === id}
                    onChange={() => setOpponentId(id)}
                    className="accent-[var(--primary)]"
                  />
                  <span className="text-sm text-[var(--foreground)]">{nameById.get(id) ?? id}</span>
                </label>
              ))}
            </div>
          )}
        </section>

        {/* Color */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">Your color</h3>
          <div className="flex overflow-hidden rounded-lg border border-[var(--border)]">
            {COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setHumanColor(opt.value)}
                className={`flex-1 px-3 py-1.5 text-sm font-medium transition-colors ${
                  humanColor === opt.value
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--muted)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">White moves first.</p>
        </section>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canStart}
            onClick={startGame}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-1.5 text-sm font-semibold text-[var(--primary-foreground)] transition-transform active:scale-95 disabled:opacity-50"
          >
            <Crown className="h-4 w-4" />
            {start.isPending ? "Setting up…" : "Start game"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
