// Reviewing a media prompt before it is sent: previews time out instead of hanging, Game allows one review at a time
// and falls back to the default prompt on a timeout, an edited negative prompt is sent, and an Illustrator retry logs
// its final prompt, and confirming a Conversation selfie review resumes the send. Reads component source until a test
// can drive these.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chatAreaPromptReviewSource = readFileSync(
  new URL("../../../packages/client/src/components/chat/ChatArea.tsx", import.meta.url),
  "utf8",
);
const gameSurfacePromptReviewSource = readFileSync(
  new URL("../../../packages/client/src/components/game/GameSurface.tsx", import.meta.url),
  "utf8",
);
const imagePromptReviewModalSource = readFileSync(
  new URL("../../../packages/client/src/components/ui/ImagePromptReviewModal.tsx", import.meta.url),
  "utf8",
);
const retryAgentsPromptReviewSource = readFileSync(
  new URL("../../../packages/server/src/routes/generate/retry-agents-route.ts", import.meta.url),
  "utf8",
);
assert.match(chatAreaPromptReviewSource, /MEDIA_PROMPT_PREVIEW_TIMEOUT_MS/);
assert.match(gameSurfacePromptReviewSource, /if \(imagePromptReviewResolveRef\.current\)/);
assert.match(
  gameSurfacePromptReviewSource,
  /ui\.game\.gamesurfacecomponent\.videoPromptPreviewTimedOutContinuingWithTheDefault/u,
);
assert.match(
  imagePromptReviewModalSource,
  /item\.negativePrompt !== undefined \|\| negativePrompt \? \{ negativePrompt \} : \{\}/,
);
assert.match(retryAgentsPromptReviewSource, /\[debug\/retry-agents\/illustrator\] final prompt/);

assert.match(chatAreaPromptReviewSource, /confirmConversationSelfiePromptReview/);
