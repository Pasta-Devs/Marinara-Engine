// Replaying a game session: the turns rebuilt from its messages, the storyboard keyframe for a turn, and which chat
// holds a replayable session.
import assert from "node:assert/strict";
import type { Chat, Message } from "../../../packages/shared/src/types/chat.js";
import {
  buildGameSessionReplayTurns,
  findReplayStoryboardKeyframe,
} from "../../../packages/client/src/lib/game-session-replay.js";
import { findReplayableGameSessionChat } from "../../../packages/client/src/lib/game-session-resolution.js";

const replayMessages = [
  { id: "start", chatId: "session-1", role: "user", content: "[start game]" },
  {
    id: "turn-1",
    chatId: "session-1",
    role: "assistant",
    content: '[bg: manor] The doors open. [choices: "Enter" | "Leave"]',
  },
  { id: "choice-1", chatId: "session-1", role: "user", content: "[choice: Enter]" },
  {
    id: "turn-2",
    chatId: "session-1",
    role: "assistant",
    content: "The hall grows quiet.",
    extra: {
      cyoaChoices: [
        { label: "Wait", text: "Wait for sunrise" },
        { label: "Run", text: "Run upstairs" },
      ],
      gameReplayCue: {
        background: "hall-night",
        segmentEffects: [{ segment: 0, sfx: ["door-creak"], sfxLoopCount: 3 }],
      },
    },
  },
  { id: "choice-2", chatId: "session-1", role: "user", content: "Wait for sunrise" },
  { id: "turn-3", chatId: "session-1", role: "assistant", content: "Morning arrives." },
  {
    id: "summary",
    chatId: "session-1",
    role: "narrator",
    content: "**Session 1 Concluded**\n\nYou survived the manor.",
  },
] as Message[];
const replayTurns = buildGameSessionReplayTurns(replayMessages);
assert.equal(replayTurns.length, 3);
assert.equal(replayTurns[0]?.playerMessage, null);
assert.equal(replayTurns[0]?.recordedChoice?.label, "Enter");
assert.equal(replayTurns[0]?.presentation.background, "manor");
assert.equal(replayTurns[1]?.playerMessage?.content, "Enter");
assert.equal(replayTurns[1]?.recordedChoice?.label, "Wait");
assert.equal(replayTurns[1]?.presentation.background, "hall-night");
assert.deepEqual(replayTurns[1]?.presentation.segmentEffects, [{ segment: 0, sfx: ["door-creak"], sfxLoopCount: 3 }]);
assert.equal(replayTurns[2]?.playerMessage?.content, "Wait for sunrise");
const replayStoryboardFrames = [
  { id: "frame-2", index: 1, sectionStartIndex: 2, sectionEndIndex: 3 },
  { id: "frame-1", index: 0, sectionStartIndex: 0, sectionEndIndex: 1 },
  { id: "frame-3", index: 2, sectionStartIndex: 5, sectionEndIndex: 5 },
] as Parameters<typeof findReplayStoryboardKeyframe>[0];
assert.equal(findReplayStoryboardKeyframe([], 0), null);
assert.equal(findReplayStoryboardKeyframe(replayStoryboardFrames, null)?.id, "frame-1");
assert.equal(findReplayStoryboardKeyframe(replayStoryboardFrames, 3)?.id, "frame-2");
assert.equal(findReplayStoryboardKeyframe(replayStoryboardFrames, 4)?.id, "frame-3");
const unanchoredReplayStoryboardFrames = [
  { id: "unanchored-2", index: 2 },
  { id: "unanchored-1", index: 1 },
] as Parameters<typeof findReplayStoryboardKeyframe>[0];
assert.equal(findReplayStoryboardKeyframe(unanchoredReplayStoryboardFrames, 4)?.id, "unanchored-1");
const overlappingReplayStoryboardFrames = [
  { id: "overlap-2", index: 2, sectionStartIndex: 1, sectionEndIndex: 5 },
  { id: "overlap-1", index: 1, sectionStartIndex: 2, sectionEndIndex: 4 },
] as Parameters<typeof findReplayStoryboardKeyframe>[0];
assert.equal(findReplayStoryboardKeyframe(overlappingReplayStoryboardFrames, 3)?.id, "overlap-1");
const tiedReplayStoryboardFrames = [
  { id: "right", index: 2, sectionStartIndex: 6, sectionEndIndex: 6 },
  { id: "left", index: 1, sectionStartIndex: 2, sectionEndIndex: 2 },
] as Parameters<typeof findReplayStoryboardKeyframe>[0];
assert.equal(findReplayStoryboardKeyframe(tiedReplayStoryboardFrames, 4)?.id, "left");
const replaySessionChats = [
  {
    id: "canonical",
    mode: "game",
    groupId: "game-1",
    metadata: { gameSessionNumber: 1, gameSessionStatus: "concluded" },
    updatedAt: "2026-07-10T00:00:00.000Z",
    createdAt: "2026-07-09T00:00:00.000Z",
  },
  {
    id: "branch",
    mode: "game",
    groupId: "game-1",
    metadata: { gameSessionNumber: 1, branchName: "Alternate door" },
    updatedAt: "2026-07-11T00:00:00.000Z",
    createdAt: "2026-07-11T00:00:00.000Z",
  },
  {
    id: "legacy-only-branch",
    mode: "game",
    groupId: "game-1",
    metadata: { gameSessionNumber: 2, branchName: "Legacy campaign name" },
    updatedAt: "2026-07-08T00:00:00.000Z",
    createdAt: "2026-07-08T00:00:00.000Z",
  },
] as Chat[];
assert.equal(findReplayableGameSessionChat(replaySessionChats, 1)?.id, "canonical");
assert.equal(findReplayableGameSessionChat(replaySessionChats, 2)?.id, "legacy-only-branch");
assert.equal(findReplayableGameSessionChat(replaySessionChats, 3), null);
