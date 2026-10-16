// Source labels and connective words must not manufacture recall relevance.
const RECALL_STOP_WORDS = new Set(
  "the and that this these those with from into for was were are has have had will would could should can not but you your yours they their them she her his him our ours who what where when why how about after before then than there here just also only some any all each been being did does doing said says say user assistant narrator message messages scene".split(
    " ",
  ),
);

// Chinese and Japanese write no spaces between words, so a run of these scripts would read as one long word.
const UNSPACED_RUN = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\u30FC]+/gu;

export function recallTerms(text: string): Set<string> {
  const lower = text.toLocaleLowerCase();
  const terms = new Set(
    (lower.replace(UNSPACED_RUN, " ").match(/[\p{L}][\p{L}\p{N}]{2,}/gu) ?? []).filter(
      (word) => !RECALL_STOP_WORDS.has(word),
    ),
  );
  // Each such run counts as its overlapping character pairs, and a single character as itself (#7699).
  for (const run of lower.match(UNSPACED_RUN) ?? []) {
    if (run.length === 1) terms.add(run);
    for (let index = 0; index + 1 < run.length; index++) terms.add(run.slice(index, index + 2));
  }
  return terms;
}

// ponytail: capitalisation finds names only in cased scripts, and a fixed weight lets one name
// outrank a long message's ordinary words. Entity extraction is the upgrade path.
const NAME_WEIGHT = 8;

/** Query words that the texts write capitalised mid-sentence and never in lowercase: names such as "Shiro". */
export function recallNames(query: ReadonlySet<string>, texts: readonly string[]): Set<string> {
  const named = new Set<string>();
  const lowercase = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(/[\p{L}][\p{L}\p{N}]{2,}/gu)) {
      const word = match[0].toLocaleLowerCase();
      if (!query.has(word)) continue;
      if (match[0][0] === word[0]) lowercase.add(word);
      else if (/[\p{L}\p{N},;] $/u.test(text.slice(Math.max(0, match.index - 2), match.index))) named.add(word);
    }
  }
  return new Set([...named].filter((word) => !lowercase.has(word)));
}

/** Binary-term BM25: rare cues survive long recaps, using already-tokenized records. */
export function scoreRecallTerms(
  query: ReadonlySet<string>,
  documents: readonly ReadonlySet<string>[],
  names: ReadonlySet<string> = new Set(),
): number[] {
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
    // A name found in most documents (the persona or the main character) is no cue.
    weight:
      Math.log(1 + (documents.length - frequency + 0.5) / (frequency + 0.5)) *
      (names.has(word) && frequency * 2 <= documents.length ? NAME_WEIGHT : 1),
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

/**
 * ponytail: measured with the local MiniLM on a synthetic archive (#7699), where 1 still let long story turns push
 * paraphrased questions out of the shortlist. Another embedding model may spread its scores differently; measuring
 * it per embedding model is the upgrade.
 */
const DIFFUSE_QUERY_PENALTY = 1.5;

/**
 * Each item's best score over several queries, the latest query last (#7699). An earlier query's scores first lose
 * 1.5 times as much as their mean is above the latest's: a long story turn is close to nearly everything, so taken
 * as is it would outrank every focused match. With one query, its own scores.
 */
export function bestOverQueries(scores: readonly (readonly number[])[]): number[] {
  const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
  const latest = mean(scores.at(-1) ?? []);
  const shifts = scores.map((values, index) =>
    index < scores.length - 1 ? DIFFUSE_QUERY_PENALTY * Math.max(0, mean(values) - latest) : 0,
  );
  return (scores.at(-1) ?? []).map((_, item) =>
    Math.max(...scores.map((values, index) => values[item]! - shifts[index]!)),
  );
}

/**
 * Small, so the top of either ranking gets in. The usual 60 favours scenes both rankings place in the middle: on a
 * synthetic 800-scene archive it kept a scene with a unique name or object out of a 24-scene shortlist up to 100%
 * of the time, and 1, 3 and 10 kept every one (#7699).
 */
const FUSION_K = 3;

/**
 * Scene ids by reciprocal rank fusion of their word-match and vector-similarity scores (#7699), so a scene that
 * shares no word with the question can still rank by meaning, however modest its similarity. Equal scores share
 * the middle of the ranks they span. A scene without a vector counts its word rank twice. Vectors are ranked only
 * among the scenes that have one, so when only some do, those few take the top vector ranks whatever their
 * similarity and push word matches out: fuse only once nearly every scene has a vector. Ties keep the order of
 * `words`, which with no vectors at all is exactly the word-match order.
 */
export function fuseRecallRanks(words: ReadonlyMap<string, number>, vectors: ReadonlyMap<string, number>): string[] {
  const ranks = (scores: ReadonlyMap<string, number>) => {
    const first = new Map<number, number>();
    const last = new Map<number, number>();
    const sorted = [...scores.values()].sort((a, b) => b - a);
    for (const [index, score] of sorted.entries()) {
      if (!first.has(score)) first.set(score, index + 1);
      last.set(score, index + 1);
    }
    return new Map([...scores].map(([id, score]) => [id, (first.get(score)! + last.get(score)!) / 2]));
  };
  const wordRanks = ranks(words);
  const vectorRanks = ranks(vectors);
  const fused = new Map(
    [...wordRanks].map(([id, rank]) => [id, 1 / (FUSION_K + rank) + 1 / (FUSION_K + (vectorRanks.get(id) ?? rank))]),
  );
  return [...words.keys()].sort((a, b) => fused.get(b)! - fused.get(a)!);
}

/**
 * The first `size` of `order`, with the scene that follows each of its best three placed right after them when
 * not already in, for "what happened after X" questions. The weakest places make room, so the size holds.
 */
export function withFollowingScenes(
  order: readonly string[],
  next: (id: string) => string | undefined,
  size: number,
): string[] {
  const shortlist = order.slice(0, size);
  const best = shortlist.slice(0, 3);
  const following = best.map(next).filter((id): id is string => !!id && !shortlist.includes(id));
  return [...new Set([...best, ...following, ...shortlist.slice(3)])].slice(0, size);
}
