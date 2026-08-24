import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../packages/client/src/components/ui/SpriteGenerationModal.tsx", import.meta.url),
  "utf8",
);

assert.match(
  source,
  /const MATCHED_FULL_BODY_BATCH_SIZE = 1;/u,
  "matched full-body expressions must be split into one request each",
);
assert.match(
  source,
  /for \(let batchIndex = startIndex; batchIndex < batches\.length; batchIndex \+= 1\)[\s\S]*await generateMatchedFullBodyBatch/u,
  "matched full-body requests must run sequentially",
);
assert.match(
  source,
  /for \(let attempt = 0; attempt < 2; attempt \+= 1\)[\s\S]*await requestGeneratedSheet/u,
  "each expression request must receive one automatic retry",
);
assert.match(
  source,
  /nextCells = \[\.\.\.nextCells, \.\.\.generated\.cells\];[\s\S]*setCells\(nextCells\);/u,
  "each completed expression must be preserved before the next request starts",
);
assert.match(
  source,
  /setStep\(nextCells\.length > 0 \? 2 : 0\);/u,
  "cancelling a matched run must keep completed sprites available for review",
);
assert.match(
  source,
  /neutralFullBodyReference,[\s\S]*expressionReferences: matchedFullBodyMode/u,
  "individual requests must retain the accepted neutral and matching portrait references",
);

process.stdout.write("Matched full-body request regression passed\n");
