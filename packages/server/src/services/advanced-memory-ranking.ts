// Source labels and connective words must not manufacture recall relevance.
const RECALL_STOP_WORDS = new Set(
  "the and that this these those with from into for was were are has have had will would could should can not but you your yours they their them she her his him our ours who what where when why how about after before then than there here just also only some any all each been being did does doing said says say user assistant narrator message messages scene".split(
    " ",
  ),
);

export function recallTerms(text: string): Set<string> {
  return new Set(
    (text.toLocaleLowerCase().match(/[\p{L}][\p{L}\p{N}]{2,}/gu) ?? []).filter((word) => !RECALL_STOP_WORDS.has(word)),
  );
}

/** Binary-term BM25: rare cues survive long recaps, using already-tokenized records. */
export function scoreRecallTerms(query: ReadonlySet<string>, documents: readonly ReadonlySet<string>[]): number[] {
  const frequencies = new Map<string, number>();
  let totalLength = 0;
  for (const words of documents) {
    totalLength += words.size;
    for (const word of query) {
      if (words.has(word)) frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
    }
  }
  const averageLength = totalLength / Math.max(1, documents.length) || 1;
  const weights = [...frequencies].map(([word, frequency]) => ({
    word,
    weight: Math.log(1 + (documents.length - frequency + 0.5) / (frequency + 0.5)),
  }));
  return documents.map((words) => {
    // Standard BM25 k1=1.2 and b=0.75, with each distinct term counted once.
    const lengthFactor = 2.2 / (1 + 1.2 * (0.25 + (0.75 * words.size) / averageLength));
    let score = 0;
    for (const { word, weight } of weights) {
      if (words.has(word)) score += weight * lengthFactor;
    }
    return score / (1 + score); // Keep lexical and semantic relevance on the same 0–1 scale.
  });
}
