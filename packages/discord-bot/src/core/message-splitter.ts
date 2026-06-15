export const DISCORD_MESSAGE_CONTENT_BUDGET = 1900;

function splitByPattern(input: string, pattern: RegExp) {
  return input
    .split(pattern)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function hardSplit(input: string, budget: number) {
  const chunks: string[] = [];
  for (let index = 0; index < input.length; index += budget) {
    chunks.push(input.slice(index, index + budget));
  }
  return chunks;
}

function packParts(parts: string[], budget: number, separator: string) {
  const chunks: string[] = [];
  let current = "";

  for (const part of parts) {
    const next = current ? `${current}${separator}${part}` : part;
    if (next.length <= budget) {
      current = next;
      continue;
    }

    if (current) chunks.push(current);
    current = part;
  }

  if (current) chunks.push(current);
  return chunks;
}

function splitToBudget(input: string, budget: number, level = 0): string[] {
  if (input.length <= budget) return [input];
  const strategies = [
    { pattern: /\n{2,}/, separator: "\n\n" },
    { pattern: /(?<=[.!?])\s+/, separator: " " },
    { pattern: /\s+/, separator: " " },
  ];
  const strategy = strategies[level];
  if (!strategy) return hardSplit(input, budget);

  const parts = splitByPattern(input, strategy.pattern);
  if (parts.length <= 1) return splitToBudget(input, budget, level + 1);
  return packParts(
    parts.flatMap((part) => splitToBudget(part, budget, level + 1)),
    budget,
    strategy.separator,
  );
}

export function splitDiscordMessageContent(content: string, budget = DISCORD_MESSAGE_CONTENT_BUDGET) {
  const normalized = content.trim();
  if (!normalized) return ["(empty message)"];

  const chunks = splitToBudget(normalized, budget);

  if (chunks.length <= 1) return chunks;
  const total = chunks.length;
  return chunks.map((chunk, index) => `${chunk}\n[${index + 1}/${total}]`);
}
