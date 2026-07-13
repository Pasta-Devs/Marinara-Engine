import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeUrl = new URL("../../../routes/generate.routes.ts", import.meta.url);

async function source(): Promise<string> {
  return readFile(routeUrl, "utf8");
}

test("reviewed generation stores a candidate instead of creating a canonical assistant row", async () => {
  const text = await source();
  const candidateBranch = text.indexOf("else if (humanOSPublicationPolicy.enabled)");
  const createCandidate = text.indexOf("messagePublication.createCandidate", candidateBranch);
  const legacyCreate = text.indexOf("chats.createMessage", createCandidate);
  assert.ok(candidateBranch >= 0);
  assert.ok(createCandidate > candidateBranch);
  assert.ok(legacyCreate > createCandidate);
});

test("canonical publication is granted only by ordered review promotion", async () => {
  const text = await source();
  const review = text.indexOf("runHumanOSOrderedReview({");
  const publish = text.indexOf("publishCanonical: async", review);
  const promote = text.indexOf("messagePublication.promoteCandidate", publish);
  const canonicalEvent = text.indexOf('type: "message_saved", data: promotedMessage', promote);
  assert.ok(review >= 0);
  assert.ok(publish > review);
  assert.ok(promote > publish);
  assert.ok(canonicalEvent > promote);
});

test("review failure rejects the candidate before downstream post-processing", async () => {
  const text = await source();
  const review = text.indexOf("runHumanOSOrderedReview({");
  const reject = text.indexOf("messagePublication.rejectCandidate", review);
  const postProcessing = text.indexOf("Collect parallel results + Phase 3", review);
  assert.ok(reject > review);
  assert.ok(postProcessing > reject);
});

test("terminal cleanup rejects a candidate left pending by abort or exception", async () => {
  const text = await source();
  const requestGuard = text.indexOf("let pendingHumanOSCandidate:");
  const outerTry = text.indexOf("    try {", requestGuard);
  const candidateCreated = text.indexOf("pendingHumanOSCandidate = { messageId: savedMsg.id", outerTry);
  const terminalFinally = text.lastIndexOf("    } finally {");
  const cleanupGuard = text.indexOf("if (pendingHumanOSCandidate)", terminalFinally);
  const cleanupReject = text.indexOf("await messagePublication.rejectCandidate", cleanupGuard);
  assert.ok(requestGuard >= 0);
  assert.ok(outerTry > requestGuard);
  assert.ok(candidateCreated > outerTry);
  assert.ok(terminalFinally > candidateCreated);
  assert.ok(cleanupGuard > terminalFinally);
  assert.ok(cleanupReject > cleanupGuard);
});

test("reviewed turns suppress tools, early publication, commands, OOC, map, Discord, and parallel agents", async () => {
  const text = await source();
  assert.match(text, /const toolDefs = humanOSPublicationPolicy\.enabled \? \[\]/);
  assert.match(text, /if \(!humanOSPublicationPolicy\.enabled\) \{\s*sendSseEvent\(reply, \{\s*type: "message_saved"/s);
  assert.match(text, /humanOSPublicationPolicy\.enabled &&\s*\(parsedCommands\.length > 0 \|\| parsedRawCommandCount > 0 \|\| oocMessages\.length > 0\)/s);
  assert.match(text, /!humanOSPublicationPolicy\.enabled && chatMode === "game"/);
  assert.match(text, /!humanOSPublicationPolicy\.enabled && pipelineAgents\.some\(\(a\) => a\.phase === "parallel"\)/s);
  assert.match(text, /!humanOSPublicationPolicy\.enabled &&\s*discordWebhookUrl/s);
});
