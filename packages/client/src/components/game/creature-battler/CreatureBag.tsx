interface CreatureBagProps {
  onItemUse?: (itemName: string) => void;
}

export function CreatureBag({ onItemUse }: CreatureBagProps) {
  // Placeholder — real items would come from character inventory or creature held items
  const sampleItems = ["Potion", "Super Potion", "Revive"];

  return (
    <div className="creature-bag">
      <h4>Bag</h4>
      {sampleItems.map((item) => (
        <button key={item} onClick={() => onItemUse?.(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}
