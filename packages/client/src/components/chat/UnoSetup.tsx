// ──────────────────────────────────────────────
// UnoSetup — game configuration modal (conversation mode)
// ──────────────────────────────────────────────
// Opened from the "Play UNO" launcher. Lets the player pick which characters
// play as bots, who goes first, and which house rules are on, then deals.
import { useEffect, useMemo, useState } from "react";
import { Gamepad2 } from "lucide-react";
import { DEFAULT_UNO_CONFIG, type UnoConfig } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { useCharacters } from "../../hooks/use-characters";
import { useChats } from "../../hooks/use-chats";
import { parseCharacterDisplayData } from "../../lib/character-display";
import { getChatCharacterIds } from "../../lib/chat-macros";
import { useStartUno } from "../../hooks/use-uno";
import { useUnoGameStore } from "../../stores/uno-game.store";

interface Props {
  chatId: string;
  open: boolean;
  onClose: () => void;
}

const RULE_OPTIONS: Array<{ key: keyof UnoConfig; label: string; help: string }> = [
  { key: "stacking", label: "Stacking", help: "Stack +2/+4 onto the next player instead of drawing." },
  { key: "drawToMatch", label: "Draw to match", help: "Keep drawing until you draw a playable card." },
  { key: "sevenZero", label: "7-0 rule", help: "7 swaps hands with a chosen player; 0 rotates all hands." },
  { key: "jumpIn", label: "Jump-in", help: "Play an identical card out of turn." },
  { key: "forcePlay", label: "Force play", help: "If a drawn card is playable, you must play it." },
];

export function UnoSetup({ chatId, open, onClose }: Props) {
  const { data: chats } = useChats();
  const { data: characters } = useCharacters(open);
  const start = useStartUno(chatId);

  // A game can start underneath the open modal — e.g. the user's "let's play
  // UNO" message opens this setup AND a character accepts via [uno].
  // Finished games linger in the store, so exclude them or a rematch's setup
  // modal closes itself on the same frame it opens.
  const activeGame = useUnoGameStore((s) => s.current);
  useEffect(() => {
    if (open && activeGame?.chatId === chatId && activeGame.status !== "finished") onClose();
  }, [open, activeGame, chatId, onClose]);

  const chat = useMemo(() => (chats ?? []).find((c) => c.id === chatId), [chats, chatId]);
  const charIds = useMemo(() => getChatCharacterIds(chat), [chat]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of characters ?? []) {
      const item = c as { id?: string; data?: unknown; comment?: string | null };
      if (typeof item.id === "string") map.set(item.id, parseCharacterDisplayData({ data: item.data, comment: item.comment }).name);
    }
    return map;
  }, [characters]);

  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [humanFirst, setHumanFirst] = useState(true);
  const [config, setConfig] = useState<UnoConfig>({ ...DEFAULT_UNO_CONFIG });

  // Default selection = every character in the chat (recomputed lazily once ids are known).
  const selectedIds = selected ?? new Set(charIds);

  const toggleSelected = (id: string) =>
    // Derive from the updater's `current` (not the render-time `selectedIds`) so
    // batched toggles don't clobber each other; fall back to every chat character
    // only before the user's first selection (current === null).
    setSelected((current) => {
      const next = new Set(current ?? charIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const botCount = selectedIds.size;
  const canDeal = botCount >= 1 && !start.isPending;

  const deal = () => {
    if (!canDeal) return;
    start.mutate(
      {
        gameType: "uno",
        config,
        botCharacterIds: charIds.filter((id) => selectedIds.has(id)),
        humanFirst,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Start UNO" width="max-w-md">
      <div className="space-y-4 p-1">
        {/* Players */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">Players</h3>
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
                    type="checkbox"
                    checked={selectedIds.has(id)}
                    onChange={() => toggleSelected(id)}
                    className="accent-[var(--primary)]"
                  />
                  <span className="text-sm text-[var(--foreground)]">{nameById.get(id) ?? id}</span>
                </label>
              ))}
            </div>
          )}
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={humanFirst}
              onChange={(e) => setHumanFirst(e.target.checked)}
              className="accent-[var(--primary)]"
            />
            You go first
          </label>
        </section>

        {/* House rules */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--foreground)]">House rules</h3>
          <div className="space-y-1">
            {RULE_OPTIONS.map((rule) => (
              <label
                key={rule.key}
                className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--muted)]"
                title={rule.help}
              >
                <input
                  type="checkbox"
                  checked={Boolean(config[rule.key])}
                  onChange={(e) => setConfig((c) => ({ ...c, [rule.key]: e.target.checked }))}
                  className="mt-0.5 accent-[var(--primary)]"
                />
                <span>
                  <span className="text-sm text-[var(--foreground)]">{rule.label}</span>
                  <span className="block text-xs text-[var(--muted-foreground)]">{rule.help}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <label className="text-sm text-[var(--foreground)]">Starting hand</label>
            <input
              type="number"
              min={1}
              max={10}
              value={config.startingHandSize}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  startingHandSize: Math.max(1, Math.min(10, Number(e.target.value) || 7)),
                }))
              }
              className="w-16 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)]"
            />
            <label className="ml-3 flex cursor-pointer items-center gap-2 text-sm text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={config.unoPenalty > 0}
                onChange={(e) => setConfig((c) => ({ ...c, unoPenalty: e.target.checked ? 2 : 0 }))}
                className="accent-[var(--primary)]"
              />
              Penalize missed UNO
            </label>
          </div>
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
            disabled={!canDeal}
            onClick={deal}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-1.5 text-sm font-semibold text-[var(--primary-foreground)] transition-transform active:scale-95 disabled:opacity-50"
          >
            <Gamepad2 className="h-4 w-4" />
            {start.isPending ? "Dealing…" : `Deal (${botCount + 1}p)`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
