import { useEncounterStore } from "../../../stores/encounter.store";

export function CreaturePartyPanel() {
  const { creatureBattle } = useEncounterStore();

  if (!creatureBattle?.active) return null;

  return (
    <div className="creature-party-panel">
      <h4>Party</h4>
      {creatureBattle.party.map((c: any) => (
        <div key={c.id}>
          {c.species} Lv.{c.level} — HP: {c.currentHp}/{c.stats.hp}
        </div>
      ))}
    </div>
  );
}
