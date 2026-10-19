import assert from "node:assert/strict";
import {
  gameTtsEmotionIndicatorsEnabled,
  TTS_EMOTION_CUE_GUIDANCE,
} from "../../packages/server/src/services/tts-emotion-guidance.js";
import { buildGmFormatReminder } from "../../packages/server/src/services/game/gm-prompts.js";
import { buildPartySystemPrompt } from "../../packages/server/src/services/game/party-prompts.js";
import { buildInitPrompt } from "../../packages/server/src/routes/encounter.routes.js";

// Game has no separate dialogue-formatting call: its existing generators receive guidance only
// when voice playback and its emotion setting are all enabled. Old or malformed settings stay off.
for (const enabled of [false, true]) {
  for (const autoplayGame of [false, true]) {
    for (const roleplaySpeakerExtractorEmotionsEnabled of [false, true]) {
      assert.equal(
        gameTtsEmotionIndicatorsEnabled(
          JSON.stringify({ enabled, autoplayGame, roleplaySpeakerExtractorEmotionsEnabled }),
        ),
        enabled && autoplayGame && roleplaySpeakerExtractorEmotionsEnabled,
      );
    }
  }
}
for (const raw of [undefined, null, "", "{", "null", "[]", "{}", '{"enabled":"true"}']) {
  assert.equal(gameTtsEmotionIndicatorsEnabled(raw), false);
}
assert.equal(
  gameTtsEmotionIndicatorsEnabled(
    JSON.stringify({ enabled: true, autoplayGame: true, roleplaySpeakerExtractorEmotionsEnabled: true, source: "bad" }),
  ),
  false,
);
assert.match(TTS_EMOTION_CUE_GUIDANCE, /\[[^\]]*,[^\]]+\]/u, "cues may describe compound audible delivery");
for (const match of TTS_EMOTION_CUE_GUIDANCE.matchAll(/\[([^\]]+)\]/gu)) {
  assert.ok(match[1]!.length <= 80, "guidance examples fit the existing annotation validator");
}

const withoutGuidance = (value: string) =>
  value
    .split("\n")
    .filter((line) => !line.includes(TTS_EMOTION_CUE_GUIDANCE))
    .join("\n");

for (const hasSceneModel of [false, true]) {
  const context = {
    gameActiveState: "dialogue" as const,
    sessionNumber: 1,
    map: null,
    partyNames: ["Dottore"],
    playerName: "Mari",
    hasSceneModel,
  };
  const original = buildGmFormatReminder(context);
  assert.equal(buildGmFormatReminder({ ...context, ttsEmotionIndicatorsEnabled: false }), original);
  const annotated = buildGmFormatReminder({ ...context, ttsEmotionIndicatorsEnabled: true });
  assert.ok(annotated.includes(TTS_EMOTION_CUE_GUIDANCE));
  assert.match(annotated, /inside the quoted dialogue after the colon/u);
  assert.equal(withoutGuidance(annotated), original, "GM instructions off preserve every existing prompt byte");
}

const partyContext = {
  partyCards: [{ name: "Dottore", card: "A sardonic scholar." }],
  playerName: "Mari",
  gameActiveState: "dialogue",
};
const partyOriginal = buildPartySystemPrompt(partyContext);
assert.equal(buildPartySystemPrompt({ ...partyContext, ttsEmotionIndicatorsEnabled: false }), partyOriginal);
const partyAnnotated = buildPartySystemPrompt({ ...partyContext, ttsEmotionIndicatorsEnabled: true });
assert.ok(partyAnnotated.includes(TTS_EMOTION_CUE_GUIDANCE));
assert.match(partyAnnotated, /keep the \[Name\] \[type\] \[expression\]: prefix unchanged/u);
assert.equal(withoutGuidance(partyAnnotated), partyOriginal, "party instructions change only the spoken-text guidance");

const combatPrompt = (enabled?: boolean) =>
  buildInitPrompt(
    "Mari",
    "persona",
    "party cards",
    [],
    "",
    "",
    false,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    enabled,
  );
const combatOriginal = combatPrompt();
assert.deepEqual(combatPrompt(false), combatOriginal);
const combatAnnotated = combatPrompt(true);
assert.ok(combatAnnotated.some((message) => message.content.includes(TTS_EMOTION_CUE_GUIDANCE)));
assert.ok(
  combatAnnotated.some((message) => message.content.includes("Inside spoken dialogueCues.content strings only")),
);
assert.deepEqual(
  combatAnnotated.map((message) => ({ ...message, content: withoutGuidance(message.content) })),
  combatOriginal,
  "battle dialogue guidance leaves the existing combat JSON and mechanics instructions untouched",
);

console.info("Game TTS emotion guidance regression passed");
