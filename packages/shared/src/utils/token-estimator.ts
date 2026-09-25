/** Lightweight, model-agnostic token estimate based on Unicode script. */
export function estimateTextTokens(text: string): number {
  let hundredthTokens = 0;

  for (const character of text) {
    hundredthTokens += codePointTokenHundredths(character.codePointAt(0)!);
  }

  return Math.ceil(hundredthTokens / 100);
}

/** Keep a prefix (or suffix) within the same estimate, without splitting Unicode code points. */
export function sliceTextToTokenBudget(text: string, tokenBudget: number, fromEnd = false): string {
  if (!(tokenBudget > 0)) return "";
  const budget = Math.floor(tokenBudget) * 100;
  let used = 0;
  let index = fromEnd ? text.length : 0;
  while (fromEnd ? index > 0 : index < text.length) {
    let pointIndex = fromEnd ? index - 1 : index;
    if (
      fromEnd &&
      pointIndex > 0 &&
      text.charCodeAt(pointIndex) >= 0xdc00 &&
      text.charCodeAt(pointIndex) <= 0xdfff &&
      text.charCodeAt(pointIndex - 1) >= 0xd800 &&
      text.charCodeAt(pointIndex - 1) <= 0xdbff
    )
      pointIndex -= 1;
    const codePoint = text.codePointAt(pointIndex)!;
    const next = used + codePointTokenHundredths(codePoint);
    if (next > budget) break;
    used = next;
    index = fromEnd ? pointIndex : pointIndex + (codePoint > 0xffff ? 2 : 1);
  }
  return fromEnd ? text.slice(index) : text.slice(0, index);
}

function codePointTokenHundredths(codePoint: number): number {
  if (isHangul(codePoint)) return 50;
  if (isHan(codePoint) || isKana(codePoint)) return 67;
  return 25;
}

function isHangul(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x11ff) ||
    (codePoint >= 0x3130 && codePoint <= 0x318f) ||
    (codePoint >= 0xa960 && codePoint <= 0xa97f) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7af) ||
    (codePoint >= 0xd7b0 && codePoint <= 0xd7ff)
  );
}

function isHan(codePoint: number): boolean {
  return (
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0x20000 && codePoint <= 0x323af)
  );
}

function isKana(codePoint: number): boolean {
  return (
    (codePoint >= 0x3040 && codePoint <= 0x309f) ||
    (codePoint >= 0x30a0 && codePoint <= 0x30ff) ||
    (codePoint >= 0x31f0 && codePoint <= 0x31ff) ||
    (codePoint >= 0xff66 && codePoint <= 0xff9f) ||
    (codePoint >= 0x1b000 && codePoint <= 0x1b16f)
  );
}

/** Serialize the estimator with its private helpers for isolated extension runtimes. */
export function getSerializedTextTokenEstimator(): string {
  return `(() => {
    const isHangul = ${isHangul.toString()};
    const isHan = ${isHan.toString()};
    const isKana = ${isKana.toString()};
    const codePointTokenHundredths = ${codePointTokenHundredths.toString()};
    return ${estimateTextTokens.toString()};
  })()`;
}
