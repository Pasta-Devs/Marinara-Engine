import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const routePath = resolve(process.cwd(), "src/routes/generate.routes.ts");

async function source(): Promise<string> {
  return readFile(routePath, "utf8");
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

test("Runtime coordinates are captured before tool attachment and tracking runs only after promotion", async () => {
  const text = await source();
  const latestRevision = text.indexOf("humanOSRuntimeStorage.getLatestCommitted(input.chatId)");
  const runtimeFactory = text.indexOf("createHumanOSToolRuntime({", latestRevision);
  const toolResolution = text.indexOf("resolveGenerationTools({", runtimeFactory);
  const promotion = text.indexOf("messagePublication.promoteCandidate", toolResolution);
  const tracking = text.indexOf("runPostCanonicalTracking({", promotion);
  const canonicalReload = text.indexOf("loadMessage: chats.getMessage", tracking);

  assert.ok(latestRevision >= 0);
  assert.ok(runtimeFactory > latestRevision);
  assert.ok(toolResolution > runtimeFactory);
  assert.ok(promotion > toolResolution);
  assert.ok(tracking > promotion);
  assert.ok(canonicalReload > tracking);
});

test("reviewed turns suppress tools, early publication, commands, OOC, map, Discord, and parallel agents", async () => {
  const text = await source();
  assert.match(text, /const toolDefs = humanOSPublicationPolicy\.enabled \? \[\]/);
  assert.match(text, /restrictAgentToolsToPostCanonicalTrackers: humanOSPublicationPolicy\.enabled/);
  assert.match(text, /if \(!humanOSPublicationPolicy\.enabled\) \{\s*sendSseEvent\(reply, \{\s*type: "message_saved"/s);
  assert.match(
    text,
    /humanOSPublicationPolicy\.enabled &&\s*\(parsedCommands\.length > 0 \|\| parsedRawCommandCount > 0 \|\| oocMessages\.length > 0\)/s,
  );
  assert.match(text, /!humanOSPublicationPolicy\.enabled && chatMode === "game"/);
  assert.match(text, /!humanOSPublicationPolicy\.enabled && pipelineAgents\.some\(\(a\) => a\.phase === "parallel"\)/s);
  assert.match(text, /!humanOSPublicationPolicy\.enabled &&\s*discordWebhookUrl/s);
});

test("reviewed turns defer Narrative Director memory until after canonical promotion", async () => {
  const text = await source();
  const deferredDeclaration = text.indexOf("let deferredDirectorSecretPlotArc:");
  const deferAssignment = text.indexOf("deferredDirectorSecretPlotArc = plotData.overarchingArc", deferredDeclaration);
  const promotion = text.indexOf("messagePublication.promoteCandidate", deferAssignment);
  const deferredPersistence = text.indexOf("deferredDirectorSecretPlotArc !== undefined", promotion);
  const setMemory = text.indexOf('"overarchingArc",', deferredPersistence);
  const deferredGuard = text.slice(Math.max(promotion, deferredPersistence - 180), deferredPersistence + 80);

  assert.ok(deferredDeclaration >= 0);
  assert.ok(deferAssignment > deferredDeclaration);
  assert.ok(promotion > deferAssignment);
  assert.ok(deferredPersistence > promotion);
  assert.match(deferredGuard, /humanOSPublicationPolicy\.enabled\s*&&\s*deferredDirectorSecretPlotArc/);
  assert.ok(setMemory > deferredPersistence);
});

test("review rejection uses bounded draft-only recomposition before canonical promotion", async () => {
  const text = await source();
  const controllerCall = text.indexOf("runBoundedHumanOSRecomposition({");
  const candidateReplacement = text.indexOf("messagePublication.updateCandidateDraft({", controllerCall);
  const orderedReview = text.indexOf("runHumanOSOrderedReview({", controllerCall);
  const promotion = text.indexOf("messagePublication.promoteCandidate(", controllerCall);
  assert.ok(controllerCall >= 0, "bounded recomposition controller must govern reviewed publication");
  assert.ok(orderedReview > controllerCall, "every attempt must enter the ordered review chain");
  assert.ok(candidateReplacement > orderedReview, "replacement must be compare-and-set through candidate storage");
  assert.ok(promotion > orderedReview, "promotion must remain owned by a passing ordered review");
  assert.match(text.slice(controllerCall, candidateReplacement + 500), /maxRecompositions:\s*2/);
  assert.match(text.slice(controllerCall, candidateReplacement + 500), /humanOSReviewAttempt:\s*attempt/);
});

test("recomposition provider calls are draft-only, tool-free, and non-streaming", async () => {
  const text = await source();
  const start = text.indexOf("humanOSRecomposeDraft = async");
  const end = text.indexOf("// Reset per-character accumulators", start);
  assert.ok(start >= 0 && end > start, "draft-only recomposition closure must be installed before generation");
  const block = text.slice(start, end);
  assert.match(block, /provider\.chatComplete\(/);
  assert.match(block, /stream:\s*false/);
  assert.doesNotMatch(block, /tools:\s*toolDefs/);
  assert.match(block, /retry\.toolCalls\.length\s*>\s*0/);
  assert.match(block, /forbidden side-effect command/);
  assert.doesNotMatch(block, /sendSseEvent|trySendSseEvent|createCandidate|createMessage/);
});
