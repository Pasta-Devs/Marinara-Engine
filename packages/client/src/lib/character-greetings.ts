export type CharacterGreeting = { text: string; alternateIndex: number | null };

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Reads a card's first message plus alternate greetings, in the order they should be offered. */
export function readCharacterGreetings(data: unknown): {
  greetings: CharacterGreeting[];
  dialogueColor?: string;
} {
  const parsed = typeof data === "string" ? safeParse(data) : data;
  if (!parsed || typeof parsed !== "object") return { greetings: [] };
  const card = parsed as { first_mes?: unknown; alternate_greetings?: unknown; extensions?: unknown };
  const greetings: CharacterGreeting[] = [];
  if (typeof card.first_mes === "string" && card.first_mes.trim()) {
    greetings.push({ text: card.first_mes.trim(), alternateIndex: null });
  }
  if (Array.isArray(card.alternate_greetings)) {
    card.alternate_greetings.forEach((greeting, index) => {
      if (typeof greeting === "string" && greeting.trim()) {
        greetings.push({ text: greeting.trim(), alternateIndex: index + 1 });
      }
    });
  }
  const dialogueColor =
    card.extensions && typeof card.extensions === "object"
      ? (card.extensions as { dialogueColor?: unknown }).dialogueColor
      : undefined;
  return {
    greetings,
    dialogueColor: typeof dialogueColor === "string" && dialogueColor.trim() ? dialogueColor.trim() : undefined,
  };
}
