// Guards the tiered [fetch:] resolver introduced for #4768 phase 2: exact name →
// substring → semantic embedding shortlist, auto-opening only a single confident
// hit and returning a candidate list on weak/ambiguous matches.
//
// The semantic tier is exercised with a deterministic bag-of-words stub embedder
// (token overlap → real cosine separation), threaded through the same
// embeddingSource seam production uses — no ONNX, no live model.
import assert from "node:assert/strict";
import {
  tieredResolveEntity,
  warmEntityEmbeddings,
  type EntityCandidate,
  type EntityDescriptor,
} from "../../packages/server/src/services/entity-semantic-search.js";
import { BOW_STUB_DIM as DIM, createBowStubEmbedder } from "./helpers/bow-stub-embedder.js";

// Deterministic, collision-free bag-of-words embedder (token overlap → exact
// cosine separation); shared with the other Mari fetch regressions.
const stubEmbedder = createBowStubEmbedder(undefined, "fetch-tiers regression");

function candidate(id: string, name: string, embedText: string): EntityCandidate {
  return { id, name, embedText, embedding: null, blurb: name };
}

function makeDescriptor(rows: EntityCandidate[]): EntityDescriptor {
  return {
    type: "character",
    listAll: async () => rows.map((r) => ({ ...r })),
  };
}

const OPTS = { embeddingSource: stubEmbedder, vectorizerAvailable: true, topK: 5 };

// A varied library. The two vampires are deliberately symmetric so "vampire"
// ties (→ disambiguation), while c2 carries distinctive words ("brooding
// immortal") so a reordered paraphrase resolves to it uniquely.
const library = () => [
  candidate("c1", "Zander", "Zander, a stern paladin of the northern gate"),
  candidate("c2", "Dracula", "Dracula, a brooding immortal vampire"),
  candidate("c3", "Alucard", "Alucard, a hunting daywalker vampire"),
  candidate("c4", "Bob", "Bob, a cheerful baker"),
  candidate("c5", "Zaxby's Keep", "Zaxby's Keep, a marsh fortress"),
];

// ── 1. Exact normalized name auto-opens (original behavior preserved) ──
{
  const r = await tieredResolveEntity(makeDescriptor(library()), "zander", OPTS);
  assert.equal(r.kind, "single");
  assert.equal(r.kind === "single" && r.candidate.id, "c1");
}

// ── 2. A unique substring hit auto-opens without needing the semantic tier ──
{
  // "zaxby" is a substring of one name only.
  const r = await tieredResolveEntity(makeDescriptor(library()), "zaxby", OPTS);
  assert.equal(r.kind, "single");
  assert.equal(r.kind === "single" && r.candidate.id, "c5");
}

// ── 3. A descriptive query that is NOT a literal substring resolves via
//       semantic-over-all and auto-opens the single strong hit ──
{
  // Reordered so it is not a substring of c2's "brooding immortal vampire",
  // forcing the semantic tier (not substring) to make the match.
  const r = await tieredResolveEntity(makeDescriptor(library()), "immortal vampire brooding", OPTS);
  assert.equal(r.kind, "single", "a clear descriptive match should auto-open");
  assert.equal(r.kind === "single" && r.candidate.id, "c2");
}

// ── 4. Ambiguous match returns a candidate LIST, not a wrong auto-open ──
{
  // "vampire" is a substring of two candidates (Dracula, Alucard); neither wins
  // by the required margin, so Mari must be given both to disambiguate.
  const r = await tieredResolveEntity(makeDescriptor(library()), "vampire", OPTS);
  assert.equal(r.kind, "candidates", "an ambiguous match must disambiguate, not guess");
  const ids = r.kind === "candidates" ? r.candidates.map((c) => c.id).sort() : [];
  assert.deepEqual(ids, ["c2", "c3"], "both vampires must be offered");
}

// ── 5. Semantic unavailable degrades to substring: multiple → candidates, none → none ──
{
  const degraded = { embeddingSource: stubEmbedder, vectorizerAvailable: false, topK: 5 };
  const multi = await tieredResolveEntity(makeDescriptor(library()), "vampire", degraded);
  assert.equal(multi.kind, "candidates", "with semantic off, multiple substring hits still list");
  const paraphrase = await tieredResolveEntity(makeDescriptor(library()), "immortal vampire brooding", degraded);
  assert.equal(paraphrase.kind, "none", "with semantic off, a non-substring descriptive query cannot resolve");
}

// ── 6. A query matching nothing resolves to none ──
{
  const r = await tieredResolveEntity(makeDescriptor(library()), "spaceship pilot from andromeda", OPTS);
  assert.equal(r.kind, "none");
}

// ── 7. warmEntityEmbeddings persists via the descriptor's setter and no-ops when absent ──
{
  const persisted = new Map<string, number[] | null>();
  const rows = library();
  const descriptor: EntityDescriptor = {
    type: "character",
    listAll: async () => rows.map((r) => ({ ...r })),
    updateEmbedding: async (id, vector) => {
      persisted.set(id, vector);
    },
  };
  const pool = rows.map((r) => ({ ...r }));
  const result = await warmEntityEmbeddings(descriptor, pool, OPTS);
  assert.equal(result.embedded, rows.length, "warmup must persist every missing embedding");
  assert.equal(persisted.size, rows.length, "the descriptor setter must be called per entity");
  assert.ok(pool.every((c) => c.embedding && c.embedding.length === DIM), "pool embeddings must be populated in place");

  // No persisted setter (on-the-fly types): embeddings are still set in memory
  // for ranking, but nothing is persisted (embedded === 0).
  const onTheFlyPool = rows.map((r) => ({ ...r }));
  const onTheFly = await warmEntityEmbeddings(makeDescriptor(rows), onTheFlyPool, OPTS);
  assert.equal(onTheFly.embedded, 0, "with no setter, nothing is persisted");
  assert.equal(onTheFly.attempted, rows.length, "with no setter, embeddings are still computed in memory");
  assert.ok(onTheFlyPool.every((c) => c.embedding && c.embedding.length === DIM), "in-memory embeddings populate the pool");
}

process.stdout.write("Professor Mari fetch-tiers regression passed.\n");
