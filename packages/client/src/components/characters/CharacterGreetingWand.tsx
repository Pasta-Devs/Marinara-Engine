import type { CardFieldDraft } from "@marinara-engine/shared";
import { useCardFieldGeneration } from "../../hooks/use-card-field-generation";
import { CardFieldWand } from "./CardFieldWand";

/** Each stable greeting owns its request, including cancellation when it is removed. */
export function CharacterGreetingWand({
  entityId,
  card,
  value,
  onApply,
  label,
}: {
  entityId: string | null;
  card: CardFieldDraft;
  value: string;
  onApply: (text: string) => void;
  label: string;
}) {
  const generation = useCardFieldGeneration<"first_mes">(
    "character",
    entityId,
    { ...card, first_mes: value },
    (_, text) => onApply(text),
  );
  return (
    <CardFieldWand
      label={label}
      onGenerate={() => void generation.generate("first_mes")}
      disabled={!entityId || generation.isPending}
      loading={generation.isPending}
    />
  );
}
