import type { CreatureInstance } from "@marinara-engine/shared";

interface MoveGridProps {
  creature: CreatureInstance;
  onMoveSelect?: (moveName: string) => void;
}

export function MoveGrid({ creature, onMoveSelect }: MoveGridProps) {
  return (
    <div className="move-grid">
      {creature.moves.map((move, idx) => (
        <button
          key={idx}
          onClick={() => onMoveSelect?.(move.name)}
          disabled={move.pp === 0}
        >
          {move.name} ({move.type}) — {move.pp}/{move.maxPp}
        </button>
      ))}
    </div>
  );
}
